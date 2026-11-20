// 챗봇 영어판 (서버/브라우저 공용, 외부 의존성 없음).
// - parseMessageEn: 영어 문장에서 한국어판 parseMessage 와 '같은 모양'의 조건을 뽑는다. 상황·고민 이름은 한국어 키(situations.js 의 label)를
//   그대로 써서, 검색·추천·이어지는 질문 로직은 한국어판과 똑같이 돈다
// - EN_TEXT: 상황·톤·고민·기분의 영어 이름·이유·요령, 잡담·범위 밖 답 (chat.js 가 영어로 답할 때 쓴다)
// 제품 사실(이름·가격·제형)은 늘 DB 에서 나오고, 영어 제품명은 글로벌 올리브영에서 짝지은 name_en 을 쓴다

const FINISH_WORDS = {
  glossy: ['glossy', 'gloss', 'shiny', 'shine', 'glassy', 'glass', 'juicy', 'wet look', 'dewy', 'moist', 'moisturizing', 'hydrating', 'watery', 'jelly',
    'lip oil', 'glow', 'glowy', 'glowing', 'tanghulu', 'candy coated', 'plush shine'], // 2026-11-20
  matte: ['matte', 'matt', 'powdery', 'blur', 'blurry', 'blurring', 'blurred', 'soft focus', 'soft-focus'],
  satin: ['satin', 'semi-matte', 'semi matte'],
  velvet: ['velvet', 'velvety'],
};
const FAMILY_WORDS = {
  red: ['red', 'scarlet', 'crimson'],
  pink: ['pink', 'baby pink', 'hot pink', 'fuchsia'],
  coral: ['coral'],
  orange: ['orange'],
  nude: ['nude', 'beige', 'mlbb'],
  brown: ['brown'],
  rose: ['rose', 'rosy', 'dusty rose'],
  berry: ['berry'],
  plum: ['plum', 'purple', 'violet'],
  burgundy: ['burgundy', 'maroon', 'oxblood'],
};
const COLOR_NAMES = [
  { words: ['brick', 'terracotta'], families: ['brown', 'orange', 'red'] },
  { words: ['cherry'], families: ['red', 'berry'] },
  { words: ['wine'], families: ['burgundy', 'berry', 'plum'] },
  { words: ['tomato'], families: ['red', 'orange'] },
  { words: ['peach', 'peachy', 'apricot'], families: ['coral', 'orange'] },
  { words: ['strawberry'], families: ['pink', 'red'] },
  { words: ['cherry blossom', 'sakura'], families: ['pink'] },
  { words: ['mauve'], families: ['rose', 'plum'] },
  { words: ['dried rose', 'rosewood'], families: ['rose', 'brown'] },
  { words: ['chocolate', 'caramel', 'mocha', 'cinnamon'], families: ['brown'] },
  // 2026-11-20
  { words: ['raspberry', 'blueberry'], families: ['berry'] },
  { words: ['magenta'], families: ['pink', 'berry'] },
  { words: ['plum color', 'grape'], families: ['berry', 'plum'] },
  { words: ['tangerine', 'mandarin', 'grapefruit'], families: ['orange', 'coral'] },
  { words: ['watermelon'], families: ['pink', 'red'] },
];
const AVOID_FINISHES = [
  { words: ['sticky', 'greasy', 'oily', 'too shiny'], finishes: ['glossy'] },
  { words: ['drying', 'cakey', 'shows flakes'], finishes: ['matte', 'velvet'] },
];

