// 매장 재고 (거울 추천 카드의 재고 줄 · 품절 카드의 '가까운 매장' → js/palette.js seeStock, 2026-11-27)
// 시뮬레이션: 올리브영은 매장 재고 공개 API 가 없어서 매장 목록·거리·재고를 모두 시연용으로 만든다.
//  - 매장 5곳은 지어낸 일반 이름(역앞점 등)이고 거리·영업시간은 고정값이다
//  - 재고는 (매장, 제품 id)로 정해지는 가짜 수량이라, 같은 호수는 언제 열어도 같은 숫자가 나온다
//  - 화면의 '시연용' 배지·안내 문구는 2026-11-27 사용자 요청으로 뺐다. 실데이터만 보기(?real=1, demo.js)에서는 이 화면을 열지 않는다
export const STORES = [
  { id: 'S1', ko: '올리브영 역앞점', en: 'Olive Young Station', zh: 'Olive Young 站前店', ja: 'Olive Young 駅前店', m: 350, walk: 5, hours: '10:00-22:00' },
  { id: 'S2', ko: '올리브영 중앙로점', en: 'Olive Young Jungang-ro', zh: 'Olive Young 中央路店', ja: 'Olive Young 中央路店', m: 720, walk: 10, hours: '10:00-22:00' },
  { id: 'S3', ko: '올리브영 시청점', en: 'Olive Young City Hall', zh: 'Olive Young 市厅店', ja: 'Olive Young 市庁店', m: 1200, walk: 16, hours: '09:00-21:00' },
  { id: 'S4', ko: '올리브영 터미널점', en: 'Olive Young Terminal', zh: 'Olive Young 客运站店', ja: 'Olive Young ターミナル店', m: 1900, walk: 25, hours: '10:00-23:00' },
  { id: 'S5', ko: '올리브영 대학로점', en: 'Olive Young Univ. St.', zh: 'Olive Young 大学路店', ja: 'Olive Young 大学路店', m: 2600, walk: 34, hours: '11:00-22:00' },
];

// 문자열 → 0..1 (같은 입력이면 같은 값)
function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

/** 제품(호수) 하나의 매장별 가짜 재고, 가까운 순. 약 30%는 품절, 나머지는 1~14개. best = 재고가 있는 가장 가까운 매장 */
export function nearbyStock(productId) {
  const list = STORES.map((s) => {
    const r = hash01(`${s.id}:${productId}`);
    return { ...s, stock: r < 0.3 ? 0 : 1 + Math.floor(((r - 0.3) / 0.7) * 14) };
  });
  const best = list.find((s) => s.stock > 0);
  return list.map((s) => ({ ...s, best: s === best }));
}

/** 이 매장(키오스크가 놓인 매장)의 가짜 재고. 약 25%는 품절, 나머지는 1~12개.
 *  매장 안 위치(통로·진열대·칸)는 2026-11-27 뺐다: 실제 진열 데이터가 없어 지어낸 값이었다 */
export function hereStock(p) {
  const r = hash01(`HERE:${p.id}`);
  return { stock: r < 0.25 ? 0 : 1 + Math.floor(((r - 0.25) / 0.75) * 12) };
}

export const distText = (m) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);
