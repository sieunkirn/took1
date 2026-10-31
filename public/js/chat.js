// 사용자용 AI 뷰티 챗봇: 대화와 다음 질문 버튼, 마이크로 말해서 묻기.
// 넓은 화면은 추천 제품을 오른쪽 패널에 고정하고(대화엔 짧은 목록만), 좁은 화면은 대화 안에 카드로 보여 준다(CSS 로 전환).
// 제품 카드의 '+ 비교'로 비교함에 담고(최대 3개) '비교하기'를 누르면 대화에 비교표를 보여 준다.
// 오른쪽 패널은 추천 목록이 없을 때 '바코드로 제품 알아보기'(카메라 스캔·번호 입력)를 보여 주고, 인식한 제품을 대화로 설명한다.
// 답변은 규칙 기반 엔진(src/lib/chat.js)이 만든다.
import { renderNav, api, store, el, qs, detailLink, won, FINISH_LABELS, FAMILY_LABELS, finishLabel, fullName, shortName, storeLink, toast } from './common.js';
import { normalizeHex } from '../lib/color.js';
import { compareSummary, josa } from '../lib/chat.js';
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

const START = ['데일리로 바를 립 추천해 줘', '데이트 립 추천해 줘', '입술이 건조한데 뭐가 좋아?', '2만원 이하 글로시한 코랄 추천해 줘'];

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
  imageOnly: store.get('chatImageOnly', false), // 테스트용: 이미지가 있는 제품만 추천
  typing: false,
};
if (state.panel !== 'scan' && state.panel !== 'list') state.panel = state.list.length ? 'list' : 'scan';
let base = null;
let brands = [];

// 받침 유무에 따라 '을/를' 을 고른다 (예: "체리 쥬스" → "체리 쥬스를")
const eulReul = (word) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (code >= 0 && code <= 11171 && code % 28 ? '을' : '를');
};

function save() {
  store.set('chatBaseId', state.baseId);
  store.set('chatUserMessages', state.messages);
  store.set('chatUserContext', state.ctx);
  store.set('chatUserList', state.list);
  store.set('chatUserFocus', state.focus);
  store.set('chatUserCompare', state.compare);
  store.set('chatUserPanel', state.panel);
  store.set('chatImageOnly', state.imageOnly);
}

// ---------- 비교함 ----------
const COMPARE_MAX = 3;
const inCompare = (id) => state.compare.some((p) => p.id === id);

function toggleCompare(p) {
  if (inCompare(p.id)) {
    state.compare = state.compare.filter((x) => x.id !== p.id);
    toast('비교함에서 뺐어요');
  } else if (state.compare.length >= COMPARE_MAX) {
    $('compare-count').textContent = `최대 ${COMPARE_MAX}개까지 담을 수 있어요. 하나를 빼고 다시 담아 주세요.`;
    toast(`비교함은 ${COMPARE_MAX}개까지 담을 수 있어요`);
    return;
  } else {
    state.compare.push(p);
    toast(`비교함에 담았어요 (${state.compare.length}/${COMPARE_MAX})`);
  }
  save();
  renderLog();
}

function renderCompare() {
  const n = state.compare.length;
  $('compare-box').classList.toggle('hidden', !n);
  $('compare-count').textContent = `${n}/${COMPARE_MAX}` + (n < 2 ? ' · 하나 더 담으면 비교할 수 있어요' : '');
  $('compare-run').disabled = n < 2;
  $('compare-items').replaceChildren(...state.compare.map((p) => el('span', { class: 'compare-chip' },
    el('span', { text: shortName(p) }),
    el('button', { type: 'button', text: '×', 'aria-label': `${shortName(p)} 비교함에서 빼기`, onclick: () => toggleCompare(p) }))));
}

function runCompare() {
  const items = [...state.compare];
  if (items.length < 2) return;
  state.messages.push({ role: 'user', text: `비교함에 담은 ${items.length}개 비교해 줘` });
  const text = `${items.length}개를 나란히 놓고 비교해 봤어요. ${compareSummary(items)}`;
  state.messages.push({
    role: 'bot', kind: 'compare', text, products: items,
    suggestions: ['다른 거 더 보여 줘', '데일리로 바를 립 추천해 줘'],
  });
  speaker.speak(text);
  save();
  renderLog();
}