// 상황 (한국어 label → 영어 단어·이름·이유·요령)
export const SITUATIONS_EN = {
  '데일리': { words: ['daily', 'everyday', 'every day', 'work', 'office', 'school', 'casual', 'go-to'], label: 'Everyday',
    reason: 'For everyday wear, nude, rose and coral shades with a soft finish are easy to wear.' },
  '면접': { words: ['interview', 'job interview', 'first day at work', 'internship'], label: 'Interview',
    reason: 'For an interview, nude, rose or coral shades that add just a hint of color look neat.',
    tip: 'Apply a thin layer so it does not look shiny, and clean up the lip line.' },
  '단정한 자리': { words: ['meeting', 'business', 'formal', 'presentation', 'conference', 'professional', 'client'], label: 'Formal occasion',
    reason: 'For formal occasions, nude, rose and brown shades stay understated.' },
  '상견례': { words: ['meeting the parents', 'meet the parents', 'meet my parents', 'in-laws', 'in laws'], label: 'Meeting the family',
    reason: 'Rose and coral shades look bright yet polite when meeting the family.',
    tip: 'A healthy flush of color works better than a very deep shade.' },
  '데이트': { words: ['date', 'first date', 'blind date', 'anniversary', 'romantic', 'dating', 'valentine', "valentine's"], label: 'Date',
    reason: 'For a date, pink, rose and coral with a glossy finish look lively.' },
  '내 결혼식': { words: ['my wedding', 'bride', 'bridal', 'wedding photoshoot', 'wedding shoot', 'wedding photos'], label: 'My wedding',
    reason: 'Rose and pink shades that photograph clearly are popular on the wedding day.',
    tip: 'Pick a long-lasting formula and keep one with you for touch-ups.' },
  '결혼식 하객': { words: ['wedding', 'wedding guest'], label: 'Wedding guest',
    reason: 'As a wedding guest, rose, pink and coral are pretty without being too much.',
    tip: 'Skip deep reds so you do not stand out more than the bride.' },
  '장례식': { words: ['funeral', 'memorial', 'condolence'], label: 'Funeral',
    reason: 'For a funeral, keep it very calm with nude or brown close to your lip color.',
    tip: 'A thin, non-shiny layer that is barely visible is enough.' },
  '졸업식·입학식': { words: ['graduation', 'commencement', 'entrance ceremony'], label: 'Graduation',
    reason: 'Pink and coral shades look fresh in graduation photos.' },
  '증명·프로필 사진': { words: ['id photo', 'passport photo', 'profile photo', 'profile picture', 'headshot', 'resume photo'], label: 'ID / profile photo',
    reason: 'Rose and coral with clear color work well for ID and profile photos.',
    tip: 'Color looks lighter on camera, so go one shade deeper than usual.' },
  '페스티벌·콘서트': { words: ['festival', 'concert', 'fan meeting', 'gig'], label: 'Festival / concert',
    reason: 'Vivid red, pink and coral stand out even from a distance at festivals.',
    tip: 'Sweat and drinks wear it off easily, so a long-lasting formula helps.' },
  '파티·행사': { words: ['party', 'year-end', 'event', 'gathering', 'gala', 'awards', 'dinner party'], label: 'Party / event',
    reason: 'Red, burgundy and berry shades look great in party photos.' },
  '명절·가족 모임': { words: ['chuseok', 'lunar new year', 'family gathering', 'relatives', 'thanksgiving', 'family dinner'], label: 'Family gathering',
    reason: 'Relaxed rose and coral shades are easy for family gatherings.',
    tip: 'You will be eating, so a formula that is easy to reapply is handy.' },
  '운동·야외': { words: ['workout', 'gym', 'hiking', 'camping', 'running', 'picnic', 'golf', 'tennis', 'outdoor', 'outdoors'], label: 'Workout / outdoors',
    reason: 'Natural coral and pink shades look healthy outdoors.',
    tip: 'Apply a thin layer of a long-lasting formula so sweat does not smudge it.' },
  '여행': { words: ['travel', 'trip', 'vacation', 'beach', 'resort', 'holiday trip'], label: 'Travel',
    reason: 'Bright coral and orange shades look radiant on a trip.' },
  '봄': { words: ['spring'], label: 'Spring', reason: 'Light, bright coral and pink shades suit spring.' },
  '여름': { words: ['summer'], label: 'Summer', reason: 'Fresh coral and orange shades suit summer.' },
  '가을': { words: ['fall', 'autumn'], label: 'Fall', reason: 'Deep brown and burgundy with a soft matte finish suit fall.' },
  '겨울': { words: ['winter', 'christmas'], label: 'Winter', reason: 'Deep red, burgundy and plum shades suit winter.' },
};

export const TONES_EN = {
  spring: { words: ['spring warm', 'warm spring', 'spring tone', 'spring bright', 'bright spring', 'spring light', 'light spring'], label: 'Spring Warm', reason: 'Clear coral, peach and orange shades suit spring warm tones.' },
  summer: { words: ['summer cool', 'cool summer', 'summer tone', 'summer light', 'light summer', 'summer mute', 'soft summer'], label: 'Summer Cool', reason: 'Soft pink, rose and light berry shades suit summer cool tones.' },
  autumn: { words: ['autumn warm', 'fall warm', 'warm autumn', 'autumn tone', 'fall tone', 'autumn deep', 'deep autumn', 'autumn mute', 'soft autumn'], label: 'Autumn Warm', reason: 'Deep, warm brick, brown and terracotta shades suit autumn warm tones.' },
  winter: { words: ['winter cool', 'cool winter', 'winter tone', 'winter deep', 'deep winter', 'winter bright', 'bright winter'], label: 'Winter Cool', reason: 'Vivid red, berry and plum shades suit winter cool tones.' },
  warm: { words: ['warm tone', 'warm undertone', 'warm skin', 'warm toned', "i'm warm", 'i am warm'], label: 'Warm tone', reason: 'Coral, orange and brown shades with a yellow base suit warm tones.' },
  cool: { words: ['cool tone', 'cool undertone', 'cool skin', 'cool toned', "i'm cool", 'i am cool'], label: 'Cool tone', reason: 'Pink, rose and berry shades with a blue base suit cool tones.' },
};

