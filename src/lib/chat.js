// 규칙 기반 뷰티 챗봇. 외부 AI API 를 사용하지 않는다.
// 메시지에서 조건(제형/가격/색상 계열/유사 색상/밝기/브랜드)과 상황·퍼스널 톤·입술 고민을 추출해 제품 데이터에서 검색한다.
// 직전 대화(context)를 받아 "그중에 제일 싼 거", "두 번째 거 자세히", "더 보여 줘", "매트 말고" 같은 이어지는 질문에도 답한다.
// 파일 구성: chat-words.js(단어 사전) · chat-parse.js(말 해석) · chat-search.js(제품 찾기) · chat-reply.js(답 문장) · chat-lang.js(언어·표기)
//           이 파일은 대화 흐름(answer)만 맡고, 바깥에서 쓰는 함수는 여기서 다시 내보낸다.
import { allProducts, findNamedProduct, shadesOf } from './catalog.js';
import { SITUATIONS } from './situations.js';
import { BRAND_ALIASES } from './aliases.js';
import { parseMessageEn, offTopicReplyEn, moodEn, GENERIC_ACKS_EN } from './chat-en.js';
import { has, MOODS, GENERIC_ACKS } from './chat-words.js';
import { isEn, setEn, L, finL, won, nameOf, shortOf, josa, euro, ord } from './chat-lang.js';
import { parseMessage, normalizeForChat } from './chat-parse.js';
import { runSearch, relaxHint, buildEnv, friendlySummary, searchPart, phraseOf, phraseOfEn } from './chat-search.js';
import { offTopicReply, openerFor, compareSummary, resultSuggestions, startSuggestions } from './chat-reply.js';

export { PII_RE, CHAT_VOCAB } from './chat-words.js';
export { josa } from './chat-lang.js';
export { parseMessage, normalizeForChat, chatKeepWords, chatAliases, chatVocab } from './chat-parse.js';
export { searchProducts } from './chat-search.js';
export { compareSummary, resultSuggestions } from './chat-reply.js';

// 영어로 브랜드를 부르는 이름들: 글로벌 표기(brand_en) + 말소리 별칭 중 영어 (예: 롬앤 ← rom&nd, romand)
function brandIndexEn(brands) {
  const en = new Map();
  const named = new Set(); // 영어 이름이 붙은 제품이 하나라도 있는 브랜드
  for (const p of allProducts()) {
    if (p.brand_en) en.set(p.brand, p.brand_en);
    if (p.name_en) named.add(p.brand);
  }
  return brands.map((ko) => ({
    ko,
    noEn: !named.has(ko),
    names: [...new Set([en.get(ko), ...(BRAND_ALIASES[ko] || []).filter((a) => /^[\x20-\x7e]+$/.test(a)), /^[\x20-\x7e]+$/.test(ko) ? ko : null].filter(Boolean))],
  }));
}

/**
 * @param {object} input
 * @param {string} input.message
 * @param {string} [input.baseProductId] 바코드 검색 등에서 전달된 기준 제품
 * @param {string} [input.selectedHex] 립 컬러 매핑에서 선택한 색상
 * @param {object} [input.context] 직전 대화 상태(이전 응답의 context 를 그대로 돌려준다)
 * @param {string} [input.tone] 립 컬러 매핑에서 측정한 퍼스널 톤(spring/summer/autumn/winter)
 * @param {'ko'|'en'} [input.lang] 묻고 답하는 언어 (영어면 chat-en.js 로 알아듣고 영어로 답한다)
 */
