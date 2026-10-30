// 전체 흐름 통합 테스트 (Playwright + Chromium 가짜 카메라)
// 실행: npm run e2e          서버(API) 모드
//       npm run e2e:static   정적 빌드(dist/static, 서버 API 없음) 모드
// SHOTS=<dir> 를 지정하면 스크린샷 저장
import './use-virtual-data.js'; // 가상 제품 데이터(바코드 있음)로 고정 (다른 import 보다 먼저)
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.js';
import { allProducts } from '../src/lib/repository.js';
import { recommendByColor } from '../src/lib/recommend.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const STATIC = process.env.MODE === 'static';

// 정적 모드: dist/static 을 API 없이 제공. index.html 은 Artifact 호스트처럼 문서 골격으로 감싼다.
function staticServer() {
  const dir = fileURLToPath(new URL('../dist/static/', import.meta.url));
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.wasm': 'application/wasm' };
  return createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/index.html';
    try {
      let body = await readFile(join(dir, path));
      if (path === '/index.html') {
        body = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + body + '</body></html>';
      }
      res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
}

const server = (STATIC ? staticServer() : createApp()).listen(0);
await new Promise((r) => server.once('listening', r));
const BASE = `http://localhost:${server.address().port}`;
const SHOTS = process.env.SHOTS;
const results = [];
const apiRequests = [];
// 페이지 이동 대기: 서버 모드는 쿼리 포함, 정적 모드는 쿼리 없이 이동한다
const at = (file) => new RegExp('/' + file.replace('.', '\\.') + '(\\?.*)?$');
const refColorHas = (pg, hex) => pg.waitForFunction((h) => document.getElementById('ref-color').textContent.includes(h), hex);
const consoleErrors = [];

async function step(name, fn) {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name, e.message.split('\n')[0]]);
  }
}

function watch(page, label) {
  page.on('request', (r) => { if (r.url().includes('/api/')) apiRequests.push(r.url()); });
  page.on('console', (m) => {
    // MediaPipe WASM 은 정보성 로그(INFO: ...)를 console.error 로 출력하므로 제외한다
    if (m.type() === 'error' && !m.text().startsWith('INFO:')) consoleErrors.push(`${label}: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`${label}: ${e.message}`));
}

// 화면의 모든 요소 계산 스타일에서 유채색(r,g,b 가 서로 다른 값)이 있는지 검사
async function assertAchromatic(page) {
  const bad = await page.evaluate(() => {
    const props = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor',
      'borderLeftColor', 'outlineColor', 'accentColor', 'caretColor', 'textDecorationColor', 'fill', 'stroke'];
    const out = [];
    const chroma = (v) => {
      const m = v && v.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
      if (!m) return false;
      if (m[4] !== undefined && Number(m[4]) === 0) return false;
      return Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) > 2;
    };
    // 립 컬러 시연 영역(입술 매핑 캔버스·프리셋 색상)은 실제 컬러가 기본이라 검사에서 제외한다
    const colorDemo = (el) => el.closest('#swatches, #map-canvas, .stage, .color-dot');
    for (const el of document.querySelectorAll('*')) {
      if (colorDemo(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      for (const p of props) if (chroma(cs[p])) out.push(`${el.tagName}#${el.id}.${el.className} ${p}=${cs[p]}`);
      if (cs.boxShadow !== 'none') out.push(`${el.tagName} box-shadow`);
      if (cs.backgroundImage !== 'none') out.push(`${el.tagName} background-image`);
      if (parseFloat(cs.borderTopLeftRadius) > 0) out.push(`${el.tagName}#${el.id} border-radius`);
    }
    // 캔버스 픽셀도 무채색인지 확인
    for (const c of document.querySelectorAll('canvas')) {
      if (!c.width || c.classList.contains('hidden') || colorDemo(c)) continue;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4 * 37) {
        if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 3) { out.push('canvas#' + c.id + ' 유채색 픽셀'); break; }
      }
    }
    return out.slice(0, 5);
  });
  assert.deepEqual(bad, [], '유채색/장식 발견: ' + bad.join(' | '));
}

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.grantPermissions(['camera'], { origin: BASE });
const page = await ctx.newPage();
watch(page, 'main');
const shot = (n) => SHOTS && page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });

