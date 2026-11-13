// 규칙 챗봇: 조건으로 제품 찾기 (runSearch) 와 조건을 말로 되돌리기 (요약·다음 질문 문장).
import { FAMILY_LABELS } from './constants.js';
import { hexToLab, normalizeHex } from './color.js';
import { allProducts, findById, shortName } from './catalog.js';
import { withSimilarity } from './recommend.js';
import { SITUATIONS } from './situations.js';
import { SITUATIONS_EN, TONES_EN, CONCERNS_EN } from './chat-en.js';
import { TONES, CONCERNS } from './chat-words.js';
import { isEn, L, finL, famsL, won, shortOf, brandEn } from './chat-lang.js';

const LIGHTNESS_MARGIN = 2; // '더 밝은/진한 색': 기준 색과 명도(L*)가 이만큼은 달라야 한다

// 조건을 사람이 읽기 쉬운 말로 요약한다 (예: "데이트 · 글로시 · 20,000원 이하")
export function friendlySummary(q, { base }) {
  const parts = [];
  for (const s of q.situations || []) parts.push(L(s, SITUATIONS_EN[s]?.label || s));
  if (q.tone && TONES[q.tone]) parts.push(L(TONES[q.tone].label.endsWith('톤') ? TONES[q.tone].label : TONES[q.tone].label + ' 톤', TONES_EN[q.tone].label));
  if (q.mine) parts.push(L('측정한 내 톤', 'my measured tone'));
  for (const x of q.concerns || []) parts.push(L(x, CONCERNS_EN[x]?.label || x));
  if (q.families) parts.push(L(famsL(q.families) + ' 계열', famsL(q.families)));
  if (q.finish) parts.push(finL(q.finish));
  if (q.brand) parts.push(L(q.brand, brandEn(q.brand)));
  if (q.minPrice) parts.push(L(`${won(q.minPrice.value)} ${q.minPrice.strict ? '초과' : '이상'}`, `${q.minPrice.strict ? 'over' : 'from'} ${won(q.minPrice.value)}`));
  if (q.maxPrice) parts.push(L(`${won(q.maxPrice.value)} ${q.maxPrice.strict ? '미만' : '이하'}`, `${q.maxPrice.strict ? 'under' : 'up to'} ${won(q.maxPrice.value)}`));
  if (q.price === 'cheaper') parts.push(base ? L('기준 제품보다 저렴한', 'cheaper than the base product') : q.cheaperThan ? L('방금 본 것보다 저렴한', 'cheaper than the ones shown') : L('저렴한 순', 'cheapest first'));
  if (q.price === 'pricier') parts.push(base ? L('기준 제품보다 고급', 'pricier than the base product') : L('고급스러운', 'premium'));
  if (q.lightness) parts.push(q.lightness === 'lighter' ? L('더 밝은 색', 'lighter shade') : L('더 진한 색', 'deeper shade'));
  if (q.exclude?.families?.length) parts.push(L(famsL(q.exclude.families) + ' 빼고', 'no ' + famsL(q.exclude.families)));
  if (q.exclude?.finishes?.length) parts.push(L(q.exclude.finishes.map(finL).join('·') + ' 빼고', 'no ' + q.exclude.finishes.map(finL).join('/')));
  if (q.similar) parts.push(L('비슷한 색', 'similar color'));
  if (q.superlative) parts.push(q.superlative === 'cheapest' ? L('가격 낮은 순', 'cheapest first') : L('가격 높은 순', 'priciest first'));
  return parts.join(' · ');
}

const SEARCH_KEYS = ['finish', 'families', 'price', 'maxPrice', 'minPrice', 'similar', 'lightness', 'brand', 'tone', 'situations', 'concerns', 'exclude', 'superlative'];
export const searchPart = (c) => Object.fromEntries(SEARCH_KEYS.filter((k) => c[k] !== undefined).map((k) => [k, c[k]]));