// imageOnly: 대표 이미지가 있는 제품만 추천 대상으로 쓴다 (테스트용 '이미지ver.' 버튼)
export function answer({ message, baseProductId = null, selectedHex = null, limit = 5, context = null, tone = null, imageOnly = false, lang = 'ko' }) {
  setEn(lang === 'en');
  const { products, base, ref, shown, toneHint } = buildEnv({ baseProductId, selectedHex, context, tone, imageOnly });
  const brands = [...new Set(allProducts().map((p) => p.brand))];
  // 말·입력 보정: 한글 금액("만 오천 원")과 비슷한 발음("그로시" → "글로시")을 챗봇이 아는 말로 바꾼 뒤 해석한다 (영어는 그대로)
  const spoken = isEn() ? { text: String(message || '').trim(), corrections: [] } : normalizeForChat(message, brands);
  const heard = spoken.corrections.length
    ? `${spoken.corrections.map((x) => `'${x.to}'`).join(', ')}${euro(spoken.corrections.at(-1).to)} 알아들었어요. `
    : '';
  const c = isEn() ? parseMessageEn(spoken.text, brandIndexEn(brands), { situations: SITUATIONS }) : parseMessage(spoken.text, brands);
  const ctx = context && typeof context === 'object' ? context : {};
  // 기준 색상: 기준 제품 > 립 컬러 매핑 선택 색상 (buildEnv)
  const env = { products, base, ref, shown, toneHint };

  const out = (o) => ({
    reply: heard + o.reply,
    conditions: o.conditions || [],
    products: o.products || [],
    base,
    total: o.total,
    understood: spoken.text,
    corrections: spoken.corrections,
    suggestions: o.suggestions || [],
    action: o.action || null,
    kind: o.kind || null, // 'compare' 면 화면에서 비교표로 보여 준다
    unsure: !!o.unsure, // 규칙으로는 뜻을 못 잡은 답 (못 알아들음·막연한 불만·기준 색 없는 색 비교): LLM 층이 대신 답해 볼 수 있다
    context: o.context || ctx,
  });

  const q = searchPart(c);
  const isSearch = Object.keys(q).length > 0 || (c.mine && toneHint);

  // 질문 종류별로 차례로 물어본다: 먼저 답하는 갈래가 있으면 그 답으로 끝난다
  const turn = { c, q, ctx, env, base, ref, shown, toneHint, products, brands, spoken, limit, isSearch, out };
  for (const reply of DIRECT_REPLIES) {
    const answered = reply(turn);
    if (answered) return answered;
  }
  const talk = lightTalk(turn);
  if (talk.answer) return talk.answer;
  return searchReply(turn, talk.bridge);
}

