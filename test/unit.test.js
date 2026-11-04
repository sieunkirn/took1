import './use-virtual-data.js'; // 가상 제품 데이터로 고정 (다른 import 보다 먼저)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToLab, deltaE2000, hslToHex, rgbToHsl, hexToRgb, similarityFromDeltaE } from '../src/lib/color.js';
import { allProducts, findByBarcode, findById } from '../src/lib/repository.js';
import { recommendByColor } from '../src/lib/recommend.js';
import { answer, parseMessage, chatVocab, chatKeepWords, compareSummary, chatAliases, normalizeForChat } from '../src/lib/chat.js';
import { normalizeAmounts, normalizeSpoken, jamoDistance, applyAliases, correctWords } from '../src/lib/spoken.js';
import { ean13CheckDigit } from '../scripts/seed.js';
import { readFileSync } from 'node:fs';
import { FAMILY_LABELS as FAMILY_LABELS_FOR_TEST } from '../src/lib/constants.js';
import { llmAnswer, hybridAnswer, validateFinal } from '../src/lib/llm/agent.js';
import { toQuery } from '../src/lib/llm/tools.js';

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

test('챗봇 파싱', () => {
  const c = parseMessage('2만원 이하 글로시한 코랄 추천해 줘');
  assert.equal(c.finish, 'glossy');
  assert.deepEqual(c.families, ['coral']);
  assert.equal(c.maxPrice.value, 20000);
});

test('챗봇: 기준 제품 + 더 글로시한 제품', () => {
  const r = answer({ message: '더 글로시한 제품 추천해 줘', baseProductId: 'P014' });
  assert.ok(r.products.length > 0);
  assert.ok(r.products.every((p) => p.finish === 'glossy' && p.id !== 'P014'));
  for (let i = 1; i < r.products.length; i++) assert.ok(r.products[i - 1].delta_e <= r.products[i].delta_e);
  assert.equal(r.products[0].id, 'P005'); // 클래식 레드와 가장 가까운 글로시 = 체리 쥬스
});

test('챗봇: 더 저렴한 제품은 기준 제품보다 싸다', () => {
  const base = findById('P014');
  const r = answer({ message: '더 저렴한 제품 추천', baseProductId: 'P014' });
  assert.ok(r.products.length > 0 && r.products.every((p) => p.price < base.price));
});

test('챗봇: 기준 색상 없이 비슷한 색상 요청 시 결과를 꾸며내지 않는다', () => {
  const r = answer({ message: '비슷한 색상 찾아 줘' });
  assert.equal(r.products.length, 0);
  assert.match(r.reply, /기준 색상이 없어/);
});

test('챗봇: 립 컬러 매핑 색상으로 비슷한 색상', () => {
  const r = answer({ message: '비슷한 색상 찾아 줘', selectedHex: '#B3122E' });
  assert.equal(r.products[0].id, 'P001');
});

test('챗봇: 매트 + 가격 상한 + 조건 미일치', () => {
  const r = answer({ message: '1만원 이하 매트 찾아 줘' });
  assert.ok(r.products.length > 0 && r.products.every((p) => p.finish === 'matte' && p.price <= 10000));
  const none = answer({ message: '5천원 이하 벨벳 추천' });
  assert.equal(none.products.length, 0);
  assert.match(none.reply, /맞는 제품이 없어요/);
  const unknown = answer({ message: '안녕' });
  assert.equal(unknown.products.length, 0);
});

test('챗봇: 기준 제품 정보 질문', () => {
  const r = answer({ message: '이 제품 가격 얼마야?', baseProductId: 'P001' });
  assert.match(r.reply, /18,000원/);
});

test('말 보정: 한글·띄어 쓴 금액', () => {
  assert.equal(normalizeAmounts('만 오천 원 이하 레드'), '15000원 이하 레드');
  assert.equal(normalizeAmounts('1만5천원 미만'), '15000원 미만');
  assert.equal(normalizeAmounts('이만원 이하'), '20000원 이하');
  assert.equal(normalizeAmounts('2.5만원 까지'), '25000원 까지');
  assert.equal(normalizeAmounts('만들어 줘'), '만들어 줘'); // 금액이 아닌 '만'은 그대로
});

