// 입술 추적: MediaPipe Face Landmarker(로컬 제공 파일)를 사용한다.
// 모듈 로드에 실패하면 null 을 반환하고, 호출 측에서 대체 동작을 결정한다.
import { STATIC } from './common.js';
import { toLips } from './lip-landmarks.js';

// 런타임 파일 위치 (이 모듈 기준 상대 경로라 서버/정적 배포 모두 동작)
const VENDOR = new URL('../vendor/mediapipe/', import.meta.url).href;

let landmarker = null;
let loading = null;

// 정적 호스팅(Artifact)은 .task 파일을 제공하지 않아, 정적 빌드는 모델을 base64 텍스트로 포함한다
async function modelAsset() {
  if (!STATIC) return { modelAssetPath: VENDOR + 'face_landmarker.task' };
  const res = await fetch(VENDOR + 'face_landmarker.task.b64.txt');
  if (!res.ok) throw new Error('모델 파일 없음 (HTTP ' + res.status + ')');
  const bin = atob((await res.text()).trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { modelAssetBuffer: bytes };
}

// ---------- 워커에서 찾기 (2026-11-28) ----------
// 얼굴 인식은 lip-track-worker.js 워커에서 돌린다: 메인 스레드는 그동안 터치·화면 그리기를 한다.
// 워커가 안 되는 환경(워커·OffscreenCanvas 없음, 준비 실패·시간 초과)이면 예전처럼 이 화면에서 찾는다.
// 워커에는 크기를 줄인 그림(짧은 변 TRACK_SIDE)을 넘긴다: 얼굴 인식 모델 입력은 256px 라 원본(960×1280)을 다 넘길 필요가 없다
export const TRACK_SIDE = 640;
const WORKER_READY_MS = 25000;
const DETECT_TIMEOUT_MS = 3000;
const FIRST_DETECT_TIMEOUT_MS = 20000; // 첫 장은 GPU 준비(셰이더 만들기)로 몇 초 걸린다
let worker = null; // { w, delegate, pending: Map, warm: 첫 결과를 받았나 }
let reqId = 0;

/** 원본 w×h → 워커에 넘길 크기 (짧은 변 TRACK_SIDE 이하) */
export function trackSize(w, h) {
  const k = Math.min(1, TRACK_SIDE / Math.max(1, Math.min(w, h)));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

async function bytesOf(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return r.arrayBuffer();
}
const blobUrl = async (url, type) => URL.createObjectURL(new Blob([await bytesOf(url)], { type }));

async function startWorker() {
  if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    throw new Error('워커·OffscreenCanvas 미지원');
  }
  const { FilesetResolver } = await import(VENDOR + 'vision_bundle.js');
  const fs = await FilesetResolver.forVisionTasks(VENDOR + 'wasm'); // SIMD 되는 기기면 SIMD 판
  const asset = await modelAsset();
  const model = asset.modelAssetBuffer ? asset.modelAssetBuffer.buffer : await bytesOf(asset.modelAssetPath);
  const js = 'text/javascript';
  const [bundle, landmarks, loader, wasm, script] = await Promise.all([
    blobUrl(VENDOR + 'vision_bundle.js', js),
    blobUrl(new URL('./lip-landmarks.js', import.meta.url).href, js),
    blobUrl(fs.wasmLoaderPath, js),
    blobUrl(fs.wasmBinaryPath, 'application/wasm'),
    blobUrl(new URL('./lip-track-worker.js', import.meta.url).href, js),
  ]);
  const w = new Worker(script);
  const pending = new Map();
  const ready = new Promise((ok, fail) => {
    const timer = setTimeout(() => fail(new Error('워커 준비 시간 초과')), WORKER_READY_MS);
    w.onerror = (e) => { clearTimeout(timer); fail(new Error(e.message || '워커 오류')); };
    w.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === 'ready') { clearTimeout(timer); ok(m.delegate); return; }
      if (m.type === 'error') { clearTimeout(timer); fail(new Error(m.error)); return; }
      if (m.type === 'result') {
        const p = pending.get(m.id);
        if (!p) return;
        pending.delete(m.id);
        clearTimeout(p.timer);
        if (m.error) p.fail(new Error(m.error)); else p.ok({ lips: m.lips, ms: m.ms });
      }
    };
  });
  w.postMessage({ type: 'init', bundle, landmarks, fileset: { wasmLoaderPath: loader, wasmBinaryPath: wasm }, model }, [model]);
  try {
    const delegate = await ready;
    return { w, delegate, pending };
  } catch (e) {
    w.terminate();
    throw e;
  }
}