export const CONCERNS_EN = {
  '건조한 입술': { words: ['dry', 'flaky', 'chapped', 'peeling', 'cracked', 'lip wrinkles', 'lines on my lips', 'fine lines'], label: 'Dry lips', reason: 'Glossy or satin finishes hide dry patches better than matte.' },
  '오래 가는': { words: ['long-lasting', 'long lasting', 'lasts long', 'last long', 'all day', 'transfer-proof', 'transfer proof', 'smudge-proof', 'smudge proof', "won't come off", 'kiss-proof', 'mask', 'stays on', "won't transfer", 'no transfer', 'cup', 'stains well', 'long stain'], label: 'Long-lasting', reason: 'Matte and velvet finishes tend to last longer.' },
  '자연스러운': { words: ['natural', 'subtle', 'no-makeup', 'no makeup', 'effortless', 'lively', 'bare face', 'bare-faced', 'little color', 'hint of color', 'sheer wash', 'barely-there'], label: 'Natural', reason: 'Nude, rose and coral shades close to your lip color look natural.' },
  '강렬한': { words: ['bold', 'statement', 'intense', 'striking', 'strong color', 'sexy', 'sultry', 'seductive', 'chic', 'fierce'], label: 'Bold', reason: 'Vivid red, burgundy and berry shades make a statement.' },
  '화사한': { words: ['bright', 'cute', 'lovely', 'youthful', 'fresh', 'playful', 'juicy look', 'look younger', 'look young'], label: 'Bright', reason: 'Pink and coral shades give a bright, lovely look.' },
  '선물': { words: ['gift', 'present'], label: 'Gift', reason: 'Easy-to-wear nude, rose and coral shades are a safe gift.' },
  '혈색 있는': { words: ['healthy glow', 'flush', 'pale', 'washed out', 'look tired', 'sickly', 'color to my face'], label: 'Healthy flush', reason: 'Pink, coral and rose shades bring life to your face.' },
  '입술색 같은': { words: ['my lip color', 'my natural lip', 'like my lips', 'barely there', 'my own lips'], label: 'Like your lips', reason: 'Nude, rose and soft pink look like your own lips.' },
  '차분한': { words: ['calm', 'muted', 'toned-down', 'toned down', 'understated', 'not too bright', 'subdued'], label: 'Calm', reason: 'Nude, rose and brown shades stay calm and understated.' },
  '발색 좋은': { words: ['pigmented', 'vivid', 'color payoff', 'one swipe', 'opaque'], label: 'Pigmented', reason: 'Deep red, burgundy and berry shades show up in one swipe.' },
  '사진에 잘 나오는': { words: ['photo', 'photos', 'selfie', 'selfies', 'camera', 'pictures'], label: 'Photogenic', reason: 'Saturated red, berry and pink shades make lips pop in photos.' },
  '호감 가는': { words: ['boyfriend', 'girlfriend', 'crush', 'likable', 'innocent', 'first impression'], label: 'Likable', reason: 'Soft pink, rose and coral give a friendly impression.' },
  // 2026-11-20: 피부·나이·입술 모양·착색 (한국어판 chat-words.js 와 같은 키)
  '어두운 피부': { words: ['dark skin', 'darker skin', 'deep skin', 'tan skin', 'tanned skin', 'tanned', 'olive skin', 'brown skin', 'skin is dark', 'skin is tan'], label: 'Deeper skin',
    reason: 'Deep brick, brown and berry shades show up clearly on deeper skin.' },
  '밝은 피부': { words: ['fair skin', 'light skin', 'skin is fair', 'skin is light', 'porcelain skin', 'very fair', 'really fair', 'fair-skinned', 'fair complexion'], label: 'Fair skin',
    reason: 'Clear pink, rose and coral shades bring out a pretty flush on fair skin.' },
  '노란 피부': { words: ['yellow undertone', 'yellow undertones', 'yellowish skin', 'sallow', 'golden undertone'], label: 'Yellow undertone',
    reason: 'Warm coral, orange and brown shades suit a yellow undertone.' },
  '학생': { words: ['teenager', 'teen', 'teens', 'high school', 'middle school', 'student', 'students'], label: 'Student',
    reason: 'Light pink and coral shades look fresh and natural for students.' },
  '우아한': { words: ['in her 40s', 'in her 50s', 'in her 60s', 'my 40s', 'my 50s', 'middle-aged', 'mature skin', 'elegant', 'sophisticated', 'look old', 'look older', 'for my mom', 'for mom', 'my mother'], label: 'Elegant',
    reason: 'Rose, nude and coral with a moist finish look elegant and soften the lip texture.' },
  '도톰해 보이는': { words: ['thin lips', 'lips are thin', 'fuller', 'plump', 'plumper', 'plumping', 'volume', 'bigger lips', 'small lips'], label: 'Fuller-looking',
    reason: 'A glossy finish catches the light and makes lips look fuller.' },
  '칙칙한 입술': { words: ['dull', 'dark lips', 'lips are dark', 'lip pigmentation', 'discolored', 'uneven lip color'], label: 'Dull lips',
    reason: 'Pigmented coral and pink shades layered once more brighten dull or dark lips.' },
  '착색 걱정': { words: ["doesn't stain", "don't stain", 'no stain', 'non-staining', 'not stain', 'without staining', 'no staining'], label: 'No staining',
    reason: 'Glossy and satin finishes tend to leave less stain than water tints.' },
};

