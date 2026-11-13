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
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
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

// ONLY=<이름 일부> 를 주면 그 단계만 돌린다 (예: ONLY=거울 npm run e2e)
async function step(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (e) {
    // 어느 줄에서 실패했는지 (e2e.mjs:줄번호)
    const line = (e.stack || '').match(/e2e\.mjs:(\d+)/)?.[1];
    results.push(['FAIL', name, e.message.split('\n')[0] + (line ? ` (e2e.mjs:${line})` : '')]);
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

// 화면의 모든 요소 계산 스타일에서 유채색(r,g,b 가 서로 다른 값)이 있는지 검사 (CLAUDE.md 무채색 규칙)
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
    // CLAUDE.md 의 실제 색 예외: 립 매핑 영상·프리셋, 색 견본, 제품 사진, 팔레트의 물감·섞는 칸·조제한 색·레시피
    const colorDemo = (el) => el.closest('#swatches, #match-swatches, .stage, .color-dot, .card-img, .paints, .mix-wrap, .result-swatch, .recipe-bar, .fly-drop, #demo-lips, .mirror-standby');
    for (const el of document.querySelectorAll('*')) {
      if (colorDemo(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      for (const p of props) if (chroma(cs[p])) out.push(`${el.tagName}#${el.id}.${el.className} ${p}=${cs[p]}`);
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
  assert.deepEqual(bad, [], '유채색 발견: ' + bad.join(' | '));
}

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
// 키오스크는 세로로 세운 화면(800×1280)이 기준이다
const KIOSK = { width: 800, height: 1280 };
const ctx = await browser.newContext({ viewport: KIOSK });
await ctx.grantPermissions(['camera'], { origin: BASE });
const page = await ctx.newPage();
watch(page, 'main');
const shot = (n) => SHOTS && page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
// 저장한 상태(고른 색·대화)를 비우고 그 화면을 새로 연다. 화면 스크립트가 없는 주소에서 비워야, 떠나는 화면이 상태를 다시 써넣지 못한다.
// 새로고침은 첫 화면으로 돌려보내므로(common.js) 쓰지 않는다
const openFresh = async (pg, path) => {
  await pg.goto(BASE + '/samples/samples.json');
  await pg.evaluate(() => sessionStorage.clear());
  await pg.goto(BASE + path);
};
await step('전체화면: 모든 HTML 화면에 전체화면 유지 스크립트 포함', async () => {
  for (const path of ['/', '/calib.html', '/chat.html', '/kiosk.html', '/lip-together.html', '/palette.html', '/preview.html', '/product.html?id=P001', '/recommend.html?hex=%23B3122E', '/shades.html', '/studio.html']) {
    await page.goto(BASE + path);
    assert.equal(await page.locator('script[src="js/fullscreen-keep.js"]').count(), 1, path);
  }
  await page.goto(BASE + '/chat.html');
  assert.equal(await page.locator('.nav-fullscreen').count(), 1);
  assert.equal(await page.locator('.nav-idle-test').count(), 0);
});
await step('스크롤바: 표시만 숨기고 스크롤 동작은 유지', async () => {
  await page.goto(BASE + '/chat.html');
  const styles = await page.evaluate(() => ({
    scrollbarWidth: getComputedStyle(document.documentElement).scrollbarWidth,
    webkitScrollbarDisplay: getComputedStyle(document.documentElement, '::-webkit-scrollbar').display,
  }));
  assert.equal(styles.scrollbarWidth, 'none');
  assert.equal(styles.webkitScrollbarDisplay, 'none');
});
const savedLipHex = (pg) => pg.evaluate(() => JSON.parse(sessionStorage.getItem('took.lipColor') || 'null')?.hex);

await step('홈: 대기 화면 → 화면을 누르면 팔레트 → 상단 메뉴로 챗봇', async () => {
  await page.goto(BASE + '/');
  assert.match(await page.textContent('#home-standby .hs-hint'), /제품을 태그해보세요/);
  await assertAchromatic(page);
  await shot('01-home');
  await page.click('#home-standby .hs-hint');
  await page.waitForURL(at('palette.html'));
  await page.click('header.nav a[href="chat.html"]');
  await page.waitForURL(at('chat.html'));
  // 챗봇 상단: 팔레트로 가는 버튼, 거울(대기) 화면으로 돌아가는 버튼
  await page.click('header.nav a[href="palette.html"]');
  await page.waitForURL(at('palette.html'));
  await page.click('header.nav a[href="chat.html"]');
  await page.waitForURL(at('chat.html'));
  await page.click('header.nav a.nav-mirror');
  await page.waitForURL((u) => /\/(index\.html)?$/.test(u.pathname));
  await page.waitForSelector('#home-standby');
});

// ---------- 팔레트 (홈에서 바로 들어오는 주 화면) ----------
await step('팔레트: 아바타로 시작 → 물감 섞기 → 조제한 색과 비슷한 제품 → 입술에 발라보기 → 다시 섞기', async () => {
  await page.goto(BASE + '/palette.html');
  await page.click('#use-avatar');
  await page.waitForSelector('#view:not(.hidden)');
  // 그라디언트 맵: 띠의 두 곳을 눌러 두 방울
  await page.click('#lip-paints .gmap-bar', { position: { x: 20, y: 20 } });
  await page.click('#lip-paints .gmap-bar', { position: { x: 160, y: 20 } });
  await assertAchromatic(page);
  await shot('02-palette-mix');
  await page.waitForTimeout(1500); // 떨어뜨린 물감이 다 섞일 때까지
  await page.click('#find');
  await page.waitForSelector('#rec-list .card[data-product-id]');
  const mixed = (await page.textContent('#res-hex')).match(/#[0-9A-F]{6}/i)?.[0];
  assert.ok(mixed, '조제한 색의 색상값이 보여야 한다');
  const ids = await page.$$eval('#rec-list .card', (cs) => cs.map((c) => c.dataset.productId));
  assert.deepEqual(ids, recommendByColor(mixed, { limit: 6 }).map((p) => p.id), `조제한 색 ${mixed} 의 추천 순서`);
  await shot('03-palette-recommend');
  await page.click('#rec-list .card >> nth=0 >> text=입술에 발라보기');
  await page.click('#back-mix');
  await page.waitForSelector('#find', { state: 'visible' });
});

// ---------- 흐름 A: 립 컬러 매핑 ----------
// 고른 색: 눌린 프리셋(aria-pressed)과 저장한 립 색으로 확인한다 (화면에 색상값 글자는 따로 보이지 않는다)
const pressedSwatchHex = (pg) => pg.getAttribute('#swatches button[aria-pressed="true"]', 'data-hex');
await step('흐름 A: 카메라 자동 실행 → 입술 추적 준비(작업 스레드) → 얼굴 안내', async () => {
  await page.goto(BASE + '/lip-together.html');
  await page.waitForSelector('#use-camera[aria-pressed="true"]');
  await page.waitForSelector('#view:not(.hidden)');
  // 가짜 카메라 영상에는 얼굴이 없으므로 얼굴을 맞추라는 안내가 정상
  await page.waitForFunction(() => document.getElementById('guide').textContent.includes('얼굴이 화면 가운데'), null, { timeout: 40000 });
  await assertAchromatic(page);
  await shot('04-lip-camera');
});

let chosenHex;
await step('흐름 A: 프리셋 선택 → 선택 컬러 표시 → 같은 화면에서 유사도 순 추천', async () => {
  await page.click('#swatches button >> nth=3');
  chosenHex = await page.getAttribute('#swatches button >> nth=3', 'data-hex');
  assert.equal(await pressedSwatchHex(page), chosenHex);
  assert.equal(await savedLipHex(page), chosenHex);
  await page.click('#recommend');
  await page.waitForSelector('#rec-panel:not(.hidden) #rec-list .card[data-product-id]');
  const ids = await page.$$eval('#rec-list .card', (cs) => cs.map((c) => c.dataset.productId));
  assert.deepEqual(ids, recommendByColor(chosenHex, { limit: 6 }).map((p) => p.id));
  // 카드에는 브랜드·제품명·가격만 보인다
  const labels = await page.$$eval('#rec-list .card:first-child dt', (ds) => ds.map((d) => d.textContent));
  assert.deepEqual(labels, ['브랜드', '제품명', '가격']);
  await assertAchromatic(page);
  await shot('05-lip-recommend');
});

await step('흐름 A: 추천 카드 입술에 발라보기 → 제품 색 적용 → 조절 화면으로 돌아가기', async () => {
  const first = allProducts().find((p) => p.id === recommendByColor(chosenHex, { limit: 1 })[0].id);
  await page.click('#rec-list .card >> nth=0 >> text=입술에 발라보기');
  assert.equal(await savedLipHex(page), first.color_hex);
  await page.click('#rec-back');
  await page.waitForSelector('#controls:not(.hidden)');
});

await step('추천 화면: 유사도 순 10개, 제형 필터, 상세 → 이전 화면 → 다시 조색하기', async () => {
  await page.goto(BASE + '/recommend.html?hex=' + encodeURIComponent(chosenHex));
  await refColorHas(page, chosenHex);
  await page.waitForSelector('#rec-list .card[data-product-id]');
  const ids = await page.$$eval('#rec-list .card', (cs) => cs.map((c) => c.dataset.productId));
  assert.deepEqual(ids, recommendByColor(chosenHex, { limit: 10 }).map((p) => p.id));
  // 카드에 제형이 보이지 않으므로 제품 ID 로 확인한다
  const matte = recommendByColor(chosenHex, { finish: 'matte', limit: 10 }).map((p) => p.id);
  await page.selectOption('#finish-filter', 'matte');
  await page.waitForFunction((want) => [...document.querySelectorAll('#rec-list .card')].map((c) => c.dataset.productId).join() === want, matte.join());
  await page.selectOption('#finish-filter', '');
  await page.waitForFunction(() => document.querySelectorAll('#rec-list .card').length === 10);
  // 카드에는 상세 보기 링크가 없어 주소로 들어간다 (from=recommend 로 '이전 화면'이 추천 화면을 가리킨다)
  await page.goto(BASE + `/product.html?id=${ids[0]}&from=recommend`);
  await page.waitForSelector('#product-info table');
  assert.ok((await page.textContent('#product-info')).includes(allProducts().find((x) => x.id === ids[0]).barcode));
  await assertAchromatic(page);
  await shot('06-product');
  await page.click('#back');
  await page.waitForURL(at('recommend.html'));
  await page.click('#recolor');
  await page.waitForURL(at('lip-together.html'));
});

// ---------- 카메라 오류 ----------
for (const [name, error, message] of [
  ['카메라 권한 거부 → 안내 메시지와 다시 연결 버튼', 'NotAllowedError', /권한이 거부/],
  ['카메라 장치 없음 → 꽂으면 자동 연결 안내', 'NotFoundError', /다시 꽂으면 자동으로 연결/],
]) {
  await step(name, async () => {
    const pg = await ctx.newPage();
    watch(pg, error);
    await pg.addInitScript((err) => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('test', err));
    }, error);
    await pg.goto(BASE + '/lip-together.html');
    await pg.click('#use-camera');
    await pg.waitForSelector('#error:not(.hidden)');
    assert.match(await pg.textContent('#error'), message);
    assert.ok(await pg.isVisible('#cam-retry'));
    await pg.close();
  });
}

// ---------- 흐름 B: 바코드 (챗봇 화면의 바코드 패널은 꺼 두었고, 합본 화면의 바코드 탭이 쓴다) ----------
const target = allProducts().find((p) => p.id === 'P014');
await step('흐름 B: 합본 화면 바코드 번호 입력 → 제품 설명 → 기준 제품 설정', async () => {
  await openFresh(page, '/studio.html');
  await page.click('.studio-tabs [data-tab="scan"]');
  await page.fill('#scan-input', target.barcode);
  await page.press('#scan-input', 'Enter');
  await page.waitForSelector('#base-chip:not(.hidden)', { state: 'attached' });
  assert.ok((await page.textContent('#chat-log')).includes(target.name));
  await shot('07-studio-barcode');
});

await step('흐름 B: 미등록 바코드 → 등록되지 않았다는 답', async () => {
  await page.click('.studio-tabs [data-tab="scan"]');
  await page.fill('#scan-input', '8800000000000');
  await page.press('#scan-input', 'Enter');
  await page.waitForFunction(() => document.getElementById('chat-log').textContent.includes('등록되지 않은 바코드예요'));
});

// ---------- 흐름 C ----------
// 답변이 한 글자씩 다 찍힐 때까지 기다린다 (찍히는 동안에는 다음 질문을 받지 않는다)
const replyDone = (pg) => pg.waitForFunction(() => !document.querySelector('#chat-log .bubble.streaming'));
// 마지막 답변 말풍선에 붙은 제품 카드의 제품 ID
const lastReplyCardIds = () => [...([...document.querySelectorAll('#chat-log .bubble.bot')].pop()?.querySelectorAll('.card') || [])].map((c) => c.dataset.productId);
await step('흐름 C: 챗봇 직접 질문 → 추천 → 상세 → 챗봇으로 돌아와 대화 유지', async () => {
  await openFresh(page, '/chat.html');
  // 기준 색상 없음 → 비슷한 색상은 결과를 꾸며내지 않음
  await page.fill('#chat-input', '비슷한 색상 찾아 줘');
  await page.press('#chat-input', 'Enter');
  await page.waitForFunction(() => document.getElementById('chat-log').textContent.includes('기준 색상이 없어'));
  await replyDone(page);
  assert.equal(await page.locator('#chat-log .card').count(), 0);
  await page.fill('#chat-input', '2만원 이하 레드 추천해 줘');
  await page.press('#chat-input', 'Enter');
  // 추천 제품은 답변 말풍선 안에 카드로 붙는다
  await page.waitForFunction(`(${lastReplyCardIds})().length > 0`);
  await replyDone(page);
  const ids = await page.evaluate(lastReplyCardIds);
  for (const id of ids) {
    const p = allProducts().find((x) => x.id === id);
    assert.ok(p.color_family === 'red' && p.price <= 20000, id);
  }
  assert.equal(ids.length, allProducts().filter((p) => p.color_family === 'red' && p.price <= 20000).length);
  await assertAchromatic(page);
  await shot('08-chat-direct');
  await page.click(`#chat-log .card[data-product-id="${ids[0]}"] >> text=상세 보기`);
  await page.waitForURL(at('product.html'));
  await page.waitForSelector('#product-info table');
  await page.click('#back');
  await page.waitForURL(at('chat.html'));
  await page.waitForFunction(() => document.getElementById('chat-log').textContent.includes('2만원 이하 레드')
    && document.querySelectorAll('#chat-log .card').length > 0);
});

// 세로 키오스크(갤럭시탭 세로 800×1280, 조금 낮은 820×1180): 주 화면은 스크롤 없이 한 화면에 들어온다
await step('세로 키오스크: 홈/팔레트/챗봇/호수 안내가 스크롤 없이 한 화면, 주요 요소가 화면 안에 표시', async () => {
  const pg = await ctx.newPage();
  watch(pg, 'kiosk');
  for (const vp of [KIOSK, { width: 820, height: 1180 }]) {
    await pg.setViewportSize(vp);
    for (const [path, ids] of [
      ['/', ['#home-standby .hs-hint']],
      ['/palette.html', ['.pal-cam .stage', '#reset', '#textures', '#find', '#lip-paints', '#mix-canvas']],
      ['/chat.html', ['#chat-log', '#voice', '#chat-input', '#tts', '#chat-reset']],
      ['/shades.html', ['#sh-page']],
    ]) {
      await pg.goto(BASE + path);
      await pg.waitForLoadState('networkidle');
      const over = await pg.evaluate(() => ({
        x: document.documentElement.scrollWidth - innerWidth,
        y: document.documentElement.scrollHeight - innerHeight,
      }));
      assert.ok(over.x <= 0 && over.y <= 0, `${vp.width}×${vp.height} ${path} 넘침 x=${over.x} y=${over.y}`);
      for (const id of ids) {
        const box = await pg.locator(id).first().boundingBox();
        assert.ok(box && box.width > 0 && box.y >= 0 && box.y + Math.min(box.height, 44) <= vp.height && box.x + box.width <= vp.width,
          `${vp.width}×${vp.height} ${path} ${id} 화면 밖: ${JSON.stringify(box)}`);
      }
      await assertAchromatic(pg);
    }
  }
  if (SHOTS) {
    await pg.setViewportSize(KIOSK);
    for (const [n, path] of [['kiosk-1-home', '/'], ['kiosk-2-palette', '/palette.html'], ['kiosk-3-chat', '/chat.html'], ['kiosk-4-shades', '/shades.html']]) {
      await pg.goto(BASE + path);
      await pg.waitForLoadState('networkidle');
      await pg.screenshot({ path: `${SHOTS}/${n}.png` });
    }
  }
  await pg.close();
});

await step('그 밖의 화면 크기(가로 태블릿·PC): 가로 스크롤 없음', async () => {
  for (const vp of [{ width: 1180, height: 820 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(vp);
    for (const path of ['/', '/lip-together.html', '/studio.html', '/palette.html', '/shades.html', '/recommend.html?hex=%23B3122E', '/chat.html', '/product.html?id=P001']) {
      await page.goto(BASE + path);
      await page.waitForLoadState('networkidle');
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 0, `${vp.width}px ${path} 가로 넘침 ${over}px`);
      await assertAchromatic(page);
    }
  }
  await page.setViewportSize(KIOSK);
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
