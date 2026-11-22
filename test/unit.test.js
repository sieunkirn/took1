import './use-virtual-data.js'; // 가상 제품 데이터로 고정 (다른 import 보다 먼저)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToLab, deltaE2000, hslToHex, rgbToHsl, hexToRgb, similarityFromDeltaE } from '../src/lib/color.js';
import { allProducts, findByBarcode, findById } from '../src/lib/repository.js';
import { recommendByColor } from '../src/lib/recommend.js';
import { normalizeAmounts } from '../src/lib/spoken.js';
import { ean13CheckDigit } from '../scripts/seed.js';
import { FAMILY_LABELS as FAMILY_LABELS_FOR_TEST } from '../src/lib/constants.js';

test('CIEDE2000 기준값 (Sharma et al. 테스트 데이터)', () => {
  const d = deltaE2000({ L: 50, a: 2.6772, b: -79.7751 }, { L: 50, a: 0, b: -82.7485 });
  assert.ok(Math.abs(d - 2.0425) < 1e-3, String(d));
  const d2 = deltaE2000({ L: 50, a: 2.5, b: 0 }, { L: 73, a: 25, b: -18 });
  assert.ok(Math.abs(d2 - 27.1492) < 1e-3, String(d2));
});

test('HSL/HEX 왕복 변환', () => {
  assert.equal(hslToHex({ h: 0, s: 100, l: 50 }), '#FF0000');
  assert.deepEqual(rgbToHsl(hexToRgb('#FF0000')), { h: 0, s: 100, l: 50 });
  assert.equal(similarityFromDeltaE(0), 100);
  assert.equal(similarityFromDeltaE(60), 0);
});

test('제품 데이터: 필수 필드, 고유 바코드/색상, 유효한 EAN-13', () => {
  const ps = allProducts();
  assert.ok(ps.length >= 10 && ps.length <= 30);
  const fields = ['id', 'barcode', 'brand', 'name', 'shade_name', 'color_hex', 'color_lab', 'finish', 'price', 'image_url', 'description'];
  for (const p of ps) {
    for (const f of fields) assert.ok(f in p, `${p.id} ${f}`);
    assert.equal(p.barcode.slice(12), ean13CheckDigit(p.barcode.slice(0, 12)));
    const lab = hexToLab(p.color_hex);
    assert.ok(Math.abs(lab.L - p.color_lab.L) < 0.01);
  }
  assert.equal(new Set(ps.map((p) => p.barcode)).size, ps.length);
  assert.equal(new Set(ps.map((p) => p.color_hex)).size, ps.length);
});

test('바코드 검색', () => {
  const p = allProducts()[4];
  assert.equal(findByBarcode(p.barcode).id, p.id);
  assert.equal(findByBarcode(' ' + p.barcode + ' ').id, p.id);
  assert.equal(findByBarcode('0000000000000'), null);
});

test('색상 추천: 동일 색상이 1위(100%), 결정적 정렬', () => {
  const p = findById('P014');
  const r1 = recommendByColor(p.color_hex, { limit: 5 });
  assert.equal(r1[0].id, 'P014');
  assert.equal(r1[0].similarity, 100);
  for (let i = 1; i < r1.length; i++) assert.ok(r1[i - 1].delta_e <= r1[i].delta_e);
  assert.deepEqual(recommendByColor(p.color_hex, { limit: 5 }).map((x) => x.id), r1.map((x) => x.id));
  const glossy = recommendByColor('#C0172C', { finish: 'glossy' });
  assert.ok(glossy.every((x) => x.finish === 'glossy'));
  assert.ok(!recommendByColor(p.color_hex, { excludeIds: ['P014'] }).some((x) => x.id === 'P014'));
});

test('말 보정: 한글·띄어 쓴 금액', () => {
  assert.equal(normalizeAmounts('만 오천 원 이하 레드'), '15000원 이하 레드');
  assert.equal(normalizeAmounts('1만5천원 미만'), '15000원 미만');
  assert.equal(normalizeAmounts('이만원 이하'), '20000원 이하');
  assert.equal(normalizeAmounts('2.5만원 까지'), '25000원 까지');
  assert.equal(normalizeAmounts('만들어 줘'), '만들어 줘'); // 금액이 아닌 '만'은 그대로
});