// ---------- 방금 보여 드린 제품을 가리키는 질문 ("두 번째 거", "1번이랑 2번 비교") ----------
function replyAboutShownProduct(turn) {
  const { c, base, shown, out } = turn;
  if (c.ordinals) {
    if (!shown.length) {
      return out({ reply: L('아직 보여 드린 제품이 없어요. 찾는 립을 먼저 말씀해 주세요.', "I haven't shown any products yet. Tell me what lip you're looking for first."), suggestions: startSuggestions() });
    }
    const items = c.ordinals.map((i) => ({ i: i < 0 ? shown.length - 1 : i })).map(({ i }) => ({ i, p: shown[i] }));
    const missing = items.find((x) => !x.p);
    if (missing) {
      return out({ reply: L(`${ord(missing.i)} 제품은 없어요. 지금 목록은 ${shown.length}개예요.`, `There is no ${ord(missing.i)} product. The list has ${shown.length}.`), suggestions: [L('첫 번째 거 자세히 알려 줘', 'Tell me more about the first one')] });
    }
    if (items.length >= 2 || c.compare) {
      const pair = items.length >= 2 ? items.slice(0, 2) : [items[0], { i: items[0].i === 0 ? 1 : 0, p: shown[items[0].i === 0 ? 1 : 0] }];
      if (!pair[1].p) return out({ reply: L('비교하려면 제품이 두 개 이상 있어야 해요.', 'I need at least two products to compare.') });
      const [a, b] = pair;
      return out({
        reply: compareSummary([a.p, b.p]),
        products: [a.p, b.p],
        kind: 'compare',
        suggestions: isEn() ? [`Tell me more about the ${ord(a.i)} one`, `Tell me more about the ${ord(b.i)} one`, 'Show more'] : [`${ord(a.i)} 거 자세히 알려 줘`, `${ord(b.i)} 거 자세히 알려 줘`, '다른 거 더 보여 줘'],
      });
    }
    const { i, p } = items[0];
    if (c.pickBase) {
      return out({
        reply: L(`${josa(shortOf(p), '을', '를')} 기준 제품으로 정했어요. "더 저렴한 거", "비슷한 색"처럼 물어보세요.`, `${shortOf(p)} is now the base product. Try asking "something cheaper" or "similar colors".`),
        action: { type: 'setBase', id: p.id },
        suggestions: L(['비슷한 색 더 보기', '더 저렴한 걸로', '더 밝은 색'], ['Find similar colors', 'Something cheaper', 'A lighter shade']),
      });
    }
    const parts = [];
    if (c.askPrice && !c.askInfo) parts.push(L(`${josa(shortOf(p), '은', '는')} ${won(p.price)}이에요.`, `${shortOf(p)} is ${won(p.price)}.`));
    else if (c.askFinish && !c.askInfo) {
      parts.push(p.finish
        ? L(`${josa(shortOf(p), '은', '는')} ${finL(p.finish)} 제형이에요.`, `${shortOf(p)} has a ${finL(p.finish).toLowerCase()} finish.`)
        : L(`${josa(shortOf(p), '은', '는')} 제형 정보가 없어요. 상세 페이지에서 확인해 주세요.`, `There is no finish info for ${shortOf(p)}. Please check the details page.`));
    } else {
      // 설명(description)은 한국어로만 수집돼 영어 답에는 넣지 않는다. 가운뎃점 나열 대신 문장으로 (읽기 쉽게)
      parts.push(L(`${josa(nameOf(p), '은', '는')} ${p.finish ? `${finL(p.finish)} 제형이고, ` : ''}가격은 ${won(p.price)}이에요.`,
        `${nameOf(p)} ${p.finish ? `has a ${finL(p.finish).toLowerCase()} finish and ` : ''}costs ${won(p.price)}.`), isEn() ? '' : p.description,
        p.color_options ? L(`화면 색은 ${p.color_options}가지 색 중 대표색이에요.`, `The color shown is one of ${p.color_options} shades.`) : '');
      if (p.similarity !== undefined) parts.push(L(`${base ? '기준 제품' : '고른 색'}과 ${p.similarity}% 비슷해요.`, `${p.similarity}% similar to ${base ? 'the base product' : 'your color'}.`));
    }
    return out({
      reply: parts.filter(Boolean).join(' '),
      products: [p],
      suggestions: (isEn()
        ? [shown.length >= 2 ? `Compare the first and ${ord(i === 0 ? 1 : i)}` : null, 'Which is the cheapest of those?', 'Show more']
        : [`${ord(i)} 거 기준으로 골라 줘`, shown.length >= 2 ? `첫 번째랑 ${ord(i === 0 ? 1 : i)} 비교해 줘` : null, '다른 거 더 보여 줘']).filter(Boolean),
    });
  }
  return null;
}

// ---------- 제품 이름을 부른 말 ("페리페라 잉크 더 에어리 벨벳 틴트") → 그 제품 하나를 보여 준다 ----------
function replyNamedProduct(turn) {
  const { ctx, spoken, out } = turn;
  const named = findNamedProduct(spoken.text);
  if (named) {
    const shades = shadesOf(named);
    // 호수가 있는 제품은 카드에 '색상 보기'가 붙는다. 제품 하나를 가리키므로 호수 이름은 뺀다
    const card = shades.length ? { ...named, shade_name: null, shade_count: shades.length } : named;
    const name = shortOf(card);
    const reply = shades.length
      ? L(`${josa(name, '을', '를')} 찾았어요. 색이 ${shades.length}가지 있어요. '색상 보기'를 누르면 호수와 색 이름을 한 화면에서 볼 수 있어요.`,
        `Found ${name}. It comes in ${shades.length} shades. Tap "See shades" to view every shade number and name on one screen.`)
      : L(`${josa(name, '을', '를')} 찾았어요.${named.color_options ? ` 색은 ${named.color_options}가지예요.` : ''} 호수별 색 정보는 아직 등록되지 않았어요.`,
        `Found ${name}.${named.color_options ? ` It comes in ${named.color_options} shades.` : ''} Individual shade info isn't registered yet.`);
    return out({
      reply, products: [card],
      context: { ...ctx, shown: [card.id], offset: 0 },
      suggestions: L(['첫 번째 거 자세히 알려 줘', '데일리 립 추천해 줘'], ['Tell me more about the first one', 'Recommend an everyday lip']),
    });
  }
  return null;
}

