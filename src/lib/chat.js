// 규칙 기반 뷰티 챗봇. 외부 AI API 를 사용하지 않는다.
// 메시지에서 조건(제형/가격/색상 계열/유사 색상/밝기/브랜드)과 상황·퍼스널 톤·입술 고민을 추출해 제품 데이터에서 검색한다.
// 직전 대화(context)를 받아 "그중에 제일 싼 거", "두 번째 거 자세히", "더 보여 줘", "매트 말고" 같은 이어지는 질문에도 답한다.
import { FINISH_LABELS, FAMILY_LABELS } from './constants.js';
import { hexToLab, deltaE2000, normalizeHex } from './color.js';
import { allProducts, findById, fullName, shortName } from './catalog.js';
import { withSimilarity } from './recommend.js';
import { normalizeSpoken } from './spoken.js';

const FINISH_WORDS = {
  glossy: ['글로시', '글로스', '촉촉', '윤기', '광택', '물광', 'gloss'], // gloss 는 glossy 도 포함
  matte: ['매트', '보송', 'matte'],
  satin: ['새틴', 'satin'],
  velvet: ['벨벳', 'velvet'],
};
// 음성 인식이 영어로 받아 적는 경우도 있어 영어 색 이름도 함께 둔다

const FAMILY_WORDS = {
  red: ['레드', '빨간', '빨강', 'red'],
  pink: ['핑크', '분홍', 'pink'],
  coral: ['코랄', 'coral'],
  orange: ['오렌지', '주황', 'orange'],
  nude: ['누드', '베이지', 'mlbb', 'nude'],
  brown: ['브라운', '갈색', 'brown'],
  rose: ['로즈', '장미', 'rose'],
  berry: ['베리', 'berry'],
  plum: ['플럼', '보라', '퍼플', 'plum', 'purple'],
  burgundy: ['버건디', 'burgundy'],
};

// 상황·계절: 말하지 않은 계열/제형을 대신 정해 주는 '추천 성향'. 맞는 제품이 없으면 그 성향은 빼고 찾는다
const SITUATIONS = [
  { label: '데일리', words: ['데일리', '매일', '평소', '일상', '출근', '회사', '학교', '등교', '무난'],
    families: ['nude', 'rose', 'coral', 'pink'], finishes: ['satin', 'matte', 'velvet'],
    reason: '데일리로는 부담 없는 누드·로즈·코랄 계열에 차분한 마무리가 무난해요.' },
  { label: '단정한 자리', words: ['면접', '미팅', '회의', '격식', '단정', '상견례'],
    families: ['nude', 'rose', 'brown'], finishes: ['matte', 'satin', 'velvet'],
    reason: '단정한 자리에는 튀지 않는 누드·로즈·브라운 계열을 많이 골라요.' },
  { label: '데이트', words: ['데이트', '소개팅', '썸', '기념일'],
    families: ['pink', 'rose', 'coral', 'red'], finishes: ['glossy', 'satin'],
    reason: '데이트에는 생기 있어 보이는 핑크·로즈·코랄에 윤기 있는 마무리가 잘 어울려요.' },
  { label: '파티·행사', words: ['파티', '연말', '결혼식', '하객', '행사', '모임', '공연', '무대'],
    families: ['red', 'burgundy', 'berry', 'plum'], finishes: ['velvet', 'matte', 'glossy'],
    reason: '파티나 행사에는 존재감 있는 레드·버건디·베리 계열이 사진에도 잘 나와요.' },
  { label: '여행', words: ['여행', '휴가', '바캉스', '바다', '휴양'],
    families: ['coral', 'orange', 'pink'], finishes: ['glossy', 'satin'],
    reason: '여행에는 밝은 코랄·오렌지 계열이 화사하게 보여요.' },
  { label: '봄', words: ['봄에', '봄철', '봄용', '봄 시즌', '봄 립'],
    families: ['coral', 'pink', 'orange'], finishes: ['glossy', 'satin'],
    reason: '봄에는 코랄·핑크처럼 가볍고 화사한 컬러가 인기예요.' },
  { label: '여름', words: ['여름'],
    families: ['coral', 'orange', 'pink'], finishes: ['glossy', 'satin'],
    reason: '여름에는 산뜻한 코랄·오렌지 계열을 많이 찾아요.' },
  { label: '가을', words: ['가을'],
    families: ['brown', 'burgundy', 'rose', 'nude'], finishes: ['matte', 'velvet'],
    reason: '가을에는 브라운·버건디처럼 깊은 컬러에 보송한 마무리가 분위기 있어요.' },
  { label: '겨울', words: ['겨울에', '겨울철', '겨울용', '크리스마스'],
    families: ['red', 'burgundy', 'plum', 'berry'], finishes: ['velvet', 'matte'],
    reason: '겨울에는 레드·버건디·플럼처럼 진한 컬러가 잘 어울려요.' },
];

// 퍼스널 톤 (립 컬러 매핑의 '나에게 어울리는 컬러' 결과 키와 같다: spring/summer/autumn/winter)
const TONES = {
  spring: { label: '봄 웜', words: ['봄웜', '봄 웜', '봄 라이트', '봄브라이트'], families: ['coral', 'orange', 'pink'],
    reason: '봄 웜톤에는 맑은 코랄·피치·오렌지 계열이 얼굴을 환하게 해 줘요.' },
  summer: { label: '여름 쿨', words: ['여름쿨', '여름 쿨', '여쿨', '여름 라이트', '여름뮤트'], families: ['pink', 'rose', 'berry'],
    reason: '여름 쿨톤에는 부드러운 핑크·로즈·라이트 베리 계열이 잘 어울려요.' },
  autumn: { label: '가을 웜', words: ['가을웜', '가을 웜', '갈웜', '가을 딥', '가을뮤트'], families: ['brown', 'orange', 'nude', 'coral'],
    reason: '가을 웜톤에는 브릭·브라운·테라코타처럼 깊고 따뜻한 컬러가 좋아요.' },
  winter: { label: '겨울 쿨', words: ['겨울쿨', '겨울 쿨', '겨쿨', '겨울 딥', '겨울 브라이트'], families: ['red', 'berry', 'plum', 'burgundy'],
    reason: '겨울 쿨톤에는 선명한 레드·베리·플럼 계열이 또렷하게 살아나요.' },
  warm: { label: '웜톤', words: ['웜톤', '웜 톤', '웜이'], families: ['coral', 'orange', 'brown', 'nude'],
    reason: '웜톤에는 노란 기가 도는 코랄·오렌지·브라운 계열이 잘 받아요.' },
  cool: { label: '쿨톤', words: ['쿨톤', '쿨 톤', '쿨이'], families: ['pink', 'rose', 'berry', 'plum', 'red'],
    reason: '쿨톤에는 푸른 기가 도는 핑크·로즈·베리 계열이 잘 받아요.' },
};

