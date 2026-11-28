// 얼굴 랜드마크 → 입술 윤곽·톤 측정 지점·얼굴 네모 (2026-11-28 lip-tracker.js 에서 나눔)
// 메인 화면(lip-tracker.js)과 입술 찾기 워커(lip-track-worker.js) 둘 다 쓴다. 다른 파일을 불러오지 않는다 (워커에 blob 으로 넘긴다)

// Face Mesh 랜드마크 중 입술 외곽/안쪽 윤곽 인덱스 (순서대로 이어지는 닫힌 다각형)
const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
const LIPS_INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];

// 퍼스널 컬러 추정용 측정 지점
// 피부: 양쪽 볼(50, 280, 101, 330)과 이마 중앙(151) / 눈썹(모발색 대용): 105, 66, 334, 296
// 눈: 홍채 중심(468, 473)과 홍채 테두리(469, 474), 눈꼬리(33·133, 263·362). 흰자는 홍채와 눈꼬리 사이에서 잰다
const SKIN_POINTS = [50, 280, 101, 330, 151];
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

// 얼굴 전체를 감싸는 네모 (팔레트 화면의 얼굴 따라가는 프레임용)
function faceBox(face) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const p of face) {
    if (p.x < x0) x0 = p.x;
    if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

export function toLips(result) {
  const face = result?.faceLandmarks?.[0];
  if (!face) return null;
  return {
    outer: LIPS_OUTER.map((i) => pt(face[i])),
    inner: LIPS_INNER.map((i) => pt(face[i])),
    tone: toneSamplePoints(face),
    box: faceBox(face),
  };
}
