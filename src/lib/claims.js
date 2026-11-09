// 화장품 표시·광고 금지 표현 사전 (딥리서치 P0, reports/친근한 뷰티 상담 챗봇 설계.md).
// 식약처 화장품 광고 기준: 질병 치료·예방, 의약품 오인 효능(소염·재생 등), 기능성 심사 없는 미백·주름 효능,
// 피부나이 감소, '최고' 같은 절대 표현, 부작용 없음·100% 안전 같은 보장 표현을 쓰지 않는다.
// ※ 2차 자료로 만든 목록이다. 식약처 '화장품 표시·광고 관리 가이드라인' 원문으로 확정해야 한다.
// 쓰는 곳: LLM 답 검사(llm/agent.js validateFinal), 규칙 챗봇 문구·제품 설명 점검(test/unit.test.js)
export const BANNED_CLAIMS = [
  /치료/, /완치/, /예방/, /소염/, /염증\s*(완화|개선|억제)/, /재생/, /살균/, /항균/, /처방/,
  /미백/, /주름\s*(개선|완화|제거|예방)/, /아토피/, /여드름/, /피부\s*나이/, /최고(의|로|급)?/,
  /부작용\s*(없|0)/, /100\s*%\s*안전/,
  /\bcure[sd]?\b/i, /\bheal(s|ing)?\b/i, /anti-?inflammatory/i, /whitening/i, /anti-?wrinkle/i, /\bacne\b/i, /\beczema\b/i,
  /no side effects/i, /100\s*% safe/i,
];

/** 금지 표현이 있으면 그 말, 없으면 null */
export function findBannedClaim(text) {
  const s = String(text || '');
  for (const re of BANNED_CLAIMS) {
    const m = s.match(re);
    if (m) return m[0];
  }
  return null;
}
