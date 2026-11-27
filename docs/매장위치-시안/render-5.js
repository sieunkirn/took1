// 품절 카드 '가까운 매장' 말풍선을 더 깔끔하게 다듬은 시안 세 장 (2026-11-27).
// 쓰는 법: 서버를 켠 뒤(3000번) took 폴더에서  node docs/매장위치-시안/render-5.js
// 실제 거울 화면 위에 얹어 찍는다(오른쪽 위 카드를 품절로 바꿔 놓고 그 위에 그린다). 앱 코드는 바꾸지 않는다
const { chromium } = require('playwright');
const path = require('path');

const CSS = `
  .v-tag { position: absolute; left: 44px; top: 836px; z-index: 9; color: #fff; font-size: 30px; font-weight: 800; letter-spacing: -0.02em; }
  .v-tag span { display: block; margin-top: 6px; font-size: 16px; font-weight: 500; color: #9b9ba1; letter-spacing: -0.01em; }
  .q { position: absolute; z-index: 6; letter-spacing: -0.01em; white-space: nowrap; }
  .q::after { content: ""; position: absolute; right: 26px; bottom: -5px; width: 10px; height: 10px; transform: rotate(45deg); border-radius: 2px; background: inherit; }
  .q b { font-weight: 800; }
  /* a 흰 두 줄: 흰 바탕 · 얇은 테 · 옅은 그림자. 매장 이름 한 줄 + 회색 한 줄 */
  .q-a { background: #fff; color: #111; border-radius: 16px; padding: 12px 16px; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1), 0 8px 20px -6px rgba(0, 0, 0, 0.28); }
  .q-a::after { box-shadow: 1px 1px 0 rgba(0, 0, 0, 0.1); }
  .q-a .n { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; font-size: 15px; font-weight: 700; }
  .q-a .n b { font-size: 15px; }
  .q-a .m { display: block; margin-top: 3px; font-size: 13px; font-weight: 500; color: #8a8a8e; }
  /* b 검정 한 줄: 작은 알약 하나 */
  .q-b { background: #111; color: #fff; border-radius: 999px; height: 40px; padding: 0 16px; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; }
  .q-b .d { opacity: .45; }
  /* c 흰 한 줄: 가장 가볍게 */
  .q-c { background: #fff; color: #111; border-radius: 999px; height: 40px; padding: 0 16px; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1), 0 8px 20px -6px rgba(0, 0, 0, 0.28); }
  .q-c::after { box-shadow: 1px 1px 0 rgba(0, 0, 0, 0.1); }
  .q-c .d { color: #c4c4c8; }
  .q-c .g { color: #6b6b70; }
`;
const chev = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>';
const outRow = `<span><i class="stock-dot" aria-hidden="true"></i>품절</span><span class="more-shades-n">가까운 매장</span>${chev}`;

const SHOTS = [
  { file: '말풍선-a-흰-두줄', tag: ['a 흰 말풍선 · 두 줄', '흰 바탕, 얇은 테, 매장 이름과 재고를 한 줄에'], cls: 'q-a',
    html: '<span class="n">올리브영 중앙로점<b>14개</b></span><span class="m">도보 10분 · 720m</span>' },
  { file: '말풍선-b-검정-한줄', tag: ['b 검정 알약 · 한 줄', '작은 알약 하나로 끝'], cls: 'q-b',
    html: '<b>중앙로점</b><span class="d">·</span>도보 10분<span class="d">·</span><b>14개</b>' },
  { file: '말풍선-c-흰-한줄', tag: ['c 흰 알약 · 한 줄', '가장 가볍게'], cls: 'q-c',
    html: '<b>중앙로점</b><span class="d">·</span><span class="g">도보 10분</span><span class="d">·</span><b>14개</b>' },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1440 }, deviceScaleFactor: 2 });
  for (const s of SHOTS) {
    await page.goto('http://localhost:3000/palette.html?mode=recs');
    await page.waitForSelector('#rec-list .more-shades');
    await page.addStyleTag({ content: CSS });
    await page.waitForTimeout(1200);
    await page.evaluate(({ s, outRow }) => {
      const card = document.querySelectorAll('#rec-list .card')[1];
      const row = document.createElement('button');
      row.type = 'button'; row.className = 'more-shades stock-out'; row.innerHTML = outRow;
      card.querySelector('.more-shades').replaceWith(row);
      const c = card.getBoundingClientRect(); const r = row.getBoundingClientRect();
      const t = document.createElement('div'); t.className = 'q ' + s.cls; t.innerHTML = s.html; card.append(t);
      t.style.right = (c.right - r.right - 6) + 'px'; t.style.bottom = (c.bottom - r.top + 4) + 'px';
      document.getElementById('stage').insertAdjacentHTML('beforeend', `<div class="v-tag">${s.tag[0]}<span>${s.tag[1]}</span></div>`);
    }, { s, outRow });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(__dirname, s.file + '.png'), clip: { x: 0, y: 800, width: 900, height: 640 } });
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
