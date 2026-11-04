// 사용자용 AI 뷰티 챗봇: 대화와 다음 질문 버튼, 마이크로 말해서 묻기.
// 넓은 화면은 추천 제품을 오른쪽 패널에 고정하고(대화엔 짧은 목록만), 좁은 화면은 대화 안에 카드로 보여 준다(CSS 로 전환).
// 제품 카드의 '+ 비교'로 비교함에 담고(최대 3개) '비교하기'를 누르면 대화에 비교표를 보여 준다.
// 오른쪽 패널은 추천 목록이 없을 때 '바코드로 제품 알아보기'(카메라 스캔·번호 입력)를 보여 주고, 인식한 제품을 대화로 설명한다.
// 답변은 규칙 기반 엔진(src/lib/chat.js)이 만든다.
import { renderNav, api, store, el, qs, detailLink, won, FINISH_LABELS, FAMILY_LABELS, finishLabel, fullName, shortName, storeLink, toast } from './common.js';
import { normalizeHex } from '../lib/color.js';
import { compareSummary } from '../lib/chat.js';
import { isEn, lang as uiLang, t as tr, finishText as finishName } from './i18n.js';

// 화면 문구: C(한국어, 영어). 챗봇 답은 서버(엔진)가 같은 언어로 만든다
const C = (ko, en) => (isEn() ? en : ko);
import { setupVoiceInput, setupSpeaker, spokenReply } from './voice.js';
import { createBarcodeScanner, cameraErrorMessage, decodeImageFile, loadZXing } from './barcode-scan.js';

renderNav();
const $ = (id) => document.getElementById(id);
// 합본 화면(studio.html): 오른쪽 탭(색 조제·챗봇·추천·바코드)이 보이는 영역을 정하고, 립 매핑(lip.js)과 창 이벤트로 주고받는다
//   받음: took:color { hex } / took:recommend { hex }   보냄: took:apply { hex, finish } / took:show-tab { tab }
const STUDIO = document.body.dataset.layout === 'studio';
const showTab = (tab) => STUDIO && window.dispatchEvent(new CustomEvent('took:show-tab', { detail: { tab } }));
const log = $('chat-log');
const input = $('chat-input');

const START = C(['데일리로 바를 립 추천해 줘', '데이트 립 추천해 줘', '입술이 건조한데 뭐가 좋아?', '2만원 이하 글로시한 코랄 추천해 줘'],
  ['Recommend an everyday lip', 'Recommend a lip for a date', 'My lips are dry. What should I use?', 'A glossy coral under 20,000 won']);

// 테스트 화면과 대화가 섞이지 않게 대화 기록은 따로 저장한다 (기준 제품·립 색상은 공유)
const state = {
  baseId: qs('base') || store.get('chatBaseId'),
  selectedHex: normalizeHex(qs('hex') || '') || store.get('lipColor')?.hex || null,
  messages: store.get('chatUserMessages', []),
  ctx: store.get('chatUserContext', null), // 직전 대화 상태: 서버가 돌려준 context 를 다음 질문에 그대로 보낸다
  list: store.get('chatUserList', []), // 오른쪽 패널의 현재 추천 목록 (번호 = 대화에서 가리키는 번호)
  focus: store.get('chatUserFocus', []), // 최근 답변이 가리킨 제품 (패널에서 강조)
  compare: store.get('chatUserCompare', []), // 비교함에 담은 제품 (최대 3개)
  panel: store.get('chatUserPanel', null), // 오른쪽 패널: 'scan'(바코드) | 'list'(추천 목록)
  typing: false,
};
if (state.panel !== 'scan' && state.panel !== 'list') state.panel = state.list.length ? 'list' : 'scan';
let base = null;
let brands = [];

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
    el('div', { class: 'muted small', text: [p.finish ? finishName(p.finish) : null, won(p.price), p.color_options ? C(`${p.color_options}가지 색상 중 대표색`, `1 of ${p.color_options} shades`) : null,
      p.similarity !== undefined ? C(`기준 색과 유사도 ${p.similarity}%`, `${p.similarity}% similar`) : null].filter(Boolean).join(' · ') }),
    el('div', { class: 'actions' },
      detailLink(p, 'chat'),
      storeLink(p, C('올리브영', 'OLIVE YOUNG')),
      STUDIO ? el('button', { type: 'button', text: tr('lip.tryOn'), onclick: () => window.dispatchEvent(new CustomEvent('took:apply', { detail: { hex: p.color_hex, finish: p.finish } })) }) : null,
      el('button', {
        type: 'button', text: inCompare(p.id) ? C('✓ 비교함', '✓ Compare') : C('+ 비교', '+ Compare'), 'aria-pressed': String(inCompare(p.id)),
        onclick: () => toggleCompare(p),
      })));
}

