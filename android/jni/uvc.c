// 툭 앱 USB 웹캠 직접 연결 — 등시(isochronous) 전송 부분 (2026-11-22)
//
// 갤탭처럼 Android 가 USB 웹캠을 카메라로 등록하지 않는 기기에서는 Chrome·WebView 의 getUserMedia 가 웹캠을 못 본다.
// 그래서 앱이 Android USB Host API 로 웹캠을 직접 열고(UvcCamera.java: 권한·설명자·UVC probe/commit),
// 영상 데이터는 여기서 받는다. USB 2.0 웹캠은 대부분 등시 전송으로 영상을 보내는데,
// Android 자바 API 에는 등시 전송이 없어서 리눅스 usbfs ioctl(USBDEVFS_SUBMITURB/REAPURB)을 직접 쓴다.
//
// 받은 패킷마다 UVC 페이로드 헤더(길이·FID·EOF·ERR)를 보고 한 장(MJPEG 이면 JPEG 한 장, YUY2 면 w*h*2 바이트)으로 모은다.
// 다 모인 최신 한 장만 보관하고, 자바(UvcCamera)가 nativeWaitFrame/nativeCopyFrame 으로 가져간다.
//
// 빌드: scripts/build-apk.js 가 NDK clang 으로 lib/<abi>/libtookuvc.so 를 만든다 (NDK 가 없으면 이 기능만 빠진다)

#include <jni.h>
#include <errno.h>
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <poll.h>
#include <sys/ioctl.h>
#include <linux/usbdevice_fs.h>
#include <android/log.h>

#define TAG "took-uvc"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, TAG, __VA_ARGS__)

#define MAX_URBS 32

typedef struct {
  int fd;
  int ep;            // 등시 IN 엔드포인트 주소 (0x81 등)
  int pktSize;       // 패킷 하나 크기 (wMaxPacketSize × 추가 전송 횟수)
  int pktsPerUrb;
  int nUrbs;
  int maxFrame;      // 한 장 최대 크기 (dwMaxVideoFrameSize)
  int expectSize;    // YUY2 면 w*h*2, MJPEG 면 0 (크기 검사 안 함)

  struct usbdevfs_urb *urbs[MAX_URBS];
  uint8_t *bufs[MAX_URBS];

  uint8_t *work;     // 모으는 중인 한 장
  int workLen;
  int lastFid;
  int workBad;       // 이 장에 오류 패킷이 섞였다

  uint8_t *latest;   // 다 모인 최신 한 장
  int latestLen;
  int64_t seq;       // 다 모인 장 번호

  volatile int running;
  int inflight;      // 보내 놓고 아직 안 돌아온 URB 수 (reap 스레드만 바꾼다)
  pthread_t thread;
  pthread_mutex_t lock;
  pthread_cond_t cond;

  // 진단용 숫자
  int64_t packets, emptyPackets, errPackets, frames, dropped, reapErrors;
  int lastErrno;
} Uvc;

static Uvc g;
static int g_init = 0;

static void ensure_init(void) {
  if (g_init) return;
  memset(&g, 0, sizeof(g));
  pthread_mutex_init(&g.lock, NULL);
  pthread_cond_init(&g.cond, NULL);
  g.fd = -1;
  g_init = 1;
}

static void finish_frame(void) {
  if (g.workLen <= 0) return;
  int ok = !g.workBad;
  if (ok && g.expectSize > 0 && g.workLen != g.expectSize) ok = 0;
  if (ok && g.expectSize == 0) {
    // MJPEG: JPEG 시작(FFD8) 확인. 끝(FFD9)이 빠진 카메라도 있어서 끝은 보지 않는다
    if (g.workLen < 4 || g.work[0] != 0xFF || g.work[1] != 0xD8) ok = 0;
  }
  if (ok) {
    pthread_mutex_lock(&g.lock);
    memcpy(g.latest, g.work, g.workLen);
    g.latestLen = g.workLen;
    g.seq++;
    g.frames++;
    pthread_cond_broadcast(&g.cond);
    pthread_mutex_unlock(&g.lock);
  } else {
    g.dropped++;
  }
  g.workLen = 0;
  g.workBad = 0;
}

