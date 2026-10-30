// 제품 목록 조회 (서버/브라우저 공용, 외부 의존성 없음).
// 서버는 repository.js 가 JSON 파일을 읽어 setProducts() 로 넣고, 브라우저(정적 모드)는 data/products.json 을 받아 넣는다.
let products = [];

export function setProducts(list) {
  products = list;
}

export function allProducts() {
  return products;
}

export function findById(id) {
  return products.find((p) => p.id === id) || null;
}

export function normalizeBarcode(input) {
  return String(input ?? '').replace(/\s+/g, '');
}

// 표시용 이름: 색상명(shade_name)이 없는 상품(올리브영 데이터 등)은 상품명으로 대신한다
export const fullName = (p) => [p.brand, p.name, p.shade_name].filter(Boolean).join(' ');
export const shortName = (p) => (p.shade_name ? `${p.brand} ${p.shade_name}` : `${p.brand} ${p.name}`);

export function findByBarcode(code) {
  const c = normalizeBarcode(code);
  return products.find((p) => p.barcode === c) || null;
}
