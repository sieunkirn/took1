// 툭 앱 USB 웹캠 직접 연결 — 웹 화면 쪽 (2026-11-22)
//
// 갤탭은 USB 웹캠을 Android 카메라로 등록하지 않아 getUserMedia 로는 웹캠이 안 보인다.
// 툭 앱(APK)은 USB 로 웹캠을 직접 열고(android/src/.../UvcCamera.java + android/jni/uvc.c) 이 화면에
//   window.TookUvc.status()/start(w,h,fps)/stop()  과  /__uvc/frame?after=N (다음 JPEG 한 장)
// 을 준다. 여기서는 그 JPEG 를 캔버스에 그리고 canvas.captureStream() 으로 '진짜 카메라처럼' 쓰이는 스트림을 만들어
// navigator.mediaDevices.enumerateDevices/getUserMedia 에 끼워 넣는다. 그래서 거울(lip-camera.js)·카메라 색 보정·
// 웹캠 연결 설정 화면은 코드를 바꾸지 않고 USB 웹캠을 쓴다.
//  - 목록에는 'USB 웹캠 (툭 앱 직접 연결, facing external)' 으로 나온다 → 자동 선택(외장 우선)이 이걸 고른다
//  - 고른 카메라가 없거나(자동) 이 웹캠을 고르면 USB 로 열고, 다른 카메라를 고르면 원래대로 연다
//  - Chrome(웹)에서는 window.TookUvc 가 없어서 아무것도 하지 않는다
// camera-settings.js 가 불러온다 (카메라를 쓰는 화면은 모두 camera-settings.js 를 불러온다)
import { sleep } from './dom.js';

export const UVC_ID = 'took-uvc';
export const UVC_LABEL = 'USB 웹캠 (툭 앱 직접 연결, facing external)';

const B = typeof window !== 'undefined' ? window.TookUvc : null;
const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;

export function uvcStatus() {
  if (!B) return null;
  try { return JSON.parse(B.status()); } catch (e) { return { app: true, error: String(e) }; }
}
export const uvcInApp = () => !!B;

const err = (name, message) => Object.assign(new Error(message), { name });

let users = 0;        // 지금 이 웹캠 스트림을 쓰는 곳 수
let releaseTimer = null;
const live = new Set(); // 살아 있는 { track, stop }