static void on_payload(const uint8_t *p, int len) {
  g.packets++;
  if (len < 2) { g.emptyPackets++; return; }
  int hlen = p[0];
  if (hlen < 2 || hlen > len) { g.errPackets++; return; }
  int flags = p[1];
  int fid = flags & 0x01;
  int eof = flags & 0x02;
  int err = flags & 0x40;
  if (g.lastFid >= 0 && fid != g.lastFid) finish_frame(); // 장 번호(FID)가 바뀌었다 → 앞 장 끝
  g.lastFid = fid;
  if (err) g.workBad = 1;
  int n = len - hlen;
  if (n > 0) {
    if (g.workLen + n > g.maxFrame) { g.workBad = 1; g.workLen = 0; }
    else { memcpy(g.work + g.workLen, p + hlen, n); g.workLen += n; }
  } else {
    g.emptyPackets++;
  }
  if (eof) finish_frame();
}

static int submit(int i) {
  struct usbdevfs_urb *u = g.urbs[i];
  memset(u, 0, sizeof(*u) + sizeof(struct usbdevfs_iso_packet_desc) * g.pktsPerUrb);
  u->type = USBDEVFS_URB_TYPE_ISO;
  u->endpoint = (unsigned char)g.ep;
  u->flags = USBDEVFS_URB_ISO_ASAP;
  u->buffer = g.bufs[i];
  u->buffer_length = g.pktSize * g.pktsPerUrb;
  u->number_of_packets = g.pktsPerUrb;
  u->usercontext = (void *)(intptr_t)i;
  for (int k = 0; k < g.pktsPerUrb; k++) u->iso_frame_desc[k].length = g.pktSize;
  if (ioctl(g.fd, USBDEVFS_SUBMITURB, u) < 0) { g.lastErrno = errno; return -errno; }
  return 0;
}

// 끝난 URB 하나를 처리하고 다시 보낸다
static void handle_urb(struct usbdevfs_urb *u) {
  int i = (int)(intptr_t)u->usercontext;
  g.inflight--;
  if (u->status == 0 || u->status == -EXDEV /* 일부 패킷만 실패 */) {
    uint8_t *base = g.bufs[i];
    for (int k = 0; k < u->number_of_packets; k++) {
      struct usbdevfs_iso_packet_desc *d = &u->iso_frame_desc[k];
      if (d->status != 0) { g.errPackets++; g.workBad = 1; continue; }
      if (d->actual_length == 0) { g.emptyPackets++; continue; }
      on_payload(base + k * g.pktSize, d->actual_length);
    }
  } else if (u->status == -ENOENT || u->status == -ECONNRESET) {
    return; // 우리가 취소했다
  } else if (u->status == -ENODEV || u->status == -ESHUTDOWN) {
    LOGW("urb status device gone (%d)", u->status);
    g.running = 0;
    return;
  } else {
    g.errPackets++;
    g.lastErrno = -u->status;
  }
  if (!g.running) return;
  if (submit(i) < 0) {
    LOGW("resubmit failed errno=%d", g.lastErrno);
    if (g.lastErrno == ENODEV) g.running = 0;
  } else {
    g.inflight++;
  }
}

