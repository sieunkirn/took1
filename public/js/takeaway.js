// 가져가기 (2026-11-19 사용자 요청, 진입 흐름의 마지막 화면): 거울에서 발라 보고 호수까지 고른 립을 실제로 손에 넣는 길.
//  - 고른 제품: 사진 · 브랜드 · 이름 · 고른 호수(실제 색 견본) · 제형 · 가격
//  - 매장에서 사기: 가장 가까운 '재고 있는' 매장과 수량 (store-stock.js 의 시연용 가짜 재고 — 화면에 '시연용 데이터'로 표시), '근처 매장 모두 보기'
//  - 폰으로 가져가기: 올리브영 상품 페이지 주소를 QR 로 (qr.js). 상품 주소가 없는 제품(시연용 가상 제품)은 QR 대신 그렇게 알린다
//  - 아래: '다른 색 더 보기'(닫고 거울로) · '다 골랐어요'(처음으로: 저장값을 지우고 시작 화면)
// 거울(팔레트) 900×1440 무대 위에 아래에서 올라오는 시트. 높이는 내용만큼(아래에 붙음), 얼굴 윗부분은 보인다
import { store, el, won, shortName, shadeLabelOf } from './common.js';
import { t, isEn, brandOf, nameOf, finishText } from './i18n.js';
import { nearbyStock, openStoreStock } from './store-stock.js';
import { qrSvg } from './qr.js';
import { realOnly, demoBadge, demoBadgeFor } from './demo.js';

const C = (ko, en) => (isEn() ? en : ko);
const CLOSE_SVG = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

/** 상품 페이지 주소 (QR 에 담는다): 영어 화면이면 글로벌 올리브영, 아니면 한국 올리브영. 한국 주소는 goodsNo 만 남겨 QR 을 작게 */
export function takeUrl(p) {
  if (isEn() && p.url_en) return p.url_en;
  if (!p.url) return '';
  try {
    const u = new URL(p.url);
    const no = u.searchParams.get('goodsNo');
    return no ? `${u.origin}${u.pathname}?goodsNo=${no}` : p.url;
  } catch { return p.url; }
}

export function createTakeaway({ stage, onClose = () => {} }) {
  let open = false;
  const photo = el('img', { class: 'tk-photo', alt: '', draggable: 'false', referrerpolicy: 'no-referrer' });
  const brand = el('span', { class: 'tk-brand' });
  const name = el('strong', { class: 'tk-name', id: 'tk-name' });
  const shade = el('span', { class: 'tk-shade' });
  const meta = el('span', { class: 'tk-meta' });
  const storeBox = el('div', { class: 'tk-box tk-store' });
  const qrBox = el('div', { class: 'tk-box tk-qr' });
  const closeBtn = el('button', { type: 'button', class: 'tk-close', 'aria-label': C('닫기', 'Close'), onclick: () => api.close() });
  closeBtn.innerHTML = CLOSE_SVG;

  const root = el('section', { class: 'tk', hidden: '', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tk-title' },
    el('div', { class: 'tk-dim', onclick: () => api.close() }),
    el('div', { class: 'tk-sheet' },
      el('div', { class: 'tk-head' }, el('h2', { class: 'tk-title', id: 'tk-title', text: C('가져가기', 'Take it home') }), closeBtn),
      el('div', { class: 'tk-product' }, photo, el('div', { class: 'tk-info' }, brand, name, shade, meta)),
      el('div', { class: 'tk-ways' }, storeBox, qrBox),
      el('div', { class: 'tk-actions' },
        el('button', { type: 'button', class: 'tk-btn', text: C('다른 색 더 보기', 'Keep looking'), onclick: () => api.close() }),
        el('button', { type: 'button', class: 'tk-btn tk-btn-pink', text: C('다 골랐어요 · 처음으로', "I'm done · Start over"),
          onclick: () => { store.clear(); location.href = 'index.html'; } }))));
  stage.append(root);

  function fill(p) {
    photo.src = p.image_url || '';
    photo.hidden = !p.image_url;
    brand.textContent = brandOf(p);
    name.textContent = nameOf(p);
    const label = shadeLabelOf(p);
    shade.replaceChildren(...(label ? [el('i', { style: `background:${p.color_hex}` }), label] : []));
    meta.textContent = [p.finish ? finishText(p.finish) : null, p.price ? won(p.price) : null].filter(Boolean).join(' · '); // 제형을 모르면 빼고

    // 매장에서 사기 (시연용 재고). 실데이터만 보기에서는 가짜 재고라 칸째 숨긴다
    storeBox.hidden = realOnly();
    const rows = nearbyStock(p.id);
    const best = rows.find((s) => s.best);
    storeBox.replaceChildren(
      el('strong', { class: 'tk-box-title', text: C('매장에서 사기', 'Buy in store') }),
      best
        ? el('div', { class: 'tk-store-best' },
          el('span', { class: 'tk-store-name', text: isEn() ? best.en : best.ko }),
          el('span', { class: 'tk-store-sub', text: C(`걸어서 ${best.walk}분 · ${best.stock}개 남음`, `${best.walk} min walk · ${best.stock} left`) }),
          el('span', { class: 'tk-store-sub', text: C(`영업 ${best.hours}`, `Open ${best.hours}`) }))
        : el('span', { class: 'tk-store-sub', text: C('근처 매장 모두 품절이에요. 폰으로 온라인 주문을 이용해 주세요.', 'Sold out nearby. Please order online on your phone.') }),
      el('button', { type: 'button', class: 'tk-link', text: C('근처 매장 모두 보기', 'See all nearby stores'),
        onclick: () => openStoreStock(p.id, `${shortName(p)}${label ? ' · ' + label : ''}`) }),
      el('span', { class: 'tk-demo' }, demoBadge(), ' ', C('재고는 만든 값이에요', 'Stock values are made up')));

    // 폰으로 가져가기 (QR)
    const url = takeUrl(p);
    const svg = url ? qrSvg(url, { label: C('상품 페이지 QR 코드', 'Product page QR code') }) : '';
    const code = el('div', { class: 'tk-qr-code' });
    code.innerHTML = svg;
    qrBox.replaceChildren(
      el('strong', { class: 'tk-box-title', text: C('폰으로 가져가기', 'Take it on your phone') }),
      svg ? code : null,
      el('span', { class: 'tk-store-sub', text: svg
        ? C('폰 카메라로 찍으면 올리브영 상품 페이지가 열려요', 'Scan with your phone camera to open the Olive Young page')
        : C('이 제품은 연결할 상품 페이지가 없어요', 'No product page for this item') }),
      svg ? null : demoBadgeFor(p));
  }

  const api = {
    isOpen: () => open,
    /** p = 고른 제품(호수 상품이면 그 호수) */
    show(p) {
      if (!p) return;
      fill(p);
      root.hidden = false;
      open = true;
      requestAnimationFrame(() => root.classList.add('on'));
    },
    close() {
      if (!open) return;
      open = false;
      root.classList.remove('on');
      setTimeout(() => { if (!open) root.hidden = true; }, 350);
      onClose();
    },
  };
  return api;
}
