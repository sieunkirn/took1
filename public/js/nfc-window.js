// NFC 태그 시트 (2026-11-18, 2026-11-19 다시 설계).
// 손님은 이미 실물 립을 들고 와서 태그한다 → 색을 크게 보여 줄 필요가 없다. 실물만으로 못 하는 것을 한다:
//   1) 바로 내 입술에: 태그하는 순간 거울을 가리지 않고 그 제품 색을 입술에 바른다 (palette.js onWear)
//   2) 들고 있는 호수 찾기·다른 호수 입어 보기: 리더기는 태그 번호만 읽어서 '어떤 제품'까지만 알고 '몇 호'인지는 모른다.
//      그래서 아래 시트에 그 제품의 실제 호수(/api/shades, 올리브영 호수 데이터)를 줄로 보여 주고, 누를 때마다 입술 색이 바뀐다.
//      바코드 번호를 써 둔 태그처럼 호수까지 알면 그 호수를 골라 둔다. 호수 데이터가 없으면 대표 색만 바르고 그렇게 알린다
//   3) 정보와 다음 단계: 사진·브랜드·이름·제형·가격, [이 색과 비슷한 립 보기](거울의 추천 제품)
// 시트는 화면 아래(다이얼 자리, y 900~)만 덮어 얼굴·입술은 그대로 보인다.
// 2026-11-22: 태그하면 먼저 가운데 '인식했어요' 모달(제품 사진)을 2.2초 보여 준 뒤 이 시트(제품 카드)로 넘어간다.
// 거울 알약의 NFC 버튼은 같은 모달로 '제품을 리더기에 대 주세요' 안내를 띄운다(아래 '가운데 세로 모달').
// 등록되지 않은 태그는 제품을 지어내지 않고 작은 안내만 띄웠다가 내려간다(앞서 보던 제품이 있으면 그 제품으로 돌아간다).
// 방금 태그한 립(최근 3개)은 sessionStorage(store 'nfcShelf') → 자동 초기화·처음으로 때 함께 지워진다. 호수 색·제품 사진은 실제 색
import { store, api, el, won, shortName, shadeLabelOf } from './common.js';
import { t, brandOf, nameOf, finishText } from './i18n.js';
import { findTagProduct, normalizeTag } from './nfc.js';
import { getBasket, keepAwake, getSent, takeSent } from './basket.js'; // 카드 담기 (휴대폰 basket.html 에서 담은 립, 2026-11-23)
import { REDUCE_MOTION as reduce } from './motion.js';

