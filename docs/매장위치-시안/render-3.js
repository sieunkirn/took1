// '재고만 알려주기' 시안 두 장 (2026-11-27). 쓰는 법: 서버를 켠 뒤(3000번) took 폴더에서  node docs/매장위치-시안/render-3.js
// 1번 = 추천 카드에 재고를 바로 표시 (화면을 열지 않음) / 2번 = 지금처럼 화면을 열되 평면도 없이 재고만
// 실제 거울 화면을 열어 그 위에 얹어 찍는다. 앱 코드는 바꾸지 않는다
const { chromium } = require('playwright');
const path = require('path');

const CSS = `
  .v-tag { position: absolute; left: 44px; top: 836px; z-index: 9; color: #fff; font-size: 30px; font-weight: 800; letter-spacing: -0.02em; }
  .v-tag span { display: block; margin-top: 6px; font-size: 16px; font-weight: 500; color: #9b9ba1; letter-spacing: -0.01em; }
  .k-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #111; margin-right: 8px; }
  .k-dot.out { background: #c4c4c8; }
  .k-row { display: flex; align-items: center; white-space: nowrap; }
  .k-big { flex: none; width: 330px; padding: 0 28px; border-radius: 24px; background: #f3f3f3; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
  .k-big .l { font-size: 13px; font-weight: 500; color: #8a8a8e; }
  .k-big b { font-size: 44px; line-height: 1.15; font-weight: 800; letter-spacing: -0.03em; }
  .k-big span:last-child { font-size: 15px; font-weight: 500; color: #6b6b70; }
  .k-head { padding: 14px 0 6px; font-size: 13px; font-weight: 500; color: #8a8a8e; }
`;
const tagHtml = (t) => `<div class="v-tag">${t[0]}<span>${t[1]}</span></div>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1440 }, deviceScaleFactor: 2 });
  const open = async () => {
    await page.goto('http://localhost:3000/palette.html?mode=recs');
    await page.waitForSelector('#rec-list .more-shades');
    await page.addStyleTag({ content: CSS });
    await page.waitForTimeout(1200);
  };
  const shot = (name) => page.screenshot({ path: path.join(__dirname, name + '.png'), clip: { x: 0, y: 800, width: 900, height: 640 } });

  // 1번: 추천 카드 아래 줄에 재고를 바로. 재고가 있으면 누르는 곳이 아니라 글자, 품절일 때만 '가까운 매장 보기 ›'
  await open();
  await page.evaluate((tag) => {
    const rows = [...document.querySelectorAll('#rec-list .more-shades')];
    const stock = ['4개', null, '11개', '1개'];
    rows.forEach((b, i) => {
      const n = stock[i % stock.length];
      b.innerHTML = n
        ? `<span class="k-row"><i class="k-dot"></i>이 매장 재고</span><span class="more-shades-n" style="color:#111; font-weight:800">${n}</span>`
        : '<span class="k-row"><i class="k-dot out"></i>품절</span><span class="more-shades-n" style="white-space:nowrap">가까운 매장</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>';
    });
    document.getElementById('stage').insertAdjacentHTML('beforeend', tag);
  }, tagHtml(['1 카드에 바로 표시', '누르지 않아도 목록에서 재고가 보인다']));
  await shot('재고만-1-카드에-바로');

  // 2번: 화면을 열되 재고만. 왼쪽 이 매장 재고(크게), 오른쪽 근처 매장 재고 줄
  await open();
  await page.evaluate(() => document.querySelector('#rec-list .more-shades').click());
  await page.waitForTimeout(1200);
  await page.evaluate((tag) => {
    const view = document.querySelector('.fc-shades');
    view.querySelectorAll('.fc-st-a, .fc-st-stat, .fc-st-note').forEach((e) => e.remove());
    view.querySelector('.fc-sh-title').textContent = '매장 재고';
    const r = (k, v) => `<div class="fc-st-r" style="padding:13px 0"><span>${k}</span><b>${v}</b></div>`;
    view.insertAdjacentHTML('beforeend', `<div class="fc-st-a">
      <div class="k-big"><span class="l">이 매장 재고</span><b>4개</b><span>지금 살 수 있어요</span></div>
      <div class="fc-st-rows" style="justify-content:flex-start"><div class="k-head">근처 매장</div>
        ${r('역앞점 · 도보 5분', '10개')}${r('중앙로점 · 도보 10분', '2개')}${r('시청점 · 도보 16분', '13개')}</div></div>`);
    document.getElementById('stage').insertAdjacentHTML('beforeend', tag);
  }, tagHtml(['2 화면을 열되 재고만', '평면도 없이, 이 매장 재고와 근처 매장']));
  await shot('재고만-2-화면-열기');

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
