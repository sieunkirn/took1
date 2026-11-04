// 아바타 테스트용 캐릭터 그림을 생성한다 (큰 머리·작은 눈·볼터치의 귀여운 그림체).
// SVG 파일로 저장하고, 입술 좌표(색을 입힐 자리)를 JSON 으로 함께 저장한다.
// 실행: node scripts/make-samples.js   (생성 결과물은 저장소에 포함되어 있어 평소에는 실행할 필요 없음)
import { writeFileSync, mkdirSync } from 'node:fs';

const W = 800, H = 600;

// 각 샘플: 피부/볼터치/머리/입술/옷/배경 색과 헤어 스타일
export const SAMPLES = [
  { id: 'avatar-1', label: '아바타 1 (단발 앞머리)', skin: '#FFE3D3', shade: '#F4C4AE', blush: '#FF9DB0', hair: '#5B3A2E', lip: '#E07A8A', shirt: '#BFD8F2', bg: '#FDEFF2', style: 'bob' },
  { id: 'avatar-2', label: '아바타 2 (양쪽 똥머리)', skin: '#F6D2B8', shade: '#E2AE90', blush: '#FF8FA3', hair: '#2E2321', lip: '#D35F72', shirt: '#F7D9A8', bg: '#EEF4FB', style: 'buns' },
  { id: 'avatar-3', label: '아바타 3 (긴 생머리)', skin: '#D9A27E', shade: '#BE8460', blush: '#F07F8F', hair: '#3A2418', lip: '#B9505F', shirt: '#C9E4C5', bg: '#F6F1E8', style: 'long' },
];

// 입술 형태(3차 베지어, 화면 좌표 px). 원래 모양을 입 자리(MOUTH)로 옮기고 작게 줄여 귀여운 비율로 쓴다
const MOUTH = { x: 400, y: 392, k: 0.62 };
const fit = (seg) => seg.map((v, i) => +(i % 2 ? MOUTH.y + (v - 398) * MOUTH.k : MOUTH.x + (v - 400) * MOUTH.k).toFixed(2));
const UPPER = [[350, 395], [365, 385, 380, 375, 392, 378], [396, 379, 398, 381, 400, 382], [402, 381, 404, 379, 408, 378], [420, 375, 435, 385, 450, 395]].map(fit);
const LOWER = [[450, 395], [440, 412, 422, 422, 400, 422], [378, 422, 360, 412, 350, 395]].map(fit);
const SEAM = [[450, 395], [435, 398, 420, 400, 400, 400], [380, 400, 365, 398, 350, 395]].map(fit);

const toPath = (segs) => `M${segs[0].join(',')} ` + segs.slice(1).map((s) => `C${s.join(',')}`).join(' ');
const curves = (segs) => segs.slice(1).map((x) => 'C' + x.join(',')).join(' ');
// 같은 곡선을 반대 방향으로 (끝점에서 시작점으로)
function reverse(segs) {
  const pts = [segs[0], ...segs.slice(1).map((c) => c.slice(4))];
  const out = [pts[pts.length - 1]];
  for (let i = segs.length - 1; i >= 1; i--) {
    const c = segs[i];
    out.push([c[2], c[3], c[0], c[1], ...pts[i - 1]]);
  }
  return out;
}

function sample(segs, n = 6) {
  const pts = [];
  let [x0, y0] = segs[0];
  for (const [x1, y1, x2, y2, x3, y3] of segs.slice(1)) {
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      pts.push({
        x: +((u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3) / W).toFixed(4),
        y: +((u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3) / H).toFixed(4),
      });
    }
    [x0, y0] = [x3, y3];
  }
  return pts;
}

export function lipsGeometry() {
  const start = { x: UPPER[0][0] / W, y: UPPER[0][1] / H };
  const outer = [start, ...sample(UPPER), ...sample(LOWER)].slice(0, -1);
  const seamTop = sample(SEAM).map((p) => ({ x: p.x, y: +(p.y - 1 / H).toFixed(4) }));
  const inner = [{ x: start.x, y: start.y }, ...seamTop.slice(0, -1)];
  return { outer, inner };
}

// 머리 뒤쪽(얼굴 뒤에 깔리는 부분)
function hairBack(s) {
  if (s.style === 'long') return `<path d="M215,300 C200,130 300,70 400,70 C500,70 600,130 585,300 L610,560 C560,590 480,585 455,560 L345,560 C320,585 240,590 190,560 Z" fill="${s.hair}"/>`;
  if (s.style === 'buns') return `
  <circle cx="250" cy="120" r="62" fill="${s.hair}"/><circle cx="550" cy="120" r="62" fill="${s.hair}"/>
  <path d="M232,104 C245,90 262,88 276,96" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity="0.25"/>
  <path d="M532,104 C545,90 562,88 576,96" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity="0.25"/>
  <path d="M222,290 C212,140 300,82 400,82 C500,82 588,140 578,290 L572,360 C540,370 520,360 510,340 L290,340 C280,360 260,370 228,360 Z" fill="${s.hair}"/>`;
  return `<path d="M218,300 C205,135 300,78 400,78 C500,78 595,135 582,300 L590,440 C555,462 520,456 505,438 L295,438 C280,456 245,462 210,440 Z" fill="${s.hair}"/>`;
}

