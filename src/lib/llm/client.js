// LLM 호출 (서버 전용, 외부 의존성 없음). OpenAI 호환 /chat/completions 주소면 어디든 붙는다:
// OpenAI, Google Gemini(OpenAI 호환 주소), Anthropic(OpenAI 호환 주소), 로컬 Ollama·vLLM·LM Studio 등.
// 설정은 환경 변수(.env)로만 받는다. 키는 서버에만 있고 브라우저로 보내지 않는다 (CLAUDE.md: API 키 노출 금지).
//   LLM_BASE_URL  예) https://api.openai.com/v1 · http://localhost:11434/v1 (Ollama)
//   LLM_MODEL     예) qwen3.5:27b · gemma4:12b (Ollama) 또는 각 서비스의 모델 이름
//   LLM_API_KEY   로컬 모델이면 비워 둔다
//   LLM_TIMEOUT_MS 기본 15000

export function llmConfig(env = process.env) {
  return {
    baseUrl: (env.LLM_BASE_URL || '').replace(/\/+$/, ''),
    model: env.LLM_MODEL || '',
    apiKey: env.LLM_API_KEY || '',
    timeoutMs: Number(env.LLM_TIMEOUT_MS) || 15000,
  };
}

export function llmEnabled(cfg = llmConfig()) {
  return !!(cfg.baseUrl && cfg.model);
}

/**
 * 대화 한 번 요청. 응답의 assistant 메시지({ content, tool_calls })를 돌려준다.
 * @param {{ messages: object[], tools?: object[] }} req
 */
export async function chatCompletion({ messages, tools }, cfg = llmConfig()) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
    body: JSON.stringify({ model: cfg.model, messages, tools, tool_choice: tools?.length ? 'auto' : undefined, temperature: 0.2 }),
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  if (!msg) throw new Error('LLM 응답에 message 가 없습니다.');
  return msg;
}
