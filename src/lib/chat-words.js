// 규칙 챗봇: 단어 사전 (제형·색 계열·퍼스널 톤·입술 고민·색 이름·기분 말 등). 문장 해석과 검색이 같이 쓴다.
import { SITUATIONS } from './situations.js';

export const has = (text, words) => words.some((w) => text.includes(w));

export const FINISH_WORDS = {
  glossy: ['글로시', '글로스', '촉촉', '윤기', '광택', '물광', 'gloss'], // gloss 는 glossy 도 포함
  matte: ['매트', '보송', 'matte'],
  satin: ['새틴', 'satin'],
  velvet: ['벨벳', 'velvet'],
};
// 음성 인식이 영어로 받아 적는 경우도 있어 영어 색 이름도 함께 둔다

export const FAMILY_WORDS = {
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
export const TONES = {
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
export const CONCERNS = [
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
export const COLOR_NAMES = [
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
export const AVOID_FINISHES = [
  { words: ['번들', '끈적', '기름져', '번쩍', '광 싫', '광택 싫', '반짝이는 건'], finishes: ['glossy'] },
  { words: ['텁텁', '각질 부각', '갈라져 보', '건조해 보이는'], finishes: ['matte', 'velvet'] },
];

// ---------- 잡담도 부드럽게 받는다 ("졸려" → "졸리시다구요? 그럼 혈색이 좋아 보이는 립 추천해 드릴게요") ----------
// 기분·상태 말 → 한마디 받아 주고 그에 맞는 조건으로 추천한다 (검색 조건이 없는 말일 때만)
export const MOODS = [
  { words: ['졸려', '졸리', '잠 와', '잠와', '잠이 와', '하품'], ack: '졸리시군요. 그럼 혈색이 좋아 보이는 립을 골라 드릴게요.', query: { concerns: ['혈색 있는'] } },
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
export const GENERIC_ACKS = [
  '그렇군요! 그럼 오늘 바르기 좋은 립을 하나 골라 볼게요.',
  '알려 주셔서 고마워요. 그럼 부담 없이 바르기 좋은 색부터 보여 드릴게요.',
  '좋아요, 그럼 데일리로 무난한 립으로 골라 볼게요.',
];

// 개인정보 패턴: 휴대폰 번호, 이메일, 주민등록번호 (hybridAnswer 도 같은 패턴이면 LLM 에 보내지 않는다)
export const PII_RE = /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}|[\w.+-]+@[\w-]+\.[\w.]+|\d{6}[-\s]?[1-4]\d{6}/;

export const OTHER_CATEGORIES = ['선크림', '썬크림', '선블록', '아이섀도', '섀도', '마스카라', '파운데이션', '쿠션', '컨실러', '토너', '로션',
  '향수', '샴푸', '네일', '블러셔', '아이라이너', '브로우'];
export const UNSUPPORTED_COLORS = ['초록', '녹색', '파랑', '파란', '하늘색', '노랑', '노란', '검정', '검은', '블랙', '흰색', '화이트', '회색', '민트'];

// 등록되지 않은 유명 브랜드: 물어보면 다른 제품을 내밀지 않고 등록되어 있지 않다고 말한다 (DB 에 있는 브랜드는 빼고 쓴다)
export const OTHER_BRANDS = ['샤넬', '디올', '입생로랑', '생로랑', '나스', '톰포드', '에스티로더', '에스티 로더', '랑콤', '지방시', '아르마니',
  '겔랑', '바비브라운', '바비 브라운', '설화수', '이니스프리', '미샤', '메이블린', '로레알', '슈에무라', '조말론',
  'chanel', 'dior', 'ysl', 'nars', 'tom ford', 'lancome', 'givenchy', 'armani', 'maybelline'];

/** 규칙 챗봇이 아는 퍼스널 톤·상황·고민 이름 (LLM 도구 설명에 쓴다) */
export const CHAT_VOCAB = {
  tones: Object.keys(TONES),
  situations: SITUATIONS.map((s) => s.label),
  concerns: CONCERNS.map((x) => x.label),
};