test('말 보정: 비슷한 발음을 챗봇 단어로', () => {
  const vocab = chatVocab(['모노랩', '리플', '온더립', '데일리톤', '노바뷰티']);
  const fix = (t) => normalizeSpoken(t, vocab).text;
  assert.equal(fix('그로시한 코럴 추천해 줘'), '글로시한 코랄 추천해 줘');
  assert.equal(fix('메트한 제품'), '매트한 제품');
  assert.equal(fix('벨벧 보여 줘'), '벨벳 보여 줘');
  assert.equal(fix('모노렙 제품'), '모노랩 제품');
  assert.equal(fix('더 저렵한 제품'), '더 저렴한 제품');
  // 일상적인 말은 바꾸지 않는다
  for (const t of ['이 제품 가격 얼마야?', '제형 알려 줘', '추천해 줘', '보여 줘', '더 밝은 색 추천해 줘', '립스틱 추천', '안녕']) {
    assert.equal(fix(t), t);
  }
  assert.ok(jamoDistance('그로시', '글로시') < jamoDistance('그로시', '매트'));
});

test('챗봇: 보정한 말로 답하고 무엇을 알아들었는지 알려 준다', () => {
  const r = answer({ message: '만 오천 원 이하 그로시한 거 추천해 줘' });
  assert.ok(r.products.length > 0 && r.products.every((p) => p.finish === 'glossy' && p.price <= 15000));
  assert.match(r.reply, /'글로시'로 알아들었어요/);
  assert.deepEqual(r.corrections, [{ from: '그로시', to: '글로시' }]);
  const exact = answer({ message: '1만5천원 미만 레드' });
  assert.ok(exact.conditions.includes('가격 < 15,000원'));
});

test('대화: 이전 결과를 이어서 묻기 (그중 최저가 / 번호 / 비교 / 더 보여 줘 / 바꿔)', () => {
  const first = answer({ message: '데이트 립 추천해 줘' });
  assert.equal(first.products.length, 5);
  assert.ok(first.context.shown.length === 5 && first.suggestions.length > 0);
  const ctx = first.context;

  const cheapest = answer({ message: '그중에 제일 싼 거는?', context: ctx });
  assert.equal(cheapest.products[0].price, Math.min(...first.products.map((p) => p.price)));

  const second = answer({ message: '두 번째 거 자세히 알려 줘', context: ctx });
  assert.equal(second.products[0].id, first.products[1].id);

  const cmp = answer({ message: '1번이랑 3번 비교해 줘', context: ctx });
  assert.deepEqual(cmp.products.map((p) => p.id), [first.products[0].id, first.products[2].id]);
  assert.equal(cmp.kind, 'compare');
  assert.match(cmp.reply, /가장 저렴한 건/);

  const more = answer({ message: '더 보여 줘', context: ctx });
  assert.ok(more.products.length > 0 && !more.products.some((p) => ctx.shown.includes(p.id)));

  const matte = answer({ message: '매트한 걸로 바꿔 줘', context: ctx });
  assert.ok(matte.products.every((p) => p.finish === 'matte'));
  assert.ok(matte.conditions.some((x) => x.includes('데이트')));

  const pick = answer({ message: '두 번째 거 기준 제품으로 해 줘', context: ctx });
  assert.deepEqual(pick.action, { type: 'setBase', id: first.products[1].id });
});

