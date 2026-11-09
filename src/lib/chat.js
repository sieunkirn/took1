// 규칙 기반 뷰티 챗봇. 외부 AI API 를 사용하지 않는다.
// 메시지에서 조건(제형/가격/색상 계열/유사 색상/밝기/브랜드)과 상황·퍼스널 톤·입술 고민을 추출해 제품 데이터에서 검색한다.
// 직전 대화(context)를 받아 "그중에 제일 싼 거", "두 번째 거 자세히", "더 보여 줘", "매트 말고" 같은 이어지는 질문에도 답한다.
import { FINISH_LABELS, FAMILY_LABELS } from './constants.js';
import { hexToLab, deltaE2000, normalizeHex } from './color.js';
import { allProducts, findById, fullName, shortName } from './catalog.js';
import { withSimilarity } from './recommend.js';
import { normalizeSpoken } from './spoken.js';
import { SITUATIONS } from './situations.js';
import { BRAND_ALIASES, WORD_ALIASES } from './aliases.js';
import {
  parseMessageEn, offTopicReplyEn, moodEn, ordinalEn, SITUATIONS_EN, TONES_EN, CONCERNS_EN, GENERIC_ACKS_EN, START_SUGGESTIONS_EN,
  EN_FINISH_LABELS, EN_FAMILY_LABELS,
} from './chat-en.js';

// ---------- 답하는 언어 ----------
// answer({ lang }) 가 정한다 (한 번에 한 질문씩 동기로 돌기 때문에 모듈 상태로 둔다). 문장은 L(한국어, 영어) 로 나란히 쓴다
let EN = false;
const L = (ko, en) => (EN ? en : ko);
const finL = (f) => L(FINISH_LABELS[f], EN_FINISH_LABELS[f]);
const famL = (f) => L(FAMILY_LABELS[f], EN_FAMILY_LABELS[f]);
const famsL = (fs, sep = '·') => fs.map(famL).join(EN ? '/' : sep);

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

// 상황·계절 데이터(면접·결혼식·장례식 등)는 situations.js 에 따로 둔다

// 퍼스널 톤 (립 컬러 매핑의 '나에게 어울리는 컬러' 결과 키와 같다: spring/summer/autumn/winter)
const TONES = {
  spring: { label: '봄 웜', words: ['봄웜', '봄 웜', '봄 라이트', '봄브라이트'], families: ['coral', 'orange', 'pink'],
    reason: '봄 웜톤엔 맑은 코랄·피치·오렌지 계열이 잘 받아요.' },
  summer: { label: '여름 쿨', words: ['여름쿨', '여름 쿨', '여쿨', '여름 라이트', '여름뮤트'], families: ['pink', 'rose', 'berry'],
    reason: '여름 쿨톤엔 부드러운 핑크·로즈·라이트 베리 계열이 잘 받아요.' },
  autumn: { label: '가을 웜', words: ['가을웜', '가을 웜', '갈웜', '가을 딥', '가을뮤트'], families: ['brown', 'orange', 'nude', 'coral'],
    reason: '가을 웜톤엔 브릭·브라운·테라코타 같은 깊고 따뜻한 색이 잘 받아요.' },
  winter: { label: '겨울 쿨', words: ['겨울쿨', '겨울 쿨', '겨쿨', '겨울 딥', '겨울 브라이트'], families: ['red', 'berry', 'plum', 'burgundy'],
    reason: '겨울 쿨톤엔 선명한 레드·베리·플럼 계열이 잘 받아요.' },
  warm: { label: '웜톤', words: ['웜톤', '웜 톤', '웜이'], families: ['coral', 'orange', 'brown', 'nude'],
    reason: '웜톤엔 노란 기가 도는 코랄·오렌지·브라운 계열이 잘 받아요.' },
  cool: { label: '쿨톤', words: ['쿨톤', '쿨 톤', '쿨이'], families: ['pink', 'rose', 'berry', 'plum', 'red'],
    reason: '쿨톤엔 푸른 기가 도는 핑크·로즈·베리 계열이 잘 받아요.' },
};

// 입술 고민·원하는 느낌
const CONCERNS = [
  { label: '건조한 입술', words: ['건조', '각질', '트는', '갈라', '푸석'], finishes: ['glossy', 'satin'],
    reason: '건조한 입술엔 매트보다 글로시·새틴이 각질이 덜 보여요.' },
  { label: '오래 가는', words: ['지속력', '오래', '안 지워', '안지워', '마스크', '묻어나'], finishes: ['matte', 'velvet'],
    reason: '지속력은 매트·벨벳 제형이 좋은 편이에요.' },
  { label: '자연스러운', words: ['자연스러', '생기', '쌩얼', '꾸안꾸', '내추럴', '은은'], families: ['nude', 'rose', 'coral', 'pink'],
    reason: '자연스러운 느낌엔 입술색과 가까운 누드·로즈·코랄 계열이 좋아요.' },
  { label: '강렬한', words: ['강렬', '포인트', '시크', '센 느낌', '존재감'], families: ['red', 'burgundy', 'berry', 'plum'],
    reason: '포인트엔 레드·버건디·베리 같은 선명한 색이 좋아요.' },
  { label: '화사한', words: ['화사', '어려 보', '사랑스러', '귀여', '발랄', '과즙', '상큼', '쥬시', '청량'], families: ['pink', 'coral', 'orange'],
    reason: '화사한 느낌엔 핑크·코랄 계열이 좋아요.' },
  { label: '선물', words: ['선물'], families: ['nude', 'rose', 'coral', 'pink'],
    reason: '선물로는 무난한 누드·로즈·코랄 계열이 실패가 적어요.' },
  // ---------- 표현 사전: 규칙 단어가 없는 막연한 말을 느낌으로 묶는다 ----------
  { label: '혈색 있는', words: ['혈색', '창백', '안색', '핏기', '아파 보', '피곤해 보'], families: ['pink', 'coral', 'rose'],
    reason: '혈색이 필요할 땐 핑크·코랄·로즈 계열이 얼굴을 생기 있어 보이게 해요.' },
  { label: '입술색 같은', words: ['입술색', '입술 색', '화장 안 한', '안 바른 듯', '민낯', '본연'], families: ['nude', 'rose', 'pink'],
    reason: '입술색 같은 느낌엔 누드·로즈·연한 핑크 계열이 자연스러워요.' },
  { label: '차분한', words: ['차분', '톤다운', '톤 다운', '튀지 않', '안 튀는', '단아', '얌전'], families: ['nude', 'rose', 'brown'],
    reason: '차분한 느낌엔 누드·로즈·브라운 계열이 튀지 않아요.' },
  { label: '발색 좋은', words: ['발색', '진하게', '쨍하게', '한 번만 발라', '한 번 발라', '한번 발라', '선명하게'], families: ['red', 'burgundy', 'berry', 'plum', 'brown'],
    reason: '발색을 원하면 레드·버건디·베리처럼 색이 깊은 계열이 한 번에 잘 올라와요.' },
  { label: '사진에 잘 나오는', words: ['사진', '셀카', '살아 보', '또렷', '카메라에'], families: ['red', 'berry', 'pink', 'coral'],
    reason: '사진엔 레드·베리·핑크처럼 채도 있는 색이 입술을 또렷하게 살려 줘요.' },
  { label: '호감 가는', words: ['남자친구', '남친', '여자친구', '여친', '호감', '청순', '첫인상'], families: ['pink', 'rose', 'coral'],
    reason: '호감 가는 인상엔 부드러운 핑크·로즈·코랄 계열이 무난해요.' },
];

// 표현 사전: 색 이름 → 색 계열 (말한 색이므로 조건으로 건다)
const COLOR_NAMES = [
  { words: ['벽돌', '브릭', '테라코타'], families: ['brown', 'orange', 'red'] },
  { words: ['체리'], families: ['red', 'berry'] },
  { words: ['와인'], families: ['burgundy', 'berry', 'plum'] },
  { words: ['토마토'], families: ['red', 'orange'] },
  { words: ['피치', '복숭아', '살구', '애프리콧'], families: ['coral', 'orange'] },
  { words: ['딸기'], families: ['pink', 'red'] },
  { words: ['벚꽃'], families: ['pink'] },
  { words: ['모브'], families: ['rose', 'plum'] },
  { words: ['팥', '말린 장미', '말린장미', '건조 장미'], families: ['rose', 'brown'] },
  { words: ['초코', '카멜', '모카'], families: ['brown'] }, // '커피'는 "커피 마셔도 안 지워지는"처럼 지속력 말에 많이 나와 뺀다
];
// 싫다고 한 질감 → 제외할 제형
const AVOID_FINISHES = [
  { words: ['번들', '끈적', '기름져', '번쩍', '광 싫', '광택 싫', '반짝이는 건'], finishes: ['glossy'] },
  { words: ['텁텁', '각질 부각', '갈라져 보', '건조해 보이는'], finishes: ['matte', 'velvet'] },
];