// 막히는 REAPURB 대신 poll(100ms) + REAPURBNDELAY: 보낸 URB 가 하나도 없을 때도 멈출 수 있다
static void *reap_loop(void *arg) {
  (void)arg;
  LOGI("reap loop start ep=0x%02x pkt=%d x%d urbs=%d", g.ep, g.pktSize, g.pktsPerUrb, g.nUrbs);
  while (g.running) {
    struct pollfd pfd = { .fd = g.fd, .events = POLLOUT | POLLWRNORM };
    int pr = poll(&pfd, 1, 100);
    if (!g.running) break;
    if (pr < 0) { if (errno == EINTR) continue; g.lastErrno = errno; usleep(2000); continue; }
    if (pfd.revents & (POLLERR | POLLHUP | POLLNVAL)) { LOGW("poll revents=0x%x (device gone?)", pfd.revents); g.running = 0; break; }
    for (;;) {
      struct usbdevfs_urb *u = NULL;
      if (ioctl(g.fd, USBDEVFS_REAPURBNDELAY, &u) < 0) {
        if (errno == EAGAIN) break;
        g.reapErrors++;
        g.lastErrno = errno;
        if (errno == ENODEV || errno == ESHUTDOWN) { LOGW("device gone (%d)", errno); g.running = 0; }
        break;
      }
      if (u) handle_urb(u);
      if (!g.running) break;
    }
    if (g.running && g.inflight <= 0) { LOGW("no urb in flight, stopping"); g.running = 0; }
  }
  // 남은 URB 취소하고 거둔다 (최대 0.5초)
  for (int i = 0; i < g.nUrbs; i++) if (g.urbs[i]) ioctl(g.fd, USBDEVFS_DISCARDURB, g.urbs[i]);
  for (int n = 0; n < 50 && g.inflight > 0; n++) {
    struct usbdevfs_urb *u = NULL;
    if (ioctl(g.fd, USBDEVFS_REAPURBNDELAY, &u) < 0) { if (errno == EAGAIN) { usleep(10000); continue; } break; }
    if (u) g.inflight--;
  }
  pthread_mutex_lock(&g.lock);
  pthread_cond_broadcast(&g.cond);
  pthread_mutex_unlock(&g.lock);
  LOGI("reap loop end frames=%lld", (long long)g.frames);
  return NULL;
}

static void free_bufs(void) {
  for (int i = 0; i < MAX_URBS; i++) { free(g.urbs[i]); g.urbs[i] = NULL; free(g.bufs[i]); g.bufs[i] = NULL; }
  free(g.work); g.work = NULL;
  pthread_mutex_lock(&g.lock);
  free(g.latest); g.latest = NULL; g.latestLen = 0;
  pthread_mutex_unlock(&g.lock);
}

static void stop_internal(void) {
  if (g.running || g.thread) {
    g.running = 0; // reap 스레드가 0.1초 안에 알아채고 URB 를 취소·정리한다
    if (g.thread) { pthread_join(g.thread, NULL); g.thread = 0; }
  }
  free_bufs();
  g.fd = -1;
}

JNIEXPORT jint JNICALL
Java_com_took_kiosk_UvcCamera_nativeStart(JNIEnv *env, jclass cls, jint fd, jint ep, jint pktSize, jint pktsPerUrb,
                                          jint nUrbs, jint maxFrame, jint expectSize) {
  (void)env; (void)cls;
  ensure_init();
  stop_internal();
  if (nUrbs > MAX_URBS) nUrbs = MAX_URBS;
  if (nUrbs < 2) nUrbs = 2;
  g.fd = fd; g.ep = ep; g.pktSize = pktSize; g.pktsPerUrb = pktsPerUrb; g.nUrbs = nUrbs;
  g.maxFrame = maxFrame > 0 ? maxFrame : 4 * 1024 * 1024;
  g.expectSize = expectSize;
  g.workLen = 0; g.lastFid = -1; g.workBad = 0; g.seq = 0;
  g.packets = g.emptyPackets = g.errPackets = g.frames = g.dropped = g.reapErrors = 0; g.lastErrno = 0;
  g.work = (uint8_t *)malloc(g.maxFrame);
  g.latest = (uint8_t *)malloc(g.maxFrame);
  if (!g.work || !g.latest) { free_bufs(); return -ENOMEM; }
  for (int i = 0; i < nUrbs; i++) {
    g.urbs[i] = (struct usbdevfs_urb *)calloc(1, sizeof(struct usbdevfs_urb) + sizeof(struct usbdevfs_iso_packet_desc) * pktsPerUrb);
    g.bufs[i] = (uint8_t *)malloc(pktSize * pktsPerUrb);
    if (!g.urbs[i] || !g.bufs[i]) { free_bufs(); return -ENOMEM; }
  }
  int submitted = 0;
  for (int i = 0; i < nUrbs; i++) {
    int r = submit(i);
    if (r < 0) { LOGW("submit %d failed errno=%d", i, -r); if (i == 0) { free_bufs(); return r; } break; }
    submitted++;
  }
  g.nUrbs = submitted;
  g.inflight = submitted;
  g.running = 1;
  if (pthread_create(&g.thread, NULL, reap_loop, NULL) != 0) { g.running = 0; g.thread = 0; stop_internal(); return -EAGAIN; }
  return submitted;
}