// 입술 고민·원하는 느낌
const CONCERNS = [
  { label: '건조한 입술', words: ['건조', '각질', '트는', '갈라', '푸석'], finishes: ['glossy', 'satin'],
    reason: '입술이 건조하면 매트보다 글로시·새틴처럼 촉촉한 제형이 각질 부각이 덜해요.' },
  { label: '오래 가는', words: ['지속력', '오래', '안 지워', '안지워', '마스크', '묻어나'], finishes: ['matte', 'velvet'],
    reason: '오래 가는 걸 원하시면 매트·벨벳 제형이 지속력이 좋은 편이에요.' },
  { label: '자연스러운', words: ['자연스러', '생기', '쌩얼', '꾸안꾸', '내추럴', '은은'], families: ['nude', 'rose', 'coral', 'pink'],
    reason: '자연스러운 느낌에는 입술색과 가까운 누드·로즈·코랄 계열이 좋아요.' },
  { label: '강렬한', words: ['강렬', '포인트', '시크', '센 느낌', '존재감'], families: ['red', 'burgundy', 'berry', 'plum'],
    reason: '포인트를 주고 싶으면 레드·버건디·베리처럼 선명한 컬러를 추천해요.' },
  { label: '화사한', words: ['화사', '어려 보', '사랑스러', '귀여', '발랄'], families: ['pink', 'coral', 'orange'],
    reason: '화사한 느낌에는 핑크·코랄 계열이 생기를 더해 줘요.' },
  { label: '선물', words: ['선물'], families: ['nude', 'rose', 'coral', 'pink'],
    reason: '선물이라면 누구에게나 무난한 누드·로즈·코랄 계열이 실패가 적어요.' },
];

const has = (text, words) => words.some((w) => text.includes(w));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NOT_RE = '[가-힣]{0,2}\\s*(?:말고|빼고|제외|아닌|싫|별로)';

/** 이미 챗봇이 아는 말(상황·톤·고민·자주 쓰는 말): 발음 보정으로 다른 단어(브랜드 등)로 바꾸지 않는다 */
export function chatKeepWords() {
  return [
    ...SITUATIONS.flatMap((s) => s.words), ...Object.values(TONES).flatMap((t) => t.words), ...CONCERNS.flatMap((x) => x.words),
    '추천', '제품', '틴트', '립스틱', '립밤', '가격', '얼마', '바코드', '제형', '비교', '기준', '보여', '알려', '찾아', '자세히',
    '밝은', '진한', '어두운', '연한', '그중', '번째', '마지막', '다른', '말고', '바꿔', '고마워', '안녕', '어울리는',
  ].filter((w) => w.length >= 2);
}

/** 발음 보정에 쓰는 어휘: 제형·색상 계열·브랜드와 자주 잘못 들리는 조건 단어 */
export function chatVocab(brands = []) {
  return [...Object.values(FINISH_WORDS).flat(), ...Object.values(FAMILY_WORDS).flat(), ...brands, '저렴', '비슷', '유사']
    .filter((w) => w.length >= 2);
}

function parseMaxPrice(text) {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(만\s*원|만|천\s*원|천|원)?\s*(이하|미만|아래|까지|이내)/);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ''));
  const unit = (m[2] || '').replace(/\s/g, '');
  if (unit.startsWith('만')) n *= 10000;
  else if (unit.startsWith('천')) n *= 1000;
  return { value: Math.round(n), strict: m[3] === '미만' };
}

// "첫 번째", "2번", "마지막" → 0부터 시작하는 순번 (말한 순서대로)
const ORDINALS = [
  [/첫\s*번\s*째|첫\s*번|1\s*번|첫\s*째|첫\s*거/, 0], [/두\s*번\s*째|2\s*번|둘\s*째/, 1], [/세\s*번\s*째|3\s*번|셋\s*째/, 2],
  [/네\s*번\s*째|4\s*번|넷\s*째/, 3], [/다섯\s*번\s*째|5\s*번/, 4], [/마지막/, -1],
];
function parseOrdinals(text) {
  return ORDINALS.map(([re, i]) => ({ i, at: text.search(re) })).filter((x) => x.at >= 0).sort((a, b) => a.at - b.at).map((x) => x.i);
}