// ---------- "그중에 제일 싼 거" (방금 보여 드린 목록 안에서) ----------
function replyRankAmongShown(turn) {
  const { c, q, shown, out } = turn;
  const onlyRank = Object.keys(q).every((k) => k === 'superlative');
  if (c.superlative && shown.length && (c.among || onlyRank)) {
    const sorted = [...shown].sort((a, b) => (c.superlative === 'cheapest' ? a.price - b.price : b.price - a.price));
    const p = sorted[0];
    const i = shown.findIndex((x) => x.id === p.id);
    return out({
      reply: L(`가장 ${c.superlative === 'cheapest' ? '저렴한' : '비싼'} 건 ${ord(i)} ${josa(shortOf(p), '이에요', '예요')}. 가격은 ${won(p.price)}이에요.`,
        `The ${c.superlative === 'cheapest' ? 'cheapest' : 'priciest'} is the ${ord(i)} one, ${shortOf(p)}, at ${won(p.price)}.`),
      products: [p],
      suggestions: L([`${ord(i)} 거 자세히 알려 줘`, `${ord(i)} 거 기준으로 골라 줘`, '다른 거 더 보여 줘'], [`Tell me more about the ${ord(i)} one`, 'Show more']),
    });
  }
  return null;
}

// ---------- 등록되지 않은 브랜드 ("샤넬 립 추천해 줘"): 다른 제품을 대신 내밀지 않는다 ----------
function replyUnknownBrand(turn) {
  const { c, q, products, brands, out } = turn;
  if (c.unknownBrand) {
    const { brand: _, ...rest } = q;
    const phrase = isEn() ? phraseOfEn(rest) : phraseOf(rest);
    return out({
      reply: L(`'${c.unknownBrand}' 제품은 아직 등록되어 있지 않아요. 지금은 ${brands.length}개 브랜드, 올리브영 립 제품 ${products.length}개 안에서 찾을 수 있어요.`,
        `${c.unknownBrand} isn't registered yet. I can search ${products.length} OLIVE YOUNG lip products from ${new Set(products.map((p) => p.brand)).size} brands.`),
      suggestions: [phrase, ...L(['데일리로 바를 립 추천해 줘', '2만원 이하 추천해 줘'], ['Recommend an everyday lip', 'Under 20,000 won'])].filter(Boolean),
    });
  }
  return null;
}

// ---------- 왜 이렇게 골랐는지 ----------
function replyWhy(turn) {
  const { c, ctx, env, ref, isSearch, out } = turn;
  if (c.why && !isSearch) {
    if (!ctx.lastConditions?.length) return out({ reply: L('아직 추천한 제품이 없어요. 찾는 립을 먼저 말씀해 주세요.', "I haven't recommended anything yet. Tell me what lip you're looking for first."), suggestions: startSuggestions() });
    const summary = ctx.query ? friendlySummary(ctx.query, env) : '';
    return out({
      reply: (isEn()
        ? `${summary ? `I picked them for: ${summary}. ` : ''}${(ctx.lastReasons || []).join(' ')} ${ref ? 'They are ordered by closeness to the reference color.' : ''}`
        : `${summary ? `'${summary}' 조건으로 골랐어요. ` : ''}${(ctx.lastReasons || []).join(' ')} ${ref ? '기준 색과 가까운 순서예요.' : ''}`).replace(/\s+/g, ' ').trim(),
      suggestions: L(['다른 거 더 보여 줘', '이 중에 제일 싼 거'], ['Show more', 'Which is the cheapest of those?']),
    });
  }
  return null;
}

