// 근처 매장 재고 (호수 안내 shades.js 의 '근처 매장 재고' 버튼)
// 시뮬레이션: 올리브영은 매장 재고 공개 API 가 없어서 매장 목록·거리·재고를 모두 시연용으로 만든다.
//  - 매장 5곳은 지어낸 일반 이름(역앞점 등)이고 거리는 고정값이다
//  - 재고는 (매장, 제품 id)로 정해지는 가짜 수량이라, 같은 호수는 언제 열어도 같은 숫자가 나온다
//  - 화면에 '시연용 데이터'라고 표시한다
// 가장 가까운 '재고 있는' 매장에 '추천' 표시를 붙인다
import { el } from './dom.js';
import { isEn } from './i18n.js';
import { demoBadge } from './demo.js';

const C = (ko, en) => (isEn() ? en : ko);

const STORES = [
  { id: 'S1', ko: '올리브영 역앞점', en: 'Olive Young Station', m: 350, walk: 5, hours: '10:00-22:00' },
  { id: 'S2', ko: '올리브영 중앙로점', en: 'Olive Young Jungang-ro', m: 720, walk: 10, hours: '10:00-22:00' },
  { id: 'S3', ko: '올리브영 시청점', en: 'Olive Young City Hall', m: 1200, walk: 16, hours: '09:00-21:00' },
  { id: 'S4', ko: '올리브영 터미널점', en: 'Olive Young Terminal', m: 1900, walk: 25, hours: '10:00-23:00' },
  { id: 'S5', ko: '올리브영 대학로점', en: 'Olive Young Univ. St.', m: 2600, walk: 34, hours: '11:00-22:00' },
];

// 문자열 → 0..1 (같은 입력이면 같은 값)
function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

/** 제품 하나의 매장별 가짜 재고 (가까운 순). 약 30%는 품절, 나머지는 1~14개 */
export function nearbyStock(productId) {
  const list = STORES.map((s) => {
    const r = hash01(`${s.id}:${productId}`);
    return { ...s, stock: r < 0.3 ? 0 : 1 + Math.floor(((r - 0.3) / 0.7) * 14) };
  });
  const best = list.find((s) => s.stock > 0);
  return list.map((s) => ({ ...s, best: s === best }));
}

const dist = (m) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);
const level = (n) => (n === 0 ? C('품절', 'Sold out') : n <= 3 ? C(`${n}개 · 적음`, `${n} left · Low`) : C(`${n}개`, `${n} in stock`));

let dialog = null;

/** 매장 재고 창을 연다. label = 화면 위에 보일 제품·호수 이름 */
export function openStoreStock(productId, label) {
  dialog?.remove();
  const rows = nearbyStock(productId);
  const best = rows.find((s) => s.best);
  const close = () => { dialog.close(); dialog.remove(); dialog = null; };

  dialog = el('dialog', { class: 'store-sheet', 'aria-label': C('근처 매장 재고', 'Nearby store stock') },
    el('div', { class: 'store-head' },
      el('div', {},
        el('strong', { text: C('근처 매장 재고', 'Nearby store stock') }),
        el('p', { class: 'store-sub' }, label, ' ', demoBadge())),
      el('button', { type: 'button', class: 'store-close', 'aria-label': C('닫기', 'Close'), text: '✕', onclick: close })),
    best
      ? el('p', { class: 'store-pick', text: C(`가장 가까운 구매 가능 매장은 ${best.ko}이에요. 걸어서 ${best.walk}분.`, `Nearest store with stock: ${best.en}, ${best.walk} min walk.`) })
      : el('p', { class: 'store-pick', text: C('근처 매장 모두 품절이에요. 온라인 주문을 이용해 주세요.', 'Sold out at all nearby stores. Please order online.') }),
    el('ul', { class: 'store-list' }, ...rows.map((s) => el('li', { class: 'store-row' + (s.stock === 0 ? ' out' : '') + (s.best ? ' best' : '') },
      el('div', { class: 'store-info' },
        el('span', { class: 'store-name' }, isEn() ? s.en : s.ko, s.best ? el('span', { class: 'store-badge', text: C('추천', 'Best') }) : null),
        el('span', { class: 'store-meta', text: `${dist(s.m)} · ${C(`도보 ${s.walk}분`, `${s.walk} min walk`)} · ${s.hours}` })),
      el('span', { class: 'store-qty', text: level(s.stock) })))),
    el('p', { class: 'store-note', text: C('매장·거리·재고는 시연용으로 만든 값이에요. 실제 재고는 올리브영 앱에서 확인해 주세요.', 'Stores, distances and stock are demo values. Check the Olive Young app for real stock.') }));

  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); }); // 바깥(어두운 곳) 누르면 닫기
  document.body.append(dialog);
  dialog.showModal();
}
