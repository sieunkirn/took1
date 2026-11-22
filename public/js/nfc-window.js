// NFC 태그 시트 (2026-11-18, 2026-11-19 다시 설계).
// 손님은 이미 실물 립을 들고 와서 태그한다 → 색을 크게 보여 줄 필요가 없다. 실물만으로 못 하는 것을 한다:
//   1) 바로 내 입술에: 태그하는 순간 거울을 가리지 않고 그 제품 색을 입술에 바른다 (palette.js onWear)
//   2) 들고 있는 호수 찾기·다른 호수 입어 보기: 리더기는 태그 번호만 읽어서 '어떤 제품'까지만 알고 '몇 호'인지는 모른다.
//      그래서 아래 시트에 그 제품의 실제 호수(/api/shades, 올리브영 호수 데이터)를 줄로 보여 주고, 누를 때마다 입술 색이 바뀐다.
//      바코드 번호를 써 둔 태그처럼 호수까지 알면 그 호수를 골라 둔다. 호수 데이터가 없으면 대표 색만 바르고 그렇게 알린다
//   3) 정보와 다음 단계: 사진·브랜드·이름·제형·가격, [이 색과 비슷한 립 보기](거울의 추천 제품)
// 시트는 화면 아래(다이얼 자리, y 900~)만 덮어 얼굴·입술은 그대로 보인다. 메뉴 버튼은 없고 태그할 때만 올라온다.
// 등록되지 않은 태그는 제품을 지어내지 않고 작은 안내만 띄웠다가 내려간다(앞서 보던 제품이 있으면 그 제품으로 돌아간다).
// 방금 태그한 립(최근 3개)은 sessionStorage(store 'nfcShelf') → 자동 초기화·처음으로 때 함께 지워진다. 호수 색·제품 사진은 실제 색
import { store, api, el, won, shortName, shadeLabelOf } from './common.js';
import { t, brandOf, nameOf, finishText } from './i18n.js';
import { findTagProduct } from './nfc.js';
import { REDUCE_MOTION as reduce } from './motion.js';

const SHELF_MAX = 3;
const UNKNOWN_MS = 3200;
const SHELF_KEY = 'nfcShelf';
const CLOSE_SVG = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const lineOf = (p) => p.line || p.id; // 호수 상품(OY-…-01)이면 그 제품 줄

/**
 * NFC 시트 만들기. stage = 팔레트 900×1440 무대.
 * onWear(p): 그 색을 입술에 바르기 · onSimilar(): 지금 색과 비슷한 립(거울 추천 제품) · onOpen(): 시트가 올라올 때
 * onTake(p): 가져가기 화면 (고른 호수, 2026-11-19 진입 흐름의 마지막 화면)
 */
