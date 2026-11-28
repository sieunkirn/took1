// 입술 찾기 워커 (2026-11-28 갤탭 '카메라·터치가 느림')
// 얼굴 인식(MediaPipe Face Landmarker)을 화면(메인 스레드)과 다른 스레드에서 돌린다.
// 예전에는 한 장에 37ms 남짓 메인 스레드를 붙잡아서, 그동안 손가락 끌기·스크롤·버튼이 처리되지 못했다.
//
// 일반(classic) 워커다: MediaPipe 가 wasm 로더를 importScripts 로 불러서 모듈 워커에서는 안 된다.
// 파일은 메인 쪽(lip-tracker.js)이 받아서 blob 주소로 넘긴다. 앱(WebView)에서 워커가 직접 파일을 못 받는 경우가 있어서다.
//
// 메시지
//   받기 { type: 'init', bundle, landmarks, fileset: { wasmLoaderPath, wasmBinaryPath }, model: ArrayBuffer }
//        → 보내기 { type: 'ready', delegate: 'GPU' | 'CPU' } 또는 { type: 'error', error }
//   받기 { type: 'detect', id, frame: ImageBitmap(넘겨받음), ts }
//        → 보내기 { type: 'result', id, lips, error, ms }   (frame 은 여기서 닫는다)
let landmarker = null;
let toLips = null;

self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.type === 'init') {
    try {
      const { FaceLandmarker } = await import(m.bundle);
      ({ toLips } = await import(m.landmarks));
      const create = (delegate) => FaceLandmarker.createFromOptions(m.fileset, {
        baseOptions: { modelAssetBuffer: new Uint8Array(m.model), delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      let delegate = 'GPU';
      try {
        landmarker = await create('GPU');
      } catch (err) {
        delegate = 'CPU';
        landmarker = await create('CPU');
      }
      self.postMessage({ type: 'ready', delegate });
    } catch (err) {
      self.postMessage({ type: 'error', error: String((err && err.message) || err) });
    }
    return;
  }
  if (m.type === 'detect') {
    const t0 = performance.now();
    let lips = null;
    let error = null;
    try {
      lips = toLips(landmarker.detectForVideo(m.frame, m.ts));
    } catch (err) {
      error = String((err && err.message) || err);
    }
    try { m.frame.close(); } catch (_) { /* 이미 닫힘 */ }
    self.postMessage({ type: 'result', id: m.id, lips, error, ms: performance.now() - t0 });
    return;
  }
  if (m.type === 'close') {
    try { if (landmarker) landmarker.close(); } catch (_) { /* 이미 망가짐 */ }
    landmarker = null;
  }
};