// 비교표: 제품을 열로 나란히 놓는다 (가장 저렴한 가격에는 표시)
function compareTable(items) {
  const cheapest = Math.min(...items.map((p) => p.price));
  const tone = (L) => (L >= 60 ? '밝은 편' : L >= 45 ? '중간' : '진한 편');
  const rows = [
    ['제품', (p) => fullName(p)],
    ['색상 계열', (p) => FAMILY_LABELS[p.color_family] || p.color_family],
    ['제형', (p) => finishLabel(p.finish)],
    ['가격', (p) => won(p.price) + (p.price === cheapest && items.some((x) => x.price !== cheapest) ? ' (최저가)' : '')],
    ['밝기', (p) => tone(p.color_lab.L)],
    ['색상값', (p) => p.color_hex],
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

async function setBase(id) {
  state.baseId = id;
  await loadBase();
  state.messages.push({
    role: 'bot',
    text: `${eulReul(shortName(base))} 기준 제품으로 정했어요. "더 저렴한 거", "비슷한 색"처럼 물어보세요.`,
    suggestions: ['비슷한 색상 찾아 줘', '더 저렴한 제품 추천해 줘', '더 밝은 색 추천해 줘'],
  });
  save();
  renderLog();
}

// ---------- 대화 그리기 ----------
function productMini(p, n) {
  return el('div', { class: 'card mini' + (state.focus.includes(p.id) ? ' focus' : ''), 'data-product-id': p.id },
    // 대표 이미지가 있는 제품만 사진을 보여 준다 (불러오지 못하면 사진 자리를 뺀다)
    p.image_url ? el('img', {
      class: 'card-img', src: p.image_url, alt: fullName(p), loading: 'lazy', referrerpolicy: 'no-referrer',
      onerror: (e) => e.target.remove(),
    }) : null,
    el('div', {}, n ? el('strong', { text: `${n}번 ` }) : null, el('span', { text: fullName(p) })),
    el('div', { class: 'muted small', text: [p.finish ? FINISH_LABELS[p.finish] : null, won(p.price), p.color_options ? `${p.color_options}가지 색상 중 대표색` : null,
      p.similarity !== undefined ? `기준 색과 유사도 ${p.similarity}%` : null].filter(Boolean).join(' · ') }),
    el('div', { class: 'actions' },
      detailLink(p, 'chat'),
      storeLink(p, '올리브영'),
      STUDIO ? el('button', { type: 'button', text: '입술에 발라보기', onclick: () => window.dispatchEvent(new CustomEvent('took:apply', { detail: { hex: p.color_hex, finish: p.finish } })) }) : null,
      el('button', { type: 'button', text: '기준 제품으로', onclick: () => setBase(p.id) }),
      el('button', {
        type: 'button', text: inCompare(p.id) ? '✓ 비교함' : '+ 비교', 'aria-pressed': String(inCompare(p.id)),
        onclick: () => toggleCompare(p),
      })));
}

function bubble(m, isLastBot) {
  const who = m.role === 'user' ? '나' : 'took 챗봇';
  return el('div', { class: 'bubble ' + m.role },
    el('div', { class: 'who', text: who }),
    el('div', { text: m.text }),
    // 비교 답변은 비교표로, 그 밖에는 좁은 화면용 카드 / 넓은 화면용 짧은 목록 (둘 중 하나만 CSS 로 보인다)
    m.kind === 'compare' && m.products?.length >= 2 ? compareTable(m.products) : null,
    m.kind !== 'compare' && m.products?.length ? el('div', { class: 'mini-list' }, ...m.products.map((p) => productMini(p, p.n))) : null,
    m.kind !== 'compare' && m.products?.length ? el('div', { class: 'mini-names muted small', text: '→ ' + m.products.map((p) => `${p.n ? p.n + '번 ' : ''}${shortName(p)}`).join(' / ') }) : null,
    // 다음 질문 추천: 가장 최근 챗봇 답변에만 버튼으로 보여준다
    isLastBot && m.suggestions?.length && !state.typing
      ? el('div', { class: 'row suggest' }, ...m.suggestions.map((q) => el('button', { type: 'button', text: q, onclick: () => send(q) })))
      : null);
}

function welcome() {
  const color = !base && state.selectedHex ? ` 립 컬러 매핑에서 고른 ${state.selectedHex} 색과 비슷한 제품도 찾아 드릴 수 있어요.` : '';
  return {
    role: 'bot',
    text: `안녕하세요! took 뷰티 챗봇이에요. 찾는 립 컬러, 바를 자리, 입술 고민을 편하게 말씀해 주세요. 마이크 버튼을 누르면 말로 물어볼 수도 있어요.${color}`,
    suggestions: START,
  };
}

function renderPanel() {
  if (!STUDIO) {
    // 챗봇 화면: 오른쪽 패널 하나를 바코드 ↔ 추천 목록으로 바꿔 쓴다 (합본 화면은 탭이 따로 있다)
    const scan = state.panel === 'scan';
    $('scan-view').classList.toggle('hidden', !scan);
    $('list-view').classList.toggle('hidden', scan);
    $('panel-label').textContent = scan ? '바코드로 제품 알아보기' : '추천 제품';
    const toggle = $('panel-toggle');
    toggle.textContent = scan ? `추천 목록 보기 (${state.list.length})` : '바코드로 찾기';
    toggle.classList.toggle('hidden', scan && !state.list.length);
  }
  const status = $('rec-status');
  if (!state.list.length) {
    status.textContent = state.ctx?.query
      ? '조건에 맞는 제품이 없어요. 대화에서 조건을 바꿔 보세요.'
      : '대화에서 추천받은 제품이 여기에 표시돼요. "2번 자세히"처럼 번호로 물어볼 수 있어요.';
    $('rec-list').replaceChildren();
    return;
  }
  status.textContent = `추천 제품 ${state.list.length}개 · "2번 자세히", "1번이랑 2번 비교"처럼 번호로 물어보세요.`;
  $('rec-list').replaceChildren(...state.list.map((p) => productMini(p, p.n)));
  $('rec-list').querySelector('.focus')?.scrollIntoView({ block: 'nearest' });
}

function renderLog() {
  renderPanel();
  renderCompare();
  const messages = state.messages.length ? state.messages : [welcome()];
  const lastBot = messages.findLastIndex((m) => m.role === 'bot');
  log.replaceChildren(...[
    ...messages.map((m, i) => bubble(m, i === lastBot)),
    state.typing ? el('div', { class: 'bubble bot typing' }, el('div', { class: 'who', text: 'took 챗봇' }),
      el('div', { class: 'muted', text: '답변을 준비하고 있어요' }, el('span', { class: 'dots', 'aria-hidden': 'true' }))) : null,
  ].filter(Boolean));
  log.scrollTop = log.scrollHeight;
}

// ---------- 보내기 ----------
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
      imageOnly: state.imageOnly,
    }),
  });
  // 답변 길이에 맞춰 잠깐 '답변 준비 중'을 보여 준다 (화면 전환이 너무 갑작스럽지 않게)
  const wait = ok ? Math.min(900, 250 + body.reply.length * 4) - (performance.now() - started) : 0;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  state.typing = false;
  if (!ok) {
    state.messages.push({ role: 'bot', text: '죄송해요, 답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요. (' + (body.error || '응답 실패') + ')' });
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
  renderLog();
}

