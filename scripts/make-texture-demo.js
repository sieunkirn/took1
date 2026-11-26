// ※ 2026-11-26부터 안 씀: 거울·서버·정적 빌드가 이 결과(products.texture-demo.json)를 읽지 않는다 (사진 없는 가짜 제품이라 사용자 요청으로 뺐다).
//   새틴·시어·쉬머는 실제 제품에 시연용 질감을 배정한다(src/data/finish-demo.json). 다시 쓰려면 node scripts/make-texture-demo.js 후 repository.js·build-static.js 에 연결
// 질감별 시연용 제품 만들기 (2026-11-26부터 새틴만. 2026-11-24 사용자 요청 "색깔·재질 조합별로 다 다른 제품이 나오면 좋겠어, 가짜여도").
// 실데이터(올리브영)에는 새틴 1개·시어 7개·쉬머 0개뿐이라, 거울 다이얼 28색 × 질감마다 다른 추천이 나오도록 가상 제품을 만든다.
// 실행: npm run make:texture-demo → src/data/products.texture-demo.json { products, shades }
//
// 데이터 원칙(CLAUDE.md): 실제 제품이 아니다. source: 'demo' 라 화면에 '시연용' 배지가 붙고, '실데이터만 보기'를 켜면 빠진다.
// 브랜드·이름은 지어낸 것(실제 브랜드 아님), 바코드는 없다(null), 사진 없음.
// 질감마다 다이얼 한 칸에 제품 하나(호수 3개: 연하게·기본·진하게) → 어느 색을 골라도 그 색 주변의 다른 제품들이 나온다.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hexToLab, roundLab } from '../src/lib/color.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TEXTURE_DEMO_FILE = join(root, 'src/data/products.texture-demo.json');

// 거울 다이얼(public/js/palette.js FAMILIES)과 같은 28색
const FAMILIES = [
  { key: 'red', ko: '레드', en: 'Red', stops: ['#EB8283', '#E47270', '#E65157', '#DA3B52', '#BA2D3E', '#A52837', '#8A2D37'] },
  { key: 'pink', ko: '핑크', en: 'Pink', stops: ['#EBA1B4', '#DFA3A7', '#E77492', '#D56287', '#CA3D71', '#AA3D55', '#95314B'] },
  { key: 'orange', ko: '코랄', en: 'Coral', stops: ['#EBA798', '#E2825C', '#E07667', '#E56A3B', '#D94D3A', '#B8483F', '#9A4F38'] },
  { key: 'nude', ko: '누드', en: 'Nude', stops: ['#E9B1AE', '#DA9E95', '#DF918D', '#D6867E', '#C67867', '#B66A55', '#A0554A'] },
];

// 질감마다 지어낸 브랜드 둘(번갈아)·제품 이름·가격대. 실데이터가 적은 질감만 만든다 (매트·글로시는 실제 제품이 충분)
const TEXTURES = [
  { finish: 'satin', type: '립스틱', brands: [['데모랩', 'DemoLab'], ['샘플리', 'Samplee']], name: ['크리미 새틴 립', 'Creamy Satin Lip'], price: 16000,
    desc: '은은한 윤기가 도는 새틴 마무리.' },
  // 시어·쉬머 가짜 제품은 2026-11-26 사용자 요청("이미지가 안 뜨면 안 된다")으로 뺐다. 대신 질감이 애매한 실제 제품을 시연용으로 배정한다(src/data/finish-demo.json)
];

const SHADES = [
  { mix: 0.14, to: 255, ko: '라이트', en: 'Light' },
  { mix: 0, to: 0, ko: '', en: '' },
  { mix: 0.14, to: 0, ko: '딥', en: 'Deep' },
];
const hex2 = (n) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
function tone(hex, { mix, to }) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return '#' + c.map((v) => hex2(v + (to - v) * mix)).join('');
}

export function makeTextureDemo() {
  const products = [];
  const shades = [];
  TEXTURES.forEach((t, ti) => {
    FAMILIES.forEach((f, fi) => f.stops.forEach((center, k) => {
      const no = fi * 7 + k + 1; // 1~28
      const [brand, brand_en] = t.brands[no % 2];
      const id = `TX-${t.finish}-${String(no).padStart(2, '0')}`;
      const name = `${t.name[0]} ${f.ko} ${k + 1}`;
      const name_en = `${t.name[1]} ${f.en} ${k + 1}`;
      const price = t.price + (no % 4) * 1000;
      const base = { source: 'demo', brand, brand_en, name, name_en, type: t.type, finish: t.finish, finish_source: 'demo', price, image_url: '', description: t.desc };
      const lab = hexToLab(center);
      products.push({ id, ...base, barcode: null, shade_name: null, color_hex: center, color_lab: roundLab(lab), color_family: f.key });
      SHADES.forEach((s, si) => {
        const hex = tone(center, s);
        const shadeNo = String(si + 1).padStart(2, '0');
        const color = [f.ko + ' ' + (k + 1), s.ko].filter(Boolean).join(' ');
        const colorEn = [f.en + ' ' + (k + 1), s.en].filter(Boolean).join(' ');
        shades.push({
          id: `${id}-${shadeNo}`, ...base, line: id, shade_count: SHADES.length, barcode: null, barcodes: [],
          shade_name: `${shadeNo} ${color}`, shade_no: shadeNo, shade_color: color, shade_color_en: colorEn,
          color_hex: hex, color_lab: roundLab(hexToLab(hex)), color_family: f.key, color_source: 'demo',
        });
      });
    }));
  });
  return { products, shades };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const data = makeTextureDemo();
  writeFileSync(TEXTURE_DEMO_FILE, JSON.stringify(data, null, 1) + '\n');
  console.log(`시연용 질감 제품 ${data.products.length}개 · 호수 ${data.shades.length}개 → src/data/products.texture-demo.json`);
}
