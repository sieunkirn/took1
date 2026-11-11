// 제품 위치: 립 매대 정면 그림 + 아래에서 올라오는 위치 시트 (2026-11-11)
//  - shelfOf(product): 테스트 매대 데이터(shelf-data.js)에서 그 제품 브랜드의 구역·단을 찾는다. 없으면 null (위치를 지어내지 않는다)
//  - shelfAction(product): 추천 카드용 '매대 위치' 버튼 (매대 정보가 없으면 눌리지 않는 글자 '매대 정보 없음')
//  - openShelf(product): 위치 시트 (제품 줄 → 큰 위치 문장 → 찾아가는 순서 3단계 → 매대 그림 → 휴대폰으로 가져가기·닫기)
//  - drawShelf(svg, spot, { small }): 매대 그림. 무채색(CSS 변수)이라 다크 모드에서도 맞는다. 휴대폰 챗봇 위치 카드도 이것을 쓴다
//  - setShelfTake(fn): '휴대폰으로 가져가기'를 누르면 부를 함수 (팔레트가 정한다). 없으면 그 버튼을 보이지 않는다
// common.js 를 불러오지 않는다 (common.js 의 제품 카드가 이 파일을 불러서, 서로 부르지 않게)
import { isEn, brandOf, nameOf, priceText } from './i18n.js';
import { SHELF } from './shelf-data.js';

const C = (ko, en) => (isEn() ? en : ko);
const NS = 'http://www.w3.org/2000/svg';

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  e.append(...kids.filter(Boolean));
  return e;
}

/** 제품 → { bay: 매대 칸(A, B …), index: 그 칸에서 왼쪽부터 몇 번째 구역(0부터), tier: 위에서 몇 번째 단(1부터), zone } 또는 null */
export function shelfOf(product) {
  for (const bay of SHELF.bays) {
    const index = bay.zones.findIndex((z) => z.brand === product?.brand);
    if (index >= 0) return { bay, index, tier: bay.zones[index].tier, zone: bay.zones[index] };
  }
  return null;
}

const zoneName = (z) => (isEn() ? z.en : z.brand);
const tierWord = (n) => C(['첫', '두', '세', '네'][n - 1] + ' 번째 단', ['top', 'second', 'third', 'fourth'][n - 1] + ' shelf');
const bayName = (spot) => C(`${spot.bay.id}칸`, `Bay ${spot.bay.id}`);
/** 위치 한 문장: 'E칸 머지 구역, 위에서 두 번째 단' */
export function shelfText(spot) {
  return C(`${bayName(spot)} ${zoneName(spot.zone)} 구역, 위에서 ${tierWord(spot.tier)}`, `${bayName(spot)}, ${zoneName(spot.zone)} section, ${tierWord(spot.tier)}`);
}
/** 짧게: 'E칸 · 2단' (휴대폰 위치 카드) */
export function shelfShort(spot) {
  return C(`${bayName(spot)} · ${spot.tier}단`, `${bayName(spot)} · shelf ${spot.tier}`);
}
// 간판 글자가 칸(52px)을 넘으면 글자 폭을 줄여 맞춘다 (한글 약 11px, 영문 약 6.5px로 어림)
const fitWidth = (str) => [...str].reduce((w, ch) => w + (/[가-힣]/.test(ch) ? 11 : 6.5), 0);

