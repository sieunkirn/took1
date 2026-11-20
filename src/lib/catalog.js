// 제품 목록 조회 (서버/브라우저 공용, 외부 의존성 없음).
// 서버는 repository.js 가 JSON 파일을 읽어 setProducts() 로 넣고, 브라우저(정적 모드)는 data/products.json 을 받아 넣는다.
let products = [];

// 실데이터 / 시연용 구분 (2026-11-20): 올리브영에서 수집한 레코드만 실데이터(source: 'oliveyoung').
// 시연용 호수(source: 'demo')와 가상 제품 27개(products.json, source 없음)는 모두 시연용이다.
// 화면의 '시연용' 배지(public/js/demo.js)와 '실데이터만 보기'가 이 함수 하나로 판단한다
export const isDemo = (p) => !!p && p.source !== 'oliveyoung';

// 실데이터만 보기: 켜져 있으면 시연용 레코드를 목록·찾기·이름 부르기에서 모두 뺀다.
// 서버는 요청마다(AsyncLocalStorage), 브라우저(정적 모드)는 기기 설정으로 정하므로 '지금 켜졌는지 묻는 함수'를 받는다
let realOnlyNow = () => false;
export function setRealOnlyGetter(fn) {
  realOnlyNow = typeof fn === 'function' ? fn : () => false;
}
const keep = (p) => !!p && !(realOnlyNow() && isDemo(p));
// 미러 화면에 보여 줄 제품 (2026-11-18 사용자 요청): 호수 데이터를 쓰는 중이면
// 호수가 하나도 없는 제품('호수 정보 준비 중'·'정보 없음')은 추천·챗봇·검색에서 뺀다.
// 호수 데이터를 아직 안 불러온 경우(가상 데이터·옛 빌드)는 모두 보여 준다. ID·바코드로 찾기는 그대로 된다
let visible = [];

export function setProducts(list) {
  products = list;
  annotateShadeCounts();
}

export function allProducts() {
  return realOnlyNow() ? visible.filter(keep) : visible;
}

/** 호수가 없어 미러 화면에서 뺀 제품 (관리·테스트용) */
export function hiddenProducts() {
  return products.filter((p) => !visible.includes(p));
}

// 시연용 호수 데이터(src/data/products.demo.json): 호수·바코드·재고가 있는 가상 제품.
// 실제 데이터(올리브영)에 그 정보가 없어 따로 둔다. 이름·바코드·ID 로는 찾지만, 추천 목록(allProducts)에는 섞지 않는다
let demoProducts = [];

export function setDemoProducts(list) {
  demoProducts = list;
  // 같은 제품(line)의 호수 수: 카드 안의 호수 고르기가 'N가지'를 보여 준다
  const count = {};
  for (const p of demoProducts) count[p.line] = (count[p.line] || 0) + 1;
  for (const p of demoProducts) if (p.line) p.shade_count = count[p.line];
}

export function allDemoProducts() {
  return realOnlyNow() ? [] : demoProducts;
}

// 실제 호수 데이터(src/data/products.shades.json, scripts/import-shades.js 로 만든다): 올리브영 제품의 호수별 레코드.
// line = 제품 id 로 묶는다. 추천(recommend.js)은 호수가 있는 제품을 기준 색과 가장 가까운 호수로 바꿔 보여 준다
let shades = [];
let shadeById = new Map();
let shadesByLine = new Map();

export function setShades(list) {
  shades = list || [];
  shadeById = new Map(shades.map((s) => [s.id, s]));
  shadesByLine = new Map();
  for (const s of shades) (shadesByLine.get(s.line) || shadesByLine.set(s.line, []).get(s.line)).push(s);
  annotateShadeCounts();
}

export function allShades() {
  return shades;
}

// 제품 레코드에 호수 수(shade_count)를 붙인다: 카드·챗봇이 '호수 보기' 버튼을 띄울지 판단한다
function annotateShadeCounts() {
  for (const p of products) {
    const n = shadesByLine.get(p.id)?.length || 0;
    if (n) p.shade_count = n;
    else delete p.shade_count;
  }
  visible = shades.length ? products.filter((p) => p.shade_count) : products;
}

export function findById(id) {
  const p = products.find((x) => x.id === id) || demoProducts.find((x) => x.id === id) || shadeById.get(id) || null;
  return keep(p) ? p : null;
}

export function normalizeBarcode(input) {
  return String(input ?? '').replace(/\s+/g, '');
}

// 표시용 이름: 색상명(shade_name)이 없는 상품(올리브영 데이터 등)은 상품명으로 대신한다
export const fullName = (p) => [p.brand, p.name, p.shade_name].filter(Boolean).join(' ');
export const shortName = (p) => (p.shade_name ? `${p.brand} ${p.shade_name}` : `${p.brand} ${p.name}`);

export function findByBarcode(code) {
  const c = normalizeBarcode(code);
  const p = products.find((x) => x.barcode === c) || demoProducts.find((x) => x.barcode === c)
    || shades.find((s) => s.barcodes?.includes(c)) || null; // 실제 호수: 단품·기획 옵션 바코드 모두
  return keep(p) ? p : null;
}

/** 같은 제품의 호수 전체: 시연용 제품(line), 실제 호수 레코드(line = 제품 id), 실제 제품(id). 없으면 빈 배열 */
export function shadesOf(product) {
  if (!keep(product)) return [];
  if (product.line) {
    const demo = demoProducts.filter((p) => p.line === product.line);
    return demo.length ? demo : (shadesByLine.get(product.line) || []);
  }
  return shadesByLine.get(product.id) || [];
}

// 제품 이름으로 찾기: 띄어쓰기·기호를 빼고 비교한다. 이름 말고 다른 조건("더 저렴한", "추천")이 붙은 말은 기존 검색에 맡긴다
const nameKey = (s) => String(s ?? '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
const NAME_FILLER = /틴트|립스틱|립글로스|립오일|립밤|립|제품|색상|색깔|색|컬러|호수|번호|전체|모든|전부|몇가지|몇개|보여주세요|보여줘|보여|찾아주세요|찾아줘|찾아|알려주세요|알려줘|알려|있어요|있나요|있니|있어|뭐예요|뭐야|주세요|좀|이|가|은|는|을|를|의|요|다|shades?|colou?rs?|show|find|please|tint|lipstick|what|are|all|the|of|for|me|see/g;

/** 메시지가 제품 이름을 부른 말이면 그 제품 (시연용 제품 먼저, 긴 이름 우선), 아니면 null */
export function findNamedProduct(text) {
  const msg = nameKey(text);
  if (!msg) return null;
  let best = null;
  for (const p of [...allDemoProducts(), ...allProducts()]) {
    for (const [brand, name] of [[p.brand, p.name], [p.brand_en, p.name_en]]) {
      const n = nameKey(name), b = nameKey(brand);
      if (!n || !msg.includes(n)) continue;
      const withBrand = !!b && msg.includes(b);
      if (n.length < (withBrand ? 4 : 6)) continue; // '벨벳 틴트'처럼 짧은 이름은 브랜드까지 말했을 때만
      const score = n.length + (withBrand ? 100 : 0);
      if (!best || score > best.score) best = { p, score, rest: msg.replace(n, '').replace(withBrand ? b : '', '') };
    }
  }
  return best && !best.rest.replace(NAME_FILLER, '') ? best.p : null;
}