// ---------- 더 보여 줘 (같은 조건으로 다음 결과) ----------
function replyMore(turn) {
  const { c, ctx, env, limit, isSearch, out } = turn;
  if (c.more && !isSearch && ctx.query) {
    const offset = (ctx.offset || 0) + limit;
    const r = runSearch(ctx.query, env);
    const page = r.scored.slice(offset, offset + limit);
    if (!page.length) {
      return out({ reply: L('이 조건의 제품은 여기까지예요. 조건을 바꿔 보세요.', "That's all for these conditions. Try changing them."), suggestions: L(['촉촉한 글로시로', '더 저렴한 걸로', '데일리 립 추천해 줘'], ['Switch to glossy', 'Something cheaper', 'Recommend an everyday lip']) });
    }
    return out({
      reply: L(`다음 ${page.length}개예요. 전체 ${r.scored.length}개 중 ${offset + 1}~${offset + page.length}번째예요.`, `Here are ${page.length} more, ${offset + 1} to ${offset + page.length} of ${r.scored.length}.`),
      conditions: r.conditions, products: page, total: r.scored.length,
      suggestions: resultSuggestions(page, ctx.query, r.scored.length > offset + limit, !!env.ref),
      context: { ...ctx, shown: page.map((p) => p.id), offset },
    });
  }
  return null;
}

// 기준 제품 정보 질문 (검색 조건이 없을 때)
function replyBaseProductInfo(turn) {
  const { c, base, isSearch, out } = turn;
  if (!isSearch && base && (c.askPrice || c.askFinish || c.askBarcode || c.askInfo)) {
    const parts = [];
    if (c.askPrice) parts.push(L(`${josa(shortOf(base), '은', '는')} ${won(base.price)}이에요.`, `${shortOf(base)} is ${won(base.price)}.`));
    if (c.askFinish) parts.push(base.finish ? L(`제형은 ${finL(base.finish)}이에요.`, `The finish is ${finL(base.finish).toLowerCase()}.`) : L('이 제품은 제형 정보가 없어요.', 'There is no finish info for it.'));
    if (c.askBarcode) parts.push(base.barcode ? L(`바코드 번호는 ${base.barcode}예요.`, `The barcode is ${base.barcode}.`) : L('이 제품은 바코드 정보가 없어요.', 'There is no barcode info for this product.'));
    if (c.askInfo) parts.push(L(`${josa(nameOf(base), '이에요', '예요')}.`, `This is ${nameOf(base)}.`), isEn() ? '' : base.description);
    return out({ reply: parts.filter(Boolean).join(' '), suggestions: L(['비슷한 색 더 보기', '더 저렴한 걸로', '더 밝은 색'], ['Find similar colors', 'Something cheaper', 'A lighter shade']) });
  }
  return null;
}

// ---------- 나에게 어울리는 립 (퍼스널 톤을 모를 때는 되묻는다) ----------
function askPersonalTone(turn) {
  const { c, q, toneHint, out } = turn;
  if (c.mine && !c.tone && !toneHint && !q.families) {
    return out({
      reply: L('퍼스널 톤을 알려 주세요. 웜톤인지 쿨톤인지 말씀하시거나, 팔레트의 "내 톤으로 추천받기"로 톤을 재 볼 수도 있어요.', 'Tell me your personal tone: warm or cool. You can also measure it with "Find my tone" on the palette.'),
      suggestions: L(['웜톤이에요', '쿨톤이에요', '봄 웜', '겨울 쿨', '잘 모르겠어요'], ['I have a warm tone', 'I have a cool tone', 'Spring warm lips', 'Winter cool lips', 'Not sure']),
    });
  }
  return null;
}

// 검색 조건 없이도 바로 답하는 갈래들 (위에서부터 차례로, 답이 없으면 null)
const DIRECT_REPLIES = [replyAboutShownProduct, replyNamedProduct, replyRankAmongShown, replyUnknownBrand, replyWhy, replyMore, replyBaseProductInfo, askPersonalTone];

