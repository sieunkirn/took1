// 호수(색상) 안내: 제품 하나의 모든 호수를 색 동그라미로 펼친다.
//  1) 동그라미를 누르면 호수 번호·색 이름·설명이 아래에 나온다
//  2) '발라 보기'를 누르면 카메라 구역이 열리고 그 색을 입술에 입힌다 (lip.js 의 took:apply)
//  3) 발라 보는 중에 다른 동그라미를 누르면 입술 색이 바로 바뀐다 (동그라미는 한 줄로 줄어든다)
//  4) 고른 호수의 재고 수량을 설명 아래에 보여 준다 (매대 위치 안내는 2026-11-11 삭제)
//  5) '근처 매장 재고'를 누르면 가까운 매장 5곳의 재고와 추천 매장을 보여 준다 (store-stock.js, 시연용)
// 호수·재고는 시연용 데이터(src/data/products.demo.json)다. 화면에 '시연용' 배지로 표시한다 (demo.js).
// 주소 값: id(제품), try=1(이 색을 바로 발라 본다)
import { $, renderNav, api, el, qs, won, toast } from './common.js';
import { isEn, brandOf, nameOf, finishText, t as tr } from './i18n.js';
import { shadeLabel, stockText } from './shade-label.js';
import { isDemo, demoText, realOnly } from './demo.js';
import { openStoreStock } from './store-stock.js'; // 근처 매장 재고 (시연용)

renderNav();

const C = (ko, en) => (isEn() ? en : ko);
const page = $('sh-page');
document.title = C('took(툭) - 호수 안내', 'took - Shade guide');
$('sh-try').setAttribute('aria-label', C('입술에 발라 보기', 'Try on your lips'));
$('sh-grid').setAttribute('aria-label', C('호수 목록', 'All shades'));

const backBtn = () => el('button', {
  type: 'button', class: 'sh-back', text: C('← 돌아가기', '← Back'),
  onclick: () => { if (history.length > 1) history.back(); else location.href = 'index.html'; },
});

const lightness = (L) => (L >= 65 ? C('밝은 편', 'Light') : L >= 45 ? C('중간 밝기', 'Medium') : C('진한 편', 'Deep'));
const colorName = (p) => (isEn() ? p.shade_color_en || p.shade_color : p.shade_color); // 영어 이름이 없는 호수는 한국어 이름

let shades = [];
let current = null;
let trying = false;

function renderGrid() {
  $('sh-grid').replaceChildren(...shades.map((p) => {
    const dot = el('span', { class: 'sh-dot', 'aria-hidden': 'true' });
    dot.style.background = p.color_hex; // 호수 색은 실제 색 (CLAUDE.md 예외)
    return el('button', {
      type: 'button', class: 'sh-shade', 'data-id': p.id, 'aria-pressed': String(p === current),
      'aria-label': shadeLabel(p) + (p.stock === 0 ? C(' 품절', ' sold out') : ''),
      onclick: () => select(p),
    }, dot,
    p.shade_no ? el('span', { class: 'sh-no', text: p.shade_no }) : null,
    el('span', { class: 'sh-name', text: colorName(p) }),
    p.stock === 0 ? el('span', { class: 'sh-out', text: C('품절', 'Sold out') }) : null);
  }));
}

