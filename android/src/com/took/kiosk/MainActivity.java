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
// - 두 가지 APK (2026-11-22): 1번 '툭' 은 앱 안 화면, 2번 '툭 웹' 은 assets/start-url.txt 의 웹 주소(Vercel)를 연다.
//   웹 주소에서도 USB 웹캠(window.TookUvc, /__uvc/frame)·카메라 권한은 그 주소에만 준다. 첫 화면을 못 열면(인터넷 끊김) 앱 안 화면으로 연다
// - 콘솔 로그는 logcat 태그 "took" 로 남는다 (adb logcat -s took). chrome://inspect 로 원격 디버깅도 된다.

import android.Manifest;
import android.annotation.TargetApi;
import android.app.Activity;
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

public class MainActivity extends Activity {
    static final String TAG = "took";
    static final String HOST = "appassets.androidplatform.net";
    static final String LOCAL_URL = "https://" + HOST + "/index.html";
    String startUrl = LOCAL_URL; // 2번 '툭 웹' 이면 assets/start-url.txt 의 웹 주소
    String webHost = null;       // 2번이면 그 주소의 호스트 (took-sieunkirns-projects.vercel.app)
    boolean fellBack;            // 웹 주소를 못 열어 앱 안 화면으로 바꿨다
    static final int REQ_MEDIA = 7;

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

        readStartUrl();
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        setContentView(root);
        uvc = new UvcCamera(this, new UvcCamera.Listener() {
            @Override public void onUsbEvent(String type) { Log.i(TAG, "usb " + type); }
        });
        createWebView();
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl(startUrl);
        hideSystemBars();
    }

    // 2번 '툭 웹': 빌드할 때 넣은 assets/start-url.txt 가 있으면 그 주소로 시작한다
    void readStartUrl() {
        try {
            InputStream in = getAssets().open("start-url.txt");
            byte[] b = new byte[2048];
            int n = in.read(b);
            in.close();
            String u = n > 0 ? new String(b, 0, n, "UTF-8").trim() : "";
            Uri uri = Uri.parse(u);
            if ("https".equals(uri.getScheme()) && uri.getHost() != null) { startUrl = u; webHost = uri.getHost(); }
            Log.i(TAG, "start url: " + startUrl);
        } catch (IOException ignored) { /* 1번 '툭': 앱 안 화면 */ }
    }

    boolean ourHost(String host) {
        return HOST.equals(host) || (webHost != null && webHost.equals(host));
    }

    void createWebView() {
        WebView.setWebContentsDebuggingEnabled(true);
        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.addJavascriptInterface(uvc.bridge, "TookUvc"); // 앱 안 화면(appassets)만 쓴다

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
                // USB 웹캠 영상: 앱 안 화면이든 웹 주소든 같은 경로로 준다
                if ("/__uvc/frame".equals(u.getPath()) && ourHost(u.getHost())) {
                    Map<String, String> h = new HashMap<String, String>();
                    h.put("Access-Control-Allow-Origin", "*");
                    return serveUvcFrame(u, h);
                }
                return serveAsset(u);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                // 2번 '툭 웹': 인터넷이 끊겨 첫 화면을 못 열면 앱 안 화면으로 연다
                if (request.isForMainFrame() && webHost != null && webHost.equals(request.getUrl().getHost()) && !fellBack) {
                    fellBack = true;
                    Log.w(TAG, "web load failed (" + error.getErrorCode() + " " + error.getDescription() + "), falling back to bundled pages");
                    String path = request.getUrl().getPath();
                    view.loadUrl("https://" + HOST + (path == null || path.isEmpty() ? "/index.html" : path));
                }
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
                web.loadUrl(startUrl);
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
