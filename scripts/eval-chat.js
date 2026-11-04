// 챗봇 평가 (로드맵 0단계): test/eval/chat-cases.json 의 한국어 문항으로 챗봇을 채점한다.
// 규칙 챗봇(answer)과 LLM 층을 같은 기준으로 비교하려고, 답변 함수는 provider 로 바꿔 끼운다.
//   node scripts/eval-chat.js [--provider rule|hybrid] [--only H] [--verbose]
//   hybrid: 규칙 먼저, 규칙이 못 알아들은 말만 LLM (.env 의 LLM_BASE_URL·LLM_MODEL 필요)
// 형식과 채점 기준은 test/eval/README.md 참고. 데이터는 실제 데이터(올리브영)를 쓴다.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { allProducts, findById } from '../src/lib/repository.js';
import { answer } from '../src/lib/chat.js';
import { hybridAnswer } from '../src/lib/llm/agent.js';
import { llmEnabled, llmConfig } from '../src/lib/llm/client.js';

const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const verbose = args.includes('--verbose');
const only = opt('--only');
const providerName = opt('--provider') || 'rule';

// 답변 함수: answer() 와 같은 입력·출력 모양({ reply, products, total, conditions, kind, action, context })
const PROVIDERS = {
  rule: async (input) => ({ engine: 'rule-based', ...answer(input) }),
  hybrid: (input) => hybridAnswer(input),
};
const provider = PROVIDERS[providerName];
if (!provider) {
  console.error(`알 수 없는 provider: ${providerName} (가능: ${Object.keys(PROVIDERS).join(', ')})`);
  process.exit(1);
}
if (providerName === 'hybrid' && !llmEnabled()) {
  console.error('hybrid 는 .env 에 LLM_BASE_URL·LLM_MODEL 이 있어야 합니다 (.env.example 참고).');
  process.exit(1);
}

// --lang en: 영어 문항(chat-cases.en.json)으로 영어 챗봇을 채점한다
const lang = opt('--lang') === 'en' ? 'en' : 'ko';
const casesFile = new URL(lang === 'en' ? '../test/eval/chat-cases.en.json' : '../test/eval/chat-cases.json', import.meta.url);
const cases = JSON.parse(readFileSync(casesFile, 'utf8')).filter((c) => !only || c.id.startsWith(only));
// 답에 나올 수 있는 브랜드 이름: 한국어 + 글로벌 영어 표기
const BRANDS = [...new Set(allProducts().flatMap((p) => [p.brand, p.brand_en]).filter(Boolean))].filter((b) => b.length >= 2);

// ---------- 답의 종류 ----------
function outcomeOf(res) {
  if (res.kind === 'compare') return 'compare';
  if (res.action?.type === 'setBase') return 'set_base';
  if (res.products?.length) return 'products';
  if (/잘 못 알아들었어요/.test(res.reply)) return 'not_understood';
  if (res.total === 0 && res.conditions?.length) return 'no_match';
  return 'text';
}

// expected 의 값이 actual 에 모두 들어 있는가 (배열은 포함 관계)
function contains(actual, expected) {
  if (Array.isArray(expected)) return Array.isArray(actual) && expected.every((e) => actual.some((a) => contains(a, e)));
  if (expected && typeof expected === 'object') {
    return !!actual && typeof actual === 'object' && Object.entries(expected).every(([k, v]) => contains(actual[k], v));
  }
  return actual === expected;
}

const oneOf = (v, x) => (Array.isArray(v) ? v.includes(x) : v === x);

function checkEach(p, e) {
  const bad = [];
  if (e.finish && !oneOf(e.finish, p.finish)) bad.push(`제형 ${p.finish}`);
  if (e.finishNot && e.finishNot.includes(p.finish)) bad.push(`제외할 제형 ${p.finish}`);
  if (e.families && !e.families.includes(p.color_family)) bad.push(`계열 ${p.color_family}`);
  if (e.familiesNot && e.familiesNot.includes(p.color_family)) bad.push(`제외할 계열 ${p.color_family}`);
  if (e.brand && p.brand !== e.brand) bad.push(`브랜드 ${p.brand}`);
  if (e.maxPrice !== undefined && p.price > e.maxPrice) bad.push(`가격 ${p.price}`);
  if (e.minPrice !== undefined && p.price < e.minPrice) bad.push(`가격 ${p.price}`);
  return bad.length ? `${p.id}(${bad.join(', ')})` : null;
}

