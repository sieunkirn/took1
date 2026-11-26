package com.took.kiosk;

// 툭 앱 USB 웹캠 직접 연결 (2026-11-22)
//
// 갤탭처럼 Android 가 USB(UVC) 웹캠을 카메라로 등록하지 않는 기기에서는 Chrome·WebView 의 getUserMedia 가 웹캠을 못 본다.
// 그래서 앱이 Android USB Host API 로 웹캠을 직접 연다:
//   1) USB 장치 목록에서 영상 장치(인터페이스 클래스 14 = UVC)를 찾고 USB 권한을 받는다
//      (매니페스트의 USB_DEVICE_ATTACHED 필터 덕분에 '이 장치는 항상 툭으로 열기'를 고르면 다음부터 묻지 않는다)
//   2) 설명자(getRawDescriptors)에서 영상 형식(MJPEG·YUY2)·해상도·프레임 간격·등시 엔드포인트를 읽는다
//   3) UVC probe/commit 제어 전송으로 형식·해상도를 정하고, 대역폭에 맞는 대체 설정(alt setting)을 고른다
//   4) 영상 데이터: 등시 전송은 네이티브(android/jni/uvc.c, libtookuvc.so)가 usbfs 로 받고, 벌크 전송 웹캠은 여기서 받는다
//   5) 다 모인 한 장을 JPEG 로 보관한다 (MJPEG 는 그대로, YUY2 는 YuvImage 로 JPEG 변환)
// 웹 화면은 https://appassets.androidplatform.net/__uvc/frame?after=N 으로 다음 장을 받아 캔버스에 그리고
// canvas.captureStream() 으로 가짜 카메라 스트림을 만든다 (js/uvc-bridge.js). 그래서 거울·색 보정·웹캠 설정 화면이 그대로 쓴다.