// ---------- 가벼운 대화: 되묻기보다 부드럽게 받아서 추천으로 잇는다 ----------
// 돌려주는 값: { answer } 그대로 답하고 끝 / { bridge } 이 조건으로 대신 찾고 답 앞에 한마디(ack)를 붙인다
function lightTalk(turn) {
  const { c, shown, toneHint, spoken, isSearch, out } = turn;
  let bridge = null; // { query, ack, unsure }: 검색 조건이 없는 말을 이 조건으로 대신 찾고, 답 앞에 ack 를 붙인다
  if (!isSearch) {
    const off = isEn() ? offTopicReplyEn(spoken.text) : offTopicReply(spoken.text.toLowerCase());
    if (off) return { answer: out(off) };
    const mood = isEn() ? moodEn(spoken.text) : MOODS.find((m) => has(spoken.text, m.words));
    if (mood) bridge = { query: mood.query, ack: mood.ack };
  }
  if (!isSearch && !bridge) {
    const small = isEn() ? {
      greet: 'Hello! Tell me the color, feel or price range you have in mind.',
      thanks: 'Let me know if you need anything else.',
      bye: 'Have a lovely day!',
      identity: "I'm Took, an AI assistant that helps you find lip colors. I'm not a person. I pick matching lips from the registered products using set rules.",
      help: 'For example: "a glossy coral under 20,000 won", "lips for an interview", "cool tone lips", "my lips are dry". After that, try "the cheapest of those", "tell me about the second one", "show more" or "no matte".',
      like: 'I can also find other colors or price ranges.',
      dislike: 'Oh, not quite right? Tell me what fell short, like the color, price or finish, and I will pick again.',
    }[c.small] : {
      greet: '안녕하세요. 찾는 색이나 원하는 느낌, 가격대를 말씀해 주세요.',
      thanks: '더 필요한 게 있으면 말씀해 주세요.',
      bye: '좋은 하루 보내세요.',
      identity: '립 색을 같이 찾아 드리는 AI 도우미 툭이에요. 사람이 아니고, 외부 AI 없이 등록된 립 제품 중에서 정해진 규칙으로 조건에 맞는 걸 찾아 드려요.',
      help: '예: "2만원 이하 글로시한 코랄", "면접 립", "쿨톤 립", "입술이 건조해". 추천 뒤엔 "그중 제일 싼 거", "두 번째 거 자세히", "더 보여 줘", "매트 말고"처럼 물어봐도 돼요.',
      like: '다른 색이나 가격대도 찾아 드릴 수 있어요.',
      dislike: '앗, 마음에 안 드셨군요. 색, 가격, 제형 중 어떤 게 아쉬웠는지 말씀해 주시면 다시 골라 볼게요.',
    }[c.small];
    if (small) {
      const sugg = {
        like: shown.length ? L(['그중에 제일 싼 거는?', '다른 거 더 보여 줘'], ['Which is the cheapest of those?', 'Show more']) : startSuggestions(),
        dislike: L(['더 밝은 색 추천해 줘', '더 저렴한 걸로', '다른 거 보여 줘', '매트 말고 글로시로'], ['A lighter shade', 'Something cheaper', 'Show others', 'No matte, glossy instead']),
        bye: [],
      }[c.small] || startSuggestions();
      return { answer: out({ reply: small, suggestions: sugg, unsure: c.small === 'dislike' }) };
    }
    // 알아듣지 못한 말: "잘 못 알아들었어요" 대신 한마디 받고 무난한 립(측정한 톤이 있으면 그 톤)을 보여 준다.
    // 규칙이 뜻을 잡은 건 아니므로 unsure (LLM 층을 켜 두면 LLM 이 대신 답해 본다)
    bridge = {
      query: toneHint ? { mine: true } : { situations: ['데일리'] },
      ack: c.compare ? L('비교하려면 먼저 제품이 있어야 해요. 무난한 립부터 보여 드릴게요.', 'I need products to compare first. Here are some easy picks.')
        : toneHint ? L('좋아요, 그럼 측정한 톤에 어울리는 립으로 골라 볼게요.', 'Okay, let me pick lips that suit your measured tone.')
          : (isEn() ? GENERIC_ACKS_EN : GENERIC_ACKS)[spoken.text.length % GENERIC_ACKS.length],
      unsure: true,
    };
  }
  return { bridge };
}