function pickTarget(pick, shown) {
  if (!shown.length) return null;
  if (pick === 'cheapest') return [...shown].sort((a, b) => a.price - b.price)[0];
  if (pick === 'priciest') return [...shown].sort((a, b) => b.price - a.price)[0];
  return shown[pick < 0 ? shown.length + pick : pick] || null;
}

// ---------- 근거 검사 (라벨과 상관없이 항상) ----------
function groundingIssues(res, { say, shown, base }) {
  const issues = [];
  const related = [...(res.products || []), ...shown, ...(base ? [base] : [])];
  for (const p of res.products || []) if (!findById(p.id)) issues.push(`DB 에 없는 제품 id ${p.id}`);

  const allowedBrands = new Set(related.flatMap((p) => [p.brand, p.brand_en]).filter(Boolean));
  for (const b of BRANDS) {
    const re = new RegExp(`(^|[\\s'"(·,])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    if (re.test(res.reply) && !allowedBrands.has(b) && !say.includes(b) && !(res.understood || '').includes(b)) {
      issues.push(`관련 없는 브랜드 언급: ${b}`);
    }
  }

  const allowedPrices = new Set(related.map((p) => p.price));
  const heardNums = `${say} ${res.understood || ''}`.match(/\d[\d,]*/g) || [];
  for (const n of heardNums) {
    const v = Number(n.replace(/,/g, ''));
    for (const unit of [1, 1000, 10000]) allowedPrices.add(v * unit);
  }
  const q = res.context?.query;
  if (q?.maxPrice) allowedPrices.add(q.maxPrice.value);
  if (q?.minPrice) allowedPrices.add(q.minPrice.value);
  if (q?.cheaperThan) allowedPrices.add(q.cheaperThan);
  // 한국어 '13,000원', 영어 '₩13,000'
  for (const m of res.reply.matchAll(/(\d[\d,]*)\s*원|₩(\d[\d,]*)/g)) {
    const v = Number((m[1] || m[2]).replace(/,/g, ''));
    if (!allowedPrices.has(v)) issues.push(`근거 없는 가격: ${m[0]}`);
  }
  return issues;
}

// ---------- 채점 ----------
async function runCase(c) {
  let context = null;
  let shown = [];
  const base = c.base ? findById(c.base) : null;
  const turns = [];
  for (const t of c.turns) {
    const started = performance.now();
    const res = await provider({ message: t.say, baseProductId: c.base || null, selectedHex: c.hex || null, tone: c.tone || null, context, lang });
    const ms = performance.now() - started;
    const e = t.expect || {};
    const fails = [];
    const outcome = outcomeOf(res);
    if (e.outcome && !oneOf(e.outcome, outcome)) fails.push(`답의 종류 ${outcome} (기대 ${[].concat(e.outcome).join('/')})`);
    if (e.query && !contains(res.context?.query, e.query)) {
      fails.push(`알아들은 조건 ${JSON.stringify(res.context?.query || {})} (기대 ${JSON.stringify(e.query)})`);
    }
    if (e.each) {
      const bad = (res.products || []).map((p) => checkEach(p, e.each)).filter(Boolean);
      if (bad.length) fails.push(`조건에 안 맞는 제품 ${bad.slice(0, 3).join(' ')}${bad.length > 3 ? ` 외 ${bad.length - 3}개` : ''}`);
    }
    if (e.sort && (res.products || []).length >= 2) {
      const prices = res.products.map((p) => p.price);
      const ok = prices.every((v, i) => i === 0 || (e.sort === 'price_asc' ? prices[i - 1] <= v : prices[i - 1] >= v));
      if (!ok) fails.push(`정렬이 ${e.sort} 가 아님 (${prices.join(',')})`);
    }
    if (e.pick !== undefined) {
      const target = pickTarget(e.pick, shown);
      if (!target || res.products?.[0]?.id !== target.id) fails.push(`고른 제품이 다름 (기대 ${target?.id || '없음'}, 실제 ${res.products?.[0]?.id || '없음'})`);
    }
    if (e.replyHas && !e.replyHas.some((w) => res.reply.includes(w))) fails.push(`답변에 "${e.replyHas.join('" / "')}" 없음`);
    const grounding = groundingIssues(res, { say: t.say, shown, base });

    turns.push({ say: t.say, reply: res.reply, engine: res.engine, outcome, products: (res.products || []).map((p) => p.id), fails, grounding, ms: Math.round(ms * 10) / 10 });
    context = res.context;
    shown = (res.context?.shown || []).map(findById).filter(Boolean);
  }
  const pass = turns.every((t) => !t.fails.length);
  return { id: c.id, cat: c.cat, pass, groundingIssues: turns.flatMap((t) => t.grounding), turns };
}

const results = [];
for (const c of cases) results.push(await runCase(c)); // LLM 요청이 몰리지 않게 한 문항씩

// ---------- 결과 ----------
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const byCat = {};
for (const r of results) {
  const x = (byCat[r.cat] ||= { key: r.id[0], total: 0, pass: 0 });
  x.total++;
  if (r.pass) x.pass++;
}
const passed = results.filter((r) => r.pass).length;
const grounding = results.flatMap((r) => r.groundingIssues.map((g) => `${r.id}: ${g}`));
const allMs = results.flatMap((r) => r.turns.map((t) => t.ms));

const llmTurns = results.flatMap((r) => r.turns).filter((t) => t.engine === 'llm').length;
console.log(`\n챗봇 평가 · provider=${providerName}${lang === 'en' ? ' · English' : ''}${providerName === 'hybrid' ? ` (${llmConfig().model})` : ''} · 데이터 ${allProducts().length}개 · 문항 ${results.length}개\n`);
for (const [cat, x] of Object.entries(byCat)) {
  console.log(`  ${x.key} ${cat.padEnd(10, ' ')} ${String(x.pass).padStart(3)}/${String(x.total).padEnd(3)} ${pct(x.pass, x.total)}%`);
}
console.log(`\n  전체 통과        ${passed}/${results.length} (${pct(passed, results.length)}%)`);
console.log(`  근거 위반        ${grounding.length}건 (0이어야 함)`);
console.log(`  응답 시간 평균   ${(allMs.reduce((a, b) => a + b, 0) / allMs.length).toFixed(1)}ms · 최대 ${Math.max(...allMs).toFixed(0)}ms`);
if (providerName !== 'rule') console.log(`  LLM 이 답한 턴   ${llmTurns}개`);
if (grounding.length) console.log('\n근거 위반:\n' + grounding.map((g) => '  ' + g).join('\n'));

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.log('\n틀린 문항:');
  for (const r of failed) {
    for (const t of r.turns.filter((t) => t.fails.length)) {
      console.log(`  ${r.id} "${t.say}"${t.engine === 'llm' ? ' [LLM]' : ''} → ${t.fails.join(' · ')}`);
      if (verbose) console.log(`       답변: ${t.reply}`);
    }
  }
}

// 일부 문항만 돌렸을 때는 전체 결과 파일을 덮어쓰지 않는다
const outDir = new URL('../test/eval/results/', import.meta.url);
mkdirSync(outDir, { recursive: true });
writeFileSync(new URL(`${providerName}${lang === 'en' ? '.en' : ''}${only ? `.only-${only}` : ''}.json`, outDir), JSON.stringify({
  provider: providerName, products: allProducts().length, cases: results.length, passed, passRate: pct(passed, results.length),
  groundingViolations: grounding.length, byCategory: byCat, results,
}, null, 2));
