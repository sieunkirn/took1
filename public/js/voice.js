// 챗봇 음성 기능 (Web Speech API, 화면 언어에 따라 한국어 ko-KR / 영어 en-US). AI 뷰티 챗봇(chat.html)과 합본(studio.html)의 챗봇 탭이 쓴다.
// - 음성 질문: 브라우저 음성 인식 서비스가 말을 글자로 바꾸고, 후보 문장 중 챗봇이 가장 잘 알아듣는 것을 고른다
// - 읽어주기: 챗봇 답변을 브라우저 음성 합성으로 읽는다
import { parseMessage, normalizeForChat } from '../lib/chat.js';
import { parseMessageEn } from '../lib/chat-en.js';
import { shortName } from './common.js'; // 화면 언어에 맞춘 제품 이름
import { t, isEn } from './i18n.js';

// 음성 인식·읽어주기 언어 (화면 언어를 따른다)
const speechLang = () => (isEn() ? 'en-US' : 'ko-KR');

export const speechApi = () => window.SpeechRecognition || window.webkitSpeechRecognition;

// iPad Safari 는 말을 멈춰도 듣기가 끝나지 않을 때가 있어, 마지막으로 말이 들린 뒤 이만큼 조용하면 직접 멈춘다
const SILENCE_MS = 1600;
const MAX_LISTEN_MS = 12000; // 한 번에 듣는 최대 시간

function voiceErrorMessage(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return t('voice.denied');
    case 'no-speech':
      return t('voice.noSpeech');
    case 'audio-capture':
      return t('voice.noMic');
    case 'network':
      return t('voice.network');
    default:
      return t('voice.error', { code });
  }
}

// 음성 인식 후보 중 챗봇이 가장 많은 조건을 알아듣는 문장을 고른다 (같으면 인식 신뢰도가 높은 앞 후보)
export function bestAlternative(alternatives, brands) {
  const score = (text) => {
    if (isEn()) return Object.keys(parseMessageEn(text)).length;
    const fixed = normalizeForChat(text, brands);
    return Object.keys(parseMessage(fixed.text, brands)).length - fixed.corrections.length * 0.1;
  };
  return alternatives.reduce((best, t) => (score(t) > score(best) ? t : best), alternatives[0]);
}

/**
 * 한 문장 듣기. 챗봇의 음성 질문과 음성 정확도 측정(voice-test.html)이 같은 설정으로 쓴다.
 * @param {{ getBrands: () => string[], onInterim?: (text: string) => void, lang?: string }} opts
 * @returns {{ done: Promise<{ text: string, raw: string[][], candidates: number, error: string|null, ms: number }>, stop: () => void, abort: () => void }}
 *   raw: 문장 조각마다 인식 서비스가 준 후보 목록 (측정용), text: 후보 중 고른 문장
 */
export function listenOnce({ getBrands, onInterim, lang = speechLang() }) {
  const SR = speechApi();
  const recognition = new SR();
  recognition.lang = lang;
  recognition.interimResults = true; // 말하는 동안 입력창에 바로 보여준다
  recognition.continuous = false; // 한 문장 말하고 멈추면 자동 종료
  recognition.maxAlternatives = 5; // 비슷하게 들린 후보 문장을 여러 개 받아 그중 가장 말이 되는 것을 고른다 (Safari 는 1개만 줄 수 있다)
  let finalText = '';
  let lastInterim = '';
  let candidates = 0;
  let error = null;
  const raw = [];
  const started = performance.now();
  let silence = null;
  const cap = setTimeout(() => recognition.stop(), MAX_LISTEN_MS);
  const done = new Promise((resolve) => {
    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const alts = Array.from(e.results[i], (a) => a.transcript.trim()).filter(Boolean);
        if (e.results[i].isFinal) {
          raw.push(alts);
          candidates += alts.length;
          finalText += ' ' + bestAlternative(alts, getBrands());
        } else interim += e.results[i][0].transcript;
      }
      lastInterim = interim;
      onInterim?.((finalText + interim).trim());
      clearTimeout(silence);
      silence = setTimeout(() => recognition.stop(), SILENCE_MS);
    };
    recognition.onerror = (e) => {
      if (e.error !== 'aborted') error = e.error;
    };
    recognition.onend = () => {
      clearTimeout(silence);
      clearTimeout(cap);
      // 멈출 때 마지막 조각이 확정되지 않았으면(Safari) 들은 데까지를 쓴다
      if (!finalText.trim() && lastInterim.trim()) {
        raw.push([lastInterim.trim()]);
        finalText = lastInterim;
      }
      resolve({ text: finalText.trim(), raw, candidates, error, ms: Math.round(performance.now() - started) });
    };
  });
  try {
    recognition.start();
  } catch (e) {
    clearTimeout(cap);
    return { done: Promise.resolve({ text: '', raw, candidates: 0, error: e.message, ms: 0 }), stop() {}, abort() {} };
  }
  return { done, stop: () => recognition.stop(), abort: () => recognition.abort() };
}

