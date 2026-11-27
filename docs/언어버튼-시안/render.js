// 시작 화면 언어 전환 버튼 시안 네 장 (2026-11-27): 한국어 · English · 中文 · 日本語 네 언어.
// 쓰는 법: 서버를 켠 뒤(3000번) took 폴더에서  node docs/언어버튼-시안/render.js
// 실제 시작 화면(영상 + 로고 + Tap The Screen)을 열고 그 위에 얹어 찍는다. 앱 코드는 바꾸지 않는다.
// 영상이 나오려면 크롬이 필요하다(설치된 크롬으로 연다, 없으면 영상 자리가 검게 찍힌다)
const { chromium } = require('playwright');
const path = require('path');

const CSS = `
  .hs-lang { display: none !important; }
  .m { position: absolute; z-index: 8; color: #fff; letter-spacing: -0.01em; font-family: inherit; }
  .m-tag { left: 40px; top: 56px; font-size: 26px; font-weight: 800; }
  .m-tag span { display: block; margin-top: 4px; font-size: 15px; font-weight: 500; color: rgba(255, 255, 255, 0.6); }
  /* A 오른쪽 위 네 칸 */
  .m-seg { right: 40px; top: 56px; height: 56px; padding: 5px; border-radius: 999px; background: rgba(0, 0, 0, 0.55); display: flex; }
  .m-seg span { height: 46px; padding: 0 18px; border-radius: 999px; display: flex; align-items: center; font-size: 17px; font-weight: 500; color: rgba(255, 255, 255, 0.75); }
  .m-seg span.on { background: #fff; color: #111; font-weight: 700; }
  /* B 아래 글자 줄 */
  .m-row { left: 0; right: 0; bottom: 150px; display: flex; justify-content: center; gap: 48px; font-size: 23px; font-weight: 500; }
  .m-row span { padding: 14px 4px; color: rgba(255, 255, 255, 0.6); }
  .m-row span.on { color: #fff; font-weight: 800; box-shadow: inset 0 -3px 0 #FF007B; }
  /* C 지구본 + 목록 */
  .m-globe { right: 40px; top: 56px; height: 56px; padding: 0 20px 0 16px; border-radius: 999px; background: rgba(0, 0, 0, 0.55); display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 600; }
  .m-globe svg { width: 24px; height: 24px; fill: none; stroke: #fff; stroke-width: 1.8; stroke-linecap: round; }
  .m-list { right: 40px; top: 124px; width: 240px; padding: 8px; border-radius: 24px; background: #fff; color: #111; box-shadow: 0 10px 34px -6px rgba(0, 0, 0, 0.7); }
  .m-list div { height: 60px; padding: 0 18px; border-radius: 16px; display: flex; align-items: center; justify-content: space-between; font-size: 18px; font-weight: 500; }
  .m-list div.on { background: #f3f3f3; font-weight: 800; }
  .m-list svg { width: 20px; height: 20px; fill: none; stroke: #111; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
  /* D 아래 동그라미 넷 */
  .m-dots { left: 0; right: 0; bottom: 120px; display: flex; justify-content: center; gap: 28px; }
  .m-dots div { display: flex; flex-direction: column; align-items: center; gap: 10px; font-size: 14px; font-weight: 500; color: rgba(255, 255, 255, 0.65); }
  .m-dots i { width: 88px; height: 88px; border-radius: 50%; background: rgba(0, 0, 0, 0.55); display: grid; place-items: center; font-style: normal; font-size: 26px; font-weight: 700; color: #fff; }
  .m-dots .on { color: #fff; font-weight: 700; }
  .m-dots .on i { background: #fff; color: #111; }
`;
const check = '<svg viewBox="0 0 20 20"><path d="m4 10.5 4 4 8-9"/></svg>';
const globe = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.800 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>';

const SHOTS = [
  { file: 'A-오른쪽위-네칸', tag: ['A 오른쪽 위 네 칸', '네 언어가 다 보이고 한 번에 바뀐다'],
    html: '<div class="m m-seg"><span class="on">한국어</span><span>English</span><span>中文</span><span>日本語</span></div>' },
  { file: 'B-아래-글자줄', tag: ['B 아래 글자 줄', '화면 아래 가운데, 지금 언어에 밑줄'],
    html: '<div class="m m-row"><span class="on">한국어</span><span>English</span><span>中文</span><span>日本語</span></div>' },
  { file: 'C-지구본-목록', tag: ['C 지구본 + 목록', '누르면 목록이 펼쳐진다 (펼친 모습)'],
    html: `<div class="m m-globe">${globe}한국어</div><div class="m m-list"><div class="on">한국어${check}</div><div>English</div><div>中文</div><div>日本語</div></div>` },
  { file: 'D-아래-동그라미', tag: ['D 아래 동그라미 넷', '크게 눌리는 버튼 넷'],
    html: '<div class="m m-dots"><div class="on"><i>한</i>한국어</div><div><i>EN</i>English</div><div><i>中</i>中文</div><div><i>日</i>日本語</div></div>' },
];

(async () => {
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(); }
  const page = await browser.newPage({ viewport: { width: 900, height: 1440 }, deviceScaleFactor: 1.5 });
  await page.goto('http://localhost:3000/index.html');
  await page.waitForTimeout(4500);
  await page.addStyleTag({ content: CSS });
  await page.evaluate(() => { const v = document.querySelector('video'); if (v) { v.pause(); v.currentTime = 8.8; } });
  await page.waitForTimeout(800);
  for (const s of SHOTS) {
    await page.evaluate(({ html, tag }) => {
      document.querySelectorAll('.m').forEach((e) => e.remove());
      document.getElementById('stage').insertAdjacentHTML('beforeend', html + `<div class="m m-tag">${tag[0]}<span>${tag[1]}</span></div>`);
    }, s);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(__dirname, s.file + '.png') });
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