export function parseMessage(message, brands = []) {
  const text = String(message || '').toLowerCase().replace(/\s+/g, ' ');
  const c = {};
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
  if (families.length) c.families = families;
  if (exclude.finishes.length || exclude.families.length) c.exclude = exclude;

  // '비싼' 안에 '싼'이 들어 있으므로 비싼 쪽을 먼저 본다
  const superlative = has(text, ['제일', '가장', '젤 ', '최저', '최고가']);
  const pricey = has(text, ['비싼', '비싸', '고급', '프리미엄', '최고가']);
  const cheap = !pricey && has(text, ['저렴', '싼', '싸', '가성비', '착한 가격', 'cheap', '최저']);
  if (superlative && pricey) c.superlative = 'priciest';
  else if (superlative && cheap) c.superlative = 'cheapest';
  else if (cheap) c.price = 'cheaper';
  else if (pricey) c.price = 'pricier';
  const max = parseMaxPrice(text);
  if (max) c.maxPrice = max;
  if (has(text, ['비슷', '유사', '닮은', '같은 색', 'similar'])) c.similar = true;
  if (has(text, ['밝은', '연한', '라이트', '가벼운 색'])) c.lightness = 'lighter';
  else if (has(text, ['어두운', '진한', '딥', '다크'])) c.lightness = 'darker';
  const brand = brands.find((b) => text.includes(b.toLowerCase()));
  if (brand) c.brand = brand;

  const tone = Object.entries(TONES).find(([, t]) => has(text, t.words));
  if (tone) c.tone = tone[0];
  const situations = SITUATIONS.filter((s) => has(text, s.words)).map((s) => s.label);
  if (situations.length && !(tone && situations.every((s) => ['봄', '여름', '가을', '겨울'].includes(s)))) c.situations = situations;
  const concerns = CONCERNS.filter((x) => has(text, x.words)).map((x) => x.label);
  if (concerns.length) c.concerns = concerns;
  if (has(text, ['나한테', '나에게', '내게', '내 톤', '나랑 어울', '저한테', '저에게', '제게'])) c.mine = true;

  const ordinals = parseOrdinals(text);
  if (ordinals.length) c.ordinals = ordinals;
  if (has(text, ['그중', '그 중', '이 중', '이중에', '여기서', '거기서', '방금', '아까'])) c.among = true;
  if (has(text, ['비교', '차이', 'vs'])) c.compare = true;
  if (has(text, ['기준으로', '기준 제품', '이걸로', '그걸로', '이거로', '그거로', '골라', '정할', '찜'])) c.pickBase = true;
  if (has(text, ['더 보여', '다른 거', '다른거', '다른 것', '또 있', '더 있', '더 없', '다음 거', '더 추천', '더 찾아', '또 추천', '또 보여'])) c.more = true;
  if (has(text, ['왜 ', '왜?', '왜요', '이유', '근거', '어떻게 고른', '왜 이거'])) c.why = true;
  if (has(text, ['걸로', '거로', '말고', '대신', '빼고', '바꿔', '중에서', '그중', '그 중'])) c.refine = true;

  if (has(text, ['추천', '찾아', '찾기', '보여', '알려', '있어', '없어', '골라'])) c.wantsList = true;
  if (has(text, ['가격', '얼마'])) c.askPrice = true;
  if (has(text, ['제형', '마무리', '피니시'])) c.askFinish = true;
  if (has(text, ['바코드'])) c.askBarcode = true;
  if (has(text, ['정보', '설명', '어떤 제품', '무슨 제품', '자세히', '어때'])) c.askInfo = true;

  if (has(text, ['안녕', '하이', 'hello', '반가', '헬로'])) c.small = 'greet';
  else if (has(text, ['고마', '감사', '땡큐', 'thank', '고맙'])) c.small = 'thanks';
  else if (has(text, ['잘 가', '잘가', '바이', '다음에 봐', '수고'])) c.small = 'bye';
  else if (has(text, ['누구', '이름이', '너 뭐', '정체', 'ai야', 'ai 야', '인공지능', '사람이야', '사람이에', 'gpt', '로봇'])) c.small = 'identity';
  else if (has(text, ['뭐 할 수', '뭘 할 수', '뭐 해 줄', '뭘 해 줄', '도움말', '사용법', '어떻게 써', '어떻게 물어', '기능', '뭐 물어'])) c.small = 'help';
  else if (has(text, ['예쁘', '이쁘', '마음에 들', '맘에 들', '최고', '짱', '좋네', '좋다'])) c.small = 'like';
  else if (has(text, ['별로', '싫어', '마음에 안', '맘에 안', '안 예'])) c.small = 'dislike';
  return c;
}

const won = (n) => n.toLocaleString('ko-KR') + '원';
const nameOf = fullName;
const shortOf = shortName;
// 받침 유무에 따라 조사를 고른다 (예: "로즈" → "로즈는", "코랄" → "코랄은")
export const josa = (word, withJong, without) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (code >= 0 && code <= 11171 && code % 28 ? withJong : without);
};
// '(으)로': 받침이 없거나 ㄹ 받침이면 '로', 그 밖의 받침이면 '으로' (예: "데이트로", "레드 계열로", "쿨톤으로")
const euro = (word) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 && code % 28 !== 8 ? '으로' : '로';
};

function describeProduct(p) {
  return `${fullName(p)} (색상값 ${p.color_hex}, ${p.finish ? FINISH_LABELS[p.finish] : '제형 정보 없음'}, ${won(p.price)})`;
}

const HELP = '이렇게 물어봐 주시면 바로 찾아 드릴 수 있어요. 색(코랄·로즈·레드·누드 등), 제형(글로시·매트·새틴·벨벳), '
  + '가격(2만원 이하, 더 저렴한 거), 바를 자리(데일리·데이트·면접), 퍼스널 톤(웜톤·쿨톤), 입술 고민(건조·지속력), 브랜드 이름도 괜찮아요.';

