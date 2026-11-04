// LLM 이 부를 수 있는 도구: 기존 검색 함수를 읽기 전용으로 감싼다. 제품 정보는 모두 DB 에서 나온다.
import { FINISH_LABELS, FAMILY_LABELS } from '../constants.js';
import { allProducts, findById, shortName } from '../catalog.js';
import { searchProducts, CHAT_VOCAB } from '../chat.js';

const FINISHES = Object.keys(FINISH_LABELS);
const FAMILIES = Object.keys(FAMILY_LABELS);
const list = (enumValues) => ({ type: 'array', items: { type: 'string', enum: enumValues } });

export const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: '등록된 립 제품을 조건으로 찾는다. 조건은 필요한 것만 넣는다. 결과에 없는 제품은 추천할 수 없다.',
      parameters: {
        type: 'object',
        properties: {
          finish: { type: 'string', enum: FINISHES, description: '제형: glossy 글로시(촉촉·윤기), matte 매트(보송), satin 새틴, velvet 벨벳' },
          exclude_finishes: { ...list(FINISHES), description: '빼야 할 제형' },
          families: { ...list(FAMILIES), description: `색 계열(이 중 하나): ${FAMILIES.map((f) => `${f} ${FAMILY_LABELS[f]}`).join(', ')}` },
          exclude_families: { ...list(FAMILIES), description: '빼야 할 색 계열' },
          brand: { type: 'string', description: '브랜드 이름(등록된 브랜드만)' },
          min_price: { type: 'integer', description: '최저 가격(원, 이상)' },
          max_price: { type: 'integer', description: '최고 가격(원, 이하)' },
          sort: { type: 'string', enum: ['cheapest', 'priciest'], description: '가격 낮은 순/높은 순' },
          tone: { type: 'string', enum: CHAT_VOCAB.tones, description: '퍼스널 톤' },
          situations: { ...list(CHAT_VOCAB.situations), description: '바를 상황·계절' },
          concerns: { ...list(CHAT_VOCAB.concerns), description: '입술 고민·원하는 느낌' },
          similar_to_reference: { type: 'boolean', description: '기준 제품/고른 색과 비슷한 순 (기준이 있을 때만)' },
          lightness: { type: 'string', enum: ['lighter', 'darker'], description: '기준 색보다 밝게/진하게 (기준이 있을 때만)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product',
      description: '제품 id 로 상세 정보를 본다.',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
];

// LLM 에게 보여 줄 제품 요약 (이름·가격은 고르는 데만 쓰고, 답변 글에는 직접 쓰지 않는다)
export const brief = (p) => ({
  id: p.id, name: shortName(p), finish: p.finish || null, family: p.color_family, price: p.price,
  lightness: Math.round(p.color_lab.L), ...(p.similarity !== undefined ? { similarity: p.similarity } : {}),
  description: (p.description || '').slice(0, 80),
});

/** 도구 인자 → 규칙 챗봇의 검색 조건 객체 */
export function toQuery(a = {}) {
  const q = {};
  if (FINISHES.includes(a.finish)) q.finish = a.finish;
  const fams = (a.families || []).filter((f) => FAMILIES.includes(f));
  if (fams.length) q.families = fams;
  const exF = (a.exclude_finishes || []).filter((f) => FINISHES.includes(f));
  const exC = (a.exclude_families || []).filter((f) => FAMILIES.includes(f));
  if (exF.length || exC.length) q.exclude = { finishes: exF, families: exC };
  if (a.brand) q.brand = a.brand;
  if (Number.isFinite(a.max_price)) q.maxPrice = { value: a.max_price, strict: false };
  if (Number.isFinite(a.min_price)) q.minPrice = { value: a.min_price, strict: false };
  if (a.sort === 'cheapest' || a.sort === 'priciest') q.superlative = a.sort;
  if (CHAT_VOCAB.tones.includes(a.tone)) q.tone = a.tone;
  const sit = (a.situations || []).filter((s) => CHAT_VOCAB.situations.includes(s));
  if (sit.length) q.situations = sit;
  const con = (a.concerns || []).filter((s) => CHAT_VOCAB.concerns.includes(s));
  if (con.length) q.concerns = con;
  if (a.similar_to_reference) q.similar = true;
  if (a.lightness === 'lighter' || a.lightness === 'darker') q.lightness = a.lightness;
  return q;
}

/**
 * 도구 실행. state 에 이번 턴에 도구가 돌려준 제품(허용 목록)과 마지막 검색을 모은다.
 * @returns {object} LLM 에게 돌려줄 결과
 */
export function runTool(name, args, input, state) {
  if (name === 'search_products') {
    const query = toQuery(args);
    if (query.brand && !allProducts().some((p) => p.brand === query.brand)) {
      return { error: `'${query.brand}' 는 등록된 브랜드가 아니에요. 이 브랜드 제품은 추천할 수 없어요.` };
    }
    const r = searchProducts(query, input);
    const top = r.scored.slice(0, 8);
    for (const p of top) state.seen.set(p.id, p);
    state.lastSearch = { query, total: r.scored.length, conditions: r.conditions, reasons: r.reasons };
    return { total: r.scored.length, conditions: r.conditions, notes: r.notes, products: top.map(brief) };
  }
  if (name === 'get_product') {
    const p = findById(String(args.id || ''));
    if (!p) return { error: '그런 id 의 제품은 없어요.' };
    state.seen.set(p.id, p);
    return { ...brief(p), description: p.description || '' };
  }
  return { error: `모르는 도구: ${name}` };
}
