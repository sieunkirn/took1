// 품절 카드의 '가까운 매장'을 눌렀을 때 "새 화면 말고 그 자리에서 알려 주는" 시안 네 장 (2026-11-27).
// 쓰는 법: 서버를 켠 뒤(3000번) took 폴더에서  node docs/매장위치-시안/render-4.js
// 실제 거울 화면 위에 얹어 찍는다(오른쪽 위 카드를 품절로 바꿔 놓고 그 위에 그린다). 앱 코드는 바꾸지 않는다
const { chromium } = require('playwright');
const path = require('path');

const CSS = `
  .v-tag { position: absolute; left: 44px; top: 836px; z-index: 9; color: #fff; font-size: 30px; font-weight: 800; letter-spacing: -0.02em; }
  .v-tag span { display: block; margin-top: 6px; font-size: 16px; font-weight: 500; color: #9b9ba1; letter-spacing: -0.01em; }
  .q { position: absolute; z-index: 6; font-family: inherit; letter-spacing: -0.01em; }
  .q .l { display: block; font-size: 12px; font-weight: 500; opacity: .6; }
  .q b { font-weight: 800; }
  /* 1 말풍선 */
  .q-tip { background: #111; color: #fff; border-radius: 18px; padding: 14px 18px; width: 268px; }
  .q-tip::after { content: ""; position: absolute; right: 34px; bottom: -7px; width: 16px; height: 16px; background: #111; transform: rotate(45deg); border-radius: 3px; }
  .q-tip .n { display: block; margin: 3px 0 2px; font-size: 18px; font-weight: 800; }
  .q-tip .m { font-size: 13px; font-weight: 500; opacity: .75; }
  /* 3 카드 덮개 */
  .q-cover { inset: 0; border-radius: 24px; background: #fff; padding: 20px 24px; display: flex; flex-direction: column;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4), 0 10px 34px -6px rgba(0, 0, 0, 0.7), 0 0 22px rgba(0, 0, 0, 0.35); }
  .q-cover .h { display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .q-cover .x { width: 34px; height: 34px; border-radius: 50%; background: #f3f3f3; display: grid; place-items: center; }
  .q-cover .x svg { width: 16px; height: 16px; fill: none; stroke: #111; stroke-width: 2.4; stroke-linecap: round; }
  .q-cover .r { flex: 1; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #e2e2e5; font-size: 14px; font-weight: 500; color: #6b6b70; }
  .q-cover .r:first-of-type { border-top: 0; }
  .q-cover .r b { font-size: 17px; color: #111; }
  .q-cover .r .s { color: #111; font-weight: 700; font-size: 15px; }
  /* 4 아래 알림 바 */
  .q-bar { left: 44px; right: 44px; bottom: 28px; height: 68px; border-radius: 999px; background: #111; color: #fff; display: flex; align-items: center; gap: 14px; padding: 0 28px; font-size: 16px; font-weight: 500; }
  .q-bar i { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #fff; }
  .q-bar .m { opacity: .7; font-size: 14px; }
  .q-bar b { margin-left: auto; font-size: 17px; }
`;
const chev = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>';
const outRow = `<span><i class="stock-dot" aria-hidden="true"></i>품절</span><span class="more-shades-n">가까운 매장</span>${chev}`;

const SHOTS = [
  { file: '그자리-1-말풍선', tag: ['1 말풍선', '누른 줄 바로 위에 뜬다 · 다른 곳을 누르면 닫힘'], kind: 'tip' },
  { file: '그자리-2-줄이-바뀜', tag: ['2 줄이 바뀜', '누른 줄이 그 자리에서 매장 안내로 바뀐다'], kind: 'swap' },
  { file: '그자리-3-카드-덮개', tag: ['3 카드 덮개', '그 카드 위에만 매장 목록이 덮인다'], kind: 'cover' },
  { file: '그자리-4-아래-알림-바', tag: ['4 아래 알림 바', '시트 아래에 잠깐 떴다가 사라진다'], kind: 'bar' },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1440 }, deviceScaleFactor: 2 });
  for (const s of SHOTS) {
    await page.goto('http://localhost:3000/palette.html?mode=recs');
    await page.waitForSelector('#rec-list .more-shades');
    await page.addStyleTag({ content: CSS });
    await page.waitForTimeout(1200);
    await page.evaluate(({ kind, tag, outRow }) => {
      const card = document.querySelectorAll('#rec-list .card')[1];
      const old = card.querySelector('.more-shades');
      const row = document.createElement('button');
      row.type = 'button'; row.className = 'more-shades stock-out'; row.innerHTML = outRow;
      old.replaceWith(row);
      const add = (host, cls, html) => { const d = document.createElement('div'); d.className = 'q ' + cls; d.innerHTML = html; host.append(d); return d; };
      if (kind === 'tip') {
        const c = card.getBoundingClientRect(); const r = row.getBoundingClientRect();
        const t = add(card, 'q-tip', '<span class="l">가장 가까운 구매 가능 매장</span><span class="n">올리브영 중앙로점</span><span class="m">도보 10분 · 720m · 재고 <b>14개</b></span>');
        t.style.right = (c.right - r.right - 4) + 'px'; t.style.bottom = (c.bottom - r.top + 12) + 'px';
      } else if (kind === 'swap') {
        row.innerHTML = '<span><i class="stock-dot" style="background:#111" aria-hidden="true"></i>중앙로점 · 10분</span><span class="more-shades-n" style="color:#111; font-weight:800">14개</span>';
      } else if (kind === 'cover') {
        add(card, 'q-cover', '<div class="h"><span>가까운 매장 재고</span><span class="x"><svg viewBox="0 0 16 16"><path d="M3 3l10 10M13 3 3 13"/></svg></span></div>'
          + '<div class="r"><span><span class="s">올리브영 중앙로점</span> · 도보 10분</span><b>14개</b></div>'
          + '<div class="r"><span><span class="s">올리브영 시청점</span> · 도보 16분</span><b>8개</b></div>'
          + '<div class="r"><span><span class="s">올리브영 터미널점</span> · 도보 25분</span><b>3개</b></div>');
      } else {
        add(document.getElementById('fc-sheet'), 'q-bar', '<i></i><span><b>올리브영 중앙로점</b>에 있어요</span><span class="m">도보 10분 · 720m</span><b>재고 14개</b>');
      }
      document.getElementById('stage').insertAdjacentHTML('beforeend', `<div class="v-tag">${tag[0]}<span>${tag[1]}</span></div>`);
    }, { kind: s.kind, tag: s.tag, outRow });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(__dirname, s.file + '.png'), clip: { x: 0, y: 800, width: 900, height: 640 } });
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