// 기분·잡담 → 한마디 받고 그에 맞는 조건으로 추천 (query 는 한국어판과 같은 키)
const MOODS_EN = [
  { words: ['sleepy', 'tired', 'exhausted', 'worn out', 'no energy'], ack: 'Feeling tired? Let me find a lip that gives you a healthy flush.', query: { concerns: ['혈색 있는'] } },
  { words: ['hungry', 'starving', 'lunch', 'dinner', 'snack'], ack: 'Hungry? Let me pick lips that stay on even after eating.', query: { concerns: ['오래 가는'] } },
  { words: ['bored', 'boring'], ack: 'Bored? How about trying a bold color for a change?', query: { concerns: ['강렬한'] } },
  { words: ['sad', 'down', 'upset', 'depressed', 'stressed', 'annoyed', 'gloomy'], ack: 'A bright color can lift your mood. How about these?', query: { concerns: ['화사한'] } },
  { words: ['happy', 'excited', 'great day', 'good mood'], ack: 'A good day! Lively colors will suit you.', query: { concerns: ['화사한'] } },
  { words: ["it's hot", 'so hot', 'hot today', 'too hot'], ack: 'On hot days, fresh colors feel nice.', query: { situations: ['여름'] } },
  { words: ["it's cold", 'so cold', 'cold today', 'freezing'], ack: 'On cold days, how about warm, deep colors?', query: { situations: ['겨울'] } },
  { words: ['raining', 'rainy', 'rain'], ack: 'Calm colors look lovely on rainy days.', query: { concerns: ['차분한'] } },
  { words: ['busy', 'in a hurry', 'no time', 'rushing'], ack: 'When you are busy, a lip that shows up in one swipe is handy.', query: { concerns: ['발색 좋은'] } },
  { words: ['look pretty', 'look prettier', 'look good'], ack: 'You already look great, but here are colors that brighten your face.', query: { concerns: ['호감 가는'] } },
  // 2026-11-20: 막연하게 골라 달라는 말 (그 말만 했을 때만, alone), 취향, 웃음
  { words: ['just pick', 'pick something', 'pick one', 'pick for me', 'choose for me', 'you choose', 'you pick', 'surprise me', 'anything is fine', 'anything works', 'whatever', 'no idea', "don't know what"],
    ack: "Sure, I'll pick first. Here are easy-to-wear colors that suit almost anyone.", query: { situations: ['데일리'] }, alone: true },
  { words: ['your favorite', 'your favourite', 'what do you like'], ack: "I can't see colors myself, but rose and coral are easy picks many people love.", query: { families: ['rose', 'coral'] } },
  { words: ['lol', 'haha', 'hehe', 'lmao'], ack: 'Sounds like a fun day! Bright colors suit a good mood.', query: { concerns: ['화사한'] } },
];
export const GENERIC_ACKS_EN = [
  "I didn't quite catch that. For now, here is a lip that is nice to wear today.",
  "I'm not sure I understood. Here are some easy-to-wear colors to start.",
  "I didn't quite catch that, so here are some everyday lips first.",
];

export const START_SUGGESTIONS_EN = ['Recommend an everyday lip', 'Recommend a lip for a date', 'My lips are dry. What should I use?', 'A glossy coral under 20,000 won'];

const UNKNOWN_BRANDS = ['chanel', 'dior', 'ysl', 'saint laurent', 'nars', 'tom ford', 'estee lauder', 'lancome', 'givenchy', 'armani', 'guerlain',
  'bobbi brown', 'sulwhasoo', 'innisfree', 'missha', 'maybelline', "l'oreal", 'loreal', 'shu uemura', 'jo malone', 'fenty', 'rare beauty', 'charlotte tilbury'];
const OTHER_CATEGORIES = ['sunscreen', 'sunblock', 'eyeshadow', 'eye shadow', 'mascara', 'foundation', 'cushion', 'concealer', 'toner', 'lotion',
  'perfume', 'shampoo', 'nail polish', 'blusher', 'eyeliner', 'eyebrow', 'skincare', 'serum', 'moisturizer', 'cleanser'];
