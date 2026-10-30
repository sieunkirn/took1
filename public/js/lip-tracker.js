// 입술 추적: MediaPipe Face Landmarker(로컬 제공 파일)를 사용한다.
// 모듈 로드에 실패하면 null 을 반환하고, 호출 측에서 대체 동작을 결정한다.

// Face Mesh 랜드마크 중 입술 외곽/안쪽 윤곽 인덱스 (순서대로 이어지는 닫힌 다각형)
export const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
export const LIPS_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];

import { STATIC } from './common.js';

// 런타임 파일 위치 (이 모듈 기준 상대 경로라 서버/정적 배포 모두 동작)
const VENDOR = new URL('../vendor/mediapipe/', import.meta.url).href;

let landmarker = null;

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
let loading = null;
let mode = null;

export function loadTracker() {
  if (loading) return loading;
  loading = (async () => {
    const { FilesetResolver, FaceLandmarker } = await import(VENDOR + 'vision_bundle.js');
    const fileset = await FilesetResolver.forVisionTasks(VENDOR + 'wasm');
    const asset = await modelAsset();
    const create = (delegate) => FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { ...asset, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
    });
    // GPU 가 빠르지만 지원하지 않는 환경이 있어 실패하면 CPU 로 재시도한다
    landmarker = await create('GPU').catch((e) => {
      console.warn('[took] GPU 추적 실패, CPU 로 전환:', e);
      return create('CPU');
    });
    mode = 'VIDEO';
    return landmarker;
  })().catch((e) => {
    console.warn('[took] 입술 추적 모듈 로드 실패:', e);
    loading = Promise.resolve(null);
    return null;
  });
  return loading;
}

// 퍼스널 컬러 추정용 측정 지점
// 피부: 양쪽 볼(50, 280, 101, 330)과 이마 중앙(151) / 눈썹(모발색 대용): 105, 66, 334, 296
// 눈: 홍채 중심(468, 473)과 홍채 테두리(469, 474), 눈꼬리(33·133, 263·362). 흰자는 홍채와 눈꼬리 사이에서 잰다
export const SKIN_POINTS = [50, 280, 101, 330, 151];
const BROW_POINTS = [105, 66, 334, 296];
const EYE_CORNERS = [[33, 133], [263, 362]];
const IRISES = [[468, 469], [473, 474]];

const pt = (p) => ({ x: p.x, y: p.y });

function toneSamplePoints(face) {
  const tone = { skin: SKIN_POINTS.map((i) => pt(face[i])), brow: BROW_POINTS.map((i) => pt(face[i])), eyes: [] };
  if (face.length < 478) return tone; // 홍채 점이 없는 모델이면 흰자 보정 없이 측정
  for (const [center, edge] of IRISES) {
    const c = face[center];
    // 이 홍채와 가까운 쪽 눈의 눈꼬리 두 점
    const corners = EYE_CORNERS.map((pair) => pair.map((i) => face[i]))
      .sort((a, b) => Math.hypot(a[0].x - c.x, a[0].y - c.y) - Math.hypot(b[0].x - c.x, b[0].y - c.y))[0];
    tone.eyes.push({ iris: pt(c), irisEdge: pt(face[edge]), corners: corners.map(pt) });
  }
  return tone;
}

function toLips(result) {
  const face = result?.faceLandmarks?.[0];
  if (!face) return null;
  return {
    outer: LIPS_OUTER.map((i) => ({ x: face[i].x, y: face[i].y })),
    inner: LIPS_INNER.map((i) => ({ x: face[i].x, y: face[i].y })),
    tone: toneSamplePoints(face),
  };
}

// 반환 좌표는 원본 프레임 기준 0~1 정규화 좌표
export async function detectVideo(video, ts) {
  if (!landmarker) return null;
  if (mode !== 'VIDEO') { await landmarker.setOptions({ runningMode: 'VIDEO' }); mode = 'VIDEO'; }
  return toLips(landmarker.detectForVideo(video, ts));
}

export async function detectImage(image) {
  if (!landmarker) return null;
  if (mode !== 'IMAGE') { await landmarker.setOptions({ runningMode: 'IMAGE' }); mode = 'IMAGE'; }
  return toLips(landmarker.detect(image));
}

// 추적 모듈이 없을 때 사용하는 고정 입술 영역(화면 중앙 하단 타원). 실제 추적이 아님.
export function fixedLips() {
  const ellipse = (cx, cy, rx, ry, n = 20) =>
    Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2;
      return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
    });
  return { outer: ellipse(0.5, 0.72, 0.13, 0.06), inner: ellipse(0.5, 0.72, 0.1, 0.012) };
}
