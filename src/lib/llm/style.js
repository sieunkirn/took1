// 말투 다듬기 (서버 전용, 딥리서치 P2): 규칙 챗봇의 추천 답을 LLM 이 더 자연스러운 말투로만 고친다. 사실은 바꾸지 못한다.
// - 대상: 제품을 추천한 턴만 (비교표·민감한 말·못 알아들은 말·고정 안내는 그대로)
// - 제품 이름·숫자(가격·%·개수)는 {{P1}}·{{N1}} 같은 자리표시로 바꿔서 보내고, 돌아온 글의 자리표시가 똑같은지 검사한 뒤 되돌린다
// - 검사: 자리표시 집합 동일 · 자리표시 밖 숫자 없음 · 길이 · 화장품 광고 금지 표현 · 이모지
// - 실패하거나 지연 예산(기본 1초)을 넘기면 다시 묻지 않고 규칙 답(템플릿)을 그대로 쓴다
import { shortName } from '../catalog.js';
import { findBannedClaim } from '../claims.js';
import { chatCompletion } from './client.js';

const STYLE_BUDGET_MS = 1000;

const SYSTEM = {
  ko: `너는 립 컬러 서비스 took 의 AI 도우미 "툭"의 말투를 다듬는 편집자야. 사용자 글은 챗봇이 이미 정한 답이다.
규칙:
- 뜻·사실·순서를 바꾸지 않는다. 새 정보(효능, 지속 시간, 재고, 할인, 성분)를 더하지 않는다.
- {{P1}}, {{N1}} 같은 자리표시는 글자 하나 바꾸지 말고 모두 그대로 한 번씩 쓴다. 자리표시 밖에 숫자를 쓰지 않는다.
- 괄호로 덧붙이지 않는다. 덧붙일 말은 문장으로 쓴다.
- 부드러운 해요체, 1~3문장, 원래 길이와 비슷하게. 이모지·느낌표 남발·과장 표현(최고, 완벽, 무조건)을 쓰지 않는다.
- 다듬은 글만 쓴다. 설명이나 따옴표를 붙이지 않는다.`,
  en: `You polish the tone of "Took", the AI assistant of the lip color service took. The user text is the assistant's final answer.
Rules:
- Do not change meaning, facts or order. Do not add new information (benefits, wear time, stock, discounts, ingredients).
- Keep every placeholder like {{P1}} or {{N1}} exactly once and unchanged. Do not write digits outside placeholders.
- Friendly, concise, 1-3 sentences, similar length. No emoji, no hype words (best, perfect, guaranteed).
- Output only the polished text.`,
};

const NUM_RE = /₩?\d[\d,.]*\s*(?:원|%|개|가지)?/g;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 제품 이름·숫자를 자리표시로 바꾼다 → { text, slots } */
export function tokenize(reply, products = []) {
  const slots = {};
  let text = String(reply || '');
  const names = [...new Set(products.map((p) => shortName(p)).filter(Boolean))].sort((a, b) => b.length - a.length);
  names.forEach((name, i) => {
    const key = `{{P${i + 1}}}`;
    if (text.includes(name)) { text = text.replace(new RegExp(escapeRe(name), 'g'), key); slots[key] = name; }
  });
  let n = 0;
  text = text.replace(NUM_RE, (m) => { const key = `{{N${++n}}}`; slots[key] = m; return key; });
  return { text, slots };
}

/** LLM 이 다듬은 글을 검사하고 되돌린다. 문제가 있으면 { error } */
export function checkStyled(out, { text, slots }) {
  const s = String(out || '').trim().replace(/^["'“”]+|["'“”]+$/g, '');
  if (!s) return { error: 'empty' };
  const keys = (x) => (x.match(/\{\{[PN]\d+\}\}/g) || []).sort().join(',');
  if (keys(s) !== keys(text)) return { error: 'placeholders' };
  if (/\d/.test(s.replace(/\{\{[PN]\d+\}\}/g, ''))) return { error: 'digits' };
  if (s.length > Math.max(80, text.length * 1.4)) return { error: 'too long' };
  if (/\p{Extended_Pictographic}/u.test(s)) return { error: 'emoji' };
  const restored = s.replace(/\{\{[PN]\d+\}\}/g, (k) => slots[k]);
  if (findBannedClaim(restored)) return { error: 'banned claim' };
  return { reply: restored };
}

/** 다듬기 대상인가: 제품을 추천한 일반 턴만 */
export const styleEligible = (rule) => !!rule && rule.products?.length > 0 && rule.kind !== 'compare' && !rule.unsure && String(rule.reply || '').length < 400;

/**
 * 규칙 답을 다듬는다. 실패·시간 초과면 { styled: false, reason }
 * @returns {Promise<{ styled: boolean, reply?: string, reason?: string, ms: number }>}
 */
export async function stylize(rule, { lang = 'ko', complete = chatCompletion, budgetMs = STYLE_BUDGET_MS } = {}) {
  const t0 = Date.now();
  const tok = tokenize(rule.reply, rule.products);
  let timer;
  try {
    const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('budget')), budgetMs); });
    const msg = await Promise.race([complete({ messages: [{ role: 'system', content: SYSTEM[lang === 'en' ? 'en' : 'ko'] }, { role: 'user', content: tok.text }] }), timeout]);
    const v = checkStyled(msg?.content, tok);
    if (v.error) return { styled: false, reason: v.error, ms: Date.now() - t0 };
    return { styled: true, reply: v.reply, ms: Date.now() - t0 };
  } catch (err) {
    return { styled: false, reason: err.message === 'budget' ? 'timeout' : 'error', ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}