test('대화: 상황·톤·고민·제외 조건', () => {
  const dry = answer({ message: '입술이 건조한데 뭐가 좋아?' });
  assert.ok(dry.products.every((p) => ['glossy', 'satin'].includes(p.finish)));
  const noRed = answer({ message: '레드 말고 다른 거 추천해 줘' });
  assert.ok(noRed.products.length > 0 && noRed.products.every((p) => p.color_family !== 'red'));
  const cool = answer({ message: '쿨톤 립 추천해 줘' });
  assert.ok(cool.products.every((p) => ['pink', 'rose', 'berry', 'plum', 'red'].includes(p.color_family)));
  // 측정한 톤이 없으면 되묻고, 있으면 그 톤으로 찾는다
  assert.equal(answer({ message: '나한테 어울리는 립 추천해 줘' }).products.length, 0);
  const mine = answer({ message: '나한테 어울리는 립 추천해 줘', tone: 'autumn' });
  assert.ok(mine.products.length > 0 && mine.products.every((p) => ['brown', 'orange', 'nude', 'coral'].includes(p.color_family)));
  // '비싼' 안의 '싼'을 저렴으로 오해하지 않는다
  const priciest = answer({ message: '제일 비싼 거 뭐야?' });
  assert.equal(priciest.products[0].price, Math.max(...allProducts().map((p) => p.price)));
});

test('대화: 결과가 없으면 조건을 줄인 대안을 알려 주고, 정체를 물으면 규칙 기반이라고 답한다', () => {
  const none = answer({ message: '3천원 이하 벨벳 레드' });
  assert.equal(none.products.length, 0);
  assert.match(none.reply, /없어요.*가격 조건을 빼면 \d+개/);
  assert.match(answer({ message: '너 AI야?' }).reply, /외부 AI 가 아니라/);
});

test('비교함: 2~3개 비교 요약 (최저가·비슷한 색·밝기를 쉬운 말로)', () => {
  const items = ['P001', 'P005', 'P014'].map(findById);
  const text = compareSummary(items);
  const cheapest = [...items].sort((a, b) => a.price - b.price)[0];
  assert.ok(text.includes(`${cheapest.brand} ${cheapest.shade_name}`) && text.includes('가장 저렴한 건'), text);
  assert.match(text, /가장 밝고 가벼운 색은/);
  assert.doesNotMatch(text, /ΔE|L\*/); // 사용자에게는 기술 용어를 쓰지 않는다
  assert.equal(compareSummary(items.slice(0, 1)), '');
});

