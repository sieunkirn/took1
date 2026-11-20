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
    // CLAUDE.md 의 실제 색 예외: 립 매핑 영상·프리셋, 색 견본, 제품 사진, 팔레트의 물감·섞는 칸·조제한 색·레시피,
    // TOOK_prototype 디자인 화면 전체(홈·Find Your Color 의 .tui-stage, 같은 무드의 챗봇 .tui-mood, 2026-11-16)
    const colorDemo = (el) => el.closest('.tui-stage, .tui-mood, #swatches, #match-swatches, .stage, .color-dot, .card-img, .paints, .mix-wrap, .result-swatch, .recipe-bar, .fly-drop, #demo-lips, .mirror-standby');
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
  for (const path of ['/', '/calib.html', '/chat.html', '/kiosk.html', '/lip-together.html', '/palette.html', '/product.html?id=P001', '/recommend.html?hex=%23B3122E', '/shades.html', '/studio.html']) {
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

// 홈·팔레트는 2026-11-16 TOOK_prototype 디자인(컬러)으로 바뀌어 무채색 검사를 하지 않는다
// 2026-11-18~20: 1 제품 장면 → 2 입술 장면 → 3 'Tap The Screen'(처음부터 3초) → 누르면 바로 팔레트. 시작 버튼(알약)은 ?step=4 로만
await step('홈: 제품 장면 → 입술 장면 → 3초 안에 Tap The Screen → 누르면 팔레트 / ?step=4 음성 쪽은 챗봇', async () => {
  await page.goto(BASE + '/');
  assert.equal(await page.getAttribute('#stage', 'data-step'), '1');
  await page.click('#stage');
  assert.equal(await page.getAttribute('#stage', 'data-step'), '2');
  await page.waitForFunction(() => document.getElementById('stage').dataset.step === '3', null, { timeout: 4000 });
  await shot('01-home');
  // 처음부터 기다리기만 해도 3초쯤에 3번 (2026-11-20 사용자 요청)
  await page.goto(BASE + '/');
  const t0 = Date.now();
  await page.waitForFunction(() => document.getElementById('stage').dataset.step === '3', null, { timeout: 6000 });
  assert.ok(Date.now() - t0 < 4500, `Tap The Screen 은 3초쯤 (${Date.now() - t0}ms)`);
  await page.click('#stage');
  await page.waitForURL(at('palette.html'));
  await page.goto(BASE + '/index.html?step=4');
  await page.click('.hs-opt-voice');
  await page.waitForURL(at('chat.html'));
});

// ---------- 팔레트 = Find Your Color (홈에서 바로 들어오는 주 화면) ----------
await step('팔레트: 원형 다이얼 돌리기 → 칸 톡 누르기 → 질감 동그라미 밀기·톡 → matte 알약 → 로고 버튼 → 바로 추천 제품 → 입술에 발라보기', async () => {
  await page.goto(BASE + '/palette.html');
  assert.equal(await page.getAttribute('#stage', 'data-mode'), 'arc');
  assert.equal(await page.locator('.fc-sw').count(), 5, '질감 동그라미 5개 (matte·glossy·satin·sheer·shimmer)');
  // 팔레트 색은 모두 립 DB(올리브영 립 제품)에 실제로 있는 색
  const dbHex = new Set(JSON.parse(await readFile(new URL('../src/data/products.oliveyoung.json', import.meta.url), 'utf8')).map((p) => p.color_hex.toUpperCase()));
  const famStops = await page.evaluate(() => window.tookFind.FAMILIES.flatMap((f) => f.stops));
  assert.deepEqual(famStops.filter((h) => !dbHex.has(h)), [], '립 DB 에 없는 팔레트 색');
  // 무대(900×1440) 좌표 → 화면 좌표 (창 크기에 맞게 줄어 있다)
  const box = await page.locator('#stage').boundingBox();
  const sp = (x, y) => [box.x + (x * box.width) / 900, box.y + (y * box.height) / 1440];
  const seg = () => page.evaluate(() => Math.round((-window.tookFind.rot() / window.tookFind.SEG) * 1e6) / 1e6); // 손잡이 아래 칸 번호 (부동소수 오차 정리)
  const chosen = () => page.evaluate(() => window.tookFind.chosen());
  const settle = (to) => page.waitForFunction((s) => Math.abs(-window.tookFind.rot() / window.tookFind.SEG - s) < 1e-6, to, { timeout: 3000 }).catch(() => {});
  // 다이얼을 오른쪽으로 끌면 색 띠가 손가락을 따라 돌고(손잡이는 제자리) 놓으면 칸에 멈춘다
  const s0 = await seg();
  const c0 = await chosen();
  // 링 위(가운데 450,1577.47 에서 반지름 ~414)를 잡는다. 링 안쪽(흰 점 줄)은 2026-11-20부터 농도 바
  await page.mouse.move(...sp(300, 1192));
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(...sp(300 + i * 12, 1192));
  await page.mouse.up();
  await page.waitForTimeout(900); // 손가락 속도만큼 조금 더 돌다 칸에 멈출 때까지
  assert.equal(await page.getAttribute('#stage', 'data-mode'), 'arc', '5~9번 상태는 없다: 끌어도 4번 그대로');
  const s1 = await seg();
  assert.ok(s1 < s0 && Number.isInteger(s1), `오른쪽으로 끌면 왼쪽 칸이 손잡이 아래로 오고 칸에 멈춘다 (${s0} → ${s1})`);
  await shot('02-palette-dial');
  const turned = await chosen();
  assert.notEqual(turned, c0, '다이얼을 돌리면 색이 바뀐다');
  await page.waitForFunction((h) => window.tookLipHex === h, turned);
  assert.ok(famStops.includes(turned), '다이얼을 놓으면 DB 색 칸에 멈춘다');
  // 손잡이 오른쪽 2칸 자리를 톡 누르면 그 칸이 손잡이 아래로 돌아온다
  const a = (2 * (360 / 28) * Math.PI) / 180;
  await page.mouse.click(...sp(450 + 414 * Math.sin(a), 1577.47 - 414 * Math.cos(a)));
  await settle(s1 + 2);
  assert.equal(await seg(), s1 + 2, `누른 칸이 손잡이 아래로 온다 (${await seg()})`);
  const picked = await chosen();
  assert.equal(picked, await page.evaluate(() => window.tookFind.segHex(-window.tookFind.rot() / window.tookFind.SEG)));
  await page.waitForFunction((h) => window.tookLipHex === h, picked);
  // 농도 바 (2026-11-20): 링 안쪽 흰 점 줄을 끌면 농도(0~100)가 바뀌고 색 칸은 그대로
  const dose = () => page.textContent('#fc-dose');
  const dotAt = (deg) => { const t = ((deg - 90) * Math.PI) / 180; return sp(450 + 360 * Math.cos(t), 1577.47 + 360 * Math.sin(t)); };
  await page.mouse.move(...dotAt(0));
  await page.mouse.down();
  assert.equal(await dose(), '50', '가운데 점 = 농도 50');
  await page.mouse.move(...dotAt(46.35), { steps: 4 });
  assert.equal(await dose(), '100', '오른쪽 끝 점 = 농도 100');
  await page.mouse.move(...dotAt(-23.2), { steps: 4 });
  await page.mouse.up();
  assert.equal(await dose(), '25');
  assert.equal(await seg(), s1 + 2, '농도를 바꿔도 색 다이얼은 그대로');
  assert.equal(await chosen(), picked);
  // 질감 동그라미: 가운데(matte)에서 왼쪽으로 밀면 다음 질감, 옆 동그라미를 톡 누르면 그게 가운데로. 다이얼은 그대로
  const texName = () => page.textContent('#fc-tex-name');
  await page.evaluate(() => window.tookFind.setTexture('matte'));
  await page.waitForTimeout(400);
  assert.equal(await texName(), 'matte');
  await page.mouse.move(...sp(450, 1005));
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(...sp(450 - i * 13, 1005));
  await page.waitForTimeout(150);
  await page.mouse.up();
  assert.equal(await page.evaluate(() => window.tookFind.sel.texture), 'glossy', '동그라미 줄을 옆으로 밀면 질감이 바뀐다');
  assert.equal(await texName(), 'glossy', 'matte 알약에 지금 질감 이름');
  assert.equal(await seg(), s1 + 2, '질감 동그라미를 밀어도 다이얼은 그대로');
  await page.waitForTimeout(400);
  await page.mouse.click(...sp(601, 1005)); // 오른쪽 이웃 = satin
  assert.equal(await page.evaluate(() => window.tookFind.sel.texture), 'satin');
  await page.click('#fc-tex'); // 알약은 예전 그대로 누르면 다음 질감
  assert.equal(await page.evaluate(() => window.tookFind.sel.texture), 'sheer');
  assert.equal(await page.getAttribute('.fc-sw[data-tex="sheer"]', 'aria-pressed'), 'true');
  // 로고 버튼 → 농도·'제품 찾기' 단계 없이 바로 추천 제품
  await page.click('#fc-sbtn');
  assert.equal(await page.getAttribute('#stage', 'data-mode'), 'recs');
  assert.equal(await page.locator('#find, #intensity:visible').count(), 0, '시트에 농도·제품 찾기 버튼은 없다');
  await page.waitForSelector('#rec-list .card[data-product-id]');
  const ids = await page.$$eval('#rec-list .card', (cs) => cs.map((c) => c.dataset.productId));
  assert.deepEqual(ids, recommendByColor(picked, { limit: 6 }).map((p) => p.id), `고른 색 ${picked} 의 추천 순서 (화면: ${ids.join(' ')} / 기대: ${recommendByColor(picked, { limit: 6 }).map((p) => p.id).join(' ')})`);
  await shot('03-palette-recommend');
  await page.click('#rec-list .card >> nth=0 >> text=입술에 발라보기');
  await page.click('#fc-sbtn');
  assert.equal(await page.getAttribute('#stage', 'data-mode'), 'arc');
});

// 세로 키오스크(갤럭시탭 세로 800×1280, 조금 낮은 820×1180): 주 화면은 스크롤 없이 한 화면에 들어온다
await step('세로 키오스크: 홈/팔레트/챗봇/호수 안내가 스크롤 없이 한 화면, 주요 요소가 화면 안에 표시', async () => {
  const pg = await ctx.newPage();
  watch(pg, 'kiosk');
  for (const vp of [KIOSK, { width: 820, height: 1180 }]) {
    await pg.setViewportSize(vp);
    for (const [path, ids] of [
      ['/', ['#stage']],
      ['/palette.html', ['.fc-camarea', '.fc-wheel', '#fc-swatches', '#fc-sbtn', '.fc-logo']],
      // 대화가 없으면 시작 화면(예시 질문·입력창·키보드, 2026-11-17): 대화 칸은 첫 질문 뒤에 보인다. 마이크는 2026-11-15 뺐다
      ['/chat.html', ['#cs-top', '#chat-input', '#chat-send', '#chat-back']], // 왼쪽 위 뒤로 동그라미 (TOOK AI 줄은 대화가 시작된 뒤에만, 2026-11-20 사용자 디자인)
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

// 챗봇 시작 화면 (2026-11-20 다시): 예시 질문이 2초마다 바뀌고, 누르면 입력창에 써 넣는다 (js/chat-start.js START_GUIDE = false)
await step('챗봇 시작 화면: 예시 질문이 2초마다 바뀌고 누르면 입력창에 써 넣어 보내기 / 키보드는 입력창을 누를 때만 / 빠른 답장 줄·밑줄 단어', async () => {
  const pg = await ctx.newPage();
  watch(pg, 'chat-start');
  await pg.setViewportSize(KIOSK);
  await openFresh(pg, '/chat.html');
  assert.ok(await pg.evaluate(() => document.body.classList.contains('cs-on')), '대화가 없으면 시작 화면');
  assert.ok(await pg.locator('.tkb').isHidden(), '화면 키보드는 평소 닫혀 있다');
  assert.ok(await pg.locator('#chat-send').isDisabled(), '글자가 없으면 보내기 꺼짐');
  // 직접 입력: 입력창을 누르면 키보드가 열리고, 쓰면 보내기가 켜지고, 다 지우면 꺼진다
  await pg.click('#chat-input');
  assert.ok(await pg.locator('.tkb').isVisible(), '입력창을 누르면 키보드가 열린다');
  await pg.click('.tkb-key[data-ch="ㄷ"]');
  assert.ok(!(await pg.locator('#chat-send').isDisabled()));
  await pg.click('.tkb-back');
  assert.ok(await pg.locator('#chat-send').isDisabled());
  // 예시 질문: 지금 예시가 2초쯤 뒤 다음 예시로 바뀐다
  await pg.click('#cs-top .cs-ask'); // 키보드 밖을 누르면 닫힌다
  assert.ok(await pg.locator('.tkb').isHidden(), '키보드 밖을 누르면 닫힌다');
  assert.ok(await pg.locator('#cs-top .cs-line').count() >= 2, '예시 질문 여러 개');
  const first = await pg.locator('#cs-top .cs-line[data-pos="cur"]').textContent();
  await pg.waitForFunction((t) => document.querySelector('#cs-top .cs-line[data-pos="cur"]')?.textContent !== t, first, { timeout: 3500 });
  // ↵ 를 누르면 그 예시를 입력창에 한 글자씩 써 넣고(보내지는 않음), 보내기를 누르면 대화가 시작된다
  await pg.click('#cs-top .cs-use');
  await pg.waitForFunction(() => document.getElementById('chat-input').value.length > 10 && !document.getElementById('chat-send').disabled, null, { timeout: 5000 });
  await pg.waitForTimeout(1500); // 다 써 넣을 때까지
  const asked = (await pg.inputValue('#chat-input')).trim();
  await pg.click('#chat-send');
  await pg.waitForSelector('.chat-log .bubble.user');
  assert.equal((await pg.locator('.chat-log .bubble.user .btext').first().textContent()).trim(), asked);
  assert.ok(await pg.evaluate(() => !document.body.classList.contains('cs-on')), '첫 질문 뒤에는 대화 화면');
  // 답변이 다 나오면: 입력창 위 고정 줄(맨 앞 '답하며 고르기') + 답변 속 밑줄 단어
  await pg.waitForSelector('#qr-bar .qr-chip:not(.qr-guide)', { timeout: 10000 });
  assert.equal(await pg.locator('#qr-bar .qr-chip').first().textContent(), '답하며 고르기');
  assert.equal(await pg.locator('.chat-log .bt-link').count(), 0, '답변 속 밑줄 단어는 없다 (2026-11-20 뺐다)');
  assert.ok(await pg.locator('.tkb').isHidden(), '보낸 뒤 키보드는 닫혀 있다');
  // 상황별 빠른 답장 (2026-11-19 1차, js/chat-quick.js): A 추천 직후 → '질감 바꾸기'(카드 한 단계) → 그 말로 이어 묻기
  assert.ok(await pg.locator('#qr-bar .qr-pick:has-text("질감 바꾸기")').count(), 'A: 질감 바꾸기');
  // '1번 입술에 발라 보기' 빠른 답장은 2026-11-20 뺐다: 말풍선 제품 카드마다 '바르러 가기', 카드에 호수 고르기는 없다
  assert.equal(await pg.locator('#qr-bar .qr-act:has-text("입술에 발라 보기")').count(), 0, 'A: 입술에 발라 보기 빠른 답장 없음');
  assert.ok(await pg.locator('.chat-log .card.mini .wear-btn').count() > 0, '카드의 바르러 가기');
  assert.equal(await pg.locator('.chat-log .card.mini .opt-head').count(), 0, '챗봇 카드에 호수 고르기 없음');
  await pg.click('#qr-bar .qr-pick:has-text("질감 바꾸기")');
  await pg.click('.gd-mini .gd-card:has-text("벨벳")');
  await pg.waitForFunction(() => [...document.querySelectorAll('.bubble.user .btext')].at(-1)?.textContent.trim() === '벨벳으로 바꿔 줘');
  // B 제품 하나 자세히 → 이거랑 비슷한 색(그 제품을 기준 제품으로)
  await pg.waitForSelector('#qr-bar .qr-chip:not(.qr-guide)', { timeout: 10000 });
  await pg.click('#qr-bar .qr-say:has-text("다른 거 더 보여 줘"), #qr-bar .qr-say:has-text("그중에 제일 싼 거는?")');
  await pg.waitForSelector('#qr-bar .qr-chip:not(.qr-guide)', { timeout: 10000 });
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