// 조건을 사람이 읽기 쉬운 말로 요약한다 (예: "데이트 · 글로시 · 20,000원 이하")
function friendlySummary(q, { base }) {
  const parts = [];
  for (const s of q.situations || []) parts.push(s);
  if (q.tone && TONES[q.tone]) parts.push(TONES[q.tone].label.endsWith('톤') ? TONES[q.tone].label : TONES[q.tone].label + ' 톤');
  if (q.mine) parts.push('측정한 내 톤');
  for (const x of q.concerns || []) parts.push(x);
  if (q.families) parts.push(q.families.map((f) => FAMILY_LABELS[f]).join('·') + ' 계열');
  if (q.finish) parts.push(FINISH_LABELS[q.finish]);
  if (q.brand) parts.push(q.brand);
  if (q.maxPrice) parts.push(`${won(q.maxPrice.value)} ${q.maxPrice.strict ? '미만' : '이하'}`);
  if (q.price === 'cheaper') parts.push(base ? '기준 제품보다 저렴한' : q.cheaperThan ? '방금 본 것보다 저렴한' : '저렴한 순');
  if (q.price === 'pricier') parts.push(base ? '기준 제품보다 고급' : '고급스러운');
  if (q.lightness) parts.push(q.lightness === 'lighter' ? '더 밝은 색' : '더 진한 색');
  if (q.exclude?.families?.length) parts.push(q.exclude.families.map((f) => FAMILY_LABELS[f]).join('·') + ' 빼고');
  if (q.exclude?.finishes?.length) parts.push(q.exclude.finishes.map((f) => FINISH_LABELS[f]).join('·') + ' 빼고');
  if (q.similar) parts.push('비슷한 색');
  if (q.superlative) parts.push(q.superlative === 'cheapest' ? '가격 낮은 순' : '가격 높은 순');
  return parts.join(' · ');
}

// 같은 질문에는 같은 문장이 나오도록 메시지로 문장 변형을 고른다 (테스트·재현 가능)
const pick = (seed, list) => list[[...seed].reduce((s, ch) => s + ch.charCodeAt(0), 0) % list.length];

const SEARCH_KEYS = ['finish', 'families', 'price', 'maxPrice', 'similar', 'lightness', 'brand', 'tone', 'situations', 'concerns', 'exclude', 'superlative'];
const searchPart = (c) => Object.fromEntries(SEARCH_KEYS.filter((k) => c[k] !== undefined).map((k) => [k, c[k]]));

// 조건을 다시 말로 만든다 (다음 질문 추천 칩에 사용)
function phraseOf(q) {
  const parts = [];
  if (q.maxPrice) parts.push(`${q.maxPrice.value >= 10000 && q.maxPrice.value % 10000 === 0 ? q.maxPrice.value / 10000 + '만원' : won(q.maxPrice.value)} ${q.maxPrice.strict ? '미만' : '이하'}`);
  if (q.brand) parts.push(q.brand);
  if (q.finish) parts.push({ glossy: '글로시한', matte: '매트한', satin: '새틴', velvet: '벨벳' }[q.finish]);
  if (q.families) parts.push(q.families.map((f) => FAMILY_LABELS[f]).join(' '));
  return parts.length ? parts.join(' ') + ' 추천해 줘' : null;
}

// 조건으로 제품을 찾는다. 상황·톤·고민은 말하지 않은 계열/제형만 대신 정하고, 맞는 제품이 없으면 그 성향은 뺀다
function runSearch(q, { products, base, ref, shown, toneHint }) {
  const conditions = [];
  const reasons = [];
  const notes = [];
  let list = products.filter((p) => !base || p.id !== base.id);

  if (q.finish) {
    list = list.filter((p) => p.finish === q.finish);
    conditions.push(`제형 = ${FINISH_LABELS[q.finish]}`);
  }
  if (q.exclude?.finishes?.length) {
    list = list.filter((p) => !q.exclude.finishes.includes(p.finish));
    conditions.push(`${q.exclude.finishes.map((f) => FINISH_LABELS[f]).join('/')} 제외`);
  }
  if (q.families) {
    list = list.filter((p) => q.families.includes(p.color_family));
    conditions.push(`색상 계열 = ${q.families.map((f) => FAMILY_LABELS[f]).join('/')}`);
  }
  if (q.exclude?.families?.length) {
    list = list.filter((p) => !q.exclude.families.includes(p.color_family));
    conditions.push(`${q.exclude.families.map((f) => FAMILY_LABELS[f]).join('/')} 제외`);
  }
  if (q.brand) {
    list = list.filter((p) => p.brand === q.brand);
    conditions.push(`브랜드 = ${q.brand}`);
  }
  if (q.maxPrice) {
    const { value, strict } = q.maxPrice;
    list = list.filter((p) => (strict ? p.price < value : p.price <= value));
    conditions.push(`가격 ${strict ? '<' : '≤'} ${won(value)}`);
  }
  if (q.price === 'cheaper') {
    if (base) {
      list = list.filter((p) => p.price < base.price);
      conditions.push(`가격 < 기준 제품 ${won(base.price)}`);
    } else if (q.cheaperThan) {
      list = list.filter((p) => p.price < q.cheaperThan);
      conditions.push(`가격 < 방금 보여 드린 제품 최저가 ${won(q.cheaperThan)}`);
    } else conditions.push('가격 낮은 순');
  } else if (q.price === 'pricier') {
    if (base) {
      list = list.filter((p) => p.price > base.price);
      conditions.push(`가격 > 기준 제품 ${won(base.price)}`);
    } else conditions.push('가격 높은 순');
  }

  // 상황·톤·고민 → 추천 성향 (명시한 계열/제형이 없을 때만)
  const prefs = [];
  for (const label of q.situations || []) prefs.push(SITUATIONS.find((s) => s.label === label));
  const toneKey = q.tone || (q.mine ? toneHint : null);
  if (toneKey && TONES[toneKey]) prefs.push({ ...TONES[toneKey], label: `${TONES[toneKey].label}${q.tone ? '' : '(립 컬러 매핑 측정)'}` });
  for (const label of q.concerns || []) prefs.push(CONCERNS.find((x) => x.label === label));
  for (const pref of prefs) {
    let used = false;
    if (pref.families && !q.families) {
      const next = list.filter((p) => pref.families.includes(p.color_family));
      if (next.length) { list = next; used = true; }
    }
    if (pref.finishes && !q.finish) {
      const next = list.filter((p) => pref.finishes.includes(p.finish));
      if (next.length) { list = next; used = true; }
    }
    if (used) {
      conditions.push(`${pref.label} 추천`);
      // 직접 말한 제형이 이 성향의 추천 제형과 다르면 설명이 엇갈리므로 이유는 말하지 않는다 (예: 데이트인데 매트)
      if (!(q.finish && pref.finishes && !pref.finishes.includes(q.finish))) reasons.push(pref.reason);
    } else notes.push(`${pref.label}에 딱 맞는 제품은 다른 조건이랑 겹치지 않아서, 그 부분은 빼고 찾아봤어요.`);
  }

  if ((q.similar || q.lightness) && !ref) {
    notes.push('아직 기준 색상이 없어서 색 비교는 하지 못했어요. 바코드로 제품을 찾거나 립 컬러 매핑에서 색을 고른 다음 다시 물어봐 주세요.');
  }
  if (q.lightness && ref) {
    const L = hexToLab(ref.hex).L;
    list = list.filter((p) => (q.lightness === 'lighter' ? p.color_lab.L > L + 2 : p.color_lab.L < L - 2));
    conditions.push(`${q.lightness === 'lighter' ? '더 밝은' : '더 어두운'} 색 (기준 명도 L* ${L.toFixed(1)})`);
  }

  // 정렬: 최저가/최고가 요청 > 기준 색상과 유사한 순 > 가격 순 > ID 순
  const refLab = ref ? hexToLab(ref.hex) : null;
  let scored = refLab ? list.map((p) => withSimilarity(p, refLab)) : list.map((p) => ({ ...p }));
  if (q.superlative) {
    scored.sort((a, b) => (q.superlative === 'cheapest' ? a.price - b.price : b.price - a.price) || a.id.localeCompare(b.id));
    conditions.push(q.superlative === 'cheapest' ? '가격 낮은 순' : '가격 높은 순');
  } else if (refLab && (q.similar || !q.price || base)) {
    scored.sort((a, b) => a.delta_e - b.delta_e || a.price - b.price);
    conditions.push(`${ref.label}과(와) 유사한 순`);
  } else if (q.price === 'pricier') {
    scored.sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
  } else if (q.price === 'cheaper' || q.maxPrice) {
    scored.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  } else {
    scored.sort((a, b) => a.id.localeCompare(b.id));
  }
  // 기준 색상이 없을 때 '비슷한 색상'만 요청했다면 결과를 내지 않는다
  const onlyUnmetColor = !ref && (q.similar || q.lightness) && conditions.length === 0;
  if (onlyUnmetColor) scored = [];
  return { scored, conditions, reasons, notes, onlyUnmetColor };
}