// 조건을 다시 말로 만든다 (다음 질문 추천 칩에 사용)
export function phraseOf(q) {
  const parts = [];
  const amount = (v) => (v >= 10000 && v % 10000 === 0 ? v / 10000 + '만원' : won(v));
  if (q.minPrice) parts.push(`${amount(q.minPrice.value)} ${q.minPrice.strict ? '넘는' : '이상'}`);
  if (q.maxPrice) parts.push(`${q.maxPrice.value >= 10000 && q.maxPrice.value % 10000 === 0 ? q.maxPrice.value / 10000 + '만원' : won(q.maxPrice.value)} ${q.maxPrice.strict ? '미만' : '이하'}`);
  if (q.brand) parts.push(q.brand);
  if (q.finish) parts.push({ glossy: '글로시한', matte: '매트한', satin: '새틴', velvet: '벨벳' }[q.finish]);
  if (q.families) parts.push(q.families.map((f) => FAMILY_LABELS[f]).join(' '));
  return parts.length ? parts.join(' ') + ' 추천해 줘' : null;
}
// 영어판: 영어 해석기가 다시 알아듣는 문장으로 ("Recommend glossy coral lips under 20,000 won")
export function phraseOfEn(q) {
  const words = [q.brand ? brandEn(q.brand) : null, q.finish, ...(q.families || [])].filter(Boolean);
  const price = [q.minPrice ? `over ${q.minPrice.value.toLocaleString('en-US')} won` : null, q.maxPrice ? `under ${q.maxPrice.value.toLocaleString('en-US')} won` : null].filter(Boolean);
  return words.length || price.length ? `Recommend ${[...words, 'lips', ...price].join(' ')}` : null;
}

// 직접 말한 조건(제형·색 계열·브랜드·가격)으로 거른다. 적용한 조건은 conditions 에 적는다
function filterByConditions(list, q, base, conditions) {
  if (q.finish) {
    list = list.filter((p) => p.finish === q.finish);
    conditions.push(L(`제형 = ${finL(q.finish)}`, `Finish = ${finL(q.finish)}`));
  }
  if (q.exclude?.finishes?.length) {
    list = list.filter((p) => !q.exclude.finishes.includes(p.finish));
    conditions.push(L(`${q.exclude.finishes.map(finL).join('/')} 제외`, `No ${q.exclude.finishes.map(finL).join('/')}`));
  }
  if (q.families) {
    list = list.filter((p) => q.families.includes(p.color_family));
    conditions.push(L(`색상 계열 = ${famsL(q.families, '/')}`, `Color = ${famsL(q.families)}`));
  }
  if (q.exclude?.families?.length) {
    list = list.filter((p) => !q.exclude.families.includes(p.color_family));
    conditions.push(L(`${famsL(q.exclude.families, '/')} 제외`, `No ${famsL(q.exclude.families)}`));
  }
  if (q.brand) {
    list = list.filter((p) => p.brand === q.brand);
    conditions.push(L(`브랜드 = ${q.brand}`, `Brand = ${brandEn(q.brand)}`));
  }
  if (q.maxPrice) {
    const { value, strict } = q.maxPrice;
    list = list.filter((p) => (strict ? p.price < value : p.price <= value));
    conditions.push(`${L('가격', 'Price')} ${strict ? '<' : '≤'} ${won(value)}`);
  }
  if (q.minPrice) {
    const { value, strict } = q.minPrice;
    list = list.filter((p) => (strict ? p.price > value : p.price >= value));
    conditions.push(`${L('가격', 'Price')} ${strict ? '>' : '≥'} ${won(value)}`);
  }
  if (q.price === 'cheaper') {
    if (base) {
      list = list.filter((p) => p.price < base.price);
      conditions.push(L(`가격 < 기준 제품 ${won(base.price)}`, `Price < base product ${won(base.price)}`));
    } else if (q.cheaperThan) {
      list = list.filter((p) => p.price < q.cheaperThan);
      conditions.push(L(`가격 < 방금 보여 드린 제품 최저가 ${won(q.cheaperThan)}`, `Price < lowest shown ${won(q.cheaperThan)}`));
    } else conditions.push(L('가격 낮은 순', 'Cheapest first'));
  } else if (q.price === 'pricier') {
    if (base) {
      list = list.filter((p) => p.price > base.price);
      conditions.push(L(`가격 > 기준 제품 ${won(base.price)}`, `Price > base product ${won(base.price)}`));
    } else conditions.push(L('가격 높은 순', 'Priciest first'));
  }
  return list;
}

