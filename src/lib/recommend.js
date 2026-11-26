// 색상 기반 추천: 기준 색상과 각 제품 color_lab 의 CIEDE2000 색차로 정렬한다 (무작위 요소 없음).
// 호수 데이터가 있는 제품(catalog.shadesOf)은 기준 색과 가장 가까운 호수 하나로 바꿔 보여 준다 (제품당 한 줄).
// 그래서 카드에는 '04 피그피그' 같은 호수가 나오고, 발라 보기도 그 호수의 색으로 한다.
import { hexToLab, deltaE2000, similarityFromDeltaE, normalizeHex } from './color.js';
import { allProducts, shadesOf } from './catalog.js';

export function withSimilarity(product, refLab) {
  const dE = deltaE2000(refLab, product.color_lab);
  return { ...product, delta_e: Math.round(dE * 100) / 100, similarity: similarityFromDeltaE(dE) };
}

const byDelta = (a, b) => a.delta_e - b.delta_e || a.id.localeCompare(b.id);

/** 제품 하나 → 추천 후보 하나 (호수가 있으면 가장 가까운 호수). excludeIds 에 그 제품이나 그 호수가 있으면 null */
function bestOf(p, refLab, excluded) {
  const shades = shadesOf(p);
  if (excluded.has(p.id) || shades.some((s) => excluded.has(s.id))) return null; // 이미 보여 준 제품은 다른 호수로도 다시 내지 않는다
  if (!shades.length) return withSimilarity(p, refLab);
  return shades.map((s) => withSimilarity(s, refLab)).sort(byDelta)[0];
}

/**
 * finish: 제형 하나('matte') 또는 여럿(['matte', 'velvet'] · 'matte,velvet') — 그중 하나면 된다
 * maxPrice: 이 값(원) 이하인 제품만 (가격 정보가 없는 제품은 뺀다)
 */
export function recommendByColor(hex, { finish = null, maxPrice = null, limit = 10, excludeIds = [], products = allProducts() } = {}) {
  const h = normalizeHex(hex);
  if (!h) throw new Error('잘못된 색상값입니다: ' + hex);
  const refLab = hexToLab(h);
  const excluded = new Set(excludeIds);
  const finishes = (Array.isArray(finish) ? finish : String(finish || '').split(',')).map((f) => f.trim()).filter(Boolean);
  const cap = Number(maxPrice) > 0 ? Number(maxPrice) : null;
  // 시연용으로 다른 질감 목록에도 나오는 제품(finish_also, src/data/finish-demo.json 의 also, 2026-11-26)도 그 질감으로 친다
  const alsoFits = (p) => (p.finish_also || []).some((f) => finishes.includes(f));
  return products
    .filter((p) => !finishes.length || finishes.includes(p.finish) || alsoFits(p))
    .filter((p) => !cap || (Number(p.price) > 0 && Number(p.price) <= cap))
    .map((p) => {
      const r = bestOf(p, refLab, excluded);
      // also 로 들어온 제품은 찾은 질감으로 보여 준다: 카드에서 발라 보면 거울도 그 질감 그대로 (원래 질감으로 바뀌지 않게)
      return r && finishes.length && !finishes.includes(p.finish) ? { ...r, finish: finishes[0], finish_source: 'demo' } : r;
    })
    .filter(Boolean)
    .sort(byDelta)
    .slice(0, limit);
}

// 거울의 질감(matte·glossy·satin·sheer·shimmer) → 제품 제형. matte 는 벨벳도 같이 (벨벳 제품을 바르면 거울도 matte 가 된다)
export const TEXTURE_FINISHES = { matte: ['matte', 'velvet'], glossy: ['glossy'], satin: ['satin'], sheer: ['sheer'], shimmer: ['shimmer'] };

/**
 * 색 + 질감 추천 (2026-11-24 사용자 요청 "같은 색에 질감을 달리해도 제품이 다 똑같이 나온다"):
 * 고른 질감의 제품을 색 순서로 먼저, 모자라면 질감이 다른(또는 질감 정보 없는) 비슷한 색 제품으로 채운다.
 * 각 제품에 texture_match(질감이 맞는지)를 붙이고, matched = 질감이 맞는 수. 질감이 없거나 모르는 값이면 색만 본다
 */
export function recommendByTexture(hex, texture, { limit = 10, excludeIds = [], products } = {}) {
  const finish = TEXTURE_FINISHES[texture];
  const opts = products ? { products } : {};
  if (!finish) return { matched: 0, products: recommendByColor(hex, { ...opts, limit, excludeIds }) };
  const hit = recommendByColor(hex, { ...opts, finish, limit, excludeIds }).map((p) => ({ ...p, texture_match: true }));
  const rest = hit.length < limit
    ? recommendByColor(hex, { ...opts, limit: limit - hit.length, excludeIds: [...excludeIds, ...hit.map((p) => p.id)] }).map((p) => ({ ...p, texture_match: false }))
    : [];
  return { matched: hit.length, products: [...hit, ...rest] };
}