JNIEXPORT void JNICALL
Java_com_took_kiosk_UvcCamera_nativeStop(JNIEnv *env, jclass cls) {
  (void)env; (void)cls;
  ensure_init();
  stop_internal();
}

// afterSeq 보다 새 장이 올 때까지 최대 timeoutMs 기다린다. 새 장 번호, 시간 초과면 0, 멈췄으면 -1
JNIEXPORT jlong JNICALL
Java_com_took_kiosk_UvcCamera_nativeWaitFrame(JNIEnv *env, jclass cls, jlong afterSeq, jint timeoutMs) {
  (void)env; (void)cls;
  ensure_init();
  struct timespec ts;
  clock_gettime(CLOCK_REALTIME, &ts);
  ts.tv_sec += timeoutMs / 1000;
  ts.tv_nsec += (long)(timeoutMs % 1000) * 1000000L;
  if (ts.tv_nsec >= 1000000000L) { ts.tv_sec++; ts.tv_nsec -= 1000000000L; }
  pthread_mutex_lock(&g.lock);
  while (g.running && g.seq <= afterSeq) {
    if (pthread_cond_timedwait(&g.cond, &g.lock, &ts) == ETIMEDOUT) break;
  }
  jlong r = g.seq > afterSeq ? g.seq : (g.running ? 0 : -1);
  pthread_mutex_unlock(&g.lock);
  return r;
}

// 최신 한 장을 out 에 복사. 길이를 돌려준다 (out 이 작으면 필요한 길이의 음수)
JNIEXPORT jint JNICALL
Java_com_took_kiosk_UvcCamera_nativeCopyFrame(JNIEnv *env, jclass cls, jbyteArray out) {
  (void)cls;
  ensure_init();
  pthread_mutex_lock(&g.lock);
  int n = g.latestLen;
  jsize cap = (*env)->GetArrayLength(env, out);
  if (n > cap) { pthread_mutex_unlock(&g.lock); return -n; }
  if (n > 0) (*env)->SetByteArrayRegion(env, out, 0, n, (const jbyte *)g.latest);
  pthread_mutex_unlock(&g.lock);
  return n;
}

JNIEXPORT jstring JNICALL
Java_com_took_kiosk_UvcCamera_nativeStats(JNIEnv *env, jclass cls) {
  (void)cls;
  ensure_init();
  char s[320];
  snprintf(s, sizeof(s),
           "{\"running\":%s,\"packets\":%lld,\"empty\":%lld,\"errors\":%lld,\"frames\":%lld,\"dropped\":%lld,\"reapErrors\":%lld,\"errno\":%d,\"urbs\":%d}",
           g.running ? "true" : "false", (long long)g.packets, (long long)g.emptyPackets, (long long)g.errPackets,
           (long long)g.frames, (long long)g.dropped, (long long)g.reapErrors, g.lastErrno, g.nUrbs);
  return (*env)->NewStringUTF(env, s);
}