// ---------- 잡담도 부드럽게 받는다 ("졸려" → "졸리시다구요? 그럼 혈색이 좋아 보이는 립 추천해 드릴게요") ----------
// 기분·상태 말 → 한마디 받아 주고 그에 맞는 조건으로 추천한다 (검색 조건이 없는 말일 때만)
const MOODS = [
  { words: ['졸려', '졸리', '잠 와', '잠와', '잠이 와', '하품'], ack: '졸리시다구요? 그럼 혈색이 좋아 보이는 립 추천해 드릴게요.', query: { concerns: ['혈색 있는'] } },
  { words: ['피곤', '지쳐', '지친', '힘들', '기운 없', '기운이 없'], ack: '많이 피곤하시죠. 생기 있어 보이게 혈색 도는 립으로 골라 볼게요.', query: { concerns: ['혈색 있는'] } },
  { words: ['배고', '출출', '밥 먹', '점심', '저녁 먹', '간식'], ack: '배고프시군요! 먹고 나서도 잘 안 지워지는 립으로 골라 볼게요.', query: { concerns: ['오래 가는'] } },
  { words: ['심심', '지루', '따분'], ack: '심심하시면 평소와 다른 포인트 색에 도전해 볼까요?', query: { concerns: ['강렬한'] } },
  { words: ['우울', '슬퍼', '슬프', '속상', '꿀꿀', '기분이 안 좋', '기분 안 좋', '짜증'], ack: '기분이 가라앉을 땐 화사한 색이 힘이 돼요. 이런 색 어떠세요?', query: { concerns: ['화사한'] } },
  { words: ['기분 좋', '신나', '행복', '설레'], ack: '기분 좋은 날이네요! 생기 있는 색이 잘 어울릴 거예요.', query: { concerns: ['화사한'] } },
  { words: ['더워', '덥다', '더운', '덥네'], ack: '더운 날엔 산뜻한 색이 좋아요.', query: { situations: ['여름'] } },
  { words: ['추워', '춥다', '추운', '춥네'], ack: '추운 날엔 따뜻하고 깊은 색 어떠세요?', query: { situations: ['겨울'] } },
  { words: ['비 와', '비와', '비가 와', '비 오', '비오', '비 온', '비온'], ack: '비 오는 날엔 차분한 색이 분위기 있어요.', query: { concerns: ['차분한'] } },
  { words: ['바빠', '바쁘', '시간 없', '급해'], ack: '바쁘실 땐 한 번만 발라도 색이 잘 올라오는 립이 편해요.', query: { concerns: ['발색 좋은'] } },
  { words: ['예뻐지고', '예뻐 보이고', '이뻐지고', '이뻐 보이고'], ack: '지금도 좋지만, 인상이 더 살아 보이는 색으로 골라 볼게요.', query: { concerns: ['호감 가는'] } },
];
// 알아듣지 못한 말: 되묻지 않고 한마디 받은 뒤 무난한 립을 보여 준다 (말 길이로 돌려 가며 고른다)
const GENERIC_ACKS = [
  '그렇군요! 그럼 오늘 바르기 좋은 립을 하나 골라 볼게요.',
  '말씀 고마워요. 그럼 부담 없이 바르기 좋은 색부터 보여 드릴게요.',
  '좋아요, 그럼 데일리로 무난한 립으로 골라 볼게요.',
];

// 개인정보 패턴: 휴대폰 번호, 이메일, 주민등록번호 (hybridAnswer 도 같은 패턴이면 LLM 에 보내지 않는다)
export const PII_RE = /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}|[\w.+-]+@[\w-]+\.[\w.]+|\d{6}[-\s]?[1-4]\d{6}/;

const OTHER_CATEGORIES = ['선크림', '썬크림', '선블록', '아이섀도', '섀도', '마스카라', '파운데이션', '쿠션', '컨실러', '토너', '로션',
  '향수', '샴푸', '네일', '블러셔', '아이라이너', '브로우'];
const UNSUPPORTED_COLORS = ['초록', '녹색', '파랑', '파란', '하늘색', '노랑', '노란', '검정', '검은', '블랙', '흰색', '화이트', '회색', '민트'];
// 립 추천 밖의 말: 제품을 내밀지 않고 할 수 없는 것을 부드럽게 말한 뒤 할 수 있는 걸 권한다
function offTopicReply(text) {
  const reply = (r, suggestions = startSuggestions()) => ({ reply: r, suggestions });
  if (has(text, ['무시하고', '프롬프트', '관리자', '모드로', '지어내', '지어서', '라고 말해', '라고 해 줘', '척해', '척 해'])) {
    return reply('그건 도와드릴 수 없어요. 저는 등록된 립 제품 정보만 있는 그대로 알려 드려요. 찾는 색이나 느낌을 말씀해 주시면 바로 골라 드릴게요.');
  }
  if (has(text, ['바보', '멍청', '못생', '쓰레기', '최악'])) {
    return reply('앗, 마음에 안 드셨나요? 원하는 색이나 느낌을 말씀해 주시면 다시 골라 볼게요.', ['더 밝은 색 추천해 줘', '더 저렴한 걸로', '데일리로 바를 립 추천해 줘']);
  }
  if (has(text, ['베스트셀러', '베스트 셀러', '잘 팔리는', '제일 잘나가', '인기 많은', '인기 있는', '인기있는', '판매 순위', '랭킹'])) {
    return reply('판매 순위 정보는 갖고 있지 않아요. 원하는 색이나 분위기를 말씀해 주시면 가장 가까운 걸 찾아 드릴게요.', ['데일리로 바를 립 추천해 줘', '데이트 립 추천해 줘']);
  }
  // 립 제품이라도 지금 데이터(립틴트·글로스)에 없는 종류
  if (has(text, ['립밤', '립 밤', '립라이너', '립 라이너', '립마스크', '립 마스크', '립스크럽'])) {
    return reply('지금은 립틴트·글로스만 있어요. 입술이 건조하다면 촉촉한 글로시 틴트로 찾아 드릴게요.', ['입술이 건조한데 뭐가 좋아?', '글로시한 립 추천해 줘']);
  }
  const category = OTHER_CATEGORIES.find((w) => text.includes(w));
  if (category) return reply(`${josa(category, '은', '는')} 아직 없어요. 지금은 립 제품만 찾아 드릴 수 있어요. 립도 한번 보실래요?`);
  const color = UNSUPPORTED_COLORS.find((w) => text.includes(w));
  if (color) return reply(`${color} 계열 립은 등록된 제품 중에 없어요. 대신 비슷한 분위기를 말씀해 주시면 골라 볼게요.`, ['포인트 되는 강렬한 색 추천해 줘', '차분한 색 추천해 줘', '데일리로 바를 립 추천해 줘']);
  if (has(text, ['재고', '남아 있', '남아있', '품절'])) {
    return reply('재고는 여기서 확인할 수 없어요. 매장 직원에게 물어봐 주시면 정확해요. 제품 정보나 비슷한 색은 바로 찾아 드릴게요.');
  }
  if (has(text, ['할인', '세일', '쿠폰', '이벤트', '적립'])) {
    return reply('할인·이벤트 정보는 아직 연결되어 있지 않아요. 대신 가격대에 맞는 립은 바로 찾아 드릴게요.', ['2만원 이하 추천해 줘', '제일 싼 립 알려 줘']);
  }
  if (has(text, ['성분', '알레르기', '알러지', '임산부', '임신', '수유', '아기', '피부과', '부작용', '터졌', '터져', '찢어', '상처', '피가', '물집', '염증', '헤르페스', '포진', '가려', '따가', '부었', '부어', '발진', '두드러기', '아파', '아픈'])) {
    return reply('입술이 불편하시면 걱정되시죠. 건강이나 성분은 제가 판단할 수 없어서, 제품 성분표를 확인하시고 피부과나 약사와 상담해 보세요. 촉촉하게 발리는 립을 찾으시면 골라 드릴게요.', ['촉촉한 글로시 립 추천해 줘', '데일리로 바를 립 추천해 줘']);
  }
  // 개인정보(전화번호·이메일·주소·주민번호)는 받지 않는다: 저장·되풀이하지 않고 LLM 에도 보내지 않는다
  if (PII_RE.test(text) || has(text, ['내 번호', '전화번호', '주민번호', '주민등록', '집 주소', '계좌'])) {
    return reply('개인정보는 적지 않으셔도 돼요. 저는 립 색 상담에 필요한 것만 여쭤볼게요. 찾는 색이나 느낌을 말씀해 주세요.');
  }
  if (has(text, ['날씨', '몇 시야', '몇시야', '뉴스', '며칠이야'])) {
    return reply('그건 제가 알 수 없지만, 어떤 날이든 어울리는 립은 골라 드릴 수 있어요.', ['더운 날 바를 립 추천해 줘', '비 오는 날 어울리는 립', '데일리로 바를 립 추천해 줘']);
  }
  return null;
}