function renderDetail() {
  const p = current;
  const box = $('sh-detail');
  box.classList.toggle('hidden', !p);
  if (!p) return;
  const dot = el('span', { class: 'sh-big-dot', 'aria-hidden': 'true' });
  dot.style.background = p.color_hex;
  const facts = [tr('family.' + p.color_family), lightness(p.color_lab.L), p.finish ? finishText(p.finish) : null].filter(Boolean);
  // null 은 빼고 넣는다 (replaceChildren 은 null 을 'null' 글자로 넣는다. 올리브영 호수는 설명·재고가 없다)
  box.replaceChildren(...[
    el('div', { class: 'sh-detail-top' }, dot,
      el('div', { class: 'sh-detail-name' },
        p.shade_no ? el('span', { class: 'sh-detail-no', text: C(`${p.shade_no}호`, `No. ${p.shade_no}`) }) : null, // 3CE 처럼 번호 없는 호수
        el('strong', { text: colorName(p) }))),
    isEn() || !p.description ? null : el('p', { class: 'sh-desc', text: p.description }),
    el('ul', { class: 'sh-facts', 'aria-label': C('색 특징', 'Color details') }, ...facts.map((f) => el('li', { text: f }))),
    Number.isFinite(p.stock) ? el('p', { class: 'shelf-stock', text: p.stock === 0 ? C('이 매장 품절', 'Sold out here') : stockText(p) }) : null,
    el('div', { class: 'sh-actions' },
      trying ? null : el('button', { type: 'button', class: 'btn-dark', text: C('발라 보기', 'Try it on'), onclick: () => tryOn(p) }),
      // 매장 재고는 전부 만든 값이라 실데이터만 보기에서는 버튼을 뺀다
      realOnly() ? null : el('button', { type: 'button', class: 'btn-line', text: C('근처 매장 재고', 'Nearby stores'), onclick: () => openStoreStock(p.id, `${nameOf(p)} ${shadeLabel(p)}`) }),
    ),
  ].filter(Boolean));
}

function toLips(p) {
  window.dispatchEvent(new CustomEvent('took:apply', { detail: { hex: p.color_hex, finish: p.finish, quiet: true, source: shadeLabel(p) } }));
}

function select(p) {
  current = p;
  for (const b of $('sh-grid').children) b.setAttribute('aria-pressed', String(b.dataset.id === p.id));
  if (trying) { toLips(p); centerShade(); }
  renderDetail();
}

// 발라 보는 중에는 동그라미가 한 줄이라, 고른 색을 가운데로 옮긴다
function centerShade() {
  const grid = $('sh-grid');
  const b = grid.querySelector('[aria-pressed="true"]');
  if (b) grid.scrollLeft = b.offsetLeft - grid.offsetLeft - (grid.clientWidth - b.offsetWidth) / 2;
}

function tryOn(p) {
  trying = true;
  page.classList.add('trying');
  $('sh-try').classList.remove('hidden');
  // 손님이 누른 뒤에 카메라를 켠다. 이미 카메라나 아바타로 보고 있으면 그대로 둔다
  const started = ['use-camera', 'use-avatar'].some((id) => $(id)?.getAttribute('aria-pressed') === 'true');
  if (!started) $('use-camera')?.click();
  toLips(p);
  toast(C('다른 색을 누르면 입술 색이 바뀌어요', 'Tap another shade to change the color'));
  renderDetail();
  centerShade();
}

async function start() {
  const id = qs('id');
  // id 는 제품(올리브영)·호수·시연용 제품 어느 것이든 된다. 호수를 가리키면 그 호수를 먼저 고른다
  const { ok, body } = id ? await api('api/shades?id=' + encodeURIComponent(id)) : { ok: false, body: {} };
  shades = ok ? body.shades : [];
  const first = shades.find((p) => p.id === id) || shades[0] || null;
  if (!first) {
    $('sh-head').replaceChildren(backBtn(), el('p', { class: 'msg', text: C('호수 정보가 등록되지 않은 제품이에요.', 'No shade info is registered for this product.') }));
    return;
  }
  // 출처 표시: 시연용 가상 제품은 '테스트 데이터', 올리브영 호수는 색이 사진에서 뽑은 추정값이라는 것
  const note = isDemo(first)
    ? demoText()
    : C('올리브영 판매 호수 · 색은 색상 칩 사진 기준', 'Shades sold at OLIVE YOUNG · colors from chip photos');
  $('sh-head').replaceChildren(backBtn(),
    el('div', { class: 'sh-title' },
      el('span', { class: 'sh-brand', text: [brandOf(first), won(first.price)].join(' · ') }),
      el('h1', { text: nameOf(first) }),
      el('p', { class: 'sh-count', text: C(`${shades.length}가지 색 · ${note}`, `${shades.length} shades · ${note}`) })));
  renderGrid();
  if (qs('try') === '1') { select(first); tryOn(first); }
  else if (first.id === id) select(first); // 카드에서 특정 호수를 눌러 들어오면 그 호수를 골라 둔다
}
start();
