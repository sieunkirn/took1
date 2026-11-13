// 챗봇 화면: 대화 그리기. 말풍선·제품 카드·빠른 답장·추천 패널·비교함, 답변을 몇 글자씩 써 내려가는 출력.
import { $, el, go, detailLink, won, fullName, shortName, storeLink, toast } from './common.js';
import { compareSummary } from '../lib/chat.js';
import { lang as uiLang, t as tr, finishText as finishName } from './i18n.js';
import { C, STUDIO, BARCODE_PANEL, log, START, state, base, track, save } from './chat-state.js';
import { speaker } from './chat-input.js';
import { send } from './chat.js';

// ---------- 비교함 ----------
const COMPARE_MAX = 3;
const inCompare = (id) => state.compare.some((p) => p.id === id);

function toggleCompare(p) {
  if (inCompare(p.id)) {
    state.compare = state.compare.filter((x) => x.id !== p.id);
    toast(C('비교함에서 뺐어요', 'Removed from compare'));
  } else if (state.compare.length >= COMPARE_MAX) {
    $('compare-count').textContent = C(`최대 ${COMPARE_MAX}개까지 담을 수 있어요. 하나를 빼고 다시 담아 주세요.`, `You can add up to ${COMPARE_MAX}. Remove one and try again.`);
    toast(C(`비교함은 ${COMPARE_MAX}개까지 담을 수 있어요`, `Compare holds up to ${COMPARE_MAX}`));
    return;
  } else {
    state.compare.push(p);
    toast(C(`비교함에 담았어요 (${state.compare.length}/${COMPARE_MAX})`, `Added to compare (${state.compare.length}/${COMPARE_MAX})`));
  }
  save();
  renderLog();
}

function renderCompare() {
  const n = state.compare.length;
  $('compare-box').classList.toggle('hidden', !n);
  $('compare-count').textContent = `${n}/${COMPARE_MAX}` + (n < 2 ? C(' · 하나 더 담으면 비교할 수 있어요', ' · Add one more to compare') : '');
  $('compare-run').disabled = n < 2;
  $('compare-items').replaceChildren(...state.compare.map((p) => el('span', { class: 'compare-chip' },
    el('span', { text: shortName(p) }),
    el('button', { type: 'button', text: '×', 'aria-label': C(`${shortName(p)} 비교함에서 빼기`, `Remove ${shortName(p)} from compare`), onclick: () => toggleCompare(p) }))));
}

export function runCompare() {
  const items = [...state.compare];
  if (items.length < 2) return;
  state.messages.push({ role: 'user', text: C(`비교함에 담은 ${items.length}개 비교해 줘`, `Compare the ${items.length} in my list`) });
  const text = compareSummary(items, uiLang());
  state.messages.push({
    role: 'bot', kind: 'compare', text, products: items,
    suggestions: C(['다른 거 더 보여 줘', '데일리로 바를 립 추천해 줘'], ['Show more', 'Recommend an everyday lip']),
  });
  speaker.speak(text);
  save();
  renderLog();
}

// 비교표: 제품을 열로 나란히 놓는다 (가장 저렴한 가격에는 표시)
function compareTable(items) {
  const cheapest = Math.min(...items.map((p) => p.price));
  const tone = (L) => (L >= 60 ? C('밝은 편', 'Light') : L >= 45 ? C('중간', 'Medium') : C('진한 편', 'Deep'));
  const rows = [
    [C('제품', 'Product'), (p) => fullName(p)],
    [C('색상 계열', 'Color family'), (p) => tr('family.' + p.color_family)],
    [C('제형', 'Finish'), (p) => finishName(p.finish)],
    [C('가격', 'Price'), (p) => won(p.price) + (p.price === cheapest && items.some((x) => x.price !== cheapest) ? C(' (최저가)', ' (lowest)') : '')],
    [C('밝기', 'Lightness'), (p) => tone(p.color_lab.L)],
    [C('색상값', 'Color'), (p) => p.color_hex],
  ];
  return el('div', { class: 'compare-wrap' }, el('table', { class: 'compare-table' }, el('tbody', {},
    ...rows.map(([label, f]) => el('tr', {}, el('th', { text: label }), ...items.map((p) => el('td', { text: f(p) })))))));
}