// 결과가 없을 때: 조건을 하나씩 빼 보고 결과가 생기는 조건을 알려 준다
function relaxHint(q, env) {
  const tries = [
    ['maxPrice', '가격 조건'], ['brand', '브랜드 조건'], ['finish', '제형 조건'], ['families', '색상 계열 조건'], ['lightness', '밝기 조건'],
  ];
  for (const [key, label] of tries) {
    if (q[key] === undefined) continue;
    const { [key]: _, ...rest } = q;
    const n = runSearch(rest, env).scored.length;
    if (n) return { text: `대신 ${label}을 빼면 ${n}개가 있어요. 그걸로 보여 드릴까요?`, phrase: phraseOf(rest) };
  }
  return null;
}

/**
 * 제품 2~3개를 비교한 요약 문장. 챗봇의 "1번이랑 2번 비교"와 화면의 비교함이 같이 쓴다.
 * @param {object[]} items 제품 (color_lab, price, finish 포함)
 */
export function compareSummary(items) {
  if (items.length < 2) return '';
  const lines = [];
  const byPrice = [...items].sort((a, b) => a.price - b.price);
  if (byPrice[0].price === byPrice.at(-1).price) lines.push(`가격은 모두 ${won(byPrice[0].price)}으로 같아요.`);
  else {
    // 같은 가격이 여럿이면 모두 말한다 (예: "리플 01 코랄 비치·리플 02 핑크 소다가 9,900원으로")
    const names = (price) => items.filter((p) => p.price === price).map(shortOf).join('·');
    lines.push(`가격은 ${josa(names(byPrice[0].price), '이', '가')} ${won(byPrice[0].price)}으로 제일 착하고, ${josa(names(byPrice.at(-1).price), '이', '가')} ${won(byPrice.at(-1).price)}으로 제일 높아요.`);
  }
  // 색 차이: 가장 비슷한 두 개를 기준으로 말한다
  let best = null;
  for (let x = 0; x < items.length; x++) {
    for (let y = x + 1; y < items.length; y++) {
      const d = deltaE2000(items[x].color_lab, items[y].color_lab);
      if (!best || d < best.d) best = { a: items[x], b: items[y], d };
    }
  }
  const feel = best.d < 5 ? '거의 같은 색이라 바꿔 발라도 티가 잘 안 날 거예요'
    : best.d < 15 ? '같은 계열이지만 나란히 보면 차이가 느껴져요' : '분위기가 꽤 다른 색이에요';
  lines.push(`${items.length > 2 ? '그중 가장 비슷한 ' : ''}${josa(shortOf(best.a), '과', '와')} ${josa(shortOf(best.b), '은', '는')} ${feel}.`);
  const lightest = [...items].sort((a, b) => b.color_lab.L - a.color_lab.L)[0];
  lines.push(`가장 밝고 가벼운 느낌은 ${josa(shortOf(lightest), '이에요', '예요')}.`);
  const moist = items.filter((p) => ['glossy', 'satin'].includes(p.finish));
  const lasting = items.filter((p) => ['matte', 'velvet'].includes(p.finish));
  if (moist.length && lasting.length) {
    lines.push(`촉촉한 걸 원하시면 ${moist.map(shortOf).join(', ')}, 오래 가는 걸 원하시면 ${lasting.map(shortOf).join(', ')} 쪽을 추천해요.`);
  }
  return lines.join(' ');
}

