// 가상 립 컬러 합성 엔진: 입술 윤곽 경로, 텍스처별 색 합성, 프레임 간 평활.
// 립 컬러 매핑 카메라(lip.js)가 쓰고, 팔레트는 프리셋 색(PRESETS)을 물감으로 쓴다.
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

// 프리셋 색상 (가상 체험용 예시 색상이며 등록 제품이 아님)
export const PRESETS = ['#D2321E', '#C8323F', '#A0202C', '#7A2635', '#D05A9C', '#B8457A', '#B83A4B', '#8E2E22', '#A85A5E', '#E06090',
  '#CC88A8', '#C08A94', '#E0A0A8', '#E07070', '#D06A80', '#E05050', '#D06A5A', '#D89A78', '#702050', '#8E3070', '#94607A', '#A04060'];

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

function rgbToLabFast(r, g, b, out) {
  const R = SRGB_TO_LINEAR[r], G = SRGB_TO_LINEAR[g], B = SRGB_TO_LINEAR[b];
  const fx = labF((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const fy = labF(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const fz = labF((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  out[0] = 116 * fy - 16; out[1] = 500 * (fx - fy); out[2] = 200 * (fy - fz);
  return out;
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
export function applyLipColor(ctx, lips, w, h, mirror, look) {
  const tex = TEXTURES[look.texture] || TEXTURES.matte;
  const xs = lips.outer.map((p) => (mirror ? 1 - p.x : p.x) * w), ys = lips.outer.map((p) => p.y * h);
  const mouthW = Math.max(...xs) - Math.min(...xs);
  const feather = Math.max(1, mouthW / 60);
  const pad = Math.ceil(feather * 3 + mouthW * 0.1); // 바깥 여백은 조명 추정용 피부 샘플
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - pad), x1 = Math.min(w, Math.ceil(Math.max(...xs)) + pad);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - pad), y1 = Math.min(h, Math.ceil(Math.max(...ys)) + pad);
  const bw = x1 - x0, bh = y1 - y0;
  if (bw < 2 || bh < 2) return;

  maskCanvas.width = bw; maskCanvas.height = bh;
  maskCtx.save();
  if (supportsCanvasFilter) maskCtx.filter = `blur(${feather}px)`;
  maskCtx.translate(-x0, -y0);
  maskCtx.fillStyle = '#000';
  maskCtx.fill(lipsPath(lips, w, h, mirror), 'evenodd');
  maskCtx.restore();
  const mask = maskCtx.getImageData(0, 0, bw, bh).data;
  const img = ctx.getImageData(x0, y0, bw, bh);
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
  return { outer: mix(prev.outer, next.outer), inner: mix(prev.inner, next.inner), tone: next.tone };
}

// ---------- 어울리는 컬러 추정 (규칙 기반 참고용, 진단 아님) ----------
// 1) 조명 보정: 눈 흰자를 기준 흰색으로 삼아 카메라의 색 틀어짐·노출을 되돌린다 (von Kries 방식, 선형 RGB 채널별 이득)
// 2) 보정한 피부색(Lab)의 색상각으로 웜/쿨, 피부 밝기와 피부-눈썹 명도 대비로 밝은/깊은 톤을 나눠 4계절 톤으로 분류
// 3) 톤별 대표 립 컬러(Lab 색상각·명도·채도)에 가까운 프리셋을 고른다
// 기준값은 일반적인 퍼스널 컬러 분류를 단순화한 근사값이다. 실제 카메라 측정값을 보고 조정할 수 있도록 결과에 측정값을 함께 돌려준다.
export const SEASONS = {
  spring: { label: '봄 웜', desc: '밝고 따뜻한 톤', lip: { h: 40, L: 58, C: 55 } },
  summer: { label: '여름 쿨', desc: '밝고 부드러운 쿨 톤', lip: { h: -8, L: 58, C: 35 } },
  autumn: { label: '가을 웜', desc: '깊고 따뜻한 톤', lip: { h: 38, L: 40, C: 40 } },
  winter: { label: '겨울 쿨', desc: '깊고 선명한 쿨 톤', lip: { h: -5, L: 38, C: 50 } },
};
export const TONE_THRESHOLDS = {
  warmHue: 56, // 보정한 피부 Lab 색상각(°)이 이 값 이상이면 웜(노란 기), 미만이면 쿨(붉은 기)
  lightL: 63, // 보정한 피부 L* 기준 (높을수록 밝은 톤)
  contrast: 30, // 피부 L* − 눈썹 L* 기준 (클수록 깊고 선명한 톤)
};
const REF_SCLERA = [230, 222, 212]; // 눈 흰자의 기준색(약간 따뜻한 흰색, 근사값)

const toneCanvas = document.createElement('canvas');
const toneCtx = toneCanvas.getContext('2d', { willReadFrequently: true });

// 원 안의 픽셀을 밝기순으로 정렬해 [from, to) 구간 평균 RGB 를 구한다 (흰자는 밝은 쪽, 눈썹은 어두운 쪽, 피부는 가운데)
function patchColor(cx, cy, r, from, to) {
  r = Math.max(1, Math.round(r));
  const x0 = Math.round(cx) - r, y0 = Math.round(cy) - r;
  if (x0 < 0 || y0 < 0 || x0 + 2 * r >= toneCanvas.width || y0 + 2 * r >= toneCanvas.height) return null;
  const d = toneCtx.getImageData(x0, y0, 2 * r + 1, 2 * r + 1).data;
  const px = [];
  for (let y = -r, i = 0; y <= r; y++) {
    for (let x = -r; x <= r; x++, i += 4) {
      if (x * x + y * y <= r * r) px.push([d[i], d[i + 1], d[i + 2], 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]]);
    }
  }
  px.sort((a, b) => a[3] - b[3]);
  const sel = px.slice(Math.floor(px.length * from), Math.max(Math.floor(px.length * from) + 1, Math.floor(px.length * to)));
  return [0, 1, 2].map((k) => sel.reduce((s, p) => s + p[k], 0) / sel.length);
}

const meanRgb = (list) => {
  const ok = list.filter(Boolean);
  return ok.length ? [0, 1, 2].map((k) => ok.reduce((s, c) => s + c[k], 0) / ok.length) : null;
};

// 한 프레임(원본, 좌우 반전 전)에서 피부·눈 흰자·눈썹 색(sRGB 평균)을 잰다. tone 은 lip-tracker 의 측정 지점
export function measureTone(src, w, h, tone) {
  if (!tone?.skin?.length || !w || !h) return null;
  if (toneCanvas.width !== w || toneCanvas.height !== h) { toneCanvas.width = w; toneCanvas.height = h; }
  toneCtx.drawImage(src, 0, 0, w, h);
  const P = (p) => [p.x * w, p.y * h];
  let irisR = w * 0.012;
  const sclera = [];
  for (const eye of tone.eyes || []) {
    const [ix, iy] = P(eye.iris);
    const [ex, ey] = P(eye.irisEdge);
    irisR = Math.max(1.5, Math.hypot(ex - ix, ey - iy));
    for (const corner of eye.corners) {
      const [cx, cy] = P(corner);
      const D = Math.hypot(cx - ix, cy - iy);
      if (D < irisR * 1.5) continue; // 눈을 감았거나 너무 작음
      const t = Math.min(0.75, (irisR * 1.7) / D); // 홍채 바깥, 눈꼬리 안쪽
      sclera.push(patchColor(ix + (cx - ix) * t, iy + (cy - iy) * t, irisR * 0.35, 0.6, 1));
    }
  }
  return {
    skin: meanRgb(tone.skin.map((p) => patchColor(...P(p), Math.max(2, w * 0.012), 0.2, 0.8))),
    sclera: meanRgb(sclera),
    brow: meanRgb((tone.brow || []).map((p) => patchColor(...P(p), irisR * 0.5, 0, 0.4))),
  };
}

function linearToLab(R, G, B) {
  const fx = labF((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const fy = labF(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const fz = labF((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
const toLinear = (v) => SRGB_TO_LINEAR[Math.max(0, Math.min(255, Math.round(v)))];

// 여러 프레임 측정값(중앙값)으로 톤을 추정한다
export function classifyTone(measurements) {
  const median = (key) => {
    const list = measurements.map((m) => m?.[key]).filter(Boolean);
    if (!list.length) return null;
    return [0, 1, 2].map((k) => list.map((c) => c[k]).sort((a, b) => a - b)[Math.floor(list.length / 2)]);
  };
  const skin = median('skin'), sclera = median('sclera'), brow = median('brow');
  if (!skin) return null;

  // 흰자가 피부보다 밝고(눈을 감았거나 그림자가 지면 아님), 보정한 피부색이 실제 피부색 범위에 들 때만 보정을 쓴다.
  // 강한 노란/푸른 조명에서는 흰자에도 색이 끼므로 흰자 자체의 채도로는 판단하지 않는다
  const rawSkin = linearToLab(...skin.map(toLinear));
  const rawSclera = sclera && linearToLab(...sclera.map(toLinear));
  const gain = REF_SCLERA.map((ref, k) => Math.min(8, Math.max(0.25, toLinear(ref) / Math.max(1e-4, toLinear(sclera?.[k] ?? ref)))));
  const fixWith = (g) => (c) => linearToLab(...c.map((v, k) => Math.min(1, toLinear(v) * g[k])));
  const skinLike = (c) => {
    const h = (Math.atan2(c.b, c.a) * 180) / Math.PI, C = Math.hypot(c.a, c.b);
    return h > 25 && h < 90 && C > 6 && C < 45 && c.L > 20 && c.L < 92;
  };
  const wb = !!rawSclera && rawSclera.L > rawSkin.L + 5 && skinLike(fixWith(gain)(skin));
  const fix = fixWith(wb ? gain : [1, 1, 1]);

  const s = fix(skin);
  const hue = (Math.atan2(s.b, s.a) * 180) / Math.PI;
  const browL = brow ? fix(brow).L : null;
  const contrast = browL === null ? null : s.L - browL;
  const T = TONE_THRESHOLDS;
  const warmScore = (hue - T.warmHue) / 4; // +: 웜, −: 쿨
  // +: 깊은 톤, −: 밝은 톤. 눈썹 대비는 조명에 따라 크게 흔들려 피부 밝기보다 약하게 반영한다
  const deepScore = (T.lightL - s.L) / 8 + (contrast === null ? 0 : (contrast - T.contrast) / 25);
  const pick = (warm, deep) => (warm ? (deep ? 'autumn' : 'spring') : (deep ? 'winter' : 'summer'));
  const season = pick(warmScore >= 0, deepScore >= 0);
  // 기준에 가까우면(경계) 다음 후보도 알려준다
  const runnerUp = Math.abs(warmScore) < Math.abs(deepScore)
    ? (Math.abs(warmScore) < 0.5 ? pick(warmScore < 0, deepScore >= 0) : null)
    : (Math.abs(deepScore) < 0.5 ? pick(warmScore >= 0, deepScore < 0) : null);
  return {
    season, runnerUp, ...SEASONS[season],
    metrics: { hue, L: s.L, contrast, wb, frames: measurements.length },
  };
}

// 톤의 대표 립 컬러에 가까운 순으로 프리셋을 고른다
export function matchPresets(season, count = 3) {
  const target = SEASONS[season].lip;
  const lab = [0, 0, 0];
  return PRESETS.map((hex) => {
    const { r, g, b } = hexToRgb(hex);
    rgbToLabFast(r, g, b, lab);
    const h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
    const C = Math.hypot(lab[1], lab[2]);
    const score = ((h - target.h) / 15) ** 2 + ((lab[0] - target.L) / 12) ** 2 + ((C - target.C) / 15) ** 2;
    return { hex, score };
  }).sort((x, y) => x.score - y.score).slice(0, count).map((x) => x.hex);
}