await step('홈: 서비스명과 2개 진입 카드 → 페이지 이동', async () => {
  await page.goto(BASE + '/');
  assert.equal(await page.locator('main h1').textContent(), 'took(툭)');
  await assertAchromatic(page);
  await shot('01-home');
  assert.equal(await page.locator('#go-barcode').count(), 0); // 바코드 검색 카드는 챗봇으로 합쳐서 뺐다
  for (const [id, path] of [['#go-lip', '/lip-together.html'], ['#go-chat', '/chat.html']]) {
    await page.goto(BASE + '/');
    await page.click(id);
    await page.waitForURL(at(path.slice(1)));
  }
});

// ---------- 흐름 A ----------
let chosenHex;
await step('흐름 A: 카메라 실행 → 입술 추적 모듈 로드 → 매핑 캔버스 무채색', async () => {
  await page.goto(BASE + '/lip-test.html');
  await page.click('#cam-start');
  await page.waitForFunction(() => document.getElementById('cam-status').textContent.includes('카메라 실행 중'));
  await page.waitForFunction(() => !document.getElementById('track-status').textContent.includes('로딩'), null, { timeout: 30000 });
  const status = await page.textContent('#track-status');
  // 가짜 카메라 영상에는 얼굴이 없으므로 '감지되지 않음' 이 정상
  assert.match(status, /감지되지 않았습니다|입술 추적 중/, status);
  await page.waitForTimeout(500);
  await assertAchromatic(page);
  await shot('02-lip-camera');
});

