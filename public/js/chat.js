// 사용자용 AI 뷰티 챗봇: 대화와 다음 질문 버튼, 마이크로 말해서 묻기.
// 넓은 화면은 추천 제품을 오른쪽 패널에 고정하고(대화엔 짧은 목록만), 좁은 화면은 대화 안에 카드로 보여 준다(CSS 로 전환).
// 제품 카드의 '+ 비교'로 비교함에 담고(최대 3개) '비교하기'를 누르면 대화에 비교표를 보여 준다.
// 오른쪽 패널은 추천 목록이 없을 때 '바코드로 제품 알아보기'(카메라 스캔·번호 입력)를 보여 주고, 인식한 제품을 대화로 설명한다.
// 답변은 규칙 기반 엔진(src/lib/chat.js)이 만든다.
import { renderNav, PHONE, STATIC, api, store, el, qs, detailLink, won, FINISH_LABELS, FAMILY_LABELS, finishLabel, fullName, shortName, storeLink, toast } from './common.js';
import { normalizeHex } from '../lib/color.js';
import { compareSummary, josa } from '../lib/chat.js';
import { shelfOf, shelfText, shelfShort, drawShelf } from './shelf.js'; // 매장 매대 위치 카드 (테스트 매대 데이터)
import { isEn, lang as uiLang, t as tr, finishText as finishName } from './i18n.js';

// 화면 문구: C(한국어, 영어). 챗봇 답은 서버(엔진)가 같은 언어로 만든다
const C = (ko, en) => (isEn() ? en : ko);
import { setupVoiceInput, setupSpeaker, spokenReply, speechApi } from './voice.js';
import { listenNfc, normalizeTag, resolveTag } from './nfc.js';
import { createBarcodeScanner, cameraErrorMessage, decodeImageFile, loadZXing } from './barcode-scan.js';

renderNav();
const $ = (id) => document.getElementById(id);
// 합본 화면(studio.html): 오른쪽 탭(색 조제·챗봇·추천·바코드)이 보이는 영역을 정하고, 립 매핑(lip.js)과 창 이벤트로 주고받는다
//   받음: took:color { hex } / took:recommend { hex }   보냄: took:apply { hex, finish } / took:show-tab { tab }
const STUDIO = document.body.dataset.layout === 'studio';
// 매장 태블릿은 팔레트만 쓴다: 챗봇은 손님 휴대폰(팔레트 QR, 휴대폰 모드)에서만. 태블릿에서 챗봇 주소로 오면 팔레트로
if (!PHONE && !STUDIO) location.replace('palette.html');
// 챗봇 화면의 바코드 찾기 패널: 지금은 뺀다 (오른쪽 패널은 추천 제품만). 다시 쓰려면 true 로 바꾼다.
// 합본 화면(studio)은 이 값과 상관없이 바코드를 그대로 쓴다
const BARCODE_PANEL = STUDIO || false;
const showTab = (tab) => STUDIO && window.dispatchEvent(new CustomEvent('took:show-tab', { detail: { tab } }));
const log = $('chat-log');
const input = $('chat-input');

const START = C(['데일리 립 추천해 줘', '데이트 립 추천해 줘', '입술이 건조해요', '내 톤에 맞는 립'],
  ['Recommend an everyday lip', 'Recommend a lip for a date', 'My lips are dry. What should I use?', 'A glossy coral under 20,000 won']);

// 테스트 화면과 대화가 섞이지 않게 대화 기록은 따로 저장한다 (기준 제품·립 색상은 공유)
const state = {
  baseId: qs('base') || store.get('chatBaseId'),
  // 기준 색: 주소(QR) > 매장에서 가져온 색(휴대폰, 챗봇 홈에서 다시 와도 유지) > 립 컬러 매핑에서 고른 색
  selectedHex: normalizeHex(qs('hex') || '') || store.get('chatHandoff')?.hex || store.get('lipColor')?.hex || null,
  messages: store.get('chatUserMessages', []),
  ctx: store.get('chatUserContext', null), // 직전 대화 상태: 서버가 돌려준 context 를 다음 질문에 그대로 보낸다
  list: store.get('chatUserList', []), // 오른쪽 패널의 현재 추천 목록 (번호 = 대화에서 가리키는 번호)
  focus: store.get('chatUserFocus', []), // 최근 답변이 가리킨 제품 (패널에서 강조)
  compare: store.get('chatUserCompare', []), // 비교함에 담은 제품 (최대 3개)
  panel: store.get('chatUserPanel', null), // 오른쪽 패널: 'scan'(바코드) | 'list'(추천 목록)
  typing: false,
};
if (state.panel !== 'scan' && state.panel !== 'list') state.panel = state.list.length ? 'list' : 'scan';
if (!BARCODE_PANEL) state.panel = 'list';
let base = null;
let brands = [];