const has = (text, words) => words.some((w) => text.includes(w));

// ---------- 답 조립: [여는 말] + [고정 사실(제품·가격·이유)] + [마무리 말] (딥리서치 P1) ----------
// 여는 말은 손님이 말한 조건을 되받는다. 공감하는 말은 입술 고민이 있을 때만. 마무리 말은 다음에 해 볼 것 하나를 가볍게 권한다.
// 같은 표현이 연달아 나오지 않게 대화 턴 번호(context.turn)로 고르고 직전 표현(context.lastOpener·lastCloser)은 건너뛴다 (무작위 아님: 같은 대화면 같은 답)
// 이모지는 쓰지 않는다 (무채색 화면, 매장에선 소리로 읽음, 실패·거절 답에는 특히 금지)
const EMPATHY = {
  '건조한 입술': ['건조한 입술이면 신경 쓰이죠.', 'Dry lips can be bothersome.'],
  '오래 가는': ['오래 가는 게 중요하죠.', 'Staying power matters.'],
  '자연스러운': ['자연스러운 느낌 좋죠.', 'A natural look is always nice.'],
  '강렬한': ['포인트 주고 싶은 날이군요.', 'Going for a statement today.'],
  '화사한': ['화사하게 가 볼까요.', "Let's go bright."],
};
const OPENERS = [
  ["'{s}' 쪽으로 골라 봤어요.", 'Here are picks for "{s}".'],
  ["'{s}' 반영해서 다시 골랐어요.", 'Updated with "{s}".'],
  ["'{s}' 기준으로 찾아봤어요.", 'I searched with "{s}".'],
];
const CLOSERS = [
  { ko: '마음에 드는 번호를 말해 주시면 자세히 알려 드릴게요.', en: 'Tell me a number and I will share more about it.' },
  { ko: '더 밝은 쪽도 볼까요?', en: 'Want to see lighter shades too?', skip: (q) => !!q.lightness },
  { ko: '가격대를 바꿔서 볼 수도 있어요.', en: 'We can try a different price range too.', skip: (q) => !!(q.maxPrice || q.minPrice || q.price) },
];
function pickRotating(list, turn, last, key = (x) => x) {
  if (!list.length) return null;
  let i = turn % list.length;
  if (list.length > 1 && key(list[i]) === last) i = (i + 1) % list.length;
  return list[i];
}
// own: 이번 말에서 새로 나온 조건만 (이전 조건에 이어 붙인 것은 되받지 않는다 → 공감·되받기가 턴마다 반복되지 않게)
function openerFor(own, env, ctx, mine = false) {
  if (mine && !(own && Object.keys(own).length)) return L('측정한 톤에 맞춰 골라 봤어요.', 'I picked these to suit your measured tone.');
  if (!own || !Object.keys(own).length) return '';
  const concern = (own.concerns || []).find((c) => EMPATHY[c]);
  if (concern) return EMPATHY[concern][EN ? 1 : 0];
  const s = friendlySummary(own, env);
  if (!s || s.length > 24) return ''; // 조건이 길면 되받지 않는다 (답이 길어지지 않게)
  const t = pickRotating(OPENERS, ctx.turn || 0, ctx.lastOpener, (o) => o[0]);
  return t ? t[EN ? 1 : 0].replace('{s}', s) : '';
}
function closerFor(query, ctx) {
  const pool = CLOSERS.filter((c) => !c.skip?.(query));
  const c = pickRotating(pool, (ctx.turn || 0) + 1, ctx.lastCloser, (x) => x.ko);
  return c ? c : null;
}
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
// 화면에는 번호를 붙이지 않으므로 답변·추천 질문도 "첫 번째·두 번째"처럼 순서로 가리킨다
const ORD_WORDS = ['첫', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
const ord = (i) => (EN ? ordinalEn(i) : `${ORD_WORDS[i] || i + 1} 번째`);
function parseOrdinals(text) {
  const found = ORDINALS.map(([re, i]) => ({ i, at: text.search(re) })).filter((x) => x.at >= 0);
  // 숫자: "2번", "10번째" ("1만원"·"번들" 같은 말은 '번' 앞에 숫자가 없어 걸리지 않는다)
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})\s*번/g)) if (Number(m[1]) >= 1) found.push({ i: Number(m[1]) - 1, at: m.index });
  return found.sort((a, b) => a.at - b.at).map((x) => x.i);
}

// 등록되지 않은 유명 브랜드: 물어보면 다른 제품을 내밀지 않고 등록되어 있지 않다고 말한다 (DB 에 있는 브랜드는 빼고 쓴다)
const OTHER_BRANDS = ['샤넬', '디올', '입생로랑', '생로랑', '나스', '톰포드', '에스티로더', '에스티 로더', '랑콤', '지방시', '아르마니',
  '겔랑', '바비브라운', '바비 브라운', '설화수', '이니스프리', '미샤', '메이블린', '로레알', '슈에무라', '조말론',
  'chanel', 'dior', 'ysl', 'nars', 'tom ford', 'lancome', 'givenchy', 'armani', 'maybelline'];

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

  // '비싼' 안에 '싼'이 들어 있으므로 비싼 쪽을 먼저 본다
  const superlative = has(text, ['제일', '가장', '젤 ', '최저', '최고가']);
  const pricey = has(text, ['비싼', '비싸', '고급', '프리미엄', '최고가']);
  const cheap = !pricey && has(text, ['저렴', '싼', '싸', '가성비', '착한 가격', 'cheap', '최저']);
  if (superlative && pricey) c.superlative = 'priciest';
  else if (superlative && cheap) c.superlative = 'cheapest';
  else if (cheap) c.price = 'cheaper';
  else if (pricey) c.price = 'pricier';
  Object.assign(c, parsePriceRange(text));
  // "입술색이랑 비슷한 거"는 기준 색 비교가 아니라 '입술색 같은' 느낌이고, "체리 같은 색"은 그 색을 말한 것이다
  if (has(text, ['비슷', '유사', '닮은', '같은 색', 'similar']) && !has(text, ['입술색', '입술 색', '내 입술']) && !namedColor) c.similar = true;
  if (has(text, ['밝은', '연한', '라이트', '가벼운 색'])) c.lightness = 'lighter';
  else if (has(text, ['어두운', '진한', '딥', '다크'])) c.lightness = 'darker';
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

  const tone = Object.entries(TONES).find(([, t]) => has(text, t.words));
  if (tone) c.tone = tone[0];
  const hit = SITUATIONS.filter((s) => has(text, s.words));
  const overridden = hit.flatMap((s) => s.overrides || []);
  const situations = hit.map((s) => s.label).filter((l) => !overridden.includes(l));
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

const won = (n) => (EN ? '₩' + n.toLocaleString('en-US') : n.toLocaleString('ko-KR') + '원');
// 영어면 글로벌 올리브영에서 짝지은 영어 이름(없으면 한국어 이름 그대로, 지어내지 않는다)
const enName = (p) => `${p.brand_en || p.brand} ${p.name_en || p.name}`;
const nameOf = (p) => (EN ? enName(p) : fullName(p));
const shortOf = (p) => (EN ? enName(p) : shortName(p));
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


