// 제품을 화면에 보여 주는 부품: 이름·가격 표기, 제품 카드, 상세 표, 올리브영 링크.
import { fullName as koFullName, shortName as koShortName } from '../lib/catalog.js';
import { t, isEn, brandOf, nameOf, displayName, storeUrlOf, priceText, finishText as finishName } from './i18n.js';
import { el } from './dom.js';
import { isDemo, demoBadgeFor } from './demo.js';
import { go } from './store.js';
import { api } from './api.js';
import { hasPick, togglePick } from './chat-picks.js';

// 화면에 보이는 제품 이름: 영어 화면이면 글로벌 올리브영 영어 이름(없으면 한국어 이름), 한국어면 그대로
export const fullName = (p) => (isEn() ? displayName(p) : koFullName(p));
export const shortName = (p) => (isEn() ? `${brandOf(p)} ${nameOf(p)}` : koShortName(p));

// 수집하지 않은 정보는 비워 두고, 추정한 값은 추정이라고 표시한다 (올리브영 데이터)
const shadeText = (p) => shadeLabelOf(p) || (p.color_options ? t('detail.shadeOf', { n: p.color_options }) : t('detail.shadeRep'));
const finishText = (p) => (p.finish ? finishName(p.finish) + (p.finish_source === 'product_name' ? t('detail.byName') : '') : t('detail.none'));
const familyText = (p) => t('family.' + p.color_family) + (p.color_family_source === 'estimated_from_color' ? t('detail.byColor') : '');

/** 올리브영 상세 페이지 링크 (새 창) */
export function storeLink(p, text = t('card.store')) {
  const url = storeUrlOf(p); // 영어면 글로벌 올리브영
  return url ? el('a', { href: url, text, target: '_blank', rel: 'noopener noreferrer' }) : null;
}

export const won = priceText; // 한국어 '13,000원', 영어 '₩13,000'

export function detailLink(product, from, text = t('card.detail')) {
  return el('a', { href: 'product.html', text, onclick: (e) => { e.preventDefault(); go('product.html', { id: product.id, from }); } });
}

/**
 * 제품 카드. 색상은 칠하지 않고 텍스트로만 표시한다.
 * @param {object} product
 * @param {{from?: string, extraActions?: HTMLElement[]}} opts
 */
// 카드에는 브랜드·제품명·색상값·제형·가격과 올리브영 링크만 보여 준다 (나머지 정보는 제품 상세 화면에)
// extraActions: 화면마다 필요한 버튼 (예: 립 컬러 매핑의 '입술에 발라보기')
/** '입술에 발라보기' 버튼이 붙은 제품 카드. 누르면 onTry(제품) */
// 그 옆 '챗봇에 담기'(2026-11-15): 담은 제품으로 챗봇과 이야기한다 (chat-picks.js · chat.js picksHandoff)
// 카드 안에서 호수(옵션)를 바꾸면 '발라보기'·'챗봇에 담기'도 고른 호수로 한다
export function tryOnCard(product, onTry, { onTake } = {}) { // onTake: 거울의 '가져가기' (2026-11-19)
  let current = product;
  const pick = pickButton(() => current);
  return productCard(product, {
    extraActions: [el('button', { type: 'button', text: t('lip.tryOn'), onclick: () => onTry(current) }), pick,
      onTake ? el('button', { type: 'button', class: 'take-btn', text: t('nw.take'), onclick: () => onTake(current) }) : null].filter(Boolean),
    onShade: (s) => { current = s; pick.sync(); },
  });
}

/** '챗봇에 담기' 버튼: 누를 때마다 담기/빼기. 담은 상태면 눌린 모양('담음 ✓'). product 는 제품이나 '지금 제품을 돌려주는 함수' */
export function pickButton(product) {
  const cur = typeof product === 'function' ? product : () => product;
  const b = el('button', { type: 'button', class: 'pick-btn' });
  const sync = () => {
    const on = hasPick(cur().id);
    b.textContent = t(on ? 'card.picked' : 'card.pick');
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', t('card.pickAria', { name: shortName(cur()) }));
  };
  b.addEventListener('click', () => { togglePick(cur(), shortName(cur())); });
  window.addEventListener('took:picks-change', sync);
  sync();
  b.sync = sync;
  return b;
}

