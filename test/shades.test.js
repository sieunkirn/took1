// 실제 호수 데이터 (src/data/shades.oliveyoung.json → products.shades.json) 테스트.
// unit.test.js 는 가상 데이터로 고정하므로, 이 파일은 따로(올리브영 데이터로) 실행한다
delete process.env.TOOK_DATA;
const { test } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const { readFileSync } = await import('node:fs');
const repo = await import('../src/lib/repository.js');
const { recommendByColor } = await import('../src/lib/recommend.js');
const { loadAndBuild } = await import('../scripts/import-shades.js');

const shades = repo.allShades();
const ean13 = (b) => /^\d{13}$/.test(b) && (10 - ([...b.slice(0, 12)].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0) % 10)) % 10 === Number(b[12]);

test('호수 데이터: 원본을 고친 뒤 npm run import:shades 를 실행해 products.shades.json 이 원본과 같다', () => {
  const saved = JSON.parse(readFileSync(new URL('../src/data/products.shades.json', import.meta.url), 'utf8'));
  assert.deepEqual(saved, loadAndBuild());
});

test('호수 데이터: 고유 id·바코드, 올바른 EAN-13, 실제 제품에 묶임, 추정값 표시', () => {
  assert.ok(shades.length > 200);
  assert.equal(new Set(shades.map((s) => s.id)).size, shades.length);
  // 바코드는 한 상품 페이지 안에서는 겹치지 않는다. 같은 실물이 올리브영 상품 페이지 두 곳에서 팔리면 페이지끼리는 겹칠 수 있다
  for (const line of new Set(shades.map((s) => s.line))) {
    const codes = shades.filter((s) => s.line === line).flatMap((s) => s.barcodes);
    assert.equal(new Set(codes).size, codes.length, line);
  }
  const codes = shades.flatMap((s) => s.barcodes);
  const bad = codes.filter((c) => !ean13(c));
  assert.ok(bad.length <= codes.length * 0.01, '바코드 형식이 이상한 것: ' + bad.join(','));
  for (const s of shades) {
    const p = repo.findById(s.line);
    assert.ok(p && p.source === 'oliveyoung', s.id);
    assert.equal(p.shade_count, s.shade_count);
    assert.match(s.color_hex, /^#[0-9A-F]{6}$/);
    assert.equal(s.color_source, 'oliveyoung_color_chip');
    assert.equal(s.color_family_source, 'estimated_from_color');
    assert.ok(s.shade_color);
  }
});

test('바코드·ID 로 호수를 찾고, 같은 제품의 호수를 모은다', async () => {
  const fig = repo.findByBarcode('8800258080081'); // 롬앤 더 쥬시 래스팅 틴트 04 피그피그 (단품)
  assert.equal(fig.id, 'OY-A000000241210-04');
  assert.equal(fig.shade_name, '04 피그피그');
  assert.equal(repo.findByBarcode('8800344923582').id, fig.id); // 같은 호수의 기획 옵션 바코드
  assert.equal(repo.findById(fig.id), fig);
  assert.equal(repo.shadesOf(fig).length, fig.shade_count);
  assert.equal(repo.shadesOf(repo.findById('OY-A000000241210')).length, fig.shade_count);
  const { hiddenProducts } = await import('../src/lib/catalog.js');
  const none = hiddenProducts()[0]; // 호수 데이터가 없는 제품 (미러 화면 목록에서는 빠져 있다)
  assert.deepEqual(repo.shadesOf(none), []);
  assert.equal(none.shade_count, undefined);
});

test('미러 화면 목록: 호수가 없는 제품(호수 정보 준비 중·정보 없음)은 빠지고, ID 로는 찾을 수 있다', async () => {
  const { hiddenProducts } = await import('../src/lib/catalog.js');
  const list = repo.allProducts();
  assert.ok(list.length > 0 && list.every((p) => p.shade_count > 0));
  const hidden = hiddenProducts();
  assert.ok(hidden.length > 0 && hidden.every((p) => !p.shade_count));
  assert.equal(repo.findById(hidden[0].id), hidden[0]);
  assert.ok(!recommendByColor('#B3122E', { limit: 30 }).some((p) => hidden.some((h) => h.id === (p.line || p.id))));
});

test('호수 수집 정리: 옵션 이름 풀기와 색상 칩 사진 판정', async () => {
  const { parseOptionName, classify, buildProduct } = await import('../scripts/build-shades-source.js');
  assert.deepEqual(parseOptionName('[NEW] 45 밀크 베리'), { no: '45', name: '밀크 베리' });
  assert.deepEqual(parseOptionName('[두유][단품]41소이아몬드'), { no: '41', name: '소이아몬드' });
  assert.deepEqual(parseOptionName('01호 애플소르베'), { no: '01', name: '애플소르베' });
  assert.deepEqual(parseOptionName('[기획] 02 로 로즈+플럼핑 글로스'), { no: '02', name: '로 로즈' });
  assert.deepEqual(parseOptionName('[OY단독] 소프트 스포큰(웜 추천)'), { no: null, name: '소프트 스포큰' });
  assert.deepEqual(parseOptionName('#레이다운'), { no: null, name: '레이다운' });
  assert.deepEqual(parseOptionName('[위글위글/키캡키링] 1009 피치바나'), { no: '1009', name: '피치바나' });
  // 2026-11-17 실제 수집값: 질감 칩·흰 바탕 발색은 통과, 세트 사진은 검수, 병·포장 사진은 제외
  assert.equal(classify({ alt: '04 피그피그', hex: '#AB3B4C', white: 0, grey: 0.04 }), 'ok');
  assert.equal(classify({ alt: '[단품] 01 딸기기니', hex: '#FCB8D1', white: 0.491, grey: 0.032 }), 'ok');
  assert.equal(classify({ alt: '[+푸딩말랑이&스티커] 29 콩콩라떼', hex: '#D28C68', white: 0.54, grey: 0.048 }), 'review');
  assert.equal(classify({ alt: '[단품] 01 피치당', hex: '#E78C95', white: 0.728, grey: 0.264 }), 'bad');
  assert.equal(classify({ alt: '[기획] 02 로 로즈+플럼핑 글로스', hex: '#C7BCC0', white: 0.499, grey: 0.649 }), 'bad');
  assert.equal(classify({ alt: '38 클라우디베리', hex: '#9D9DA1', white: 0.01, grey: 0.95 }), 'review'); // 회색 호수일 수 있다
  assert.equal(classify({ alt: 'V1. 블러디 메리', hex: '#000000', white: 0.003, grey: 0.893 }), 'bad'); // 검은 병 사진
  const raw = { goodsNo: 'A000000000001', options: [
    { opt: '001', barcode: '1', alt: '[기획] 01 로즈+미니', img: 'item/a.jpg', hex: '#111111', white: 0.5, grey: 0.05 },
    { opt: '002', barcode: '2', alt: '01 로즈', img: 'item/b.jpg', hex: '#222222', white: 0.01, grey: 0.01 },
    { opt: '003', barcode: '3', alt: '[기획] 02 피치+미니', img: 'item/c.jpg', hex: '#333333', white: 0.5, grey: 0.05 },
  ] };
  const before = buildProduct(raw);
  assert.deepEqual(before.shades.map((s) => [s.no, s.hex, s.barcode, s.barcodes_more]), [['01', '#222222', '2', ['1']]]);
  assert.deepEqual(before.skipped, ['02 피치']);
  assert.equal(before.pending.length, 1);
  const after = buildProduct(raw, { 'A000000000001:003': 'ok' }); // 사람이 '넣기'를 누르면 들어간다
  assert.deepEqual(after.shades.map((s) => s.no), ['01', '02']);
  assert.equal(after.pending.length, 0);
  // 검수 화면에서 스포이드·직접 입력으로 색을 고쳐 넣으면 그 색을 쓴다
  const fixed = buildProduct(raw, { 'A000000000001:003': { value: 'ok', hex: '#c0ffee' } });
  assert.equal(fixed.shades.find((s) => s.no === '02').hex, '#C0FFEE');
  assert.equal(buildProduct(raw, { 'A000000000001:003': 'exclude' }).shades.length, 1);
  // 전체 검수: 자동 통과한 호수도 빼거나 색을 고칠 수 있고, 자동 제외된 사진도 사람이 넣을 수 있다
  const { inspectProduct } = await import('../scripts/build-shades-source.js');
  assert.deepEqual(inspectProduct(raw).map((g) => g.status), ['auto', 'pending']);
  assert.deepEqual(inspectProduct(raw, { 'A000000000001:002': 'exclude' }).map((g) => g.status), ['excluded', 'pending']);
  assert.equal(buildProduct(raw, { 'A000000000001:002': 'exclude' }).shades.length, 0);
  assert.equal(buildProduct(raw, { 'A000000000001:002': { value: 'ok', hex: '#ABCDEF' } }).shades[0].hex, '#ABCDEF');
  const badRaw = { goodsNo: 'A000000000002', options: [{ opt: '001', barcode: '9', alt: '01 블랙', img: 'item/d.jpg', hex: '#101010', white: 0, grey: 0.9 }] };
  assert.equal(inspectProduct(badRaw)[0].status, 'bad');
  assert.equal(buildProduct(badRaw, { 'A000000000002:001': { value: 'ok', hex: '#331122' } }).shades[0].hex, '#331122');
});

test('추천: 호수가 있는 제품은 가장 가까운 호수 하나로 나오고, 보여 준 제품은 다시 내지 않는다', () => {
  const fig = repo.findById('OY-A000000241210-04');
  const r = recommendByColor(fig.color_hex, { limit: 10 });
  assert.equal(r[0].id, fig.id);
  assert.equal(r[0].similarity, 100);
  assert.equal(new Set(r.map((p) => p.line || p.id)).size, r.length); // 제품당 한 줄
  const next = recommendByColor(fig.color_hex, { limit: 10, excludeIds: [fig.id] });
  assert.ok(!next.some((p) => p.line === fig.line || p.id === fig.line));
  const velvet = recommendByColor('#B3122E', { finish: 'velvet', limit: 30 });
  assert.ok(velvet.every((p) => p.finish === 'velvet'));
});

test('NFC 태그: 태그에 써 둔 바코드 번호로 호수까지 찾는다 (표·제품 ID 가 먼저, 없는 번호는 지어내지 않음)', async () => {
  const { findTagProduct, tagBarcode } = await import('../public/js/nfc.js');
  // 화면의 api 와 같은 주소를 같은 저장소 함수로 답한다 (public/js/api.js·server.js 와 같은 규칙)
  const api = async (url) => {
    let m = url.match(/^api\/products\/barcode\/(\d+)$/);
    if (m) { const p = repo.findByBarcode(m[1]); return { ok: true, body: { found: !!p, product: p } }; }
    m = url.match(/^api\/products\/([^/]+)$/);
    const p = m && repo.findById(decodeURIComponent(m[1]));
    return p ? { ok: true, body: { product: p } } : { ok: false, body: {} };
  };
  assert.equal(tagBarcode(' 8809625240172 '), '8809625240172');
  assert.equal(tagBarcode('04A1B2C3D4E5F6'), null); // 태그 번호(UID)는 바코드가 아니다
  assert.equal(tagBarcode('TEST0001'), null);

  const joy = await findTagProduct('8809625240172', api); // 롬앤 제로 벨벳 틴트 02 조이풀 (단품)
  assert.equal(joy.shade_no, '02');
  assert.equal(joy.name, '제로 벨벳 틴트');
  const set = await findTagProduct('8800258089114', api); // 롬앤 블러 퍼지 틴트 02 로지엔탈 (기획·세트 바코드)
  assert.equal(set.shade_color, '로지엔탈');
  assert.equal(await findTagProduct('8800000000000', api), null); // 등록되지 않은 번호
  assert.equal(await findTagProduct('04A1B2C3D4E5F6', api), null); // 표에 없는 태그 번호
  assert.equal((await findTagProduct('A000000241210', api)).id, 'OY-A000000241210'); // 제품 ID 는 그대로
  assert.equal((await findTagProduct('TEST0001', api)).id, 'OY-A000000241210'); // 표가 먼저
});

test('NFC 테스트 카드: 리더기 번호(띄어쓰기 포함)로 찾고, 블루투스 입력에서 글자가 몇 개 빠져도 같은 카드로 본다', async () => {
  const { matchTag, resolveTag } = await import('../public/js/nfc.js');
  assert.equal(resolveTag('04 37 9D 1A 32 24 90'), 'OY-A000001001860'); // 2번 그대로
  assert.equal(resolveTag('04 37 9D 32 24 90'), 'OY-A000001001860'); // 2번에서 한 바이트 빠짐
  assert.equal(resolveTag('04 08 A 32 24 91'), 'OY-A000000241210'); // 1번 메모 그대로
  assert.equal(resolveTag('04 08 AC 5F 32 24 91'), 'OY-A000000241210'); // 1번 온전한 14글자(가정)
  assert.equal(resolveTag('04 BC E5 1A 32 24 90'), 'OY-A000000205485'); // 3번 온전한 14글자(가정)
  assert.equal(matchTag('04 A1 B2 C3 D4 E5 F6'), null); // 다른 태그
  assert.equal(matchTag('322490'), null); // 너무 짧으면 맞추지 않는다
});

test('실데이터만 보기: 켜면 시연용 제품·호수가 목록·찾기·바코드·이름 부르기에서 빠지고, 끄면 돌아온다', async () => {
  const catalog = await import('../src/lib/catalog.js');
  const { answer } = await import('../src/lib/chat.js');
  const demo = repo.allDemoProducts()[0];
  assert.ok(demo && catalog.isDemo(demo), '시연용 제품이 있어야 한다');
  assert.equal(catalog.isDemo(repo.allProducts()[0]), false, '올리브영 제품은 실데이터');
  let on = false;
  catalog.setRealOnlyGetter(() => on);
  try {
    assert.equal(repo.findById(demo.id)?.id, demo.id);
    on = true;
    assert.equal(repo.allDemoProducts().length, 0);
    assert.equal(repo.findById(demo.id), null);
    assert.equal(repo.findByBarcode(demo.barcode), null);
    assert.deepEqual(repo.shadesOf(demo), []);
    assert.ok(repo.allProducts().length > 0 && repo.allProducts().every((p) => !catalog.isDemo(p)));
    assert.ok(recommendByColor('#C8102E', { limit: 30 }).every((p) => !catalog.isDemo(p)));
    // 시연용 제품 이름을 불러도 그 제품을 지어내지 않는다
    const r = answer({ message: `${demo.brand} ${demo.name} 보여줘` });
    assert.ok((r.products || []).every((p) => !catalog.isDemo(p)), JSON.stringify((r.products || []).map((p) => p.id)));
    on = false;
    assert.equal(repo.findById(demo.id)?.id, demo.id);
  } finally {
    catalog.setRealOnlyGetter(null);
  }
});

test('추천: 제형 여러 개·가격 상한 (2026-11-21 거울 퀵 추천)', () => {
  const both = recommendByColor('#B3122E', { finish: 'matte,velvet', limit: 30 });
  assert.ok(both.length > 0 && both.every((p) => p.finish === 'matte' || p.finish === 'velvet'));
  assert.ok(both.some((p) => p.finish === 'velvet') && both.some((p) => p.finish === 'matte'));
  const cheap = recommendByColor('#B3122E', { maxPrice: 12000, limit: 30 });
  assert.ok(cheap.length > 0 && cheap.every((p) => p.price > 0 && p.price <= 12000));
});

test('가격 범위: 추천 목록 제품의 최저·최고·가운데값 (2026-11-21 가격 드래그 바)', async () => {
  const { priceRange } = await import('../src/lib/recommend.js');
  const r = priceRange();
  const prices = repo.allProducts().map((p) => Number(p.price)).filter((v) => v > 0);
  assert.equal(r.min, Math.min(...prices));
  assert.equal(r.max, Math.max(...prices));
  assert.ok(r.min <= r.median && r.median <= r.max && r.count === prices.length);
  assert.deepEqual(priceRange([{ price: 0 }, { price: null }]), { min: 0, max: 0, median: 0, count: 0 });
});