// 조건을 사람이 읽기 쉬운 말로 요약한다 (예: "데이트 · 글로시 · 20,000원 이하")
function friendlySummary(q, { base }) {
  const parts = [];
  for (const s of q.situations || []) parts.push(L(s, SITUATIONS_EN[s]?.label || s));
  if (q.tone && TONES[q.tone]) parts.push(L(TONES[q.tone].label.endsWith('톤') ? TONES[q.tone].label : TONES[q.tone].label + ' 톤', TONES_EN[q.tone].label));
  if (q.mine) parts.push(L('측정한 내 톤', 'my measured tone'));
  for (const x of q.concerns || []) parts.push(L(x, CONCERNS_EN[x]?.label || x));
  if (q.families) parts.push(L(famsL(q.families) + ' 계열', famsL(q.families)));
  if (q.finish) parts.push(finL(q.finish));
  if (q.brand) parts.push(L(q.brand, brandEn(q.brand)));
  if (q.minPrice) parts.push(L(`${won(q.minPrice.value)} ${q.minPrice.strict ? '초과' : '이상'}`, `${q.minPrice.strict ? 'over' : 'from'} ${won(q.minPrice.value)}`));
  if (q.maxPrice) parts.push(L(`${won(q.maxPrice.value)} ${q.maxPrice.strict ? '미만' : '이하'}`, `${q.maxPrice.strict ? 'under' : 'up to'} ${won(q.maxPrice.value)}`));
  if (q.price === 'cheaper') parts.push(base ? L('기준 제품보다 저렴한', 'cheaper than the base product') : q.cheaperThan ? L('방금 본 것보다 저렴한', 'cheaper than the ones shown') : L('저렴한 순', 'cheapest first'));
  if (q.price === 'pricier') parts.push(base ? L('기준 제품보다 고급', 'pricier than the base product') : L('고급스러운', 'premium'));
  if (q.lightness) parts.push(q.lightness === 'lighter' ? L('더 밝은 색', 'lighter shade') : L('더 진한 색', 'deeper shade'));
  if (q.exclude?.families?.length) parts.push(L(famsL(q.exclude.families) + ' 빼고', 'no ' + famsL(q.exclude.families)));
  if (q.exclude?.finishes?.length) parts.push(L(q.exclude.finishes.map(finL).join('·') + ' 빼고', 'no ' + q.exclude.finishes.map(finL).join('/')));
  if (q.similar) parts.push(L('비슷한 색', 'similar color'));
  if (q.superlative) parts.push(q.superlative === 'cheapest' ? L('가격 낮은 순', 'cheapest first') : L('가격 높은 순', 'priciest first'));
  return parts.join(' · ');
}

const SEARCH_KEYS = ['finish', 'families', 'price', 'maxPrice', 'minPrice', 'similar', 'lightness', 'brand', 'tone', 'situations', 'concerns', 'exclude', 'superlative'];
const searchPart = (c) => Object.fromEntries(SEARCH_KEYS.filter((k) => c[k] !== undefined).map((k) => [k, c[k]]));

// 조건을 다시 말로 만든다 (다음 질문 추천 칩에 사용)
function phraseOf(q) {
  const parts = [];
  const amount = (v) => (v >= 10000 && v % 10000 === 0 ? v / 10000 + '만원' : won(v));
  if (q.minPrice) parts.push(`${amount(q.minPrice.value)} ${q.minPrice.strict ? '넘는' : '이상'}`);
  if (q.maxPrice) parts.push(`${q.maxPrice.value >= 10000 && q.maxPrice.value % 10000 === 0 ? q.maxPrice.value / 10000 + '만원' : won(q.maxPrice.value)} ${q.maxPrice.strict ? '미만' : '이하'}`);
  if (q.brand) parts.push(q.brand);
  if (q.finish) parts.push({ glossy: '글로시한', matte: '매트한', satin: '새틴', velvet: '벨벳' }[q.finish]);
  if (q.families) parts.push(q.families.map((f) => FAMILY_LABELS[f]).join(' '));
  return parts.length ? parts.join(' ') + ' 추천해 줘' : null;
}
// 영어판: 영어 해석기가 다시 알아듣는 문장으로 ("Recommend glossy coral lips under 20,000 won")
function phraseOfEn(q) {
  const words = [q.brand ? brandEn(q.brand) : null, q.finish, ...(q.families || [])].filter(Boolean);
  const price = [q.minPrice ? `over ${q.minPrice.value.toLocaleString('en-US')} won` : null, q.maxPrice ? `under ${q.maxPrice.value.toLocaleString('en-US')} won` : null].filter(Boolean);
  return words.length || price.length ? `Recommend ${[...words, 'lips', ...price].join(' ')}` : null;
}
// 한국어 브랜드 → 글로벌 영어 표기 (없으면 한국어 그대로)
function brandEn(ko) {
  return allProducts().find((p) => p.brand === ko && p.brand_en)?.brand_en || ko;
}