// ---------- 매대 그림 (정면) ----------
// 간판 줄 → 테스터 단(SHELF.tiers) → 단마다 가격표 → 재고 서랍. 찾는 브랜드 간판은 검게, 그 브랜드의 해당 단은 테두리로 감싸고 나머지는 어둡게 덮는다
// 매대 칸 하나(브랜드 구역 6개)를 그린다. 칸의 구역이 6개보다 적어도 빈 구역 자리를 두어 크기를 맞춘다
export function drawShelf(svg, spot, { small = false } = {}) {
  const zones = spot.bay.zones;
  const W = 64, X = 18, N = 6, VW = X * 2 + W * N, TOP = 52, ROW = 60, tiers = SHELF.tiers;
  const shelfEnd = TOP + ROW * tiers, VH = shelfEnd + 66;
  svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
  svg.replaceChildren();
  const s = (tag, attrs, parent = svg) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent.appendChild(e);
    return e;
  };
  const text = (attrs, str) => { s('text', attrs).textContent = str; };
  s('rect', { x: 0, y: 0, width: VW, height: VH, class: 's-bg' });
  s('rect', { x: 8, y: 6, width: VW - 16, height: VH - 10, rx: 6, class: 's-frame' });
  s('rect', { x: X - 2, y: 12, width: W * N + 4, height: 36, class: 's-board-row' });
  const slots = Array.from({ length: N }, (_, i) => zones[i] || null); // 빈 구역 자리는 간판·테스터 없이 비워 둔다
  slots.forEach((z, i) => {
    const x = X + i * W, on = i === spot.index;
    s('rect', { x: x + 3, y: 16, width: W - 6, height: 28, rx: 3, class: on ? 's-board on' : 's-board' });
    if (!small && z) {
      const name = zoneName(z), fit = fitWidth(name) > W - 12 ? { textLength: W - 12, lengthAdjust: 'spacingAndGlyphs' } : {};
      text({ x: x + W / 2, y: 34, 'text-anchor': 'middle', class: on ? 's-name on' : 's-name', ...fit }, name);
    }
    if (i > 0) s('rect', { x: x - 1, y: TOP, width: 2, height: ROW * tiers, class: 's-div' });
  });
  for (let r = 1; r <= tiers; r++) {
    const by = TOP + ROW * r - 12; // 이 단의 선반 높이
    slots.forEach((z, i) => {
      const x = X + i * W;
      if (!z) return;
      for (let k = 0; k < 5; k++) {
        const tx = x + 8 + k * 10.5, ht = 40 - (k % 2) * 5 - (i % 2) * 2, cap = [14, 11, 16][i % 3];
        s('rect', { x: tx, y: by - ht, width: 7.5, height: ht - cap, rx: 2, class: 's-tube' });
        s('rect', { x: tx - 0.5, y: by - cap, width: 8.5, height: cap, rx: i % 3 === 2 ? 4 : 1.5, class: k % 2 ? 's-cap' : 's-cap alt' });
      }
      s('rect', { x: x + 6, y: by + 8, width: W - 12, height: 9, rx: 1, class: 's-tag' });
    });
    s('rect', { x: X - 2, y: by, width: W * N + 4, height: 7, class: 's-ledge' });
    if (!small) text({ x: 2, y: by - 20, class: 's-tier' }, isEn() ? `T${r}` : `${r}단`);
  }
  s('rect', { x: X - 2, y: shelfEnd + 4, width: W * N + 4, height: 56, class: 's-base' });
  slots.forEach((z, i) => {
    const x = X + i * W;
    s('rect', { x: x + 4, y: shelfEnd + 10, width: W - 8, height: 44, rx: 3, class: 's-drawer' });
    s('rect', { x: x + W / 2 - 10, y: shelfEnd + 18, width: 20, height: 3, rx: 1.5, class: 's-handle' });
  });
  // 강조: 그 브랜드 간판과 해당 단만 남기고 어둡게
  const hx = X + spot.index * W, hy = TOP + ROW * (spot.tier - 1) - 6, hw = W, hh = ROW + 12;
  const id = 'shelf-hole-' + Math.random().toString(36).slice(2, 8);
  const mask = s('mask', { id }, s('defs', {}));
  s('rect', { x: 0, y: 0, width: VW, height: VH, fill: '#fff' }, mask);
  s('rect', { x: hx, y: hy, width: hw, height: hh, rx: 8, fill: '#000' }, mask);
  s('rect', { x: hx, y: 12, width: hw, height: 36, fill: '#000' }, mask);
  s('rect', { x: 0, y: 0, width: VW, height: VH, class: 's-dim', mask: `url(#${id})` });
  s('rect', { x: hx, y: hy, width: hw, height: hh, rx: 8, class: 's-hit' });
  for (const [cx, cy, sx, sy] of [[hx, hy, 1, 1], [hx + hw, hy, -1, 1], [hx, hy + hh, 1, -1], [hx + hw, hy + hh, -1, -1]]) {
    s('path', { d: `M${cx + sx * 14} ${cy - sy * 5} H${cx - sx * 5} V${cy + sy * 14}`, class: 's-corner' });
  }
  if (!small) {
    const pw = 76, px = Math.min(Math.max(hx + hw / 2 - pw / 2, 4), VW - pw - 4), py = hy - 30;
    s('rect', { x: px, y: py, width: pw, height: 22, rx: 11, class: 's-pin' });
    s('path', { d: `M${hx + hw / 2 - 6} ${py + 22} l6 7 l6 -7z`, class: 's-pin' });
    text({ x: px + pw / 2, y: py + 15, 'text-anchor': 'middle', class: 's-pin-text' }, C(`여기 · ${spot.tier}단`, `Here · T${spot.tier}`));
  }
  return svg;
}

