// 매장 위치 · 재고 화면 '더 직관적으로' 시안 (2026-11-27). 지금의 A 지도형(평면도 + 표 세 줄)에서 한 걸음 더.
// 쓰는 법: 서버를 켠 뒤(3000번) took 폴더에서  node docs/매장위치-시안/render-2.js
// render.js 와 같은 방식: 실제 거울 화면을 열고 제품 카드 아래만 시안으로 바꿔 끼워 찍는다. 앱 코드는 바꾸지 않는다
const { chromium } = require('playwright');
const path = require('path');

const CSS = `
  .w-say { position: absolute; left: 50px; right: 50px; top: 226px; display: flex; align-items: center; justify-content: space-between; font-size: 20px; font-weight: 500; letter-spacing: -0.02em; color: #111; }
  .w-say b { font-weight: 800; }
  .w-stock { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 500; color: #6b6b70; }
  .w-stock b { color: #111; font-weight: 800; }
  .w-stock i { width: 8px; height: 8px; border-radius: 50%; background: #111; }
  .w { position: absolute; left: 44px; right: 44px; top: 270px; bottom: 30px; display: flex; gap: 14px; }
  .w .t { position: relative; border-radius: 24px; background: #f3f3f3; overflow: hidden; }
  .w svg { display: block; }
  .w svg text { font-family: inherit; font-size: 13px; font-weight: 500; fill: #8a8a8e; }
  .w svg text.on { font-weight: 800; fill: #111; }
  .w .cap { position: absolute; left: 22px; bottom: 16px; font-size: 13px; font-weight: 500; color: #8a8a8e; }
  .w .cap b { display: block; margin-top: 2px; font-size: 19px; font-weight: 800; color: #111; letter-spacing: -0.02em; }
  .w .chev { flex: none; width: 16px; align-self: center; margin: 0 -3px; fill: none; stroke: #8a8a8e; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .w .go { flex: none; width: 270px; padding: 0 26px; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
  .w .go .l { font-size: 13px; font-weight: 500; color: #8a8a8e; }
  .w .go b { font-size: 30px; line-height: 1.2; font-weight: 800; letter-spacing: -0.03em; }
  .w .go span:last-child { font-size: 15px; font-weight: 500; color: #6b6b70; }
  .v-tag { position: absolute; left: 44px; top: 836px; z-index: 9; color: #fff; font-size: 30px; font-weight: 800; letter-spacing: -0.02em; }
  .v-tag span { display: block; margin-top: 6px; font-size: 16px; font-weight: 500; color: #9b9ba1; letter-spacing: -0.01em; }
`;

const say = '<div class="w-say"><span><b>D 통로</b> 진열대, <b>위에서 4번째 칸</b>에 있어요</span><span class="w-stock"><i></i>이 매장 재고 <b>4개</b></span></div>';
const chev = '<svg class="chev" viewBox="0 0 16 24" width="16" height="24"><path d="m4 6 6 6-6 6"/></svg>';
// 제품 사진이 들어간 동그란 핀 (핑크 테)
const photoPin = (id, img, x, y, r) => `<clipPath id="${id}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath>`
  + `<circle cx="${x}" cy="${y}" r="${r + 9}" fill="#FF007B" opacity=".16"/><circle cx="${x}" cy="${y}" r="${r + 3}" fill="#FF007B"/>`
  + `<image href="${img}" x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
const me = (x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="#111"/><circle cx="${x}" cy="${y}" r="3.4" fill="#f3f3f3"/>`;

// 1 한 문장 + 큰 지도: 답을 문장으로 먼저 말하고, 평면도를 시트 폭 가득. 핀은 제품 사진, 입구·계산대 같은 기준점을 넣는다
const V1 = ({ img }) => `${say}<div class="w"><div class="t" style="flex:1">
  <svg viewBox="0 0 812 208" width="812" height="208">
    <g fill="#fff">${[150, 310, 470, 630].map((x) => `<rect x="${x}" y="30" width="96" height="104" rx="14"/>`).join('')}</g>
    <g text-anchor="middle"><text x="198" y="22">A</text><text x="358" y="22">B</text><text x="518" y="22">C</text><text class="on" x="678" y="22">D</text></g>
    <rect x="24" y="30" width="70" height="104" rx="14" fill="#e9e9ec"/><text x="59" y="87" text-anchor="middle">계산대</text>
    <rect x="356" y="196" width="100" height="6" rx="3" fill="#c9c9cd"/><text x="406" y="188" text-anchor="middle">입구</text>
    <path d="M250 168 H600 V96 H640" fill="none" stroke="#111" stroke-width="2.6" stroke-dasharray="0.1 9" stroke-linecap="round" stroke-linejoin="round"/>
    ${photoPin('p1', img, 672, 96, 22)}
    ${me(250, 168)}<text class="on" x="232" y="173" text-anchor="end">지금 여기</text>
  </svg></div></div>`;