// 조건으로 제품을 찾는다. 상황·톤·고민은 말하지 않은 계열/제형만 대신 정하고, 맞는 제품이 없으면 그 성향은 뺀다
function runSearch(q, { products, base, ref, shown, toneHint }) {
  const conditions = [];
  const reasons = [];
  const notes = [];
  const tips = []; // 상황별 요령 (situations.js 의 tip)
  let list =products.filter((p) => !base || p.id !== base.id);

  if (q.finish) {
    list = list.filter((p) => p.finish === q.finish);
    conditions.push(L(`제형 = ${finL(q.finish)}`, `Finish = ${finL(q.finish)}`));
  }
  if (q.exclude?.finishes?.length) {
    list = list.filter((p) => !q.exclude.finishes.includes(p.finish));
    conditions.push(L(`${q.exclude.finishes.map(finL).join('/')} 제외`, `No ${q.exclude.finishes.map(finL).join('/')}`));
  }
  if (q.families) {
    list = list.filter((p) => q.families.includes(p.color_family));
    conditions.push(L(`색상 계열 = ${famsL(q.families, '/')}`, `Color = ${famsL(q.families)}`));
  }
  if (q.exclude?.families?.length) {
    list = list.filter((p) => !q.exclude.families.includes(p.color_family));
    conditions.push(L(`${famsL(q.exclude.families, '/')} 제외`, `No ${famsL(q.exclude.families)}`));
  }
  if (q.brand) {
    list = list.filter((p) => p.brand === q.brand);
    conditions.push(L(`브랜드 = ${q.brand}`, `Brand = ${brandEn(q.brand)}`));
  }
  if (q.maxPrice) {
    const { value, strict } = q.maxPrice;
    list = list.filter((p) => (strict ? p.price < value : p.price <= value));
    conditions.push(`${L('가격', 'Price')} ${strict ? '<' : '≤'} ${won(value)}`);
  }
  if (q.minPrice) {
    const { value, strict } = q.minPrice;
    list = list.filter((p) => (strict ? p.price > value : p.price >= value));
    conditions.push(`${L('가격', 'Price')} ${strict ? '>' : '≥'} ${won(value)}`);
  }
  if (q.price === 'cheaper') {
    if (base) {
      list = list.filter((p) => p.price < base.price);
      conditions.push(L(`가격 < 기준 제품 ${won(base.price)}`, `Price < base product ${won(base.price)}`));
    } else if (q.cheaperThan) {
      list = list.filter((p) => p.price < q.cheaperThan);
      conditions.push(L(`가격 < 방금 보여 드린 제품 최저가 ${won(q.cheaperThan)}`, `Price < lowest shown ${won(q.cheaperThan)}`));
    } else conditions.push(L('가격 낮은 순', 'Cheapest first'));
  } else if (q.price === 'pricier') {
    if (base) {
      list = list.filter((p) => p.price > base.price);
      conditions.push(L(`가격 > 기준 제품 ${won(base.price)}`, `Price > base product ${won(base.price)}`));
    } else conditions.push(L('가격 높은 순', 'Priciest first'));
  }

  // 상황·톤·고민 → 추천 성향 (명시한 계열/제형이 없을 때만)
  const prefs = [];
  // en: 영어 이름·이유·요령 (chat-en.js)
  for (const label of q.situations || []) prefs.push({ ...SITUATIONS.find((s) => s.label === label), en: SITUATIONS_EN[label] });
  const toneKey = q.tone || (q.mine ? toneHint : null);
  if (toneKey && TONES[toneKey]) {
    prefs.push({ ...TONES[toneKey], label: `${TONES[toneKey].label}${q.tone ? '' : '(립 컬러 매핑 측정)'}`,
      en: { ...TONES_EN[toneKey], label: TONES_EN[toneKey].label + (q.tone ? '' : ' (measured)') } });
  }
  for (const label of q.concerns || []) prefs.push({ ...CONCERNS.find((x) => x.label === label), en: CONCERNS_EN[label] });
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
    // 그 자리에서 피하는 게 좋은 색·제형 (손님이 직접 말한 건 빼지 않는다). 빼면 아무것도 안 남을 땐 두고 찾는다
    const avoidFam = (pref.avoidFamilies || []).filter((f) => !q.families?.includes(f));
    const avoidFin = (pref.avoidFinishes || []).filter((f) => q.finish !== f);
    if (avoidFam.length || avoidFin.length) {
      const next = list.filter((p) => !avoidFam.includes(p.color_family) && !avoidFin.includes(p.finish));
      if (next.length) { list = next; used = true; }
    }
    if (used) {
      conditions.push(L(`${pref.label} 추천`, `For ${pref.en?.label || pref.label}`));
      // 직접 말한 제형·색이 이 성향의 추천과 다르면 설명이 엇갈리므로 이유는 말하지 않는다 (예: 데이트인데 매트, 면접인데 레드)
      const finishClash = q.finish && pref.finishes && !pref.finishes.includes(q.finish);
      const familyClash = q.families && pref.families && !q.families.every((f) => pref.families.includes(f));
      if (!finishClash && !familyClash) reasons.push(L(pref.reason, pref.en?.reason || pref.reason));
      if (pref.tip && !finishClash && !familyClash) tips.push(L(pref.tip, pref.en?.tip || pref.tip)); // 요령도 직접 고른 것과 엇갈리면 뺀다
    } else notes.push(L(`${pref.label} 성향과 겹치는 제품이 없어 그 조건은 빼고 찾았어요.`, `Nothing matched "${pref.en?.label || pref.label}", so I searched without it.`));
  }

  if ((q.similar || q.lightness) && !ref) {
    notes.push(L('기준 색상이 없어 색 비교는 못 했어요. 바코드로 제품을 찍거나 팔레트에서 색을 만든 뒤 물어봐 주세요.', 'There is no reference color to compare with. Scan a product barcode or mix a color on the palette, then ask again.'));
  }
  if (q.lightness && ref) {
    const refL = hexToLab(ref.hex).L;
    list = list.filter((p) => (q.lightness === 'lighter' ? p.color_lab.L > refL + 2 : p.color_lab.L < refL - 2));
    conditions.push(EN ? `${q.lightness === 'lighter' ? 'Lighter' : 'Deeper'} than reference (L* ${refL.toFixed(1)})` : `${q.lightness === 'lighter' ? '더 밝은' : '더 어두운'} 색 (기준 명도 L* ${refL.toFixed(1)})`);
  }

  // 정렬: 최저가/최고가 요청 > 기준 색상과 유사한 순 > 가격 순 > ID 순
  const refLab = ref ? hexToLab(ref.hex) : null;
  let scored = refLab ? list.map((p) => withSimilarity(p, refLab)) : list.map((p) => ({ ...p }));
  if (q.superlative) {
    scored.sort((a, b) => (q.superlative === 'cheapest' ? a.price - b.price : b.price - a.price) || a.id.localeCompare(b.id));
    conditions.push(q.superlative === 'cheapest' ? L('가격 낮은 순', 'Cheapest first') : L('가격 높은 순', 'Priciest first'));
  } else if (refLab && (q.similar || !q.price || base)) {
    scored.sort((a, b) => a.delta_e - b.delta_e || a.price - b.price);
    conditions.push(L(`${ref.label}과(와) 유사한 순`, `Closest to ${ref.label}`));
  } else if (q.price === 'pricier') {
    scored.sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
  } else if (q.price === 'cheaper' || q.maxPrice || q.minPrice) {
    scored.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  } else {
    scored.sort((a, b) => a.id.localeCompare(b.id));
  }
  // 기준 색상이 없을 때 '비슷한 색상'만 요청했다면 결과를 내지 않는다
  const onlyUnmetColor = !ref && (q.similar || q.lightness) && conditions.length === 0;
  if (onlyUnmetColor) scored = [];
  return { scored, conditions, reasons, notes, tips, onlyUnmetColor };
}

// 결과가 없을 때: 조건을 하나씩 빼 보고 결과가 생기는 조건을 알려 준다
function relaxHint(q, env) {
  const tries = [
    ['maxPrice', L('가격 조건', 'price limit')], ['minPrice', L('가격 조건', 'price limit')], ['brand', L('브랜드 조건', 'brand')], ['finish', L('제형 조건', 'finish')], ['families', L('색상 계열 조건', 'color family')], ['lightness', L('밝기 조건', 'lightness')],
  ];
  for (const [key, label] of tries) {
    if (q[key] === undefined) continue;
    const { [key]: _, ...rest } = q;
    const n = runSearch(rest, env).scored.length;
    if (n) return { text: L(`${label}을 빼면 ${n}개가 있어요.`, `Without the ${label}, there are ${n}.`), phrase: EN ? phraseOfEn(rest) : phraseOf(rest) };
  }
  return null;
}

/**
 * 제품 2~3개를 비교한 요약 문장. 챗봇의 "1번이랑 2번 비교"와 화면의 비교함이 같이 쓴다.
 * @param {object[]} items 제품 (color_lab, price, finish 포함)
 */
export function compareSummary(items, lang = null) {
  if (items.length < 2) return '';
  // 화면의 비교함은 lang 을 넘긴다. 챗봇 답 안에서는 지금 답하는 언어를 그대로 쓴다
  const prev = EN;
  if (lang) EN = lang === 'en';
  try {
    return compareLines(items);
  } finally {
    EN = prev;
  }
}
function compareLines(items) {
  const lines = [];
  const byPrice = [...items].sort((a, b) => a.price - b.price);
  if (byPrice[0].price === byPrice.at(-1).price) lines.push(L(`가격은 모두 ${won(byPrice[0].price)}이에요.`, `They are all ${won(byPrice[0].price)}.`));
  else {
    // 같은 가격이 여럿이면 모두 말한다 (예: "리플 01 코랄 비치·리플 02 핑크 소다가 9,900원으로")
    const names = (price) => items.filter((p) => p.price === price).map(shortOf).join(L('·', ' / '));
    lines.push(L(`가장 저렴한 건 ${names(byPrice[0].price)}(${won(byPrice[0].price)}), 가장 비싼 건 ${names(byPrice.at(-1).price)}(${won(byPrice.at(-1).price)})이에요.`,
      `The cheapest is ${names(byPrice[0].price)} (${won(byPrice[0].price)}) and the priciest is ${names(byPrice.at(-1).price)} (${won(byPrice.at(-1).price)}).`));
  }
  // 색 차이: 가장 비슷한 두 개를 기준으로 말한다
  let best = null;
  for (let x = 0; x < items.length; x++) {
    for (let y = x + 1; y < items.length; y++) {
      const d = deltaE2000(items[x].color_lab, items[y].color_lab);
      if (!best || d < best.d) best = { a: items[x], b: items[y], d };
    }
  }
  const lightest = [...items].sort((a, b) => b.color_lab.L - a.color_lab.L)[0];
  if (EN) {
    const feel = best.d < 5 ? 'are almost the same color' : best.d < 15 ? 'are in the same family but look different side by side' : 'have a different mood';
    lines.push(`${items.length > 2 ? 'The closest pair, ' : ''}${shortOf(best.a)} and ${shortOf(best.b)} ${feel}.`);
    lines.push(`The lightest, softest color is ${shortOf(lightest)}.`);
  } else {
    const feel = best.d < 5 ? '거의 같은 색이에요'
      : best.d < 15 ? '같은 계열이지만 나란히 보면 차이가 나요' : '분위기가 다른 색이에요';
    lines.push(`${items.length > 2 ? '그중 가장 비슷한 ' : ''}${josa(shortOf(best.a), '과', '와')} ${josa(shortOf(best.b), '은', '는')} ${feel}.`);
    lines.push(`가장 밝고 가벼운 색은 ${josa(shortOf(lightest), '이에요', '예요')}.`);
  }
  const moist = items.filter((p) => ['glossy', 'satin'].includes(p.finish));
  const lasting = items.filter((p) => ['matte', 'velvet'].includes(p.finish));
  if (moist.length && lasting.length) {
    lines.push(L(`촉촉함은 ${moist.map(shortOf).join(', ')}, 지속력은 ${lasting.map(shortOf).join(', ')} 쪽이에요.`,
      `For moisture go with ${moist.map(shortOf).join(', ')}; for staying power, ${lasting.map(shortOf).join(', ')}.`));
  }
  return lines.join(' ');
}

