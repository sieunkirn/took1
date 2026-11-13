// 호수(색상) 안내: 제품 하나의 모든 호수를 색 동그라미로 펼친다.
//  1) 동그라미를 누르면 호수 번호·색 이름·설명이 아래에 나온다
//  2) '발라 보기'를 누르면 카메라 구역이 열리고 그 색을 입술에 입힌다 (lip.js 의 took:apply)
//  3) 발라 보는 중에 다른 동그라미를 누르면 입술 색이 바로 바뀐다 (동그라미는 한 줄로 줄어든다)
//  4) 고른 호수의 재고 수량을 설명 아래에 보여 준다 (매대 위치 안내는 2026-11-11 삭제)
// 호수·재고는 시연용 데이터(src/data/products.demo.json)다. 화면에 '테스트 데이터'로 표시한다.
// 주소 값: id(제품), from(돌아갈 곳: chat), try=1(이 색을 바로 발라 본다)
import { $, renderNav, api, el, qs, won, toast } from './common.js';
import { isEn, brandOf, nameOf, finishText, t as tr } from './i18n.js';
import { shadeLabel, stockText } from './shade-label.js';

renderNav();

const C = (ko, en) => (isEn() ? en : ko);
const page = $('sh-page');
document.title = C('took(툭) - 호수 안내', 'took - Shade guide');
$('sh-try').setAttribute('aria-label', C('입술에 발라 보기', 'Try on your lips'));
$('sh-grid').setAttribute('aria-label', C('호수 목록', 'All shades'));

const BACK = { chat: 'chat.html' };
const from = qs('from');
const backBtn = () => el('button', {
  type: 'button', class: 'sh-back', text: C('← 돌아가기', '← Back'),
  onclick: () => { if (BACK[from]) location.href = BACK[from]; else if (history.length > 1) history.back(); else location.href = 'index.html'; },
});

const lightness = (L) => (L >= 65 ? C('밝은 편', 'Light') : L >= 45 ? C('중간 밝기', 'Medium') : C('진한 편', 'Deep'));
const colorName = (p) => (isEn() ? p.shade_color_en : p.shade_color);

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
    el('span', { class: 'sh-no', text: p.shade_no }),
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
  box.replaceChildren(
    el('div', { class: 'sh-detail-top' }, dot,
      el('div', { class: 'sh-detail-name' },
        el('span', { class: 'sh-detail-no', text: C(`${p.shade_no}호`, `No. ${p.shade_no}`) }),
        el('strong', { text: colorName(p) }))),
    isEn() ? null : el('p', { class: 'sh-desc', text: p.description }),
    el('ul', { class: 'sh-facts', 'aria-label': C('색 특징', 'Color details') }, ...facts.map((f) => el('li', { text: f }))),
    Number.isFinite(p.stock) ? el('p', { class: 'shelf-stock', text: p.stock === 0 ? C('이 매장 품절', 'Sold out here') : stockText(p) }) : null,
    el('div', { class: 'sh-actions' },
      trying ? null : el('button', { type: 'button', class: 'btn-dark', text: C('발라 보기', 'Try it on'), onclick: () => tryOn(p) }),
    ),
  );
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
  const { ok, body } = await api('api/demo-products');
  const first = ok ? body.products.find((p) => p.id === id) : null;
  if (!first) {
    $('sh-head').replaceChildren(backBtn(), el('p', { class: 'msg', text: C('호수 정보가 등록되지 않은 제품이에요.', 'No shade info is registered for this product.') }));
    return;
  }
  shades = body.products.filter((p) => p.line === first.line);
  $('sh-head').replaceChildren(backBtn(),
    el('div', { class: 'sh-title' },
      el('span', { class: 'sh-brand', text: [brandOf(first), won(first.price)].join(' · ') }),
      el('h1', { text: nameOf(first) }),
      el('p', { class: 'sh-count', text: C(`${shades.length}가지 색 · 테스트 데이터`, `${shades.length} shades · Test data`) })));
  renderGrid();
  if (qs('try') === '1') { select(first); tryOn(first); }
}
start();
