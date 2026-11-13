// 제품을 화면에 보여 주는 부품: 이름·가격 표기, 제품 카드, 상세 표, 올리브영 링크.
import { fullName as koFullName, shortName as koShortName } from '../lib/catalog.js';
import { t, isEn, brandOf, nameOf, displayName, storeUrlOf, priceText, finishText as finishName } from './i18n.js';
import { el } from './dom.js';
import { go } from './store.js';

// 화면에 보이는 제품 이름: 영어 화면이면 글로벌 올리브영 영어 이름(없으면 한국어 이름), 한국어면 그대로
export const fullName = (p) => (isEn() ? displayName(p) : koFullName(p));
export const shortName = (p) => (isEn() ? `${brandOf(p)} ${nameOf(p)}` : koShortName(p));

// 수집하지 않은 정보는 비워 두고, 추정한 값은 추정이라고 표시한다 (올리브영 데이터)
const shadeText = (p) => p.shade_name || (p.color_options ? t('detail.shadeOf', { n: p.color_options }) : t('detail.shadeRep'));
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
export function tryOnCard(product, onTry) {
  return productCard(product, {
    extraActions: [el('button', { type: 'button', text: t('lip.tryOn'), onclick: () => onTry(product) })],
  });
}

export function productCard(product, { extraActions = [] } = {}) {
  const rows = [
    [t('card.brand'), brandOf(product)],
    [t('card.name'), nameOf(product)],
    // 색상값·제형 줄은 2026-11-11 카드에서 뺐다 (색은 제품 사진, 자세한 값은 제품 상세에서 본다)
    // 가격 숫자는 카드가 나타날 때 0에서 올라간다 (motion.js)
    [t('card.price'), Number.isFinite(Number(product.price)) && product.price !== null
      ? [el('span', { 'data-count': String(product.price), text: won(product.price) })]
      : (product.price == null ? t('detail.none') : won(product.price))], // 가격이 없는 테스트 제품은 '정보 없음'
  ];
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
    el('dl', {}, rows.flatMap(([k, v]) => [el('dt', { text: k }), Array.isArray(v) ? el('dd', {}, ...v) : el('dd', { text: v })])),
    el('div', { class: 'actions' },
      ...extraActions),
  );
}

export function productDetailTable(p) {
  const rows = [
    ['ID', p.id], [t('detail.source'), p.source === 'oliveyoung' ? t('detail.sourceOy') : t('detail.sourceVirtual')],
    [t('detail.barcode'), p.barcode || t('detail.none')], [t('card.brand'), brandOf(p)], [t('card.name'), nameOf(p)], [t('detail.type'), t('type.' + p.type)],
    [t('detail.shade'), shadeText(p)], [t('detail.hex'), p.color_hex],
    [t('detail.lab'), `L* ${p.color_lab.L} / a* ${p.color_lab.a} / b* ${p.color_lab.b}`],
    [t('detail.family'), familyText(p)],
    [t('card.finish'), finishText(p)], [t('card.price'), won(p.price) + (p.list_price && p.list_price !== p.price ? ` (${t('detail.listPrice', { price: won(p.list_price) })})` : '')],
    [t('detail.desc'), p.description || t('detail.none')],
  ];
  if (p.original_name) rows.push([t('detail.originalName'), p.original_name]); // 한국 올리브영 원래 상품명 (영어 화면에서도 그대로)
  return el('table', {}, el('tbody', {}, rows.map(([k, v]) => el('tr', {}, el('th', { text: k }), el('td', { text: v }))),
    storeUrlOf(p) ? el('tr', {}, el('th', { text: t('detail.store') }), el('td', {}, storeLink(p, t('detail.storeOpen')))) : null));
}
