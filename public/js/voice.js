// 챗봇 음성 기능 (Web Speech API, 한국어). AI 뷰티 챗봇(chat.html)과 합본(studio.html)의 챗봇 탭이 쓴다.
// - 음성 질문: 브라우저 음성 인식 서비스가 말을 글자로 바꾸고, 후보 문장 중 챗봇이 가장 잘 알아듣는 것을 고른다
// - 읽어주기: 챗봇 답변을 브라우저 음성 합성으로 읽는다
import { parseMessage, chatVocab, chatKeepWords } from '../lib/chat.js';
import { shortName } from '../lib/catalog.js';
import { normalizeSpoken } from '../lib/spoken.js';

const speechApi = () => window.SpeechRecognition || window.webkitSpeechRecognition;

function voiceErrorMessage(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '마이크 권한이 거부되었습니다. 주소창의 마이크 권한을 허용한 뒤 다시 눌러 주세요.';
    case 'no-speech':
      return '말소리가 들리지 않았습니다. 버튼을 다시 누르고 말씀해 주세요.';
    case 'audio-capture':
      return '마이크를 찾지 못했습니다. 마이크 연결을 확인해 주세요.';
    case 'network':
      return '음성 인식 서비스에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.';
    default:
      return '음성 인식 중 오류가 발생했습니다: ' + code;
  }
}

// 음성 인식 후보 중 챗봇이 가장 많은 조건을 알아듣는 문장을 고른다 (같으면 인식 신뢰도가 높은 앞 후보)
function bestAlternative(alternatives, brands) {
  const vocab = chatVocab(brands);
  const score = (t) => {
    const fixed = normalizeSpoken(t, vocab, chatKeepWords());
    return Object.keys(parseMessage(fixed.text, brands)).length - fixed.corrections.length * 0.1;
  };
  return alternatives.reduce((best, t) => (score(t) > score(best) ? t : best), alternatives[0]);
}

/**
 * 음성 질문 버튼을 연결한다.
 * @param {{ button: HTMLButtonElement, input: HTMLInputElement, status: HTMLElement, getBrands: () => string[],
 *   onText: (text: string) => void, beforeStart?: () => void, onListening?: (on: boolean) => void }} opts
 */
export function setupVoiceInput({ button, input, status, getBrands, onText, beforeStart, onListening }) {
  let recognition = null;
  const setListening = (on) => {
    button.setAttribute('aria-pressed', String(on));
    onListening?.(on);
  };
  if (!speechApi()) {
    button.disabled = true;
    status.textContent = '이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge 에서 사용해 주세요.';
    return { stop() {} };
  }

  function start() {
    const SR = speechApi();
    let finalText = '';
    let candidates = 0;
    let failed = false;
    recognition = new SR();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true; // 말하는 동안 입력창에 바로 보여준다
    recognition.continuous = false; // 한 문장 말하고 멈추면 자동 종료
    recognition.maxAlternatives = 5; // 비슷하게 들린 후보 문장을 여러 개 받아 그중 가장 말이 되는 것을 고른다
    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const alts = Array.from(e.results[i], (a) => a.transcript.trim()).filter(Boolean);
        if (e.results[i].isFinal) {
          candidates += alts.length;
          finalText += ' ' + bestAlternative(alts, getBrands());
        } else interim += e.results[i][0].transcript;
      }
      input.value = (finalText + interim).trim();
    };
    recognition.onerror = (e) => {
      if (e.error === 'aborted') return;
      failed = true;
      status.textContent = voiceErrorMessage(e.error);
    };
    recognition.onend = () => {
      recognition = null;
      setListening(false);
      const text = finalText.trim();
      if (text) {
        const fixed = normalizeSpoken(text, chatVocab(getBrands()), chatKeepWords()).text;
        status.textContent = `들은 내용: "${text}"` + (candidates > 1 ? ` (후보 ${candidates}개 중 선택)` : '')
          + (fixed !== text ? ` → 이해한 내용: "${fixed}"` : '');
        onText(text);
      } else if (!failed) {
        status.textContent = '인식된 말이 없습니다. 버튼을 다시 누르고 말씀해 주세요.';
      }
    };
    beforeStart?.();
    input.value = '';
    status.textContent = '말씀해 주세요. 말을 멈추면 자동으로 질문을 보냅니다.';
    setListening(true);
    try {
      recognition.start();
    } catch (e) {
      recognition = null;
      setListening(false);
      status.textContent = '음성 인식을 시작하지 못했습니다: ' + e.message;
    }
  }

  button.addEventListener('click', () => {
    if (recognition) recognition.stop(); // 듣는 중이면 지금까지 들은 내용으로 종료
    else start();
  });
  window.addEventListener('pagehide', () => recognition?.abort());
  return { stop: () => recognition?.abort() };
}

// 화면용 답변의 기호·색상 코드를 소리로 읽기 좋은 문장으로 바꾸고, 추천 제품은 앞의 3개만 이름을 읽는다
export function spokenReply(body) {
  let text = body.reply
    .replace(/#[0-9A-Fa-f]{6}/g, '')
    .replace(/\(기준 명도 L\* [\d.]+\)/g, '')
    .replace(/([≤<>]) ([^,)\d]*[\d,]+원|[^,)]+)/g, (m, op, v) => `${v} ${{ '≤': '이하', '<': '미만', '>': '초과' }[op]}`) // "가격 ≤ 2만원" → "가격 2만원 이하"
    .replace(/=/g, ' ')
    .replace(/과\(와\)/g, '과').replace(/을\(를\)/g, '을').replace(/\(으\)로/g, '로')
    .replace(/\s+/g, ' ');
  const names = (body.products || []).slice(0, 3).map(shortName);
  if (names.length) text += ` 추천 제품은 ${names.join(', ')}${body.products.length > 3 ? ' 등' : ''}입니다.`;
  return text;
}

/**
 * 답변 읽어주기.
 * @param {{ isOn: () => boolean, onSpeaking?: (on: boolean) => void }} opts
 */
export function setupSpeaker({ isOn, onSpeaking }) {
  const synth = window.speechSynthesis;
  const koVoice = () => synth?.getVoices().find((v) => v.lang?.toLowerCase().startsWith('ko'));
  const stop = () => {
    synth?.cancel();
    onSpeaking?.(false);
  };
  const speak = (text) => {
    if (!synth || !isOn() || !text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    const voice = koVoice();
    if (voice) u.voice = voice;
    u.rate = 1.05;
    u.onstart = () => onSpeaking?.(true);
    u.onend = u.onerror = () => onSpeaking?.(false);
    synth.speak(u);
  };
  window.addEventListener('pagehide', stop);
  return { supported: !!synth, speak, stop };
}