// ---------- 대화 그리기 ----------
export function productMini(p) {
  return el('div', { class: 'card mini' + (state.focus.includes(p.id) ? ' focus' : ''), 'data-product-id': p.id },
    // 대표 이미지가 있는 제품만 사진을 보여 준다 (불러오지 못하면 사진 자리를 뺀다)
    p.image_url ? el('img', {
      class: 'card-img', src: p.image_url, alt: fullName(p), loading: 'lazy', referrerpolicy: 'no-referrer',
      onerror: (e) => e.target.remove(),
    }) : null,
    el('div', {}, el('span', { text: fullName(p) })),
    el('div', { class: 'muted small', text: [p.finish ? finishName(p.finish) : null, p.price != null ? won(p.price) : null, // 대표색 안내는 뺐다, 가격은 카드에 둔다 (2026-11-11)
      p.similarity !== undefined ? C(`기준 색과 유사도 ${p.similarity}%`, `${p.similarity}% similar`) : null].filter(Boolean).join(' · ') }),
    el('div', { class: 'actions' },
      detailLink(p, 'chat'),
      storeLink(p, C('올리브영', 'OLIVE YOUNG')),
      // 호수 데이터가 있는 제품만: 호수 안내 화면으로 (shades.html)
      p.line ? el('button', { type: 'button', class: 'shade-open', text: C('색상 보기', 'See shades'), onclick: () => go('shades.html', { id: p.id, from: 'chat' }) }) : null,
      STUDIO ? el('button', { type: 'button', text: tr('lip.tryOn'), onclick: () => window.dispatchEvent(new CustomEvent('took:apply', { detail: { hex: p.color_hex, finish: p.finish } })) }) : null));
  // '+ 비교' 버튼은 2026-11-11 카드에서 뺐다. 비교는 "1번이랑 2번 비교해 줘"처럼 말로 물으면 된다
}

// 대화 속 추천 제품: 넓은 화면(키오스크)에서는 3장씩 보여 주고 큰 ‹ › 버튼(또는 손가락으로 밀기)으로 넘긴다.
// 좁은 화면에서는 CSS 가 버튼을 숨기고 카드를 모두 보여 준다
const PAGE_SIZE = 3;
function productPager(products) {
  // 모든 쪽의 카드를 같은 칸(1~3번째 칸, 첫 줄)에 겹쳐 두고 지금 쪽만 보이게 한다 → 넘겨도 말풍선 크기가 그대로 (CSS 의 --col)
  const cards = products.map((p, i) => {
    const c = productMini(p);
    c.style.setProperty('--col', String((i % PAGE_SIZE) + 1));
    return c;
  });
  const pages = Math.ceil(cards.length / PAGE_SIZE);
  let page = 0;
  const prev = el('button', { type: 'button', class: 'pc-arrow', 'aria-label': C('이전 제품', 'Previous products'), text: '‹' });
  const next = el('button', { type: 'button', class: 'pc-arrow', 'aria-label': C('다음 제품', 'Next products'), text: '›' });
  const count = el('span', { class: 'pc-count', 'aria-live': 'polite' });
  const show = (n) => {
    page = Math.max(0, Math.min(pages - 1, n));
    cards.forEach((c, i) => c.classList.toggle('pc-off', Math.floor(i / PAGE_SIZE) !== page));
    count.textContent = `${page + 1} / ${pages}`;
    prev.disabled = page === 0;
    next.disabled = page === pages - 1;
  };
  prev.addEventListener('click', () => show(page - 1));
  next.addEventListener('click', () => show(page + 1));
  const box = el('div', { class: 'mini-list pc' + (pages > 1 ? ' pc-multi' : '') }, ...cards,
    pages > 1 ? el('div', { class: 'pc-nav' }, prev, count, next) : null);
  // 손가락으로 옆으로 밀어도 넘어간다 (60px 이상 밀었을 때)
  let x0 = null;
  box.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') x0 = e.clientX; });
  box.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 60) show(page + (dx < 0 ? 1 : -1));
  });
  show(0);
  return box;
}