await step('흐름 A: 슬라이더 조작 → 색상값 변경, 초기화 동작', async () => {
  const before = await page.textContent('#ci-hex');
  const set = (id, v) => page.$eval(id, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  await set('#hue', 20);
  await set('#sat', 80);
  await set('#lig', 55);
  chosenHex = await page.textContent('#ci-hex');
  assert.notEqual(chosenHex, before);
  assert.equal(chosenHex, '#E86E30'); // HSL(20,80,55)
  assert.equal(await page.textContent('#hue-out'), '20°');
  await page.click('#reset');
  assert.equal(await page.textContent('#ci-hex'), before);
  await set('#hue', 20); await set('#sat', 80); await set('#lig', 55);
});

await step('흐름 A: 추천 버튼 → 선택 색상 전달 → 유사도 순 추천', async () => {
  await page.click('#recommend');
  await page.waitForURL(at('recommend.html'));
  await refColorHas(page, chosenHex);
  await page.waitForSelector('#rec-list .card');
  assert.match(await page.textContent('#ref-color'), new RegExp(chosenHex));
  // 카드에는 브랜드·제품명·색상값·제형·가격·올리브영 링크만 보인다. 유사도 순서는 제품 ID 순서로 확인한다
  const ids = await page.$$eval('#rec-list .card', (cs) => cs.map((c) => c.dataset.productId));
  assert.equal(ids.length, 10);
  const labels = await page.$$eval('#rec-list .card:first-child dt', (ds) => ds.map((d) => d.textContent));
  assert.deepEqual(labels, ['브랜드', '제품명', '색상값', '제형', '가격']);
  assert.deepEqual(ids, recommendByColor(chosenHex, { limit: 10 }).map((p) => p.id));
  await page.selectOption('#finish-filter', 'matte');
  await page.waitForFunction(() => [...document.querySelectorAll('#rec-list .card')].every((c) => c.textContent.includes('제형매트')));
  await page.selectOption('#finish-filter', '');
  await page.waitForFunction(() => document.querySelectorAll('#rec-list .card').length === 10);
  await assertAchromatic(page);
  await shot('03-recommend');
});

await step('흐름 A: 제품 상세 → 이전 화면 → 다시 조색하기(색상 유지)', async () => {
  // 카드에는 상세 보기 링크가 없어 주소로 들어간다 (from=recommend 로 '이전 화면'이 추천 화면을 가리킨다)
  const firstId = await page.$eval('#rec-list .card', (c) => c.dataset.productId);
  await page.goto(BASE + `/product.html?id=${firstId}&from=recommend`);
  await page.waitForURL(at('product.html'));
  await page.waitForSelector('#product-info table');
  const p = allProducts().find((x) => x.id === firstId);
  assert.ok((await page.textContent('#product-info')).includes(p.barcode));
  await assertAchromatic(page);
  await shot('04-product');
  await page.click('#back');
  await page.waitForURL(at('recommend.html'));
  await page.waitForSelector('#rec-list .card');
  assert.match(await page.textContent('#ref-color'), new RegExp(chosenHex));
  await page.click('#recolor');
  await page.waitForURL(at('lip-test.html'));
  assert.equal(await page.textContent('#ci-hex'), chosenHex);
  assert.equal(await page.inputValue('#hue'), '20');
});

await step('샘플 그림 3종: 실제 입술 추적 → 입술색 추출 → 추천 전달', async () => {
  await page.goto(BASE + '/lip-test.html');
  await page.waitForFunction(() => !document.getElementById('sample-start').disabled);
  const ids = await page.$$eval('#sample-select option', (os) => os.map((o) => o.value));
  assert.equal(ids.length, 3);
  const extracted = [];
  for (const id of ids) {
    await page.selectOption('#sample-select', id);
    await page.click('#sample-start');
    await page.waitForFunction((id) => document.getElementById('photo').src.includes(id) && document.getElementById('track-status').textContent.includes('입술 추적 중'), id, { timeout: 30000 });
    await page.click('#extract');
    assert.match(await page.textContent('#ci-source'), /샘플 그림 입술 영역 평균색\(#[0-9A-F]{6}\) 추출/);
    extracted.push(await page.textContent('#ci-hex'));
    await assertAchromatic(page);
  }
  assert.equal(new Set(extracted).size, 3, '샘플마다 다른 입술색이 추출되어야 함: ' + extracted);
  await shot('02b-lip-sample');
  const hex = extracted.at(-1);
  await page.click('#recommend');
  await page.waitForURL(at('recommend.html'));
  await refColorHas(page, hex);
  await page.goto(BASE + '/lip-test.html');
});

// ---------- 카메라 오류 / 대체 체험 모드 ----------
await step('카메라 권한 거부 → 안내 메시지 → 샘플 그림 체험 → 입술색 추출', async () => {
  const p2 = await ctx.newPage();
  watch(p2, 'denied');
  await p2.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await p2.goto(BASE + '/lip-test.html');
  await p2.click('#cam-start');
  await p2.waitForSelector('#cam-error:not(.hidden)');
  assert.match(await p2.textContent('#cam-error'), /권한이 거부/);
  if (SHOTS) await p2.screenshot({ path: `${SHOTS}/05-camera-denied.png`, fullPage: true });
  await p2.click('#cam-error button');
  await p2.waitForFunction(() => document.getElementById('track-status').textContent.includes('입술 추적 중'), null, { timeout: 30000 });
  assert.match(await p2.textContent('#cam-status'), /체험 모드: 샘플 그림 1/);
  assert.ok(await p2.isHidden('#cam-error'));
  await p2.click('#extract');
  assert.match(await p2.textContent('#ci-source'), /샘플 그림 입술 영역 평균색/);
  await assertAchromatic(p2);
  if (SHOTS) await p2.screenshot({ path: `${SHOTS}/06-demo-mode.png`, fullPage: true });
  await p2.close();
});

await step('카메라 장치 없음 → 안내 메시지', async () => {
  const p3 = await ctx.newPage();
  watch(p3, 'nodevice');
  await p3.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('none', 'NotFoundError'));
  });
  await p3.goto(BASE + '/lip-test.html');
  await p3.click('#cam-start');
  await p3.waitForSelector('#cam-error:not(.hidden)');
  assert.match(await p3.textContent('#cam-error'), /카메라 장치를 찾지 못했습니다/);
  await p3.close();
});

