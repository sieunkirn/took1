import { renderNav, api, store, el, qs, productCard, detailLink, won, FINISH_LABELS, finishLabel, fullName, shortName } from './common.js';
import { normalizeHex } from '../lib/color.js';
import { setupVoiceInput, setupSpeaker, spokenReply } from './voice.js';

renderNav();
const log = document.getElementById('chat-log');
const input = document.getElementById('chat-input');
const results = document.getElementById('chat-results');
const status = document.getElementById('chat-status');

// 상태 복원: URL 파라미터가 있으면 우선 적용
const state = {
  baseId: qs('base') || store.get('chatBaseId'),
  selectedHex: normalizeHex(qs('hex') || '') || store.get('chatSelectedHex') || store.get('lipColor')?.hex || null,
  messages: store.get('chatMessages', []),
  lastProducts: store.get('chatLastProducts', []),
  ctx: store.get('chatContext', null), // 직전 대화 상태: 서버가 돌려준 context 를 다음 질문에 그대로 보낸다
  typing: false,
};
let base = null;

function save() {
  store.set('chatBaseId', state.baseId);
  store.set('chatSelectedHex', state.selectedHex);
  store.set('chatMessages', state.messages);
  store.set('chatLastProducts', state.lastProducts);
  store.set('chatContext', state.ctx);
}

async function loadBase() {
  const info = document.getElementById('base-info');
  const clear = document.getElementById('base-clear');
  base = null;
  if (state.baseId) {
    const { ok, body } = await api('api/products/' + encodeURIComponent(state.baseId));
    if (ok) base = body.product;
    else state.baseId = null;
  }
  if (base) {
    const rows = [['브랜드', base.brand], ['제품명', base.name], ['색상명', base.shade_name || '대표색'], ['색상값', base.color_hex],
      ['제형', finishLabel(base.finish)], ['가격', won(base.price)], ['바코드', base.barcode || '정보 없음']];
    info.replaceChildren(
      el('dl', { class: 'base-summary' }, rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })])),
      detailLink(base, 'chat-test', '전체 상세 정보 보기'));
    clear.disabled = false;
  } else {
    info.textContent = '기준 제품이 없습니다. 바코드 검색 또는 추천 결과에서 기준 제품을 정할 수 있습니다.';
    clear.disabled = true;
  }
  save();
  renderGuide();
}

function renderColor() {
  const info = document.getElementById('color-info');
  info.textContent = state.selectedHex
    ? `기준 색상: ${state.selectedHex} (기준 제품이 있으면 기준 제품 색상이 우선 적용됩니다)`
    : '선택한 기준 색상이 없습니다. 립 컬러 매핑에서 색상을 선택할 수 있습니다.';
  document.getElementById('color-clear').disabled = !state.selectedHex;
  renderGuide();
}

function renderLog() {
  if (!state.messages.length) {
    log.replaceChildren(el('div', { class: 'bubble' }, el('div', { class: 'who', text: 'took 챗봇' }),
      el('div', { text: '찾는 제품의 조건을 말씀해 주세요. 예: "더 글로시한 제품", "2만원 이하 레드", "비슷한 색상".' })));
    return;
  }
  const lastBot = state.messages.findLastIndex((m) => m.role === 'bot');
  log.replaceChildren(...[...state.messages.map((m, idx) => el('div', { class: 'bubble ' + m.role },
    el('div', { class: 'who', text: m.role === 'user' ? '나' : 'took 챗봇 (규칙 기반)' }),
    el('div', { text: m.text }),
    m.items?.length ? el('div', { class: 'muted', text: '→ ' + m.items.map((x, i) => `${i + 1}번 ${x}`).join(' / ') }) : null,
    // 테스트 화면: 사용자 화면에서는 숨기는 기술적 검색 조건을 그대로 보여 준다
    m.conditions?.length ? el('div', { class: 'muted small', text: '[적용 조건] ' + m.conditions.join(', ') }) : null,
    // 다음 질문 추천: 가장 최근 챗봇 답변에만 버튼으로 보여준다
    idx === lastBot && m.suggestions?.length && !state.typing
      ? el('div', { class: 'row suggest' }, ...m.suggestions.map((q) => el('button', { type: 'button', text: q, onclick: () => send(q) })))
      : null)),
  state.typing ? el('div', { class: 'bubble bot typing' }, el('div', { class: 'who', text: 'took 챗봇 (규칙 기반)' }),
    el('div', { class: 'muted', text: '답변을 준비하고 있어요' }, el('span', { class: 'dots', 'aria-hidden': 'true' }))) : null].filter(Boolean));
  log.scrollTop = log.scrollHeight;
}

