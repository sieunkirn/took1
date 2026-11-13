// 챗봇 화면: 묻는 방법. 마이크로 말하기, 답변 읽어 주기, 화면 터치 키보드.
import { $, store } from './common.js';
import { setupVoiceInput, setupSpeaker } from './voice.js';
import { attachTouchKeyboard } from './touch-keyboard.js';
import { C, log, input, brands } from './chat-state.js';
import { send } from './chat.js';

// ---------- 음성 질문 / 읽어주기 ----------
const ttsBtn = $('tts');
let ttsOn = store.get('chatTts', true);
export const speaker = setupSpeaker({ isOn: () => ttsOn });
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
  input.placeholder = C('마이크로 말하거나 아래 키보드로 입력하세요', 'Speak into the mic, or type with the keyboard below');
} else {
  input.tabIndex = -1;
  input.placeholder = C('마이크를 누르고 말씀해 주세요 · 오른쪽 질문을 눌러도 돼요', 'Tap the microphone and speak · or tap a question on the right');
  $('chat-send')?.remove();
}
$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (KEYBOARD_INPUT) send(input.value);
});
// 화면 터치 키보드: 입력줄 아래에 한/영 키보드를 항상 열어 둔다 (2026-11-11 고정, 기기 키보드 대신, js/touch-keyboard.js)
if (KEYBOARD_INPUT) {
  attachTouchKeyboard({
    input,
    form: $('chat-form'),
    pinned: true,
    onToggle: (on) => { if (on) requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; }); },
  });
}