// ---------- 위치 시트 ----------
let takeFn = null;
/** '휴대폰으로 가져가기' 동작을 정한다 (product 를 받는다). 없으면 버튼을 숨긴다 */
export function setShelfTake(fn) { takeFn = fn; }

let sheet = null;
function ensureSheet() {
  if (sheet) return sheet;
  sheet = h('dialog', { class: 'shelf-sheet', 'aria-labelledby': 'shelf-title' });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); }); // 바깥(어두운 곳)을 누르면 닫기
  document.body.append(sheet);
  return sheet;
}

export function openShelf(product) {
  const spot = shelfOf(product);
  if (!spot) return;
  const dlg = ensureSheet();
  const dot = h('span', { class: 'shelf-dot', 'aria-hidden': 'true' });
  dot.style.background = product.color_hex; // 제품 색 견본은 실제 색 (CLAUDE.md 예외)
  const meta = [brandOf(product), Number.isFinite(Number(product.price)) && product.price !== null ? priceText(product.price) : null].filter(Boolean).join(' · ');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'shelf-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', C(`립 매대 정면 그림. ${shelfText(spot)} 강조`, `Front view of the lip shelf. ${shelfText(spot)} highlighted`));
  drawShelf(svg, spot);
  dlg.replaceChildren(
    h('div', { class: 'shelf-grip', 'aria-hidden': 'true' }),
    h('div', { class: 'shelf-head' }, dot,
      h('div', { class: 'shelf-prod' }, h('span', { class: 'shelf-meta', text: meta }), h('strong', { text: nameOf(product) })),
      h('button', { type: 'button', class: 'icon-btn shelf-x', 'aria-label': C('닫기', 'Close'), text: '×', onclick: () => dlg.close() })),
    h('div', { class: 'shelf-body' },
      h('p', { class: 'shelf-where', text: C('립 매대', 'Lip shelf') }),
      // 매대 칸 줄: A B C … 중 찾는 칸만 검게 (왼쪽부터 칸 순서대로 서 있다고 본다)
      h('ol', { class: 'shelf-bays', 'aria-label': C('립 매대 칸', 'Lip shelf bays') },
        ...SHELF.bays.map((b) => h('li', { class: b === spot.bay ? 'on' : null, 'aria-current': b === spot.bay ? 'location' : null, text: b.id }))),
      h('h2', { id: 'shelf-title', class: 'shelf-title', text: shelfText(spot) }),
      h('ol', { class: 'shelf-steps' },
        h('li', { text: C(`립 매대 ${spot.bay.id}칸으로`, `Go to bay ${spot.bay.id}`) }),
        h('li', { text: C(`검은 '${zoneName(spot.zone)}' 간판`, `The black "${zoneName(spot.zone)}" sign`) }),
        h('li', { text: C(`그 아래 ${spot.tier}단`, `Shelf ${spot.tier} below it`) }))),
    h('div', { class: 'shelf-pic' }, svg),
    h('div', { class: 'shelf-note' },
      h('span', { text: C('진열이 바뀌면 위치가 다를 수 있어요', 'The display may have changed') }),
      SHELF.test ? h('span', { text: C('테스트 데이터', 'Test data') }) : null),
    h('div', { class: 'shelf-actions' },
      takeFn ? h('button', { type: 'button', class: 'btn-dark', text: C('휴대폰으로 가져가기', 'Take it to my phone'), onclick: () => { dlg.close(); takeFn(product); } }) : null,
      h('button', { type: 'button', text: C('닫기', 'Close'), onclick: () => dlg.close() })),
  );
  dlg.showModal();
}

/** 추천 카드용: 매대 정보가 있으면 '매대 위치' 버튼, 없으면 눌리지 않는 안내 글자 */
export function shelfAction(product) {
  if (!shelfOf(product)) return h('span', { class: 'shelf-none', text: C('매대 정보 없음', 'No shelf info') });
  return h('button', { type: 'button', class: 'shelf-btn', text: C('매대 위치', 'Shelf location'), onclick: () => openShelf(product) });
}