// ---------- 흐름 B ----------
const target = allProducts().find((p) => p.id === 'P014');
await step('흐름 B: 스캐너식 입력(숫자 + Enter) → DB 제품과 일치', async () => {
  await page.goto(BASE + '/barcode.html');
  await page.evaluate(() => sessionStorage.removeItem('took.barcodeLast'));
  await page.reload();
  // 스캐너는 키 입력을 빠르게 보낸 뒤 Enter 를 보낸다
  await page.locator('#barcode-input').pressSequentially(target.barcode, { delay: 5 });
  await page.keyboard.press('Enter');
  await page.waitForSelector('#barcode-detail table');
  const text = await page.textContent('#barcode-detail');
  for (const v of [target.barcode, target.brand, target.name, target.shade_name, target.color_hex]) assert.ok(text.includes(v), v);
  assert.equal(await page.inputValue('#barcode-input'), '');
  assert.ok(await page.$eval('#barcode-input', (el) => el === document.activeElement));
  await assertAchromatic(page);
  await shot('07-barcode');
});

await step('흐름 B: 검색 버튼 + 미등록 바코드 → 결과 없음 메시지', async () => {
  await page.fill('#barcode-input', '8800000000000');
  await page.click('#barcode-search');
  await page.waitForFunction(() => document.getElementById('barcode-result').textContent.includes('검색 결과가 없습니다'));
  assert.ok(await page.isDisabled('#go-chat'));
  await page.fill('#barcode-input', 'abc');
  await page.click('#barcode-search');
  await page.waitForFunction(() => document.getElementById('barcode-result').textContent.includes('숫자'));
});

await step('흐름 B: 시연용 목록 클릭 검색 → 챗봇 이동 → 기준 제품 표시', async () => {
  await page.click(`#demo-barcodes a[data-barcode="${target.barcode}"]`);
  await page.waitForFunction(() => !document.getElementById('go-chat').disabled);
  await page.click('#go-chat');
  await page.waitForURL(at('chat.html'));
  await page.waitForSelector('#base-chip:not(.hidden)');
  assert.ok((await page.textContent('#base-chip')).includes(target.shade_name));
  assert.ok((await page.textContent('#chat-log')).includes('기준으로 질문에 답할게요'));
});

await step('흐름 B: 빠른 질문 4종 → 기준 제품 조건 반영 (챗봇 테스트 화면)', async () => {
  await page.goto(BASE + '/chat-test.html'); // 기준 제품은 세션에 저장되어 테스트 화면에도 이어진다
  await page.waitForSelector('#base-info dl');
  await page.click('#chat-reset');
  const run = async (label) => {
    const n = await page.locator('#chat-log .bubble.bot').count();
    await page.click(`#quick button:text-is("${label}")`);
    await page.waitForFunction((n) => document.querySelectorAll('#chat-log .bubble.bot').length === n + 1, n);
    return page.$$eval('#chat-results .card', (cs) => cs.map((c) => ({ id: c.dataset.productId, text: c.textContent })));
  };
  const glossy = await run('더 글로시한 제품 추천');
  assert.ok(glossy.length > 0 && glossy.every((c) => c.text.includes('제형글로시') && c.id !== target.id));
  const cheaper = await run('더 저렴한 제품 추천');
  assert.ok(cheaper.length > 0);
  for (const c of cheaper) assert.ok(allProducts().find((p) => p.id === c.id).price < target.price);
  const similar = await run('비슷한 색상 찾기');
  assert.deepEqual(similar.map((c) => c.id), recommendByColor(target.color_hex, { limit: 5, excludeIds: [target.id] }).map((p) => p.id));
  const matte = await run('매트한 제품 찾기');
  assert.ok(matte.length > 0 && matte.every((c) => c.text.includes('제형매트')));
  await assertAchromatic(page);
  await shot('08-chat-base');
});

