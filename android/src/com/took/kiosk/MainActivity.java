package com.took.kiosk;

// 툭 안드로이드 앱 (2026-11-17)
// 정적 버전(dist/static, npm run build:web 과 같은 파일)을 앱 안(assets/www)에 넣고 WebView 로 띄운다.
// - 파일은 https://appassets.androidplatform.net/ 주소로 보낸다(가짜 https 출처). file:// 로 열면
//   ES 모듈·fetch·WASM(MediaPipe)이 막히고, https 출처여야 카메라(getUserMedia)도 쓸 수 있다.
// - 음성 인식(Web Speech API)은 안드로이드 WebView 에 없어서 동작하지 않는다 (화면은 '지원하지 않음' 안내를 띄운다)
// - 화면 전체를 쓰고(상태·내비게이션 바 숨김) 화면이 꺼지지 않게 한다.
// - 페이지의 전체화면 요청(js/fullscreen-keep.js)은 onShowCustomView 로 받아 준다. 받지 않으면 화면이 빈다.
// - USB 웹캠 직접 연결 (2026-11-22): 갤탭이 USB 웹캠을 카메라로 등록하지 않아 getUserMedia 로 못 여는 문제 때문에
//   UvcCamera 가 USB 로 웹캠을 직접 열고, 페이지는 window.TookUvc 와 /__uvc/frame 으로 영상을 받는다 (js/uvc-bridge.js)
//   웹 주소에서도 USB 웹캠(window.TookUvc, /__uvc/frame)·카메라 권한은 그 주소에만 준다. 첫 화면을 못 열면(인터넷 끊김) 앱 안 화면으로 연다
// - 화면 고정 (2026-11-26): 관리자 화면의 '화면 고정 켜기' 버튼이 안드로이드 '앱 고정'을 켠다 (window.TookKiosk, 아래 KioskBridge).
//   켜면 홈·최근 앱·알림 창이 막힌다. 끄기는 같은 버튼, 또는 뒤로+최근 앱 버튼을 함께 길게 누르기
// - 콘솔 로그는 logcat 태그 "took" 로 남는다 (adb logcat -s took). chrome://inspect 로 원격 디버깅도 된다.