// streaming: 이 답변을 한 글자씩 써 내려가는 중 (글이 다 나올 때까지 제품·빠른 답장은 숨긴다)
function bubble(m, isLastBot, streaming = false) {
  const who = m.role === 'user' ? C('나', 'Me') : C('took 챗봇', 'took chat');
  return el('div', { class: 'bubble ' + m.role + (streaming ? ' streaming' : '') },
    el('div', { class: 'who', text: who }),
    el('div', { class: 'btext', text: streaming ? '' : m.text }),
    // 비교 답변은 비교표로, 그 밖에는 좁은 화면용 카드 / 넓은 화면용 짧은 목록 (둘 중 하나만 CSS 로 보인다)
    m.kind === 'compare' && m.products?.length >= 2 ? compareTable(m.products) : null,
    m.kind !== 'compare' && m.products?.length ? el('div', { class: 'mini-list' }, ...m.products.map((p) => productMini(p))) : null,
    m.kind !== 'compare' && m.products?.length ? el('div', { class: 'mini-names muted small', text: '→ ' + m.products.map((p) => shortName(p)).join(' / ') }) : null);
}

// 다음 질문 추천(빠른 답장): 사용자가 할 말이므로 대화 끝 오른쪽(내 말 자리)에 둔다. 마지막 답변이 다 나온 뒤에만 보인다
function quickReplies(m) {
  if (!m || m.role !== 'bot' || !m.suggestions?.length || state.typing || streamAt >= 0) return null;
  return el('div', { class: 'row suggest quick-replies', role: 'group', 'aria-label': C('빠른 답장', 'Quick replies') },
    ...m.suggestions.map((q) => el('button', { type: 'button', text: q, onclick: () => send(q) })));
}

function welcome() {
  const color = !base && state.selectedHex ? C(` 고른 색 ${state.selectedHex}과 비슷한 제품도 찾을 수 있어요.`, ` I can also find products similar to your color ${state.selectedHex}.`) : '';
  return {
    role: 'bot',
    text: C(`찾는 색, 바를 자리, 입술 고민을 말씀해 주세요. 마이크로 물어봐도 돼요.${color}`, `Tell me the color, occasion or lip concern you have in mind. You can ask with the microphone too.${color}`),
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
    toggle.classList.toggle('hidden', scan && !state.list.length);
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
  const text = state.messages[index].text || '';
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
    }),
  });
  // 타이핑 표시를 잠깐은 보여 준다 (답이 너무 빨라 깜빡이고 지나가지 않게)
  const wait = ok ? 700 - (performance.now() - started) : 0;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  state.typing = false;
  if (!ok) {
    state.messages.push({ role: 'bot', text: C('답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요. (', "Couldn't get a reply. Please try again shortly. (") + (body.error || C('응답 실패', 'no response')) + ')' });
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
  }
  // 오래된 대화는 앞에서부터 지워 저장 공간을 아낀다
  if (state.messages.length > 60) state.messages = state.messages.slice(-60);
  save();
  await streamReply(state.messages.length - 1);
  renderLog();
}

// ---------- 음성 질문 / 읽어주기 ----------
const ttsBtn = $('tts');
let ttsOn = store.get('chatTts', true);
const speaker = setupSpeaker({ isOn: () => ttsOn });
function renderTts() {
  ttsBtn.setAttribute('aria-pressed', String(ttsOn));
  ttsBtn.title = ttsOn ? C('답변 읽어주기 켜짐 (누르면 끔)', 'Read replies aloud: on (tap to turn off)') : C('답변 읽어주기 꺼짐 (누르면 켬)', 'Read replies aloud: off (tap to turn on)');
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
  input.placeholder = C('마이크를 누르고 말씀하세요 · 오른쪽 질문을 눌러도 돼요', 'Tap the microphone and speak · or tap a question on the right');
  $('chat-send')?.remove();
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
const narrow = () => !matchMedia('(orientation: landscape) and (min-width: 960px)').matches;

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
    state.baseId = p.id;
    await loadBase();
    text = [`${fullName(p)} · ${p.finish ? `${finishName(p.finish)} · ` : ''}${won(p.price)}.`, isEn() ? '' : p.description,
      C('이 제품을 기준으로 비슷한 색·더 저렴한 제품을 찾을 수 있어요.', 'I can find similar colors or cheaper products based on this one.')].filter(Boolean).join(' ');
    state.messages.push({
      role: 'bot', text, products: [p],
      suggestions: C(['비슷한 색상 찾아 줘', '더 저렴한 제품 추천해 줘', '더 글로시한 제품 추천해 줘', '제품 정보 알려 줘'], ['Find similar colors', 'Something cheaper', 'Something glossier', 'Tell me about this product']),
    });
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
window.addEventListener('keydown', (e) => {
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
$('compare-clear').addEventListener('click', () => {
  state.compare = [];
  save();
  renderLog();
});

$('chat-reset').addEventListener('click', () => {
  speaker.stop();
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
renderLog();
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
