// MediaPipe(입술 추적) 런타임과 모델을 public/vendor 로 복사/다운로드한다.
// 실행 시점에 외부 CDN 에 의존하지 않도록 로컬에서 제공한다.
import { copyFileSync, mkdirSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@mediapipe/tasks-vision');
const dest = join(root, 'public/vendor/mediapipe');
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

if (!existsSync(src)) {
  console.error('node_modules/@mediapipe/tasks-vision 이 없습니다. 먼저 npm install 을 실행하세요.');
  process.exit(1);
}
mkdirSync(join(dest, 'wasm'), { recursive: true });
copyFileSync(join(src, 'vision_bundle.mjs'), join(dest, 'vision_bundle.js')); // .js 로 제공 (정적 호스팅 MIME 호환)
for (const f of readdirSync(join(src, 'wasm'))) copyFileSync(join(src, 'wasm', f), join(dest, 'wasm', f));
console.log('MediaPipe 런타임 복사 완료');

// 바코드 인식(ZXing): 윈도우 크롬에는 브라우저 내장 BarcodeDetector 가 없어 라이브러리를 로컬로 제공한다
const zxing = join(root, 'node_modules/@zxing/library/umd/index.min.js');
if (existsSync(zxing)) {
  mkdirSync(join(root, 'public/vendor/zxing'), { recursive: true });
  copyFileSync(zxing, join(root, 'public/vendor/zxing/zxing.min.js'));
  console.log('ZXing 바코드 인식 라이브러리 복사 완료');
} else {
  console.error('node_modules/@zxing/library 가 없습니다. 카메라 바코드 인식 없이 번호 입력만 동작합니다.');
}

const modelPath = join(dest, 'face_landmarker.task');
if (existsSync(modelPath)) {
  console.log('모델 파일이 이미 있습니다.');
} else {
  try {
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    writeFileSync(modelPath, Buffer.from(await res.arrayBuffer()));
    console.log('얼굴 랜드마크 모델 다운로드 완료');
  } catch (e) {
    console.error('모델 다운로드 실패 (' + e.message + '). 입술 추적 없이 고정 영역 모드로 동작합니다.');
  }
}