function renderResults() {
  renderGuide();
  if (!state.lastProducts.length) {
    results.replaceChildren();
    return;
  }
  status.textContent = `추천 제품 ${state.lastProducts.length}개 · "두 번째 거 자세히"처럼 번호로 물어볼 수 있어요`;
  results.replaceChildren(...state.lastProducts.map((p, i) => {
    const card = productCard(p, {
      from: 'chat-test',
      extraActions: [el('button', { type: 'button', text: '기준 제품으로 설정', onclick: () => setBase(p.id) })],
    });
    card.prepend(el('strong', { text: `${i + 1}번` }));
    return card;
  }));
}

async function setBase(id) {
  state.baseId = id;
  await loadBase();
  state.messages.push({ role: 'bot', text: `기준 제품을 ${fullName(base)} 으로 설정했습니다.` });
  save();
  renderLog();
}

const sameIds = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

async function send(text) {
  const message = text.trim();
  if (!message || state.typing) return;
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
    }),
  });
  // 답변 길이에 맞춰 잠깐 '답변 준비 중'을 보여 준다 (화면 전환이 너무 갑작스럽지 않게)
  const wait = ok ? Math.min(900, 250 + body.reply.length * 4) - (performance.now() - started) : 0;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  state.typing = false;
  if (!ok) {
    state.messages.push({ role: 'bot', text: '오류: ' + (body.error || '응답 실패') });
  } else {
    const newList = !sameIds(body.context?.shown, state.ctx?.shown);
    state.messages.push({
      role: 'bot', text: body.reply, suggestions: body.suggestions || [], conditions: body.conditions || [],
      items: newList ? body.products.map(shortName) : [],
    });
    speak(spokenReply(body));
    // 새 목록일 때만 추천 결과를 바꾼다 ("2번 자세히"처럼 목록을 가리키는 답변은 번호가 유지되게 그대로 둔다)
    if (newList) state.lastProducts = body.products;
    state.ctx = body.context || null;
    if (body.action?.type === 'setBase') {
      state.baseId = body.action.id;
      await loadBase();
    }
    if (newList && !body.products.length) status.textContent = '조건에 맞는 추천 제품이 없습니다.';
  }
  save();
  renderLog();
  renderResults();
}

// ---------- 답할 수 있는 질문 안내 ----------
// src/lib/chat.js 의 규칙(이해하는 단어)과 등록 제품의 브랜드로 만든다. 예시 질문을 누르면 그대로 보낸다.
let brands = [];

function questionGroups() {
  const hasRef = !!(base || state.selectedHex);
  const brandExample = brands[0] ? [`${brands[0]} 제품 보여 줘`] : [];
  return [
    { title: '제형', words: '글로시·촉촉·윤기 / 매트·보송 / 새틴 / 벨벳',
      examples: ['글로시한 제품 추천해 줘', '매트한 제품 찾아 줘', '벨벳 제품 보여 줘'] },
    { title: '가격', words: 'N만원 이하·미만, 저렴한·가성비, 고급·프리미엄',
      examples: ['2만원 이하 추천해 줘', '더 저렴한 제품 추천해 줘', '고급 제품 보여 줘'] },
    { title: '색상 계열', words: '레드·핑크·코랄·오렌지·누드·브라운·로즈·베리·플럼·버건디',
      examples: ['코랄 추천해 줘', '베리 색 찾아 줘', '누드 립 보여 줘'] },
    { title: '브랜드', words: brands.join('·') || '등록 브랜드 불러오는 중',
      examples: brandExample },
    { title: '비슷한 색 · 밝기', words: '비슷한·유사한, 더 밝은·연한, 더 어두운·진한',
      examples: ['비슷한 색상 찾아 줘', '더 밝은 색 추천해 줘', '더 진한 색 추천해 줘'],
      need: hasRef ? null : '기준 제품이나 립 컬러 매핑에서 고른 색상이 있어야 답할 수 있어요.' },
    { title: '기준 제품 정보', words: '가격·얼마, 제형·마무리, 바코드, 정보·설명',
      examples: ['이 제품 가격 얼마야?', '제형 알려 줘', '바코드 알려 줘', '제품 정보 알려 줘'],
      need: base ? null : '바코드 검색이나 추천 결과에서 기준 제품을 정해야 답할 수 있어요.' },
    { title: '조건 섞기', words: '여러 조건을 한 문장에',
      examples: ['2만원 이하 글로시한 코랄 추천해 줘'] },
    { title: '상황 · 계절', words: '데일리·출근 / 면접·미팅 / 데이트 / 파티·하객 / 여행 / 봄·여름·가을·겨울',
      examples: ['데일리로 바를 립 추천해 줘', '면접 립 추천해 줘', '연말 파티 립 보여 줘'] },
    { title: '퍼스널 톤', words: '웜톤·쿨톤, 봄 웜·여름 쿨·가을 웜·겨울 쿨, 나한테 어울리는(립 컬러 매핑 측정 결과 사용)',
      examples: ['쿨톤 립 추천해 줘', '가을 웜 립 추천해 줘', '나한테 어울리는 립 추천해 줘'] },
    { title: '입술 고민 · 느낌', words: '건조·각질 / 지속력·마스크 / 자연스러운 / 강렬한 / 화사한 / 선물',
      examples: ['입술이 건조한데 뭐가 좋아?', '오래 가는 립 추천해 줘', '선물용 립 추천해 줘'] },
    { title: '이어서 묻기', words: '그중에 제일 싼, N번째 자세히, 1번이랑 2번 비교, 더 보여 줘, ~말고, ~걸로 바꿔, 왜 추천했어',
      examples: ['그중에 제일 싼 거는?', '두 번째 거 자세히 알려 줘', '1번이랑 2번 비교해 줘', '매트 말고 다른 거', '더 보여 줘', '왜 이거 추천했어?'],
      need: state.lastProducts.length ? null : '먼저 제품을 추천받으면 이어서 물어볼 수 있어요.' },
    { title: '대화', words: '인사, 도움말, 고마워',
      examples: ['안녕', '뭐 할 수 있어?'] },
  ];
}