// 말투 다듬기 A/B (서버판, src/lib/ab.js): 대화마다 무작위 id 하나로 반을 나눈다. 개인정보가 아닌 무작위 값이고, 자동 초기화 때 지워진다.
// 화면 행동은 횟수만 보낸다(빠른 답장·올리브영 제품 카드 클릭). 서버 없는 정적 버전은 보내지 않는다
const AB_ID = (() => {
  let id = store.get('abId');
  if (!/^[0-9a-f]{16}$/.test(id || '')) {
    id = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');
    store.set('abId', id);
  }
  return id;
})();
const track = (name) => {
  if (STATIC) return;
  fetch('api/ab-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: AB_ID, name }), keepalive: true }).catch(() => {});
};

function save() {
  store.set('chatBaseId', state.baseId);
  store.set('chatUserMessages', state.messages);
  store.set('chatUserContext', state.ctx);
  store.set('chatUserList', state.list);
  store.set('chatUserFocus', state.focus);
  store.set('chatUserCompare', state.compare);
  store.set('chatUserPanel', state.panel);
}

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

function runCompare() {
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

// ---------- 기준 제품 ----------
async function loadBase() {
  base = null;
  if (state.baseId) {
    const { ok, body } = await api('api/products/' + encodeURIComponent(state.baseId));
    if (ok) base = body.product;
    else state.baseId = null;
  }
  $('base-chip').classList.toggle('hidden', !base);
  if (base) $('base-name').textContent = `${fullName(base)} (${won(base.price)})`;
  save();
}

// ---------- 대화 그리기 ----------
function productMini(p) {
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

// 매장 팔레트에서 가져온 색 (QR 첫인사): 색 견본(실제 색) + '매장에서 만든 색' + 제형·농도·톤
function swatchCard({ hex, label, facts }) {
  const dot = el('span', { class: 'handoff-dot', 'aria-hidden': 'true' });
  dot.style.background = hex;
  return el('div', { class: 'handoff-card', role: 'group', 'aria-label': `${label} ${hex}` }, dot,
    el('span', { class: 'handoff-text' }, el('span', { class: 'handoff-label', text: label }), el('strong', { text: facts || hex })));
}

// 매장 매대 위치 카드 (태블릿 위치 시트에서 '휴대폰으로 가져가기'): 제품 색 견본(실제 색) + 이름 + 단, 아래 작은 매대 그림
function shelfCard(sh) {
  const spot = shelfOf({ brand: sh.brand });
  if (!spot) return null;
  const dot = el('span', { class: 'shelf-dot', 'aria-hidden': 'true' });
  dot.style.background = sh.hex;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'shelf-svg');
  svg.setAttribute('aria-hidden', 'true');
  drawShelf(svg, spot, { small: true });
  return el('div', { class: 'shelf-card', role: 'group', 'aria-label': C('매대 위치', 'Shelf location') + ' ' + shelfText(spot) },
    el('div', { class: 'shelf-card-head' }, dot, el('strong', { text: sh.name }), el('span', { text: shelfShort(spot) })),
    svg);
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
    m.shelf ? shelfCard(m.shelf) : null,
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

function renderPanel() {
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

function renderLog() {
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
let streamAt = -1; // 지금 써 내려가는 답변의 위치 (state.messages 기준)
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
async function streamReply(index) {
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

// ---------- 보내기 ----------
async function send(text) {
  const message = text.trim();
  if (!message || state.typing || streamAt >= 0) return;
  state.messages.push({ role: 'user', text: message });
  state.typing = true;
  renderLog();
  input.value = '';
  const started = performance.now();
  const { ok, body } = await api('api/chat', {
    method: 'POST',
    body: JSON.stringify({
      message, baseProductId: state.baseId, selectedHex: state.selectedHex,
      context: state.ctx, tone: store.get('lipMatch')?.season || null, // 립 컬러 매핑에서 측정한 톤
      lang: uiLang(), // 묻고 답하는 언어
      channel: PHONE ? 'phone' : 'kiosk', handoff: store.get('chatHandoff'), // 상담 프롬프트가 기기·매장 결과를 알게
      session: AB_ID, // 말투 다듬기 A/B
    }),
  });
  // 타이핑 표시를 잠깐은 보여 준다 (답이 너무 빨라 깜빡이고 지나가지 않게)
  const wait = ok ? 700 - (performance.now() - started) : 0;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  state.typing = false;
  if (!ok) {
    state.messages.push({ role: 'bot', text: C('답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.', "Couldn't get a reply. Please try again shortly.") }); // 오류 내용은 괄호로 덧붙이지 않는다
  } else {
    const newList = JSON.stringify(body.context?.shown || []) !== JSON.stringify(state.ctx?.shown || []);
    state.ctx = body.context || null;
    // 제품 번호는 대화에서 "두 번째 거"처럼 가리킬 수 있게 목록 순서를 따른다
    const shown = state.ctx?.shown || [];
    const products = body.products.map((p, i) => ({ ...p, n: shown.includes(p.id) ? shown.indexOf(p.id) + 1 : i + 1 }));
    // 새 목록이면 패널을 바꾸고, "2번 자세히"처럼 목록을 가리키는 답이면 패널의 그 제품을 강조한다
    if (newList) {
      state.list = products;
      state.focus = [];
      // 새 추천 목록이 오면 패널을 목록으로 바꾼다 (바코드 카메라는 끈다)
      if (products.length) {
        state.panel = 'list';
        stopScan();
        showTab('rec'); // 합본 화면: 추천 탭으로
      }
    } else {
      state.focus = products.map((p) => p.id).filter((id) => state.list.some((x) => x.id === id));
    }
    state.messages.push({ role: 'bot', kind: body.kind || null, text: body.reply, suggestions: body.suggestions || [], products });
    speaker.speak(spokenReply(body));
    if (body.action?.type === 'setBase') {
      state.baseId = body.action.id;
      await loadBase();
    }
    // 못 알아들음 폴백 3단계 (딥리서치 P1): 1~2번째는 챗봇이 무난한 추천과 예시 버튼으로 받고,
    // 연달아 3번째면 한 번 사과하고 매장 직원 안내 + 매장에서 만든 색 카드(직원이 보고 이어서 도울 수 있게). 이모지 없음
    const miss = body.unsure ? (store.get('chatMiss', 0) + 1) : 0;
    store.set('chatMiss', miss);
    if (miss === 3) {
      const h = store.get('chatHandoff');
      state.messages.push({
        role: 'bot',
        text: PHONE
          ? C('몇 번 제대로 알아듣지 못했네요. 죄송해요. 매장에 계시면 직원에게 이 화면을 보여 주세요. 아래 예시처럼 짧게 물어보셔도 돼요.', "Sorry, I didn't quite get that a few times. If you're in the store, show this screen to a staff member. You can also try a short question below.")
          : C('몇 번 제대로 알아듣지 못했네요. 죄송해요. 옆에 있는 매장 직원에게 도움을 요청해 주세요. 아래 예시처럼 짧게 물어보셔도 돼요.', "Sorry, I didn't quite get that a few times. Please ask a staff member nearby. You can also try a short question below."),
        ...(h?.hex ? { swatch: { hex: h.hex, label: C('매장에서 만든 색', 'Your in-store color'), facts: [h.finish && tr('texture.' + h.finish), Number.isFinite(h.intensity) && C(`농도 ${h.intensity}%`, `intensity ${h.intensity}%`)].filter(Boolean).join(' · ') } } : {}),
        suggestions: START.slice(0, 3),
      });
    }
  }
  // 오래된 대화는 앞에서부터 지워 저장 공간을 아낀다
  if (state.messages.length > 60) state.messages = state.messages.slice(-60);
  save();
  await streamReply(state.messages.length - 1);
  renderLog();
}

// ---------- 음성 질문 / 읽어주기 ----------
const ttsBtn = $('tts');
let ttsOn = PHONE ? false : store.get('chatTts', true); // 손님 휴대폰은 소리로 읽지 않는다 (밖에서 갑자기 소리 나지 않게)
const speaker = setupSpeaker({ isOn: () => ttsOn });
function renderTts() {
  ttsBtn.setAttribute('aria-pressed', String(ttsOn));
  ttsBtn.title = ttsOn ? C('답변 읽어 주기 켜짐 (누르면 끔)', 'Read replies aloud: on (tap to turn off)') : C('답변 읽어 주기 꺼짐 (누르면 켬)', 'Read replies aloud: off (tap to turn on)');
}
if (!speaker.supported) {
  ttsOn = false;
  ttsBtn.disabled = true;
}
ttsBtn.addEventListener('click', () => {
  ttsOn = !ttsOn;
  store.set('chatTts', ttsOn);
  if (!ttsOn) speaker.stop();
  renderTts();
});
renderTts();

const voiceBtn = $('voice');
setupVoiceInput({
  button: voiceBtn,
  input,
  status: $('voice-status'),
  getBrands: () => brands,
  onText: (text) => send(text),
  beforeStart: () => speaker.stop(), // 읽어주는 소리가 마이크로 다시 들어가지 않게 먼저 멈춘다
  onListening: (on) => {
    voiceBtn.classList.toggle('listening', on);
    voiceBtn.title = on ? C('듣는 중 (누르면 멈춤)', 'Listening (tap to stop)') : C('음성으로 질문', 'Ask by voice');
  },
});

// ---------- 입력: 음성·빠른 답장 + (테스트 단계) 키보드 ----------
// 키오스크는 음성 전용이 목표지만, 지금은 테스트를 위해 가운데 칸에 직접 쓰고 Enter 로도 보낼 수 있다 (합본 화면도 같게).
// 음성 전용으로 되돌리려면 KEYBOARD_INPUT 을 false 로 바꾼다 (칸은 들은 말만 보여 주는 읽기 전용이 되고 보내기 버튼도 없어진다)
const KEYBOARD_INPUT = true;
input.readOnly = !KEYBOARD_INPUT;
if (KEYBOARD_INPUT) {
  input.removeAttribute('tabindex');
  input.placeholder = C('말하거나 입력하고 Enter (테스트용 키보드 입력)', 'Speak, or type and press Enter (test keyboard input)');
} else {
  input.tabIndex = -1;
  input.placeholder = C('마이크를 누르고 말씀해 주세요 · 오른쪽 질문을 눌러도 돼요', 'Tap the microphone and speak · or tap a question on the right');
  $('chat-send')?.remove();
}
// 손님 휴대폰: 키보드 입력이 기본. 칸 오른쪽에 보내기 버튼, 마이크는 칸 왼쪽에 작게 (휴대폰 음성 인식은 기기마다 달라 보조로)
if (PHONE) {
  $('chat-form').classList.remove('voice-only');
  input.placeholder = C('궁금한 걸 입력하세요', 'Type your question');
  input.enterKeyHint = 'send';
  $('chat-form').append(el('button', { type: 'submit', id: 'chat-send', class: 'icon-btn', 'aria-label': C('보내기', 'Send'), title: C('보내기', 'Send') }));
  $('chat-send').innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  for (const id of ['tts', 'nfc-hint']) $(id)?.remove(); // 바코드 버튼은 아래(BARCODE_PANEL)에서 뺀다
  // 마이크: 이 브라우저가 음성 인식을 지원할 때만 보인다 (아이폰 카카오톡 같은 앱 안 브라우저는 대부분 안 됨). 안 되면 키보드 받아쓰기 안내
  if (!speechApi()) {
    $('voice')?.remove();
    input.placeholder = C('궁금한 걸 입력하세요 (키보드 마이크로 말해도 돼요)', 'Type your question (or use your keyboard mic)');
  }
  // 아이폰 키보드: 키보드가 열리면 보이는 높이(visualViewport)에 맞춰 화면을 줄이고, 닫히면(blur) 다시 잰다 (iOS 가 높이를 늦게 돌려주는 문제)
  const vv = window.visualViewport;
  if (vv) {
    const fit = () => {
      document.documentElement.style.setProperty('--vvh', vv.height + 'px');
      if (document.activeElement === input) log.scrollTop = log.scrollHeight;
    };
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    input.addEventListener('blur', () => setTimeout(() => { fit(); window.scrollTo(0, 0); }, 250));
    fit();
  }
  // 헤더의 AI 고지 한 줄(chat.subtitle)은 2026-11-11 사용자 요청으로 뺐다. AI 도우미라는 안내는 첫인사·"너 AI야?" 답에 남아 있다
}
$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (KEYBOARD_INPUT) send(input.value);
});
// ---------- 바코드로 제품 알아보기 (오른쪽 패널) ----------
const scanVideo = $('scan-video');
const SCAN_TIP = C('바코드가 가운데 네모를 가득 채우게 들어 주세요. 너무 가까우면 흐려지니, 흐리면 조금 떨어뜨려 주세요.', 'Hold the barcode so it fills the center box. If it looks blurry, move it a little farther away.');
let lastProgress = 0;
const scanner = createBarcodeScanner({
  video: scanVideo,
  onCode: (code) => handleBarcode(code, 'camera'),
  // 읽는 중임을 보여 준다 (1초에 한 번). 8초 넘게 못 읽으면 잘 읽히는 요령을 덧붙인다
  onProgress: ({ frames, width, height, ms }) => {
    if (ms - lastProgress < 1000) return;
    lastProgress = ms;
    const help = ms > 8000
      ? C(' 잘 안 읽히면: 휴대폰 화면의 바코드는 밝기를 최대로, 비스듬히 들어 반사를 피하고, 인쇄한 종이도 좋아요. 아래에 번호를 입력해도 돼요.', ' Not reading? For a phone screen, turn brightness up and tilt it to avoid glare; printed paper works well too. You can also type the number below.')
      : '';
    $('scan-status').textContent = C(`읽는 중… (카메라 ${width}×${height}, ${frames}번 확인) `, `Reading… (camera ${width}×${height}, ${frames} checks) `) + SCAN_TIP + help;
  },
});
// 넓은 화면 = 태블릿·PC 가로, 또는 태블릿 세로(css 의 세로 레이어와 같은 조건). 이때는 바코드·추천 패널이 늘 보인다
const WIDE = '(orientation: landscape) and (min-width: 960px), (orientation: portrait) and (min-width: 700px)';
const narrow = () => !matchMedia(WIDE).matches;

function setScanning(on) {
  scanVideo.classList.toggle('hidden', !on);
  $('scan-guide').classList.toggle('hidden', !on);
  $('scan-placeholder').classList.toggle('hidden', on);
  $('scan-start').classList.toggle('hidden', on);
  $('scan-stop').classList.toggle('hidden', !on);
}

function stopScan() {
  scanner.stop();
  setScanning(false);
}

async function startScan() {
  $('scan-status').textContent = C('카메라를 켜는 중이에요...', 'Turning on the camera...');
  $('scan-start').disabled = true;
  try {
    setScanning(true);
    await scanner.start();
    // 첫 프레임에서 바로 인식했으면 이미 '인식했어요' 상태이므로 안내로 덮어쓰지 않는다
    lastProgress = 0;
    if (scanner.isRunning()) $('scan-status').textContent = SCAN_TIP;
  } catch (e) {
    setScanning(false);
    $('scan-status').textContent = e?.name ? cameraErrorMessage(e) : e.message;
  } finally {
    $('scan-start').disabled = false;
  }
}

// 스캐너 대기 표시: 바코드를 읽으면 잠깐 번호를 보여 주고 다시 '대기 중'으로
let flashTimer = null;
function flashScanner(text) {
  const s = $('scanner-state');
  if (!s) return;
  s.replaceChildren(el('i', { 'aria-hidden': 'true' }), text);
  s.classList.add('hit');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    s.replaceChildren(el('i', { 'aria-hidden': 'true' }), C('스캐너 대기 중', 'Scanner ready'));
    s.classList.remove('hit');
  }, 2500);
}

// 찍거나 태그한 제품을 기준 제품으로 정하고, 대화에 제품 설명과 이어서 물어볼 질문을 띄운다 (바코드·NFC 공통). 말할 문장을 돌려준다
async function describeProduct(p) {
  state.baseId = p.id;
  await loadBase();
  const text = [`${fullName(p)} · ${p.finish ? `${finishName(p.finish)} · ` : ''}${won(p.price)}.`, isEn() ? '' : p.description,
    C('이 제품을 기준으로 비슷한 색·더 저렴한 제품을 찾을 수 있어요.', 'I can find similar colors or cheaper products based on this one.')].filter(Boolean).join(' ');
  state.messages.push({
    role: 'bot', text, products: [p],
    suggestions: C(['비슷한 색상 찾아 줘', '더 저렴한 제품 추천해 줘', '더 글로시한 제품 추천해 줘', '제품 정보 알려 줘'], ['Find similar colors', 'Something cheaper', 'Something glossier', 'Tell me about this product']),
  });
  return text;
}

// ---------- NFC 태그 (외부 리더기, js/nfc.js) ----------
// 제품에 붙은 태그를 리더기에 톡 올리면 그 제품을 설명하고 기준 제품으로 정한다. 합본 화면은 바코드를 쓰므로 켜지 않는다
const nfcHint = $('nfc-hint');
const NFC_IDLE = C('립 제품을 리더기에 올려도 정보를 알려 드려요', 'You can also tap a lip product on the reader');
let nfcTimer = null;
function nfcFlash(text) {
  if (!nfcHint) return;
  nfcHint.textContent = text;
  nfcHint.classList.add('hit');
  clearTimeout(nfcTimer);
  nfcTimer = setTimeout(() => { nfcHint.textContent = NFC_IDLE; nfcHint.classList.remove('hit'); }, 2500);
}
async function handleTag(raw) {
  const code = normalizeTag(raw);
  speaker.stop();
  state.messages.push({ role: 'user', text: C('제품을 리더기에 올렸어요', 'Tapped a product on the reader') });
  const id = resolveTag(code);
  const found = id ? await api('api/products/' + encodeURIComponent(id)) : null;
  let text;
  if (found?.ok && found.body.product) {
    nfcFlash(C(`읽었어요 · ${shortName(found.body.product)}`, `Read · ${shortName(found.body.product)}`));
    text = await describeProduct(found.body.product);
  } else {
    nfcFlash(C('등록되지 않은 태그예요', 'Unregistered tag'));
    text = C(`등록되지 않은 태그예요. 다른 제품을 올리거나 찾는 립을 말로 알려 주세요.`, `This tag isn't registered. Tap another product or tell me what lip you're looking for.`);
    state.messages.push({ role: 'bot', text, suggestions: START });
  }
  speaker.speak(text);
  save();
  await streamReply(state.messages.length - 1);
  renderLog();
}
if (!STUDIO && !PHONE) { // 손님 휴대폰엔 NFC 리더기가 없다
  if (nfcHint) nfcHint.textContent = NFC_IDLE;
  listenNfc(handleTag);
}

// 바코드 번호 → 등록 제품 조회 → 대화로 설명하고 기준 제품으로 정한다. 등록되지 않은 제품은 지어내지 않는다
async function handleBarcode(raw, source) {
  const code = String(raw).replace(/\D/g, '');
  stopScan();
  if (!/^\d{8,14}$/.test(code)) {
    $('scan-status').textContent = C('바코드 번호는 8~14자리 숫자예요. 다시 확인해 주세요.', 'A barcode is 8 to 14 digits. Please check it again.');
    return;
  }
  $('scan-status').textContent = C(`인식했어요: ${code}`, `Recognized: ${code}`);
  flashScanner(C(`읽었어요 · ${code}`, `Read · ${code}`));
  const said = C({ camera: `바코드 찍었어요 (${code})`, scanner: `스캐너로 바코드 찍었어요 (${code})`, phone: `휴대폰으로 바코드 찍었어요 (${code})`, photo: `바코드 사진을 올렸어요 (${code})` },
    { camera: `Scanned a barcode (${code})`, scanner: `Scanned with the scanner (${code})`, phone: `Scanned with my phone (${code})`, photo: `Uploaded a barcode photo (${code})` });
  state.messages.push({ role: 'user', text: said[source] || C(`바코드 ${code} 알려 줘`, `Look up barcode ${code}`) });
  const { ok, body } = await api('api/products/barcode/' + encodeURIComponent(code));
  let text;
  if (!ok) {
    text = C('바코드를 읽지 못했어요. 다시 찍거나 번호를 입력해 주세요.', "Couldn't read the barcode. Scan again or type the number.");
    state.messages.push({ role: 'bot', text, suggestions: START });
  } else if (!body.found) {
    text = C(`${code}는 등록되지 않은 바코드예요. 다른 제품을 찍거나 찾는 립을 말로 알려 주세요.`, `${code} isn't a registered barcode. Scan another product or tell me what lip you're looking for.`);
    state.messages.push({ role: 'bot', text, suggestions: START });
    $('scan-result').replaceChildren();
  } else {
    const p = body.product;
    text = await describeProduct(p);
    $('scan-result').replaceChildren(el('div', { class: 'muted small', text: C('인식한 제품', 'Recognized product') }), productMini(p));
  }
  speaker.speak(text);
  save();
  await streamReply(state.messages.length - 1);
  renderLog();
  if (narrow()) document.body.classList.remove('scan-open'); // 좁은 화면은 대화에서 바로 설명을 보도록 패널을 닫는다
  showTab('chat'); // 합본 화면: 설명은 챗봇 탭에서 본다
}

// ---------- USB·블루투스 바코드 스캐너 ----------
// 스캐너는 키보드처럼 숫자를 아주 빠르게 치고 Enter(또는 Tab)를 누른다. 사람이 칠 수 없는 간격(SCANNER_GAP 이하)으로
// 8~14자리 숫자가 들어온 뒤 Enter 가 오면 바코드로 보고 바로 조회한다. 어느 칸에 커서가 있든 동작하고, 그 칸에 찍힌 숫자는 지운다
const SCANNER_GAP = 60;
let scanBuf = '';
let scanLast = 0;
if (BARCODE_PANEL) window.addEventListener('keydown', (e) => {
  const now = performance.now();
  if (now - scanLast > SCANNER_GAP) scanBuf = '';
  scanLast = now;
  // 한글 입력 상태에서는 key 가 'Process' 로 올 수 있어 code 로도 숫자를 알아본다
  const digit = /^\d$/.test(e.key) ? e.key : /^(Digit|Numpad)\d$/.test(e.code) ? e.code.slice(-1) : null;
  if (digit) {
    scanBuf += digit;
    return;
  }
  if ((e.key === 'Enter' || e.key === 'Tab') && /^\d{8,14}$/.test(scanBuf)) {
    e.preventDefault(); // 채팅 입력칸이 숫자를 질문으로 보내지 않게 막는다
    e.stopPropagation();
    const code = scanBuf;
    scanBuf = '';
    const t = e.target;
    if ((t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) && t.value.endsWith(code)) t.value = t.value.slice(0, -code.length);
    handleBarcode(code, 'scanner');
    return;
  }
  if (e.key !== 'Shift') scanBuf = '';
}, true);

// ---------- 휴대폰으로 찍기 (QR 연결) ----------
// PC 가 연결을 만들고 QR 로 휴대폰 화면 주소를 보여 준다. 휴대폰이 찍은 바코드 번호는 1초마다 서버에서 가져온다
// (실시간 스트림은 무료 터널이 늦게 보내서 어느 네트워크에서나 되는 폴링을 쓴다)
let pairTimer = null;
let pairId = null;

async function startPairing() {
  if (pairId) return;
  const status = $('pair-status');
  const { ok, body } = await api('api/pair', { method: 'POST', body: '{}' });
  if (!ok || !body.id) {
    status.textContent = C('휴대폰 연결은 서버를 실행(npm start)했을 때만 쓸 수 있어요. 아래 PC 카메라나 번호 입력을 이용해 주세요.', 'Phone pairing only works with the server running (npm start). Use the PC camera or type the number below.');
    $('pair-qr').replaceChildren();
    return;
  }
  pairId = body.id;
  if (!body.phoneUrl) {
    status.textContent = C('PC의 와이파이 주소를 찾지 못했어요. PC가 와이파이(공유기)에 연결돼 있는지 확인해 주세요.', "Couldn't find the PC's Wi-Fi address. Check that the PC is connected to Wi-Fi.");
    return;
  }
  const ZXing = await loadZXing().catch(() => null);
  if (ZXing) {
    const qr = new ZXing.BrowserQRCodeSvgWriter().write(body.phoneUrl, 132, 132);
    qr.setAttribute('shape-rendering', 'crispEdges'); // 칸 경계를 흐리지 않아 휴대폰 카메라가 잘 읽는다
    $('pair-qr').replaceChildren(qr);
  }
  $('pair-url').textContent = C(`QR이 안 되면 휴대폰 브라우저 주소창에 입력: ${body.phoneUrl}`, `If the QR doesn't work, enter this in your phone browser: ${body.phoneUrl}`);
  status.textContent = C('휴대폰 연결을 기다리고 있어요. PC와 휴대폰이 같은 와이파이에 있어야 해요.', 'Waiting for your phone. The PC and phone must be on the same Wi-Fi.');
  let after = 0;
  let failures = 0;
  const check = async () => {
    const r = await api(`api/pair/${pairId}/poll?after=${after}`).catch(() => ({ ok: false, status: 0 }));
    if (r.status === 404) {
      // 서버를 다시 켜면 연결 정보가 사라지므로 새 QR 을 만든다
      clearInterval(pairTimer);
      pairId = null;
      status.textContent = C('연결이 끝나서 새 QR을 만드는 중이에요…', 'The connection ended. Making a new QR…');
      setTimeout(startPairing, 1500);
      return;
    }
    if (!r.ok) {
      if (++failures >= 3) status.textContent = C('서버와 연결이 잠시 끊겼어요. 다시 연결하는 중이에요…', 'Lost the server connection for a moment. Reconnecting…');
      return;
    }
    failures = 0;
    after = r.body.last;
    for (const e of r.body.events) {
      if (e.type === 'phone') status.textContent = C('휴대폰이 연결됐어요! 휴대폰에서 바코드를 찍어 주세요.', 'Phone connected! Scan a barcode with your phone.');
      if (e.type === 'code') {
        status.textContent = C(`휴대폰에서 바코드를 받았어요 (${e.data.code}).`, `Got a barcode from your phone (${e.data.code}).`);
        handleBarcode(e.data.code, 'phone');
      }
    }
  };
  pairTimer = setInterval(check, 1000);
}
window.addEventListener('pagehide', () => clearInterval(pairTimer));

// PC 에서도 사진 파일(휴대폰에서 옮긴 사진 등)로 바코드를 읽을 수 있다
$('scan-photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  stopScan();
  $('scan-status').textContent = C('사진에서 바코드를 찾는 중이에요…', 'Looking for a barcode in the photo…');
  const code = await decodeImageFile(file).catch(() => null);
  if (code) handleBarcode(code, 'photo');
  else $('scan-status').textContent = C('사진에서 바코드를 찾지 못했어요. 바코드가 가운데에 크게, 선명하게 나온 사진으로 다시 해 주세요.', "Couldn't find a barcode in the photo. Try a sharp photo with the barcode large in the center.");
});

$('scan-start').addEventListener('click', startScan);
$('scan-stop').addEventListener('click', () => {
  stopScan();
  $('scan-status').textContent = C('카메라를 껐어요.', 'Camera turned off.');
});
$('scan-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('scan-input').value.trim();
  if (!v) return;
  $('scan-input').value = '';
  handleBarcode(v, 'input');
});
$('panel-toggle').addEventListener('click', () => {
  state.panel = state.panel === 'scan' ? 'list' : 'scan';
  if (state.panel === 'list') stopScan();
  save();
  renderPanel();
});
$('scan-open').addEventListener('click', () => {
  state.panel = 'scan';
  document.body.classList.add('scan-open');
  renderPanel();
  $('rec-panel').scrollIntoView({ block: 'start' });
});
$('scan-close').addEventListener('click', () => {
  stopScan();
  document.body.classList.remove('scan-open');
});