// ---------- 카드 안의 호수 고르기 (2026-11-17, 아코디언) ----------
// 머리 칸(고른 호수 + N가지 + ⌄)을 누르면 아래로 색 격자가 펼쳐지고, 색 하나를 누르면 접히며 머리 칸에 그 호수가 남는다.
// 일반 카드는 카드가 아래로 늘어나고, 팔레트(크기 고정 카드)는 격자가 카드 위에 떠서 열린다 (took-ui.css).
// 따로 창(호수 안내 화면)으로 가지 않는다. 호수 목록은 처음 펼칠 때 /api/shades 로 불러온다
function shadeChip(s) {
  const dot = () => {
    const d = el('span', { class: 'opt-chip opt-dot', 'aria-hidden': 'true' });
    d.style.background = s.color_hex; // 호수 색은 실제 색 (CLAUDE.md 예외)
    return d;
  };
  // 올리브영 색상 칩 사진(실제 색)이 있으면 사진, 없거나 못 불러오면 색 동그라미
  return s.swatch_url
    ? el('img', { class: 'opt-chip', src: s.swatch_url + '?RS=100x0&QT=85', alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: (e) => e.target.replaceWith(dot()) })
    : dot();
}

export function shadePicker(product, { onSelect } = {}) {
  const total = product.shade_count || 0;
  let selected = product.shade_color ? product : null; // 추천이 고른 호수면 그 호수가 골라진 채로 시작
  let shades = null;
  let open = false;
  const label = el('span', { class: 'opt-label' });
  const head = el('button', { type: 'button', class: 'opt-head', 'aria-expanded': 'false', 'aria-haspopup': 'listbox' },
    label, el('span', { class: 'opt-chev', 'aria-hidden': 'true' }));
  const list = el('ul', { class: 'opt-list', role: 'listbox', 'aria-label': t('card.optList', { n: total }) });
  list.hidden = true;
  const box = el('div', { class: 'opt' }, head, list);

  const renderHead = () => label.replaceChildren(...(selected
    ? [shadeChip(selected), el('span', { class: 'opt-name', text: shadeLabelOf(selected) })]
    : [el('span', { class: 'opt-name opt-placeholder', text: t('card.optPick') })]),
  el('span', { class: 'opt-count', text: t('card.optCount', { n: total }) }));

  // 펼친 목록 = 색 격자 (2026-11-17 사용자 선택 'C 아코디언'): 색 동그라미 + 호수 번호. 이름은 고른 뒤 머리 칸에 나온다
  const cellDot = (s) => {
    const d = el('span', { class: 'opt-cell-dot', 'aria-hidden': 'true' });
    d.style.background = s.color_hex; // 호수 색은 실제 색 (CLAUDE.md 예외)
    return d;
  };
  const renderList = () => list.replaceChildren(...shades.map((s) => el('li', { role: 'option', 'aria-selected': String(s.id === selected?.id) },
    el('button', { type: 'button', class: 'opt-cell', 'aria-label': shadeLabelOf(s), title: shadeLabelOf(s), onclick: () => choose(s) },
      cellDot(s),
      el('span', { class: 'opt-cell-no', text: s.shade_no || shadeLabelOf(s) })))));

  function setOpen(v) {
    open = v;
    list.hidden = !v;
    box.classList.toggle('open', v);
    head.setAttribute('aria-expanded', String(v));
    if (v) list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }
  function choose(s) {
    selected = s;
    renderHead();
    renderList();
    setOpen(false);
    onSelect?.(s);
  }
  head.addEventListener('click', async () => {
    if (open) return setOpen(false);
    if (!shades) {
      list.replaceChildren(el('li', { class: 'opt-msg', text: t('detail.loading') }));
      setOpen(true);
      const { ok, body } = await api('api/shades?id=' + encodeURIComponent(product.id));
      shades = ok ? body.shades : [];
      if (!shades.length) { list.replaceChildren(el('li', { class: 'opt-msg', text: t('detail.none') })); return; }
      renderList();
      if (open) setOpen(true);
      return;
    }
    setOpen(true);
  });
  renderHead();
  return box;
}

/** 호수 이름: '04 피그피그' (영어 이름이 없으면 한국어 이름). 호수 레코드가 아닌 가상 제품은 shade_name 그대로 */
export function shadeLabelOf(p) {
  if (p.shade_color) return [p.shade_no, isEn() ? (p.shade_color_en || p.shade_color) : p.shade_color].filter(Boolean).join(' ');
  return p.shade_name || '';
}