/**
 * 음성 질문 버튼을 연결한다.
 * @param {{ button: HTMLButtonElement, input: HTMLInputElement, status: HTMLElement, getBrands: () => string[],
 *   onText: (text: string) => void, beforeStart?: () => void, onListening?: (on: boolean) => void }} opts
 */
export function setupVoiceInput({ button, input, status, getBrands, onText, beforeStart, onListening }) {
  let session = null;
  const setListening = (on) => {
    button.setAttribute('aria-pressed', String(on));
    onListening?.(on);
  };
  if (!speechApi()) {
    button.disabled = true;
    status.textContent = t('voice.unsupported');
    return { stop() {} };
  }

  async function start() {
    beforeStart?.();
    input.value = '';
    status.textContent = t('voice.listening');
    setListening(true);
    session = listenOnce({ getBrands, onInterim: (t) => { input.value = t; } });
    const { text, candidates, error } = await session.done;
    session = null;
    setListening(false);
    if (text) {
      const fixed = isEn() ? text : normalizeForChat(text, getBrands()).text; // 발음 보정은 한국어만
      status.textContent = t('voice.heard', { text }) + (candidates > 1 ? t('voice.candidates', { n: candidates }) : '')
        + (fixed !== text ? t('voice.understood', { text: fixed }) : '');
      onText(text);
    } else {
      status.textContent = error ? voiceErrorMessage(error) : t('voice.nothing');
    }
  }

  button.addEventListener('click', () => {
    if (session) session.stop(); // 듣는 중이면 지금까지 들은 내용으로 종료
    else start();
  });
  window.addEventListener('pagehide', () => session?.abort());
  return { stop: () => session?.abort() };
}

export { voiceErrorMessage };

// 화면용 답변의 기호·색상 코드를 소리로 읽기 좋은 문장으로 바꾸고, 추천 제품은 앞의 3개만 이름을 읽는다
export function spokenReply(body) {
  const names = (body.products || []).slice(0, 3).map(shortName);
  if (isEn()) {
    let text = body.reply
      .replace(/#[0-9A-Fa-f]{6}/g, '')
      .replace(/\(L\* [\d.]+\)/g, '')
      .replace(/([≤<>]) /g, (m, op) => `${{ '≤': 'up to', '<': 'under', '>': 'over' }[op]} `)
      .replace(/=/g, ' ').replace(/₩([\d,]+)/g, '$1 won')
      .replace(/\s+/g, ' ');
    if (names.length) text += ` Recommended: ${names.join(', ')}${body.products.length > 3 ? ' and more' : ''}.`;
    return text;
  }
  let text = body.reply
    .replace(/#[0-9A-Fa-f]{6}/g, '')
    .replace(/\(기준 명도 L\* [\d.]+\)/g, '')
    .replace(/([≤<>]) ([^,)\d]*[\d,]+원|[^,)]+)/g, (m, op, v) => `${v} ${{ '≤': '이하', '<': '미만', '>': '초과' }[op]}`) // "가격 ≤ 2만원" → "가격 2만원 이하"
    .replace(/=/g, ' ')
    .replace(/과\(와\)/g, '과').replace(/을\(를\)/g, '을').replace(/\(으\)로/g, '로')
    .replace(/\s+/g, ' ');
  if (names.length) text += ` 추천 제품은 ${names.join(', ')}${body.products.length > 3 ? ' 등' : ''}입니다.`;
  return text;
}

/**
 * 답변 읽어주기.
 * @param {{ isOn: () => boolean, onSpeaking?: (on: boolean) => void }} opts
 */
export function setupSpeaker({ isOn, onSpeaking }) {
  const synth = window.speechSynthesis;
  // 화면 언어의 목소리 (한국어 ko-, 영어 en-)
  const langVoice = () => synth?.getVoices().find((v) => v.lang?.toLowerCase().startsWith(isEn() ? 'en' : 'ko'));
  const stop = () => {
    synth?.cancel();
    onSpeaking?.(false);
  };
  const speak = (text) => {
    if (!synth || !isOn() || !text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechLang();
    const voice = langVoice();
    if (voice) u.voice = voice;
    u.rate = 1.05;
    u.onstart = () => onSpeaking?.(true);
    u.onend = u.onerror = () => onSpeaking?.(false);
    synth.speak(u);
  };
  window.addEventListener('pagehide', stop);
  return { supported: !!synth, speak, stop };
}