$('compare-run').addEventListener('click', runCompare);
// 제품 카드에서 올리브영으로 가는 클릭 (A/B 지표)
log.addEventListener('click', (e) => { const a = e.target.closest?.('a[href]'); if (a && /oliveyoung/i.test(a.href)) track('card_click'); });
$('compare-clear').addEventListener('click', () => {
  state.compare = [];
  save();
  renderLog();
});

$('chat-reset').addEventListener('click', () => {
  speaker.stop();
  store.remove('chatMiss');
  state.messages = [];
  state.ctx = null;
  state.list = [];
  state.focus = [];
  save();
  renderLog();
});
$('base-clear').addEventListener('click', async () => {
  state.baseId = null;
  await loadBase();
  renderLog();
});

// 브랜드 목록(음성 후보 고르기용)은 등록 제품 데이터에서 가져온다
api('api/products').then(({ ok, body }) => {
  if (!ok) return;
  brands = [...new Set(body.products.map((p) => p.brand))];
  // 바코드가 하나도 없는 데이터(올리브영 수집 데이터)면 미리 알려 준다
  if (!body.products.some((p) => p.barcode)) {
    $('scan-note').textContent = C('지금 쓰는 올리브영 상품 데이터에는 바코드 정보가 아직 없어요. 바코드를 찍어도 "등록되지 않은 제품"으로 나오니, 찾는 립을 말로 물어봐 주세요.', 'The current OLIVE YOUNG product data has no barcodes yet, so scans show as "not registered". Please ask for the lip you want instead.');
    $('scan-note').classList.remove('hidden');
  }
});
await loadBase();
// 바코드 검색·제품 상세에서 기준 제품을 가지고 들어온 경우 안내
if (qs('base') && base && !state.messages.some((m) => m.baseNotice === base.id)) {
  state.messages.push({
    role: 'bot', baseNotice: base.id,
    text: C(`기준 제품: ${fullName(base)}. "더 저렴한 거", "비슷한 색", "더 촉촉한 제형"처럼 물어보세요.`, `Base product: ${fullName(base)}. Try asking "something cheaper", "similar colors" or "a glossier finish".`),
    suggestions: C(['더 저렴한 제품 추천해 줘', '비슷한 색상 찾아 줘', '더 글로시한 제품 추천해 줘', '이 제품 가격 얼마야?'], ['Something cheaper', 'Find similar colors', 'Something glossier', 'How much is this product?']),
  });
  save();
}
// 매장 팔레트에서 QR 로 가져온 결과 (palette.js openTake): 손님 휴대폰에서 그 결과로 대화를 시작한다.
//   ?from=palette&hex=색&fin=텍스처&int=농도&tone=내 톤&recs=추천 제품 ID 들&take=1
//   색은 이후 질문의 기준 색(selectedHex), 톤은 추천에 쓰는 내 톤(lipMatch)으로 쓴다. 같은 결과로 다시 열면 인사는 한 번만
const TEXTURE_KEYS = ['matte', 'satin', 'glossy', 'sheer', 'shimmer'];
const SEASON_KEYS = ['spring', 'summer', 'autumn', 'winter'];
async function paletteHandoff() {
  const hex = normalizeHex(qs('hex') || '');
  if (qs('from') !== 'palette' || !hex) return;
  const fin = TEXTURE_KEYS.includes(qs('fin')) ? qs('fin') : null;
  const n = Math.round(Number(qs('int')));
  const strength = Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
  const tone = SEASON_KEYS.includes(qs('tone')) ? qs('tone') : null;
  const ids = (qs('recs') || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 3);
  const locId = (qs('loc') || '').trim().slice(0, 40) || null; // 태블릿 위치 시트에서 넘긴 제품
  const key = [hex, fin, strength, tone, ids.join(','), locId].join('|');
  state.selectedHex = hex;
  store.set('chatHandoff', { hex, finish: fin, intensity: strength, tone });
  // 결과 링크 (챗봇 홈의 '결과 저장'): 결과는 #조각에 그대로 두고 챗봇 홈에서 온 ?q= 같은 값은 뺀다
  store.set('chatHandoffUrl', location.origin + location.pathname + location.hash); // 챗봇 홈(chat-home.js)의 '매장에서 만든 색' 카드도 쓴다
  if (tone) store.set('lipMatch', { ...(store.get('lipMatch') || {}), season: tone });
  if (state.messages.some((m) => m.handoff === key)) return;
  const found = await Promise.all(ids.map((id) => api('api/products/' + encodeURIComponent(id)).catch(() => null)));
  const products = found.filter((r) => r?.ok && r.body.product).map((r, i) => ({ ...r.body.product, n: i + 1 }));
  const locRes = locId ? await api('api/products/' + encodeURIComponent(locId)).catch(() => null) : null;
  const locP = locRes?.ok ? locRes.body.product : null;
  const spot = locP ? shelfOf(locP) : null; // 매대 정보가 없는 브랜드면 위치를 말하지 않는다
  const shelfLine = spot ? C(` 찾으시던 제품은 ${shelfText(spot)}에 있어요.`, ` The product you wanted is in ${shelfText(spot)}.`) : '';
  // 색상값(#A0202C)은 손님에게 뜻이 없어 글에서 빼고, 말풍선 위 색 견본 카드로 보여 준다 (딥리서치 P0)
  const facts = [fin && tr('texture.' + fin), strength !== null && C(`농도 ${strength}%`, `intensity ${strength}%`), tone && C(`${tr('season.' + tone)} (추정)`, `${tr('season.' + tone)} (estimate)`)].filter(Boolean).join(' · ');
  // 첫인사 (상담 프롬프트 src/lib/llm/agent.js 와 같은 성격): 인사·AI 도우미 소개 → 가져온 결과 → 할 수 있는 것 → 한계 고지. 아래 바로답변 3개
  // 한 문장에 한 가지 말만, 짧게 (화면에서는 문장마다 줄이 바뀐다). 버튼 안내('아래 버튼을 누르거나…')는 버튼이 보이니 뺐다
  const text = C('안녕하세요, 립 색을 같이 찾아 드리는 AI 도우미 툭이에요. 매장에서 만든 색을 가져왔어요.', "Hi, I'm Took, an AI assistant that helps you find lip colors. I brought over the color you made in store.")
    + shelfLine
    + (products.length
      ? C(' 매장에서 추천받은 제품도 아래에 담았어요.', ' Your in-store picks are below.')
      : C(' 이 색과 비슷한 립을 같이 찾아볼까요?', ' Shall we find lips close to this color?'))
    + C(' 화면 속 색은 실제 발색과 조금 다를 수 있어요.', ' On-screen colors may look a little different in real life.');
  if (products.length) {
    state.list = products;
    state.focus = [];
    state.panel = 'list';
  }
  state.messages.push({
    role: 'bot', handoff: key, text, products,
    swatch: { hex, label: C('매장에서 만든 색', 'Your in-store color'), facts },
    shelf: spot ? { brand: locP.brand, hex: locP.color_hex, name: shortName(locP) } : null,
    // 바로답변: 규칙 챗봇이 알아듣는 짧은 말 (한/영 모두 확인)
    suggestions: C(['이 색이랑 비슷한 립', '더 밝은 색', '더 촉촉하게', '2만원 이하로'], ['Recommend products similar to this color', 'Lighter than this color', 'Glossy in this color', 'This color under 20,000 won']),
  });
  save();
}
await paletteHandoff();
if (!BARCODE_PANEL) {
  $('scan-open')?.remove(); // 좁은 화면의 바코드 버튼
  $('rec-panel').setAttribute('aria-label', C('추천 제품', 'Recommended products'));
}
renderLog();

