// 체험 모드용 일러스트(그림풍) 인물 샘플을 생성한다.
// SVG 로 그린 뒤 Playwright(Chromium)로 PNG 로 렌더링하고, 입술 좌표(추적 실패 시 대체용)를 JSON 으로 저장한다.
// 실행: node scripts/make-samples.js   (playwright 필요. 생성 결과물은 저장소에 포함되어 있어 평소에는 실행할 필요 없음)
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const W = 800, H = 600;

// 각 샘플: 피부/머리/입술/옷 색과 헤어 스타일. (원본 이미지는 컬러이지만 화면에는 흑백으로만 표시된다)
export const SAMPLES = [
  { id: 'illust-1', label: '샘플 그림 1 (단발)', skin: '#F2CDB4', shade: '#DDA88C', hair: '#3B2A22', lip: '#C9707A', shirt: '#7D8FA6', bg: '#ECE6DE', style: 'bob' },
  { id: 'illust-2', label: '샘플 그림 2 (긴 머리)', skin: '#E0AC8A', shade: '#C08566', hair: '#1F1A17', lip: '#B5525A', shirt: '#B9A27D', bg: '#E3E8EA', style: 'long' },
  { id: 'illust-3', label: '샘플 그림 3 (짧은 머리)', skin: '#A8714F', shade: '#8A563A', hair: '#15110F', lip: '#8E4A4C', shirt: '#5E6E5A', bg: '#EFE9E1', style: 'short' },
];

// 입술 형태(3차 베지어). 화면 좌표(px)
const UPPER = [[350, 395], [365, 385, 380, 375, 392, 378], [396, 379, 398, 381, 400, 382], [402, 381, 404, 379, 408, 378], [420, 375, 435, 385, 450, 395]];
const LOWER = [[450, 395], [440, 412, 422, 422, 400, 422], [378, 422, 360, 412, 350, 395]];
const SEAM = [[450, 395], [435, 398, 420, 400, 400, 400], [380, 400, 365, 398, 350, 395]];

const toPath = (segs) => `M${segs[0].join(',')} ` + segs.slice(1).map((s) => `C${s.join(',')}`).join(' ');

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

function hairBack(s) {
  if (s.style === 'long') return `<path d="M250,250 C240,120 330,70 400,70 C470,70 560,120 550,250 L575,560 L225,560 Z" fill="${s.hair}"/>`;
  if (s.style === 'bob') return `<path d="M255,260 C245,120 330,75 400,75 C470,75 555,120 545,260 L555,430 C520,445 500,440 490,430 L310,430 C300,440 280,445 245,430 Z" fill="${s.hair}"/>`;
  return '';
}

function hairFront(s) {
  if (s.style === 'short') return `<path d="M268,250 C255,140 320,92 400,92 C480,92 548,140 532,250 C520,200 500,165 470,152 C430,175 360,170 320,160 C295,180 278,210 268,250 Z" fill="${s.hair}"/>`;
  return `<path d="M268,255 C258,140 330,95 400,95 C470,95 545,140 532,255 C515,195 480,165 440,160 C420,190 360,200 330,185 C300,200 280,225 268,255 Z" fill="${s.hair}"/>`;
}

function eye(cx, s, flip) {
  const d = flip ? -1 : 1;
  return `
  <path d="M${cx - 32},272 C${cx - 18},256 ${cx + 18},256 ${cx + 32},272 C${cx + 18},284 ${cx - 18},284 ${cx - 32},272 Z" fill="#FAFAF7" stroke="#2A1E1A" stroke-width="2"/>
  <circle cx="${cx}" cy="271" r="11" fill="#5A4134"/>
  <circle cx="${cx}" cy="271" r="5.5" fill="#120C0A"/>
  <circle cx="${cx + 3 * d}" cy="267" r="2.5" fill="#FFFFFF"/>
  <path d="M${cx - 33},271 C${cx - 18},253 ${cx + 18},253 ${cx + 34},269" fill="none" stroke="#1A1210" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M${cx - 36},${236} C${cx - 15},${224} ${cx + 15},${224} ${cx + 36},${232}" fill="none" stroke="${s.hair}" stroke-width="6" stroke-linecap="round"/>`;
}

export function svgFor(s) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="skin" cx="50%" cy="42%" r="62%"><stop offset="0%" stop-color="${s.skin}"/><stop offset="85%" stop-color="${s.skin}"/><stop offset="100%" stop-color="${s.shade}"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${s.bg}"/>
  ${hairBack(s)}
  <path d="M360,430 L360,500 C330,520 230,530 170,600 L630,600 C570,530 470,520 440,500 L440,430 Z" fill="${s.skin}"/>
  <path d="M360,470 C380,490 420,490 440,470 L440,430 L360,430 Z" fill="${s.shade}" opacity="0.6"/>
  <path d="M170,600 C230,530 330,522 362,505 C380,530 420,530 438,505 C470,522 570,530 630,600 Z" fill="${s.shirt}"/>
  <ellipse cx="270" cy="295" rx="18" ry="32" fill="${s.shade}"/>
  <ellipse cx="530" cy="295" rx="18" ry="32" fill="${s.shade}"/>
  <path d="M400,120 C485,120 535,185 532,270 C530,350 500,420 455,455 C430,472 415,478 400,478 C385,478 370,472 345,455 C300,420 270,350 268,270 C265,185 315,120 400,120 Z" fill="url(#skin)"/>
  <ellipse cx="330" cy="335" rx="30" ry="16" fill="${s.lip}" opacity="0.18"/>
  <ellipse cx="470" cy="335" rx="30" ry="16" fill="${s.lip}" opacity="0.18"/>
  ${eye(345, s, false)}
  ${eye(455, s, true)}
  <path d="M396,285 C392,310 384,330 382,345 C388,352 412,352 418,345" fill="none" stroke="${s.shade}" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="389" cy="347" rx="5" ry="3" fill="${s.shade}"/>
  <ellipse cx="411" cy="347" rx="5" ry="3" fill="${s.shade}"/>
  <path d="${toPath(UPPER)} ${SEAM.slice(1).map((x) => 'C' + x.join(',')).join(' ')} Z" fill="${s.lip}"/>
  <path d="M450,395 ${LOWER.slice(1).map((x) => 'C' + x.join(',')).join(' ')} C365,398 380,400 400,400 C420,400 435,398 450,395 Z" fill="${s.lip}"/>
  <path d="M385,408 C395,412 410,412 418,408" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.35"/>
  <path d="${toPath(SEAM)}" fill="none" stroke="#5A2A2C" stroke-width="2.5" stroke-linecap="round"/>
  ${hairFront(s)}
</svg>`;
}

if (process.argv[1]?.endsWith('make-samples.js')) {
  const require = createRequire(import.meta.url);
  const { chromium } = require('playwright');
  const outDir = new URL('../public/samples/', import.meta.url);
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const manifest = [];
  for (const s of SAMPLES) {
    await page.setContent(`<html><body style="margin:0">${svgFor(s)}</body></html>`);
    await page.locator('svg').screenshot({ path: new URL(`${s.id}.png`, outDir).pathname });
    manifest.push({ id: s.id, label: s.label, src: `samples/${s.id}.png`, width: W, height: H, lips: lipsGeometry() });
  }
  await browser.close();
  writeFileSync(new URL('samples.json', outDir), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`샘플 ${manifest.length}개 생성: public/samples/`);
}
