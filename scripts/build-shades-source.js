// 수집한 호수 원자료(src/data/shades-raw/*.json, scripts/shades-collect.browser.js 로 모은다)와
// 사람 검수 결과(src/data/shades-review.json)로 호수 원본(src/data/shades.oliveyoung.json)을 만든다.
//   npm run shades:build   → 원본을 만들고 import:shades 까지 실행
//
// 판정 규칙 (2026-11-17, 12개 제품을 눈으로 본 결과에 맞춘 기준):
//  - 옵션 사진은 세 종류다: ① 질감 칩 ② 흰 바탕 위 발색 ③ 세트·병·상자 사진
//  - 'ok'     : 세트 옵션이 아니고, (흰 바탕 ≤30%·회색 ≤50%) 이거나 (흰 바탕 ≤70%·회색 ≤15%) → 자동으로 쓴다
//  - 'bad'    : 색을 못 뽑았거나 흰 바탕 >70% 이거나 회색 >20% (병·상자·포장) → 자동으로 뺀다
//               (회색이 많아도 흰 바탕이 거의 없고 세트가 아니면 회색 호수일 수 있어 검수로, 단 뽑은 색이 거의 검정이면 뺀다)
//  - 'review' : 그 밖(대개 세트 옵션 사진) → 사람이 검수 화면에서 '넣기'를 누른 것만 쓴다
//  - 호수마다 ok 사진이 하나라도 있으면 그것(흰 바탕이 가장 적은 것)을 쓰고, 없을 때만 검수로 넘긴다
//  - 색을 쓸 수 없는 호수는 빼고 skipped 에 적는다 (2026-11-17 사용자 결정: '빼기')
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RAW_DIR = join(root, 'src/data/shades-raw');
export const REVIEW_FILE = join(root, 'src/data/shades-review.json');
const SOURCE_FILE = join(root, 'src/data/shades.oliveyoung.json');
const CHIP_BASE = 'https://image.oliveyoung.co.kr/cfimages/cf-goods/uploads/images/';

const SET_WORDS = /기획|세트|SET|\+|증정|에디션|EDITION|키링|캡|LIMITED|콜라보|COLLAB|\bX\b/i;