// 매장 팔레트에서 가져온 색 (첫인사): 색 견본(실제 색) + '매장에서 만든 색' + 제형·농도·톤
function swatchCard({ hex, label, facts }) {
  const dot = el('span', { class: 'handoff-dot', 'aria-hidden': 'true' });
  dot.style.background = hex;
  return el('div', { class: 'handoff-card', role: 'group', 'aria-label': `${label} ${hex}` }, dot,
    el('span', { class: 'handoff-text' }, el('span', { class: 'handoff-label', text: label }), el('strong', { text: facts || hex })));
}

// 챗봇 답을 문장마다 줄을 바꿔 보여 준다 (읽기 쉽게, 2026-11-11). 한국어는 '요.'·'죠?'처럼 한글 뒤 마침표·물음표·느낌표에서,
// 영어는 마침표 뒤 대문자에서 나눈다. 'mude.'·'NAMING.' 같은 브랜드 이름 속 마침표는 나누지 않는다. 화면에서만 바꾸고 저장·읽어 주기는 원문 그대로
function asLines(text) {
  return String(text || '').replace(/([가-힣][.?!])\s+(?=\S)/g, '$1\n').replace(/([a-z0-9][.?!])\s+(?=[A-Z"'])/g, '$1\n');
}

// streaming: 이 답변을 한 글자씩 써 내려가는 중 (글이 다 나올 때까지 제품·빠른 답장은 숨긴다)
function bubble(m, isLastBot, streaming = false) {
  const who = m.role === 'user' ? C('나', 'Me') : C('took 챗봇', 'took chat');
  return el('div', { class: 'bubble ' + m.role + (streaming ? ' streaming' : '') },
    el('div', { class: 'who', text: who }),
    m.swatch ? swatchCard(m.swatch) : null,
    el('div', { class: 'btext', text: streaming ? '' : (m.role === 'bot' ? asLines(m.text) : m.text) }),
    // 비교 답변은 비교표로, 그 밖에는 좁은 화면용 카드 / 넓은 화면용 짧은 목록 (둘 중 하나만 CSS 로 보인다)
    m.kind === 'compare' && m.products?.length >= 2 ? compareTable(m.products) : null,
    m.kind !== 'compare' && m.products?.length ? productPager(m.products) : null,
    m.kind !== 'compare' && m.products?.length ? el('div', { class: 'mini-names muted small', text: '→ ' + m.products.map((p) => shortName(p)).join(' / ') }) : null);
}

// 다음 질문 추천(빠른 답장): 사용자가 할 말이므로 대화 끝 오른쪽(내 말 자리)에 둔다. 마지막 답변이 다 나온 뒤에만 보인다
function quickReplies(m) {
  if (!m || m.role !== 'bot' || !m.suggestions?.length || state.typing || streamAt >= 0) return null;
  return el('div', { class: 'row suggest quick-replies', role: 'group', 'aria-label': C('빠른 답장', 'Quick replies') },
    ...m.suggestions.map((q) => el('button', { type: 'button', text: q, onclick: () => { track('quick_reply'); send(q); } })));
}

function welcome() {
  const color = !base && state.selectedHex ? C(' 방금 고른 색과 비슷한 제품도 찾아 드릴 수 있어요.', ` I can also find products similar to your color ${state.selectedHex}.`) : '';
  return {
    role: 'bot',
    text: C(`찾는 색이나 원하는 느낌, 입술 고민을 편하게 말씀해 주세요. 마이크로 물어봐도 돼요.${color}`, `Tell me the color, feel or lip concern you have in mind. You can ask with the microphone too.${color}`),
    suggestions: START,
  };
}

export function renderPanel() {
  if (!STUDIO) {
    // 챗봇 화면: 오른쪽 패널 하나를 바코드 ↔ 추천 목록으로 바꿔 쓴다 (합본 화면은 탭이 따로 있다)
    const scan = state.panel === 'scan';
    $('scan-view').classList.toggle('hidden', !scan);
    $('list-view').classList.toggle('hidden', scan);
    $('panel-label').textContent = scan ? C('바코드로 제품 알아보기', 'Look up by barcode') : C('추천 제품', 'Recommended products');
    const toggle = $('panel-toggle');
    toggle.textContent = scan ? C(`추천 목록 보기 (${state.list.length})`, `See recommendations (${state.list.length})`) : C('바코드로 찾기', 'Find by barcode');
    toggle.classList.toggle('hidden', !BARCODE_PANEL || (scan && !state.list.length));
  }
  const status = $('rec-status');
  if (!state.list.length) {
    status.textContent = state.ctx?.query
      ? C('조건에 맞는 제품이 없어요. 대화에서 조건을 바꿔 보세요.', 'No products match. Try changing the conditions in the chat.')
      : C('대화에서 추천받은 제품이 여기에 표시돼요. "2번 자세히"처럼 번호로 물어볼 수 있어요.', 'Products recommended in the chat appear here. Ask by order, like "tell me more about the second one".');
    $('rec-list').replaceChildren();
    return;
  }
  status.textContent = C(`추천 제품 ${state.list.length}개 · "두 번째 거 자세히", "첫 번째랑 두 번째 비교"처럼 순서로 물어보세요.`, `${state.list.length} products · Ask by order, like "the second one" or "compare the first and second".`);
  $('rec-list').replaceChildren(...state.list.map((p) => productMini(p)));
  $('rec-list').querySelector('.focus')?.scrollIntoView({ block: 'nearest' });
}

export function renderLog() {
  renderPanel();
  renderCompare();
  const messages = state.messages.length ? state.messages : [welcome()];
  const lastBot = messages.findLastIndex((m) => m.role === 'bot');
  log.replaceChildren(...[
    ...messages.map((m, i) => bubble(m, i === lastBot, state.messages.length > 0 && i === streamAt)),
    quickReplies(messages.at(-1)),
    // 타이핑 표시: 답변을 받는 동안 말풍선 안에서 점 세 개가 차례로 튄다
    state.typing ? el('div', { class: 'bubble bot typing', role: 'status', 'aria-label': C('답변을 쓰는 중', 'Writing a reply') },
      el('div', { class: 'who', text: C('took 챗봇', 'took chat') }),
      el('div', { class: 'typing-dots', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'))) : null,
  ].filter(Boolean));
  log.scrollTop = log.scrollHeight;
}

// ---------- 스트리밍 출력: 받은 답변을 몇 글자씩 이어서 보여 준다 ----------
export let streamAt = -1; // 지금 써 내려가는 답변의 위치 (state.messages 기준)
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export async function streamReply(index) {
  const text = asLines(state.messages[index].text || '');
  if (reduceMotion || !text) return;
  streamAt = index;
  renderLog();
  const box = log.querySelector('.bubble.streaming .btext');
  // 말풍선은 처음부터 다 쓴 크기로 두고 글자만 채운다: 아직 안 나온 부분도 투명하게 깔아 자리를 잡아 둔다
  const typed = el('span', { class: 'typed' });
  const rest = el('span', { class: 'rest', text });
  box?.replaceChildren(typed, rest);
  // 긴 답변도 2초 안팎에 끝나도록 한 번에 쓰는 글자 수를 늘린다
  const step = Math.max(1, Math.ceil(text.length / 70));
  for (let n = step; n < text.length + step; n += step) {
    if (!box?.isConnected) break;
    typed.textContent = text.slice(0, n);
    rest.textContent = text.slice(n);
    log.scrollTop = log.scrollHeight;
    await new Promise((r) => setTimeout(r, 28));
  }
  streamAt = -1;
}
