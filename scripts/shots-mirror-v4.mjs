// 거울 ver4 스크린샷 (screenshots/): 대기·체험·팔레트 열림을 태블릿 세로·가로 두 방향으로
// 실행: node scripts/shots-mirror-v4.mjs   (Chromium 가짜 카메라라 영상은 테스트 무늬)
import '../test/use-virtual-data.js';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.js';

const { chromium } = createRequire(import.meta.url)('playwright');
const server = createApp().listen(0);
await new Promise((r) => server.once('listening', r));
const BASE = `http://localhost:${server.address().port}`;
const OUT = fileURLToPath(new URL('../screenshots/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });

for (const [name, vp] of [['portrait', { width: 800, height: 1280 }], ['landscape', { width: 1280, height: 800 }]]) {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.grantPermissions(['camera'], { origin: BASE });
  const pg = await ctx.newPage();
  await pg.goto(BASE + '/mirror-v4.html');
  await pg.waitForLoadState('networkidle');
  await pg.screenshot({ path: OUT + `mirror-v4-${name}-standby.png` });
  await pg.mouse.click(vp.width / 2, vp.height * 0.4);
  await pg.waitForFunction(() => document.body.dataset.mirror === 'live' && document.getElementById('view').width > 0, null, { timeout: 15000 });
  await pg.waitForTimeout(1200); // 페이드인 0.6초 + 창 전환 0.3초
  await pg.screenshot({ path: OUT + `mirror-v4-${name}-palette.png` }); // 시작하면 팔레트가 바로 뜬다
  // 체험(독 메인 줄): 팔레트 대신 메인 줄을 보여 창이 설정 높이(65dvh)일 때
  await pg.evaluate(() => {
    for (const id of ['mirror-palette', 'mirror-panel', 'mirror-result', 'mirror-product']) document.getElementById(id).classList.add('hidden');
    document.getElementById('mirror-main').classList.remove('hidden');
  });
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: OUT + `mirror-v4-${name}-live.png` });
  await ctx.close();
}
await browser.close();
server.close();
console.log('screenshots/mirror-v4-{portrait,landscape}-{standby,live,palette}.png');