function resultSuggestions(products, q, hasMore) {
  const mostlyGlossy = products.filter((p) => p.finish === 'glossy').length * 2 > products.length;
  const out = [];
  if (products.length) out.push('첫 번째 거 자세히 알려 줘');
  if (products.length >= 2) out.push('그중에 제일 싼 거는?');
  if (hasMore) out.push('더 보여 줘');
  if (products.length >= 2) out.push('1번이랑 2번 비교해 줘');
  if (products.length) out.push(q.finish === 'glossy' || mostlyGlossy ? '매트한 걸로 바꿔 줘' : '글로시한 걸로 바꿔 줘');
  if (products.length >= 2) out.push('두 번째 거 기준 제품으로 해 줘');
  return out.slice(0, 5);
}

const START_SUGGESTIONS = ['데일리로 바를 립 추천해 줘', '데이트 립 추천해 줘', '입술이 건조한데 뭐가 좋아?', '2만원 이하 글로시한 코랄 추천해 줘'];

/**
 * @param {object} input
 * @param {string} input.message
 * @param {string} [input.baseProductId] 바코드 검색 등에서 전달된 기준 제품
 * @param {string} [input.selectedHex] 립 컬러 매핑에서 선택한 색상
 * @param {object} [input.context] 직전 대화 상태(이전 응답의 context 를 그대로 돌려준다)
 * @param {string} [input.tone] 립 컬러 매핑에서 측정한 퍼스널 톤(spring/summer/autumn/winter)
 */
