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
    // 거울 대기 화면의 두 번째 사진(images/mirror/standby-2.webp)은 넣어 두면 나오는 선택 파일이라, 없을 때의 404 는 뺀다
    if (m.type() === 'error' && /standby-\d+\.(webp|jpg)$/.test(m.location()?.url || '')) return;
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

// ---------- 흐름 A: 립 컬러 매핑 ----------
const lipColorName = (pg) => pg.textContent('#color-name');
await step('흐름 A: 카메라 실행 → 입술 추적 준비(작업 스레드) → 얼굴 안내', async () => {
  await page.goto(BASE + '/lip-together.html');
  await page.waitForSelector('#view:not(.hidden)');
  // 가짜 카메라 영상에는 얼굴이 없으므로 얼굴을 맞추라는 안내가 정상
  await page.waitForFunction(() => document.getElementById('guide').textContent.includes('얼굴이 화면 가운데'), null, { timeout: 30000 });
  await assertAchromatic(page);
  await shot('02-lip-camera');
});

let chosenHex;
await step('흐름 A: 프리셋 선택 → 선택 컬러 표시 → 같은 화면에서 유사도 순 추천', async () => {
  await page.click('#swatches button >> nth=3');
  chosenHex = await page.getAttribute('#swatches button >> nth=3', 'data-hex');
  assert.match(await lipColorName(page), new RegExp(chosenHex));
  await page.click('#recommend');
  await page.waitForSelector('#rec-panel:not(.hidden) #rec-list .card');
  const ids = await page.$$eval('#rec-list .card', (cs) => cs.map((c) => c.dataset.productId));
  assert.deepEqual(ids, recommendByColor(chosenHex, { limit: 6 }).map((p) => p.id));
  // 카드에는 브랜드·제품명·색상값·제형·가격·올리브영 링크만 보인다
  const labels = await page.$$eval('#rec-list .card:first-child dt', (ds) => ds.map((d) => d.textContent));
  assert.deepEqual(labels, ['브랜드', '제품명', '색상값', '제형', '가격']);
  await assertAchromatic(page);
  await shot('03-lip-recommend');
});

await step('흐름 A: 추천 카드 입술에 발라보기 → 제품 색 적용 → 조절 화면으로 돌아가기', async () => {
  const first = allProducts().find((p) => p.id === recommendByColor(chosenHex, { limit: 1 })[0].id);
  await page.click('#rec-list .card >> nth=0 >> text=입술에 발라보기');
  assert.match(await lipColorName(page), new RegExp(first.color_hex));
  await page.click('#rec-back');
  await page.waitForSelector('#controls:not(.hidden)');
});

await step('추천 화면: 유사도 순 10개, 제형 필터, 상세 → 이전 화면 → 다시 조색하기', async () => {
  await page.goto(BASE + '/recommend.html?hex=' + encodeURIComponent(chosenHex));
  await refColorHas(page, chosenHex);
  await page.waitForSelector('#rec-list .card');
  const ids = await page.$$eval('#rec-list .card', (cs) => cs.map((c) => c.dataset.productId));
  assert.deepEqual(ids, recommendByColor(chosenHex, { limit: 10 }).map((p) => p.id));
  await page.selectOption('#finish-filter', 'matte');
  await page.waitForFunction(() => [...document.querySelectorAll('#rec-list .card')].every((c) => c.textContent.includes('제형매트')));
  await page.selectOption('#finish-filter', '');
  await page.waitForFunction(() => document.querySelectorAll('#rec-list .card').length === 10);
  // 카드에는 상세 보기 링크가 없어 주소로 들어간다 (from=recommend 로 '이전 화면'이 추천 화면을 가리킨다)
  await page.goto(BASE + `/product.html?id=${ids[0]}&from=recommend`);
  await page.waitForSelector('#product-info table');
  assert.ok((await page.textContent('#product-info')).includes(allProducts().find((x) => x.id === ids[0]).barcode));
  await assertAchromatic(page);
  await shot('04-product');
  await page.click('#back');
  await page.waitForURL(at('recommend.html'));
  await page.click('#recolor');
  await page.waitForURL(at('lip-together.html'));
  assert.match(await lipColorName(page), new RegExp(chosenHex));
});

