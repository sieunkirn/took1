// 시연용 가상 제품 데이터를 생성해 src/data/products.json 에 저장한다.
// 실제 브랜드/제품이 아닌 가상 데이터이다. color_lab 과 EAN-13 체크 디지트는 자동 계산된다.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hexToLab, roundLab, normalizeHex } from '../src/lib/color.js';

const BRANDS = ['모노랩', '리플', '온더립', '데일리톤', '노바뷰티'];

// [brand, name, type, shade_name, color_hex, finish, price, color_family, description]
const RAW = [
  ['모노랩', '벨벳 립 무스', '립스틱', '01 시그니처 레드', '#B3122E', 'velvet', 18000, 'red', '선명한 정통 레드. 부드럽게 블러 처리되는 벨벳 마무리.'],
  ['모노랩', '벨벳 립 무스', '립스틱', '02 로지 브릭', '#A0413A', 'velvet', 18000, 'brown', '붉은 벽돌빛 브라운 레드.'],
  ['모노랩', '벨벳 립 무스', '립스틱', '03 모브 로즈', '#A8606A', 'velvet', 18000, 'rose', '차분한 모브 톤 로즈.'],
  ['모노랩', '글로우 립 오일', '립오일', '01 클리어 핑크', '#E89AAE', 'glossy', 15000, 'pink', '투명하게 비치는 연한 핑크 오일.'],
  ['모노랩', '글로우 립 오일', '립오일', '02 체리 쥬스', '#C2203F', 'glossy', 15000, 'red', '촉촉한 광택의 체리 레드.'],
  ['리플', '워터 틴트', '틴트', '01 코랄 비치', '#F06A5A', 'glossy', 9900, 'coral', '물처럼 가볍게 발리는 코랄 틴트.'],
  ['리플', '워터 틴트', '틴트', '02 핑크 소다', '#E8608C', 'glossy', 9900, 'pink', '생기 있는 비비드 핑크.'],
  ['리플', '워터 틴트', '틴트', '03 베리 펀치', '#9E2450', 'glossy', 9900, 'berry', '진한 베리 계열 글로시 틴트.'],
  ['리플', '블러 매트 틴트', '틴트', '01 누드 피치', '#D4917A', 'matte', 11000, 'nude', '데일리용 누드 피치.'],
  ['리플', '블러 매트 틴트', '틴트', '02 칠리 오렌지', '#D9472B', 'matte', 11000, 'orange', '붉은 기 도는 칠리 오렌지.'],
  ['리플', '블러 매트 틴트', '틴트', '03 플럼 와인', '#6E2340', 'matte', 11000, 'plum', '깊은 플럼 와인 컬러.'],
  ['온더립', '새틴 립스틱', '립스틱', '101 베어 누드', '#C08A78', 'satin', 32000, 'nude', '입술 본연의 색에 가까운 누드.'],
  ['온더립', '새틴 립스틱', '립스틱', '102 로즈 우드', '#A4565E', 'satin', 32000, 'rose', '우디한 로즈 브라운.'],
  ['온더립', '새틴 립스틱', '립스틱', '103 클래식 레드', '#C0172C', 'satin', 32000, 'red', '은은한 윤기의 클래식 레드.'],
  ['온더립', '새틴 립스틱', '립스틱', '104 버건디 나잇', '#6B1A2A', 'satin', 32000, 'burgundy', '깊고 어두운 버건디.'],
  ['온더립', '매트 립스틱', '립스틱', '201 테라코타', '#B5533C', 'matte', 34000, 'brown', '따뜻한 테라코타 브라운.'],
  ['온더립', '매트 립스틱', '립스틱', '202 핑크 누드', '#C98E8E', 'matte', 34000, 'nude', '핑크 기가 도는 누드.'],
  ['데일리톤', '젤리 글로스', '립글로스', '01 피치 젤리', '#F4A58A', 'glossy', 7000, 'coral', '맑은 피치 코랄 글로스.'],
  ['데일리톤', '젤리 글로스', '립글로스', '02 라즈베리', '#C2315E', 'glossy', 7000, 'berry', '라즈베리 색 젤리 글로스.'],
  ['데일리톤', '젤리 글로스', '립글로스', '03 라벤더 핑크', '#C98BB5', 'glossy', 7000, 'pink', '쿨톤 라벤더 핑크.'],
  ['데일리톤', '소프트 매트', '립스틱', '01 말린 장미', '#B06C6C', 'matte', 8500, 'rose', '말린 장미 MLBB 컬러.'],
  ['데일리톤', '소프트 매트', '립스틱', '02 시나몬 브라운', '#8A4B3A', 'matte', 8500, 'brown', '시나몬 브라운.'],
  ['노바뷰티', '실크 립 밤', '립밤', '01 코랄 블러썸', '#E8826E', 'satin', 22000, 'coral', '보습감 있는 코랄 컬러 밤.'],
  ['노바뷰티', '실크 립 밤', '립밤', '02 피그 플럼', '#7F3550', 'satin', 22000, 'plum', '무화과빛 플럼.'],
  ['노바뷰티', '실크 립 밤', '립밤', '03 오렌지 선셋', '#E5643A', 'satin', 22000, 'orange', '선셋 오렌지.'],
  ['노바뷰티', '벨벳 틴트', '틴트', '01 핑크 벨벳', '#D45A7E', 'velvet', 16000, 'pink', '포근한 벨벳 핑크.'],
  ['노바뷰티', '벨벳 틴트', '틴트', '02 다크 체리', '#7A1426', 'velvet', 16000, 'burgundy', '다크 체리 버건디.'],
];

export function ean13CheckDigit(d12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d12[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

export function buildProducts() {
  return RAW.map(([brand, name, type, shade_name, hex, finish, price, color_family, description], i) => {
    const id = i + 1;
    const color_hex = normalizeHex(hex);
    // 880(국가코드) + 9 + 브랜드번호(1) + 일련번호(7) = 12자리 + 체크디지트
    const d12 = '8809' + (BRANDS.indexOf(brand) + 1) + String(id).padStart(7, '0');
    return {
      id: 'P' + String(id).padStart(3, '0'),
      barcode: d12 + ean13CheckDigit(d12),
      brand,
      name,
      type,
      shade_name,
      color_hex,
      color_lab: roundLab(hexToLab(color_hex)),
      color_family,
      finish,
      price,
      image_url: '',
      description,
    };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const products = buildProducts();
  const out = new URL('../src/data/products.json', import.meta.url);
  writeFileSync(out, JSON.stringify(products, null, 2) + '\n');
  console.log(`${products.length}개 제품 저장: ${fileURLToPath(out)}`);
}