import android.Manifest;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.ImageFormat;
import android.graphics.Rect;
import android.graphics.YuvImage;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.util.Log;
import android.webkit.JavascriptInterface;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class UvcCamera {
    static final String TAG = "took-uvc";
    static final String ACTION_PERMISSION = "com.took.kiosk.USB_PERMISSION";

    static boolean nativeOk;
    static String nativeError = "";
    static {
        try { System.loadLibrary("tookuvc"); nativeOk = true; }
        catch (Throwable t) { nativeOk = false; nativeError = String.valueOf(t.getMessage()); }
    }
    static native int nativeStart(int fd, int ep, int pktSize, int pktsPerUrb, int nUrbs, int maxFrame, int expectSize);
    static native void nativeStop();
    static native long nativeWaitFrame(long afterSeq, int timeoutMs);
    static native int nativeCopyFrame(byte[] out);
    static native String nativeStats();

    interface Listener { void onUsbEvent(String type); }

    // ---------- 설명자에서 읽은 것 ----------
    static class Frame {
        int index, width, height, maxBuf, defInterval;
        int[] intervals; // 100ns 단위
        String desc() { return width + "x" + height; }
    }
    static class Format {
        int index; String kind; // MJPEG / YUY2 / 기타 fourcc
        List<Frame> frames = new ArrayList<Frame>();
    }
    static class Alt {
        int iface, alt, ep, type, size; // type 1=등시 2=벌크, size=실제 패킷 크기
    }

    final Context ctx;
    final UsbManager um;
    final Listener listener;
    final ExecutorService exec = Executors.newSingleThreadExecutor();

    UsbDevice dev;
    UsbDeviceConnection conn;
    int vcIf = -1, vsIf = -1, bcdUvc = 0x0100;
    List<Format> formats = new ArrayList<Format>();
    List<Alt> alts = new ArrayList<Alt>();

    volatile String state = "idle"; // idle / no-device / need-permission / opening / streaming / error
    volatile String lastError = "";
    String chosen = "";               // 고른 형식 설명 (진단용)
    int curW, curH, curFps;
    boolean yuy2;
    int reqW = 1280, reqH = 960, reqFps = 30;
    volatile boolean streaming;
    Thread pump;                      // 장을 JPEG 로 만드는 스레드 (벌크면 받기까지)
    final List<String> log = new ArrayList<String>();

    // 최신 JPEG
    final Object frameLock = new Object();
    byte[] jpeg;
    long jpegSeq;
    long jpegCount, lastFpsAt = System.currentTimeMillis(), lastFpsCount;
    volatile int fpsNow;

    UvcCamera(Context ctx, Listener listener) {
        this.ctx = ctx;
        this.listener = listener;
        this.um = (UsbManager) ctx.getSystemService(Context.USB_SERVICE);
        IntentFilter f = new IntentFilter();
        f.addAction(ACTION_PERMISSION);
        f.addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED);
        f.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        if (Build.VERSION.SDK_INT >= 33) ctx.registerReceiver(receiver, f, Context.RECEIVER_NOT_EXPORTED);
        else ctx.registerReceiver(receiver, f);
    }

    void note(String s) {
        Log.i(TAG, s);
        synchronized (log) {
            log.add(String.format(Locale.ROOT, "%tT %s", System.currentTimeMillis(), s));
            if (log.size() > 60) log.remove(0);
        }
    }

    // ---------- USB 장치 찾기 ----------
    static boolean isUvc(UsbDevice d) {
        for (int i = 0; i < d.getInterfaceCount(); i++) {
            UsbInterface ui = d.getInterface(i);
            if (ui.getInterfaceClass() == UsbConstants.USB_CLASS_VIDEO) return true;
        }
        return false;
    }

    UsbDevice findUvc() {
        if (um == null) return null;
        for (UsbDevice d : um.getDeviceList().values()) if (isUvc(d)) return d;
        return null;
    }

    final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent intent) {
            String a = intent.getAction();
            UsbDevice d = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            if (ACTION_PERMISSION.equals(a)) {
                boolean ok = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                note("USB 권한 " + (ok ? "허용" : "거부") + (d != null ? " · " + name(d) : ""));
                final boolean prime = primeOnly; // 화면 고정 전에 미리 받은 권한이면 영상은 켜지 않는다 (화면이 달라고 할 때 켠다)
                primeOnly = false;
                if (ok) { if (!prime) exec.execute(new Runnable() { @Override public void run() { openAndStream(); } }); }
                else if (!prime) { state = "error"; lastError = "USB 권한이 거부됐어요. 웹캠을 다시 꽂고 '허용'을 눌러 주세요"; }
                listener.onUsbEvent("usb-answer"); // 허용 창이 닫혔다 → 화면 고정을 풀어 뒀으면 다시 건다 (MainActivity)
            } else if (UsbManager.ACTION_USB_DEVICE_ATTACHED.equals(a)) {
                if (d != null && isUvc(d)) { note("USB 웹캠 꽂힘: " + name(d)); listener.onUsbEvent("attached"); }
            } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(a)) {
                if (d != null && dev != null && d.getDeviceName().equals(dev.getDeviceName())) {
                    note("USB 웹캠 빠짐: " + name(d));
                    exec.execute(new Runnable() { @Override public void run() { close(); state = "no-device"; } });
                    listener.onUsbEvent("detached");
                } else if (d != null && isUvc(d)) {
                    listener.onUsbEvent("detached");
                }
            }
        }
    };

    static String name(UsbDevice d) {
        String n = null;
        try { if (Build.VERSION.SDK_INT >= 21) n = d.getProductName(); } catch (Throwable ignored) { }
        return (n != null ? n + " " : "") + String.format(Locale.ROOT, "(%04x:%04x)", d.getVendorId(), d.getProductId());
    }

    // ---------- 시작·멈춤 ----------
    void start(int w, int h, int fps) {
        reqW = w > 0 ? w : 1280; reqH = h > 0 ? h : 960; reqFps = fps > 0 ? fps : 30;
        exec.execute(new Runnable() { @Override public void run() { startInternal(); } });
    }

    /** 카메라 권한 결과 (MainActivity) */
    void onCameraPermission(final boolean granted) {
        note("카메라 권한 " + (granted ? "허용" : "거부"));
        if (granted) exec.execute(new Runnable() { @Override public void run() { startInternal(); } });
        else { state = "error"; lastError = "카메라 권한이 거부됐어요. 설정 → 애플리케이션 → 툭 → 권한에서 카메라를 허용해 주세요"; }
    }

    // 화면 고정(앱 고정)이 켜져 있으면 안드로이드가 USB 허용 창을 띄우지 못한다 (2026-11-26, 고정 뒤 웹캠이 안 잡히던 원인).
    // 그래서 ① 허용 창을 띄우기 직전에 "usb-ask" 를 보내 MainActivity 가 고정을 잠깐 풀게 하고, 답("usb-answer")이 오면 다시 건다
    //        ② 고정을 켜기 전에 askPermissionFirst 로 권한을 미리 받는다
    volatile boolean primeOnly; // ②로 띄운 허용 창: 허용돼도 영상은 켜지 않는다

    /** 화면 고정을 켜기 직전에 부른다. 꽂힌 웹캠의 USB 권한이 아직 없으면 허용 창을 먼저 띄우고 true (답은 "usb-answer") */
    boolean askPermissionFirst() {
        UsbDevice d = findUvc();
        if (d == null || um.hasPermission(d)) return false;
        // 카메라 권한이 없으면 USB 허용 창이 뜨지 않고 바로 거부된다 → 여기서는 건너뛴다 (거울 화면에서 카메라 권한부터 묻는다)
        if (Build.VERSION.SDK_INT >= 23 && ctx.checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) return false;
        primeOnly = true;
        note("USB 권한 요청 (화면 고정 전에 미리): " + name(d));
        Intent i = new Intent(ACTION_PERMISSION).setPackage(ctx.getPackageName());
        int flags = Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0;
        um.requestPermission(d, PendingIntent.getBroadcast(ctx, 0, i, flags));
        return true;
    }

    void startInternal() {
        primeOnly = false; // 화면이 영상을 달라고 했다: 허용되면 바로 켠다
        if (streaming && conn != null && curW > 0) {
            // 이미 켜져 있고 해상도가 크게 다르지 않으면 그대로 쓴다
            if (Math.abs(curW * curH - reqW * reqH) < reqW * reqH / 3) return;
        }
        if (!nativeOk) note("네이티브 등시 전송 라이브러리 없음: " + nativeError + " (벌크 전송 웹캠만 가능)");
        UsbDevice d = findUvc();
        if (d == null) { close(); state = "no-device"; lastError = "USB 웹캠이 안 보여요. OTG 젠더·허브·케이블을 확인해 주세요"; return; }
        // Android 는 앱에 카메라 권한이 없으면 USB 영상 장치 권한을 창도 띄우지 않고 바로 거부한다 (2026-11-23 갤탭 레노보 웹캠).
        // uvc-bridge.js 가 getUserMedia 를 가로채서 WebView 카메라 권한 요청이 안 생기므로 여기서 먼저 묻는다
        if (!um.hasPermission(d) && Build.VERSION.SDK_INT >= 23
                && ctx.checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            state = "need-permission";
            lastError = "카메라 권한을 허용해 주세요 (USB 웹캠은 카메라 권한이 있어야 열려요)";
            note("카메라 권한 요청 (USB 웹캠 권한 전에 필요)");
            listener.onUsbEvent("need-camera");
            return;
        }
        if (!um.hasPermission(d)) {
            state = "need-permission";
            note("USB 권한 요청: " + name(d));
            listener.onUsbEvent("usb-ask"); // 화면 고정 중이면 여기서 고정이 풀릴 때까지 기다린다 (풀지 않으면 허용 창이 안 뜬다)
            Intent i = new Intent(ACTION_PERMISSION).setPackage(ctx.getPackageName());
            int flags = Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0;
            um.requestPermission(d, PendingIntent.getBroadcast(ctx, 0, i, flags));
            return;
        }
        openAndStream();
    }

    void stop() {
        exec.execute(new Runnable() { @Override public void run() { close(); if (!"no-device".equals(state)) state = "idle"; } });
    }

    synchronized void close() {
        streaming = false;
        if (pump != null) { pump.interrupt(); try { pump.join(1500); } catch (InterruptedException ignored) { } pump = null; }
        if (nativeOk) nativeStop();
        if (conn != null) {
            try {
                // 영상 끄기: 대체 설정 0 (대역폭 반납)
                UsbInterface z = findInterface(vsIf, 0);
                if (z != null) conn.setInterface(z);
            } catch (Throwable ignored) { }
            conn.close();
            conn = null;
        }
        dev = null;
        curW = curH = curFps = 0;
    }

    // ---------- 열기 ----------
    synchronized void openAndStream() {
        close();
        state = "opening";
        lastError = "";
        UsbDevice d = findUvc();
        if (d == null) { state = "no-device"; lastError = "USB 웹캠이 안 보여요"; return; }
        dev = d;
        conn = um.openDevice(d);
        if (conn == null) { fail("USB 장치를 열지 못했어요 (openDevice 실패)"); return; }
        note("열림: " + name(d) + " · " + d.getDeviceName());
        if (!parse(conn.getRawDescriptors())) { fail("영상 형식(설명자)을 읽지 못했어요"); return; }
        if (vsIf < 0) { fail("영상 스트리밍 인터페이스가 없어요"); return; }
        UsbInterface vc = findInterface(vcIf, 0), vs0 = findInterface(vsIf, 0);
        if (vc != null && !conn.claimInterface(vc, true)) note("영상 제어 인터페이스 claim 실패 (계속 진행)");
        if (vs0 == null || !conn.claimInterface(vs0, true)) { fail("영상 인터페이스를 잡지 못했어요 (claimInterface 실패)"); return; }
        conn.setInterface(vs0);

        // 형식 고르기: MJPEG 우선(USB 2.0 대역폭에 큰 해상도가 들어간다), 없으면 YUY2 를 작은 해상도로
        Format mj = null, yu = null;
        for (Format f : formats) { if ("MJPEG".equals(f.kind) && mj == null) mj = f; if ("YUY2".equals(f.kind) && yu == null) yu = f; }
        List<Object[]> tries = new ArrayList<Object[]>(); // {Format, Frame, interval}
        if (mj != null) addTries(tries, mj, reqW, reqH, reqFps);
        if (yu != null) addTries(tries, yu, Math.min(reqW, 640), Math.min(reqH, 480), Math.min(reqFps, 30));
        if (tries.isEmpty()) { fail("지원하는 영상 형식(MJPEG·YUY2)이 없어요: " + kinds()); return; }

        for (Object[] t : tries) {
            Format f = (Format) t[0]; Frame fr = (Frame) t[1]; int interval = (Integer) t[2];
            if (tryStream(f, fr, interval)) return;
        }
        fail(lastError.isEmpty() ? "웹캠이 영상을 보내지 않아요 (모든 해상도 실패)" : lastError);
    }

    // 요청에 가까운 해상도 순서로, 실패하면 더 작은 해상도로 내려가도록 후보를 늘어놓는다
    static void addTries(List<Object[]> out, Format f, final int w, final int h, int fps) {
        List<Frame> fr = new ArrayList<Frame>(f.frames);
        final long want = (long) w * h;
        java.util.Collections.sort(fr, new java.util.Comparator<Frame>() {
            @Override public int compare(Frame a, Frame b) {
                long da = Math.abs((long) a.width * a.height - want), db = Math.abs((long) b.width * b.height - want);
                return da < db ? -1 : da > db ? 1 : 0;
            }
        });
        int added = 0;
        long firstArea = -1;
        for (Frame x : fr) {
            long area = (long) x.width * x.height;
            if (firstArea < 0) firstArea = area;
            else if (area > firstArea) continue; // 실패하면 더 작은 것만 시도
            out.add(new Object[]{f, x, pickInterval(x, fps)});
            if (++added >= 3) break;
        }
    }

    static int pickInterval(Frame fr, int fps) {
        int want = 10000000 / Math.max(1, fps);
        int best = fr.defInterval > 0 ? fr.defInterval : want;
        if (fr.intervals != null && fr.intervals.length > 0) {
            best = fr.intervals[0];
            for (int v : fr.intervals) if (Math.abs(v - want) < Math.abs(best - want)) best = v;
        }
        return best;
    }

    boolean tryStream(Format f, Frame fr, int interval) {
        int len = bcdUvc >= 0x0150 ? 48 : bcdUvc >= 0x0110 ? 34 : 26;
        byte[] p = new byte[len];
        putU16(p, 0, 1); // bmHint: 프레임 간격 고정
        p[2] = (byte) f.index;
        p[3] = (byte) fr.index;
        putU32(p, 4, interval);
        int r = conn.controlTransfer(0x21, 0x01 /*SET_CUR*/, 0x0100 /*VS_PROBE*/, vsIf, p, len, 1000);
        if (r != len) { note("probe SET_CUR 실패 " + r + " (" + f.kind + " " + fr.desc() + ")"); lastError = "웹캠이 형식 설정을 거부했어요"; return false; }
        byte[] g = new byte[len];
        r = conn.controlTransfer(0xA1, 0x81 /*GET_CUR*/, 0x0100, vsIf, g, len, 1000);
        if (r < 26) { note("probe GET_CUR 실패 " + r); g = p; }
        int maxFrame = getU32(g, 18), maxPayload = getU32(g, 22);
        r = conn.controlTransfer(0x21, 0x01, 0x0200 /*VS_COMMIT*/, vsIf, g, len, 1000);
        if (r != len) { note("commit 실패 " + r); lastError = "웹캠이 형식 확정을 거부했어요"; return false; }
        int fps = (int) Math.round(10000000.0 / Math.max(1, getU32(g, 4) > 0 ? getU32(g, 4) : interval));
        note(String.format(Locale.ROOT, "형식 %s %s %dfps · 한 장 최대 %d · 전송 단위 %d", f.kind, fr.desc(), fps, maxFrame, maxPayload));

        yuy2 = "YUY2".equals(f.kind);
        int expect = yuy2 ? fr.width * fr.height * 2 : 0;
        int frameCap = Math.max(Math.max(maxFrame, fr.maxBuf), fr.width * fr.height * (yuy2 ? 2 : 3)) + 4096;

        // 대체 설정: 전송 단위 이상인 가장 작은 등시 설정, 없으면 가장 큰 것 (실패하면 더 작은 것도 시도)
        List<Alt> iso = new ArrayList<Alt>();
        Alt bulk = null;
        for (Alt a : alts) {
            if (a.iface != vsIf) continue;
            if (a.type == 1 && a.alt > 0) iso.add(a);
            if (a.type == 2 && bulk == null) bulk = a;
        }
        java.util.Collections.sort(iso, new java.util.Comparator<Alt>() {
            @Override public int compare(Alt a, Alt b) { return a.size - b.size; }
        });
        if (iso.isEmpty() && bulk == null) { lastError = "웹캠에 영상 엔드포인트가 없어요"; return false; }

        curW = fr.width; curH = fr.height; curFps = fps;
        if (iso.isEmpty()) {
            chosen = f.kind + " " + fr.desc() + " " + fps + "fps · 벌크 전송";
            return startBulk(bulk, Math.max(maxPayload, 512), frameCap, expect);
        }
        if (!nativeOk) { lastError = "이 웹캠은 등시 전송이라 네이티브 라이브러리가 필요해요 (" + nativeError + ")"; return false; }
        int startIdx = iso.size() - 1;
        for (int i = 0; i < iso.size(); i++) if (iso.get(i).size >= maxPayload) { startIdx = i; break; }
        for (int i = startIdx; i >= 0; i--) {
            Alt a = iso.get(i);
            UsbInterface ui = findInterface(vsIf, a.alt);
            if (ui == null || !conn.setInterface(ui)) { note("대체 설정 " + a.alt + " 실패 (패킷 " + a.size + ")"); continue; }
            int pkts = 32;
            int urbs = a.size * pkts > 200000 ? 8 : 16;
            int n = nativeStart(conn.getFileDescriptor(), a.ep, a.size, pkts, urbs, frameCap, expect);
            if (n <= 0) { note("등시 전송 시작 실패 " + n + " (설정 " + a.alt + ")"); continue; }
            chosen = String.format(Locale.ROOT, "%s %s %dfps · 등시 설정 %d (패킷 %d)", f.kind, fr.desc(), fps, a.alt, a.size);
            if (waitFirstFrame()) { startPump(false, null, 0, 0); state = "streaming"; note("영상 들어옴: " + chosen); return true; }
            note("영상이 안 들어와요 (설정 " + a.alt + ") " + nativeStats());
            nativeStop();
            conn.setInterface(findInterface(vsIf, 0));
        }
        lastError = "웹캠이 영상을 보내지 않아요 (USB 대역폭·전원 부족 의심: 전원 허브 사용, 해상도 낮추기)";
        return false;
    }

    boolean waitFirstFrame() {
        long seq = nativeWaitFrame(0, 3000);
        return seq > 0;
    }

    // ---------- 벌크 전송 웹캠: 자바에서 받는다 ----------
    boolean startBulk(Alt a, int payload, int frameCap, int expect) {
        final UsbEndpoint ep = findEndpoint(vsIf, a.alt, a.ep);
        if (ep == null) { lastError = "벌크 엔드포인트를 찾지 못했어요"; return false; }
        startPump(true, ep, Math.max(payload, ep.getMaxPacketSize()), frameCap);
        bulkExpect = expect;
        long until = System.currentTimeMillis() + 3000;
        while (System.currentTimeMillis() < until) {
            synchronized (frameLock) { if (jpegSeq > 0) { state = "streaming"; note("영상 들어옴: " + chosen); return true; } }
            try { Thread.sleep(50); } catch (InterruptedException e) { break; }
        }
        streaming = false;
        if (pump != null) { pump.interrupt(); try { pump.join(1000); } catch (InterruptedException ignored) { } pump = null; }
        lastError = "벌크 전송으로 영상이 안 들어와요";
        return false;
    }
    int bulkExpect;

    void startPump(final boolean bulkMode, final UsbEndpoint ep, final int payload, final int frameCap) {
        synchronized (frameLock) { jpeg = null; jpegSeq = 0; }
        jpegCount = lastFpsCount = 0;
        streaming = true;
        final int w = curW, h = curH;
        final boolean isYuy2 = yuy2;
        pump = new Thread(new Runnable() {
            @Override public void run() {
                if (bulkMode) bulkLoop(ep, payload, frameCap, w, h, isYuy2);
                else nativeLoop(frameCap, w, h, isYuy2);
            }
        }, "took-uvc-pump");
        pump.start();
    }

    void nativeLoop(int frameCap, int w, int h, boolean isYuy2) {
        byte[] buf = new byte[frameCap];
        long seq = 0;
        while (streaming && !Thread.currentThread().isInterrupted()) {
            long s = nativeWaitFrame(seq, 500);
            if (s < 0) { // 네이티브가 멈췄다 (장치 빠짐 등)
                if (streaming) { note("영상 전송이 멈췄어요 " + nativeStats()); state = "error"; lastError = "웹캠 연결이 끊겼어요"; listener.onUsbEvent("detached"); }
                break;
            }
            if (s == 0) continue;
            seq = s;
            int n = nativeCopyFrame(buf);
            if (n < 0) { buf = new byte[-n + 4096]; n = nativeCopyFrame(buf); }
            if (n > 0) publish(buf, n, w, h, isYuy2);
        }
    }

    void bulkLoop(UsbEndpoint ep, int payload, int frameCap, int w, int h, boolean isYuy2) {
        byte[] pkt = new byte[Math.max(payload, 512)];
        byte[] work = new byte[frameCap];
        int workLen = 0, lastFid = -1;
        boolean bad = false;
        while (streaming && !Thread.currentThread().isInterrupted()) {
            int n = conn.bulkTransfer(ep, pkt, pkt.length, 500);
            if (n <= 0) continue;
            int hlen = pkt[0] & 0xff;
            if (hlen < 2 || hlen > n) continue;
            int flags = pkt[1] & 0xff;
            int fid = flags & 1;
            if (lastFid >= 0 && fid != lastFid && workLen > 0) {
                if (!bad && okFrame(work, workLen, isYuy2, w, h)) publish(work, workLen, w, h, isYuy2);
                workLen = 0; bad = false;
            }
            lastFid = fid;
            if ((flags & 0x40) != 0) bad = true;
            int m = n - hlen;
            if (workLen + m > work.length) { workLen = 0; bad = true; } else { System.arraycopy(pkt, hlen, work, workLen, m); workLen += m; }
            if ((flags & 0x02) != 0) {
                if (!bad && okFrame(work, workLen, isYuy2, w, h)) publish(work, workLen, w, h, isYuy2);
                workLen = 0; bad = false;
            }
        }
    }

    static boolean okFrame(byte[] b, int n, boolean isYuy2, int w, int h) {
        if (isYuy2) return n == w * h * 2;
        return n > 4 && (b[0] & 0xff) == 0xFF && (b[1] & 0xff) == 0xD8;
    }

    void publish(byte[] buf, int n, int w, int h, boolean isYuy2) {
        byte[] out;
        if (isYuy2) {
            try {
                YuvImage img = new YuvImage(n == buf.length ? buf : Arrays.copyOf(buf, n), ImageFormat.YUY2, w, h, null);
                ByteArrayOutputStream bo = new ByteArrayOutputStream(w * h / 4);
                img.compressToJpeg(new Rect(0, 0, w, h), 80, bo);
                out = bo.toByteArray();
            } catch (Throwable t) { return; }
        } else {
            out = Arrays.copyOf(buf, n);
        }
        synchronized (frameLock) {
            jpeg = out;
            jpegSeq++;
            jpegCount++;
            frameLock.notifyAll();
        }
        long now = System.currentTimeMillis();
        if (now - lastFpsAt >= 1000) { fpsNow = (int) ((jpegCount - lastFpsCount) * 1000 / (now - lastFpsAt)); lastFpsCount = jpegCount; lastFpsAt = now; }
    }

    /** 웹 화면용: afterSeq 다음 장을 최대 timeoutMs 기다려 {seq, jpeg} 를 준다. 없으면 null */
    Object[] waitJpeg(long afterSeq, int timeoutMs) {
        long until = System.currentTimeMillis() + timeoutMs;
        synchronized (frameLock) {
            while (streaming && jpegSeq <= afterSeq) {
                long left = until - System.currentTimeMillis();
                if (left <= 0) break;
                try { frameLock.wait(left); } catch (InterruptedException e) { break; }
            }
            if (jpeg == null || jpegSeq <= afterSeq) return null;
            return new Object[]{jpegSeq, jpeg};
        }
    }

    void fail(String msg) {
        note("실패: " + msg);
        lastError = msg;
        state = "error";
        close();
    }

    // ---------- 설명자 읽기 ----------
    boolean parse(byte[] d) {
        formats.clear(); alts.clear(); vcIf = vsIf = -1; bcdUvc = 0x0100;
        if (d == null) return false;
        int pos = 0, curIf = -1, curAlt = -1, curClass = -1, curSub = -1;
        Format curFmt = null;
        while (pos + 2 <= d.length) {
            int bl = d[pos] & 0xff, type = d[pos + 1] & 0xff;
            if (bl < 2 || pos + bl > d.length) break;
            if (type == 4 && bl >= 9) {
                curIf = d[pos + 2] & 0xff; curAlt = d[pos + 3] & 0xff; curClass = d[pos + 5] & 0xff; curSub = d[pos + 6] & 0xff;
                if (curClass == 14 && curSub == 1 && vcIf < 0) vcIf = curIf;
                if (curClass == 14 && curSub == 2 && vsIf < 0) vsIf = curIf;
            } else if (type == 5 && bl >= 7 && curClass == 14 && curSub == 2 && curIf == vsIf) {
                Alt a = new Alt();
                a.iface = curIf; a.alt = curAlt; a.ep = d[pos + 2] & 0xff; a.type = d[pos + 3] & 3;
                int mps = getU16(d, pos + 4);
                a.size = (mps & 0x7ff) * (1 + ((mps >> 11) & 3));
                if ((a.ep & 0x80) != 0) alts.add(a);
            } else if (type == 0x24 && curClass == 14 && curSub == 1 && bl >= 5 && (d[pos + 2] & 0xff) == 0x01) {
                bcdUvc = getU16(d, pos + 3);
            } else if (type == 0x24 && curClass == 14 && curSub == 2 && curIf == vsIf && curAlt == 0 && bl >= 4) {
                int sub = d[pos + 2] & 0xff;
                if (sub == 0x06) { // FORMAT_MJPEG
                    curFmt = new Format(); curFmt.index = d[pos + 3] & 0xff; curFmt.kind = "MJPEG"; formats.add(curFmt);
                } else if (sub == 0x04 && bl >= 21) { // FORMAT_UNCOMPRESSED
                    curFmt = new Format(); curFmt.index = d[pos + 3] & 0xff;
                    curFmt.kind = new String(d, pos + 5, 4, java.nio.charset.StandardCharsets.US_ASCII).trim();
                    formats.add(curFmt);
                } else if ((sub == 0x07 || sub == 0x05) && curFmt != null && bl >= 26) { // FRAME_MJPEG / FRAME_UNCOMPRESSED
                    Frame fr = new Frame();
                    fr.index = d[pos + 3] & 0xff;
                    fr.width = getU16(d, pos + 5); fr.height = getU16(d, pos + 7);
                    fr.maxBuf = getU32(d, pos + 17); fr.defInterval = getU32(d, pos + 21);
                    int n = d[pos + 25] & 0xff;
                    if (n == 0 && bl >= 38) fr.intervals = new int[]{getU32(d, pos + 26), getU32(d, pos + 30)};
                    else {
                        fr.intervals = new int[n];
                        for (int k = 0; k < n && pos + 26 + 4 * k + 4 <= pos + bl; k++) fr.intervals[k] = getU32(d, pos + 26 + 4 * k);
                    }
                    curFmt.frames.add(fr);
                } else if (sub == 0x10 || sub == 0x11 || sub == 0x0C) {
                    curFmt = null; // 프레임 기반·기타 형식: 쓰지 않는다
                }
            }
            pos += bl;
        }
        note("설명자: UVC " + Integer.toHexString(bcdUvc) + " · 제어 " + vcIf + " · 스트림 " + vsIf + " · 형식 " + kinds() + " · 대체 설정 " + altDesc());
        return vsIf >= 0;
    }

    String kinds() {
        StringBuilder b = new StringBuilder();
        for (Format f : formats) {
            if (b.length() > 0) b.append(" / ");
            b.append(f.kind).append('[');
            for (int i = 0; i < f.frames.size(); i++) { if (i > 0) b.append(','); b.append(f.frames.get(i).desc()); }
            b.append(']');
        }
        return b.length() == 0 ? "없음" : b.toString();
    }

    String altDesc() {
        StringBuilder b = new StringBuilder();
        for (Alt a : alts) { if (b.length() > 0) b.append(','); b.append(a.alt).append(a.type == 1 ? ":iso" : ":bulk").append(a.size); }
        return b.toString();
    }

    UsbInterface findInterface(int id, int alt) {
        if (dev == null || id < 0) return null;
        for (int i = 0; i < dev.getInterfaceCount(); i++) {
            UsbInterface ui = dev.getInterface(i);
            if (ui.getId() == id && ui.getAlternateSetting() == alt) return ui;
        }
        return null;
    }

    UsbEndpoint findEndpoint(int id, int alt, int addr) {
        UsbInterface ui = findInterface(id, alt);
        if (ui == null) return null;
        for (int i = 0; i < ui.getEndpointCount(); i++) if (ui.getEndpoint(i).getAddress() == addr) return ui.getEndpoint(i);
        return null;
    }

    static int getU16(byte[] b, int o) { return (b[o] & 0xff) | ((b[o + 1] & 0xff) << 8); }
    static int getU32(byte[] b, int o) { return (b[o] & 0xff) | ((b[o + 1] & 0xff) << 8) | ((b[o + 2] & 0xff) << 16) | ((b[o + 3] & 0xff) << 24); }
    static void putU16(byte[] b, int o, int v) { b[o] = (byte) v; b[o + 1] = (byte) (v >> 8); }
    static void putU32(byte[] b, int o, int v) { putU16(b, o, v); putU16(b, o + 2, v >> 16); }

    static String q(String s) {
        if (s == null) return "null";
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            if (c == '"' || c == '\\') b.append('\\').append(c);
            else if (c < 0x20) b.append(String.format(Locale.ROOT, "\\u%04x", (int) c));
            else b.append(c);
        }
        return b.append('"').toString();
    }

    String statusJson() {
        UsbDevice d = findUvc();
        StringBuilder b = new StringBuilder("{");
        b.append("\"app\":true,\"native\":").append(nativeOk);
        if (!nativeOk) b.append(",\"nativeError\":").append(q(nativeError));
        b.append(",\"state\":").append(q(state));
        b.append(",\"error\":").append(q(lastError));
        b.append(",\"device\":").append(d == null ? "null" : q(name(d)));
        b.append(",\"permission\":").append(d != null && um.hasPermission(d));
        b.append(",\"streaming\":").append(streaming && "streaming".equals(state));
        b.append(",\"width\":").append(curW).append(",\"height\":").append(curH).append(",\"fps\":").append(curFps);
        b.append(",\"fpsNow\":").append(fpsNow);
        b.append(",\"chosen\":").append(q(chosen));
        b.append(",\"formats\":").append(q(kinds()));
        b.append(",\"alts\":").append(q(altDesc()));
        if (nativeOk) b.append(",\"stats\":").append(nativeStats());
        b.append(",\"usb\":[");
        boolean first = true;
        if (um != null) for (UsbDevice x : um.getDeviceList().values()) {
            if (!first) b.append(',');
            first = false;
            b.append(q(name(x) + " class " + x.getDeviceClass() + (isUvc(x) ? " [영상 장치]" : "")));
        }
        b.append("],\"log\":[");
        synchronized (log) { for (int i = 0; i < log.size(); i++) { if (i > 0) b.append(','); b.append(q(log.get(i))); } }
        b.append("]}");
        return b.toString();
    }

    // ---------- 웹 화면이 부르는 함수 (window.TookUvc) ----------
    // WebView 가 리플렉션으로 부르므로 public 클래스·public 메서드여야 한다
    public static class Bridge {
        final UvcCamera cam;
        Bridge(UvcCamera cam) { this.cam = cam; }
        @JavascriptInterface public String status() { return cam.statusJson(); }
        @JavascriptInterface public void start(int w, int h, int fps) { cam.start(w, h, fps); }
        @JavascriptInterface public void stop() { cam.stop(); }
    }
    final Bridge bridge = new Bridge(this);

    void destroy() {
        try { ctx.unregisterReceiver(receiver); } catch (Throwable ignored) { }
        exec.execute(new Runnable() { @Override public void run() { close(); } });
        exec.shutdown();
    }
}