// ---------- 음성 질문 / 읽어주기 ----------
const ttsBtn = $('tts');
let ttsOn = store.get('chatTts', true);
const speaker = setupSpeaker({ isOn: () => ttsOn });
function renderTts() {
  ttsBtn.setAttribute('aria-pressed', String(ttsOn));
  ttsBtn.title = ttsOn ? '답변 읽어주기 켜짐 (누르면 끔)' : '답변 읽어주기 꺼짐 (누르면 켬)';
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
    voiceBtn.title = on ? '듣는 중 (누르면 멈춤)' : '음성으로 질문';
  },
});

// ---------- 그 밖의 버튼 ----------
$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  send(input.value);
});
// ---------- 바코드로 제품 알아보기 (오른쪽 패널) ----------
const scanVideo = $('scan-video');
const SCAN_TIP = '바코드가 가운데 네모를 가득 채우게 들어 주세요. 너무 가까우면 흐려지니, 흐리면 조금 떨어뜨려 주세요.';
let lastProgress = 0;
const scanner = createBarcodeScanner({
  video: scanVideo,
  onCode: (code) => handleBarcode(code, 'camera'),
  // 읽는 중임을 보여 준다 (1초에 한 번). 8초 넘게 못 읽으면 잘 읽히는 요령을 덧붙인다
  onProgress: ({ frames, width, height, ms }) => {
    if (ms - lastProgress < 1000) return;
    lastProgress = ms;
    const help = ms > 8000
      ? ' 잘 안 읽히면: 휴대폰 화면의 바코드는 밝기를 최대로, 비스듬히 들어 반사를 피하고, 인쇄한 종이도 좋아요. 아래에 번호를 입력해도 돼요.'
      : '';
    $('scan-status').textContent = `읽는 중… (카메라 ${width}×${height}, ${frames}번 확인) ${SCAN_TIP}${help}`;
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
  $('scan-status').textContent = '카메라를 켜는 중이에요...';
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

// 바코드 번호 → 등록 제품 조회 → 대화로 설명하고 기준 제품으로 정한다. 등록되지 않은 제품은 지어내지 않는다
async function handleBarcode(raw, source) {
  const code = String(raw).replace(/\D/g, '');
  stopScan();
  if (!/^\d{8,14}$/.test(code)) {
    $('scan-status').textContent = '바코드 번호는 8~14자리 숫자예요. 다시 확인해 주세요.';
    return;
  }
  $('scan-status').textContent = `인식했어요: ${code}`;
  const said = { camera: `바코드 찍었어요 (${code})`, phone: `휴대폰으로 바코드 찍었어요 (${code})`, photo: `바코드 사진을 올렸어요 (${code})` };
  state.messages.push({ role: 'user', text: said[source] || `바코드 ${code} 알려 줘` });
  const { ok, body } = await api('api/products/barcode/' + encodeURIComponent(code));
  let text;
  if (!ok) {
    text = '바코드 번호를 제대로 읽지 못했어요. 다시 찍어 보시거나 번호를 직접 입력해 주세요.';
    state.messages.push({ role: 'bot', text, suggestions: START });
  } else if (!body.found) {
    text = `바코드 번호 ${code}에 해당하는 제품은 아직 등록되어 있지 않아요. 등록된 제품만 정확하게 알려 드릴 수 있어서, 다른 제품을 찍어 보시거나 찾는 립을 말로 알려 주세요.`;
    state.messages.push({ role: 'bot', text, suggestions: START });
    $('scan-result').replaceChildren();
  } else {
    const p = body.product;
    state.baseId = p.id;
    await loadBase();
    text = [`${josa(fullName(p), '이네요', '네요')}!`, p.description, `${p.finish ? `${FINISH_LABELS[p.finish]} 제형이고 ` : ''}가격은 ${won(p.price)}이에요.`].filter(Boolean).join(' ') + ' '
      + '이 제품을 기준으로 해 둘게요. 비슷한 색이나 더 저렴한 제품도 찾아 드릴 수 있어요.';
    state.messages.push({
      role: 'bot', text, products: [p],
      suggestions: ['비슷한 색상 찾아 줘', '더 저렴한 제품 추천해 줘', '더 글로시한 제품 추천해 줘', '제품 정보 알려 줘'],
    });
    $('scan-result').replaceChildren(el('div', { class: 'muted small', text: '인식한 제품' }), productMini(p));
  }
  speaker.speak(text);
  save();
  renderLog();
  if (narrow()) document.body.classList.remove('scan-open'); // 좁은 화면은 대화에서 바로 설명을 보도록 패널을 닫는다
  showTab('chat'); // 합본 화면: 설명은 챗봇 탭에서 본다
}

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
    status.textContent = '휴대폰 연결은 서버를 실행(npm start)했을 때만 쓸 수 있어요. 아래 PC 카메라나 번호 입력을 이용해 주세요.';
    $('pair-qr').replaceChildren();
    return;
  }
  pairId = body.id;
  if (!body.phoneUrl) {
    status.textContent = 'PC의 와이파이 주소를 찾지 못했어요. PC가 와이파이(공유기)에 연결돼 있는지 확인해 주세요.';
    return;
  }
  const ZXing = await loadZXing().catch(() => null);
  if (ZXing) {
    const qr = new ZXing.BrowserQRCodeSvgWriter().write(body.phoneUrl, 132, 132);
    qr.setAttribute('shape-rendering', 'crispEdges'); // 칸 경계를 흐리지 않아 휴대폰 카메라가 잘 읽는다
    $('pair-qr').replaceChildren(qr);
  }
  $('pair-url').textContent = `QR이 안 되면 휴대폰 브라우저 주소창에 입력: ${body.phoneUrl}`;
  status.textContent = '휴대폰 연결을 기다리고 있어요. PC와 휴대폰이 같은 와이파이에 있어야 해요.';
  let after = 0;
  let failures = 0;
  const check = async () => {
    const r = await api(`api/pair/${pairId}/poll?after=${after}`).catch(() => ({ ok: false, status: 0 }));
    if (r.status === 404) {
      // 서버를 다시 켜면 연결 정보가 사라지므로 새 QR 을 만든다
      clearInterval(pairTimer);
      pairId = null;
      status.textContent = '연결이 끝나서 새 QR을 만드는 중이에요…';
      setTimeout(startPairing, 1500);
      return;
    }
    if (!r.ok) {
      if (++failures >= 3) status.textContent = '서버와 연결이 잠시 끊겼어요. 다시 연결하는 중이에요…';
      return;
    }
    failures = 0;
    after = r.body.last;
    for (const e of r.body.events) {
      if (e.type === 'phone') status.textContent = '휴대폰이 연결됐어요! 휴대폰에서 바코드를 찍어 주세요.';
      if (e.type === 'code') {
        status.textContent = `휴대폰에서 바코드를 받았어요 (${e.data.code}).`;
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
  $('scan-status').textContent = '사진에서 바코드를 찾는 중이에요…';
  const code = await decodeImageFile(file).catch(() => null);
  if (code) handleBarcode(code, 'photo');
  else $('scan-status').textContent = '사진에서 바코드를 찾지 못했어요. 바코드가 가운데에 크게, 선명하게 나온 사진으로 다시 해 주세요.';
});

$('scan-start').addEventListener('click', startScan);
$('scan-stop').addEventListener('click', () => {
  stopScan();
  $('scan-status').textContent = '카메라를 껐어요.';
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
// 테스트용 '이미지ver.': 켜면 이미지가 있는 제품만으로 바로 다시 추천하고, 끄면 전체 제품으로 돌아간다
const imgBtn = $('img-only');
function renderImageOnly() {
  imgBtn.setAttribute('aria-pressed', String(state.imageOnly));
  imgBtn.title = state.imageOnly ? '이미지가 있는 제품만 추천 중 (누르면 전체 제품)' : '이미지가 있는 제품만 추천 받기';
}
imgBtn.addEventListener('click', () => {
  if (state.typing) return;
  state.imageOnly = !state.imageOnly;
  state.ctx = null; // 새 목록부터 다시
  save();
  renderImageOnly();
  if (state.imageOnly) {
    toast('이미지가 있는 제품만 추천할게요');
    send(state.selectedHex ? '지금 고른 색과 비슷한 제품 추천해 줘' : '립 추천해 줘');
  } else {
    toast('전체 제품으로 추천할게요');
  }
});
renderImageOnly();

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
    $('scan-note').textContent = '지금 쓰는 올리브영 상품 데이터에는 바코드 정보가 아직 없어요. 바코드를 찍어도 "등록되지 않은 제품"으로 나오니, 찾는 립을 말로 물어봐 주세요.';
    $('scan-note').classList.remove('hidden');
  }
});
await loadBase();
// 바코드 검색·제품 상세에서 기준 제품을 가지고 들어온 경우 안내
if (qs('base') && base && !state.messages.some((m) => m.baseNotice === base.id)) {
  state.messages.push({
    role: 'bot', baseNotice: base.id,
    text: `${eulReul(fullName(base))} 기준으로 질문에 답할게요. 이 제품보다 저렴한 것, 비슷한 색, 더 촉촉한 제형 등을 물어보세요.`,
    suggestions: ['더 저렴한 제품 추천해 줘', '비슷한 색상 찾아 줘', '더 글로시한 제품 추천해 줘', '이 제품 가격 얼마야?'],
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
    send('지금 고른 색과 비슷한 제품 추천해 줘');
  });
}
if (!narrow()) startPairing(); // 넓은 화면(PC)에서는 바로 휴대폰 연결 QR 을 준비한다