test('말투: 사용자에게 보이는 답에는 기술적인 조건 표기가 없다', () => {
  for (const m of ['데이트 립 추천해 줘', '2만원 이하 글로시한 코랄 추천해 줘', '쿨톤 립 추천해 줘']) {
    const r = answer({ message: m });
    assert.doesNotMatch(r.reply, /조건\(|등록 제품 \d+개 중|≤|ΔE/, r.reply);
    assert.ok(r.conditions.length > 0); // 기술적 조건은 conditions 로 따로 돌려준다 (테스트 화면에서 표시)
  }
});

test('시연용 바코드: EAN-13 막대 패턴(95칸, 가드 위치)과 등록 제품 바코드 전부 생성', async () => {
  const { ean13Bits, ean13Svg } = await import('../public/js/ean13.js');
  const bits = ean13Bits('4006381333931'); // 널리 쓰이는 EAN-13 예시
  assert.equal(bits.length, 95);
  assert.equal(bits.slice(0, 3), '101');
  assert.equal(bits.slice(45, 50), '01010');
  assert.equal(bits.slice(92), '101');
  assert.equal(bits.slice(3, 10), '0001101'); // 첫 자리 4 → 둘째 자리 0 은 L 패턴(0001101)
  for (const p of allProducts()) assert.match(ean13Svg(p.barcode), /^<svg[\s\S]*<\/svg>$/);
  assert.throws(() => ean13Bits('123'));
});

test('휴대폰 연결: 연결 생성 → 휴대폰 소식을 쌓아 두고 PC 가 마지막 번호 이후만 가져간다, 없는 연결은 거절', async () => {
  const { createSession, getSession, notify, poll } = await import('../src/lib/pairing.js');
  const id = createSession();
  assert.match(id, /^[0-9a-f]{16}$/);
  assert.ok(getSession(id));
  assert.equal(getSession('0000000000000000'), null);
  assert.equal(notify('0000000000000000', 'code', { code: '1' }), false);
  assert.equal(poll('0000000000000000', 0), null);
  assert.ok(notify(id, 'phone', {}));
  assert.ok(notify(id, 'code', { code: '8809100000017' }));
  const first = poll(id, 0);
  assert.deepEqual(first.events.map((e) => e.type), ['phone', 'code']);
  assert.equal(first.events[1].data.code, '8809100000017');
  // 이미 받은 소식은 다시 오지 않는다
  assert.deepEqual(poll(id, first.last).events, []);
  notify(id, 'code', { code: '8809100000024' });
  assert.deepEqual(poll(id, first.last).events.map((e) => e.data.code), ['8809100000024']);
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

test('올리브영 상품(색상명·제형·바코드 없음)으로도 챗봇 답에 undefined/null 이 나오지 않는다', async () => {
  const { setProducts } = await import('../src/lib/catalog.js');
  const saved = allProducts();
  const oy = JSON.parse(readFileSync(new URL('../src/data/products.oliveyoung.json', import.meta.url), 'utf8'));
  setProducts(oy);
  try {
    let ctx = null;
    for (const m of ['데이트 립 추천해 줘', '두 번째 거 자세히 알려 줘', '1번이랑 2번 비교해 줘', '그중에 제일 싼 거는?', '매트 말고 다른 거', '2만원 이하 코랄 추천해 줘']) {
      const r = answer({ message: m, context: ctx });
      ctx = r.context;
      assert.doesNotMatch(r.reply, /undefined|null/, `${m} → ${r.reply}`);
    }
    const noFinish = oy.find((p) => !p.finish);
    const r = answer({ message: '제형 알려 줘', baseProductId: noFinish.id });
    assert.match(r.reply, /제형 정보는 수집되지 않았어요/);
    assert.match(answer({ message: '바코드 알려 줘', baseProductId: noFinish.id }).reply, /바코드 정보가 없어요/);
  } finally {
    setProducts(saved);
  }
});

test('말 보정: 브랜드가 많아도(올리브영 92개) 이미 아는 말은 브랜드로 바꾸지 않는다 ("데이트" ≠ "케이트")', () => {
  const oy = JSON.parse(readFileSync(new URL('../src/data/products.oliveyoung.json', import.meta.url), 'utf8'));
  const vocab = chatVocab([...new Set(oy.map((p) => p.brand))]);
  const keep = chatKeepWords();
  for (const t of ['데이트 립 추천해 줘', '면접 립 추천해 줘', '하객 립', '입술이 건조해']) assert.equal(normalizeSpoken(t, vocab, keep).text, t);
  assert.equal(normalizeSpoken('롬엔 제품 보여 줘', vocab, keep).text, '롬앤 제품 보여 줘');
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

test('챗봇: 가격 하한·가격대·"짜리", 열 번째, 띄어 말한 브랜드, 등록되지 않은 브랜드', () => {
  assert.deepEqual(parseMessage('3만원 넘는 립').minPrice, { value: 30000, strict: true });
  assert.deepEqual(parseMessage('2만원 이상').minPrice, { value: 20000, strict: false });
  const band = parseMessage('10000원대 립');
  assert.deepEqual([band.minPrice.value, band.maxPrice.value], [10000, 19999]);
  assert.equal(parseMessage('1000원짜리 있어?').maxPrice.value, 1000);
  assert.equal(parseMessage('20000원 안 넘는 선').maxPrice.value, 20000);
  assert.equal(normalizeAmounts('천 원짜리'), '1000원짜리');
  assert.equal(normalizeAmounts('친구 추천 선물'), '친구 추천 선물'); // '추천'의 '천'은 금액이 아니다
  assert.deepEqual(parseMessage('열 번째 거').ordinals, [9]);
  assert.deepEqual(parseMessage('1번이랑 2번 비교').ordinals, [0, 1]);
  assert.equal(parseMessage('노바 뷰티 립', ['노바뷰티']).brand, '노바뷰티');
  assert.equal(parseMessage('샤넬 립 추천', ['노바뷰티']).unknownBrand, '샤넬');

  const over = answer({ message: '3만원 넘는 립 보여 줘' });
  assert.ok(over.products.length > 0 && over.products.every((p) => p.price > 30000));
  const none = answer({ message: '천 원짜리 립 있어?' });
  assert.equal(none.products.length, 0);
  assert.match(none.reply, /맞는 제품이 없어요/);
  const chanel = answer({ message: '샤넬 립 추천해 줘' });
  assert.equal(chanel.products.length, 0);
  assert.match(chanel.reply, /'샤넬' 제품은 아직 등록되어 있지 않아요/);

  const first = answer({ message: '모노랩 립 추천해 줘' });
  const cheap = answer({ message: '2만원 이하로', context: first.context });
  assert.ok(cheap.products.every((p) => p.brand === '모노랩' && p.price <= 20000)); // 이어 물어도 브랜드 조건이 남는다
  const tenth = answer({ message: '열 번째 거 알려 줘', context: first.context });
  assert.match(tenth.reply, /열 번째 제품은 없어요/);
});

// ---------- LLM 층 (실제 모델 없이 가짜 응답으로 검증·대체 동작을 확인한다) ----------
// '우주 같은 느낌' 은 규칙 챗봇이 못 알아듣는 말이라 LLM 으로 넘어간다
// 가짜 모델: 첫 요청엔 search_products 를 부르고, 도구 결과가 오면 pickId(결과)로 고른 id 와 say 로 답한다
const fakeModel = (args, pickId = (r) => r.products[0]?.id, say = '혈색이 돌아 보이는 색이에요.') => async ({ messages }) => {
  const last = messages.at(-1);
  if (last.role === 'user' && !messages.some((m) => m.role === 'tool')) {
    return { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'search_products', arguments: JSON.stringify(args) } }] };
  }
  const result = JSON.parse(messages.findLast((m) => m.role === 'tool').content);
  return { content: JSON.stringify({ intent: 'recommend', product_ids: [pickId(result)], say }) };
};

test('LLM 층: 답 검증 (도구 결과에 없는 id·브랜드·가격·자리표시 거부)', () => {
  const p = allProducts()[0];
  const allowed = new Set([p.id]);
  assert.equal(validateFinal(JSON.stringify({ intent: 'recommend', product_ids: [p.id], say: '{{1}} 추천해요.' }), allowed).ids[0], p.id);
  assert.match(validateFinal(JSON.stringify({ intent: 'recommend', product_ids: ['P999'], say: '좋아요.' }), allowed).error, /없는 제품/);
  assert.match(validateFinal(JSON.stringify({ intent: 'recommend', product_ids: [p.id], say: `${p.brand} 제품이에요.` }), allowed).error, /브랜드/);
  assert.match(validateFinal(JSON.stringify({ intent: 'recommend', product_ids: [p.id], say: '9,900원이에요.' }), allowed).error, /가격/);
  assert.match(validateFinal(JSON.stringify({ intent: 'recommend', product_ids: [p.id], say: '{{2}} 도 좋아요.' }), allowed).error, /\{\{2\}\}/);
  assert.match(validateFinal('그냥 글', allowed).error, /JSON/);
  assert.deepEqual(toQuery({ families: ['pink', 'green'], exclude_finishes: ['glossy'], max_price: 20000, sort: 'cheapest' }),
    { families: ['pink'], exclude: { finishes: ['glossy'], families: [] }, maxPrice: { value: 20000, strict: false }, superlative: 'cheapest' });
});

test('LLM 층: 도구로 찾은 제품만 보여 주고 이름·가격은 DB 에서 채운다', async () => {
  const r = await llmAnswer({ message: '우주 같은 느낌으로 골라 줘' }, { complete: fakeModel({ families: ['pink', 'coral', 'rose'] }) });
  assert.equal(r.products.length, 1);
  const p = r.products[0];
  assert.ok(['pink', 'coral', 'rose'].includes(p.color_family));
  assert.ok(r.reply.startsWith(`${p.brand}`) && r.reply.includes(`${p.price.toLocaleString('ko-KR')}원`));
  assert.deepEqual(r.context.shown, [p.id]);
  // 이어지는 질문은 규칙 챗봇이 그대로 받는다
  const next = answer({ message: '첫 번째 거 자세히 알려 줘', context: r.context });
  assert.equal(next.products[0].id, p.id);
});

test('LLM 층: 지어낸 id 는 다시 물어도 고치지 않으면 규칙 답으로 돌아간다', async () => {
  const lying = fakeModel({ families: ['pink'] }, () => 'P999');
  assert.equal(await llmAnswer({ message: '우주 같은 느낌으로 골라 줘' }, { complete: lying }), null);
  const r = await hybridAnswer({ message: '우주 같은 느낌으로 골라 줘' }, { complete: lying, enabled: true });
  assert.equal(r.engine, 'rule-based');
  assert.ok(r.unsure && r.products.length > 0); // 규칙 답: 한마디 받고 무난한 립을 보여 준다
});

test('LLM 층: 규칙이 알아들은 말은 LLM 을 부르지 않고, LLM 오류는 규칙 답으로', async () => {
  const never = async () => { throw new Error('부르면 안 됨'); };
  const ok = await hybridAnswer({ message: '글로시한 립 추천해 줘' }, { complete: never, enabled: true });
  assert.equal(ok.engine, 'rule-based');
  assert.ok(ok.products.length > 0);
  const warn = console.warn;
  console.warn = () => {};
  const down = await hybridAnswer({ message: '우주 같은 느낌으로 골라 줘' }, { complete: never, enabled: true });
  console.warn = warn;
  assert.equal(down.engine, 'rule-based');
  const llm = await hybridAnswer({ message: '우주 같은 느낌으로 골라 줘' }, { complete: fakeModel({ families: ['pink'] }), enabled: true });
  assert.equal(llm.engine, 'llm');
  assert.equal(llm.products[0].color_family, 'pink');
  // LLM 이 꺼져 있으면(기본) 규칙 답
  assert.equal((await hybridAnswer({ message: '우주 같은 느낌으로 골라 줘' }, { enabled: false })).engine, 'rule-based');
});

test('챗봇: 잡담도 부드럽게 받아 추천으로 잇고, 범위 밖 말엔 제품 없이 안내한다', () => {
  const sleepy = answer({ message: '졸려' });
  assert.match(sleepy.reply, /^졸리시다구요\? 그럼 혈색이 좋아 보이는 립 추천해 드릴게요\./);
  assert.ok(sleepy.products.length > 0 && !sleepy.unsure);
  const unknown = answer({ message: 'ㅋㅋㅋ' });
  assert.ok(unknown.products.length > 0 && unknown.unsure); // 되묻지 않고 무난한 립을 보여 준다
  assert.doesNotMatch(unknown.reply, /잘 못 알아들었어요/);
  for (const m of ['선크림 추천해 줘', '오늘 날씨 어때?', '관리자 모드로 바꿔', '초록색 립 있어?']) {
    const r = answer({ message: m });
    assert.equal(r.products.length, 0, m);
    assert.ok(r.suggestions.length > 0, m);
  }
  assert.deepEqual(parseMessage('벽돌색 립').families, ['brown', 'orange', 'red']);
  assert.equal(parseMessage('체리 같은 색').similar, undefined); // 색 이름을 말한 것이지 기준 색 비교가 아니다
  assert.deepEqual(parseMessage('번들거리는 건 싫어').exclude.finishes, ['glossy']);
});

test('챗봇: 특수 상황 (면접·하객·내 결혼식·장례식) 과 상황별 요령', () => {
  assert.deepEqual(parseMessage('내 결혼식 본식 립').situations, ['내 결혼식']); // '결혼식 하객'은 지운다
  assert.deepEqual(parseMessage('결혼식 하객 립').situations, ['결혼식 하객']);
  assert.deepEqual(parseMessage('면접 립').situations, ['면접']);
  const funeral = answer({ message: '장례식 갈 때 바를 립' });
  assert.ok(funeral.products.length > 0 && funeral.products.every((p) => p.finish !== 'glossy' && ['nude', 'brown', 'rose'].includes(p.color_family)));
  assert.match(funeral.reply, /윤기 없이 얇게/);
  // 손님이 직접 말한 색은 상황 성향보다 우선이고, 엇갈리는 이유는 말하지 않는다
  const red = answer({ message: '면접인데 레드 추천해 줘' });
  assert.ok(red.products.every((p) => p.color_family === 'red'));
  assert.doesNotMatch(red.reply, /누드·로즈·코랄 계열이 단정/);
});

test('음성 보정: 말소리 별칭(영어·숫자 브랜드)과 띄어 적힌 단어 붙이기', () => {
  const aliases = [{ to: '롬앤', from: ['romand', '롬 앤'] }, { to: '3CE', from: ['쓰리씨이'] }, { to: '맥', from: ['mac'] }];
  assert.equal(applyAliases('Romand 글로시 추천', aliases).text, '롬앤 글로시 추천');
  assert.equal(applyAliases('쓰리씨이 매트', aliases).text, '3CE 매트');
  assert.equal(applyAliases('macaron 같은 색', aliases).text, 'macaron 같은 색'); // 단어 경계에서만 바꾼다
  assert.deepEqual(applyAliases('롬 앤 틴트', aliases).corrections, []); // 띄어쓰기만 다른 건 보정으로 알리지 않는다
  assert.equal(correctWords('패리 패라 핑크', ['페리페라']).text, '페리페라 핑크');
  assert.equal(correctWords('데이트 립', ['페리페라'], ['데이트']).text, '데이트 립'); // 아는 말끼리는 붙이지 않는다
  // 데이터에 있는 브랜드의 별칭만 쓴다
  assert.ok(chatAliases(['롬앤']).some((a) => a.to === '롬앤'));
  assert.ok(!chatAliases(['롬앤']).some((a) => a.to === '3CE'));
  assert.equal(normalizeForChat('warm tone 립 추천', []).text, '웜톤 립 추천');
  assert.equal(parseMessage(normalizeForChat('엠엘비비 느낌', []).text).families[0], 'nude');
});

test('영어 챗봇: 영어 문장을 한국어판과 같은 조건으로 알아듣는다', async () => {
  const { parseMessageEn, offTopicReplyEn, moodEn } = await import('../src/lib/chat-en.js');
  const brands = [{ ko: '롬앤', names: ['rom&nd', 'romand'] }];
  assert.deepEqual(parseMessageEn('A glossy coral under 20,000 won'), { finish: 'glossy', families: ['coral'], maxPrice: { value: 20000, strict: false } });
  assert.equal(parseMessageEn('romand tint', brands).brand, '롬앤');
  assert.deepEqual(parseMessageEn('no matte, something red').exclude.finishes, ['matte']);
  assert.deepEqual(parseMessageEn('I prefer velvet over glossy').finish, 'velvet');
  assert.deepEqual(parseMessageEn('Tell me more about the second one').ordinals, [1]);
  assert.deepEqual(parseMessageEn('Compare the first and second').ordinals, [0, 1]);
  assert.equal(parseMessageEn('I have a cool tone').tone, 'cool');
  assert.equal(parseMessageEn('back to school lips').tone, undefined); // 'cool' 이 'school' 안에서 걸리지 않는다
  assert.deepEqual(parseMessageEn('lips for a job interview', [], { situations: [{ label: '면접' }] }).situations, ['면접']);
  assert.deepEqual(parseMessageEn('around 30000 won'), { minPrice: { value: 24000, strict: false }, maxPrice: { value: 36000, strict: false } });
  assert.ok(offTopicReplyEn('Do you have sunscreen?'));
  assert.ok(offTopicReplyEn('what is your best seller'));
  assert.equal(offTopicReplyEn('a glossy pink'), null);
  assert.deepEqual(moodEn("I'm so sleepy").query, { concerns: ['혈색 있는'] });
  // 비교 요약은 언어를 받아 그 언어로 쓴다
  const two = allProducts().slice(0, 2);
  assert.match(compareSummary(two, 'en'), /cheapest|They are all/);
  assert.match(compareSummary(two), /저렴|모두/);
});