async function openUvc(v) {
  const num = (x, d) => Number(typeof x === 'object' && x ? (x.exact ?? x.ideal ?? x.max) : x) || d;
  const w = num(v?.width, 1280), h = num(v?.height, 960), fps = num(v?.frameRate, 30);
  clearTimeout(releaseTimer);
  B.start(w, h, fps);
  // 켜질 때까지 기다린다. USB 권한 창이 뜨면 사람이 누를 때까지 (최대 60초)
  const t0 = Date.now();
  let st = uvcStatus();
  while (!st?.streaming) {
    if (st?.state === 'error') throw err('NotReadableError', st.error || 'USB 웹캠을 열지 못했어요');
    if (st?.state === 'no-device') throw err('NotFoundError', st.error || 'USB 웹캠이 안 보여요');
    const limit = st?.state === 'need-permission' ? 60000 : 15000;
    if (Date.now() - t0 > limit) throw err(st?.state === 'need-permission' ? 'NotAllowedError' : 'NotReadableError',
      st?.state === 'need-permission' ? 'USB 권한 창에서 허용을 눌러 주세요' : 'USB 웹캠이 응답하지 않아요');
    await sleep(200);
    st = uvcStatus();
  }

  const canvas = document.createElement('canvas');
  canvas.width = st.width || 640;
  canvas.height = st.height || 480;
  const ctx = canvas.getContext('2d');
  let active = true, seq = 0, frames = 0, fpsNow = 0, fpsT = performance.now(), fpsN = 0;
  let firstOk;
  const first = new Promise((ok) => { firstOk = ok; });
  // 바로 받기 (2026-11-28): 거울(lip-camera.js)이 stream.tookFrames.take() 로 디코딩한 장을 그대로 가져간다.
  // 켜지면(direct) 캔버스에 그리기·captureStream 을 거치지 않는다 → 메인 스레드에서 큰 그림 복사가 없어진다.
  // 한 장 = { full: 원본 크기 ImageBitmap, small: 입술 찾기용 작은 ImageBitmap, seq }. 가져간 쪽이 둘 다 닫는다.
  // 가져가기 전에는 다음 장을 받지 않는다(최대 0.5초): 거울이 처리하는 속도만큼만 디코딩한다
  let direct = null; // { w, h } 거울이 켬 (작은 장 크기)
  let ready = null;  // 아직 안 가져간 장
  let wake = null;
  const dropReady = () => { if (ready) { ready.full.close?.(); ready.small?.close?.(); ready = null; } };

  (async function pumpLoop() {
    let misses = 0;
    while (active) {
      try {
        const r = await fetch(`/__uvc/frame?after=${seq}`, { cache: 'no-store' });
        if (!active) break;
        if (r.status !== 200) { misses++; if (misses > 5) await sleep(200); continue; }
        misses = 0;
        seq = Number(r.headers.get('X-Seq')) || seq + 1;
        const blob = await r.blob();
        if (direct && frames > 0) {
          const [full, small] = await Promise.all([
            createImageBitmap(blob),
            createImageBitmap(blob, { resizeWidth: direct.w, resizeHeight: direct.h, resizeQuality: 'low' }).catch(() => null),
          ]);
          if (!active) { full.close?.(); small?.close?.(); break; }
          if (canvas.width !== full.width || canvas.height !== full.height) { canvas.width = full.width; canvas.height = full.height; } // 크기만 맞춰 둔다
          dropReady(); // 거울이 못 가져간 예전 장은 버린다
          frames++;
          ready = { full, small, seq: frames };
          canvas.tookSeq = frames;
          fpsN++;
          const now = performance.now();
          if (now - fpsT >= 1000) { fpsNow = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; }
          await new Promise((ok) => { wake = ok; setTimeout(ok, 500); });
          wake = null;
          continue;
        }
        const bmp = await createImageBitmap(blob);
        if (!active) { bmp.close?.(); break; }
        if (canvas.width !== bmp.width || canvas.height !== bmp.height) { canvas.width = bmp.width; canvas.height = bmp.height; }
        ctx.drawImage(bmp, 0, 0);
        bmp.close?.();
        frames++;
        canvas.tookSeq = frames; // 거울(lip-camera.js)이 새 장이 왔는지 보는 번호
        fpsN++;
        const now = performance.now();
        if (now - fpsT >= 1000) { fpsNow = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; }
        if (frames === 1) firstOk(true);
      } catch (e) {
        // 깨진 JPEG 한 장 등: 건너뛴다
        await sleep(30);
      }
    }
  })();

  const ok = await Promise.race([first, sleep(8000).then(() => false)]);
  if (!ok) { active = false; release(); throw err('NotReadableError', 'USB 웹캠이 영상을 보내지 않아요'); }

  const stream = canvas.captureStream();
  // 거울은 이 캔버스에서 바로 그리고 입술을 찾는다 (2026-11-28): captureStream → video 를 거쳐 그리면 갤탭에서 한 장에 50ms 넘게 걸렸다.
  // video 는 그대로 재생해서 멈춤 감시·다른 화면(색 보정·웹캠 설정)은 예전처럼 쓴다
  stream.tookCanvas = canvas;
  stream.tookFrames = {
    /** 바로 받기 켜기. w×h = 입술 찾기용 작은 장 크기 */
    direct(w, h) { direct = { w, h }; },
    /** 새 장이 있으면 가져간다 (없으면 null). 가져간 장의 full·small 은 가져간 쪽이 닫는다 */
    take() {
      const f = ready;
      ready = null;
      if (f && wake) wake();
      return f;
    },
  };
  const track = stream.getVideoTracks()[0];
  const origStop = track.stop.bind(track);
  const origSettings = track.getSettings?.bind(track);
  Object.defineProperty(track, 'label', { value: UVC_LABEL, configurable: true });
  track.getSettings = () => ({ ...(origSettings ? origSettings() : {}), deviceId: UVC_ID, groupId: UVC_ID, width: canvas.width, height: canvas.height, frameRate: fpsNow || st.fps || 30 });
  track.getCapabilities = () => ({ deviceId: UVC_ID, width: { max: canvas.width }, height: { max: canvas.height } });
  track.applyConstraints = async () => {}; // 자동 노출·색 고정(카메라 색 보정)은 USB 직접 연결에서는 지원 안 함
  const entry = { track, stop: () => { if (!active) return; active = false; dropReady(); wake?.(); origStop(); release(); } };
  track.stop = entry.stop;
  live.add(entry);
  users++;
  return stream;

  function release() {
    if (live.has(entry)) { live.delete(entry); users = Math.max(0, users - 1); }
    // 화면을 옮길 때 바로 다시 여는 경우가 많아 조금 기다렸다 끈다.
    // 화면(문서)이 아예 바뀌면 이 타이머는 사라져서 웹캠은 켜진 채로 남는다 (2026-11-27 사용자 요청으로 그대로 둔다: 거울에 다시 들어오면 바로 보인다)
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => { if (users === 0) B.stop(); }, 3000);
  }
}

