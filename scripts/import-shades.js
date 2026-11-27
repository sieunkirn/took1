// 호수 데이터 원본(src/data/shades.oliveyoung.json, 손으로 고치는 파일)을 화면·추천이 쓰는 형식으로 펼쳐
// src/data/products.shades.json 에 저장한다.   실행: npm run import:shades
//
// 호수 하나 = 레코드 하나. 제품 정보(브랜드·이름·가격·제형·사진·링크)는 products.oliveyoung.json 의 그 제품에서 가져오고,
// 호수 정보(번호·색 이름·바코드·색상값)는 원본에서 가져온다. 같은 제품의 호수는 line(= 제품 id)으로 묶는다.
// - color_source: 'oliveyoung_color_chip' → 올리브영 색상 칩 사진에서 뽑은 추정 색 (화면에 그렇게 표시한다)
// - color_family: 색상값으로 추정 (import-oliveyoung.js 와 같은 방법)
//
// 새 제품을 넣는 법: 원본의 products 에 { product_id, label, checked_at, skipped, shades: [...] } 를 하나 더 적고 이 스크립트를 실행한다.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hexToLab, roundLab, normalizeHex } from '../src/lib/color.js';
import { familyFinder } from './import-oliveyoung.js';
import { applyProductI18n } from './apply-product-i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE_FILE = join(root, 'src/data/shades.oliveyoung.json');
export const OUT_FILE = join(root, 'src/data/products.shades.json');

/**
 * @param {object} source 원본 (shades.oliveyoung.json)
 * @param {object[]} products 올리브영 제품 (products.oliveyoung.json)
 * @param {object[]} reference 계열 라벨이 있는 기준 색 (products.json)
 */
export function buildShades(source, products, reference) {
  const familyOf = familyFinder(reference);
  const out = [];
  const ids = new Set();
  for (const entry of source.products) {
    const p = products.find((x) => x.id === entry.product_id);
    if (!p) throw new Error(`제품 데이터에 없는 product_id: ${entry.product_id}`);
    const count = entry.shades.length;
    entry.shades.forEach((s0, i) => {
      // 올리브영 옵션 이름 끝의 '*'(올리브영 내부 표시, 손님에게 의미 없음)은 뺀다 (2026-11-24 사용자 요청)
      const s = { ...s0, name: String(s0.name ?? '').replace(/\s*\*+\s*$/, '').trim() };
      const hex = normalizeHex(s.hex);
      if (!hex) throw new Error(`${entry.product_id} ${s.no || s.name}: 색상값이 잘못됨 (${s.hex})`);
      // 한 상품 페이지에 여러 라인이 묶여 같은 번호가 두 번 나오면 뒤의 것에 -2, -3 을 붙인다
      const base = `${p.id}-${s.no || 's' + String(i + 1).padStart(2, '0')}`;
      let id = base;
      for (let k = 2; ids.has(id); k++) id = `${base}-${k}`;
      ids.add(id);
      const lab = hexToLab(hex);
      out.push({
        id,
        source: 'oliveyoung',
        line: p.id,
        shade_count: count,
        barcode: s.barcode || null,
        barcodes: [s.barcode, ...(s.barcodes_more || [])].filter(Boolean),
        brand: p.brand,
        brand_en: p.brand_en ?? null,
        name: p.name,
        name_en: p.name_en ?? null,
        type: p.type,
        shade_name: s.no ? `${s.no} ${s.name}` : s.name,
        shade_no: s.no || null,
        shade_color: s.name,
        shade_color_en: s.name_en || null,
        color_hex: hex,
        color_lab: roundLab(lab),
        color_family: familyOf(lab),
        color_family_source: 'estimated_from_color',
        color_source: source.color_source || 'oliveyoung_color_chip',
        swatch_url: s.chip ? (source.chip_base || '') + s.chip : null,
        finish: p.finish,
        finish_source: p.finish_source,
        ...(p.finish_also?.length ? { finish_also: p.finish_also } : {}), // 시연용으로 더 나오는 질감 (finish-demo.json 의 also)
        price: p.price,
        list_price: p.list_price,
        image_url: p.image_url,
        description: '',
        url: p.url,
        url_en: p.url_en ?? null,
        global_id: p.global_id ?? null,
        checked_at: entry.checked_at || null,
      });
    });
  }
  return out;
}

export function loadAndBuild() {
  const source = JSON.parse(readFileSync(SOURCE_FILE, 'utf8'));
  const products = JSON.parse(readFileSync(join(root, 'src/data/products.oliveyoung.json'), 'utf8'));
  const reference = JSON.parse(readFileSync(join(root, 'src/data/products.json'), 'utf8'));
  return applyProductI18n(buildShades(source, products, reference)); // 호수 이름 영어·중국어·일본어 (src/data/product-i18n.json)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const shades = loadAndBuild();
  writeFileSync(OUT_FILE, JSON.stringify(shades, null, 1) + '\n');
  const lines = new Set(shades.map((s) => s.line));
  console.log(`호수 ${shades.length}개 (제품 ${lines.size}개) → ${OUT_FILE}`);
}
