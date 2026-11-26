// 실제 호수 데이터 (src/data/shades.oliveyoung.json → products.shades.json) 테스트.
// unit.test.js 는 가상 데이터로 고정하므로, 이 파일은 따로(올리브영 데이터로) 실행한다
delete process.env.TOOK_DATA;
const { test } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const { readFileSync } = await import('node:fs');
const repo = await import('../src/lib/repository.js');
const { recommendByColor, recommendByTexture } = await import('../src/lib/recommend.js');
const { loadAndBuild } = await import('../scripts/import-shades.js');

const shades = repo.allShades().filter((s) => s.source === 'oliveyoung'); // 실제 호수만
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

test('실데이터만 보기: 켜면 시연용 제품·호수가 목록·찾기·바코드에서 빠지고, 끄면 돌아온다', async () => {
  const catalog = await import('../src/lib/catalog.js');
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
    on = false;
    assert.equal(repo.findById(demo.id)?.id, demo.id);
  } finally {
    catalog.setRealOnlyGetter(null);
  }
});

test('추천: 제형 여러 개·가격 상한', () => {
  const both = recommendByColor('#B3122E', { finish: 'matte,velvet', limit: 30 });
  assert.ok(both.length > 0 && both.every((p) => p.finish === 'matte' || p.finish === 'velvet'));
  assert.ok(both.some((p) => p.finish === 'velvet') && both.some((p) => p.finish === 'matte'));
  const cheap = recommendByColor('#B3122E', { maxPrice: 12000, limit: 30 });
  assert.ok(cheap.length > 0 && cheap.every((p) => p.price > 0 && p.price <= 12000));
});


test('질감 추천: 같은 색이라도 질감마다 다른 제품, 고른 질감 먼저·모자라면 다른 질감으로 채움', () => {
  const hex = '#C8102E';
  const ids = (t) => recommendByTexture(hex, t, { limit: 6 }).products.map((p) => p.id).join(' ');
  assert.notEqual(ids('matte'), ids('glossy'));
  assert.notEqual(ids('glossy'), ids('sheer'));
  const matte = recommendByTexture(hex, 'matte', { limit: 6 });
  assert.equal(matte.products.length, 6);
  assert.ok(matte.products.every((p) => p.texture_match && ['matte', 'velvet'].includes(p.finish)), 'matte 는 벨벳 포함');
  // 실데이터가 적은 질감(새틴·시어·쉬머)은 실제 제품에 시연용 질감을 배정해(finish-demo.json) 6개 모두 그 질감
  for (const t of ['satin', 'sheer', 'shimmer']) {
    const r = recommendByTexture(hex, t, { limit: 6 });
    assert.equal(r.matched, 6, t);
    assert.ok(r.products.every((p) => p.finish === t), t);
    assert.equal(new Set(r.products.map((p) => p.line || p.id)).size, 6, '같은 제품이 두 번 나오지 않는다');
  }
  // 고른 질감 제품이 모자라면 다른 질감으로 채운다 (가상의 제품 목록으로)
  const oneSatin = repo.allProducts().find((p) => p.finish === 'satin');
  const few = repo.allProducts().filter((p) => (p.finish !== 'satin' && !p.finish_also?.includes('satin')) || p === oneSatin); // also 로 새틴에 나오는 제품도 뺀다
  const fill = recommendByTexture(hex, 'satin', { limit: 6, products: few });
  assert.equal(fill.matched, 1);
  assert.equal(fill.products.length, 6);
  assert.ok(fill.products.slice(1).every((p) => !p.texture_match));
  assert.ok(repo.allProducts().filter((p) => p.finish_source === 'guess').length > 0, '추정 질감(finish-guess.json)이 데이터에 들어가 있다');
});