// 입술 찾기가 GPU 로 도는지 CPU 로 도는지, 워커인지 (관리자 '시간 표시'에 보여 준다, 2026-11-28)
let delegate = '';
export const trackerInWorker = () => !!worker;
export const trackerDelegate = () => (worker ? `${worker.delegate}·워커` : landmarker ? delegate : '');

async function loadMain() {
  const { FilesetResolver, FaceLandmarker } = await import(VENDOR + 'vision_bundle.js');
  const fileset = await FilesetResolver.forVisionTasks(VENDOR + 'wasm');
  const asset = await modelAsset();
  const create = (d) => FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { ...asset, delegate: d },
    runningMode: 'VIDEO',
    numFaces: 1,
  });
  // GPU 가 빠르지만 지원하지 않는 환경이 있어 실패하면 CPU 로 재시도한다
  delegate = 'GPU';
  landmarker = await create('GPU').catch((e) => {
    console.warn('[took] GPU 추적 실패, CPU 로 전환:', e);
    delegate = 'CPU';
    return create('CPU');
  });
  return landmarker;
}

/** 추적기 준비. 워커 → 안 되면 이 화면. 둘 다 안 되면 null */
export function loadTracker() {
  if (loading) return loading;
  loading = (async () => {
    try {
      worker = await startWorker();
      console.info(`[took] 입술 찾기를 워커에서 돌립니다 (${worker.delegate})`);
      return worker;
    } catch (e) {
      worker = null;
      console.warn('[took] 입술 찾기 워커를 못 써서 화면에서 찾습니다:', e?.message || e);
    }
    return loadMain();
  })().catch((e) => {
    console.warn('[took] 입술 추적 모듈 로드 실패:', e);
    loading = Promise.resolve(null);
    return null;
  });
  return loading;
}

/** 추적기를 버리고 다음 loadTracker() 에서 새로 만든다 (GPU 컨텍스트가 끊겨 계속 오류가 날 때) */
export function resetTracker() {
  if (worker) {
    for (const p of worker.pending.values()) { clearTimeout(p.timer); p.fail(new Error('추적기 다시 만듦')); }
    try { worker.w.terminate(); } catch { /* 이미 끝남 */ }
    worker = null;
  }
  try { landmarker?.close(); } catch { /* 이미 망가진 상태 */ }
  landmarker = null;
  loading = null;
}

/**
 * 한 장에서 입술 찾기 → { lips, ms }. 좌표는 원본 프레임 기준 0~1.
 * src: 원본(영상·캔버스·ImageBitmap). small: 이미 줄여 둔 ImageBitmap 이 있으면 넘긴다 (이 함수가 가져가서 닫는다)
 */
export async function detectFrame(src, ts, small = null) {
  if (worker) {
    let frame = small;
    if (!frame) {
      const sw = src.videoWidth || src.width, sh = src.videoHeight || src.height;
      const t = trackSize(sw, sh);
      frame = await createImageBitmap(src, { resizeWidth: t.w, resizeHeight: t.h, resizeQuality: 'low' });
    }
    const wk = worker;
    if (!wk) { frame.close?.(); return { lips: null, ms: 0 }; }
    const id = ++reqId;
    return new Promise((ok, fail) => {
      const timer = setTimeout(() => { wk.pending.delete(id); fail(new Error('워커 응답 시간 초과')); }, wk.warm ? DETECT_TIMEOUT_MS : FIRST_DETECT_TIMEOUT_MS);
      wk.pending.set(id, { ok: (r) => { wk.warm = true; ok(r); }, fail, timer });
      wk.w.postMessage({ type: 'detect', id, frame, ts }, [frame]);
    });
  }
  small?.close?.();
  if (!landmarker) return { lips: null, ms: 0 };
  const t0 = performance.now();
  const lips = toLips(landmarker.detectForVideo(src, ts));
  return { lips, ms: performance.now() - t0 };
}

// (예전 이름) 반환 좌표는 원본 프레임 기준 0~1 정규화 좌표
export async function detectVideo(video, ts) {
  return (await detectFrame(video, ts)).lips;
}
