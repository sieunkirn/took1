// 규칙 챗봇: 손님 말 해석. 말소리 보정(normalizeForChat) → 조건 추출(parseMessage: 제형·색·가격·순번·의도).
import { normalizeSpoken } from './spoken.js';
import { SITUATIONS } from './situations.js';
import { BRAND_ALIASES, WORD_ALIASES } from './aliases.js';
import { has, FINISH_WORDS, FAMILY_WORDS, TONES, CONCERNS, COLOR_NAMES, AVOID_FINISHES, OTHER_BRANDS } from './chat-words.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NOT_RE = '[가-힣]{0,2}\\s*(?:말고|빼고|제외|아닌|싫|별로)';

/** 이미 챗봇이 아는 말(상황·톤·고민·자주 쓰는 말): 발음 보정으로 다른 단어(브랜드 등)로 바꾸지 않는다 */
export function chatKeepWords() {
  return [
    ...SITUATIONS.flatMap((s) => s.words), ...Object.values(TONES).flatMap((t) => t.words), ...CONCERNS.flatMap((x) => x.words),
    ...COLOR_NAMES.flatMap((x) => x.words), ...AVOID_FINISHES.flatMap((x) => x.words),
    '추천', '제품', '틴트', '립스틱', '립밤', '가격', '얼마', '바코드', '제형', '비교', '기준', '보여', '알려', '찾아', '자세히',
    '밝은', '진한', '어두운', '연한', '그중', '번째', '마지막', '다른', '말고', '바꿔', '고마워', '안녕', '어울리는',
  ].filter((w) => w.length >= 2);
}

/** 말소리 별칭 (aliases.js): 지금 데이터에 있는 브랜드의 별칭 + 용어 별칭 */
export function chatAliases(brands = []) {
  return [
    ...Object.entries(BRAND_ALIASES).filter(([b]) => brands.includes(b)).map(([to, from]) => ({ to, from })),
    ...Object.entries(WORD_ALIASES).map(([to, from]) => ({ to, from })),
  ];
}

/** 챗봇이 듣는 말 정리: 말소리 별칭 → 금액 → 발음 보정. 챗봇·음성 입력·음성 정확도 측정이 같이 쓴다 */
export function normalizeForChat(text, brands = []) {
  return normalizeSpoken(text, chatVocab(brands), chatKeepWords(), chatAliases(brands));
}

/** 발음 보정에 쓰는 어휘: 제형·색상 계열·브랜드와 자주 잘못 들리는 조건 단어 */
export function chatVocab(brands = []) {
  return [...Object.values(FINISH_WORDS).flat(), ...Object.values(FAMILY_WORDS).flat(), ...brands, '저렴', '비슷', '유사']
    .filter((w) => w.length >= 2);
}

const AMOUNT = '(\\d+(?:[.,]\\d+)?)\\s*(만\\s*원|만|천\\s*원|천|원)?';
const amountOf = (num, unit) => {
  let n = Number(num.replace(/,/g, ''));
  unit = (unit || '').replace(/\s/g, '');
  if (unit.startsWith('만')) n *= 10000;
  else if (unit.startsWith('천')) n *= 1000;
  return Math.round(n);
};

// 가격 조건: "2만원 이하·미만·안 넘는·짜리" → 상한, "3만원 이상·넘는·초과" → 하한, "만원대" → 10,000~19,999원
function parsePriceRange(text) {
  const out = {};
  const max = text.match(new RegExp(`${AMOUNT}\\s*(이하|미만|아래|까지|이내|짜리|안\\s*넘|넘지\\s*않)`));
  if (max) out.maxPrice = { value: amountOf(max[1], max[2]), strict: max[3] === '미만' };
  const min = text.match(new RegExp(`${AMOUNT}\\s*(이상|넘는|넘게|넘어|넘은|초과|부터|보다\\s*비싼)`));
  if (min) out.minPrice = { value: amountOf(min[1], min[2]), strict: !/이상|부터/.test(min[3]) };
  const band = !max && !min && text.match(new RegExp(`${AMOUNT}\\s*대(?![가-힣])`));
  if (band) {
    const value = amountOf(band[1], band[2]);
    const step = 10 ** Math.floor(Math.log10(value));
    out.minPrice = { value, strict: false };
    out.maxPrice = { value: value + step - 1, strict: false };
  }
  return out;
}