test('질감 추천: 다이얼 28색 × 질감 5개 = 140 조합의 추천 목록이 모두 다르고, 모두 사진 있는 실제 제품이다', () => {
  const DIAL = ['#EB8283', '#E47270', '#E65157', '#DA3B52', '#BA2D3E', '#A52837', '#8A2D37', '#EBA1B4', '#DFA3A7', '#E77492', '#D56287', '#CA3D71', '#AA3D55', '#95314B',
    '#EBA798', '#E2825C', '#E07667', '#E56A3B', '#D94D3A', '#B8483F', '#9A4F38', '#E9B1AE', '#DA9E95', '#DF918D', '#D6867E', '#C67867', '#B66A55', '#A0554A'];
  const lists = new Set();
  for (const hex of DIAL) for (const t of ['matte', 'glossy', 'satin', 'sheer', 'shimmer']) {
    const r = recommendByTexture(hex, t, { limit: 6 });
    assert.equal(r.matched, 6, hex + ' ' + t + ' 는 그 질감 제품 6개');
    // 2026-11-26: 가짜(사진 없는) 질감 제품은 모두 뺐다. 새틴·시어·쉬머는 질감이 애매한 실제 제품에 시연용 질감을 배정(finish-demo.json)
    assert.ok(r.products.every((p) => p.source === 'oliveyoung' && p.image_url), hex + ' ' + t + ': 실제 제품·사진 있음');
    lists.add(t + ':' + r.products.map((p) => p.id).join(','));
  }
  assert.equal(lists.size, 140);
  assert.equal(repo.allProducts().filter((p) => p.id.startsWith('TX-')).length, 0, '가짜 질감 제품 없음');
  const assigned = repo.allProducts().filter((p) => p.finish_source === 'demo');
  assert.ok(['satin', 'sheer', 'shimmer'].every((t) => assigned.some((p) => p.finish === t)), '새틴·시어·쉬머 시연용 배정이 데이터에 들어가 있다');
});

test('질감 추천 + 농도 (2026-11-26): 같은 색·같은 질감이어도 농도가 바뀌면 추천 목록이 바뀐다', async () => {
  const { lookHex } = await import('../src/lib/color.js');
  for (const [hex, t] of [['#DA3B52', 'matte'], ['#EBA1B4', 'glossy'], ['#A0554A', 'sheer'], ['#CA3D71', 'shimmer'], ['#E2825C', 'satin']]) {
    const lists = [20, 50, 80, 100].map((i) => recommendByTexture(lookHex(hex, i), t, { limit: 6 }).products.map((p) => p.id).join(','));
    // 새틴·시어·쉬머는 제품이 12~17개뿐이라 이웃한 농도(80·100)끼리 같은 목록이 나올 때가 있다 → 4단계 중 3개 이상 다르면 된다
    assert.ok(new Set(lists).size >= 3, hex + ' ' + t + ': 농도 20·50·80·100 목록이 3가지 이상');
    assert.notEqual(lists[0], lists[2], hex + ' ' + t + ': 농도 20 과 80 은 다르다');
  }
});

test('질감 추천 빈칸 없음 (2026-11-26 "가짜여도 좋으니까 빈칸이 있어선 안돼"): 다이얼 28색 × 질감 5 × 농도 11단계 = 1,540칸 모두 질감 맞는 비슷한 색(색차 5 이하) 제품이 있다', async () => {
  const { lookHex } = await import('../src/lib/color.js');
  const DIAL = ['#EB8283', '#E47270', '#E65157', '#DA3B52', '#BA2D3E', '#A52837', '#8A2D37', '#EBA1B4', '#DFA3A7', '#E77492', '#D56287', '#CA3D71', '#AA3D55', '#95314B',
    '#EBA798', '#E2825C', '#E07667', '#E56A3B', '#D94D3A', '#B8483F', '#9A4F38', '#E9B1AE', '#DA9E95', '#DF918D', '#D6867E', '#C67867', '#B66A55', '#A0554A'];
  const empty = [];
  for (const hex of DIAL) for (const t of ['matte', 'glossy', 'satin', 'sheer', 'shimmer']) for (let d = 0; d <= 100; d += 10) {
    const best = recommendByTexture(lookHex(hex, d), t, { limit: 6 }).products.find((p) => p.texture_match);
    if (!best || best.delta_e > 5) empty.push(`${hex} ${t} ${d}% (${best?.delta_e})`);
  }
  assert.deepEqual(empty, [], '빈칸이 생기면 src/data/finish-demo.json 에 also 를 더한다');
  // also(시연용으로 더 나오는 질감) 제품: 원래 질감은 그대로, 그 질감 목록에서는 그 질감으로 보인다 (발라 보면 거울도 그 질감)
  const p = repo.allProducts().find((x) => x.finish_also?.includes('shimmer') && x.finish === 'glossy');
  assert.ok(p, 'finish-demo.json 의 also 가 데이터에 들어가 있다');
  const s = repo.shadesOf(p)[0];
  const got = recommendByTexture(s.color_hex, 'shimmer', { limit: 6 }).products.find((x) => (x.line || x.id) === p.id);
  assert.ok(got && got.texture_match, '쉬머 목록에 나온다');
  assert.equal(got.finish, 'shimmer');
  assert.equal(got.finish_source, 'demo');
  assert.ok(recommendByTexture(s.color_hex, 'glossy', { limit: 6 }).products.some((x) => (x.line || x.id) === p.id && x.finish === 'glossy'), '원래 질감(글로시) 목록에도 그대로 나온다');
});