// ---------- 흐름 C ----------
await step('흐름 C: 챗봇 직접 질문 → 추천 → 상세 → 챗봇으로 돌아와 대화 유지', async () => {
  await page.goto(BASE + '/');
  await page.evaluate(() => sessionStorage.clear());
  await page.click('#go-chat');
  await page.waitForURL(at('chat.html'));
  // 기준 색상 없음 → 비슷한 색상은 결과를 꾸며내지 않음
  await page.fill('#chat-input', '비슷한 색상 찾아 줘');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('chat-log').textContent.includes('기준 색상이 없어'));
  assert.equal(await page.locator('#rec-list .card').count(), 0);
  await page.fill('#chat-input', '2만원 이하 레드 추천해 줘');
  await page.click('#chat-send');
  // 넓은 화면: 추천 제품은 오른쪽 패널에 고정된다
  await page.waitForSelector('#rec-list .card');
  const ids = await page.$$eval('#rec-list .card', (cs) => cs.map((c) => c.dataset.productId));
  for (const id of ids) {
    const p = allProducts().find((x) => x.id === id);
    assert.ok(p.color_family === 'red' && p.price <= 20000, id);
  }
  assert.equal(ids.length, allProducts().filter((p) => p.color_family === 'red' && p.price <= 20000).length);
  // 대화창 제품 카드에서 기준 제품 설정 → 상세 보기
  await page.click('#rec-list .card >> nth=0 >> text=기준 제품으로');
  await page.waitForSelector('#base-chip:not(.hidden)');
  await page.click('#rec-list .card >> nth=0 >> text=상세 보기');
  await page.waitForURL(at('product.html'));
  await page.waitForSelector('#product-info table');
  await page.click('#back');
  await page.waitForURL(at('chat.html'));
  await page.waitForFunction(() => document.getElementById('chat-log').textContent.includes('2만원 이하 레드')
    && document.querySelectorAll('#rec-list .card').length > 0);
  await shot('09-chat-direct');
});

await step('챗봇: AI 미연결 사실을 표시', async () => {
  assert.match(await page.textContent('main'), /외부 AI 미연결/);
  await page.goto(BASE + '/chat-test.html');
  assert.match(await page.textContent('main'), /외부 AI API 는 연결되어 있지 않습니다/);
});

