// 색상 기반 추천: 기준 색상과 각 제품 color_lab 의 CIEDE2000 색차로 정렬한다 (무작위 요소 없음).
import { hexToLab, deltaE2000, similarityFromDeltaE, normalizeHex } from './color.js';
import { allProducts } from './catalog.js';

export function withSimilarity(product, refLab) {
  const dE = deltaE2000(refLab, product.color_lab);
  return { ...product, delta_e: Math.round(dE * 100) / 100, similarity: similarityFromDeltaE(dE) };
}

export function recommendByColor(hex, { finish = null, limit = 10, excludeIds = [], products = allProducts() } = {}) {
  const h = normalizeHex(hex);
  if (!h) throw new Error('잘못된 색상값입니다: ' + hex);
  const refLab = hexToLab(h);
  return products
    .filter((p) => !excludeIds.includes(p.id))
    .filter((p) => !finish || p.finish === finish)
    .map((p) => withSimilarity(p, refLab))
    .sort((a, b) => a.delta_e - b.delta_e || a.id.localeCompare(b.id))
    .slice(0, limit);
}
