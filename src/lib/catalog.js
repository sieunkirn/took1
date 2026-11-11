// 제품 목록 조회 (서버/브라우저 공용, 외부 의존성 없음).
// 서버는 repository.js 가 JSON 파일을 읽어 setProducts() 로 넣고, 브라우저(정적 모드)는 data/products.json 을 받아 넣는다.
let products = [];

export function setProducts(list) {
  products = list;
}

export function allProducts() {
  return products;
}

// 시연용 호수 데이터(src/data/products.demo.json): 호수·바코드·재고가 있는 가상 제품.
// 실제 데이터(올리브영)에 그 정보가 없어 따로 둔다. 이름·바코드·ID 로는 찾지만, 추천 목록(allProducts)에는 섞지 않는다
let demoProducts = [];

export function setDemoProducts(list) {
  demoProducts = list;
}

export function allDemoProducts() {
  return demoProducts;
}

export function findById(id) {
  return products.find((p) => p.id === id) || demoProducts.find((p) => p.id === id) || null;
}

export function normalizeBarcode(input) {
  return String(input ?? '').replace(/\s+/g, '');
}

// 표시용 이름: 색상명(shade_name)이 없는 상품(올리브영 데이터 등)은 상품명으로 대신한다
export const fullName = (p) => [p.brand, p.name, p.shade_name].filter(Boolean).join(' ');
export const shortName = (p) => (p.shade_name ? `${p.brand} ${p.shade_name}` : `${p.brand} ${p.name}`);

export function findByBarcode(code) {
  const c = normalizeBarcode(code);
  return products.find((p) => p.barcode === c) || demoProducts.find((p) => p.barcode === c) || null;
}

/** 같은 제품의 호수 전체 (호수 데이터가 있는 시연용 제품만, 없으면 빈 배열) */
export function shadesOf(product) {
  return product?.line ? demoProducts.filter((p) => p.line === product.line) : [];
}

// 제품 이름으로 찾기: 띄어쓰기·기호를 빼고 비교한다. 이름 말고 다른 조건("더 저렴한", "추천")이 붙은 말은 기존 검색에 맡긴다
const nameKey = (s) => String(s ?? '').toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
const NAME_FILLER = /틴트|립스틱|립글로스|립오일|립밤|립|제품|색상|색깔|색|컬러|호수|번호|전체|모든|전부|몇가지|몇개|보여주세요|보여줘|보여|찾아주세요|찾아줘|찾아|알려주세요|알려줘|알려|있어요|있나요|있니|있어|뭐예요|뭐야|주세요|좀|이|가|은|는|을|를|의|요|다|shades?|colou?rs?|show|find|please|tint|lipstick|what|are|all|the|of|for|me|see/g;

/** 메시지가 제품 이름을 부른 말이면 그 제품 (시연용 제품 먼저, 긴 이름 우선), 아니면 null */
export function findNamedProduct(text) {
  const msg = nameKey(text);
  if (!msg) return null;
  let best = null;
  for (const p of [...demoProducts, ...products]) {
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
