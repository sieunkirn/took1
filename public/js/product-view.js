// 제품을 화면에 보여 주는 부품: 이름·가격 표기, 제품 카드, 상세 표, 올리브영 링크.
import { fullName as koFullName, shortName as koShortName } from '../lib/catalog.js';
import { t, isEn, brandOf, nameOf, displayName, priceText } from './i18n.js';
import { el } from './dom.js';
import { demoBadgeFor } from './demo.js';
import { api } from './api.js';

// 화면에 보이는 제품 이름: 영어 화면이면 글로벌 올리브영 영어 이름(없으면 한국어 이름), 한국어면 그대로
export const fullName = (p) => (isEn() ? displayName(p) : koFullName(p));
export const shortName = (p) => (isEn() ? `${brandOf(p)} ${nameOf(p)}` : koShortName(p));

export const won = priceText; // 한국어 '13,000원', 영어 '₩13,000'

/**
 * 제품 카드. 색상은 칠하지 않고 텍스트로만 표시한다.
 * @param {object} product
 * @param {{from?: string, extraActions?: HTMLElement[]}} opts
 */
// 카드에는 브랜드·제품명·색상값·제형·가격과 올리브영 링크만 보여 준다 (나머지 정보는 제품 상세 화면에)
// extraActions: 화면마다 필요한 버튼 (예: 립 컬러 매핑의 '입술에 발라보기')
/** '입술에 발라보기' 버튼이 붙은 제품 카드. 누르면 onTry(제품) */
// 카드 안에서 호수(옵션)를 바꾸면 '발라보기'도 고른 호수로 한다
// lipIcon (2026-11-24 거울 추천 카드): 발라보기 글자 앞 입술 아이콘. 지금 입술에 바른 제품이면 아이콘이 그 색으로 채워진다 (palette.js markWorn)
// onMoreShades (2026-11-24): 호수 드롭다운 대신 '지금 호수'(색 점 + 이름) + [다른 호수 보기 ›]. 누르면 onMoreShades(제품, 카드, 호수 바꾸기)
//   호수 바꾸기(s) = 호수 화면에서 고른 호수를 카드에 반영 (지금 호수 표시·발라보기 대상·아이콘 색)
// onShades: [호수 보기] 버튼을 따로 두는 방식 (2026-11-24 잠깐 썼다가 되돌림, 지금은 안 씀)
// 입술 아이콘은 2026-11-24 사용자 요청으로 잠시 꺼 둠 (주석). 다시 켜려면 아래 기본값을 !!(onShades || onMoreShades) 로
export function tryOnCard(product, onTry, { onShades, onMoreShades, lipIcon = false /* !!(onShades || onMoreShades) */ } = {}) {
  let current = product;
  let card = null;
  // 거울 추천 카드(onMoreShades·onShades): 지금 바른 제품인지 palette.js markWorn 이 aria-pressed 로 표시한다 (data-hex 로 비교)
  const mirror = !!(onShades || onMoreShades || lipIcon);
  const tryBtn = mirror
    ? el('button', { type: 'button', class: 'try-btn', 'aria-pressed': 'false', 'data-hex': product.color_hex || '', style: `--c: ${product.color_hex || '#888'}`, onclick: () => onTry(current, card) })
    : el('button', { type: 'button', text: t('lip.tryOn'), onclick: () => onTry(current) });
  if (lipIcon) {
    tryBtn.innerHTML = '<svg class="try-lip" viewBox="0 0 24 24" aria-hidden="true">'
      + '<path class="try-lip-fill" d="M1.8 12.2C4.3 8.9 6.9 7 9 7c1.2 0 2.2.6 3 1.5.8-.9 1.8-1.5 3-1.5 2.1 0 4.7 1.9 7.2 5.2-2.6 3.6-6.1 5.9-10.2 5.9S4.4 15.8 1.8 12.2Z"/>'
      + '<path class="try-lip-line" d="M2.6 12.3c3.1.8 6.2 1.2 9.4 1.2s6.3-.4 9.4-1.2"/></svg>';
  }
  if (mirror) tryBtn.append(el('span', { class: 'try-label', text: t('lip.tryOn') }));
  const setShade = (s) => {
    current = s;
    if (mirror && s.color_hex) { tryBtn.dataset.hex = s.color_hex; tryBtn.style.setProperty('--c', s.color_hex); }
    if (nowBox) renderNow();
  };
  // 지금 호수 + 다른 호수 보기
  let nowBox = null;
  const nowDot = el('i', { 'aria-hidden': 'true' });
  const nowName = el('span', { class: 'cur-shade-name' });
  function renderNow() {
    const label = shadeLabelOf(current);
    nowBox.querySelector('.cur-shade-now').hidden = !label;
    nowDot.style.background = current.color_hex; // 호수 색은 실제 색 (CLAUDE.md 예외)
    nowName.textContent = label;
  }
  if (onMoreShades) {
    const more = product.shade_count > 1
      ? el('button', { type: 'button', class: 'more-shades', onclick: () => onMoreShades(current, card, setShade) },
        // '호수 보기' ……… '12가지 ›' (2026-11-24 사용자 요청, 예전 '다른 호수 N가지')
        el('span', { text: t('card.moreShades') }), el('span', { class: 'more-shades-n', text: t('nw.shadeCount', { n: product.shade_count }) }))
      : null;
    if (more) more.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>');
    nowBox = el('div', { class: 'cur-shade' }, el('div', { class: 'cur-shade-now' }, nowDot, nowName), more);
    renderNow();
  }
  card = productCard(product, {
    extraActions: [tryBtn,
      onShades ? el('button', { type: 'button', class: 'shades-btn', text: t('card.seeShades'), onclick: () => onShades(current, card) }) : null].filter(Boolean),
    onShade: (s) => setShade(s),
    noPicker: !!(onShades || onMoreShades),
    noShadeRow: !!onMoreShades,
  });
  if (nowBox) {
    card.querySelector('.actions').before(nowBox);
    // 브랜드 옆 제형 태그(매트·글로시…)는 2026-11-24 사용자 요청으로 뺐다
    // if (product.finish) card.querySelector('dd')?.append(el('span', { class: 'card-fin', text: finishName(product.finish) }));
  }
  return card;
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

export function productCard(product, { extraActions = [], from = null, onShade = null, noPicker = false, noShadeRow = false } = {}) {
  // 호수 데이터가 있는 제품은 '호수' 줄 대신 카드 안의 옵션 고르기(shadePicker)를 둔다 (noPicker: 호수는 따로 '호수 보기' 버튼으로)
  const picker = !noPicker && product.shade_count > 1 ? shadePicker(product, { onSelect: onShade }) : null;
  const rows = [
    [t('card.brand'), brandOf(product)],
    [t('card.name'), nameOf(product)],
    // 색상값·제형 줄은 2026-11-11 카드에서 뺐다 (색은 제품 사진, 자세한 값은 제품 상세에서 본다)
    // 가격 숫자는 카드가 나타날 때 0에서 올라간다 (motion.js)
    [t('card.price'), Number.isFinite(Number(product.price)) && product.price !== null
      ? [el('span', { 'data-count': String(product.price), text: won(product.price) })]
      : (product.price == null ? t('detail.none') : won(product.price))], // 가격이 없는 테스트 제품은 '정보 없음'
    // 호수 줄은 가격 다음(네 번째): 팔레트의 작은 카드 CSS 가 1~3번째 줄(브랜드·제품명·가격) 순서에 맞춰져 있다
    picker || noShadeRow ? null : [t('card.shade'), shadeCell(product)],
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
