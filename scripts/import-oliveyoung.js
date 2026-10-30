// 올리브영에서 수집한 립틴트 데이터(크롤링 폴더)를 took 제품 데이터 형식으로 바꿔 src/data/products.oliveyoung.json 에 저장한다.
// 실행: npm run import:oliveyoung [크롤링 JSON 경로]   (기본: ../크롤링/oliveyoung_lip_tints.json)
//
// 데이터 원칙(CLAUDE.md): 수집하지 않은 정보는 지어내지 않는다.
// - 바코드·색상명·제품 설명: 수집되지 않아 비워 둔다 (null)
// - 대표 이미지: 크롤링 데이터의 이미지 주소(src·image_url)나 같은 폴더의 oliveyoung_image_manifest.json 에 있을 때만 넣는다 (주소를 추측하지 않는다)
// - 색상 계열: 대표 색상값과 가장 가까운 기준 색(가상 데이터의 계열 라벨)으로 추정 → color_family_source: 'estimated_from_color'
// - 제형: 상품명의 단어(벨벳·매트·블러·글로우 등)로 추정, 단서가 없으면 null → finish_source: 'product_name' | null
// - 대표 색상값이 없는 상품은 색 비교·추천에 쓸 수 없어 제외한다
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hexToLab, roundLab, normalizeHex, deltaE2000 } from '../src/lib/color.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// 상품명 → 제형 (앞에 있는 규칙이 먼저. "무스 벨벳"은 벨벳)
const FINISH_RULES = [
  ['velvet', /벨벳|velvet/i],
  ['satin', /새틴|satin/i],
  ['matte', /매트|matte|블러|blur|무스|파우더|보송|클레이|퍼지/i],
  ['glossy', /글로시|글로우|글로이|글로스|gloss|워터|젤리|글래스|글레이즈|쥬시|오일|시럽|물광|코팅|크리스탈|탕후루|유리/i],
];

export function inferFinish(name) {
  return FINISH_RULES.find(([, re]) => re.test(name))?.[0] || null;
}

// 상품명 정리: "라카 [나나PICK/…] 라카 퍼펙트 트윈 립 12 colors" → { brand: '라카', name: '퍼펙트 트윈 립', colorOptions: 12 }
export function parseName(raw) {
  const text = String(raw).replace(/\s+/g, ' ').trim();
  const brand = text.split(' ')[0];
  let rest = text.slice(brand.length);
  const count = rest.match(/(\d+)\s*(?:colors?|컬러|종)/i);
  rest = rest
    .replace(/\[[^\]]*\]/g, ' ') // [NEW/단독신상] 같은 홍보 문구
    .replace(/\([^)]*\)/g, ' ') // (+키링 증정), (단품/기획)
    .replace(/(\d+)\s*(?:colors?|컬러|종)(\s*택\s*\d+)?/gi, ' ')
    .replace(/\d+(?:\.\d+)?\s*(?:ml|g)\b/gi, ' ')
    .replace(/단품\s*\/\s*기획|기획\s*\/\s*단품|단품|기획|택\s*\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^NEW\s+/i, '');
  if (rest.startsWith(brand + ' ')) rest = rest.slice(brand.length + 1); // 홍보 문구 뒤에 브랜드가 한 번 더 나오는 경우
  return { brand, name: rest || text.slice(brand.length).trim(), colorOptions: count ? Number(count[1]) : null };
}

const goodsNoOf = (url) => String(url || '').match(/goodsNo=([A-Z0-9]+)/)?.[1] || null;

// 올리브영 이미지 서버의 https 주소만 받는다
export function cleanImageUrl(url) {
  const u = String(url || '').trim();
  return /^https:\/\/image\.oliveyoung\.co\.kr\//.test(u) ? u : null;
}

/** 이미지 목록(크롤링 폴더의 manifest) → { 상품번호: 이미지 주소 } */
export function imageMap(manifest = []) {
  const map = {};
  for (const x of manifest) {
    const goods = goodsNoOf(x.detail_url);
    const url = cleanImageUrl(x.src || x.image_url);
    if (goods && url) map[goods] = url;
  }
  return map;
}

const toWon = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * @param {object[]} rows 크롤링 JSON
 * @param {object[]} reference 계열 라벨이 있는 기준 색 (가상 제품 데이터)
 * @param {Record<string, string>} [images] 상품번호 → 대표 이미지 주소 (크롤링 데이터에 없을 때 보충)
 */
export function convert(rows, reference, images = {}) {
  const refs = reference.map((p) => ({ lab: hexToLab(p.color_hex), family: p.color_family }));
  const familyOf = (lab) => refs.reduce((best, r) => {
    const d = deltaE2000(lab, r.lab);
    return !best || d < best.d ? { d, family: r.family } : best;
  }, null).family;
  const products = [];
  const skipped = [];
  const seen = new Set();
  rows.forEach((row, i) => {
    const hex = normalizeHex(row.representative_color_hex || '');
    if (!hex) {
      skipped.push(row.product_name);
      return;
    }
    const goods = goodsNoOf(row.detail_url);
    let id = 'OY-' + (goods || String(i + 1).padStart(3, '0'));
    if (seen.has(id)) id += '-' + (i + 1);
    seen.add(id);
    const { brand, name, colorOptions } = parseName(row.product_name);
    const lab = hexToLab(hex);
    const finish = inferFinish(row.product_name);
    products.push({
      id,
      source: 'oliveyoung',
      barcode: null,
      brand,
      name,
      type: '립틴트',
      shade_name: null,
      color_options: colorOptions,
      color_hex: hex,
      color_lab: roundLab(lab),
      color_family: familyOf(lab),
      color_family_source: 'estimated_from_color',
      finish,
      finish_source: finish ? 'product_name' : null,
      price: toWon(row.sale_price_krw) ?? toWon(row.list_price_krw),
      list_price: toWon(row.list_price_krw),
      image_url: cleanImageUrl(row.image_url || row.src || row.image) || (goods && images[goods]) || '',
      description: '',
      url: row.detail_url ? String(row.detail_url).replace(/&(trackingCd|t_page|t_click|t_number)=[^&]*/g, '') : null,
      original_name: row.product_name,
    });
  });
  return { products: products.filter((p) => p.price), skipped };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const src = process.argv[2] || join(root, '..', '크롤링', 'oliveyoung_lip_tints.json');
  const rows = JSON.parse(readFileSync(src, 'utf8'));
  const reference = JSON.parse(readFileSync(join(root, 'src/data/products.json'), 'utf8'));
  const manifestFile = join(dirname(src), 'oliveyoung_image_manifest.json');
  const images = existsSync(manifestFile) ? imageMap(JSON.parse(readFileSync(manifestFile, 'utf8'))) : {};
  const { products, skipped } = convert(rows, reference, images);
  const out = join(root, 'src/data/products.oliveyoung.json');
  writeFileSync(out, JSON.stringify(products, null, 2) + '\n');
  const finishes = products.reduce((m, p) => ((m[p.finish || '정보 없음'] = (m[p.finish || '정보 없음'] || 0) + 1), m), {});
  console.log(`올리브영 상품 ${rows.length}개 → ${products.length}개 저장 (${out})`);
  console.log(`대표 색상값이 없어 제외: ${skipped.length}개`);
  console.log('제형(상품명 기준 추정):', finishes);
  console.log(`대표 이미지 주소가 있는 상품: ${products.filter((p) => p.image_url).length}개`);
}
