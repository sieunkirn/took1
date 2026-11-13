// 규칙 챗봇: 답 문장 만들기 (립 밖의 말 받기, 여는 말·마무리 말, 제품 비교 요약, 빠른 답장).
import { deltaE2000 } from './color.js';
import { START_SUGGESTIONS_EN } from './chat-en.js';
import { has, PII_RE, OTHER_CATEGORIES, UNSUPPORTED_COLORS } from './chat-words.js';
import { isEn, setEn, L, won, shortOf, josa } from './chat-lang.js';
import { friendlySummary } from './chat-search.js';

const OPENER_SUMMARY_MAX = 24; // 여는 말에서 조건을 되받는 최대 글자 수 (이보다 길면 되받지 않는다)
// 두 색의 차이(ΔE2000)를 말로 옮기는 기준
const SAME_COLOR_DELTA_E = 5; // 이보다 작으면 '거의 같은 색'
const SAME_FAMILY_DELTA_E = 15; // 이보다 작으면 '같은 계열', 크면 '분위기가 다른 색'
const QUICK_REPLY_MAX = 4; // 추천 뒤 빠른 답장 버튼 수

const START_SUGGESTIONS_KO = ['데일리 립 추천해 줘', '데이트 립 추천해 줘', '입술이 건조해요', '내 톤에 맞는 립'];
// 처음 질문 추천 (지금 답하는 언어로)
export const startSuggestions = () => (isEn() ? START_SUGGESTIONS_EN : START_SUGGESTIONS_KO);