// 2 확대형: '어디로 걸어가나'(평면도) → '어디를 보나'(진열대 확대) 두 그림을 순서대로. 진열대 칸에 제품 사진이 놓여 있다
const V2 = ({ img }) => {
  const y = [42, 86, 130, 174];
  const xs = [[40, 72, 104, 168, 200], [40, 104, 136, 200], [72, 104, 168], [40, 72, 200]];
  return `${say}<div class="w">
  <div class="t" style="flex:1">
    <svg viewBox="0 0 392 208" width="392" height="208">
      <g fill="#fff">${[150, 208, 266, 324].map((x) => `<rect x="${x}" y="30" width="40" height="110" rx="10"/>`).join('')}</g>
      <g text-anchor="middle"><text x="170" y="22">A</text><text x="228" y="22">B</text><text x="286" y="22">C</text><text class="on" x="344" y="22">D</text></g>
      <path d="M232 172 H310 V96 H326" fill="none" stroke="#111" stroke-width="2.4" stroke-dasharray="0.1 8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="344" cy="96" r="14" fill="#FF007B" opacity=".16"/><circle cx="344" cy="96" r="7" fill="#FF007B"/>
      ${me(232, 172)}
    </svg><div class="cap">먼저<b>D 통로로</b></div></div>
  ${chev}
  <div class="t" style="flex:1">
    <svg viewBox="0 0 392 208" width="392" height="208"><g transform="translate(150 0)">
      <rect x="20" y="10" width="216" height="172" rx="14" fill="#fff"/>
      <g stroke="#e2e2e5" stroke-width="2">${y.slice(0, 3).map((v) => `<path d="M20 ${v + 6}H236"/>`).join('')}</g>
      <g fill="#e4e4e7">${xs.map((r, i) => r.map((x) => `<rect x="${x}" y="${y[i] - 26}" width="18" height="28" rx="5"/>`).join('')).join('')}</g>
      ${photoPin('p2', img, 145, 160, 17)}
      <g text-anchor="middle"><text x="4" y="34">1</text><text x="4" y="78">2</text><text x="4" y="122">3</text><text class="on" x="4" y="166">4</text></g>
    </g></svg><div class="cap">그다음<b>위에서 4번째 칸</b></div></div>
</div>`;
};

// 3 방향형: 거울 앞에 선 사람 기준으로 '어느 쪽으로 몇 걸음'을 가장 크게. 평면도는 오른쪽에 보조로
const V3 = ({ img }) => `<div class="w" style="top:230px; bottom:36px">
  <div class="t go" style="width:330px">
    <svg viewBox="0 0 64 64" width="64" height="64" style="margin-bottom:10px"><circle cx="32" cy="32" r="32" fill="#111"/><path d="M22 42 42 22M26 22h16v16" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span class="l">거울을 등지고</span><b>오른쪽으로 8걸음</b><span><b style="font-size:15px; font-weight:800; color:#111">D 통로</b> · 위에서 <b style="font-size:15px; font-weight:800; color:#111">4번째 칸</b> · 재고 <b style="font-size:15px; font-weight:800; color:#111">4개</b></span>
  </div>
  <div class="t" style="flex:1">
    <svg viewBox="0 0 468 242" width="468" height="242">
      <g fill="#fff">${[70, 164, 258, 352].map((x) => `<rect x="${x}" y="40" width="58" height="116" rx="12"/>`).join('')}</g>
      <g text-anchor="middle"><text x="99" y="28">A</text><text x="193" y="28">B</text><text x="287" y="28">C</text><text class="on" x="381" y="28">D</text></g>
      <path d="M234 204 H332 V112 H356" fill="none" stroke="#111" stroke-width="2.4" stroke-dasharray="0.1 8" stroke-linecap="round" stroke-linejoin="round"/>
      ${photoPin('p3', img, 381, 112, 20)}
      ${me(234, 204)}<text class="on" x="216" y="209" text-anchor="end">지금 여기</text>
    </svg></div>
</div>`;

const SHOTS = [
  { file: '디벨롭-1-한문장+큰지도', tag: ['1 한 문장 + 큰 지도', '답을 문장으로 먼저, 핀은 제품 사진'], body: V1 },
  { file: '디벨롭-2-확대형', tag: ['2 확대형', '어디로 걸어가나 → 어디를 보나'], body: V2 },
  { file: '디벨롭-3-방향형', tag: ['3 방향형', '거울 앞에 선 사람 기준으로 몇 걸음'], body: V3 },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1440 }, deviceScaleFactor: 2 });
  for (const s of SHOTS) {
    await page.goto('http://localhost:3000/palette.html?mode=recs');
    await page.waitForSelector('#rec-list .more-shades');
    await page.addStyleTag({ content: CSS });
    await page.evaluate(() => document.querySelector('#rec-list .more-shades').click());
    await page.waitForTimeout(1200);
    const img = await page.evaluate(() => document.querySelector('.fc-sh-img').src);
    await page.evaluate(({ html, tag }) => {
      const view = document.querySelector('.fc-shades');
      view.querySelectorAll('.fc-st-a, .fc-st-stat, .fc-st-note').forEach((e) => e.remove());
      view.insertAdjacentHTML('beforeend', html);
      document.getElementById('stage').insertAdjacentHTML('beforeend', `<div class="v-tag">${tag[0]}<span>${tag[1]}</span></div>`);
    }, { html: s.body({ img }), tag: s.tag });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(__dirname, s.file + '.png'), clip: { x: 0, y: 800, width: 900, height: 640 } });
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
