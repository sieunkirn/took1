// 챗봇 화면: 제품을 직접 가져와 묻기. 바코드(카메라·스캐너·번호·사진·휴대폰 QR 연결)와 NFC 태그.
import { $, api, el, won, fullName, shortName } from './common.js';
import { isEn, finishText as finishName } from './i18n.js';
import { listenNfc, normalizeTag, resolveTag, createNfcHint } from './nfc.js';
import { createBarcodeScanner, cameraErrorMessage, decodeImageFile } from './barcode-scan.js';
import { C, STUDIO, BARCODE_PANEL, showTab, input, START, state, save, loadBase } from './chat-state.js';
import { productMini, renderPanel, renderLog, streamReply } from './chat-view.js';
import { speaker } from './chat-input.js';

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
export const narrow = () => !matchMedia(WIDE).matches;

function setScanning(on) {
  scanVideo.classList.toggle('hidden', !on);
  $('scan-guide').classList.toggle('hidden', !on);
  $('scan-placeholder').classList.toggle('hidden', on);
  $('scan-start').classList.toggle('hidden', on);
  $('scan-stop').classList.toggle('hidden', !on);
}

export function stopScan() {
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
const nfcFlash = createNfcHint(nfcHint, { idleText: NFC_IDLE, ms: 2500 });
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
if (!STUDIO) {
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
  const said = C({ camera: `바코드 찍었어요 (${code})`, scanner: `스캐너로 바코드 찍었어요 (${code})`, photo: `바코드 사진을 올렸어요 (${code})` },
    { camera: `Scanned a barcode (${code})`, scanner: `Scanned with the scanner (${code})`, photo: `Uploaded a barcode photo (${code})` });
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