// 챗봇 홈(chat-home.js)에서 온 경우: ?q= 질문을 바로 보내고, ?focus=1 이면 입력칸에 커서. 새로고침 때 다시 보내지 않게 주소에서 지운다
if (PHONE) {
  const here = new URLSearchParams(location.search);
  const q = (here.get('q') || '').trim().slice(0, 200);
  const focus = here.get('focus') === '1';
  if (q || focus) {
    here.delete('q');
    here.delete('focus');
    history.replaceState(null, '', location.pathname + (here.toString() ? '?' + here : ''));
    if (q) setTimeout(() => send(q), 300);
    else setTimeout(() => input.focus(), 300);
  }
}
// 합본 화면: 립 매핑에서 고른 색을 챗봇의 기준 색으로 쓰고, '이 컬러로 제품 추천'을 챗봇 질문으로 처리한다
if (STUDIO) {
  if (window.tookLipHex) state.selectedHex = window.tookLipHex; // 립 매핑이 먼저 로드된 경우
  window.addEventListener('took:color', (e) => { state.selectedHex = e.detail.hex; });
  window.addEventListener('took:recommend', (e) => {
    state.selectedHex = e.detail.hex;
    send(C('지금 고른 색과 비슷한 제품 추천해 줘', 'Recommend products similar to my chosen color'));
  });
}
// 스캐너가 없을 때: '스캐너가 없을 때'를 펼치면 휴대폰 연결 QR 을 준비하고, 접으면 PC 카메라를 끈다
$('scan-alt')?.addEventListener('toggle', (e) => {
  if (e.target.open) { if (!narrow()) startPairing(); } else stopScan();
});
