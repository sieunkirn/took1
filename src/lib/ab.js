// 말투 다듬기 A/B (서버 전용, 딥리서치 P2). 켜기: .env 에 TOOK_STYLE_AB=1 (LLM 설정도 있어야 다듬기가 실제로 돈다)
// - 대화(세션) 단위로 반을 나눈다: control = 규칙 답 그대로, style = 말투 다듬기
// - 기록은 서버 메모리에만 (재시작하면 사라짐). 질문 글·개인정보는 남기지 않고 횟수·지연 시간만 센다
// - 지표: 대화 수, 턴 수, 대화당 턴, 빠른 답장 클릭률, 제품 카드(올리브영) 클릭률, 다듬기 성공률·템플릿 복귀율, 지연 p95
export const abEnabled = (env = process.env) => env.TOOK_STYLE_AB === '1';

/** 세션 id → 'control' | 'style' (같은 세션은 늘 같은 쪽) */
export function abVariant(session) {
  const s = String(session || '');
  if (!/^[0-9a-f]{8,32}$/.test(s)) return null;
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 2 === 0 ? 'control' : 'style';
}

const blank = () => ({ sessions: new Set(), turns: 0, styleTried: 0, styled: 0, fallback: 0, ms: [], events: { quick_reply: 0, card_click: 0 } });
const stats = { control: blank(), style: blank() };

/** 챗봇 한 턴 */
export function recordTurn(variant, session, { tried = false, styled = false, ms = 0 } = {}) {
  const v = stats[variant];
  if (!v) return;
  v.sessions.add(session);
  v.turns++;
  if (tried) {
    v.styleTried++;
    if (styled) v.styled++; else v.fallback++;
    v.ms.push(ms);
    if (v.ms.length > 2000) v.ms.shift();
  }
}

/** 화면 쪽 행동 (빠른 답장·제품 카드 클릭) */
export function recordEvent(session, name) {
  const variant = abVariant(session);
  const v = stats[variant];
  if (!v || !(name in v.events)) return false;
  v.sessions.add(session);
  v.events[name]++;
  return true;
}

const p95 = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
};
const rate = (a, b) => (b ? Math.round((a / b) * 1000) / 1000 : null);

export function abStats() {
  const out = {};
  for (const [k, v] of Object.entries(stats)) {
    out[k] = {
      sessions: v.sessions.size,
      turns: v.turns,
      turnsPerSession: rate(v.turns, v.sessions.size),
      quickReplyPerTurn: rate(v.events.quick_reply, v.turns),
      cardClickPerTurn: rate(v.events.card_click, v.turns),
      styleSuccessRate: rate(v.styled, v.styleTried),
      templateFallbackRate: rate(v.fallback, v.styleTried),
      styleP95ms: p95(v.ms),
    };
  }
  return out;
}

export function abReset() { stats.control = blank(); stats.style = blank(); }