const SHELF_MAX = 3;
const UNKNOWN_MS = 3200;
const HIT_MS = 2200; // '인식했어요' 모달을 보여 주는 시간. 그 뒤 아래 제품 카드(시트)로 넘어간다 (2026-11-22)
const NFC_SVG = '<svg viewBox="0 0 33.05 31.86" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M7.78 13.44C10.04 15.1 10.04 16.76 7.78 18.42" stroke-width="2.6"/><path d="M12.64 8.96C16.85 13.61 16.85 18.26 12.64 22.9" stroke-width="2.8"/><path d="M17.01 4.98C23.17 12.28 23.17 19.58 17.01 26.89" stroke-width="2.8"/><path d="M21.38 1.99C29.48 11.29 29.48 20.58 21.38 29.87" stroke-width="2.8"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7"/></svg>';
const SHELF_KEY = 'nfcShelf';
const CLOSE_SVG = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const lineOf = (p) => p.line || p.id;
const BASKET_POLL_MS = 4000; // 카드를 댄 뒤 휴대폰에서 새로 담으면 거울도 바로 바뀌게 서버를 다시 본다
const BASKET_LIVE_MS = 10 * 60 * 1000; // 카드를 마지막으로 댄 뒤 이만큼만 (그 뒤 다시 대면 다시 시작) // 호수 상품(OY-…-01)이면 그 제품 줄

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
  // 카드 담기 (2026-11-23): 손님 카드를 대면 휴대폰에서 담은 립 목록(basket)을 가져와 차례로 입술에 바른다.
  // 같은 카드를 다시 대면 다음 립으로. 카드를 댄 뒤 10분 동안은 4초마다 목록을 다시 봐서, 휴대폰으로 새로 담은 립이 바로 발라진다
  let basket = null; // { card, items: [제품] }
  let basketPos = 0;
  let basketAt = 0;
  let pollTimer = 0;
  const rowItems = () => (basket ? basket.items : shelf);
  keepAwake(); // 담기 서버(Render)가 잠들지 않게
  // 휴대폰의 [거울에 바로 띄우기] (2026-11-23): 3초마다 서버를 보고, 보낸 카드가 있으면 그 카드의 립을 띄운다
  let nowBusy = false;
  setInterval(async () => {
    if (nowBusy || document.hidden) return;
    nowBusy = true;
    try {
      const sent = await getSent({ timeoutMs: 5000 }).catch(() => null);
      if (sent?.mode !== 'now') return;
      await takeSent(sent.id);
      const b = await getBasket(sent.card, { timeoutMs: 8000 }).catch(() => null);
      if (b?.items?.some((x) => x.color_hex)) { seq++; showBasket(b); }
    } finally {
      nowBusy = false;
    }
  }, 3000);

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

  // ---------- 가운데 세로 모달 (2026-11-22, Figma 시안 D·F·H) ----------
  // wait   : 거울 왼쪽 알약의 NFC 버튼(또는 홈의 NFC 버튼)을 누르면 '제품을 리더기에 대 주세요' 안내. 리더기는 늘 듣고 있다
  // hit    : 태그를 읽으면 '인식했어요' + 제품 사진·이름·호수. 입술에는 그 순간 바로 바르고, HIT_MS 뒤 아래 제품 카드(시트)로 넘어간다
  // unknown: 안내를 띄운 채로 등록 안 된 태그를 대면 '?' 를 잠깐 보이고 다시 wait
  let hitTimer = 0;
  let hitProduct = null;
  const mClose = el('button', { type: 'button', class: 'nm-close', 'aria-label': t('nw.close'), title: t('nw.close'), onclick: () => modalTap() });
  mClose.innerHTML = CLOSE_SVG;
  const art = el('div', { class: 'nm-art', 'aria-hidden': 'true' }, el('i', { class: 'nm-ring' }), el('i', { class: 'nm-ring nm-ring2' }), el('span', { class: 'nm-dot' }));
  art.querySelector('.nm-dot').innerHTML = NFC_SVG;
  const step = (n) => el('li', {}, el('b', { text: String(n) }), el('span', { text: t('nm.step' + n) }));
  const waitBox = el('div', { class: 'nm-wait' }, art,
    el('h2', { class: 'nm-title', id: 'nm-title', text: t('nm.title') }),
    el('p', { class: 'nm-sub', text: t('nm.sub') }),
    el('ol', { class: 'nm-steps' }, step(1), step(2), step(3)),
    el('p', { class: 'nm-status' }, el('i'), el('span', { text: t('nm.waiting') })),
    el('button', { type: 'button', class: 'nm-btn', onclick: () => fakeTag() }, t('nm.dial')));
  const hPhotoWrap = el('div', { class: 'nm-photo' });
  const hImg = el('img', { alt: '', draggable: 'false', referrerpolicy: 'no-referrer' });
  const hBrand = el('span', { class: 'nm-brand' });
  const hName = el('strong', { class: 'nm-name' });
  const hDot = el('i');
  const hMeta = el('span');
  const hBar = el('i');
  const badgeText = el('span', { text: t('nm.hit') });
  const badge = el('span', { class: 'nm-badge' }, el('b'), badgeText);
  badge.querySelector('b').innerHTML = CHECK_SVG;
  const hitBox = el('div', { class: 'nm-hitbox' }, badge, hPhotoWrap, hBrand, hName, el('p', { class: 'nm-shade' }, hDot, hMeta),
    el('p', { class: 'nm-status' }, el('i'), el('span', { text: t('nm.applied') })),
    el('div', { class: 'nm-bar', 'aria-hidden': 'true' }, hBar),
    el('button', { type: 'button', class: 'nm-btn nm-btn-pink', onclick: () => toCard() }, t('nm.toCard')));
  const unkBox = el('div', { class: 'nm-unk' }, el('span', { class: 'nt-q', 'aria-hidden': 'true', text: '?' }),
    el('strong', { text: t('nw.unknown') }), el('span', { text: t('nw.unknownSub') }));
  const mBox = el('section', { class: 'nm-box', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'nm-title' }, mClose, waitBox, hitBox, unkBox);
  const modal = el('div', { class: 'nm', id: 'nfc-modal', hidden: '', 'data-state': 'wait' }, el('div', { class: 'nm-back', onclick: () => modalTap() }), mBox);
  stage.append(modal);
  const modalOpen = () => !modal.hidden;
  function modalShow(state) {
    modal.dataset.state = state;
    if (!modal.hidden) return;
    modal.hidden = false;
    if (!reduce) mBox.animate([{ transform: 'translateY(-50%) scale(.94)', opacity: 0 }, { transform: 'translateY(-50%)', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2, .9, .3, 1)' });
  }
  function modalClose() {
    clearTimeout(hitTimer);
    clearTimeout(unknownTimer);
    hitProduct = null;
    if (modal.hidden) return;
    const done = () => { modal.hidden = true; };
    if (reduce) { done(); return; }
    mBox.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-50%) scale(.96)' }], { duration: 200, easing: 'ease-in' }).finished.then(done, done);
  }
  // 테스트용 (2026-11-22 사용자 요청): 안내 모달의 '다이얼로 고르기 (테스트용)' 버튼 = 리더기 없이 NFC 가 인식된 척.
  // 화면 목록(/api/products, 호수 있는 실제 제품)에서 아무 제품이나 하나 골라 실제 태그와 같은 길('인식했어요' → 제품 카드)로 보낸다
  let testPool = null;
  async function fakeTag() {
    if (!testPool) {
      const r = await api('api/products').catch(() => null);
      testPool = (r?.ok && r.body?.products || []).filter((p) => p.color_hex);
    }
    if (!testPool.length || !modalOpen()) return;
    const p = testPool[Math.floor(Math.random() * testPool.length)];
    stopBasket();
    seq++;
    addToShelf(p);
    clearTimeout(unknownTimer);
    showHit(p);
  }
  // 바깥·닫기를 누르면: 안내 중이면 닫고, '인식했어요' 중이면 바로 제품 카드로
  function modalTap() { if (modal.dataset.state === 'hit' && hitProduct) toCard(); else modalClose(); }
  function toCard() {
    const p = hitProduct;
    modalClose();
    if (p) showProduct(p, { fromTag: true, worn: true });
  }
  function showHit(p, label = t('nm.hit')) {
    clearTimeout(hitTimer);
    hitProduct = p;
    badgeText.textContent = label;
    hPhotoWrap.style.setProperty('--c', p.color_hex); // 사진 뒤 원 = 그 제품 실제 색
    if (p.image_url) { hImg.src = p.image_url; hPhotoWrap.replaceChildren(hImg); } else hPhotoWrap.replaceChildren();
    hBrand.textContent = brandOf(p);
    hName.textContent = nameOf(p);
    hDot.style.background = p.color_hex;
    hMeta.textContent = [p.shade_no && shadeLabelOf(p), p.finish && finishText(p.finish), p.price && won(p.price)].filter(Boolean).join(' · ');
    onWear(p); // 모달 뒤 거울 속 입술에는 지금 바로
    modalShow('hit');
    if (!reduce) {
      hBar.getAnimations().forEach((a) => a.cancel());
      hBar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: HIT_MS, easing: 'linear', fill: 'forwards' });
    }
    hitTimer = setTimeout(toCard, HIT_MS);
  }

  // 시트 밖(거울)을 누르면 내려간다. 다이얼·메뉴를 만지려는 손길도 같다 (모달을 누르는 건 빼고)
  stage.addEventListener('pointerdown', (e) => { if (!root.hidden && !root.contains(e.target) && !modal.contains(e.target)) api_.close(); }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (modalOpen()) modalTap(); else if (!root.hidden) api_.close();
  });

  // ---------- 그리기 ----------
  function renderHead(p) {
    if (p.image_url) { photo.src = p.image_url; photo.hidden = false; } else photo.hidden = true;
    brand.textContent = brandOf(p);
    name.textContent = nameOf(p);
    meta.textContent = [p.finish && finishText(p.finish), p.price && won(p.price)].filter(Boolean).join(' · ');
    const row = rowItems();
    recent.classList.toggle('nt-recent-basket', !!basket);
    recent.setAttribute('aria-label', t(basket ? 'bk.row' : 'nw.recent'));
    recent.replaceChildren(...(row.length > 1 ? row.map((x, i) => {
      const b = el('button', { type: 'button', class: 'nt-rec', 'aria-pressed': String(x.id === p.id), 'aria-label': shortName(x), onclick: () => { if (basket) basketPos = i; showProduct(x); } });
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

  // ---------- 카드 담기 ----------
  function showBasket(b) {
    const list = (b.items || []).filter((p) => p.color_hex);
    const same = basket && basket.card === b.card;
    basket = { card: b.card, items: list };
    basketPos = same ? (basketPos + 1) % list.length : 0; // 처음엔 먼저 담은 것부터, 같은 카드를 다시 대면 다음 립
    basketAt = Date.now();
    onOpen?.();
    if (!root.hidden) { document.documentElement.classList.remove('nfc-win-open'); root.hidden = true; }
    clearTimeout(unknownTimer);
    showHit(list[basketPos], t('bk.cardHit', { n: list.length }));
    poll();
  }
  function stopBasket() {
    basket = null;
    clearTimeout(pollTimer);
  }
  function poll() {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => {
      if (!basket || Date.now() - basketAt > BASKET_LIVE_MS) return;
      const card = basket.card;
      const b = await getBasket(card, { timeoutMs: 8000 }).catch(() => null);
      if (!basket || basket.card !== card) return;
      if (b) {
        const list = (b.items || []).filter((p) => p.color_hex);
        const had = new Set(basket.items.map((x) => x.id));
        const fresh = list.filter((x) => !had.has(x.id));
        const changed = fresh.length || list.length !== basket.items.length;
        basket.items = list;
        if (fresh.length) {
          const p = fresh[fresh.length - 1]; // 휴대폰으로 방금 담은 립을 바로 바른다
          basketPos = list.findIndex((x) => x.id === p.id);
          seq++;
          if (!root.hidden) { document.documentElement.classList.remove('nfc-win-open'); root.hidden = true; }
          showHit(p, t('bk.newItem'));
        } else if (changed && !root.hidden && current) {
          if (list.length) renderHead(current); else stopBasket();
        }
      }
      poll();
    }, BASKET_POLL_MS);
  }

  function showProduct(p, { fromTag = false, worn = false } = {}) {
    seq++;
    clearTimeout(unknownTimer);
    current = p;
    picked = p.shade_no ? p : null; // 호수까지 아는 태그(바코드 번호)만 호수를 골라 둔다
    shades = [];
    chips.replaceChildren(...Array.from({ length: 8 }, () => el('span', { class: 'nt-chip nt-chip-wait', 'aria-hidden': 'true' }, el('i'))));
    pickLabel.textContent = t('nw.pickShade');
    pickNow.textContent = '';
    if (!worn) onWear(p); // 우선 그 제품 색(호수를 알면 그 호수)을 바로 입술에 ('인식했어요' 모달에서 이미 발랐으면 건너뜀)
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
    /** NFC 안내 모달 열기 (거울 알약의 NFC 버튼·홈의 NFC 버튼) */
    wait() {
      onOpen?.();
      if (!root.hidden) api_.close();
      clearTimeout(hitTimer);
      hitProduct = null;
      modalShow('wait');
    },
    /** 리더기로 읽은 번호 → 제품을 찾아 바로 바르고 '인식했어요' 모달 → 아래 제품 카드(시트) */
    async show(code) {
      const my = ++seq;
      // 카드 담기: 태그 번호(UID)면 담은 목록도 함께 본다. 담은 게 있으면 그 카드가 손님 카드다 (제품 태그로 등록된 번호라도 담은 게 있으면 카드).
      // 서버가 늦으면 2.5초만 기다리고 제품 태그로 본다
      const uid = /^[0-9A-F]{8,}$/.test(normalizeTag(code));
      const [p, b] = await Promise.all([
        findTagProduct(code, api).catch(() => null),
        uid ? getBasket(code, { timeoutMs: 2500 }).catch(() => null) : null,
      ]);
      if (my !== seq) return;
      if (b?.items?.some((x) => x.color_hex)) { showBasket(b); return; }
      if (p?.color_hex) stopBasket(); // 제품 태그를 대면 카드 목록 보기는 끝
      // 휴대폰 찍기 (2026-11-23): 모르는 번호 = 휴대폰일 수 있다. 휴대폰 번호는 댈 때마다 바뀌므로, 방금 휴대폰에서 [거울에 찍기]를 누른 카드를 띄운다
      if (!p?.color_hex) {
        const sent = await getSent({ timeoutMs: 3000 }).catch(() => null);
        if (my !== seq) return;
        if (sent?.mode === 'tap') {
          takeSent(sent.id);
          const sb = await getBasket(sent.card, { timeoutMs: 5000 }).catch(() => null);
          if (my !== seq) return;
          if (sb?.items?.some((x) => x.color_hex)) { showBasket(sb); return; }
        }
      }
      if (!p?.color_hex && modalOpen() && modal.dataset.state !== 'hit') {
        // 안내를 띄운 채로 등록 안 된 태그: 모달 안에서 '?' 를 잠깐 보이고 다시 안내로
        modal.dataset.state = 'unknown';
        clearTimeout(unknownTimer);
        unknownTimer = setTimeout(() => { if (modalOpen()) modal.dataset.state = 'wait'; }, UNKNOWN_MS);
        return;
      }
      if (!p?.color_hex) {
        const back = !root.hidden && current;
        root.dataset.state = 'unknown';
        open();
        clearTimeout(unknownTimer);
        unknownTimer = setTimeout(() => { if (back) root.dataset.state = 'product'; else api_.close(); }, UNKNOWN_MS);
        return;
      }
      addToShelf(p);
      onOpen?.();
      if (!root.hidden) { // 제품 카드가 떠 있으면 내리고 '인식했어요'부터
        document.documentElement.classList.remove('nfc-win-open');
        root.hidden = true;
      }
      clearTimeout(unknownTimer);
      showHit(p);
    },
  };
  window.tookNfcWin = api_; // 화면 확인·자동 테스트용: tookNfcWin.show('TEST0001')
  return api_;
}
