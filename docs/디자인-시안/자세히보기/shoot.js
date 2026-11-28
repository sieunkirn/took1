// 시안 HTML → PNG (900×1440). 실행: node docs/디자인-시안/자세히보기/shoot.js (프로젝트 폴더 took/ 에서)
const path = require('path');
const { chromium } = require(path.join(__dirname, '../../../node_modules/playwright'));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1440 } });
  const arg = process.argv[2] || 'ABCD'; // 'EFGH' 처럼 한 글자씩, 또는 'H1,H2,H3' 처럼 쉼표로
  for (const k of (arg.includes(',') ? arg.split(',') : arg.split('')).filter(Boolean)) {
    await page.goto('file:///' + path.join(__dirname, `시안${k}.html`).replace(/\\/g, '/'));
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(__dirname, `시안${k}.png`) });
    console.log('saved', k);
  }
  await browser.close();
})();
