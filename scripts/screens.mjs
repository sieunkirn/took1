// 모든 화면을 세로 키오스크 크기(800×1280)로 찍어 screenshots/ 에 저장한다.
// 쓰는 법: 서버를 켠 뒤  BASE=http://localhost:3000 node scripts/screens.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = new URL('../screenshots/', import.meta.url);
mkdirSync(fileURLToPath(OUT), { recursive: true });

const PAGES = [
  ['01-home', '/index.html'],
  ['02-palette', '/palette.html'],
  ['03-chat', '/chat.html'],
  ['04-shades', '/shades.html'],
  ['05-recommend', '/recommend.html?hex=%23B3122E'],
  ['06-product', '/product.html?id=P001'],
  ['07-lip-together', '/lip-together.html'],
  ['08-studio', '/studio.html'],
  // ['09-preview', '/preview.html', { width: 1440, height: 900 }], // 거울 화면 미리보기: 2026-11-13 주석 처리
  ['10-kiosk', '/kiosk.html'],
  ['11-calib', '/calib.html'],
];

const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
for (const [name, path, viewport = { width: 800, height: 1280 }] of PAGES) {
  const ctx = await browser.newContext({ viewport });
  await ctx.grantPermissions(['camera'], { origin: BASE });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1800);
  await page.screenshot({ path: fileURLToPath(new URL(name + '.png', OUT)) });
  console.log(name, '→', page.url().replace(BASE, ''));
  await ctx.close();
}
await browser.close();