// 상황·톤·고민 → 추천 성향 (명시한 계열/제형이 없을 때만)
// 맞는 제품이 없으면 그 성향은 빼고 찾는다 (notes 에 적는다)
function applyPreferences(list, q, toneHint, { conditions, reasons, notes, tips }) {
  const prefs = [];
  // en: 영어 이름·이유·요령 (chat-en.js)
  for (const label of q.situations || []) prefs.push({ ...SITUATIONS.find((s) => s.label === label), en: SITUATIONS_EN[label] });
  const toneKey = q.tone || (q.mine ? toneHint : null);
  if (toneKey && TONES[toneKey]) {
    prefs.push({ ...TONES[toneKey], label: q.tone ? TONES[toneKey].label : `측정한 ${TONES[toneKey].label}`,
      en: { ...TONES_EN[toneKey], label: TONES_EN[toneKey].label + (q.tone ? '' : ' (measured)') } });
  }
  for (const label of q.concerns || []) prefs.push({ ...CONCERNS.find((x) => x.label === label), en: CONCERNS_EN[label] });
  for (const pref of prefs) {
    let used = false;
    if (pref.families && !q.families) {
      const next = list.filter((p) => pref.families.includes(p.color_family));
      if (next.length) { list = next; used = true; }
    }
    if (pref.finishes && !q.finish) {
      const next = list.filter((p) => pref.finishes.includes(p.finish));
      if (next.length) { list = next; used = true; }
    }
    // 그 자리에서 피하는 게 좋은 색·제형 (손님이 직접 말한 건 빼지 않는다). 빼면 아무것도 안 남을 땐 두고 찾는다
    const avoidFam = (pref.avoidFamilies || []).filter((f) => !q.families?.includes(f));
    const avoidFin = (pref.avoidFinishes || []).filter((f) => q.finish !== f);
    if (avoidFam.length || avoidFin.length) {
      const next = list.filter((p) => !avoidFam.includes(p.color_family) && !avoidFin.includes(p.finish));
      if (next.length) { list = next; used = true; }
    }
    if (used) {
      conditions.push(L(`${pref.label} 추천`, `For ${pref.en?.label || pref.label}`));
      // 직접 말한 제형·색이 이 성향의 추천과 다르면 설명이 엇갈리므로 이유는 말하지 않는다 (예: 데이트인데 매트, 면접인데 레드)
      const finishClash = q.finish && pref.finishes && !pref.finishes.includes(q.finish);
      const familyClash = q.families && pref.families && !q.families.every((f) => pref.families.includes(f));
      if (!finishClash && !familyClash) reasons.push(L(pref.reason, pref.en?.reason || pref.reason));
      if (pref.tip && !finishClash && !familyClash) tips.push(L(pref.tip, pref.en?.tip || pref.tip)); // 요령도 직접 고른 것과 엇갈리면 뺀다
    } else notes.push(L(`${pref.label} 성향과 겹치는 제품이 없어 그 조건은 빼고 찾았어요.`, `Nothing matched "${pref.en?.label || pref.label}", so I searched without it.`));
  }
  return list;
}

// 정렬: 최저가/최고가 요청 > 기준 색상과 유사한 순 > 가격 순 > ID 순
function sortByRequest(list, q, { base, ref }, conditions) {
  const refLab = ref ? hexToLab(ref.hex) : null;
  let scored = refLab ? list.map((p) => withSimilarity(p, refLab)) : list.map((p) => ({ ...p }));
  if (q.superlative) {
    scored.sort((a, b) => (q.superlative === 'cheapest' ? a.price - b.price : b.price - a.price) || a.id.localeCompare(b.id));
    conditions.push(q.superlative === 'cheapest' ? L('가격 낮은 순', 'Cheapest first') : L('가격 높은 순', 'Priciest first'));
  } else if (refLab && (q.similar || !q.price || base)) {
    scored.sort((a, b) => a.delta_e - b.delta_e || a.price - b.price);
    conditions.push(L(`${ref.label}과(와) 유사한 순`, `Closest to ${ref.label}`));
  } else if (q.price === 'pricier') {
    scored.sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
  } else if (q.price === 'cheaper' || q.maxPrice || q.minPrice) {
    scored.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  } else {
    scored.sort((a, b) => a.id.localeCompare(b.id));
  }
  return scored;
}

