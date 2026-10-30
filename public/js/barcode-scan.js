// 카메라 바코드 스캐너. 윈도우 크롬에는 브라우저 내장 BarcodeDetector 가 없어 ZXing(로컬 제공, public/vendor/zxing)을 쓴다.
// 립 제품 바코드(EAN-13/EAN-8/UPC)와 CODE-128 을 읽는다. 같은 번호가 연달아 읽히면 한 번만 알린다.

let libLoading = null;

export function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!libLoading) {
    libLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('../vendor/zxing/zxing.min.js', import.meta.url).href;
      s.onload = () => (window.ZXing ? resolve(window.ZXing) : reject(new Error('ZXing 없음')));
      s.onerror = () => reject(new Error('바코드 인식 라이브러리를 불러오지 못했습니다. (npm install 필요)'));
      document.head.append(s);
    }).catch((e) => {
      libLoading = null;
      throw e;
    });
  }
  return libLoading;
}

export function cameraErrorMessage(e) {
  switch (e?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return '카메라 권한이 거부되었어요. 주소창의 카메라 권한을 허용하거나, 아래에 바코드 번호를 입력해 주세요.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return '사용할 수 있는 카메라를 찾지 못했어요. 아래에 바코드 번호를 입력해 주세요.';
    case 'NotReadableError':
      return '카메라를 다른 화면이나 프로그램에서 쓰고 있어요. 그쪽 카메라를 끄고 다시 눌러 주세요.';
    default:
      return '카메라를 켜지 못했어요: ' + (e?.message || e);
  }
}

// 웹캠 영상은 작고 흐리고 잡음이 많아 원본 그대로는 거의 읽히지 않는다(시험: 18가지 중 1가지).
// 프레임마다 아래 변형을 하나씩 돌아가며 읽는다: 원본 / 살짝 흐림(잡음·계단 현상 제거) / 가운데 확대 / 세로로 든 바코드(90° 회전) / 더 흐림.
// crop: 가운데 비율, up: 확대 배율, smooth: 흐림(px), rotate: 회전(도)
const VARIANTS = [
  {}, { smooth: 1 }, { crop: 0.6, up: 1.6, smooth: 1 }, { rotate: 90, smooth: 1 }, { smooth: 2 }, { crop: 0.6, up: 2, smooth: 1.5 },
];
const MAX_WORK_WIDTH = 1600; // 확대해도 이 폭을 넘지 않게 해 한 번 읽는 시간을 줄인다

const work = document.createElement('canvas');
const workCtx = work.getContext('2d', { willReadFrequently: true });

// 이미지(카메라 프레임·사진)를 변형해 work 캔버스에 그린다
function drawVariant(src, { crop = 1, up = 1, smooth = 0, rotate = 0 }) {
  const sw = src.width * crop, sh = src.height * crop;
  const sx = (src.width - sw) / 2, sy = (src.height - sh) / 2;
  const k = Math.min(up, MAX_WORK_WIDTH / Math.max(sw, sh));
  const turned = rotate % 180 !== 0;
  work.width = Math.round((turned ? sh : sw) * k);
  work.height = Math.round((turned ? sw : sh) * k);
  workCtx.save();
  workCtx.filter = smooth ? `blur(${smooth}px)` : 'none';
  workCtx.translate(work.width / 2, work.height / 2);
  if (rotate) workCtx.rotate((rotate * Math.PI) / 180);
  workCtx.drawImage(src, sx, sy, sw, sh, (-sw * k) / 2, (-sh * k) / 2, sw * k, sh * k);
  workCtx.restore();
  return work;
}

function makeReader(ZXing) {
  const hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
    ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.CODE_128,
  ]);
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  const reader = new ZXing.MultiFormatReader();
  reader.setHints(hints);
  return reader;
}

/**
 * 사진 파일에서 바코드를 읽는다 (휴대폰 기본 카메라로 찍은 사진 등). 사진은 크고 선명하므로 모든 변형을 차례로 시도한다.
 * 가운데를 크게 잘라 보는 변형을 먼저 해, 사진 속 작은 바코드도 읽히게 한다.
 * @returns {Promise<string|null>}
 */
export async function decodeImageFile(file) {
  const ZXing = await loadZXing();
  const reader = makeReader(ZXing);
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' }); // 휴대폰 사진의 회전 정보 반영
  const tries = [{ crop: 0.5 }, { crop: 0.7 }, {}, { crop: 0.5, smooth: 1 }, { smooth: 1 }, { rotate: 90 }, { crop: 0.5, rotate: 90 }, { smooth: 2 }];
  try {
    for (const v of tries) {
      try {
        return reader.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.HTMLCanvasElementLuminanceSource(drawVariant(img, v))))).getText();
      } catch {
        // 다음 변형으로
      } finally {
        reader.reset();
      }
    }
    return null;
  } finally {
    img.close?.();
  }
}

/**
 * @param {{ video: HTMLVideoElement, onCode: (code: string) => void,
 *   onProgress?: (info: { frames: number, width: number, height: number, ms: number }) => void }} opts
 */
export function createBarcodeScanner({ video, onCode, onProgress }) {
  let stream = null;
  let timer = null;
  let running = false;
  let last = null;
  const frame = document.createElement('canvas');
  const frameCtx = frame.getContext('2d', { willReadFrequently: true });


  async function start() {
    if (running) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('이 브라우저 또는 접속 주소에서는 카메라를 쓸 수 없어요. (HTTPS 또는 localhost 필요)');
    const ZXing = await loadZXing();
    const reader = makeReader(ZXing);

    // 휴대폰은 후면 카메라, PC 는 웹캠. 바코드는 해상도가 높을수록 잘 읽힌다
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      video.srcObject = stream;
      await video.play();
    } catch (e) {
      stop(); // 권한 거부·재생 실패 시 켜진 스트림을 정리한다
      throw e;
    }
    // 자동 초점을 지원하는 카메라면 계속 초점을 맞추게 한다 (지원하지 않으면 무시)
    stream.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
    running = true;
    last = null;
    let frames = 0;
    let turn = 0;
    const startedAt = performance.now();

    // ZXing 의 연속 인식 루프는 첫 프레임 오류에서 조용히 멈추는 경우가 있어, 직접 루프를 돈다
    const tick = () => {
      if (!running) return;
      if (video.videoWidth && video.videoHeight) {
        frame.width = video.videoWidth;
        frame.height = video.videoHeight;
        frameCtx.drawImage(video, 0, 0);
        const v = VARIANTS[turn++ % VARIANTS.length];
        try {
          const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.HTMLCanvasElementLuminanceSource(drawVariant(frame, v))));
          const code = reader.decode(bitmap).getText();
          if (code !== last) {
            last = code;
            onCode(code);
          }
        } catch {
          // 이 프레임·변형으로는 읽을 수 있는 바코드가 없다
        } finally {
          reader.reset();
        }
        frames++;
        onProgress?.({ frames, width: video.videoWidth, height: video.videoHeight, ms: performance.now() - startedAt });
      }
      if (running) timer = setTimeout(tick, 80);
    };
    tick();
  }

  function stop() {
    running = false;
    last = null;
    clearTimeout(timer);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  }

  window.addEventListener('pagehide', stop);
  return { start, stop, isRunning: () => running };
}