// 립 추천 밖의 말: 제품을 내밀지 않고 할 수 없는 것을 부드럽게 말한 뒤 할 수 있는 걸 권한다
export function offTopicReply(text) {
  const reply = (r, suggestions = startSuggestions()) => ({ reply: r, suggestions });
  if (has(text, ['무시하고', '프롬프트', '관리자', '모드로', '지어내', '지어서', '라고 말해', '라고 해 줘', '척해', '척 해'])) {
    return reply('그건 도와드리기 어려워요. 등록된 립 제품 정보만 있는 그대로 알려 드릴 수 있어요. 찾는 색이나 느낌을 말씀해 주시면 바로 골라 드릴게요.');
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
    return reply('입술이 불편하면 신경 쓰이죠. 건강이나 성분은 제가 판단할 수 없어서, 제품 성분표를 확인하시고 피부과나 약사와 상담해 보세요. 촉촉하게 발리는 립을 찾으시면 골라 드릴게요.', ['촉촉한 글로시 립 추천해 줘', '데일리로 바를 립 추천해 줘']);
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
  ["'{s}'에 맞춰 골라 봤어요.", 'Here are picks for "{s}".'],
  ["'{s}' 조건을 반영해 다시 골랐어요.", 'Updated with "{s}".'],
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
export function openerFor(own, env, ctx, mine = false) {
  if (mine && !(own && Object.keys(own).length)) return L('측정한 톤에 맞춰 골라 봤어요.', 'I picked these to suit your measured tone.');
  if (!own || !Object.keys(own).length) return '';
  const concern = (own.concerns || []).find((c) => EMPATHY[c]);
  if (concern) return EMPATHY[concern][isEn() ? 1 : 0];
  const s = friendlySummary(own, env);
  if (!s || s.length > OPENER_SUMMARY_MAX) return ''; // 조건이 길면 되받지 않는다 (답이 길어지지 않게)
  const t = pickRotating(OPENERS, ctx.turn || 0, ctx.lastOpener, (o) => o[0]);
  return t ? t[isEn() ? 1 : 0].replace('{s}', s) : '';
}
export function closerFor(query, ctx) {
  const pool = CLOSERS.filter((c) => !c.skip?.(query));
  const c = pickRotating(pool, (ctx.turn || 0) + 1, ctx.lastCloser, (x) => x.ko);
  return c ? c : null;
}

/**
 * 제품 2~3개를 비교한 요약 문장. 챗봇의 "1번이랑 2번 비교"와 화면의 비교함이 같이 쓴다.
 * @param {object[]} items 제품 (color_lab, price, finish 포함)
 */
export function compareSummary(items, lang = null) {
  if (items.length < 2) return '';
  // 화면의 비교함은 lang 을 넘긴다. 챗봇 답 안에서는 지금 답하는 언어를 그대로 쓴다
  const prev = isEn();
  if (lang) setEn(lang === 'en');
  try {
    return compareLines(items);
  } finally {
    setEn(prev);
  }
}
function compareLines(items) {
  const lines = [];
  const byPrice = [...items].sort((a, b) => a.price - b.price);
  if (byPrice[0].price === byPrice.at(-1).price) lines.push(L(`가격은 모두 ${won(byPrice[0].price)}이에요.`, `They are all ${won(byPrice[0].price)}.`));
  else {
    // 같은 가격이 여럿이면 모두 말한다 (예: "리플 01 코랄 비치·리플 02 핑크 소다가 9,900원으로")
    const names = (price) => items.filter((p) => p.price === price).map(shortOf).join(L('·', ' / '));
    lines.push(L(`가장 저렴한 건 ${names(byPrice[0].price)}, ${won(byPrice[0].price)}이에요. 가장 비싼 건 ${names(byPrice.at(-1).price)}, ${won(byPrice.at(-1).price)}이에요.`,
      `The cheapest is ${names(byPrice[0].price)} at ${won(byPrice[0].price)}, and the priciest is ${names(byPrice.at(-1).price)} at ${won(byPrice.at(-1).price)}.`));
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
  if (isEn()) {
    const feel = best.d < SAME_COLOR_DELTA_E ? 'are almost the same color' : best.d < SAME_FAMILY_DELTA_E ? 'are in the same family but look different side by side' : 'have a different mood';
    lines.push(`${items.length > 2 ? 'The closest pair, ' : ''}${shortOf(best.a)} and ${shortOf(best.b)} ${feel}.`);
    lines.push(`The lightest, softest color is ${shortOf(lightest)}.`);
  } else {
    const feel = best.d < SAME_COLOR_DELTA_E ? '거의 같은 색이에요'
      : best.d < SAME_FAMILY_DELTA_E ? '같은 계열이지만 나란히 보면 차이가 나요' : '분위기가 다른 색이에요';
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

// 추천 뒤 빠른 답장 (2026-11-11 다시 짬): 손님이 다음에 하고 싶은 '방향 바꾸기'를 짧은 말로, 최대 4개.
//  ① 색 방향(기준 색이 있을 때만: 밝게 ↔ 진하게) ② 제형 바꾸기(지금 많은 쪽의 반대) ③ 가격 낮추기(가격 조건이 없을 때)
//  ④ 다른 거 더 보기(더 있으면) 또는 1번·2번 비교. 자리가 남으면 1번 자세히. 모두 규칙 챗봇이 알아듣는 말인지 확인했다
export function resultSuggestions(products, q, hasMore, hasRef = false) {
  if (!products.length) return startSuggestions();
  const glossy = q.finish === 'glossy' || products.filter((p) => p.finish === 'glossy').length * 2 > products.length;
  const out = [];
  if (hasRef) out.push(q.lightness === 'lighter' ? L('더 진한 색', 'A deeper shade') : L('더 밝은 색', 'A lighter shade'));
  out.push(glossy ? L('보송한 매트로', 'Switch to matte') : L('촉촉한 글로시로', 'Switch to glossy'));
  if (!q.maxPrice && !q.minPrice && !q.price) out.push(L('더 저렴한 걸로', 'Something cheaper'));
  if (hasMore) out.push(L('다른 거 더 보여 줘', 'Show more'));
  else if (products.length >= 2) out.push(L('1번이랑 2번 비교', 'Compare the first and second'));
  if (out.length < 4) out.push(L('1번 자세히', 'Tell me more about the first one'));
  return out.slice(0, QUICK_REPLY_MAX);
}