// iPad 가로 화면 (Safari 주소창·탭바를 뺀 실제 표시 영역 기준 높이 포함)
const IPAD_LANDSCAPE = [
  { name: 'iPad 10세대/Air 가로', width: 1180, height: 820 },
  { name: 'iPad 10세대 Safari 표시영역', width: 1180, height: 740 },
  { name: 'iPad Pro 11 가로', width: 1194, height: 834 },
  { name: 'iPad Pro 12.9 가로', width: 1366, height: 1024 },
  { name: 'iPad mini 가로', width: 1133, height: 744 },
  { name: 'iPad 9세대 Safari 표시영역', width: 1080, height: 740 },
  { name: 'iPad 구형 가로', width: 1024, height: 768 },
];
await step('iPad 가로: 립 매핑/챗봇/바코드가 스크롤 없이 한 화면, 주요 요소가 화면 안에 표시', async () => {
  const pg = await ctx.newPage();
  watch(pg, 'ipad');
  for (const vp of IPAD_LANDSCAPE) {
    await pg.setViewportSize({ width: vp.width, height: vp.height });
    for (const [path, ids] of [
      ['/lip.html', ['.lip-user .stage', '#match', '#swatches', '#textures', '#intensity', '#recommend']],
      ['/lip-together.html', ['.lip-user .stage', '#match', '#swatches', '#textures', '#intensity', '#recommend']],
      ['/lip-test.html', ['#cam-start', '#sample-start', '#photo-input', '#map-canvas', '#extract', '#hue', '#lig', '#reset', '#ci-source', '#recommend', '#home']],
      ['/chat.html', ['#chat-log', '#voice', '#chat-input', '#chat-send', '#tts', '#chat-reset', '#rec-panel']],
      ['/chat-test.html', ['#chat-log', '#chat-input', '#chat-send', '#quick', '#base-info', '#chat-results']],
      ['/barcode.html', ['#barcode-input', '#barcode-search', '#barcode-result', '#go-chat', '#demo-barcodes']],
    ]) {
      await pg.goto(BASE + path);
      await pg.waitForLoadState('networkidle');
      const over = await pg.evaluate(() => ({
        x: document.documentElement.scrollWidth - innerWidth,
        y: document.documentElement.scrollHeight - innerHeight,
      }));
      assert.ok(over.x <= 0 && over.y <= 0, `${vp.name} ${path} 넘침 x=${over.x} y=${over.y}`);
      for (const id of ids) {
        const box = await pg.locator(id).first().boundingBox();
        assert.ok(box && box.width > 0 && box.y >= 0 && box.y + Math.min(box.height, 44) <= vp.height && box.x + box.width <= vp.width,
          `${vp.name} ${path} ${id} 화면 밖: ${JSON.stringify(box)}`);
      }
      await assertAchromatic(pg);
    }
    await pg.goto(BASE + '/lip-test.html');
    const map = await pg.locator('#map-canvas').boundingBox();
    assert.ok(map.width >= 280 && map.height >= 200, `${vp.name} 매핑 영역이 작음 ${map.width}x${map.height}`);
  }
  await pg.setViewportSize({ width: 1180, height: 820 });
  await pg.goto(BASE + '/lip-test.html');
  await pg.waitForFunction(() => !document.getElementById('sample-start').disabled);
  await pg.click('#sample-start');
  await pg.waitForFunction(() => document.getElementById('track-status').textContent.includes('입술 추적 중'), null, { timeout: 30000 });
  await pg.click('#extract');
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/ipad-1-lip.png` });
  await pg.click('#recommend');
  await pg.waitForSelector('#rec-list .card');
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/ipad-2-recommend.png` });
  await pg.goto(BASE + '/barcode.html');
  await pg.fill('#barcode-input', '8809300000145');
  await pg.keyboard.press('Enter');
  await pg.waitForSelector('#barcode-detail table');
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/ipad-3-barcode.png` });
  await pg.click('#go-chat');
  await pg.waitForSelector('#base-chip:not(.hidden)');
  await pg.click('#chat-log .suggest button:text-is("더 글로시한 제품 추천해 줘")');
  await pg.waitForSelector('#rec-list .card');
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/ipad-4-chat.png` });
  await pg.close();
});

await step('그 밖의 화면 크기(PC·세로 태블릿): 가로 스크롤 없음', async () => {
  for (const vp of [{ width: 820, height: 1180 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(vp);
    for (const path of ['/', '/lip.html', '/lip-together.html', '/lip-test.html', '/recommend.html?hex=%23B3122E', '/barcode.html', '/chat.html', '/chat-test.html', '/product.html?id=P001']) {
      await page.goto(BASE + path);
      await page.waitForLoadState('networkidle');
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 0, `${vp.width}px ${path} 가로 넘침 ${over}px`);
      await assertAchromatic(page);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
});

await step('잘못된 제품 ID / 색상 없음 처리', async () => {
  const n = consoleErrors.length;
  await page.goto(BASE + '/product.html?id=NOPE');
  await page.waitForFunction(() => document.getElementById('product-info').textContent.includes('찾을 수 없습니다'));
  // 존재하지 않는 제품의 404 응답 로그는 의도된 것이므로 제외
  consoleErrors.splice(n, consoleErrors.length - n, ...consoleErrors.slice(n).filter((e) => !e.includes('404')));
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(BASE + '/recommend.html');
  await page.waitForFunction(() => document.getElementById('rec-status').textContent.includes('전달된 색상값이 없습니다'));
});

if (STATIC) {
  await step('정적 모드: 서버 API 요청 없음', async () => {
    assert.deepEqual(apiRequests, []);
  });
}

await step('콘솔 오류 없음', async () => {
  assert.deepEqual(consoleErrors, []);
});

await browser.close();
server.close();

for (const r of results) console.log(r.join("  "));
if (consoleErrors.length) console.log("콘솔 오류:\n" + consoleErrors.join("\n"));
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n[${STATIC ? '정적 모드' : '서버 모드'}] ${results.length - failed}/${results.length} 통과`);
process.exit(failed ? 1 : 0);
