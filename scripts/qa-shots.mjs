// QA 스크린샷: 모든 화면을 900×1440(키오스크 기준)으로 찍어 screenshots/qa-날짜/ 에 저장한다.
// 서버(npm start, :3000)가 켜져 있어야 한다. 자동 테스트 브라우저라 device-frame.js 의 키오스크 틀 이동은 건너뛴다.
// 카메라는 크롬의 가짜 카메라(움직이는 테스트 화면)를 쓴다 → 실제 얼굴 인식 결과가 아니다.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:3000/';
const OUT = new URL(`../screenshots/qa-${process.env.DAY || '2026-11-15'}/`, import.meta.url);
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const shots = [];
async function shot(file, label, group, path, { lang = 'ko', theme = 'light', wait = 1800, act, full = false, note = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1440 }, permissions: ['camera', 'microphone'] });
  await ctx.addInitScript(([l, t]) => { sessionStorage.setItem('took.lang', l); localStorage.setItem('took.theme', t); }, [lang, theme]);
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push(String(e.message)));
  pg.on('console', (m) => { if (m.type() === 'error' && !/TensorFlow|404/.test(m.text())) errors.push(m.text()); });
  await pg.goto(BASE + path);
  await pg.waitForLoadState('networkidle').catch(() => {});
  await pg.waitForTimeout(wait);
  if (act) { await act(pg); await pg.waitForTimeout(1500); }
  await pg.screenshot({ path: fileURLToPath(new URL(file, OUT)), fullPage: full });
  const url = pg.url().replace(BASE, '');
  shots.push({ file, label, group, url, note, errors: [...new Set(errors)].slice(0, 3) });
  console.log('ok', file, errors.length ? 'ERR ' + errors[0] : '');
  await ctx.close();
}
const clickText = (t) => async (pg) => { await pg.getByRole('button', { name: t }).first().click(); };

// 1. 홈
await shot('01-home-standby.png', '홈 · 대기 화면', '홈', 'index.html', { note: '제품 태그 또는 터치 대기' });
await shot('02-home-dark.png', '홈 · 다크 모드', '홈', 'index.html', { theme: 'dark' });
await shot('03-home-en.png', '홈 · 영어', '홈', 'index.html', { lang: 'en' });
// 2. 팔레트
await shot('10-palette-camera.png', '팔레트 · 카메라(가짜 카메라)', '팔레트', 'palette.html', { wait: 4000, note: '크롬 테스트용 가짜 카메라 영상' });
await shot('11-palette-avatar.png', '팔레트 · 아바타 모드', '팔레트', 'palette.html', { wait: 3000, act: async (pg) => { await pg.locator('#use-avatar').click(); await pg.waitForTimeout(2500); } });
await shot('12-palette-avatar-tone.png', '팔레트 · 아바타에서 내 톤 추천', '팔레트', 'palette.html', { wait: 3000, act: async (pg) => { await pg.locator('#use-avatar').click(); await pg.waitForTimeout(2500); await pg.locator('#match').click(); } });
await shot('13-palette-picked.png', '팔레트 · 색 고름', '팔레트', 'palette.html', { wait: 3000, act: async (pg) => {
  await pg.locator('#use-avatar').click(); await pg.waitForTimeout(2000);
  const box = await pg.locator('#lip-paints').boundingBox(); await pg.mouse.click(box.x + box.width * 0.73, box.y + box.height / 2);
} });
await shot('14-palette-recommend.png', '팔레트 · 비슷한 제품 추천', '팔레트', 'palette.html', { wait: 3000, act: async (pg) => {
  await pg.locator('#use-avatar').click(); await pg.waitForTimeout(2000);
  const box = await pg.locator('#lip-paints').boundingBox(); await pg.mouse.click(box.x + box.width * 0.73, box.y + box.height / 2);
  await pg.waitForTimeout(800); await pg.locator('#find').click(); await pg.waitForTimeout(2000);
} });
await shot('15-palette-dark.png', '팔레트 · 다크 모드', '팔레트', 'palette.html', { theme: 'dark', wait: 3000, act: async (pg) => { await pg.locator('#use-avatar').click(); } });
await shot('16-palette-en.png', '팔레트 · 영어', '팔레트', 'palette.html', { lang: 'en', wait: 3000, act: async (pg) => { await pg.locator('#use-avatar').click(); } });
// 3. 제품·추천·호수
await shot('30-product.png', '제품 상세', '제품', 'product.html?id=OY-A000001001860', { full: true });
await shot('31-product-notfound.png', '제품 상세 · 없는 제품', '제품', 'product.html?id=zzz');
await shot('32-recommend.png', '색상 기반 추천', '제품', 'recommend.html?hex=%23CE322F', { full: true });
await shot('33-recommend-nohex.png', '색상 기반 추천 · 색 없음', '제품', 'recommend.html');
await shot('34-shades.png', '호수 안내', '제품', 'shades.html?id=D001');
await shot('35-shades-empty.png', '호수 안내 · 정보 없음', '제품', 'shades.html');
// 5. 기타 화면
await shot('40-lip-together.png', '립 컬러 매핑 (lip-together)', '기타', 'lip-together.html', { wait: 4000, full: true });
await shot('42-calib.png', '터치 보정 (calib)', '기타', 'calib.html');
await shot('43-preview.png', '거울 미리보기 (preview)', '기타', 'preview.html', { wait: 3000 });
await shot('44-kiosk.png', '키오스크 틀 (kiosk)', '기타', 'kiosk.html?page=index.html', { wait: 3000 });

await writeFile(new URL('shots.json', OUT), JSON.stringify(shots, null, 2));
await browser.close();
