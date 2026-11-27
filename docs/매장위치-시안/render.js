// 매장 위치 · 재고 화면 시안을 "실제 툭 화면 위에" 얹어서 PNG 로 찍는다 (2026-11-27).
// 쓰는 법: 서버를 켠 뒤(npm start, 3000번) took 폴더에서  node docs/매장위치-시안/render.js
// 실제 거울 화면을 열어 추천 카드의 '매장 위치 · 재고 보기'를 누르고, 제품 카드 아래 부분만 시안으로 바꿔 끼운다.
// 그래서 로고 버튼·흰 시트·제품 카드·글꼴은 앱 그대로다. 시안은 그림일 뿐 앱 코드는 바꾸지 않는다
const { chromium } = require('playwright');
const path = require('path');

const CSS = `
  .v { position: absolute; left: 44px; right: 44px; top: 230px; bottom: 36px; display: flex; gap: 16px; }
  .v .t { border-radius: 24px; background: #f3f3f3; }
  .v .l { font-size: 13px; font-weight: 500; color: #8a8a8e; letter-spacing: -0.01em; }
  .v .rows { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0 26px; }
  .v .row { display: flex; align-items: center; justify-content: space-between; padding: 17px 0; border-top: 1px solid #e2e2e5; font-size: 15px; font-weight: 500; color: #6b6b70; }
  .v .row:first-child { border-top: 0; }
  .v .row b { font-size: 19px; font-weight: 800; color: #111; letter-spacing: -0.02em; }
  .v svg text { font-family: inherit; }
  .v .step { flex: 1; padding: 0 26px; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
  .v .step b { font-size: 26px; line-height: 1.2; font-weight: 800; letter-spacing: -0.02em; }
  .v .step span:last-child { font-size: 14px; font-weight: 500; color: #6b6b70; }
  .v .lift { background: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4), 0 10px 34px -6px rgba(0, 0, 0, 0.7), 0 0 22px rgba(0, 0, 0, 0.35); }
  .v .chev { flex: none; width: 16px; align-self: center; margin: 0 -4px; fill: none; stroke: #8a8a8e; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .v-stat { margin-left: auto; display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 500; color: #6b6b70; }
  .v-stat b { font-weight: 800; color: #111; }
  .v-stat i { width: 8px; height: 8px; border-radius: 50%; background: #111; }
  .v-stat.out i { background: #c4c4c8; }
  .fc-sh-top { right: 44px; }
  .v-tag { position: absolute; left: 44px; top: 836px; z-index: 9; color: #fff; font-size: 30px; font-weight: 800; letter-spacing: -0.02em; }
  .v-tag span { display: block; margin-top: 6px; font-size: 16px; font-weight: 500; color: #9b9ba1; letter-spacing: -0.01em; }
`;

const rows = (list) => `<div class="t rows">${list.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
const chev = '<svg class="chev" viewBox="0 0 16 24"><path d="m4 6 6 6-6 6"/></svg>';

// A 지도형: 평면도(흰 진열대, 제품 자리만 핑크 점) + 오른쪽은 추천 카드처럼 '얇은 선으로 나눈 줄'
const A = (hex) => `<div class="v">
  <svg class="t" viewBox="0 0 400 242" width="400" height="242" style="flex:none">
    <g fill="#fff"><rect x="46" y="40" width="50" height="116" rx="12"/><rect x="132" y="40" width="50" height="116" rx="12"/><rect x="218" y="40" width="50" height="116" rx="12"/><rect x="304" y="40" width="50" height="116" rx="12"/></g>
    <g font-size="13" font-weight="500" fill="#8a8a8e" text-anchor="middle"><text x="71" y="28">A</text><text x="157" y="28">B</text><text x="243" y="28">C</text></g>
    <text x="329" y="28" font-size="13" font-weight="800" fill="#111" text-anchor="middle">D</text>
    <path d="M200 202 H286 V118 H312" fill="none" stroke="#111" stroke-width="2.4" stroke-dasharray="0.1 8" stroke-linecap="round"/>
    <circle cx="329" cy="118" r="15" fill="#FF007B" opacity=".16"/><circle cx="329" cy="118" r="8" fill="#FF007B"/>
    <circle cx="200" cy="202" r="8" fill="#111"/><circle cx="200" cy="202" r="3" fill="#fff"/>
    <text x="182" y="207" font-size="13" font-weight="700" fill="#111" text-anchor="end">지금 여기</text>
  </svg>
  ${rows([['진열대', 'D-4'], ['칸', '위에서 4번째'], ['이 매장 재고', '4개']])}