// 조건으로 제품을 찾는다. 상황·톤·고민은 말하지 않은 계열/제형만 대신 정하고, 맞는 제품이 없으면 그 성향은 뺀다
export function runSearch(q, { products, base, ref, toneHint }) {
  const conditions = [];
  const reasons = [];
  const notes = [];
  const tips = []; // 상황별 요령 (situations.js 의 tip)
  let list = products.filter((p) => !base || p.id !== base.id);
  list = filterByConditions(list, q, base, conditions);
  list = applyPreferences(list, q, toneHint, { conditions, reasons, notes, tips });

  if ((q.similar || q.lightness) && !ref) {
    notes.push(L('기준 색상이 없어 색 비교는 못 했어요. 바코드로 제품을 찍거나 팔레트에서 색을 만든 뒤 물어봐 주세요.', 'There is no reference color to compare with. Scan a product barcode or mix a color on the palette, then ask again.'));
  }
  if (q.lightness && ref) {
    const refL = hexToLab(ref.hex).L;
    list = list.filter((p) => (q.lightness === 'lighter' ? p.color_lab.L > refL + LIGHTNESS_MARGIN : p.color_lab.L < refL - LIGHTNESS_MARGIN));
    conditions.push(isEn() ? `${q.lightness === 'lighter' ? 'Lighter' : 'Deeper'} than reference (L* ${refL.toFixed(1)})` : `${q.lightness === 'lighter' ? '더 밝은' : '더 어두운'} 색 (기준 명도 L* ${refL.toFixed(1)})`);
  }

  let scored = sortByRequest(list, q, { base, ref }, conditions);
  // 기준 색상이 없을 때 '비슷한 색상'만 요청했다면 결과를 내지 않는다
  const onlyUnmetColor = !ref && (q.similar || q.lightness) && conditions.length === 0;
  if (onlyUnmetColor) scored = [];
  return { scored, conditions, reasons, notes, tips, onlyUnmetColor };
}

// 결과가 없을 때: 조건을 하나씩 빼 보고 결과가 생기는 조건을 알려 준다
export function relaxHint(q, env) {
  const tries = [
    ['maxPrice', L('가격 조건', 'price limit')], ['minPrice', L('가격 조건', 'price limit')], ['brand', L('브랜드 조건', 'brand')], ['finish', L('제형 조건', 'finish')], ['families', L('색상 계열 조건', 'color family')], ['lightness', L('밝기 조건', 'lightness')],
  ];
  for (const [key, label] of tries) {
    if (q[key] === undefined) continue;
    const { [key]: _, ...rest } = q;
    const n = runSearch(rest, env).scored.length;
    if (n) return { text: L(`${label}을 빼면 ${n}개가 있어요.`, `Without the ${label}, there are ${n}.`), phrase: isEn() ? phraseOfEn(rest) : phraseOf(rest) };
  }
  return null;
}

// 검색에 쓰는 환경(대상 제품·기준 제품·기준 색·방금 보여 준 제품·측정한 톤). answer() 와 LLM 층(searchProducts)이 같이 쓴다
export function buildEnv({ baseProductId = null, selectedHex = null, context = null, tone = null, imageOnly = false }) {
  // 영어로 답할 때는 글로벌 올리브영 영어 이름이 있는 제품 안에서만 찾는다 (영어 이름을 지어내지 않고, 한국어 이름이 섞이지 않게)
  const products = (imageOnly ? allProducts().filter((p) => p.image_url) : allProducts()).filter((p) => !isEn() || p.name_en);
  const base = baseProductId ? findById(baseProductId) : null;
  const selHex = normalizeHex(selectedHex || '');
  const shown = ((context && typeof context === 'object' ? context.shown : null) || []).map(findById).filter(Boolean);
  const toneHint = TONES[tone] ? tone : null;
  let ref = null;
  if (base) ref = { hex: base.color_hex, label: L(`기준 제품(${shortName(base)}) 색상 ${base.color_hex}`, `the base product (${shortOf(base)}) ${base.color_hex}`) };
  else if (selHex) ref = { hex: selHex, label: L(`립 컬러 매핑 선택 색상 ${selHex}`, `your chosen color ${selHex}`) };
  return { products, base, ref, shown, toneHint };
}

/**
 * 규칙 챗봇과 같은 검색을 조건 객체로 직접 실행한다 (LLM 층의 search_products 도구가 쓴다).
 * @param {object} query parseMessage 결과와 같은 모양의 검색 조건 (finish, families, maxPrice, ...)
 */
export function searchProducts(query, input = {}) {
  return runSearch(query, buildEnv(input));
}