export function answer({ message, baseProductId = null, selectedHex = null, limit = 5, context = null, tone = null }) {
  const products = allProducts();
  const brands = [...new Set(products.map((p) => p.brand))];
  // 말·입력 보정: 한글 금액("만 오천 원")과 비슷한 발음("그로시" → "글로시")을 챗봇이 아는 말로 바꾼 뒤 해석한다
  const spoken = normalizeSpoken(message, chatVocab(brands), chatKeepWords());
  const heard = spoken.corrections.length
    ? `혹시 ${spoken.corrections.map((x) => `'${x.to}'`).join(', ')} 말씀하신 거죠? 그렇게 알아듣고 찾아볼게요. `
    : '';
  const c = parseMessage(spoken.text, brands);
  const base = baseProductId ? findById(baseProductId) : null;
  const selHex = normalizeHex(selectedHex || '');
  const ctx = context && typeof context === 'object' ? context : {};
  const shown = (ctx.shown || []).map(findById).filter(Boolean);
  const toneHint = TONES[tone] ? tone : null;

  // 기준 색상: 기준 제품 > 립 컬러 매핑 선택 색상
  let ref = null;
  if (base) ref = { hex: base.color_hex, label: `기준 제품(${shortName(base)}) 색상 ${base.color_hex}` };
  else if (selHex) ref = { hex: selHex, label: `립 컬러 매핑 선택 색상 ${selHex}` };
  const env = { products, base, ref, shown, toneHint };

  const out = (o) => ({
    reply: heard + o.reply,
    conditions: o.conditions || [],
    products: o.products || [],
    base,
    total: o.total,
    understood: spoken.text,
    corrections: spoken.corrections,
    suggestions: o.suggestions || [],
    action: o.action || null,
    kind: o.kind || null, // 'compare' 면 화면에서 비교표로 보여 준다
    context: o.context || ctx,
  });

  const q = searchPart(c);
  const isSearch = Object.keys(q).length > 0 || (c.mine && toneHint);

  // ---------- 방금 보여 드린 제품을 가리키는 질문 ("두 번째 거", "1번이랑 2번 비교") ----------
  if (c.ordinals) {
    if (!shown.length) {
      return out({ reply: '아직 보여 드린 제품이 없어요. 원하는 립을 먼저 말씀해 주시면 골라 드릴게요!', suggestions: START_SUGGESTIONS });
    }
    const items = c.ordinals.map((i) => ({ i: i < 0 ? shown.length - 1 : i })).map(({ i }) => ({ i, p: shown[i] }));
    const missing = items.find((x) => !x.p);
    if (missing) {
      return out({ reply: `앗, ${missing.i + 1}번은 없어요. 지금 목록에는 ${shown.length}개가 있어요.`, suggestions: ['첫 번째 거 자세히 알려 줘'] });
    }
    if (items.length >= 2 || c.compare) {
      const pair = items.length >= 2 ? items.slice(0, 2) : [items[0], { i: items[0].i === 0 ? 1 : 0, p: shown[items[0].i === 0 ? 1 : 0] }];
      if (!pair[1].p) return out({ reply: '비교하려면 제품이 두 개 이상 있어야 해요.' });
      const [a, b] = pair;
      return out({
        reply: `${a.i + 1}번이랑 ${b.i + 1}번을 나란히 놓고 비교해 봤어요. ${compareSummary([a.p, b.p])}`,
        products: [a.p, b.p],
        kind: 'compare',
        suggestions: [`${a.i + 1}번 기준 제품으로 해 줘`, `${b.i + 1}번 기준 제품으로 해 줘`, '다른 거 더 보여 줘'],
      });
    }
    const { i, p } = items[0];
    if (c.pickBase) {
      return out({
        reply: `좋아요! ${josa(shortOf(p), '을', '를')} 기준으로 할게요. 이제 "이것보다 저렴한 거", "비슷한 색"처럼 물어보시면 이 제품이랑 비교해서 찾아 드릴게요.`,
        action: { type: 'setBase', id: p.id },
        suggestions: ['비슷한 색상 찾아 줘', '더 저렴한 제품 추천해 줘', '더 밝은 색 추천해 줘'],
      });
    }
    const parts = [];
    if (c.askPrice && !c.askInfo) parts.push(`${i + 1}번 ${josa(shortOf(p), '은', '는')} ${won(p.price)}이에요.`);
    else if (c.askFinish && !c.askInfo) {
      parts.push(p.finish
        ? `${i + 1}번 ${josa(shortOf(p), '은', '는')} ${FINISH_LABELS[p.finish]} 제형이에요.`
        : `${i + 1}번은 제형 정보가 없어요. 상세 페이지에서 확인해 주세요.`);
    } else {
      parts.push(`${i + 1}번은 ${josa(nameOf(p), '이에요', '예요')}.`, p.description,
        `${p.finish ? `${FINISH_LABELS[p.finish]} 제형이고 ` : ''}가격은 ${won(p.price)}이에요.`,
        p.color_options ? `${p.color_options}가지 색상이 있는 제품이고, 추천은 대표 색상 기준이에요.` : '');
      if (p.similarity !== undefined) parts.push(`${base ? '기준 제품' : '고르신 색'}이랑은 ${p.similarity}% 비슷해요.`);
    }
    return out({
      reply: parts.filter(Boolean).join(' '),
      products: [p],
      suggestions: [`${i + 1}번 기준 제품으로 해 줘`, shown.length >= 2 ? `1번이랑 ${i === 0 ? 2 : i + 1}번 비교해 줘` : null, '다른 거 더 보여 줘'].filter(Boolean),
    });
  }

  // ---------- "그중에 제일 싼 거" (방금 보여 드린 목록 안에서) ----------
  const onlyRank = Object.keys(q).every((k) => k === 'superlative');
  if (c.superlative && shown.length && (c.among || onlyRank)) {
    const sorted = [...shown].sort((a, b) => (c.superlative === 'cheapest' ? a.price - b.price : b.price - a.price));
    const p = sorted[0];
    const i = shown.findIndex((x) => x.id === p.id);
    return out({
      reply: `방금 보여 드린 것 중엔 ${i + 1}번 ${josa(shortOf(p), '이', '가')} ${won(p.price)}으로 제일 ${c.superlative === 'cheapest' ? '저렴해요' : '가격대가 높아요'}!${p.finish ? ` ${FINISH_LABELS[p.finish]} 제형이에요.` : ''}`,
      products: [p],
      suggestions: [`${i + 1}번 자세히 알려 줘`, `${i + 1}번 기준 제품으로 해 줘`, '더 저렴한 걸로 더 보여 줘'],
    });
  }

  // ---------- 왜 이렇게 골랐는지 ----------
  if (c.why && !isSearch) {
    if (!ctx.lastConditions?.length) return out({ reply: '아직 추천해 드린 게 없어요. 원하는 립을 말씀해 주시면 이유도 같이 알려 드릴게요.', suggestions: START_SUGGESTIONS });
    const summary = ctx.query ? friendlySummary(ctx.query, env) : '';
    return out({
      reply: `${summary ? `'${summary}'에 맞는 제품만 골랐어요. ` : ''}${(ctx.lastReasons || []).join(' ')} ${ref ? '기준 색이 있어서 그 색과 가까운 순서로' : '조건에 맞는 순서대로'} 보여 드렸어요.`.replace(/\s+/g, ' ').trim(),
      suggestions: ['더 보여 줘', '그중에 제일 싼 거는?'],
    });
  }

  // ---------- 더 보여 줘 (같은 조건으로 다음 결과) ----------
  if (c.more && !isSearch && ctx.query) {
    const offset = (ctx.offset || 0) + limit;
    const r = runSearch(ctx.query, env);
    const page = r.scored.slice(offset, offset + limit);
    if (!page.length) {
      return out({ reply: '이 조건으로는 보여 드린 게 전부예요. 조건을 살짝 바꿔서 다시 찾아볼까요?', suggestions: ['글로시한 걸로 바꿔 줘', '더 저렴한 걸로', '데일리로 바를 립 추천해 줘'] });
    }
    return out({
      reply: `같은 조건으로 ${page.length}개 더 가져왔어요! 전체 ${r.scored.length}개 중 ${offset + 1}~${offset + page.length}번째예요.`,
      conditions: r.conditions, products: page, total: r.scored.length,
      suggestions: resultSuggestions(page, ctx.query, r.scored.length > offset + limit),
      context: { ...ctx, shown: page.map((p) => p.id), offset },
    });
  }

  // 기준 제품 정보 질문 (검색 조건이 없을 때)
  if (!isSearch && base && (c.askPrice || c.askFinish || c.askBarcode || c.askInfo)) {
    const parts = [];
    if (c.askPrice) parts.push(`${josa(shortOf(base), '은', '는')} ${won(base.price)}이에요.`);
    if (c.askFinish) parts.push(base.finish ? `제형은 ${FINISH_LABELS[base.finish]}이에요.` : '제형 정보는 수집되지 않았어요.');
    if (c.askBarcode) parts.push(base.barcode ? `바코드 번호는 ${base.barcode}예요.` : '이 제품은 바코드 정보가 없어요.');
    if (c.askInfo) parts.push(`${josa(nameOf(base), '이에요', '예요')}.`, base.description);
    return out({ reply: parts.filter(Boolean).join(' '), suggestions: ['비슷한 색상 찾아 줘', '더 저렴한 제품 추천해 줘', '더 밝은 색 추천해 줘'] });
  }

  // ---------- 나에게 어울리는 립 (퍼스널 톤을 모를 때는 되묻는다) ----------
  if (c.mine && !c.tone && !toneHint && !q.families) {
    return out({
      reply: '퍼스널 톤을 알면 훨씬 잘 맞춰 드릴 수 있어요! 립 컬러 매핑에서 "나에게 가장 잘 어울리는 컬러 추천받기"로 톤을 재 보시거나, 웜톤인지 쿨톤인지 편하게 알려 주세요.',
      suggestions: ['웜톤이야, 추천해 줘', '쿨톤이야, 추천해 줘', '봄 웜 립 추천해 줘', '겨울 쿨 립 추천해 줘'],
    });
  }

  // ---------- 가벼운 대화 ----------
  if (!isSearch) {
    const seed = spoken.text;
    const small = {
      greet: pick(seed, [
        '안녕하세요! took 뷰티 챗봇이에요. 오늘은 어떤 립을 찾고 계세요? 분위기나 상황만 말씀해 주셔도 골라 드릴게요.',
        '반가워요! 찾는 컬러, 가격대, 바를 자리(데일리·데이트·면접 등)를 말씀해 주시면 등록된 제품에서 골라 드릴게요.',
      ]),
      thanks: pick(seed, ['도움이 됐다니 다행이에요! 다른 컬러도 찾아 드릴까요?', '천만에요. 더 궁금한 게 있으면 언제든 물어봐 주세요.']),
      bye: '다음에 또 들러 주세요. 좋은 하루 보내세요!',
      identity: '저는 took 뷰티 챗봇이에요. 외부 AI 가 아니라, 등록된 립 제품 데이터에서 말씀하신 조건·상황·퍼스널 톤에 맞는 제품을 정해진 규칙으로 찾아 드리는 도우미예요.',
      help: '이런 걸 물어보실 수 있어요. ① 조건: "2만원 이하 글로시한 코랄" ② 상황: "면접 립", "데이트 립" ③ 톤·고민: "쿨톤 립", "입술이 건조해" ④ 이어서: "그중에 제일 싼 거", "두 번째 거 자세히", "1번이랑 2번 비교", "더 보여 줘", "매트 말고".',
      like: '마음에 드셨다니 기뻐요! 그 제품을 기준 제품으로 정하면 비슷한 색이나 더 저렴한 제품도 찾아 드릴 수 있어요.',
      dislike: '아쉽네요. 어떤 점이 별로였는지(색이 너무 진함, 가격, 제형 등) 알려 주시면 다시 골라 볼게요.',
    }[c.small];
    if (small) {
      const sugg = {
        like: shown.length ? ['첫 번째 거 기준 제품으로 해 줘', '비슷한 색상 찾아 줘'] : START_SUGGESTIONS,
        dislike: ['더 밝은 색 추천해 줘', '더 저렴한 걸로', '다른 거 보여 줘', '매트 말고 글로시로'],
        bye: [],
      }[c.small] || START_SUGGESTIONS;
      return out({ reply: small, suggestions: sugg });
    }
    return out({
      reply: pick(seed, ['음, 그건 제가 아직 잘 모르겠어요. ', '앗, 어떤 립을 찾으시는지 제가 잘 못 알아들었어요. ']) + HELP,
      suggestions: START_SUGGESTIONS,
    });
  }

  // ---------- 조건 검색 (이전 조건에 이어서 바꾸는 말이면 합친다: "글로시한 걸로", "매트 말고") ----------
  let query = q;
  if (ctx.query && (c.refine || (!q.families && !q.tone && !q.situations && !q.concerns && !q.brand && (q.finish || q.price || q.exclude || q.lightness)))) {
    query = { ...ctx.query, ...q };
    if (q.exclude?.families?.length && query.families) {
      query.families = query.families.filter((f) => !q.exclude.families.includes(f));
      if (!query.families.length) delete query.families;
    }
    if (q.exclude?.finishes?.length && query.finish && q.exclude.finishes.includes(query.finish)) delete query.finish;
  }
  if (c.mine && toneHint && !query.tone) query = { ...query, mine: true };
  // 기준 제품 없이 "더 저렴한 거" → 방금 보여 드린 제품보다 싼 것
  if (query.price === 'cheaper' && !base && shown.length && c.price === 'cheaper') query = { ...query, cheaperThan: Math.min(...shown.map((p) => p.price)) };

  const r = runSearch(query, env);
  const total = r.scored.length;
  const page = r.scored.slice(0, limit);
  const nextCtx = { query, shown: page.map((p) => p.id), offset: 0, lastConditions: r.conditions, lastReasons: r.reasons };

  let reply;
  let suggestions;
  if (r.onlyUnmetColor) {
    reply = r.notes.join(' ');
    suggestions = START_SUGGESTIONS;
  } else if (total === 0) {
    const hint = relaxHint(query, env);
    const summary = friendlySummary(query, env);
    reply = `아쉽게도 ${summary ? `'${summary}'에 ` : ''}딱 맞는 제품은 없어요. ${hint ? hint.text : '조건을 조금 줄여서 다시 물어봐 주세요.'}`;
    suggestions = [hint?.phrase, '데일리로 바를 립 추천해 줘', '2만원 이하 추천해 줘'].filter(Boolean);
  } else {
    const top = page[0];
    const summary = friendlySummary(query, env);
    const opener = pick(spoken.text, ['좋아요! ', '골라 봤어요! ', '이런 건 어떠세요? ']);
    reply = `${opener}${summary ? `'${summary}'${euro(summary)} ` : ''}${total}개를 찾았어요.`
      + (total > limit ? ` 그중 ${limit}개를 먼저 보여 드릴게요.` : '')
      + (r.reasons.length ? ' ' + r.reasons[0] : '')
      + ` 제일 먼저 추천하고 싶은 건 ${josa(shortOf(top), '이에요', '예요')}. ${top.finish ? `${FINISH_LABELS[top.finish]} 제형에 ` : '가격은 '}${won(top.price)}`
      + (top.similarity !== undefined ? `이고, ${base ? '기준 제품' : '고르신 색'}이랑 ${top.similarity}% 비슷해요.` : '이에요.')
      + (r.notes.length ? ' ' + r.notes.join(' ') : '');
    suggestions = resultSuggestions(page, query, total > limit);
  }
  return out({ reply, conditions: r.conditions, products: page, total, suggestions, context: nextCtx });
}
