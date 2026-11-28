// 애니메이션 후보 시안 → PNG. 실행: (took/ 에서 서버 켠 뒤) node docs/로고버튼-시안/애니메이션/shoot.js
// 1) 실제 거울 화면(localhost:3000/palette.html) 아랫부분을 base.png 로 찍고 2) sheet.html 을 PNG 로 찍는다
const path = require('path');
const { chromium } = require(path.join(__dirname, '../../../node_modules/playwright'));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1440 } });
  if (!process.argv.includes('--sheet-only')) {
    await page.goto('http://localhost:3000/palette.html');
    await page.waitForTimeout(2500);
    await page.addStyleTag({ content: '.fc-sbtn::before,.fc-sbtn::after{display:none!important}.fc-sbtn>.fc-sbtn-logo{animation:none!important}' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(__dirname, 'base.png'), clip: { x: 150, y: 880, width: 600, height: 560 } });
    console.log('base saved, url', page.url());
  }
  const p2 = await browser.newPage({ viewport: { width: 2400, height: 1000 } });
  const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).toUpperCase(); // --only=AFG → 그 후보만 모은 그림
  await p2.goto(require('url').pathToFileURL(path.join(__dirname, 'sheet.html')).href + (only ? '#' + only : ''));
  await p2.evaluate(() => document.fonts.ready);
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: path.join(__dirname, only ? `로고버튼-애니메이션-${only}.png` : '로고버튼-애니메이션-후보.png'), fullPage: true });
  console.log('sheet saved');
  await browser.close();
})();