export function resultSuggestions(products, q, hasMore) {
  const mostlyGlossy = products.filter((p) => p.finish === 'glossy').length * 2 > products.length;
  const out = [];
  if (products.length) out.push(L('첫 번째 거 자세히 알려 줘', 'Tell me more about the first one'));
  if (products.length >= 2) out.push(L('그중에 제일 싼 거는?', 'Which is the cheapest of those?'));
  if (hasMore) out.push(L('더 보여 줘', 'Show more'));
  if (products.length >= 2) out.push(L('첫 번째랑 두 번째 비교해 줘', 'Compare the first and second'));
  if (products.length) out.push(q.finish === 'glossy' || mostlyGlossy ? L('매트한 걸로 바꿔 줘', 'Switch to matte') : L('글로시한 걸로 바꿔 줘', 'Switch to glossy'));
  return out.slice(0, 5);
}

const START_SUGGESTIONS_KO = ['데일리로 바를 립 추천해 줘', '데이트 립 추천해 줘', '입술이 건조한데 뭐가 좋아?', '2만원 이하 글로시한 코랄 추천해 줘'];
// 처음 질문 추천 (지금 답하는 언어로)
const startSuggestions = () => (EN ? START_SUGGESTIONS_EN : START_SUGGESTIONS_KO);

// 검색에 쓰는 환경(대상 제품·기준 제품·기준 색·방금 보여 준 제품·측정한 톤). answer() 와 LLM 층(searchProducts)이 같이 쓴다
function buildEnv({ baseProductId = null, selectedHex = null, context = null, tone = null, imageOnly = false }) {
  // 영어로 답할 때는 글로벌 올리브영 영어 이름이 있는 제품 안에서만 찾는다 (영어 이름을 지어내지 않고, 한국어 이름이 섞이지 않게)
  const products = (imageOnly ? allProducts().filter((p) => p.image_url) : allProducts()).filter((p) => !EN || p.name_en);
  const base = baseProductId ? findById(baseProductId) : null;
  const selHex = normalizeHex(selectedHex || '');
  const shown = ((context && typeof context === 'object' ? context.shown : null) || []).map(findById).filter(Boolean);
  const toneHint = TONES[tone] ? tone : null;
  let ref = null;
  if (base) ref = { hex: base.color_hex, label: L(`기준 제품(${shortName(base)}) 색상 ${base.color_hex}`, `the base product (${shortOf(base)}) ${base.color_hex}`) };
  else if (selHex) ref = { hex: selHex, label: L(`립 컬러 매핑 선택 색상 ${selHex}`, `your chosen color ${selHex}`) };
  return { products, base, ref, shown, toneHint };
}

/**
 * 규칙 챗봇과 같은 검색을 조건 객체로 직접 실행한다 (LLM 층의 search_products 도구가 쓴다).
 * @param {object} query parseMessage 결과와 같은 모양의 검색 조건 (finish, families, maxPrice, ...)
 */
export function searchProducts(query, input = {}) {
  return runSearch(query, buildEnv(input));
}

/** 규칙 챗봇이 아는 퍼스널 톤·상황·고민 이름 (LLM 도구 설명에 쓴다) */
export const CHAT_VOCAB = {
  tones: Object.keys(TONES),
  situations: SITUATIONS.map((s) => s.label),
  concerns: CONCERNS.map((x) => x.label),
};

// 영어로 브랜드를 부르는 이름들: 글로벌 표기(brand_en) + 말소리 별칭 중 영어 (예: 롬앤 ← rom&nd, romand)
function brandIndexEn(brands) {
  const en = new Map();
  const named = new Set(); // 영어 이름이 붙은 제품이 하나라도 있는 브랜드
  for (const p of allProducts()) {
    if (p.brand_en) en.set(p.brand, p.brand_en);
    if (p.name_en) named.add(p.brand);
  }
  return brands.map((ko) => ({
    ko,
    noEn: !named.has(ko),
    names: [...new Set([en.get(ko), ...(BRAND_ALIASES[ko] || []).filter((a) => /^[\x20-\x7e]+$/.test(a)), /^[\x20-\x7e]+$/.test(ko) ? ko : null].filter(Boolean))],
  }));
}

/**
 * @param {object} input
 * @param {string} input.message
 * @param {string} [input.baseProductId] 바코드 검색 등에서 전달된 기준 제품
 * @param {string} [input.selectedHex] 립 컬러 매핑에서 선택한 색상
 * @param {object} [input.context] 직전 대화 상태(이전 응답의 context 를 그대로 돌려준다)
 * @param {string} [input.tone] 립 컬러 매핑에서 측정한 퍼스널 톤(spring/summer/autumn/winter)
 * @param {'ko'|'en'} [input.lang] 묻고 답하는 언어 (영어면 chat-en.js 로 알아듣고 영어로 답한다)
 */