// "첫 번째", "2번", "마지막" → 0부터 시작하는 순번 (말한 순서대로)
const ORDINALS = [
  [/첫\s*번\s*째|첫\s*번|첫\s*째|첫\s*거/, 0], [/두\s*번\s*째|둘\s*째/, 1], [/세\s*번\s*째|셋\s*째/, 2],
  [/네\s*번\s*째|넷\s*째/, 3], [/다섯\s*번\s*째/, 4], [/여섯\s*번\s*째/, 5], [/일곱\s*번\s*째/, 6],
  [/여덟\s*번\s*째/, 7], [/아홉\s*번\s*째/, 8], [/(?<![가-힣])열\s*번\s*째/, 9], [/마지막/, -1],
];
function parseOrdinals(text) {
  const found = ORDINALS.map(([re, i]) => ({ i, at: text.search(re) })).filter((x) => x.at >= 0);
  // 숫자: "2번", "10번째" ("1만원"·"번들" 같은 말은 '번' 앞에 숫자가 없어 걸리지 않는다)
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})\s*번/g)) if (Number(m[1]) >= 1) found.push({ i: Number(m[1]) - 1, at: m.index });
  return found.sort((a, b) => a.at - b.at).map((x) => x.i);
}

// 제형·색 계열·색 이름 ("매트 말고 글로시", "벽돌색", "번들거리는 건 싫어"). 색 이름을 말했는지 돌려준다
function parseColorWords(text, c) {
  const exclude = { finishes: [], families: [] };
  // "매트 말고 글로시" → 매트는 제외, 글로시는 조건
  for (const [finish, words] of Object.entries(FINISH_WORDS)) {
    if (!has(text, words)) continue;
    if (words.some((w) => new RegExp(escapeRe(w) + NOT_RE).test(text))) exclude.finishes.push(finish);
    else c.finish = finish;
  }
  const families = [];
  for (const [family, words] of Object.entries(FAMILY_WORDS)) {
    if (!has(text, words)) continue;
    if (words.some((w) => new RegExp(escapeRe(w) + NOT_RE).test(text))) exclude.families.push(family);
    else families.push(family);
  }
  // 표현 사전: "벽돌색" → 브라운·오렌지·레드 ("벽돌색 말고"면 그 계열을 뺀다)
  let namedColor = false;
  for (const { words, families: fams } of COLOR_NAMES) {
    if (!has(text, words)) continue;
    namedColor = true;
    const target = words.some((w) => new RegExp(escapeRe(w) + '색?' + NOT_RE).test(text)) ? exclude.families : families;
    for (const f of fams) if (!target.includes(f)) target.push(f);
  }
  // "번들거리는 건 싫어" → 글로시 제외 (직접 말한 제형은 그대로 둔다)
  for (const { words, finishes } of AVOID_FINISHES) {
    if (has(text, words)) for (const f of finishes) if (c.finish !== f && !exclude.finishes.includes(f)) exclude.finishes.push(f);
  }
  if (families.length) c.families = families;
  if (exclude.finishes.length || exclude.families.length) c.exclude = exclude;
  return namedColor;
}

// 가격 말 ("제일 싼", "더 저렴한", "2만원 이하")
function parsePriceWords(text, c) {
  // '비싼' 안에 '싼'이 들어 있으므로 비싼 쪽을 먼저 본다
  const superlative = has(text, ['제일', '가장', '젤 ', '최저', '최고가']);
  const pricey = has(text, ['비싼', '비싸', '고급', '프리미엄', '최고가']);
  const cheap = !pricey && has(text, ['저렴', '싼', '싸', '가성비', '착한 가격', 'cheap', '최저']);
  if (superlative && pricey) c.superlative = 'priciest';
  else if (superlative && cheap) c.superlative = 'cheapest';
  else if (cheap) c.price = 'cheaper';
  else if (pricey) c.price = 'pricier';
  Object.assign(c, parsePriceRange(text));
}

// 브랜드: 등록된 브랜드, 또는 등록되지 않은 유명 브랜드
function parseBrandWords(text, c, brands) {
  // 긴 이름부터 본다 ("앤드바이롬앤" 안의 "롬앤"). 세 글자 이상이면 띄어 말해도 찾는다 ("컬러 그램")
  const flat = text.replace(/\s/g, '');
  const brand = [...brands].sort((a, b) => b.length - a.length).find((b) => {
    const low = b.toLowerCase();
    return text.includes(low) || (low.replace(/\s/g, '').length >= 3 && flat.includes(low.replace(/\s/g, '')));
  });
  if (brand) c.brand = brand;
  else {
    const known = new Set(brands.map((b) => b.toLowerCase()));
    const other = OTHER_BRANDS.find((b) => !known.has(b) && text.includes(b));
    if (other) c.unknownBrand = other;
  }
}