/** 옵션 이름 → { no, name }: '[NEW] 45 밀크 베리', '[두유][단품]41소이아몬드', '01호 애플소르베', '#레이다운(웜 베스트)' */
export function parseOptionName(alt) {
  const raw = String(alt).replace(/\*+/g, ' ').replace(/\[[^\]]*\]/g, ' ') // '*' 는 올리브영 내부 표시라 뺀다 (2026-11-24)
    .replace(/\([^)]*\)/g, ' ').replace(/\+.*$/, '').replace(/\s+/g, ' ').trim();
  const m = raw.match(/^#?\s*(?:No\.?\s*)?([A-Z]{0,3}\d{1,4})(?!\d)\s*호?\s*[.\-_]?\s*(.+)$/i);
  if (m) return { no: m[1].toUpperCase().replace(/^(\d)$/, '0$1'), name: m[2].trim() };
  return { no: null, name: raw.replace(/^#\s*/, '') };
}

export const isSetOption = (alt) => SET_WORDS.test(String(alt));
const luma = (hex) => { const n = parseInt(String(hex).slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };

/** 옵션 사진 하나 판정: 'ok' | 'review' | 'bad' */
export function classify(o) {
  if (!o.hex || o.err) return 'bad';
  if (o.white > 0.7 || o.grey > 0.2) {
    // 회색 칩(그레이·실버 색 호수)은 흰 바탕이 거의 없다 → 사람이 본다.
    // 다만 뽑은 색이 거의 검정이면 검은 병·상자 사진이다 (2026-11-17 수집에서 177개, 검정 립 호수는 사실상 없다) → 뺀다
    return o.white <= 0.05 && !isSetOption(o.alt) && luma(o.hex) >= 40 ? 'review' : 'bad';
  }
  if (!isSetOption(o.alt) && ((o.white <= 0.3 && o.grey <= 0.5) || (o.white <= 0.7 && o.grey <= 0.15))) return 'ok';
  return 'review';
}

export const reviewKey = (goodsNo, o) => `${goodsNo}:${o.opt}`;

export function loadRaw() {
  if (!existsSync(RAW_DIR)) return [];
  return readdirSync(RAW_DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(RAW_DIR, f), 'utf8')));
}

export function loadReview() {
  return existsSync(REVIEW_FILE) ? JSON.parse(readFileSync(REVIEW_FILE, 'utf8')) : {};
}

/**
 * 제품 하나의 원자료 → 호수(옵션 묶음)별 상태. 검수 화면(전체 검수 포함)과 buildProduct 가 같이 쓴다.
 * status:
 *  'manual'   사람이 넣음 (어느 옵션이든 'ok' 결정이 있으면 그 옵션 사진·색, 고친 색이 있으면 그 색)
 *  'excluded' 사람이 뺌   ('exclude' 결정이 있고 'ok' 결정은 없음)
 *  'auto'     자동 통과   (ok 판정 사진 중 흰 바탕이 가장 적은 것)
 *  'pending'  검수 대기   (review 판정 사진만 있고 아직 결정 없음) → 빠진다
 *  'bad'      자동 제외   (쓸 수 있는 사진이 없음) → 빠진다. 전체 검수에서 사람이 '넣기'로 살릴 수 있다
 */
export function inspectProduct(raw, review = {}) {
  const groups = new Map();
  // 같은 호수 = 번호와 이름이 같은 옵션들 (띄어쓰기 무시). 한 상품 페이지에 여러 제품 라인을 묶어 파는 경우
  // 같은 번호가 다른 색을 뜻하므로(예: 탕후루 틴트 라인 '03 청량쿨숭아' / '03 행복숭아') 번호만으로 합치지 않는다
  const nameKey = (s) => String(s).replace(/\s+/g, '').toLowerCase();
  for (const o of raw.options || []) {
    const p = parseOptionName(o.alt);
    const key = p.no ? `${p.no} ${nameKey(p.name)}` : p.name;
    if (!key) continue;
    (groups.get(key) || groups.set(key, []).get(key)).push({ ...o, ...p, key: reviewKey(raw.goodsNo, o), verdict: classify(o), decision: review[reviewKey(raw.goodsNo, o)] ?? null });
  }
  const byWhite = (a, b) => a.white - b.white;
  const isOk = (d) => d === 'ok' || d?.value === 'ok';
  return [...groups].map(([key, list]) => {
    const manual = list.find((o) => isOk(o.decision));
    let status, pick = null;
    if (manual) { status = 'manual'; pick = manual.decision.hex ? { ...manual, hex: manual.decision.hex.toUpperCase() } : manual; }
    else if (list.some((o) => o.decision === 'exclude')) status = 'excluded';
    // 'hold' = 사람이 다시 보려고 검수 대기로 돌려 놓음 (2026-11-20, 튀는 색 모음). 넣기·빼기를 누르면 풀린다
    else if (list.some((o) => o.decision === 'hold')) status = 'pending';
    else if ((pick = list.filter((o) => o.verdict === 'ok').sort(byWhite)[0])) status = 'auto';
    else status = list.some((o) => o.verdict === 'review') ? 'pending' : 'bad';
    const label = list[0].no ? `${list[0].no} ${list[0].name}` : key;
    return { key, no: list[0].no, name: list[0].name, label, status, pick, options: list };
  });
}

/**
 * 제품 하나의 원자료 → { shades, skipped, pending }
 *  pending: 사람이 아직 보지 않은 검수 대상 (그 호수는 결정 전까지 빠진다)
 */
export function buildProduct(raw, review = {}) {
  const shades = [], skipped = [], pending = [];
  for (const g of inspectProduct(raw, review)) {
    const { key, label, status, options: list } = g;
    const pick = g.pick;
    if (status === 'pending') {
      const held = list.some((o) => o.decision === 'hold');
      pending.push(...list.filter((o) => held || o.verdict === 'review').sort((a, b) => a.white - b.white)
        .map((o) => ({ key: o.key, goodsNo: raw.goodsNo, shade: key, alt: o.alt, hex: o.hex, img: o.img, white: o.white, grey: o.grey })));
    }
    if (!pick) { skipped.push(label); continue; }
    // 대표 바코드: 색을 가져온 옵션(대개 단품). 같은 호수의 다른 옵션(기획·세트) 바코드도 모은다
    const plain = list.find((o) => !isSetOption(o.alt) && !o.soldOut) || list.find((o) => !isSetOption(o.alt));
    const barcode = pick.barcode || plain?.barcode || list.find((o) => o.barcode)?.barcode || null;
    const more = [...new Set(list.map((o) => o.barcode).filter((b) => b && b !== barcode))];
    const name = (plain || pick).name;
    shades.push({ no: list[0].no, name, hex: pick.hex, barcode, ...(more.length ? { barcodes_more: more } : {}), chip: pick.img ? pick.img.replace(/^item\//, '') : null });
  }
  if (shades.every((s) => s.no)) shades.sort((a, b) => Number(a.no.replace(/\D/g, '')) - Number(b.no.replace(/\D/g, '')));
  return { shades, skipped, pending };
}

/** 모든 원자료 → 원본 파일 내용. 영어 이름은 이전 원본(손으로 넣은 것 포함)과 en 표에서 호수 번호·이름으로 이어 준다 */
export function buildSource({ raws = loadRaw(), review = loadReview(), products, previous = null, english = {} } = {}) {
  const prevEn = new Map();
  for (const p of previous?.products || []) for (const s of p.shades) if (s.name_en) prevEn.set(`${p.product_id}:${s.no || s.name}`, s.name_en);
  const out = [], pending = [];
  for (const raw of raws.sort((a, b) => a.goodsNo.localeCompare(b.goodsNo))) {
    if (raw.error) continue;
    const productId = 'OY-' + raw.goodsNo;
    const p = products.find((x) => x.id === productId);
    if (!p) continue;
    const r = buildProduct(raw, review);
    pending.push(...r.pending);
    if (!r.shades.length) continue;
    for (const s of r.shades) {
      const k = `${productId}:${s.no || s.name}`;
      s.name_en = english[k] || prevEn.get(k) || null;
    }
    out.push({ product_id: productId, label: `${p.brand} ${p.name}`, checked_at: String(raw.collected_at).slice(0, 10), skipped: r.skipped.join(', ') || null,
      shades: r.shades.map(({ no, name, name_en, hex, barcode, barcodes_more, chip }) => ({ no, name, name_en, hex, barcode, ...(barcodes_more ? { barcodes_more } : {}), chip })) });
  }
  return { products: out, pending };
}

// 사람이 고치기 쉽게 호수 하나 = 한 줄로 쓴다
export function formatSource(list) {
  const head = JSON.parse(readFileSync(SOURCE_FILE, 'utf8'));
  const lines = ['{'];
  for (const k of ['about', 'how', 'source', 'color_source', 'chip_base']) lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(head[k], null, 2).replace(/\n/g, '\n  ')},`);
  lines.push('  "products": [');
  list.forEach((p, i) => {
    lines.push('    {');
    for (const k of ['product_id', 'label', 'checked_at', 'skipped']) lines.push(`      ${JSON.stringify(k)}: ${JSON.stringify(p[k])},`);
    lines.push('      "shades": [');
    p.shades.forEach((s, j) => lines.push('        ' + JSON.stringify(s).replace(/":/g, '": ').replace(/,"/g, ', "') + (j < p.shades.length - 1 ? ',' : '')));
    lines.push('      ]');
    lines.push('    }' + (i < list.length - 1 ? ',' : ''));
  });
  lines.push('  ]', '}');
  return lines.join('\n') + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const products = JSON.parse(readFileSync(join(root, 'src/data/products.oliveyoung.json'), 'utf8'));
  const previous = JSON.parse(readFileSync(SOURCE_FILE, 'utf8'));
  const enFile = join(root, 'src/data/shades-en.json');
  const english = existsSync(enFile) ? JSON.parse(readFileSync(enFile, 'utf8')) : {};
  const { products: list, pending } = buildSource({ products, previous, english });
  writeFileSync(SOURCE_FILE, formatSource(list));
  const n = list.reduce((s, p) => s + p.shades.length, 0);
  console.log(`호수 원본: 제품 ${list.length}개, 호수 ${n}개 → ${SOURCE_FILE}`);
  console.log(`검수 대기: ${pending.length}개 (npm run shades:server 후 http://localhost:8766/review)`);
  execFileSync(process.execPath, [join(root, 'scripts/import-shades.js')], { stdio: 'inherit' });
}