if (B && md && !md.__tookUvc) {
  md.__tookUvc = true;
  const origEnum = md.enumerateDevices.bind(md);
  const origGum = md.getUserMedia.bind(md);

  md.enumerateDevices = async () => {
    let list = [];
    try { list = await origEnum(); } catch { list = []; }
    const st = uvcStatus();
    if (st?.device) {
      const info = { deviceId: UVC_ID, groupId: UVC_ID, kind: 'videoinput', label: UVC_LABEL };
      info.toJSON = () => ({ deviceId: UVC_ID, groupId: UVC_ID, kind: 'videoinput', label: UVC_LABEL });
      list = [...list, info];
    }
    return list;
  };

  md.getUserMedia = async (c = {}) => {
    const v = c.video;
    if (!v) return origGum(c);
    const dev = typeof v === 'object' ? v.deviceId : undefined;
    const want = typeof dev === 'object' && dev ? (dev.exact ?? dev.ideal) : dev;
    const exact = typeof dev === 'object' && dev && dev.exact !== undefined;
    if (want === UVC_ID) return openUvc(v);
    // 자동(고른 카메라 없음) 또는 고른 카메라가 지금 없으면(ideal): USB 웹캠이 꽂혀 있으면 그쪽
    if (!exact) {
      const st = uvcStatus();
      if (st?.device) {
        let present = false;
        if (want) { try { present = (await origEnum()).some((d) => d.deviceId === want); } catch { present = false; } }
        if (!want || !present) return openUvc(v);
      }
    }
    return origGum(c);
  };

  // 꽂기·뽑기 감시: 앱이 알려 주는 대신 1.5초마다 상태를 본다 (페이지가 iframe 안에 있어도 된다)
  let had = !!uvcStatus()?.device;
  setInterval(() => {
    const st = uvcStatus();
    const has = !!st?.device;
    if (has !== had) {
      had = has;
      console.info(`[took] USB 웹캠 ${has ? '꽂힘' : '빠짐'} (툭 앱 직접 연결)`);
      try { md.dispatchEvent(new Event('devicechange')); } catch { /* 무시 */ }
    }
    // 켜져 있던 스트림인데 앱 쪽이 멈췄다(빠짐·오류) → 트랙 끝남 알림 (lip-camera.js 가 연결 대기로 들어간다)
    if (live.size && st && !st.streaming && st.state !== 'opening' && st.state !== 'need-permission') {
      for (const e of [...live]) { e.stop(); e.track.dispatchEvent(new Event('ended')); }
    }
  }, 1500);
  console.info('[took] 툭 앱 USB 웹캠 직접 연결 사용 가능', uvcStatus());
}
