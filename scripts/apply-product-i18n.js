// 제품 데이터에 영어·중국어(간체)·일본어 이름을 넣는다 (2026-11-27).
// 실행: npm run import:i18n   (products.oliveyoung.json · products.shades.json · products.demo.json · products.json 을 고쳐 쓴다)
//
// 번역 사전: src/data/product-i18n.json  { brands · names · shades · descriptions : { "한국어": { en, zh, ja } } }
//  - 글자를 고치려면 사전에서 한국어 이름을 찾아 고친 뒤 npm run import:i18n
//  - 넣는 칸: brand_zh · brand_ja · name_zh · name_ja · shade_color_zh · shade_color_ja · description_en/zh/ja
//  - 영어 칸(brand_en · name_en · shade_color_en)은 비어 있을 때만 사전의 영어로 채운다.
//    글로벌 올리브영에서 가져온 진짜 영어 이름은 그대로 둔다
//  - 실제 자료와 번역을 구분한다 (CLAUDE.md 데이터 원칙): 사전에서 en_src 가 'translated' 인 영어를 쓴 칸은
//    레코드의 en_translated 목록에 적는다. 중국어·일본어 칸은 모두 번역이다 (공식 표기가 아닌 검수 전 초안)
//  - 사전에 없는 이름은 건드리지 않는다 → 화면에서는 영어, 영어도 없으면 한국어로 보인다 (i18n.js)
// 제품·호수를 다시 가져올 때(import:oliveyoung · match:global · import:shades · seed)도 이 함수가 같이 돈다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const I18N_FILE = join(root, 'src/data/product-i18n.json');

// [레코드의 칸, 사전의 묶음]
const FIELDS = [['brand', 'brands'], ['name', 'names'], ['shade_color', 'shades'], ['description', 'descriptions']];

let cached;
export function loadDict() {
  if (!cached) cached = existsSync(I18N_FILE) ? JSON.parse(readFileSync(I18N_FILE, 'utf8')) : {};
  return cached;
}

/** 제품·호수 레코드 목록에 번역 칸을 넣는다 (여러 번 돌려도 결과가 같다). missing 을 주면 사전에 없는 이름을 모은다 */
export function applyProductI18n(list, dict = loadDict(), missing = null) {
  for (const p of list) {
    const translated = [];
    for (const [f, section] of FIELDS) {
      const ko = p[f];
      if (!ko) continue;
      const tr = dict[section]?.[ko];
      if (!tr) { missing?.[section]?.add(ko); continue; }
      const enKey = f + '_en';
      if (tr.en && !p[enKey]) p[enKey] = tr.en;
      if (tr.en_src === 'translated' && p[enKey] === tr.en) translated.push(enKey);
      if (tr.zh) p[f + '_zh'] = tr.zh;
      if (tr.ja) p[f + '_ja'] = tr.ja;
    }
    if (translated.length) p.en_translated = translated;
    else delete p.en_translated;
  }
  return list;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const missing = Object.fromEntries(FIELDS.map(([, s]) => [s, new Set()]));
  for (const name of ['products.oliveyoung.json', 'products.shades.json', 'products.demo.json', 'products.json']) {
    const file = join(root, 'src/data', name);
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    const indent = (text.match(/^\[\r?\n( +)/) || [, '  '])[1].length; // 파일마다 쓰던 들여쓰기 그대로
    const list = applyProductI18n(JSON.parse(text), loadDict(), missing);
    writeFileSync(file, JSON.stringify(list, null, indent) + '\n');
    const n = (k) => list.filter((p) => p[k]).length;
    console.log(`${name}: ${list.length}개 · 제품명 영 ${n('name_en')} 중 ${n('name_zh')} 일 ${n('name_ja')} · 호수 영 ${n('shade_color_en')} 중 ${n('shade_color_zh')} 일 ${n('shade_color_ja')}`);
  }
  for (const [section, set] of Object.entries(missing)) {
    if (set.size) console.log(`사전(${section})에 없는 이름 ${set.size}개: ${[...set].slice(0, 20).join(' / ')}${set.size > 20 ? ' …' : ''}`);
  }
}