// ---------- 카메라 오류 ----------
for (const [name, error, message] of [
  ['카메라 권한 거부 → 안내 메시지와 다시 연결 버튼', 'NotAllowedError', /권한이 거부/],
  ['카메라 장치 없음 → 안내 메시지', 'NotFoundError', /카메라를 찾지 못했습니다/],
]) {
  await step(name, async () => {
    const pg = await ctx.newPage();
    watch(pg, error);
    await pg.addInitScript((err) => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('test', err));
    }, error);
    await pg.goto(BASE + '/lip-together.html');
    await pg.waitForSelector('#error:not(.hidden)');
    assert.match(await pg.textContent('#error'), message);
    assert.ok(await pg.isVisible('#cam-retry'));
    await pg.close();
  });
}

// ---------- 흐름 B: 챗봇 바코드 ----------
const target = allProducts().find((p) => p.id === 'P014');
await step('흐름 B: 챗봇 바코드 번호 입력 → 제품 설명 → 기준 제품 설정', async () => {
  await page.goto(BASE + '/chat.html');
  await page.click('#chat-reset');
  await page.fill('#scan-input', target.barcode);
  await page.press('#scan-input', 'Enter');
  await page.waitForSelector('#base-chip:not(.hidden)');
  assert.ok((await page.textContent('#chat-log')).includes(target.name));
  await assertAchromatic(page);
  await shot('07-chat-barcode');
});

