// 서버용 제품 저장소: JSON 파일을 읽어 catalog 에 적재한다.
// 이후 실제 DB 로 교체할 때는 이 모듈과 catalog.js 의 함수 시그니처만 유지하면 된다.
//
// 데이터 출처 (CLAUDE.md: 실제 데이터와 테스트용 데이터를 구분한다)
// - oliveyoung (기본): 올리브영에서 수집한 실제 립틴트 (scripts/import-oliveyoung.js 로 변환)
// - virtual: 시연·테스트용 가상 제품 27개 (바코드 있음). 테스트는 결과가 바뀌지 않도록 이 데이터를 쓴다 (TOOK_DATA=virtual)
import { readFileSync, existsSync } from 'node:fs';
import { setProducts, setDemoProducts } from './catalog.js';

export { allProducts, allDemoProducts, findById, findByBarcode, normalizeBarcode } from './catalog.js';

const FILES = {
  oliveyoung: new URL('../data/products.oliveyoung.json', import.meta.url),
  virtual: new URL('../data/products.json', import.meta.url),
};
// 시연용 호수·바코드·재고 데이터 (실제 제품 아님, 화면에 '테스트 데이터'로 표시). 어느 데이터 출처든 함께 쓴다
export const DEMO_FILE = new URL('../data/products.demo.json', import.meta.url);

export function dataSource() {
  if (process.env.TOOK_DATA === 'virtual') return 'virtual';
  if (!existsSync(FILES.oliveyoung)) {
    console.warn('[took] products.oliveyoung.json 이 없어 가상 데이터를 씁니다. (npm run import:oliveyoung)');
    return 'virtual';
  }
  return 'oliveyoung';
}

export function dataFile(source = dataSource()) {
  return FILES[source];
}

export function loadProducts(file = dataFile()) {
  const list = JSON.parse(readFileSync(file, 'utf8'));
  setProducts(list);
  return list;
}

loadProducts();
setDemoProducts(JSON.parse(readFileSync(DEMO_FILE, 'utf8')));