const UNSUPPORTED_COLORS = ['green', 'blue', 'yellow', 'black', 'white', 'gray', 'grey', 'mint'];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// 단어 경계로 찾는다 ("cool" 이 "school" 안에서 걸리지 않게). 복수형 s 도 받는다
const wordRe = (w) => new RegExp(`(^|[^a-z0-9])${esc(w)}s?(?![a-z0-9])`);
const has = (text, words) => words.some((w) => wordRe(w).test(text));
// "no matte", "not red", "without glossy", "anything but red", "matte is not for me", "i don't like red" → 빼는 조건
// "velvet over glossy" 의 over 도 '보다'(뒤엣것은 빼는 쪽)로 본다
const NEG_BEFORE = "(?:no|not|without|except|but|over|other than|instead of|rather than|hate|avoid|don't like|dont like|don't want|dont want|nothing)";
const negated = (text, w) => new RegExp(`(^|[^a-z])${NEG_BEFORE}\\s+(?:any\\s+|too\\s+|a\\s+|the\\s+|so\\s+)?${esc(w)}s?(?![a-z])`).test(text)
  || new RegExp(`(^|[^a-z])${esc(w)}s?\\s+(?:is\\s+|are\\s+)?(?:not for me|no thanks|please no)`).test(text);

/** 영어 금액: "under 20,000 won", "below ₩15000", "less than 15k", "over 30000", "20000 won or less" → 원 */
function parsePriceEn(text) {
  const out = {};
  const AMT = '(?:₩|krw\\s*)?(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k|thousand)?\\s*(?:won|krw)?';
  const num = (n, unit) => Math.round(Number(n.replace(/,/g, '')) * (unit ? 1000 : 1));
  const max = text.match(new RegExp(`(under|below|less than|up to|max(?:imum)?|within|no more than|cheaper than)\\s*${AMT}`))
    || text.match(new RegExp(`${AMT}\\s*(or less|or under|or below|max)`));
  if (max) {
    const [n, unit] = max[1] && /\d/.test(max[1]) ? [max[1], max[2]] : [max[2], max[3]];
    const v = num(n, unit);
    if (v >= 1000) out.maxPrice = { value: v, strict: /less than|cheaper than/.test(max[0]) };
  }
  const min = text.match(new RegExp(`(over|above|more than|at least|from|starting at)\\s*${AMT}`))
    || text.match(new RegExp(`${AMT}\\s*(or more|or above|and up|plus)`));
  if (min) {
    const [n, unit] = min[1] && /\d/.test(min[1]) ? [min[1], min[2]] : [min[2], min[3]];
    const v = num(n, unit);
    if (v >= 1000) out.minPrice = { value: v, strict: /over|above|more than/.test(min[0]) };
  }
  // "around 30000 won": 위아래 20% 안 (한국어판 '만원대' 처럼 범위로 본다)
  const near = !max && !min && text.match(new RegExp(`(around|about|approximately|roughly|near)\\s*${AMT}`));
  if (near) {
    const v = num(near[2], near[3]);
    if (v >= 1000) {
      out.minPrice = { value: Math.round(v * 0.8), strict: false };
      out.maxPrice = { value: Math.round(v * 1.2), strict: false };
    }
  }
  return out;
}