// imageOnly: 대표 이미지가 있는 제품만 추천 대상으로 쓴다 (테스트용 '이미지ver.' 버튼)
export function answer({ message, baseProductId = null, selectedHex = null, limit = 5, context = null, tone = null, imageOnly = false, lang = 'ko' }) {
  EN = lang === 'en';
  const { products, base, ref, shown, toneHint } = buildEnv({ baseProductId, selectedHex, context, tone, imageOnly });
  const brands = [...new Set(allProducts().map((p) => p.brand))];
  // 말·입력 보정: 한글 금액("만 오천 원")과 비슷한 발음("그로시" → "글로시")을 챗봇이 아는 말로 바꾼 뒤 해석한다 (영어는 그대로)
  const spoken = EN ? { text: String(message || '').trim(), corrections: [] } : normalizeForChat(message, brands);
  const heard = spoken.corrections.length
    ? `${spoken.corrections.map((x) => `'${x.to}'`).join(', ')}${euro(spoken.corrections.at(-1).to)} 알아들었어요. `
    : '';
  const c = EN ? parseMessageEn(spoken.text, brandIndexEn(brands), { situations: SITUATIONS }) : parseMessage(spoken.text, brands);
  const ctx = context && typeof context === 'object' ? context : {};
  // 기준 색상: 기준 제품 > 립 컬러 매핑 선택 색상 (buildEnv)
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
    unsure: !!o.unsure, // 규칙으로는 뜻을 못 잡은 답 (못 알아들음·막연한 불만·기준 색 없는 색 비교): LLM 층이 대신 답해 볼 수 있다
    context: o.context || ctx,
  });

  const q = searchPart(c);
  const isSearch = Object.keys(q).length > 0 || (c.mine && toneHint);

  // ---------- 방금 보여 드린 제품을 가리키는 질문 ("두 번째 거", "1번이랑 2번 비교") ----------
  if (c.ordinals) {
    if (!shown.length) {
      return out({ reply: L('아직 보여 드린 제품이 없어요. 찾는 립을 먼저 말씀해 주세요.', "I haven't shown any products yet. Tell me what lip you're looking for first."), suggestions: startSuggestions() });
    }
    const items = c.ordinals.map((i) => ({ i: i < 0 ? shown.length - 1 : i })).map(({ i }) => ({ i, p: shown[i] }));
    const missing = items.find((x) => !x.p);
    if (missing) {
      return out({ reply: L(`${ord(missing.i)} 제품은 없어요. 지금 목록은 ${shown.length}개예요.`, `There is no ${ord(missing.i)} product. The list has ${shown.length}.`), suggestions: [L('첫 번째 거 자세히 알려 줘', 'Tell me more about the first one')] });
    }
    if (items.length >= 2 || c.compare) {
      const pair = items.length >= 2 ? items.slice(0, 2) : [items[0], { i: items[0].i === 0 ? 1 : 0, p: shown[items[0].i === 0 ? 1 : 0] }];
      if (!pair[1].p) return out({ reply: L('비교하려면 제품이 두 개 이상 있어야 해요.', 'I need at least two products to compare.') });
      const [a, b] = pair;
      return out({
        reply: compareSummary([a.p, b.p]),
        products: [a.p, b.p],
        kind: 'compare',
        suggestions: EN ? [`Tell me more about the ${ord(a.i)} one`, `Tell me more about the ${ord(b.i)} one`, 'Show more'] : [`${ord(a.i)} 거 자세히 알려 줘`, `${ord(b.i)} 거 자세히 알려 줘`, '다른 거 더 보여 줘'],
      });
    }
    const { i, p } = items[0];
    if (c.pickBase) {
      return out({
        reply: L(`${josa(shortOf(p), '을', '를')} 기준 제품으로 정했어요. "더 저렴한 거", "비슷한 색"처럼 물어보세요.`, `${shortOf(p)} is now the base product. Try asking "something cheaper" or "similar colors".`),
        action: { type: 'setBase', id: p.id },
        suggestions: L(['비슷한 색상 찾아 줘', '더 저렴한 제품 추천해 줘', '더 밝은 색 추천해 줘'], ['Find similar colors', 'Something cheaper', 'A lighter shade']),
      });
    }
    const parts = [];
    if (c.askPrice && !c.askInfo) parts.push(L(`${josa(shortOf(p), '은', '는')} ${won(p.price)}이에요.`, `${shortOf(p)} is ${won(p.price)}.`));
    else if (c.askFinish && !c.askInfo) {
      parts.push(p.finish
        ? L(`${josa(shortOf(p), '은', '는')} ${finL(p.finish)} 제형이에요.`, `${shortOf(p)} has a ${finL(p.finish).toLowerCase()} finish.`)
        : L(`${josa(shortOf(p), '은', '는')} 제형 정보가 없어요. 상세 페이지에서 확인해 주세요.`, `There is no finish info for ${shortOf(p)}. Please check the details page.`));
    } else {
      // 설명(description)은 한국어로만 수집돼 영어 답에는 넣지 않는다
      parts.push(`${nameOf(p)} · ${p.finish ? `${finL(p.finish)} · ` : ''}${won(p.price)}.`, EN ? '' : p.description,
        p.color_options ? L(`${p.color_options}가지 색 중 대표색 기준이에요.`, `Shown in the representative shade of ${p.color_options}.`) : '');
      if (p.similarity !== undefined) parts.push(L(`${base ? '기준 제품' : '고른 색'}과 ${p.similarity}% 비슷해요.`, `${p.similarity}% similar to ${base ? 'the base product' : 'your color'}.`));
    }
    return out({
      reply: parts.filter(Boolean).join(' '),
      products: [p],
      suggestions: (EN
        ? [shown.length >= 2 ? `Compare the first and ${ord(i === 0 ? 1 : i)}` : null, 'Which is the cheapest of those?', 'Show more']
        : [shown.length >= 2 ? `첫 번째랑 ${ord(i === 0 ? 1 : i)} 비교해 줘` : null, '그중에 제일 싼 거는?', '다른 거 더 보여 줘']).filter(Boolean),
    });
  }

  // ---------- "그중에 제일 싼 거" (방금 보여 드린 목록 안에서) ----------
  const onlyRank = Object.keys(q).every((k) => k === 'superlative');
  if (c.superlative && shown.length && (c.among || onlyRank)) {
    const sorted = [...shown].sort((a, b) => (c.superlative === 'cheapest' ? a.price - b.price : b.price - a.price));
    const p = sorted[0];
    const i = shown.findIndex((x) => x.id === p.id);
    return out({
      reply: L(`가장 ${c.superlative === 'cheapest' ? '저렴한' : '비싼'} 건 ${ord(i)} ${josa(shortOf(p), '이에요', '예요')} (${p.finish ? `${finL(p.finish)} · ` : ''}${won(p.price)}).`,
        `The ${c.superlative === 'cheapest' ? 'cheapest' : 'priciest'} is the ${ord(i)} one, ${shortOf(p)} (${p.finish ? `${finL(p.finish)} · ` : ''}${won(p.price)}).`),
      products: [p],
      suggestions: L([`${ord(i)} 거 자세히 알려 줘`, '더 저렴한 걸로 더 보여 줘'], [`Tell me more about the ${ord(i)} one`, 'Show cheaper ones']),
    });
  }

  // ---------- 등록되지 않은 브랜드 ("샤넬 립 추천해 줘"): 다른 제품을 대신 내밀지 않는다 ----------
  if (c.unknownBrand) {
    const { brand: _, ...rest } = q;
    const phrase = EN ? phraseOfEn(rest) : phraseOf(rest);
    return out({
      reply: L(`'${c.unknownBrand}' 제품은 아직 등록되어 있지 않아요. 지금은 올리브영 립 제품 ${products.length}개(${brands.length}개 브랜드) 안에서 찾을 수 있어요.`,
        `${c.unknownBrand} isn't registered yet. I can search ${products.length} OLIVE YOUNG lip products from ${new Set(products.map((p) => p.brand)).size} brands.`),
      suggestions: [phrase, ...L(['데일리로 바를 립 추천해 줘', '2만원 이하 추천해 줘'], ['Recommend an everyday lip', 'Under 20,000 won'])].filter(Boolean),
    });
  }

  // ---------- 왜 이렇게 골랐는지 ----------
  if (c.why && !isSearch) {
    if (!ctx.lastConditions?.length) return out({ reply: L('아직 추천한 제품이 없어요. 찾는 립을 먼저 말씀해 주세요.', "I haven't recommended anything yet. Tell me what lip you're looking for first."), suggestions: startSuggestions() });
    const summary = ctx.query ? friendlySummary(ctx.query, env) : '';
    return out({
      reply: (EN
        ? `${summary ? `I picked them for: ${summary}. ` : ''}${(ctx.lastReasons || []).join(' ')} ${ref ? 'They are ordered by closeness to the reference color.' : ''}`
        : `${summary ? `'${summary}' 조건으로 골랐어요. ` : ''}${(ctx.lastReasons || []).join(' ')} ${ref ? '기준 색과 가까운 순서예요.' : ''}`).replace(/\s+/g, ' ').trim(),
      suggestions: L(['더 보여 줘', '그중에 제일 싼 거는?'], ['Show more', 'Which is the cheapest of those?']),
    });
  }

  // ---------- 더 보여 줘 (같은 조건으로 다음 결과) ----------
  if (c.more && !isSearch && ctx.query) {
    const offset = (ctx.offset || 0) + limit;
    const r = runSearch(ctx.query, env);
    const page = r.scored.slice(offset, offset + limit);
    if (!page.length) {
      return out({ reply: L('이 조건의 제품은 여기까지예요. 조건을 바꿔 보세요.', "That's all for these conditions. Try changing them."), suggestions: L(['글로시한 걸로 바꿔 줘', '더 저렴한 걸로', '데일리로 바를 립 추천해 줘'], ['Switch to glossy', 'Something cheaper', 'Recommend an everyday lip']) });
    }
    return out({
      reply: L(`다음 ${page.length}개예요 (${offset + 1}~${offset + page.length} / 전체 ${r.scored.length}개).`, `Here are ${page.length} more (${offset + 1}-${offset + page.length} of ${r.scored.length}).`),
      conditions: r.conditions, products: page, total: r.scored.length,
      suggestions: resultSuggestions(page, ctx.query, r.scored.length > offset + limit),
      context: { ...ctx, shown: page.map((p) => p.id), offset },
    });
  }

  // 기준 제품 정보 질문 (검색 조건이 없을 때)
  if (!isSearch && base && (c.askPrice || c.askFinish || c.askBarcode || c.askInfo)) {
    const parts = [];
    if (c.askPrice) parts.push(L(`${josa(shortOf(base), '은', '는')} ${won(base.price)}이에요.`, `${shortOf(base)} is ${won(base.price)}.`));
    if (c.askFinish) parts.push(base.finish ? L(`제형은 ${finL(base.finish)}이에요.`, `The finish is ${finL(base.finish).toLowerCase()}.`) : L('제형 정보는 수집되지 않았어요.', 'There is no finish info for it.'));
    if (c.askBarcode) parts.push(base.barcode ? L(`바코드 번호는 ${base.barcode}예요.`, `The barcode is ${base.barcode}.`) : L('이 제품은 바코드 정보가 없어요.', 'There is no barcode info for this product.'));
    if (c.askInfo) parts.push(L(`${josa(nameOf(base), '이에요', '예요')}.`, `This is ${nameOf(base)}.`), EN ? '' : base.description);
    return out({ reply: parts.filter(Boolean).join(' '), suggestions: L(['비슷한 색상 찾아 줘', '더 저렴한 제품 추천해 줘', '더 밝은 색 추천해 줘'], ['Find similar colors', 'Something cheaper', 'A lighter shade']) });
  }

  // ---------- 나에게 어울리는 립 (퍼스널 톤을 모를 때는 되묻는다) ----------
  if (c.mine && !c.tone && !toneHint && !q.families) {
    return out({
      reply: L('퍼스널 톤을 알려 주세요. 웜톤·쿨톤을 말하거나, 팔레트의 "내 톤으로 추천받기"로 재 볼 수 있어요.', 'Tell me your personal tone: warm or cool. You can also measure it with "Find my tone" on the palette.'),
      suggestions: L(['웜톤이야, 추천해 줘', '쿨톤이야, 추천해 줘', '봄 웜 립 추천해 줘', '겨울 쿨 립 추천해 줘'], ['I have a warm tone', 'I have a cool tone', 'Spring warm lips', 'Winter cool lips']),
    });
  }

  // ---------- 가벼운 대화: 되묻기보다 부드럽게 받아서 추천으로 잇는다 ----------
  let bridge = null; // { query, ack, unsure }: 검색 조건이 없는 말을 이 조건으로 대신 찾고, 답 앞에 ack 를 붙인다
  if (!isSearch) {
    const off = EN ? offTopicReplyEn(spoken.text) : offTopicReply(spoken.text.toLowerCase());
    if (off) return out(off);
    const mood = EN ? moodEn(spoken.text) : MOODS.find((m) => has(spoken.text, m.words));
    if (mood) bridge = { query: mood.query, ack: mood.ack };
  }
  if (!isSearch && !bridge) {
    const small = EN ? {
      greet: 'Hello! Tell me the color, price range or occasion (everyday, date, interview) you have in mind.',
      thanks: 'Let me know if you need anything else.',
      bye: 'Have a lovely day!',
      identity: "I'm Took, took's AI assistant. I'm not a person, and I'm not an external AI: I find matching lip products from the registered list using set rules.",
      help: 'For example: "a glossy coral under 20,000 won", "lips for an interview", "cool tone lips", "my lips are dry". After that, try "the cheapest of those", "tell me about the second one", "show more" or "no matte".',
      like: 'I can also find other colors or price ranges.',
      dislike: 'Oh, not quite right? Tell me what fell short (color, price or finish) and I will pick again.',
    }[c.small] : {
      greet: '안녕하세요. 찾는 색, 가격대, 바를 자리(데일리·데이트·면접)를 말씀해 주세요.',
      thanks: '더 필요한 게 있으면 말씀해 주세요.',
      bye: '좋은 하루 보내세요.',
      identity: 'took AI 도우미 툭이에요. 사람이 아니고, 외부 AI 가 아니라 등록된 립 제품에서 조건에 맞는 걸 정해진 규칙으로 찾아요.',
      help: '예: "2만원 이하 글로시한 코랄", "면접 립", "쿨톤 립", "입술이 건조해". 추천 뒤엔 "그중 제일 싼 거", "두 번째 거 자세히", "더 보여 줘", "매트 말고"도 돼요.',
      like: '다른 색이나 가격대도 찾아 드릴 수 있어요.',
      dislike: '앗, 마음에 안 드셨군요. 색, 가격, 제형 중 어떤 게 아쉬웠는지 말씀해 주시면 다시 골라 볼게요.',
    }[c.small];
    if (small) {
      const sugg = {
        like: shown.length ? L(['그중에 제일 싼 거는?', '다른 거 더 보여 줘'], ['Which is the cheapest of those?', 'Show more']) : startSuggestions(),
        dislike: L(['더 밝은 색 추천해 줘', '더 저렴한 걸로', '다른 거 보여 줘', '매트 말고 글로시로'], ['A lighter shade', 'Something cheaper', 'Show others', 'No matte, glossy instead']),
        bye: [],
      }[c.small] || startSuggestions();
      return out({ reply: small, suggestions: sugg, unsure: c.small === 'dislike' });
    }
    // 알아듣지 못한 말: "잘 못 알아들었어요" 대신 한마디 받고 무난한 립(측정한 톤이 있으면 그 톤)을 보여 준다.
    // 규칙이 뜻을 잡은 건 아니므로 unsure (LLM 층을 켜 두면 LLM 이 대신 답해 본다)
    bridge = {
      query: toneHint ? { mine: true } : { situations: ['데일리'] },
      ack: c.compare ? L('비교하려면 먼저 제품이 있어야 해요. 무난한 립부터 보여 드릴게요.', 'I need products to compare first. Here are some easy picks.')
        : toneHint ? L('좋아요, 그럼 측정한 톤에 어울리는 립으로 골라 볼게요.', 'Okay, let me pick lips that suit your measured tone.')
          : (EN ? GENERIC_ACKS_EN : GENERIC_ACKS)[spoken.text.length % GENERIC_ACKS.length],
      unsure: true,
    };
  }

  // ---------- 조건 검색 (이전 조건에 이어서 바꾸는 말이면 합친다: "글로시한 걸로", "매트 말고") ----------
  let query = bridge ? bridge.query : q;
  if (!bridge && ctx.query && (c.refine || (!q.families && !q.tone && !q.situations && !q.concerns && !q.brand && (q.finish || q.price || q.maxPrice || q.minPrice || q.exclude || q.lightness)))) {
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
  const nextCtx = { query, shown: page.map((p) => p.id), offset: 0, lastConditions: r.conditions, lastReasons: r.reasons, turn: (ctx.turn || 0) + 1, lastOpener: ctx.lastOpener || null, lastCloser: ctx.lastCloser || null };

  let reply;
  let suggestions;
  if (r.onlyUnmetColor) {
    reply = r.notes.join(' ');
    suggestions = startSuggestions();
  } else if (total === 0) {
    const hint = relaxHint(query, env);
    const summary = friendlySummary(query, env);
    reply = EN
      ? `No products match ${summary ? `"${summary}"` : 'that'}. ${hint ? hint.text : 'Try asking with fewer conditions.'}`
      : `${summary ? `'${summary}' 조건에 ` : ''}맞는 제품이 없어요. ${hint ? hint.text : '조건을 줄여서 다시 물어봐 주세요.'}`;
    suggestions = [hint?.phrase, ...L(['데일리로 바를 립 추천해 줘', '2만원 이하 추천해 줘'], ['Recommend an everyday lip', 'Under 20,000 won'])].filter(Boolean);
  } else {
    // 말투: 인사·감탄과 "몇 개 찾았어요" 같은 보고 없이, 첫 문장에 가장 추천하는 제품과 핵심 정보(제형·가격·유사도)를 둔다.
    // 이유는 한 문장만. 개수는 목록과 '더 보여 줘'가 대신 보여 준다
    const top = page[0];
    reply = (EN
      ? `My top pick is ${shortOf(top)} (${top.finish ? `${finL(top.finish)} · ` : ''}${won(top.price)}`
        + (top.similarity !== undefined ? ` · ${top.similarity}% similar to ${base ? 'the base product' : 'your color'}).` : ').')
      : `${josa(shortOf(top), '을', '를')} 가장 추천해요 (${top.finish ? `${finL(top.finish)} · ` : ''}${won(top.price)}`
        + (top.similarity !== undefined ? ` · ${base ? '기준 제품' : '고른 색'}과 ${top.similarity}% 비슷).` : ').'))
      + (r.reasons.length ? ' ' + r.reasons[0] : '')
      + (r.tips.length ? ' ' + r.tips[0] : '')
      + (r.notes.length ? ' ' + r.notes.join(' ') : '');
    suggestions = resultSuggestions(page, query, total > limit);
    // 여는 말·마무리 말: 되묻는 이음말(bridge)이 없을 때만. 이유·팁·안내가 붙은 답은 이미 길어서 마무리 말은 생략 (휴대폰 한 화면 2~3문장)
    if (!bridge) {
      const open = openerFor(q, env, ctx, !!(c.mine && toneHint));
      if (open) { reply = `${open} ${reply}`; nextCtx.lastOpener = open; }
      if (!r.reasons.length && !r.tips.length && !r.notes.length && total > 1) {
        const close = closerFor(query, ctx);
        if (close) { reply = `${reply} ${EN ? close.en : close.ko}`; nextCtx.lastCloser = close.ko; }
      }
    }
  }
  if (bridge) reply = `${bridge.ack} ${reply}`;
  return out({ reply, conditions: r.conditions, products: page, total, suggestions, context: nextCtx, unsure: r.onlyUnmetColor || !!bridge?.unsure });
}
