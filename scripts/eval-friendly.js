// 친근함 체크리스트 자동 검사 (딥리서치 P2): test/eval/chat-cases.json 의 대화로 챗봇 답의 "모양"을 채점한다.
// 답이 맞는지(정답)는 eval-chat.js 가 보고, 여기서는 말투·구조만 본다. LLM 심판은 쓰지 않는다(자연스러움을 후하게 줌).
//   npm run eval:friendly [-- --provider hybrid] [--verbose]
// 항목 (추천 결과가 있는 턴 기준인 것은 표시):
//   1 되받기*   : 첫 문장이 제품 소개("…를 가장 추천해요")가 아니라 손님 말을 받는 말(여는 말·공감·이음말)로 시작
//   2 해요체    : 모든 문장이 존댓말(…요 / …죠 / …니다)로 끝남 (한국어만)
//   3 짧게      : 4문장 이하 (휴대폰 한 화면, 목표 2~3문장)
//   4 다음 제안 : 빠른 답장 버튼이 있거나 질문으로 끝남
//   5 반복 없음 : 같은 대화에서 직전 턴과 같은 여는 말을 쓰지 않음
//   6 금지 표현 : 화장품 광고 금지 표현 없음 (src/lib/claims.js)
//   7 DB 일치*  : 답에 나온 첫 제품 이름·가격이 등록 데이터와 같음
// 결과: test/eval/results/friendly(.hybrid).json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { findById } from '../src/lib/repository.js';
import { shortName } from '../src/lib/catalog.js';
import { answer } from '../src/lib/chat.js';
import { hybridAnswer } from '../src/lib/llm/agent.js';
import { llmEnabled } from '../src/lib/llm/client.js';
import { findBannedClaim } from '../src/lib/claims.js';

const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const providerName = args.includes('--provider') ? args[args.indexOf('--provider') + 1] : 'rule';
if (providerName === 'hybrid' && !llmEnabled()) { console.error('hybrid 는 .env 의 LLM_BASE_URL·LLM_MODEL 이 필요합니다.'); process.exit(1); }
const run = providerName === 'hybrid' ? (input) => hybridAnswer(input) : async (input) => answer(input);

const cases = JSON.parse(readFileSync(new URL('../test/eval/chat-cases.json', import.meta.url), 'utf8'));
const name = (p) => shortName(p);
const sentences = (t) => String(t).replace(/\([^)]*\)/g, '').replace(/\s+([.?!])/g, '$1').split(/(?<=[.?!])\s+/).map((x) => x.trim()).filter(Boolean);
const POLITE = /(요|죠|니다|까요|세요|어요|해요|예요|이에요)[.?!]?$/;

const CHECKS = ['되받기', '해요체', '짧게', '다음 제안', '반복 없음', '금지 표현', 'DB 일치'];
const tally = Object.fromEntries(CHECKS.map((c) => [c, { pass: 0, total: 0, fails: [] }]));
const mark = (check, ok, where) => {
  const t = tally[check];
  t.total++;
  if (ok) t.pass++; else if (t.fails.length < 8) t.fails.push(where);
};

for (const c of cases) {
  let ctx = null;
  let prevOpener = null;
  for (const turn of c.turns) {
    const r = await run({ message: turn.say, context: ctx, selectedHex: c.hex || null, baseProductId: c.base || null, tone: c.tone || null });
    const where = `${c.id} "${turn.say}" → ${String(r.reply).slice(0, 90)}`;
    const ss = sentences(r.reply);
    const hasProducts = (r.products || []).length > 0 && r.kind !== 'compare';
    if (hasProducts) {
      const first = ss[0] || '';
      mark('되받기', !/가장 추천해요/.test(first), where);
      const top = r.products[0];
      const db = findById(top.id);
      const price = db?.price?.toLocaleString('ko-KR');
      mark('DB 일치', !!db && (!/가장 추천해요/.test(r.reply) || (r.reply.includes(name(db)) && (!price || r.reply.includes(price)))), where);
    }
    mark('해요체', ss.every((x) => POLITE.test(x.replace(/['"’”]+$/, ''))), where);
    mark('짧게', ss.length <= 4, where);
    mark('다음 제안', (r.suggestions || []).length > 0 || /\?$/.test(r.reply.trim()), where);
    const op = r.context?.lastOpener && r.context.lastOpener !== ctx?.lastOpener ? r.context.lastOpener : null;
    mark('반복 없음', !(op && op === prevOpener), where);
    if (op) prevOpener = op;
    mark('금지 표현', !findBannedClaim(r.reply), where);
    ctx = r.context || ctx;
  }
}

console.log(`친근함 체크리스트 (${providerName}, ${cases.length}개 대화)`);
const summary = {};
for (const ch of CHECKS) {
  const t = tally[ch];
  const pct = t.total ? Math.round((t.pass / t.total) * 1000) / 10 : null;
  summary[ch] = { pass: t.pass, total: t.total, pct };
  console.log(`  ${ch.padEnd(6)} ${String(pct ?? '-').padStart(5)}%  (${t.pass}/${t.total})`);
  if (verbose && t.fails.length) for (const f of t.fails) console.log(`      ✗ ${f}`);
}
mkdirSync(new URL('../test/eval/results/', import.meta.url), { recursive: true });
const out = new URL(`../test/eval/results/friendly${providerName === 'hybrid' ? '.hybrid' : ''}.json`, import.meta.url);
writeFileSync(out, JSON.stringify({ provider: providerName, at: new Date().toISOString(), summary, fails: Object.fromEntries(CHECKS.map((c) => [c, tally[c].fails])) }, null, 2));
console.log(`저장: ${out.pathname}`);