export function createNfcWindow({ stage, onWear, onSimilar, onOpen, onTake }) {
  let shelf = (store.get(SHELF_KEY) || []).filter((p) => p && p.id && p.color_hex).slice(-SHELF_MAX);
  let current = null; // 태그한 제품
  let picked = null; // 입술에 바른 호수 (null = 대표 색)
  let shades = [];
  let seq = 0;
  let unknownTimer = 0;

  // ---------- 틀 ----------
  const photo = el('img', { class: 'nt-photo', alt: '', draggable: 'false', referrerpolicy: 'no-referrer' });
  const brand = el('span', { class: 'nt-brand' });
  const name = el('strong', { class: 'nt-name', id: 'nt-name' });
  const meta = el('span', { class: 'nt-meta' });
  const recent = el('div', { class: 'nt-recent', role: 'group', 'aria-label': t('nw.recent') });
  const close = el('button', { type: 'button', class: 'nt-close', 'aria-label': t('nw.close'), title: t('nw.close'), onclick: () => api_.close() });
  close.innerHTML = CLOSE_SVG;
  const head = el('div', { class: 'nt-head' }, photo, el('div', { class: 'nt-title' }, brand, name, meta), recent, close);

  const pickLabel = el('strong', { class: 'nt-pick' });
  const pickNow = el('span', { class: 'nt-now' });
  const chips = el('div', { class: 'nt-chips', role: 'listbox', 'aria-labelledby': 'nt-name' });
  const shadeBox = el('div', { class: 'nt-shades' }, el('div', { class: 'nt-shades-head' }, pickLabel, pickNow), chips);

  const actions = el('div', { class: 'nt-actions' },
    el('button', { type: 'button', class: 'nt-btn', onclick: () => { api_.close(); onSimilar(); } }, t('nw.similar')),
    onTake ? el('button', { type: 'button', class: 'nt-btn nt-btn-pink', onclick: () => { const x = picked || current; api_.close(); onTake(x); } }, t('nw.take')) : null);

  const unknown = el('div', { class: 'nt-unknown' },
    el('span', { class: 'nt-q', 'aria-hidden': 'true', text: '?' }),
    el('div', {}, el('strong', { text: t('nw.unknown') }), el('span', { text: t('nw.unknownSub') })));

  const root = el('section', { class: 'nt', id: 'nw', hidden: '', 'data-state': 'product', role: 'dialog', 'aria-labelledby': 'nt-name' },
    el('i', { class: 'nt-grab', 'aria-hidden': 'true' }), head, shadeBox, actions, unknown);
  stage.append(root);
  // 시트 밖(거울)을 누르면 내려간다. 다이얼·메뉴를 만지려는 손길도 같다
  stage.addEventListener('pointerdown', (e) => { if (!root.hidden && !root.contains(e.target)) api_.close(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) api_.close(); });

  // ---------- 그리기 ----------
  function renderHead(p) {
    if (p.image_url) { photo.src = p.image_url; photo.hidden = false; } else photo.hidden = true;
    brand.textContent = brandOf(p);
    name.textContent = nameOf(p);
    meta.textContent = [p.finish && finishText(p.finish), p.price && won(p.price)].filter(Boolean).join(' · ');
    recent.replaceChildren(...(shelf.length > 1 ? shelf.map((x) => {
      const b = el('button', { type: 'button', class: 'nt-rec', 'aria-pressed': String(x.id === p.id), 'aria-label': shortName(x), onclick: () => showProduct(x) });
      if (x.image_url) b.append(el('img', { src: x.image_url, alt: '', draggable: 'false', referrerpolicy: 'no-referrer' }));
      else b.style.background = x.color_hex;
      return b;
    }) : []));
  }

  function renderPick() {
    if (!shades.length) {
      pickLabel.textContent = t('nw.noShades');
      pickNow.textContent = '';
      return;
    }
    pickLabel.textContent = t(picked ? 'nw.wearing' : 'nw.pickShade');
    pickNow.textContent = picked ? shadeLabelOf(picked) : t('nw.shadeCount', { n: shades.length });
    for (const c of chips.children) c.setAttribute('aria-selected', String(c.dataset.id === picked?.id));
  }

  function renderChips() {
    chips.replaceChildren(...shades.map((s) => {
      const dot = el('i', { 'aria-hidden': 'true' });
      dot.style.background = s.color_hex; // 호수 색은 실제 색 (CLAUDE.md 예외)
      return el('button', { type: 'button', class: 'nt-chip', role: 'option', 'data-id': s.id, 'aria-label': shadeLabelOf(s), 'aria-selected': 'false',
        onclick: () => wear(s) }, dot, el('span', { text: s.shade_no || shadeLabelOf(s) }));
    }));
  }

  function wear(s) {
    picked = s;
    onWear({ ...s, finish: s.finish || current?.finish, image_url: s.image_url || current?.image_url });
    renderPick();
  }

  async function loadShades(p) {
    const my = seq;
    const r = await api('api/shades?id=' + encodeURIComponent(lineOf(p))).catch(() => null);
    if (my !== seq) return;
    shades = (r?.ok && r.body?.shades || []).filter((s) => s.color_hex);
    renderChips();
    renderPick();
    // 호수까지 알고 태그했으면(바코드 번호 태그) 그 호수를 골라 둔 채로, 그 자리로 줄을 민다
    const sel = picked && chips.querySelector(`[data-id="${CSS.escape(picked.id)}"]`);
    if (sel) chips.scrollLeft = sel.offsetLeft - chips.clientWidth / 2 + sel.offsetWidth / 2;
    else chips.scrollLeft = 0;
  }

  function showProduct(p, { fromTag = false } = {}) {
    seq++;
    clearTimeout(unknownTimer);
    current = p;
    picked = p.shade_no ? p : null; // 호수까지 아는 태그(바코드 번호)만 호수를 골라 둔다
    shades = [];
    chips.replaceChildren(...Array.from({ length: 8 }, () => el('span', { class: 'nt-chip nt-chip-wait', 'aria-hidden': 'true' }, el('i'))));
    pickLabel.textContent = t('nw.pickShade');
    pickNow.textContent = '';
    onWear(p); // 우선 그 제품 색(호수를 알면 그 호수)을 바로 입술에
    renderHead(p);
    root.dataset.state = 'product';
    open();
    if (fromTag && !reduce) {
      root.classList.remove('nt-hit');
      void root.offsetWidth;
      root.classList.add('nt-hit');
    }
    loadShades(p);
  }

  function addToShelf(p) {
    shelf = shelf.filter((x) => x.id !== p.id);
    shelf.push(p);
    shelf = shelf.slice(-SHELF_MAX);
    store.set(SHELF_KEY, shelf);
  }

  function open() {
    if (!root.hidden) return;
    onOpen?.();
    root.hidden = false;
    document.documentElement.classList.add('nfc-win-open');
    if (!reduce) root.animate([{ transform: 'translateY(105%)' }, { transform: 'translateY(-10px)', offset: 0.7 }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2, .9, .3, 1)' });
  }

  // ---------- 밖에서 쓰는 것 ----------
  const api_ = {
    isOpen: () => !root.hidden,
    close() {
      if (root.hidden) return;
      clearTimeout(unknownTimer);
      document.documentElement.classList.remove('nfc-win-open');
      const done = () => { root.hidden = true; };
      if (reduce) { done(); return; }
      root.animate([{ transform: 'none' }, { transform: 'translateY(105%)' }], { duration: 260, easing: 'cubic-bezier(.4, 0, 1, 1)' }).finished.then(done, done);
    },
    /** 리더기·바코드로 읽은 번호 → 제품을 찾아 바로 바르고 시트를 올린다 */
    async show(code) {
      const my = ++seq;
      const p = await findTagProduct(code, api).catch(() => null);
      if (my !== seq) return;
      if (!p?.color_hex) {
        const back = !root.hidden && current;
        root.dataset.state = 'unknown';
        open();
        clearTimeout(unknownTimer);
        unknownTimer = setTimeout(() => { if (back) root.dataset.state = 'product'; else api_.close(); }, UNKNOWN_MS);
        return;
      }
      addToShelf(p);
      showProduct(p, { fromTag: true });
    },
  };
  window.tookNfcWin = api_; // 화면 확인·자동 테스트용: tookNfcWin.show('TEST0001')
  return api_;
}