// 앞머리
function hairFront(s) {
  if (s.style === 'long') return `<path d="M238,280 C225,150 305,96 400,96 C495,96 575,150 562,280 C548,210 505,170 455,160 C440,190 405,205 400,175 C395,205 360,190 345,160 C295,170 252,210 238,280 Z" fill="${s.hair}"/>`;
  if (s.style === 'buns') return `<path d="M238,265 C228,150 305,100 400,100 C495,100 572,150 562,265 C540,215 515,190 480,185 C470,205 445,215 430,195 C412,215 388,215 370,195 C355,215 330,205 320,185 C285,190 260,215 238,265 Z" fill="${s.hair}"/>`;
  // 단발: 일자 앞머리
  return `<path d="M236,285 C222,150 305,98 400,98 C495,98 578,150 564,285 C560,250 548,222 530,212 L270,212 C252,222 240,250 236,285 Z" fill="${s.hair}"/>
  <path d="M290,150 C320,128 360,118 400,118" fill="none" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity="0.2"/>`;
}

// 차분한 눈: 작은 동그란 눈동자에 반짝이 하나, 속눈썹은 짧게 한 가닥
function eye(cx, flip) {
  const d = flip ? -1 : 1;
  return `
  <ellipse cx="${cx}" cy="304" rx="15" ry="18" fill="#2B1B17"/>
  <circle cx="${cx - 5 * d}" cy="298" r="4.5" fill="#FFFFFF" opacity="0.9"/>
  <path d="M${cx - 17 * d},296 C${cx - 21 * d},293 ${cx - 23 * d},290 ${cx - 24 * d},287" fill="none" stroke="#2B1B17" stroke-width="3" stroke-linecap="round"/>
  <path d="M${cx - 20 * d},264 C${cx - 7 * d},258 ${cx + 8 * d},258 ${cx + 20 * d},263" fill="none" stroke="#2B1B17" stroke-width="4" stroke-linecap="round" opacity="0.6"/>`;
}

export function svgFor(s) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="skin" cx="50%" cy="40%" r="62%"><stop offset="0%" stop-color="${s.skin}"/><stop offset="82%" stop-color="${s.skin}"/><stop offset="100%" stop-color="${s.shade}"/></radialGradient>
    <radialGradient id="blush" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${s.blush}" stop-opacity="0.7"/><stop offset="100%" stop-color="${s.blush}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${s.bg}"/>
  <circle cx="110" cy="110" r="46" fill="#FFFFFF" opacity="0.6"/><circle cx="690" cy="470" r="60" fill="#FFFFFF" opacity="0.6"/>
  <path d="M680,120 l6,14 14,6 -14,6 -6,14 -6,-14 -14,-6 14,-6 Z" fill="#FFFFFF"/>
  <path d="M120,430 l4,10 10,4 -10,4 -4,10 -4,-10 -10,-4 10,-4 Z" fill="#FFFFFF"/>
  ${hairBack(s)}
  <path d="M372,440 L372,490 L428,490 L428,440 Z" fill="${s.shade}"/>
  <path d="M235,600 C245,520 320,488 400,488 C480,488 555,520 565,600 Z" fill="${s.shirt}"/>
  <path d="M360,490 C375,512 425,512 440,490" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" opacity="0.7"/>
  <circle cx="232" cy="318" r="26" fill="${s.shade}"/><circle cx="568" cy="318" r="26" fill="${s.shade}"/>
  <ellipse cx="400" cy="300" rx="172" ry="160" fill="url(#skin)"/>
  <ellipse cx="305" cy="365" rx="42" ry="26" fill="url(#blush)"/>
  <ellipse cx="495" cy="365" rx="42" ry="26" fill="url(#blush)"/>
  ${eye(330, false)}
  ${eye(470, true)}
  <path d="M394,352 C397,356 403,356 406,352" fill="none" stroke="${s.shade}" stroke-width="3.5" stroke-linecap="round"/>
  <path d="${toPath(UPPER)} ${curves(SEAM)} Z" fill="${s.lip}"/>
  <path d="${toPath(LOWER)} ${curves(reverse(SEAM))} Z" fill="${s.lip}"/>
  <path d="${toPath(SEAM)}" fill="none" stroke="#8A3A44" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
  ${hairFront(s)}
</svg>`;
}

if (process.argv[1]?.endsWith('make-samples.js')) {
  const outDir = new URL('../public/samples/', import.meta.url);
  mkdirSync(outDir, { recursive: true });
  const manifest = SAMPLES.map((s) => {
    writeFileSync(new URL(`${s.id}.svg`, outDir), svgFor(s));
    return { id: s.id, label: s.label, src: `samples/${s.id}.svg`, width: W, height: H, lips: lipsGeometry() };
  });
  writeFileSync(new URL('samples.json', outDir), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`샘플 ${manifest.length}개 생성: public/samples/`);
}
