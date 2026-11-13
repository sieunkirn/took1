// 규칙 챗봇: 답하는 언어(한국어/영어)와 표기 도우미 (가격·제품 이름·조사·순서 말).
import { FINISH_LABELS, FAMILY_LABELS } from './constants.js';
import { allProducts, fullName, shortName } from './catalog.js';
import { ordinalEn, EN_FINISH_LABELS, EN_FAMILY_LABELS } from './chat-en.js';

// ---------- 답하는 언어 ----------
// answer({ lang }) 가 정한다 (한 번에 한 질문씩 동기로 돌기 때문에 모듈 상태로 둔다). 문장은 L(한국어, 영어) 로 나란히 쓴다
let en = false;
export const isEn = () => en;
export const setEn = (value) => { en = !!value; };
export const L = (ko, en) => (isEn() ? en : ko);
export const finL = (f) => L(FINISH_LABELS[f], EN_FINISH_LABELS[f]);
const famL = (f) => L(FAMILY_LABELS[f], EN_FAMILY_LABELS[f]);
export const famsL = (fs, sep = '·') => fs.map(famL).join(isEn() ? '/' : sep);

// 화면에는 번호를 붙이지 않으므로 답변·추천 질문도 "첫 번째·두 번째"처럼 순서로 가리킨다
export const ORD_WORDS = ['첫', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
export const ord = (i) => (isEn() ? ordinalEn(i) : `${ORD_WORDS[i] || i + 1} 번째`);

export const won = (n) => (isEn() ? '₩' + n.toLocaleString('en-US') : n.toLocaleString('ko-KR') + '원');
// 영어면 글로벌 올리브영에서 짝지은 영어 이름(없으면 한국어 이름 그대로, 지어내지 않는다)
const enName = (p) => `${p.brand_en || p.brand} ${p.name_en || p.name}`;
export const nameOf = (p) => (isEn() ? enName(p) : fullName(p));
export const shortOf = (p) => (isEn() ? enName(p) : shortName(p));
// 받침 유무에 따라 조사를 고른다 (예: "로즈" → "로즈는", "코랄" → "코랄은")
export const josa = (word, withJong, without) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (code >= 0 && code <= 11171 && code % 28 ? withJong : without);
};
// '(으)로': 받침이 없거나 ㄹ 받침이면 '로', 그 밖의 받침이면 '으로' (예: "데이트로", "레드 계열로", "쿨톤으로")
export const euro = (word) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 && code % 28 !== 8 ? '으로' : '로';
};

// 한국어 브랜드 → 글로벌 영어 표기 (없으면 한국어 그대로)
export function brandEn(ko) {
  return allProducts().find((p) => p.brand === ko && p.brand_en)?.brand_en || ko;
}