// 카드의 '호수' 칸 (2026-11-17). 호수가 여럿인 제품은 이 칸 대신 카드 안의 호수 고르기(shadePicker)를 쓴다
//  - 호수 하나뿐인 제품·가상 제품: 작은 색 견본 + 호수 이름 (누르는 곳 없음)
//  - 색 개수만 아는 제품(올리브영 상품명의 'N colors'): 'N가지 · 호수 정보 준비 중'
//  - 아무 정보도 없으면 '정보 없음'. 없는 호수는 지어내지 않는다
function shadeCell(p) {
  const label = shadeLabelOf(p);
  if (label) {
    const dot = el('span', { class: 'shade-dot', 'aria-hidden': 'true' });
    dot.style.background = p.color_hex; // 호수 색은 실제 색 (CLAUDE.md 예외: 카드의 작은 색 견본)
    return [el('span', { class: 'shade-link' }, dot, el('span', { class: 'shade-label', text: label }))];
  }
  if (p.color_options) return t('card.shadeCount', { n: p.color_options });
  return t('detail.none');
}

export function productCard(product, { extraActions = [], from = null, onShade = null } = {}) {
  // 호수 데이터가 있는 제품은 '호수' 줄 대신 카드 안의 옵션 고르기(shadePicker)를 둔다
  const picker = product.shade_count > 1 ? shadePicker(product, { onSelect: onShade }) : null;
  const rows = [
    [t('card.brand'), brandOf(product)],
    [t('card.name'), nameOf(product)],
    // 색상값·제형 줄은 2026-11-11 카드에서 뺐다 (색은 제품 사진, 자세한 값은 제품 상세에서 본다)
    // 가격 숫자는 카드가 나타날 때 0에서 올라간다 (motion.js)
    [t('card.price'), Number.isFinite(Number(product.price)) && product.price !== null
      ? [el('span', { 'data-count': String(product.price), text: won(product.price) })]
      : (product.price == null ? t('detail.none') : won(product.price))], // 가격이 없는 테스트 제품은 '정보 없음'
    // 호수 줄은 가격 다음(네 번째): 팔레트의 작은 카드 CSS 가 1~3번째 줄(브랜드·제품명·가격) 순서에 맞춰져 있다
    picker ? null : [t('card.shade'), shadeCell(product)],
  ].filter(Boolean);
  // 대표 이미지 자리: 모든 카드에 같은 크기로 두어 줄이 맞게 한다.
  // 이미지 주소가 없거나 불러오지 못하면(외부 사이트 이미지 차단 등) '이미지 준비 중' 자리로 바꾼다
  const noImage = () => el('div', { class: 'card-img card-img-empty', text: t('card.noImage') });
  const image = product.image_url
    ? el('img', {
      class: 'card-img', src: product.image_url, alt: displayName(product), loading: 'lazy', referrerpolicy: 'no-referrer',
      onerror: (e) => e.target.replaceWith(noImage()),
    })
    : noImage();
  return el('div', { class: 'card', 'data-product-id': product.id },
    image,
    demoBadgeFor(product), // 시연용 제품이면 '시연용' 배지 (demo.js)
    el('dl', {}, rows.flatMap(([k, v]) => [el('dt', { text: k }), Array.isArray(v) ? el('dd', {}, ...v) : el('dd', { text: v })])),
    picker,
    el('div', { class: 'actions' },
      ...extraActions),
  );
}

export function productDetailTable(p) {
  const rows = [
    ['ID', p.id], [t('detail.source'), isDemo(p) ? t('detail.sourceVirtual') : t('detail.sourceOy')],
    [t('detail.barcode'), p.barcode || t('detail.none')], [t('card.brand'), brandOf(p)], [t('card.name'), nameOf(p)], [t('detail.type'), t('type.' + p.type)],
    [t('detail.shade'), shadeText(p)], [t('detail.hex'), p.color_hex],
    ...(p.color_source === 'oliveyoung_color_chip' ? [[t('detail.colorSource'), t('detail.colorChip')]] : []),
    [t('detail.lab'), `L* ${p.color_lab.L} / a* ${p.color_lab.a} / b* ${p.color_lab.b}`],
    [t('detail.family'), familyText(p)],
    [t('card.finish'), finishText(p)], [t('card.price'), won(p.price) + (p.list_price && p.list_price !== p.price ? ` (${t('detail.listPrice', { price: won(p.list_price) })})` : '')],
    [t('detail.desc'), p.description || t('detail.none')],
  ];
  if (p.original_name) rows.push([t('detail.originalName'), p.original_name]); // 한국 올리브영 원래 상품명 (영어 화면에서도 그대로)
  return el('table', {}, el('tbody', {}, rows.map(([k, v]) => el('tr', {}, el('th', { text: k }), el('td', { text: v }))),
    storeUrlOf(p) ? el('tr', {}, el('th', { text: t('detail.store') }), el('td', {}, storeLink(p, t('detail.storeOpen')))) : null));
}