</div>`;

// B 진열대형: 진열대 그림(제품 자리는 호수 색 + 검정 테) + 같은 줄 목록
const B = (hex) => {
  const y = [50, 98, 146, 194];
  const xs = [[70, 98, 126, 182, 210], [70, 126, 154, 210], [98, 126, 182], [70, 98, 210]];
  const items = xs.map((r, i) => r.map((x) => `<rect x="${x}" y="${y[i] - 30}" width="16" height="30" rx="4"/>`).join('')).join('');
  return `<div class="v">
  <svg class="t" viewBox="0 0 300 242" width="300" height="242" style="flex:none">
    <rect x="52" y="14" width="196" height="194" rx="14" fill="#fff"/>
    <g stroke="#e2e2e5" stroke-width="2">${y.slice(0, 3).map((v) => `<path d="M52 ${v + 4}H248"/>`).join('')}</g>
    <g fill="#e4e4e7">${items}</g>
    <rect x="147" y="158" width="30" height="42" rx="9" fill="#fff" stroke="#111" stroke-width="2.4"/>
    <rect x="154" y="164" width="16" height="30" rx="4" fill="${hex}"/>
    <g font-size="12" font-weight="500" fill="#b0b0b5" text-anchor="middle"><text x="32" y="40">1</text><text x="32" y="88">2</text><text x="32" y="136">3</text></g>
    <text x="32" y="184" font-size="12" font-weight="800" fill="#111" text-anchor="middle">4</text>
    <text x="150" y="230" font-size="13" font-weight="500" fill="#8a8a8e" text-anchor="middle">D-4 진열대</text>
  </svg>
  ${rows([['코너', '립 메이크업'], ['진열대', 'D-4'], ['칸', '위에서 4번째'], ['이 매장 재고', '4개']])}
</div>`;
};

// C 길 안내형: 추천 카드 같은 연회색 칸 셋, 마지막 칸만 '지금 바르고 있어요' 카드처럼 떠오른다
const C = () => `<div class="v" style="gap:14px; padding:6px 0 14px">
  <div class="t step"><span class="l">통로</span><b>D 통로</b><span>립 메이크업 코너</span></div>${chev}
  <div class="t step"><span class="l">진열대</span><b>D-4</b><span>입구 쪽에서 4번째</span></div>${chev}
  <div class="t step lift"><span class="l">칸</span><b>4번째 칸</b><span>위에서부터</span></div>
</div>`;

// 품절일 때: 가장 가까운 구매 가능 매장만 떠오르고, 다른 매장은 같은 줄 목록
const D = () => `<div class="v" style="padding:6px 0 14px">
  <div class="t step lift" style="flex:1.1"><span class="l">가장 가까운 구매 가능 매장</span><b>올리브영 중앙로점</b><span>걸어서 10분 · 720m · 22:00까지</span>
    <span style="margin-top:10px; font-size:15px; color:#6b6b70">재고 <b style="font-size:19px; color:#111">14개</b></span></div>
  ${rows([['시청점 · 도보 16분', '8개'], ['터미널점 · 도보 25분', '3개'], ['대학로점 · 도보 34분', '1개']])}
</div>`;

const SHOTS = [
  { file: 'A-지도형', tag: ['A 지도형', '평면도에서 진열대 자리를 짚어 준다'], card: 0, body: A },
  { file: 'B-진열대형', tag: ['B 진열대형', '진열대 그림에서 제품이 놓인 칸을 짚어 준다'], card: 0, body: B },
  { file: 'C-길안내형', tag: ['C 길 안내형', '통로 → 진열대 → 칸, 가는 순서대로'], card: 0, body: C, stat: '<i></i>이 매장 재고 <b>4개</b>' },
  { file: '품절일때', tag: ['이 매장이 품절일 때', '가장 가까운 구매 가능 매장을 먼저'], card: 5, body: D, stat: '<i></i>이 매장은 품절이에요', out: true },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1440 }, deviceScaleFactor: 2 });
  for (const s of SHOTS) {
    await page.goto('http://localhost:3000/palette.html?mode=recs');
    await page.waitForSelector('#rec-list .more-shades');
    await page.addStyleTag({ content: CSS });
    await page.evaluate((i) => document.querySelectorAll('#rec-list .more-shades')[i].click(), s.card);
    await page.waitForTimeout(1200);
    await page.evaluate(({ html, tag, stat, out }) => {
      const view = document.querySelector('.fc-shades');
      view.querySelectorAll('.fc-st-pick, .fc-st-here, .fc-st-list').forEach((e) => e.remove());
      view.insertAdjacentHTML('beforeend', html);
      if (stat) view.querySelector('.fc-sh-top').insertAdjacentHTML('beforeend', `<span class="v-stat${out ? ' out' : ''}">${stat}</span>`);
      document.getElementById('stage').insertAdjacentHTML('beforeend', `<div class="v-tag">${tag[0]}<span>${tag[1]}</span></div>`);
    }, { html: s.body(await page.evaluate(() => document.querySelector('.fc-sh-now > i')?.style.background || '#D2617C')), tag: s.tag, stat: s.stat, out: s.out });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(__dirname, s.file + '.png'), clip: { x: 0, y: 800, width: 900, height: 640 } });
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