// 퍼스널 톤·상황·입술 고민, 그리고 "나한테 어울리는"
function parseOccasionWords(text, c) {
  const tone = Object.entries(TONES).find(([, t]) => has(text, t.words));
  if (tone) c.tone = tone[0];
  const hit = SITUATIONS.filter((s) => has(text, s.words));
  const overridden = hit.flatMap((s) => s.overrides || []);
  const situations = hit.map((s) => s.label).filter((l) => !overridden.includes(l));
  if (situations.length && !(tone && situations.every((s) => ['봄', '여름', '가을', '겨울'].includes(s)))) c.situations = situations;
  const concerns = CONCERNS.filter((x) => has(text, x.words)).map((x) => x.label);
  if (concerns.length) c.concerns = concerns;
  if (has(text, ['나한테', '나에게', '내게', '내 톤', '나랑 어울', '저한테', '저에게', '제게'])) c.mine = true;
}

// 앞 대화에 이어지는 말 ("두 번째 거", "그중에", "비교", "더 보여 줘", "왜", "말고")
function parseFollowUpWords(text, c) {
  const ordinals = parseOrdinals(text);
  if (ordinals.length) c.ordinals = ordinals;
  if (has(text, ['그중', '그 중', '이 중', '이중에', '여기서', '거기서', '방금', '아까'])) c.among = true;
  if (has(text, ['비교', '차이', 'vs'])) c.compare = true;
  if (has(text, ['기준으로', '기준 제품', '이걸로', '그걸로', '이거로', '그거로', '골라', '정할', '찜'])) c.pickBase = true;
  if (has(text, ['더 보여', '다른 거', '다른거', '다른 것', '또 있', '더 있', '더 없', '다음 거', '더 추천', '더 찾아', '또 추천', '또 보여'])) c.more = true;
  if (has(text, ['왜 ', '왜?', '왜요', '이유', '근거', '어떻게 고른', '왜 이거'])) c.why = true;
  if (has(text, ['걸로', '거로', '말고', '대신', '빼고', '바꿔', '중에서', '그중', '그 중'])) c.refine = true;
}

// 무엇을 알고 싶은지 (추천·가격·제형·바코드·설명)
function parseAskWords(text, c) {
  if (has(text, ['추천', '찾아', '찾기', '보여', '알려', '있어', '없어', '골라'])) c.wantsList = true;
  if (has(text, ['가격', '얼마'])) c.askPrice = true;
  if (has(text, ['제형', '마무리', '피니시'])) c.askFinish = true;
  if (has(text, ['바코드'])) c.askBarcode = true;
  if (has(text, ['정보', '설명', '어떤 제품', '무슨 제품', '자세히', '어때'])) c.askInfo = true;
}

// 인사·감사·정체·도움말 같은 가벼운 말
function parseSmallTalkWords(text, c) {
  if (has(text, ['안녕', '하이', 'hello', '반가', '헬로'])) c.small = 'greet';
  else if (has(text, ['고마', '감사', '땡큐', 'thank', '고맙'])) c.small = 'thanks';
  else if (has(text, ['잘 가', '잘가', '바이', '다음에 봐', '수고'])) c.small = 'bye';
  else if (has(text, ['누구', '이름이', '너 뭐', '정체', 'ai야', 'ai 야', '인공지능', '사람이야', '사람이에', 'gpt', '로봇'])) c.small = 'identity';
  else if (has(text, ['뭐 할 수', '뭘 할 수', '뭐 해 줄', '뭘 해 줄', '도움말', '사용법', '어떻게 써', '어떻게 물어', '기능', '뭐 물어'])) c.small = 'help';
  else if (has(text, ['예쁘', '이쁘', '마음에 들', '맘에 들', '최고', '짱', '좋네', '좋다'])) c.small = 'like';
  else if (has(text, ['별로', '싫어', '마음에 안', '맘에 안', '안 예'])) c.small = 'dislike';
}

/** 손님 말에서 조건과 의도를 뽑는다. 돌려주는 객체의 키 순서는 알아듣는 순서와 같다 */
export function parseMessage(message, brands = []) {
  const text = String(message || '').toLowerCase().replace(/\s+/g, ' ');
  const c = {};
  const namedColor = parseColorWords(text, c);
  parsePriceWords(text, c);
  // "입술색이랑 비슷한 거"는 기준 색 비교가 아니라 '입술색 같은' 느낌이고, "체리 같은 색"은 그 색을 말한 것이다
  if (has(text, ['비슷', '유사', '닮은', '같은 색', 'similar']) && !has(text, ['입술색', '입술 색', '내 입술']) && !namedColor) c.similar = true;
  if (has(text, ['밝은', '연한', '라이트', '가벼운 색'])) c.lightness = 'lighter';
  else if (has(text, ['어두운', '진한', '딥', '다크'])) c.lightness = 'darker';
  parseBrandWords(text, c, brands);
  parseOccasionWords(text, c);
  parseFollowUpWords(text, c);
  parseAskWords(text, c);
  parseSmallTalkWords(text, c);
  return c;
}
