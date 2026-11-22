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
 * finish: 제형 하나('matte') 또는 여럿(['matte', 'velvet'] · 'matte,velvet') — 그중 하나면 된다 (2026-11-21 거울 퀵 추천 '지속력' = 매트·벨벳)
 * maxPrice: 이 값(원) 이하인 제품만 (가격 정보가 없는 제품은 뺀다, 2026-11-21 퀵 추천 '가격')
 */
/**
 * 추천 목록(거울 화면) 제품의 가격 범위 — 가격 드래그 바가 이 범위를 쓴다 (2026-11-21 사용자 요청 "가격은 우리 립 DB 에 있는 가격대로")
 * 가격 정보가 없는 제품은 빼고 센다. median = 가운데값 (바의 처음 위치)
 */
export function priceRange(products = allProducts()) {
  const prices = products.map((p) => Number(p.price)).filter((v) => v > 0).sort((a, b) => a - b);
  if (!prices.length) return { min: 0, max: 0, median: 0, count: 0 };
  return { min: prices[0], max: prices[prices.length - 1], median: prices[Math.floor(prices.length / 2)], count: prices.length };
}

export function recommendByColor(hex, { finish = null, maxPrice = null, limit = 10, excludeIds = [], products = allProducts() } = {}) {
  const h = normalizeHex(hex);
  if (!h) throw new Error('잘못된 색상값입니다: ' + hex);
  const refLab = hexToLab(h);
  const excluded = new Set(excludeIds);
  const finishes = (Array.isArray(finish) ? finish : String(finish || '').split(',')).map((f) => f.trim()).filter(Boolean);
  const cap = Number(maxPrice) > 0 ? Number(maxPrice) : null;
  return products
    .filter((p) => !finishes.length || finishes.includes(p.finish))
    .filter((p) => !cap || (Number(p.price) > 0 && Number(p.price) <= cap))
    .map((p) => bestOf(p, refLab, excluded))
    .filter(Boolean)
    .sort(byDelta)
    .slice(0, limit);
}