await step('흐름 B: 미등록 바코드 → 등록되지 않았다는 답', async () => {
  await page.fill('#scan-input', '8800000000000');
  await page.press('#scan-input', 'Enter');
  await page.waitForFunction(() => document.getElementById('chat-log').textContent.includes('아직 등록되어 있지 않아요'));
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
await step('iPad 가로: 립 매핑/챗봇/합본/팔레트가 스크롤 없이 한 화면, 주요 요소가 화면 안에 표시', async () => {
  const pg = await ctx.newPage();
  watch(pg, 'ipad');
  for (const vp of IPAD_LANDSCAPE) {
    await pg.setViewportSize({ width: vp.width, height: vp.height });
    for (const [path, ids] of [
      ['/lip-together.html', ['.lip-user .stage', '#match', '#swatches', '#textures', '#intensity', '#recommend']],
      ['/chat.html', ['#chat-log', '#voice', '#chat-input', '#chat-send', '#tts', '#chat-reset', '#rec-panel']],
      ['/studio.html', ['.studio .stage', '.studio-tabs', '#swatches', '#mix-h', '#recommend']],
      ['/palette.html', ['.pal-cam .stage', '#reset', '#textures', '#find', '#lip-paints', '#mix-canvas']],
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
  }
  if (SHOTS) {
    await pg.setViewportSize({ width: 1180, height: 820 });
    for (const [n, path] of [['ipad-1-lip', '/lip-together.html'], ['ipad-2-chat', '/chat.html'], ['ipad-3-studio', '/studio.html'], ['ipad-4-palette', '/palette.html']]) {
      await pg.goto(BASE + path);
      await pg.waitForLoadState('networkidle');
      await pg.screenshot({ path: `${SHOTS}/${n}.png` });
    }
  }
  await pg.close();
});

await step('그 밖의 화면 크기(PC·세로 태블릿): 가로 스크롤 없음', async () => {
  for (const vp of [{ width: 820, height: 1180 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(vp);
    for (const path of ['/', '/lip-together.html', '/studio.html', '/palette.html', '/mirror.html', '/mirror-v4.html', '/recommend.html?hex=%23B3122E', '/chat.html', '/product.html?id=P001']) {
      await page.goto(BASE + path);
      await page.waitForLoadState('networkidle');
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 0, `${vp.width}px ${path} 가로 넘침 ${over}px`);
      await assertAchromatic(page);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
});

// ---------- 거울 모드 (mirror.html) ----------
await step('거울 모드: 대기 → 터치 → 화면 전체 영상·독 → 팔레트 → 유휴 초기화로 대기·스트림 정지 → NFC(제품·휴대폰 챗봇 QR) → 회전', async () => {
  const pg = await ctx.newPage();
  watch(pg, 'mirror');
  // 켠 카메라 스트림을 모아 두고, 대기로 돌아간 뒤 모두 멈췄는지 본다
  await pg.addInitScript(() => {
    window.__streams = [];
    const md = navigator.mediaDevices;
    const orig = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => { const s = await orig(c); window.__streams.push(s); return s; };
    // 카메라·입술 추적 준비가 느린 날에는 유휴 30초 안내가 화면을 덮어 클릭이 막히므로 길게 둔다 (유휴 복귀는 아래에서 테스트 버튼으로)
    if (!localStorage.getItem('took.mirror')) localStorage.setItem('took.mirror', JSON.stringify({ idle: 600 }));
  });
  const VW = 820, VH = 1180; // iPad 세로
  await pg.setViewportSize({ width: VW, height: VH });
  await pg.goto(BASE + '/mirror.html');
  await pg.waitForLoadState('networkidle');
  // 1) 대기: 올영세일 사진이 화면 가운데 가득, 안내, 카메라 꺼짐, 독 없음
  assert.equal(await pg.getAttribute('body', 'data-mirror'), 'standby');
  await pg.waitForFunction(() => { const i = document.getElementById('mirror-standby-img'); return i.complete && i.naturalWidth > 0; });
  const img = await pg.locator('#mirror-standby-img').boundingBox();
  assert.ok(img.x <= 0 && img.y <= 0 && img.width >= VW && img.height >= VH, '대기 사진이 화면 전체가 아님: ' + JSON.stringify(img));
  assert.equal(await pg.evaluate(() => getComputedStyle(document.getElementById('mirror')).backgroundColor), 'rgb(0, 0, 0)'); // 카메라 뒤 바탕
  assert.ok(await pg.isVisible('#mirror-standby .mirror-hint'));
  assert.equal(await pg.isVisible('#mirror-dock'), false);
  assert.equal(await pg.isVisible('header.nav'), false);
  assert.equal(await pg.evaluate(() => window.__streams.length), 0);
  await assertAchromatic(pg);
  // 2) 터치 → 카메라가 켜지고 #view 캔버스가 화면 전체에 그려진다
  await pg.mouse.click(VW / 2, VH * 0.4);
  await pg.waitForFunction(() => document.body.dataset.mirror === 'live');
  await pg.waitForFunction(() => getComputedStyle(document.getElementById('mirror-standby')).visibility === 'hidden'); // 대기 사진은 사라진다
  await pg.waitForFunction(() => {
    const c = document.getElementById('view');
    if (!c.width || !c.height) return false;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4 * 997) if (d[i] + d[i + 1] + d[i + 2] > 0) return true;
    return false;
  }, null, { timeout: 15000 });
  // 캔버스 내부 해상도 = 영상 해상도 (DPR 로 키우지 않음), 화면에는 전체로
  assert.ok(await pg.evaluate(() => {
    const c = document.getElementById('view'), v = document.getElementById('video');
    return c.width === v.videoWidth && c.height === v.videoHeight;
  }), '캔버스 해상도가 영상 해상도와 다름');
  const viewBox = await pg.locator('#view').boundingBox();
  assert.ok(viewBox.x <= 0 && viewBox.y <= 0 && viewBox.width >= VW && viewBox.height >= VH, '영상이 화면 전체가 아님: ' + JSON.stringify(viewBox));
  // 3) 독: 보이고, 화면 높이의 1/3 이내(팔레트를 크게 쓰기로 해 25% → 1/3), 버튼 56px 이상
  assert.ok(await pg.isVisible('#mirror-dock'));
  const dock = await pg.locator('#mirror-dock').boundingBox();
  assert.ok(dock.height <= VH / 3 && dock.y + dock.height <= VH, '독 크기/위치: ' + JSON.stringify(dock));
  for (const b of await pg.locator('#mirror-dock button:visible').all()) assert.ok((await b.boundingBox()).height >= 56, '버튼 높이 56px 미만');
  assert.equal(await pg.locator('#mirror-pill').count(), 0); // 왼쪽 위 '실시간' 알약은 뺐다
  await assertAchromatic(pg);
  // 4) 팔레트: 시작하면 바로 뜬다 (팔레트 탭과 같은 물감·섞는 칸). 물감 두 방울 → 섞은 색이 이름에 반영, 독은 1/3 이내
  assert.ok(await pg.isVisible('#mirror-palette'), '시작했는데 팔레트가 바로 뜨지 않음');
  assert.equal(await pg.isVisible('#mirror-main'), false);
  await pg.click('#mirror-paints .paint >> nth=1');
  await pg.waitForTimeout(800); // 방울이 날아가는 시간
  await pg.click('#mirror-paints .paint >> nth=8');
  await pg.waitForFunction(() => /#[0-9A-F]{6}/.test(document.getElementById('mirror-name').textContent) && !document.getElementById('mirror-undo').disabled);
  const palDock = await pg.locator('#mirror-dock').boundingBox();
  assert.ok(palDock.height <= VH / 3, '팔레트를 연 독이 1/3 넘음: ' + JSON.stringify(palDock));
  for (const b of await pg.locator('#mirror-palette button:visible').all()) assert.ok((await b.boundingBox()).height >= 56, '팔레트 버튼 높이 56px 미만');
  // 팔레트 탭 기능: 텍스처·농도, 비슷한 제품(닫으면 팔레트로 돌아온다)
  await pg.click('#mirror-textures [data-texture="glossy"]');
  assert.equal(await pg.getAttribute('#mirror-textures [data-texture="glossy"]', 'aria-pressed'), 'true');
  await pg.locator('#mirror-intensity').fill('55');
  assert.equal(await pg.textContent('#mirror-intensity-out'), '55%');
  // 비슷한 제품: 팔레트 탭과 같은 추천(색이 가까운 순 6개) → 카드를 누르면 바로 바른다(✓ 바르는 중) → 다시 섞기
  const mixHex = (await pg.textContent('#mirror-name')).match(/#[0-9A-F]{6}/)[0];
  await pg.click('#mirror-find');
  await pg.waitForSelector('#mirror-rec-list .m-card');
  const recIds = await pg.$$eval('#mirror-rec-list .m-card', (cs) => cs.map((c) => c.dataset.productId));
  // 카드에는 올리브영 링크·색상값이 없다
  assert.equal(await pg.locator('#mirror-rec-list a, #mirror-rec-list .color-dot').count(), 0);
  for (const c of await pg.locator('#mirror-rec-list .m-card').all()) assert.ok(!/#[0-9A-F]{6}/i.test(await c.textContent()), '카드에 색상값이 보임');
  // 서버 모드는 가상 데이터라 기대값을 계산해 비교한다 (정적 빌드는 올리브영 실제 데이터라 개수만)
  if (STATIC) assert.equal(recIds.length, 6);
  else assert.deepEqual(recIds, recommendByColor(mixHex, { limit: 6 }).map((p) => p.id));
  assert.ok((await pg.locator('#mirror-dock').boundingBox()).height <= VH / 3, '추천 결과를 연 독이 1/3 넘음');
  await assertAchromatic(pg);
  const before = await pg.textContent('#mirror-name');
  await pg.click('#mirror-rec-list .m-card >> nth=0');
  await pg.waitForFunction((b) => document.getElementById('mirror-name').textContent !== b, before); // 이름이 제품 이름으로 바뀐다
  assert.equal(await pg.getAttribute('#mirror-rec-list .m-card >> nth=0', 'aria-pressed'), 'true');
  await pg.click('#mirror-back-mix');
  assert.ok(await pg.isVisible('#mirror-palette'), '다시 섞기를 눌렀는데 팔레트로 돌아오지 않음');
  await assertAchromatic(pg);
  // 팔레트에는 닫기 버튼이 없다 (끝내기는 자동 초기화)
  assert.equal(await pg.locator('#mirror-pal-close').count(), 0);
  // 5) 유휴 초기화: 기존 안내(자동 초기화 테스트 버튼으로 바로 띄움) → '처음으로' → 대기, 스트림 정지
  await pg.evaluate(() => document.querySelector('.nav-idle-test').click());
  await pg.waitForSelector('.idle-overlay');
  await pg.click('.idle-overlay .idle-actions button:not(.primary)');
  await pg.waitForFunction(() => document.body.dataset.mirror === 'standby');
  assert.ok(await pg.evaluate(() => window.__streams.length > 0
    && window.__streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended'))
    && document.getElementById('video').srcObject === null), '대기로 돌아왔는데 카메라 스트림이 멈추지 않음');
  assert.equal(await pg.isVisible('#mirror-dock'), false);
  // 6) NFC(리더기 입력과 같은 길): 대기에서 깨우고 제품 색을 입히거나, 등록되지 않은 태그면 그렇게 알린다
  const nErr = consoleErrors.length;
  await pg.evaluate(() => window.tookNfc('TEST0001'));
  await pg.waitForFunction(() => document.body.dataset.mirror === 'live');
  if (STATIC) {
    // 정적 빌드(올리브영 실제 데이터): 시험용 태그 → 등록 제품. 제품 화면 + 손님 휴대폰 챗봇 QR
    await pg.waitForSelector('#mirror-product:not(.hidden) #mirror-qr svg', { timeout: 15000 });
    const qrUrl = await pg.getAttribute('#mirror-qr', 'data-url');
    assert.match(qrUrl, /chat\.html\?base=OY-[^&]+&hex=%23[0-9A-F]{6}&take=1/);
    assert.ok((await pg.locator('#mirror-dock').boundingBox()).height <= VH / 3, '제품 화면 독이 1/3 넘음');
    await assertAchromatic(pg);
    // 손님 휴대폰: 그 주소를 열면 그 제품이 기준인 챗봇, 자동 초기화 없음
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const ph = await phone.newPage();
    watch(ph, 'phone');
    const u = new URL(qrUrl);
    await ph.goto(BASE + u.pathname + u.search);
    await ph.waitForSelector('#base-chip:not(.hidden)');
    assert.equal(await ph.evaluate(() => sessionStorage.getItem('took.phone')), '1');
    assert.equal(await ph.locator('.nav-idle-test').count(), 0);
    await phone.close();
  } else {
    // 서버 모드(가상 데이터): 그 제품이 없으니 지어내지 않고 '등록되지 않은 태그' + 팔레트
    await pg.waitForFunction(() => /등록되지 않은 태그/.test(document.getElementById('mirror-pal-status').textContent));
    assert.ok(await pg.isVisible('#mirror-palette'), 'NFC 로 시작했는데 팔레트가 바로 뜨지 않음');
  }
  // 가상 데이터(서버 모드)에는 그 제품이 없어 404 가 나는 것이 의도된 동작이므로 그 로그는 뺀다
  consoleErrors.splice(nErr, consoleErrors.length - nErr, ...consoleErrors.slice(nErr).filter((e) => !e.includes('404')));
  // 7) 설정: 영상 90° 회전 → 캔버스 가로·세로가 영상과 바뀐다
  await pg.evaluate(() => document.querySelector('#ms-rotate [data-v="90"]').click());
  await pg.waitForFunction(() => {
    const c = document.getElementById('view'), v = document.getElementById('video');
    return v.videoWidth && c.width === v.videoHeight && c.height === v.videoWidth;
  }, null, { timeout: 15000 });
  await pg.evaluate(() => { localStorage.removeItem('took.mirror'); document.getElementById('mirror-end').click(); });
  await pg.waitForFunction(() => document.body.dataset.mirror === 'standby');
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/mirror-standby.png` });
  await pg.close();
});

// ---------- 거울 ver4 (mirror-v4.html) ----------
await step('거울 ver4: 대기(전체 검정·사진 없음) → 터치 → 가운데 카메라 창·독과 안 겹침 → 팔레트(창이 줄어듦) → 가로 화면(독 오른쪽·창 65dvh) → 유휴 초기화', async () => {
  const pg = await ctx.newPage();
  watch(pg, 'mirror-v4');
  await pg.addInitScript(() => {
    window.__streams = [];
    const md = navigator.mediaDevices;
    const orig = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => { const s = await orig(c); window.__streams.push(s); return s; };
    // 전체 실행에서는 카메라·입술 추적 준비가 느려 유휴 30초 안내가 화면을 덮을 수 있어 길게 둔다 (유휴 복귀는 아래에서 테스트 버튼으로)
    if (!localStorage.getItem('took.mirror4')) localStorage.setItem('took.mirror4', JSON.stringify({ idle: 600 }));
  });
  const VW = 820, VH = 1180; // 태블릿 세로
  await pg.setViewportSize({ width: VW, height: VH });
  await pg.goto(BASE + '/mirror-v4.html');
  await pg.waitForLoadState('networkidle');
  const box = (sel) => pg.locator(sel).boundingBox();
  const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const settle = () => pg.waitForTimeout(450); // 창 크기 전환 0.3초
  // 1) 대기: body·루트 배경 검정, 홍보 사진 없음(기본 끄기), 안내 보임, 독 숨김, 카메라 꺼짐
  assert.equal(await pg.getAttribute('body', 'data-mirror'), 'standby');
  assert.equal(await pg.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(0, 0, 0)');
  assert.equal(await pg.evaluate(() => getComputedStyle(document.getElementById('mirror-standby')).backgroundColor), 'rgb(0, 0, 0)');
  assert.equal(await pg.isVisible('#mirror-standby-img'), false, '대기 사진이 보임 (기본은 끄기)');
  assert.equal(await pg.getAttribute('#mirror-standby-img', 'src'), null, '사진을 끈 상태인데 사진을 불러옴');
  assert.ok(await pg.isVisible('#mirror-standby .mirror-hint'));
  assert.ok(await pg.isVisible('.m4-face') && await pg.isVisible('.m4-logo'), '대기 화면 점선 얼굴·로고가 없음');
  assert.match(await pg.textContent('#m4-clock'), /^\d{2}:\d{2}$/);
  assert.equal(await pg.isVisible('#mirror-dock'), false);
  assert.equal(await pg.evaluate(() => window.__streams.length), 0);
  await assertAchromatic(pg);
  // 2) 터치 → live. 카메라 창은 화면 전체가 아니라 가로 중앙의 창
  await pg.mouse.click(VW / 2, VH * 0.4);
  await pg.waitForFunction(() => document.body.dataset.mirror === 'live');
  await pg.waitForFunction(() => {
    const c = document.getElementById('view');
    if (!c.width || !c.height) return false;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4 * 997) if (d[i] + d[i + 1] + d[i + 2] > 0) return true;
    return false;
  }, null, { timeout: 15000 });
  assert.ok(await pg.evaluate(() => {
    const c = document.getElementById('view'), v = document.getElementById('video');
    return c.width === v.videoWidth && c.height === v.videoHeight;
  }), '캔버스 해상도가 영상 해상도와 다름');
  await settle();
  // 3) 시작하면 팔레트가 바로 뜬다 → 창이 독 위로 비켜 줄어든다 (겹치지 않음)
  assert.ok(await pg.isVisible('#mirror-palette'), '시작했는데 팔레트가 바로 뜨지 않음');
  let win = await box('#mirror-stage');
  let dock = await box('#mirror-dock');
  assert.ok(win.width < VW && win.height < VH, '카메라 창이 화면 전체: ' + JSON.stringify(win));
  assert.ok(Math.abs(win.x + win.width / 2 - VW / 2) <= 2, '카메라 창이 가로 중앙이 아님: ' + JSON.stringify(win));
  assert.ok(!overlap(win, dock), '팔레트 독이 창과 겹침: ' + JSON.stringify({ win, dock }));
  assert.ok(win.height < VH * 0.65 && win.height >= VH * 0.2, '팔레트를 열었는데 창이 줄지 않음: ' + win.height);
  assert.ok(dock.y + dock.height <= VH, '독이 화면 아래로 넘침');
  assert.equal(await pg.evaluate(() => getComputedStyle(document.getElementById('mirror-dock')).backgroundColor), 'rgba(0, 0, 0, 0)'); // 독 배경 투명
  assert.equal(await pg.evaluate(() => getComputedStyle(document.getElementById('mirror-dock')).backdropFilter), 'none');
  for (const b of await pg.locator('#mirror-dock button:visible').all()) assert.ok(((await b.boundingBox())?.height ?? 56) >= 56, '버튼 높이 56px 미만');
  await assertAchromatic(pg);
  // 팔레트 기능(ver3 와 같은 모듈): 물감 두 방울 → 비슷한 제품 → 그때도 겹치지 않음 → 다시 섞기
  await pg.click('#mirror-paints .paint >> nth=1');
  await pg.waitForTimeout(800);
  await pg.click('#mirror-paints .paint >> nth=8');
  await pg.waitForFunction(() => /#[0-9A-F]{6}/.test(document.getElementById('mirror-name').textContent) && !document.getElementById('mirror-find').disabled);
  await pg.click('#mirror-find');
  await pg.waitForSelector('#mirror-rec-list .m-card');
  await settle();
  win = await box('#mirror-stage');
  dock = await box('#mirror-dock');
  assert.ok(!overlap(win, dock), '비슷한 제품 독이 창과 겹침: ' + JSON.stringify({ win, dock }));
  await assertAchromatic(pg);
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/mirror-v4-portrait-result.png` });
  await pg.click('#mirror-back-mix');
  await settle();
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/mirror-v4-portrait-palette.png` });
  // 4) 가로 화면: 독이 창 오른쪽으로 가고, 창은 설정 높이(65dvh ±2%)로 돌아온다
  const LW = 1280, LH = 900;
  await pg.setViewportSize({ width: LW, height: LH });
  await settle();
  win = await box('#mirror-stage');
  dock = await box('#mirror-dock');
  assert.ok(Math.abs(win.height - LH * 0.65) <= LH * 0.02, '가로 화면 창 높이가 65dvh 가 아님: ' + win.height);
  assert.ok(Math.abs(win.y + win.height / 2 - LH * 0.4) <= LH * 0.02, '창 중심이 위에서 40% 가 아님: ' + JSON.stringify(win));
  assert.ok(dock.x >= win.x + win.width && !overlap(win, dock), '가로 화면 독이 창 오른쪽이 아님: ' + JSON.stringify({ win, dock }));
  assert.ok(dock.x + dock.width <= LW && dock.y >= 0 && dock.y + dock.height <= LH, '가로 화면 독이 화면을 넘음');
  for (const b of await pg.locator('#mirror-dock button:visible').all()) assert.ok(((await b.boundingBox())?.height ?? 56) >= 56, '가로 화면 버튼 높이 56px 미만');
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/mirror-v4-landscape-palette.png` });
  await pg.setViewportSize({ width: VW, height: VH });
  // 5) 직원 설정: 창 높이·위치 슬라이더, 창 픽셀 크기 표시, 저장 키 took.mirror4 (ver3 의 took.mirror 와 따로)
  await pg.evaluate(() => { const r = document.getElementById('ms-win-h'); r.value = '50'; r.dispatchEvent(new Event('input')); });
  assert.equal(await pg.evaluate(() => JSON.parse(localStorage.getItem('took.mirror4')).winH), 50);
  assert.equal(await pg.evaluate(() => JSON.parse(localStorage.getItem('took.mirror') || '{}').winH), undefined, 'ver3 설정 키에 ver4 값이 섞임');
  assert.match(await pg.textContent('#ms-win'), /\d+×\d+px/);
  await pg.evaluate(() => localStorage.removeItem('took.mirror4'));
  // 6) 유휴 초기화 → 대기, 스트림 정지, 독 숨김
  await pg.evaluate(() => document.querySelector('.nav-idle-test').click());
  await pg.waitForSelector('.idle-overlay');
  await pg.click('.idle-overlay .idle-actions button:not(.primary)');
  await pg.waitForFunction(() => document.body.dataset.mirror === 'standby');
  assert.ok(await pg.evaluate(() => window.__streams.length > 0
    && window.__streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended'))
    && document.getElementById('video').srcObject === null), '대기로 돌아왔는데 카메라 스트림이 멈추지 않음');
  assert.equal(await pg.isVisible('#mirror-dock'), false);
  await pg.close();
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