function renderGuide() {
  document.getElementById('question-guide').replaceChildren(...questionGroups().map((g) => el('div', { class: 'q-group' },
    el('div', {}, el('strong', { text: g.title }), el('span', { class: 'muted small', text: ' · ' + g.words })),
    g.need ? el('div', { class: 'muted small', text: g.need }) : null,
    el('div', { class: 'row' }, ...g.examples.map((q) => el('button', {
      type: 'button', text: q, disabled: !!g.need, onclick: () => send(q),
    }))))));
}

// ---------- 음성 질문 / 답변 읽어주기 (공용 모듈 voice.js) ----------
const voiceBtn = document.getElementById('voice');
const ttsBox = document.getElementById('tts');
const ttsStop = document.getElementById('tts-stop');
const speaker = setupSpeaker({
  isOn: () => ttsBox.checked,
  onSpeaking: (on) => ttsStop.classList.toggle('hidden', !on),
});
const speak = (text) => speaker.speak(text);
setupVoiceInput({
  button: voiceBtn,
  input,
  status: document.getElementById('voice-status'),
  getBrands: () => brands,
  onText: (text) => send(text),
  beforeStart: () => speaker.stop(), // 읽어주는 소리가 마이크로 다시 들어가지 않게 먼저 멈춘다
  onListening: (on) => { voiceBtn.textContent = on ? '듣는 중... (누르면 중지)' : '음성으로 질문'; },
});

if (!speaker.supported) {
  ttsBox.disabled = true;
  ttsBox.parentElement.append(' (이 브라우저는 읽어주기를 지원하지 않습니다)');
} else {
  ttsBox.checked = store.get('chatTts', true);
}
ttsBox.addEventListener('change', () => {
  store.set('chatTts', ttsBox.checked);
  if (!ttsBox.checked) speaker.stop();
});
ttsStop.addEventListener('click', () => speaker.stop());

document.getElementById('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  send(input.value);
});
document.querySelectorAll('#quick button').forEach((b) => b.addEventListener('click', () => send(b.dataset.q)));
document.getElementById('chat-reset').addEventListener('click', () => {
  state.messages = [];
  state.lastProducts = [];
  state.ctx = null;
  status.textContent = '질문을 입력하면 조건에 맞는 등록 제품이 표시됩니다.';
  save();
  renderLog();
  renderResults();
});
document.getElementById('base-clear').addEventListener('click', async () => {
  state.baseId = null;
  await loadBase();
});
document.getElementById('color-clear').addEventListener('click', () => {
  state.selectedHex = null;
  save();
  renderColor();
});

// 브랜드 목록은 등록 제품 데이터에서 가져온다
api('api/products').then(({ ok, body }) => {
  if (ok) brands = [...new Set(body.products.map((p) => p.brand))];
  renderGuide();
});
await loadBase();
if (qs('base') && base && !state.messages.some((m) => m.baseNotice === base.id)) {
  state.messages.push({ role: 'bot', baseNotice: base.id, text: `바코드/상세 화면에서 전달된 ${fullName(base)} 을(를) 기준으로 질문에 답합니다.` });
  save();
}
renderColor();
renderLog();
renderResults();
