// 호수·재고 글자 (호수 안내 shades.js)
// 매대 위치 안내(shelf.js·shelf-data.js)는 2026-11-11 삭제했다. 복구는 git 기록에서
import { isEn } from './i18n.js';

const C = (ko, en) => (isEn() ? en : ko);
/** 재고 문구: 호수 데이터가 있는 제품만 재고 수량이 있다 */
export const stockText = (p) => C(`재고 ${p.stock}개`, `${p.stock} in stock`);
/** 호수·색 이름: '02 로지 브릭' */
export const shadeLabel = (p) => (p.shade_no ? `${p.shade_no} ${isEn() ? p.shade_color_en : p.shade_color}` : '');