// ---------- 조건 검색 (이전 조건에 이어서 바꾸는 말이면 합친다: "글로시한 걸로", "매트 말고") ----------
function searchReply(turn, bridge) {
  const { c, q, ctx, env, base, shown, toneHint, limit, out } = turn;
  let query = bridge ? bridge.query : q;
  if (!bridge && ctx.query && (c.refine || (!q.families && !q.tone && !q.situations && !q.concerns && !q.brand && (q.finish || q.price || q.maxPrice || q.minPrice || q.exclude || q.lightness)))) {
    query = { ...ctx.query, ...q };
    if (q.exclude?.families?.length && query.families) {
      query.families = query.families.filter((f) => !q.exclude.families.includes(f));
      if (!query.families.length) delete query.families;
    }
    if (q.exclude?.finishes?.length && query.finish && q.exclude.finishes.includes(query.finish)) delete query.finish;
  }
  if (c.mine && toneHint && !query.tone) query = { ...query, mine: true };
  // 기준 제품 없이 "더 저렴한 거" → 방금 보여 드린 제품보다 싼 것
  if (query.price === 'cheaper' && !base && shown.length && c.price === 'cheaper') query = { ...query, cheaperThan: Math.min(...shown.map((p) => p.price)) };

  const r = runSearch(query, env);
  const total = r.scored.length;
  const page = r.scored.slice(0, limit);
  const nextCtx = { query, shown: page.map((p) => p.id), offset: 0, lastConditions: r.conditions, lastReasons: r.reasons, turn: (ctx.turn || 0) + 1, lastOpener: ctx.lastOpener || null, lastCloser: ctx.lastCloser || null };

  let reply;
  let suggestions;
  if (r.onlyUnmetColor) {
    reply = r.notes.join(' ');
    suggestions = startSuggestions();
  } else if (total === 0) {
    const hint = relaxHint(query, env);
    const summary = friendlySummary(query, env);
    reply = isEn()
      ? `No products match ${summary ? `"${summary}"` : 'that'}. ${hint ? hint.text : 'Try asking with fewer conditions.'}`
      : `${summary ? `'${summary}' 조건에 ` : ''}맞는 제품이 없어요. ${hint ? hint.text : '조건을 줄여서 다시 물어봐 주세요.'}`;
    suggestions = [hint?.phrase, ...L(['데일리 립 추천해 줘', '2만원 이하로'], ['Recommend an everyday lip', 'Under 20,000 won'])].filter(Boolean);
  } else {
    // 말투: 인사·감탄과 "몇 개 찾았어요" 같은 보고 없이, 첫 문장에 가장 추천하는 제품과 핵심 정보(제형·가격·유사도)를 둔다.
    // 이유는 한 문장만. 개수는 목록과 '더 보여 줘'가 대신 보여 준다
    const top = page[0];
    // 말풍선엔 괄호를 쓰지 않는다 (2026-11-11): 제형·가격은 제품 카드에 있고, 유사도만 한 문장으로 덧붙인다. 가격을 물으면 따로 답한다
    reply = (isEn()
      ? `My top pick is ${shortOf(top)}.` + (top.similarity !== undefined ? ` It's ${top.similarity}% similar to ${base ? 'the base product' : 'your color'}.` : '')
      : `가장 추천하는 건 ${josa(shortOf(top), '이에요', '예요')}.` + (top.similarity !== undefined ? ` ${base ? '기준 제품' : '고른 색'}과 ${top.similarity}% 비슷해요.` : ''))
      + (r.reasons.length ? ' ' + r.reasons[0] : '')
      + (r.tips.length ? ' ' + r.tips[0] : '')
      + (r.notes.length ? ' ' + r.notes.join(' ') : '');
    suggestions = resultSuggestions(page, query, total > limit, !!env.ref);
    // 여는 말: 되묻는 이음말(bridge)이 없을 때만.
    // 마무리 말("더 밝은 쪽도 볼까요?" 등)은 2026-11-11 뺐다: 같은 제안을 빠른 답장 버튼이 하므로 글만 길어졌다 (closerFor 는 남겨 둔다)
    if (!bridge) {
      const open = openerFor(q, env, ctx, !!(c.mine && toneHint));
      if (open) { reply = `${open} ${reply}`; nextCtx.lastOpener = open; }
    }
  }
  if (bridge) reply = `${bridge.ack} ${reply}`;
  return out({ reply, conditions: r.conditions, products: page, total, suggestions, context: nextCtx, unsure: r.onlyUnmetColor || !!bridge?.unsure });
}