import android.Manifest;
import android.annotation.TargetApi;
import android.app.Activity;
import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public class MainActivity extends Activity {
    static final String TAG = "took";
    static final String HOST = "appassets.androidplatform.net";
    static final String LOCAL_URL = "https://" + HOST + "/index.html";
    static final int REQ_MEDIA = 7;
    static final int REQ_UVC_CAMERA = 8; // USB 웹캠 직접 연결 전에 카메라 권한 (2026-11-23)

    FrameLayout root;
    WebView web;
    View customView; // 페이지가 전체화면을 켰을 때 WebView 가 넘겨주는 화면
    WebChromeClient.CustomViewCallback customCallback;
    PermissionRequest pendingRequest; // 카메라 권한을 묻는 동안 기다리는 페이지 요청
    UvcCamera uvc; // USB 웹캠 직접 연결

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 30) {
            w.getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        } else if (Build.VERSION.SDK_INT >= 28) {
            w.getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        setContentView(root);
        uvc = new UvcCamera(this, new UvcCamera.Listener() {
            @Override public void onUsbEvent(String type) {
                Log.i(TAG, "usb " + type);
                if ("need-camera".equals(type)) runOnUiThread(new Runnable() {
                    @Override public void run() { requestPermissions(new String[] { Manifest.permission.CAMERA }, REQ_UVC_CAMERA); }
                });
                else if ("usb-ask".equals(type)) unpinForUsbDialog();   // USB 허용 창을 띄우기 직전
                else if ("usb-answer".equals(type)) repinSoon();        // 허용 창에서 답했다
            }
        });
        createWebView();
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl(LOCAL_URL);
        hideSystemBars();
    }

    boolean ourHost(String host) {
        return HOST.equals(host);
    }

    void createWebView() {
        WebView.setWebContentsDebuggingEnabled(true);
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.addJavascriptInterface(uvc.bridge, "TookUvc"); // 앱 안 화면(appassets)만 쓴다
        web.addJavascriptInterface(new KioskBridge(this), "TookKiosk"); // 화면 고정 (관리자 화면 버튼)

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // localStorage: 터치 조정값·카메라 설정·언어
        s.setMediaPlaybackRequiresUserGesture(false); // 카메라 영상 자동 재생
        s.setUseWideViewPort(true); // Chrome 처럼 <meta name="viewport"> 를 따른다
        s.setLoadWithOverviewMode(false);
        s.setTextZoom(100); // 기기 글꼴 크기 설정이 900×1440 화면 배치를 바꾸지 않게
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        // 키오스크: 길게 누르면 뜨는 글자 선택·진동을 끈다 (페이지의 길게 누르기 감지는 그대로 동작)
        web.setHapticFeedbackEnabled(false);
        web.setOnLongClickListener(new View.OnLongClickListener() {
            @Override public boolean onLongClick(View v) { return true; }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                // USB 웹캠 영상
                if ("/__uvc/frame".equals(u.getPath()) && ourHost(u.getHost())) {
                    Map<String, String> h = new HashMap<String, String>();
                    h.put("Access-Control-Allow-Origin", "*");
                    return serveUvcFrame(u, h);
                }
                return serveAsset(u);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false; // 링크는 앱 안에서 연다 (지금 Chrome 탭에서 열던 것과 같다)
            }

            @TargetApi(26)
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // 화면 엔진이 죽어도 앱을 끄지 않고 처음 화면부터 다시 띄운다
                Log.e(TAG, "renderer gone (crash=" + detail.didCrash() + "), restarting");
                root.removeView(web);
                web.destroy();
                createWebView();
                web.loadUrl(LOCAL_URL);
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override public void run() { handlePermission(request); }
                });
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingRequest == request) pendingRequest = null;
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i(TAG, m.messageLevel() + " " + m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
                return true;
            }

            @Override
            public Bitmap getDefaultVideoPoster() {
                // 카메라 <video> 가 재생되기 전 WebView 가 기본으로 그리는 회색 재생 버튼을 숨긴다
                return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) { callback.onCustomViewHidden(); return; }
                customView = view;
                customCallback = callback;
                view.setBackgroundColor(Color.BLACK);
                root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                hideSystemBars();
            }

            @Override
            public void onHideCustomView() {
                if (customView == null) return;
                root.removeView(customView);
                customView = null;
                customCallback = null;
                hideSystemBars();
            }
        });
    }

    // ---------- 화면 고정 (앱 고정, 2026-11-26): 관리자 화면(admin.html)의 '화면 고정' 버튼이 부른다 (window.TookKiosk) ----------
    // 안드로이드의 '앱 고정'을 앱이 직접 켠다. 켜져 있는 동안 홈·최근 앱·알림 창이 막혀 이 앱 밖으로 나갈 수 없다.
    // - 켤 때마다 시스템이 '앱을 고정할까요?' 창을 한 번 띄운다 (기기 소유자로 등록한 앱이 아니라서 건너뛸 수 없다)
    // - 끄기: 같은 버튼(unpin), 또는 뒤로+최근 앱 버튼을 함께 길게 누르기(제스처 방식이면 아래에서 쓸어 올려 멈추기)
    // - 기기를 껐다 켜면 풀린다. 최근 앱 화면에서 손으로 켠 고정은 앱이 못 풀 수 있다 → 그때는 버튼 두 개 길게 누르기
    boolean pinned() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        return am != null && am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }

    // 지금 떠 있는 화면이 앱 안 화면일 때만 (앱 안에서 연 다른 사이트는 고정을 켜고 끌 수 없다)
    boolean onOurPage() {
        String url = web == null ? null : web.getUrl();
        return url != null && ourHost(Uri.parse(url).getHost());
    }

    void setPinned(final boolean on) {
        runOnUiThread(new Runnable() {
            @Override public void run() {
                if (!onOurPage()) return;
                if (!on) repinAfterUsb = false; // 끄기를 눌렀으면 웹캠 허용 뒤 다시 걸지 않는다
                if (pinned() == on) return;
                try {
                    // 고정 중에는 USB 허용 창이 못 뜬다 → 꽂힌 웹캠의 권한이 아직 없으면 그 창부터 띄우고, 답을 받은 뒤 고정한다 (repinSoon)
                    if (on && uvc != null && uvc.askPermissionFirst()) { repinAfterUsb = true; return; }
                    if (on) startLockTask(); else stopLockTask();
                } catch (RuntimeException e) {
                    Log.w(TAG, "screen pin " + (on ? "on" : "off") + " failed: " + e);
                }
                hideSystemBars();
            }
        });
    }

    // ---------- 화면 고정과 USB 웹캠 허용 창 (2026-11-26) ----------
    // 앱 고정이 켜져 있으면 안드로이드가 다른 화면을 못 띄우게 막아서 'USB 기기 접근 허용' 창도 뜨지 않는다 → 웹캠이 안 잡힌다.
    // (고정을 켠 뒤 처음 거울을 열거나, 고정 중에 웹캠을 뽑았다 꽂으면 생긴다)
    // 그래서 그 창을 띄워야 할 때만 고정을 잠깐 풀고, 허용·거부를 누르면 다시 건다 (다시 걸 때 시스템 확인 창이 한 번 더 뜬다)
    volatile boolean repinAfterUsb;
    int repinTries;

    // UvcCamera 의 작업 스레드에서 부른다: 고정이 풀릴 때까지(최대 2초) 기다렸다가 돌아가야 허용 창이 뜬다
    void unpinForUsbDialog() {
        if (!pinned()) return;
        final CountDownLatch done = new CountDownLatch(1);
        runOnUiThread(new Runnable() {
            @Override public void run() {
                try {
                    if (pinned()) { stopLockTask(); repinAfterUsb = true; Log.i(TAG, "screen pin off for USB permission dialog"); }
                } catch (RuntimeException e) {
                    Log.w(TAG, "screen pin off for USB dialog failed: " + e);
                }
                done.countDown();
            }
        });
        try { done.await(2, TimeUnit.SECONDS); } catch (InterruptedException ignored) { }
    }

    void repinSoon() {
        if (!repinAfterUsb) return;
        repinTries = 0;
        root.postDelayed(repin, 600); // 허용 창이 닫힐 시간을 준다
    }

    final Runnable repin = new Runnable() {
        @Override public void run() {
            if (!repinAfterUsb) return;
            if (pinned()) { repinAfterUsb = false; return; }
            try {
                startLockTask();
                repinAfterUsb = false;
                hideSystemBars();
            } catch (RuntimeException e) {
                // 허용 창이 아직 앞에 있으면 '앞에 있는 앱이 아님' 으로 실패한다 → 조금 뒤 다시 (5번까지)
                if (++repinTries < 5) root.postDelayed(this, 600);
                else { repinAfterUsb = false; Log.w(TAG, "screen pin back on failed: " + e); }
            }
        }
    };

    // WebView 가 리플렉션으로 부르므로 public 클래스·public 메서드여야 한다. 페이지는 다른 스레드에서 부른다 → 화면 일은 setPinned 가 넘긴다
    public static class KioskBridge {
        final MainActivity app;
        KioskBridge(MainActivity app) { this.app = app; }
        @JavascriptInterface public boolean isPinned() { return app.pinned(); }
        @JavascriptInterface public void pin() { app.setPinned(true); }
        @JavascriptInterface public void unpin() { app.setPinned(false); }
    }

    // ---------- 카메라 권한: 페이지가 요청하면 안드로이드 권한을 묻고 그 결과대로 허락한다 ----------
    void handlePermission(PermissionRequest request) {
        // 카메라는 앱 안 화면과 툭 웹 주소에만 준다 (앱 안에서 연 다른 사이트에는 안 준다)
        Uri origin = request.getOrigin();
        if (origin == null || !ourHost(origin.getHost())) { request.deny(); return; }
        List<String> missing = new ArrayList<String>();
        for (String r : request.getResources()) {
            String p = androidPermission(r);
            if (p != null && checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED && !missing.contains(p)) missing.add(p);
        }
        if (missing.isEmpty()) { grantAllowed(request); return; }
        if (pendingRequest != null) pendingRequest.deny();
        pendingRequest = request;
        requestPermissions(missing.toArray(new String[0]), REQ_MEDIA);
    }

    static String androidPermission(String resource) {
        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) return Manifest.permission.CAMERA;
        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) return Manifest.permission.RECORD_AUDIO;
        return null;
    }

    void grantAllowed(PermissionRequest request) {
        List<String> ok = new ArrayList<String>();
        for (String r : request.getResources()) {
            String p = androidPermission(r);
            if (p != null && checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED) ok.add(r);
        }
        if (ok.isEmpty()) request.deny();
        else request.grant(ok.toArray(new String[0]));
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == REQ_UVC_CAMERA) {
            boolean ok = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (uvc != null) uvc.onCameraPermission(ok);
            hideSystemBars();
            return;
        }
        if (requestCode != REQ_MEDIA || pendingRequest == null) return;
        PermissionRequest r = pendingRequest;
        pendingRequest = null;
        grantAllowed(r);
        hideSystemBars(); // 권한 창이 닫히면 바가 다시 보일 수 있다
    }

    // ---------- 앱 안 파일 보내기: https://appassets.androidplatform.net/경로 → assets/www/경로 ----------
    WebResourceResponse serveAsset(Uri url) {
        if (!HOST.equals(url.getHost())) return null; // 바깥 주소(글꼴 CDN 등)는 WebView 가 직접 받는다
        String path = url.getPath(); // 이미 풀린(디코딩된) 경로
        if (path == null || path.isEmpty() || path.endsWith("/")) path = (path == null ? "/" : path) + "index.html";
        Map<String, String> headers = new HashMap<String, String>();
        headers.put("Access-Control-Allow-Origin", "*");
        if (path.contains("..")) return notFound(headers);
        try {
            InputStream in = getAssets().open("www" + path);
            String mime = mimeType(path);
            String enc = mime.startsWith("text/") || mime.endsWith("json") || mime.endsWith("+xml") ? "utf-8" : null;
            return new WebResourceResponse(mime, enc, 200, "OK", headers, in);
        } catch (IOException e) {
            Log.w(TAG, "not found: " + path);
            return notFound(headers);
        }
    }

    // USB 웹캠 다음 장: ?after=N 보다 새 장이 올 때까지 최대 1초 기다려 JPEG 로 준다 (WebView 의 요청 처리 스레드라 기다려도 된다)
    WebResourceResponse serveUvcFrame(Uri url, Map<String, String> headers) {
        long after = 0;
        try { after = Long.parseLong(url.getQueryParameter("after")); } catch (Exception ignored) { }
        headers.put("Cache-Control", "no-store");
        Object[] f = uvc == null ? null : uvc.waitJpeg(after, 1000);
        if (f == null) return new WebResourceResponse("text/plain", "utf-8", 204, "No Frame", headers, new ByteArrayInputStream(new byte[0]));
        headers.put("X-Seq", String.valueOf(f[0]));
        headers.put("Access-Control-Expose-Headers", "X-Seq");
        return new WebResourceResponse("image/jpeg", null, 200, "OK", headers, new ByteArrayInputStream((byte[]) f[1]));
    }

    static WebResourceResponse notFound(Map<String, String> headers) {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, new ByteArrayInputStream(new byte[0]));
    }

    static final Map<String, String> MIME = new HashMap<String, String>();
    static {
        String[][] m = {
            {"html", "text/html"}, {"htm", "text/html"}, {"js", "text/javascript"}, {"mjs", "text/javascript"},
            {"css", "text/css"}, {"json", "application/json"}, {"webmanifest", "application/manifest+json"},
            {"wasm", "application/wasm"}, {"txt", "text/plain"}, {"csv", "text/csv"}, {"xml", "application/xml"},
            {"svg", "image/svg+xml"}, {"png", "image/png"}, {"jpg", "image/jpeg"}, {"jpeg", "image/jpeg"},
            {"gif", "image/gif"}, {"webp", "image/webp"}, {"avif", "image/avif"}, {"ico", "image/x-icon"},
            {"woff", "font/woff"}, {"woff2", "font/woff2"}, {"ttf", "font/ttf"}, {"otf", "font/otf"},
            {"mp3", "audio/mpeg"}, {"wav", "audio/wav"}, {"ogg", "audio/ogg"}, {"mp4", "video/mp4"}, {"webm", "video/webm"},
        };
        for (String[] e : m) MIME.put(e[0], e[1]);
    }

    static String mimeType(String path) {
        int dot = path.lastIndexOf('.');
        String ext = dot < 0 ? "" : path.substring(dot + 1).toLowerCase(Locale.ROOT);
        String t = MIME.get(ext);
        return t != null ? t : "application/octet-stream";
    }

    // ---------- 화면 전체 쓰기 ----------
    @SuppressWarnings("deprecation")
    void hideSystemBars() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // 화면 고정 중에는 뒤로가기도 막는다 (2026-11-26 사용자 요청: 홈·최근 앱은 시스템이 막지만 뒤로가기는 앱이 받아서 앞 화면으로 돌아갔다).
        // 고정을 손으로 푸는 '뒤로 + 최근 앱 길게 누르기'는 시스템이 처리하므로 그대로 된다
        if (pinned()) return;
        if (customCallback != null) { customCallback.onCustomViewHidden(); return; }
        if (web != null && web.canGoBack()) { web.goBack(); return; }
        super.onBackPressed();
    }

    // 앱이 뒤로 가면 카메라를 놓고, 앞으로 오면 다시 쓴다
    @Override protected void onPause() { super.onPause(); if (web != null) web.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); hideSystemBars(); }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    // USB 웹캠을 꽂아 앱이 열렸을 때 (USB_DEVICE_ATTACHED 필터): 화면은 그대로, 페이지가 꽂힌 걸 알아서 연결한다
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    @Override
    protected void onDestroy() {
        if (uvc != null) { uvc.destroy(); uvc = null; }
        if (web != null) { root.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }
}
