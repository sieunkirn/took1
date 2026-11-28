// 가상 립 컬러 합성 엔진: 입술 윤곽 경로, 텍스처별 색 합성, 프레임 간 평활.
// 립 컬러 매핑 카메라(lip.js)가 쓴다.
import { hexToRgb } from '../lib/color.js';

const supportsCanvasFilter = (() => {
  const c = document.createElement('canvas').getContext('2d');
  if (!('filter' in c)) return false;
  c.filter = 'blur(1px)';
  return c.filter === 'blur(1px)';
})();

// 윤곽점을 모두 지나는 Catmull-Rom 곡선으로 입술선을 만든다 (입꼬리 같은 뾰족한 점도 잘리지 않음)
function lipsPath(lips, w, h, mirror) {
  const path = new Path2D();
  const px = (p) => [mirror ? (1 - p.x) * w : p.x * w, p.y * h];
  for (const ring of [lips.outer, lips.inner]) {
    const pts = ring.map(px);
    const n = pts.length;
    path.moveTo(...pts[0]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      path.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
        p2[0], p2[1],
      );
    }
    path.closePath();
  }
  return path;
}

// ---------- 가상 립 컬러 합성 ----------
// 텍스처별 합성 파라미터 (contrast: 원래 입술 음영 반영 정도, gloss: 하이라이트 강도, shimmer: 반짝이 비율)
export const TEXTURES = {
  matte: { label: '매트', contrast: 0.55, gloss: 0, shimmer: 0, opacity: 0.95 },
  satin: { label: '새틴', contrast: 0.8, gloss: 0.3, shimmer: 0, opacity: 0.88 },
  glossy: { label: '글로시', contrast: 1, gloss: 0.75, shimmer: 0, opacity: 0.82 },
  sheer: { label: '시어', contrast: 1, gloss: 0.35, shimmer: 0, opacity: 0.45 },
  shimmer: { label: '쉬머', contrast: 0.85, gloss: 0.35, shimmer: 1, opacity: 0.85 },
};


const maskCanvas = document.createElement('canvas');
const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });

const hash = (x, y) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// sRGB ↔ Lab (D65). 프레임마다 수만 픽셀을 변환하므로 sRGB→선형 변환은 표로 미리 계산한다
const SRGB_TO_LINEAR = Float32Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
const labF = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const labFInv = (t) => (t > 0.206893 ? t * t * t : (t - 16 / 116) / 7.787);
const toSrgb = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055);

