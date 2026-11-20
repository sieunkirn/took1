// 챗봇 빠른 답장 1차 (2026-11-19 기획 A·B·C·D): 마지막 챗봇 답이 어떤 상황인지 보고 입력창 위 줄에 놓을 버튼을 고른다.
// 버튼 종류 (줄에서 앞 아이콘으로 구분, css/chat-quick.css):
//   say  = 그 말을 바로 보낸다 (지금까지의 빠른 답장)
//   act  = 화면을 바로 움직인다 (이 제품 기준으로 찾기)
//   pick = 말풍선 안에 고르기 한 단계를 띄운다 (질감 카드 · 가격 슬라이더, js/chat-guide.js startMini)
// 맨 앞은 늘 '답하며 고르기'. 보내는 말은 모두 규칙 챗봇(src/lib/chat.js)이 한/영으로 알아듣는 것을 확인했다.
//  A 추천 결과 직후: (기준 색이 있으면 더 밝은/진한 색) · 질감 바꾸기 · 가격대 바꾸기 · 다른 거 더 보여 줘(더 없으면 그중에 제일 싼 거는?)
//  B 제품 하나 자세히: 이거랑 비슷한 색 · 이거보다 저렴한 거 · 다른 거 더 보여 줘
//  입술에 바르기는 2026-11-20부터 말풍선 제품 카드의 '바르러 가기' 버튼 (chat-view.js productMini → wearOnLips)
//  C 결과 0개: 붙인 조건마다 "'매트' 빼고 찾기" (챗봇이 빼라고 한 조건을 앞에) — 나머지 조건으로 다시 묻는다
//  D 못 알아들음 2번 연속: '답하며 고르기'를 크게 + 시작 예시 3개
import { C, START, state, loadBase, track } from './chat-state.js';
import { send } from './chat.js';

const say = (text) => ({ type: 'say', label: text, run: () => { track('quick_say'); send(text); } });
const act = (label, run) => ({ type: 'act', label, run: () => { track('quick_act'); run(); } });
const pick = (label, which) => ({ type: 'pick', label, which });
const isMore = (s) => /^(다른 거 더 보여 줘|Show more)$/i.test(s);
const isLightDeep = (s) => /^(더 밝은 색|더 진한 색|A lighter shade|A deeper shade)$/i.test(s);

/** 거울(팔레트)에서 그 제품 색을 입술에 바로 바른다 */
export function wearOnLips(p) {
  if (!p?.id) return;
  const inModal = document.documentElement.classList.contains('in-chat-modal');
  if (inModal) {
    try {
      if (typeof window.parent.tookWear === 'function') { window.parent.tookWear(p); return; } // 팔레트 위 챗봇 창: 창을 닫고 바로
      window.parent.location.href = 'palette.html?wear=' + encodeURIComponent(p.id);
      return;
    } catch { /* 다른 창이면 아래로 */ }
  }
  location.href = 'palette.html?wear=' + encodeURIComponent(p.id);
}

/** 그 제품을 기준 제품으로 정하고 이어서 묻는다 ("비슷한 색", "더 저렴한 거"는 기준 제품이 있어야 정확하다) */
async function askWithBase(p, text) {
  state.baseId = p.line || p.id;
  await loadBase();
  send(text);
}

/** 결과 0개 답에서 붙인 조건들 ("'결혼식 하객 · 새틴 · 10,000원 이하' 조건에 맞는 제품이 없어요") */
function zeroParts(m) {
  const t = String(m.text || '');
  const ko = t.match(/'([^']+)' 조건에 맞는 제품이 없어요/);
  const en = t.match(/No products match "([^"]+)"/);
  const parts = (ko?.[1] || en?.[1] || '').split(' · ').map((s) => s.trim()).filter(Boolean);
  // 챗봇이 "제형 조건을 빼면 N개"처럼 빼라고 한 조건을 맨 앞에
  const hint = /제형 조건|Without the finish/i.test(t) ? /^(매트|벨벳|새틴|글로시|Matte|Velvet|Satin|Glossy)$/i
    : /가격 조건|Without the price/i.test(t) ? /원|₩/ : null;
  if (hint) parts.sort((a, b) => Number(hint.test(b)) - Number(hint.test(a)));
  return parts;
}
const relaxQuery = (rest) => C(`${rest.join(' ')} 립 추천해 줘`, `Recommend lips: ${rest.join(', ')}`);

/** 마지막 메시지에 맞는 빠른 답장 버튼들 (답하며 고르기 버튼은 chat-view.js 가 맨 앞에 붙인다) */
export function quickChips(m) {
  if (!m || m.role !== 'bot' || m.kind === 'guide') return { chips: [] };
  const bots = state.messages.filter((x) => x.role === 'bot');
  const products = m.products || [];
  // D 못 알아들음이 두 번 이어지면: 답하며 고르기를 크게 + 시작 예시
  if (m.unsure && bots.at(-2)?.unsure) return { strongGuide: true, chips: START.slice(0, 3).map(say) };
  // C 결과 0개: 조건 하나씩 빼고 다시 찾기
  if (m.total === 0) {
    const parts = zeroParts(m);
    if (parts.length >= 2) {
      // 버튼 글자는 "'매트' 빼고 찾기", 보내는 말은 나머지 조건으로 만든 문장
      return { chips: parts.slice(0, 3).map((part) => ({ ...say(relaxQuery(parts.filter((x) => x !== part))), label: C(`'${part}' 빼고 찾기`, `Without '${part}'`) })) };
    }
    return { chips: (m.suggestions || []).map(say) };
  }
  // B 제품 하나 자세히 (번호로 물은 답: 개수(total)가 없다)
  if (products.length === 1 && m.total == null && m.kind !== 'compare') {
    const p = products[0];
    return { chips: [
      // '이 제품 호수 보기'·'입술에 발라 보기'는 2026-11-20 뺐다: 카드에 호수 고르기가 없고, 바르기는 카드의 '바르러 가기' 버튼으로 한다
      act(C('이거랑 비슷한 색', 'Similar colors'), () => askWithBase(p, C('비슷한 색 찾아 줘', 'Find similar colors'))),
      act(C('이거보다 저렴한 거', 'Something cheaper'), () => askWithBase(p, C('이거보다 저렴한 거', 'Something cheaper'))),
      say(C('다른 거 더 보여 줘', 'Show more')),
    ].filter(Boolean) };
  }
  // A 추천 결과 직후
  if (products.length && m.total > 0) {
    const sugg = m.suggestions || [];
    return { chips: [
      ...sugg.filter(isLightDeep).map(say), // 기준 색이 있을 때만 챗봇이 넣어 준다
      pick(C('질감 바꾸기', 'Change finish'), 'finish'),
      pick(C('가격대 바꾸기', 'Change price'), 'price'),
      say(sugg.some(isMore) ? C('다른 거 더 보여 줘', 'Show more') : C('그중에 제일 싼 거는?', 'Which is the cheapest of those?')),
      // '1번 입술에 발라 보기'는 2026-11-20 사용자 요청으로 뺐다 (카드마다 '바르러 가기' 버튼)
    ] };
  }
  // 그 밖(인사·잡담·안내 등): 챗봇이 준 다음 질문
  return { chips: (m.suggestions || []).map(say) };
}