test('올리브영 변환: 상품명 정리·제형 추정·색 없는 상품 제외·추정 표시', async () => {
  const { parseName, inferFinish, convert } = await import('../scripts/import-oliveyoung.js');
  assert.deepEqual(parseName('라카 [나나PICK/이시안공동개발] 라카 퍼펙트 트윈 립 12 colors'), { brand: '라카', name: '퍼펙트 트윈 립', colorOptions: 12 });
  assert.deepEqual(parseName('페리페라 페리페라 무드 글로이 틴트 32 Colors (+푸딩 말랑이 키링&스티커 증정)'), { brand: '페리페라', name: '무드 글로이 틴트', colorOptions: 32 });
  assert.equal(parseName('클리오 크리스탈글램틴트 단품/기획 (+코팅 립 마스크 증정)').name, '크리스탈글램틴트');
  assert.equal(inferFinish('시튜에아 에어리 무스 벨벳'), 'velvet'); // 무스(매트)보다 벨벳이 먼저
  assert.equal(inferFinish('컬러그램 누디 블러 틴트'), 'matte');
  assert.equal(inferFinish('브레이 씬 글로우 틴트'), 'glossy');
  assert.equal(inferFinish('롬앤 래스팅 틴트'), null); // 단서가 없으면 지어내지 않는다
  const { products, skipped } = convert([
    { product_name: '브레이 [누적] 브레이 씬 글로우 틴트 8종', list_price_krw: '12,000', sale_price_krw: '10,900', representative_color_hex: '#C1595A', detail_url: 'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000211068&dispCatNo=1&t_page=x' },
    { product_name: '어떤 브랜드 색 없는 틴트', list_price_krw: '9,000', sale_price_krw: '9,000', representative_color_hex: null, detail_url: null },
  ], allProducts());
  assert.equal(products.length, 1);
  assert.deepEqual(skipped, ['어떤 브랜드 색 없는 틴트']);
  const p = products[0];
  assert.equal(p.id, 'OY-A000000211068');
  assert.equal(p.source, 'oliveyoung');
  assert.equal(p.barcode, null);
  assert.equal(p.shade_name, null);
  assert.equal(p.price, 10900);
  assert.equal(p.finish, 'glossy');
  assert.equal(p.finish_source, 'product_name');
  assert.equal(p.color_family_source, 'estimated_from_color');
  assert.ok(Object.keys(FAMILY_LABELS_FOR_TEST).includes(p.color_family));
  assert.doesNotMatch(p.url, /t_page/); // 추적용 값은 뺀다
});

test('올리브영 변환: 대표 이미지는 수집된 올리브영 주소만 넣고 추측하지 않는다', async () => {
  const { convert, imageMap, cleanImageUrl } = await import('../scripts/import-oliveyoung.js');
  const img = 'https://image.oliveyoung.co.kr/cfimages/cf-goods/uploads/images/thumbnails/400/10/0000/0026/A00000026720043ko.jpg?l=ko';
  assert.equal(cleanImageUrl(img), img);
  assert.equal(cleanImageUrl('http://image.oliveyoung.co.kr/a.jpg'), null); // https 만
  assert.equal(cleanImageUrl('https://example.com/a.jpg'), null); // 올리브영 이미지 서버만
  const map = imageMap([{ detail_url: 'https://www.oliveyoung.co.kr/x?goodsNo=A000000267200&y=1', src: img }]);
  assert.deepEqual(map, { A000000267200: img });
  const row = (goods, extra = {}) => ({ product_name: '브랜드 틴트', sale_price_krw: '9,000', representative_color_hex: '#C1595A', detail_url: `https://www.oliveyoung.co.kr/x?goodsNo=${goods}`, ...extra });
  const { products } = convert([row('A000000267200'), row('A000000999999', { src: img }), row('A000000888888')], allProducts(), map);
  assert.deepEqual(products.map((p) => p.image_url), [img, img, '']); // manifest 보충 / 행의 src / 없음
  // 받아 둔 이미지 파일(public 기준 경로)이 있으면 주소보다 먼저 쓴다
  const local = { A000000999999: 'images/lip-tints/A000000999999.jpg' };
  const withLocal = convert([row('A000000999999', { src: img }), row('A000000888888')], allProducts(), {}, local).products;
  assert.deepEqual(withLocal.map((p) => p.image_url), ['images/lip-tints/A000000999999.jpg', '']);
});

test('시연용 호수 데이터: 바코드·ID 로 찾고, 같은 제품의 호수를 모으며, 추천 목록에는 섞이지 않는다', async () => {
  const { allDemoProducts, findById, findByBarcode, allProducts } = await import('../src/lib/repository.js');
  const { shadesOf } = await import('../src/lib/catalog.js');
  const demo = allDemoProducts();
  assert.equal(new Set(demo.map((p) => p.barcode)).size, demo.length);
  assert.ok(demo.every((p) => p.source === 'demo' && p.shade_no && p.shade_color && Number.isFinite(p.stock)));
  assert.equal(findById('D101').shade_no, '01');
  assert.equal(shadesOf(findById('D101')).length, 15);
  assert.ok(findByBarcode(findById('D101').barcode));
  assert.ok(!allProducts().some((p) => p.source === 'demo'));
});

test('QR: 만든 QR 을 zxing 이 그대로 읽는다 (버전 1~6), 너무 길면 null', async () => {
  const { createRequire } = await import('node:module');
  const Z = createRequire(import.meta.url)('@zxing/library');
  const { qrMatrix } = await import('../public/js/qr.js');
  const decode = (m) => {
    const S = 6, Q = 4, n = (m.length + Q * 2) * S;
    const lum = new Uint8ClampedArray(n * n).fill(255);
    m.forEach((row, y) => row.forEach((on, x) => {
      if (!on) return;
      for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) lum[((y + Q) * S + a) * n + (x + Q) * S + b] = 0;
    }));
    return new Z.QRCodeReader().decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, n, n)))).getText();
  };
  const texts = ['hi', 'x'.repeat(30), 'y'.repeat(50), 'z'.repeat(75), 'w'.repeat(100), 'v'.repeat(134),
    'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000120880'];
  const versions = new Set();
  for (const text of texts) {
    const m = qrMatrix(text);
    versions.add((m.length - 17) / 4);
    assert.equal(decode(m), text);
  }
  assert.deepEqual([...versions].sort(), [1, 2, 3, 4, 5, 6]);
  assert.equal(qrMatrix('a'.repeat(135)), null);
});