const ORD_WORDS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const ORD_NUM = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
function parseOrdinalsEn(text) {
  const found = [];
  const notOrd = /(first|second)\s+(date|day|time|impression|anniversary|job|interview|meeting)/; // "first date" 는 순번이 아니다 (2026-11-20)
  ORD_WORDS.forEach((w, i) => { const m = text.search(wordRe(w)); if (m >= 0 && !notOrd.test(text.slice(m, m + 30))) found.push({ i, at: m }); });
  // "the previous one", "go back to that one" → 첫 번째(가장 추천한) 제품 (한국어판 '아까 그거'와 같다)
  { const m = text.search(/previous one|the one before|go back to (that|the) one/); if (m >= 0) found.push({ i: 0, at: m }); }
  ORD_NUM.forEach((w, i) => { const m = text.search(wordRe(w)); if (m >= 0) found.push({ i, at: m }); });
  const last = text.search(/(^|[^a-z])last(?![a-z])/);
  if (last >= 0) found.push({ i: -1, at: last });
  for (const m of text.matchAll(/(?:number|no\.?|#|item|option)\s*(\d{1,2})(?!\d)/g)) if (Number(m[1]) >= 1) found.push({ i: Number(m[1]) - 1, at: m.index });
  // 같은 자리에서 두 번 잡힌 것("1st" 와 "first" 가 겹치지는 않지만 안전하게)은 하나로
  const seen = new Set();
  return found.sort((a, b) => a.at - b.at).filter((x) => (seen.has(x.at) ? false : seen.add(x.at))).map((x) => x.i);
}

/**
 * 영어 문장 → 조건 (한국어판 parseMessage 와 같은 모양).
 * @param {string} message
 * @param {{ ko: string, names: string[], noEn?: boolean }[]} brandIndex DB 브랜드(한국어)와 영어로 부르는 이름들 (brand_en, 말소리 별칭).
 *   noEn: 영어 이름이 있는 제품이 없는 브랜드 → 영어판에서는 '등록되지 않은 브랜드'로 안내한다
 * @param {{ situations: object[] }} data 한국어판 SITUATIONS (overrides 를 같이 쓴다)
 */
export function parseMessageEn(message, brandIndex = [], { situations = [] } = {}) {
  const text = ' ' + String(message || '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim() + ' ';
  const c = {};
  const exclude = { finishes: [], families: [] };
  for (const [finish, words] of Object.entries(FINISH_WORDS)) {
    const hit = words.filter((w) => wordRe(w).test(text));
    if (!hit.length) continue;
    if (hit.some((w) => negated(text, w))) exclude.finishes.push(finish);
    else if (!c.finish) c.finish = finish;
  }
  const families = [];
  let namedColor = false;
  for (const { words, families: fams } of COLOR_NAMES) {
    const hit = words.filter((w) => wordRe(w).test(text));
    if (!hit.length) continue;
    namedColor = true;
    const target = hit.some((w) => negated(text, w)) ? exclude.families : families;
    for (const f of fams) if (!target.includes(f)) target.push(f);
  }
  for (const [family, words] of Object.entries(FAMILY_WORDS)) {
    // "cherry blossom" 의 blossom 처럼 색 이름에 이미 쓴 말, "rose" 가 "rosewood" 안에 있는 경우는 단어 경계가 막아 준다
    const hit = words.filter((w) => wordRe(w).test(text));
    if (!hit.length) continue;
    if (hit.some((w) => negated(text, w))) { if (!exclude.families.includes(family)) exclude.families.push(family); } else if (!families.includes(family)) families.push(family);
  }
  for (const { words, finishes } of AVOID_FINISHES) {
    if (has(text, words)) for (const f of finishes) if (c.finish !== f && !exclude.finishes.includes(f)) exclude.finishes.push(f);
  }
  if (families.length) c.families = families.filter((f) => !exclude.families.includes(f));
  if (c.families && !c.families.length) delete c.families;
  if (exclude.finishes.length || exclude.families.length) c.exclude = exclude;

  // 가격: '가장 싼' 이 먼저, 그다음 '싼/비싼'
  if (has(text, ['cheapest', 'least expensive', 'lowest price', 'most affordable'])) c.superlative = 'cheapest';
  else if (has(text, ['most expensive', 'priciest', 'highest price', 'most luxurious'])) c.superlative = 'priciest';
  else if (has(text, ['expensive', 'pricier', 'luxury', 'luxurious', 'premium', 'high-end', 'high end', 'fancy', 'designer'])) c.price = 'pricier';
  else if (has(text, ['cheap', 'cheaper', 'affordable', 'budget', 'inexpensive', 'low price', 'lower price', 'less expensive', 'good value'])) c.price = 'cheaper';
  Object.assign(c, parsePriceEn(text));
  if (has(text, ['similar', 'like this', 'same color', 'close to this', 'look alike', 'dupe']) && !namedColor && !has(text, ['my lips', 'my lip color'])) c.similar = true;
  if (has(text, ['lighter', 'paler', 'softer color', 'light shade', 'brighter shade'])) c.lightness = 'lighter';
  else if (has(text, ['darker', 'deeper', 'dark shade', 'deep shade'])) c.lightness = 'darker';
  // 진하기 숫자 (단계형 도우미의 진하기 바): "light (depth 20)" → 0~100
  const depth = text.match(/depth\s*(\d{1,3})/);
  if (depth) { c.depth = Math.min(100, Number(depth[1])); delete c.lightness; }

  // 브랜드: 긴 이름부터 (예: '&nd by rom&nd' 안의 'rom&nd')
  const names = brandIndex.flatMap(({ ko, names: ns, noEn }) => ns.map((n) => ({ ko, n: n.toLowerCase(), noEn }))).sort((a, b) => b.n.length - a.n.length);
  const brand = names.find(({ n }) => new RegExp(`(^|[^a-z0-9&])${esc(n)}(?![a-z0-9])`).test(text));
  if (brand?.noEn) c.unknownBrand = brand.n.replace(/\b\w/g, (ch) => ch.toUpperCase());
  else if (brand) c.brand = brand.ko;
  else {
    const other = UNKNOWN_BRANDS.find((b) => wordRe(b).test(text));
    if (other) c.unknownBrand = other.replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  const tone = Object.entries(TONES_EN).find(([, t]) => has(text, t.words));
  if (tone) c.tone = tone[0];
  const hit = situations.filter((s) => SITUATIONS_EN[s.label] && has(text, SITUATIONS_EN[s.label].words));
  const overridden = hit.flatMap((s) => s.overrides || []);
  const sit = hit.map((s) => s.label).filter((l) => !overridden.includes(l));
  if (sit.length && !(tone && sit.every((s) => ['봄', '여름', '가을', '겨울'].includes(s)))) c.situations = sit;
  const concerns = Object.entries(CONCERNS_EN).filter(([, x]) => has(text, x.words)).map(([k]) => k);
  if (concerns.length) c.concerns = concerns;
  if (has(text, ['suits me', 'suit me', 'for me', 'my tone', 'my skin tone', 'match me', 'matches me', 'flatters me', 'fit me',
    'personal color', 'my color type', "don't know my tone", 'what tone am i', 'which tone am i'])) c.mine = true;

  const ordinals = parseOrdinalsEn(text);
  if (ordinals.length) c.ordinals = ordinals;
  if (has(text, ['of those', 'of these', 'among them', 'among those', 'from these', 'from those', 'out of those', 'out of these', 'of them'])) c.among = true;
  if (has(text, ['compare', 'difference', 'vs', 'versus'])) c.compare = true;
  if (has(text, ['set as base', 'use this as', 'use it as', 'as my base', 'pick this', 'choose this', 'save this'])) c.pickBase = true;
  if (has(text, ['more', 'show more', 'others', 'other ones', 'another', 'next ones', 'any other', 'anything else', 'something else', 'not this one', 'different one'])) c.more = true;
  if (has(text, ['why', 'reason', 'how did you pick', 'how did you choose'])) c.why = true;
  if (has(text, ['instead', 'rather', 'change to', 'switch to', 'make it', 'only', 'but'])) c.refine = true;

  if (has(text, ['recommend', 'suggest', 'show', 'find', 'any', 'looking for', 'want', 'need', 'give me', 'what about'])) c.wantsList = true;
  if (has(text, ['price', 'how much', 'cost'])) c.askPrice = true;
  if (has(text, ['finish', 'texture'])) c.askFinish = true;
  if (has(text, ['barcode'])) c.askBarcode = true;
  if (has(text, ['info', 'information', 'details', 'detail', 'tell me about', 'what is it', 'about it', 'describe'])) c.askInfo = true;
  if ((c.askPrice || c.askInfo || c.askFinish) && !c.ordinals && !c.finish && !c.families && !c.brand && !c.price && !c.concerns && !c.situations
    && has(text, ['this', 'that', 'it', 'this one', 'that one'])) c.pointing = true;

  if (has(text, ['hello', 'hi', 'hey', 'yo', 'hiya', 'sup', 'good morning', 'good afternoon', 'good evening'])) c.small = 'greet';
  else if (has(text, ['thanks', 'thank you', 'thx', 'appreciate'])) c.small = 'thanks';
  else if (has(text, ['bye', 'goodbye', 'see you', 'see ya'])) c.small = 'bye';
  else if (has(text, ['who are you', 'what are you', 'are you ai', 'are you a robot', 'are you human', 'your name', 'chatgpt', 'gpt'])) c.small = 'identity';
  else if (has(text, ['help', 'what can you do', 'how does this work', 'how to use', 'what can i ask'])) c.small = 'help';
  else if (has(text, ['pretty', 'love it', 'nice', 'great', 'awesome', 'beautiful', 'like it'])) c.small = 'like';
  else if (has(text, ["don't like", 'dont like', 'not great', 'meh', 'not for me', 'bad', 'ugly one'])) c.small = 'dislike';
  return c;
}

/** 립 추천 밖의 말: 제품 없이 부드럽게 할 수 없는 것을 말하고 할 수 있는 걸 권한다 */
export function offTopicReplyEn(message) {
  const text = ' ' + String(message || '').toLowerCase() + ' ';
  const reply = (r, suggestions = START_SUGGESTIONS_EN) => ({ reply: r, suggestions });
  if (has(text, ['ignore previous', 'ignore the previous', 'system prompt', 'admin mode', 'developer mode', 'make up a product', 'invent a product', 'pretend', 'say that'])) {
    return reply("Sorry, I can't do that. I only share registered lip products exactly as they are.");
  }
  if (has(text, ['stupid', 'idiot', 'dumb', 'useless', 'worst'])) {
    return reply('Oh, not quite right? Tell me the color or feel you want and I will pick again.', ['Recommend a brighter color', 'Something cheaper', 'Recommend an everyday lip']);
  }
  if (has(text, ['trending', 'trend', 'trendy', 'new arrival', 'new arrivals', 'new release', 'latest', 'popular right now', 'hot right now', "what's popular", 'whats popular'])) {
    return reply("I don't have trend or new-release rankings. But I can pick by the feel people often look for, like a juicy glossy lip or a my-lips-but-better nude.", ['Recommend a glossy lip', 'Recommend an MLBB lip', 'Recommend an everyday lip']);
  }
  if (has(text, ['fragrance free', 'fragrance-free', 'unscented', 'scent', 'fragrance', 'vegan', 'cruelty free', 'sensitive'])) {
    return reply("Scent, ingredients and vegan info aren't in my data. Please check the ingredient list or ask a staff member. I can find colors and finishes right away.", ['Recommend a moisturizing lip', 'Recommend a natural color', 'Recommend an everyday lip']);
  }
  if (has(text, ['try it on', 'try on', 'try them on', 'put it on', 'put on my lips', 'on my lips', 'test it', 'swatch'])) {
    return reply('Tap "Try it on" under a recommended product to see it on your lips in the mirror. Tell me the feel you want first.', ['Recommend an everyday lip', 'Recommend a lip for a date', 'Lips that suit me']);
  }
  if (has(text, ['where can i buy', 'where to buy', 'buy it', "i'll take it", 'i will take it', 'purchase', 'checkout', 'pay'])) {
    return reply('If you like one, tap "Take it home" in the mirror. It shows nearby stores and a QR code to open the product page on your phone.', ['Show other colors', 'Recommend an everyday lip']);
  }
  if (has(text, ['restroom', 'bathroom', 'toilet', 'what time do you close', 'opening hours', 'business hours', 'when do you close', 'parking', 'staff'])) {
    return reply("For store info, please ask a staff member nearby. I'm here to help you pick a lip color.");
  }
  if (has(text, ['how much', 'price']) && has(text, ['this', 'it', 'that'])) {
    return reply('Which product would you like the price of? After I recommend some, ask like "how much is the first one". I can also search by price range.', ['Under 20,000 won', 'Cheapest lip', 'Recommend an everyday lip']);
  }
  if (has(text, ['best seller', 'bestseller', 'best-selling', 'best selling', 'most popular', 'top seller', 'ranking'])) {
    return reply("I don't have sales rankings. Tell me the color or mood you want and I'll find the closest match.", ['Recommend an everyday lip', 'Recommend a lip for a date']);
  }
  // 립 제품이라도 지금 데이터(립틴트·글로스)에 없는 종류
  if (has(text, ['lip balm', 'lip liner', 'lip mask', 'lip scrub', 'lip primer'])) {
    return reply("We only have lip tints and glosses right now. If your lips are dry, I can find a moisturizing glossy tint.", ['My lips are dry', 'Recommend a glossy lip']);
  }
  const category = OTHER_CATEGORIES.find((w) => wordRe(w).test(text));
  if (category) return reply(`We don't have ${category} yet. I can only help with lip products for now. Want to see some lips?`);
  const color = UNSUPPORTED_COLORS.find((w) => wordRe(w).test(text));
  if (color) return reply(`There are no ${color} lip products registered. Tell me the mood you want and I will find something close.`, ['Recommend a bold color', 'Recommend a calm color', 'Recommend an everyday lip']);
  if (has(text, ['in stock', 'stock', 'sold out', 'available in store', 'inventory'])) {
    return reply("I can't check stock here. Please ask a staff member. I can show product details and similar colors right away.");
  }
  if (has(text, ['discount', 'sale', 'coupon', 'promotion', 'deal', 'points'])) {
    return reply("Discount and event info isn't connected yet. I can find lips in your price range, though.", ['Under 20,000 won', 'Cheapest lip']);
  }
  if (has(text, ['ingredient', 'ingredients', 'allergy', 'allergic', 'pregnant', 'pregnancy', 'breastfeeding', 'baby', 'side effect', 'side effects', 'dermatologist', 'cracked', 'bleeding', 'blister', 'cold sore', 'herpes', 'infection', 'rash', 'itchy', 'swollen', 'hurts', 'painful'])) {
    return reply("Sorry your lips feel uncomfortable. I can't judge health or ingredients, so please check the ingredient list and talk to a dermatologist or pharmacist. I can still pick a lip that goes on smoothly.", ['Recommend a glossy lip', 'Recommend an everyday lip']);
  }
  if (/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}|[\w.+-]+@[\w-]+\.[\w.]+/.test(text) || has(text, ['my phone number', 'my address', 'my email'])) {
    return reply("No need to share personal details. I'll only ask what helps pick a lip color. Tell me the color or mood you want.");
  }
  if (has(text, ['weather', 'what time', 'news', 'what day'])) {
    return reply("I can't tell you that, but I can pick a lip for any kind of day.", ['A lip for a hot day', 'A calm lip for a rainy day', 'Recommend an everyday lip']);
  }
  return null;
}

/** 기분·잡담 찾기 */
// alone 항목: 그 말을 빼고 남는 글자(띄어쓰기·기호 빼고)가 적을 때만 ("surprise me" O, "surprise me with a galaxy-like vibe" X)
const aloneRest = (text, words) => { let t = text; for (const w of words) t = t.split(w).join(''); return t.replace(/[^a-z0-9]/g, '').length; };
export const moodEn = (message) => {
  const text = ' ' + String(message || '').toLowerCase() + ' ';
  return MOODS_EN.find((m) => has(text, m.words) && (!m.alone || aloneRest(text, m.words) <= 12)) || null;
};

export const ordinalEn = (i) => ORD_WORDS[i] || `#${i + 1}`;

export const EN_FINISH_LABELS = { glossy: 'Glossy', matte: 'Matte', satin: 'Satin', velvet: 'Velvet' };
export const EN_FAMILY_LABELS = { red: 'Red', pink: 'Pink', coral: 'Coral', orange: 'Orange', nude: 'Nude', brown: 'Brown', rose: 'Rose', berry: 'Berry', plum: 'Plum', burgundy: 'Burgundy' };