// 선형 RGB → Lab. 결과를 out[0..2] 에 써서 돌려준다 (프레임마다 새 배열을 만들지 않게)
function linearToLabInto(R, G, B, out) {
  const fx = labF((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const fy = labF(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const fz = labF((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  out[0] = 116 * fy - 16; out[1] = 500 * (fx - fy); out[2] = 200 * (fy - fz);
  return out;
}
function rgbToLabFast(r, g, b, out) {
  return linearToLabInto(SRGB_TO_LINEAR[r], SRGB_TO_LINEAR[g], SRGB_TO_LINEAR[b], out);
}

function labToRgbFast(L, a, b, out) {
  const fy = (L + 16) / 116;
  const X = 0.95047 * labFInv(fy + a / 500), Y = labFInv(fy), Z = 1.08883 * labFInv(fy - b / 200);
  out[0] = toSrgb(3.2406 * X - 1.5372 * Y - 0.4986 * Z);
  out[1] = toSrgb(-0.9689 * X + 1.8758 * Y + 0.0415 * Z);
  out[2] = toSrgb(0.0557 * X - 0.2040 * Y + 1.0570 * Z);
  return out;
}

const INTENSITY_SCALE = 0.5; // 농도 슬라이더 100% 일 때 실제로 덮는 비율 배수
const REF_SKIN = { L: 65, a: 14, b: 18 }; // 조명 보정 기준: 고른 백색광 아래의 평균적인 피부색(근사값)

// 랜드마크 윤곽으로 입술을 채우고(가장자리만 살짝 블러), Lab 공간에서 원래 입술의 명암(L)은 살리고 색(a, b)만 바꾼다.
// 입 주변 피부색으로 조명 밝기·색온도를 추정해 선택 색에 반영한다.
// lips: 0~1 정규화 입술 좌표, look: { hex, texture, intensity(0~100) }
// read(x0, y0, bw, bh): 원본 픽셀을 ImageData 로 주는 함수 (없으면 ctx 에서 읽는다, 2026-11-28 lip-view.js)
export function applyLipColor(ctx, lips, w, h, mirror, look, read = null) {
  if (!look.hex) return; // 색 없음 = 맨입술 (거울에 처음 들어왔을 때, 2026-11-24)
  const tex = TEXTURES[look.texture] || TEXTURES.matte;
  const xs = lips.outer.map((p) => (mirror ? 1 - p.x : p.x) * w), ys = lips.outer.map((p) => p.y * h);
  const mouthW = Math.max(...xs) - Math.min(...xs);
  const feather = Math.max(1, mouthW / 60);
  const pad = Math.ceil(feather * 3 + mouthW * 0.1); // 바깥 여백은 조명 추정용 피부 샘플
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - pad), x1 = Math.min(w, Math.ceil(Math.max(...xs)) + pad);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - pad), y1 = Math.min(h, Math.ceil(Math.max(...ys)) + pad);
  const bw = x1 - x0, bh = y1 - y0;
  if (bw < 2 || bh < 2) return;

  // 마스크 캔버스는 커질 때만 크기를 바꾼다 (2026-11-28 느려짐 수정: 예전에는 프레임마다 크기를 다시 정해 캔버스를 새로 만들었다)
  if (maskCanvas.width < bw || maskCanvas.height < bh) {
    maskCanvas.width = Math.max(maskCanvas.width, bw + 32);
    maskCanvas.height = Math.max(maskCanvas.height, bh + 32);
  } else {
    maskCtx.clearRect(0, 0, bw, bh);
  }
  maskCtx.save();
  if (supportsCanvasFilter) maskCtx.filter = `blur(${feather}px)`;
  maskCtx.translate(-x0, -y0);
  maskCtx.fillStyle = '#000';
  maskCtx.fill(lipsPath(lips, w, h, mirror), 'evenodd');
  maskCtx.restore();
  const mask = maskCtx.getImageData(0, 0, bw, bh).data;
  const img = read ? read(x0, y0, bw, bh) : ctx.getImageData(x0, y0, bw, bh);
  const d = img.data;

  // 입술 내부 밝기 통계와 주변 피부(마스크 바깥) 평균색
  const lab = [0, 0, 0];
  let lipN = 0, sumL = 0, maxL = 0, skinN = 0, skinL = 0, skinA = 0, skinB = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (mask[i + 3] > 128) {
      rgbToLabFast(d[i], d[i + 1], d[i + 2], lab);
      sumL += lab[0]; lipN++; if (lab[0] > maxL) maxL = lab[0];
    } else if (!mask[i + 3]) {
      rgbToLabFast(d[i], d[i + 1], d[i + 2], lab);
      skinL += lab[0]; skinA += lab[1]; skinB += lab[2]; skinN++;
    }
  }
  if (!lipN) return;
  const meanL = sumL / lipN;
  const rangeL = Math.max(4, maxL - meanL);

  // 선택 색(+ 조명 보정)의 Lab
  const t = hexToRgb(look.hex);
  const tLab = rgbToLabFast(t.r, t.g, t.b, [0, 0, 0]);
  if (skinN > 20) {
    tLab[0] *= Math.min(1.1, Math.max(0.65, skinL / skinN / REF_SKIN.L));
    tLab[1] += Math.max(-8, Math.min(8, (skinA / skinN - REF_SKIN.a) * 0.35));
    tLab[2] += Math.max(-8, Math.min(8, (skinB / skinN - REF_SKIN.b) * 0.35));
  }
  // 농도 100% = 예전 50% 발색 (2026-11-11 '발색이 너무 강하다' → 절반으로)
  const strength = tex.opacity * (look.intensity / 100) * INTENSITY_SCALE;
  const rgb = [0, 0, 0];

  for (let y = 0, i = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++, i += 4) {
      const m = mask[i + 3] / 255;
      if (!m) continue;
      rgbToLabFast(d[i], d[i + 1], d[i + 2], lab);
      const L0 = lab[0];
      const hl = Math.max(0, (L0 - meanL) / rangeL);
      const shade = 1 + ((L0 - meanL) / Math.max(1, meanL)) * tex.contrast;
      let L = tLab[0] + (L0 - meanL) * tex.contrast + tex.gloss * 40 * hl * hl * hl;
      if (tex.shimmer && hash(x + x0, y + y0) > 0.94) L += tex.shimmer * 35 * (0.3 + hl);
      const chroma = Math.max(0, Math.min(1.2, shade)) * Math.max(0, 1 - tex.gloss * hl * hl);
      labToRgbFast(Math.min(100, Math.max(0, L)), tLab[1] * chroma, tLab[2] * chroma, rgb);
      const alpha = m * strength;
      d[i] += (Math.min(255, Math.max(0, rgb[0])) - d[i]) * alpha;
      d[i + 1] += (Math.min(255, Math.max(0, rgb[1])) - d[i + 1]) * alpha;
      d[i + 2] += (Math.min(255, Math.max(0, rgb[2])) - d[i + 2]) * alpha;
    }
  }
  ctx.putImageData(img, x0, y0);
}

// 프레임 간 랜드마크 떨림을 줄이는 평활. 움직임이 크면 평활을 끄고 바로 따라가 위치가 밀리지 않게 한다.
export function smoothLips(prev, next) {
  if (!prev || !next || prev.outer.length !== next.outer.length) return next;
  const xs = next.outer.map((p) => p.x);
  const mouthW = Math.max(1e-3, Math.max(...xs) - Math.min(...xs));
  const move = next.outer.reduce((s, p, i) => s + Math.hypot(p.x - prev.outer[i].x, p.y - prev.outer[i].y), 0) / next.outer.length;
  const k = Math.min(1, 0.4 + (move / mouthW) * 20); // 입 너비의 3% 이상 움직이면 평활 없음
  const mix = (a, b) => b.map((p, i) => ({ x: a[i].x + (p.x - a[i].x) * k, y: a[i].y + (p.y - a[i].y) * k }));
  return { outer: mix(prev.outer, next.outer), inner: mix(prev.inner, next.inner), tone: next.tone, box: next.box };
}
