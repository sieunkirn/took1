// 챗봇 입력칸용 화면 터치 키보드 (한글 두벌식 · 영어 · 숫자/기호).
// 입력칸을 누르면 화면 아래(입력줄 바로 밑)에 열리고, 키보드 밖을 누르거나 '내리기'·보내기를 누르면 닫힌다.
// 기기 키보드는 inputmode="none" 으로 띄우지 않는다 (스마트미러·태블릿·휴대폰 모두 이 키보드 하나만).
// 실물 키보드(노트북·바코드 스캐너)로 치는 입력은 그대로 된다.
// 한글은 자모를 눌러 글자로 조합한다: 초성·중성·종성, 겹모음(ㅘ 등), 겹받침(ㄳ 등), 받침 넘기기(갑+ㅏ → 가바), 지우기는 자모 단위.
import { el } from './common.js';
import { isEn } from './i18n.js';
import { CHO, JUNG, JONG } from '../lib/spoken.js'; // 초성·중성·종성 표

const C = (ko, en) => (isEn() ? en : ko);

// ---------- 한글 조합 ----------
const VOWEL_PAIR = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' };
const JONG_PAIR = { 'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ' };
const JONG_SPLIT = Object.fromEntries(Object.entries(JONG_PAIR).map(([k, v]) => [v, [k[0], k[1]]]));
const isVowel = (c) => JUNG.includes(c);
const isConsonant = (c) => CHO.includes(c);
const EMPTY = () => ({ cho: '', jung: '', jong: '' });

/** 조합 중인 글자 하나를 문자열로 (없으면 '') */
function renderSyllable(s) {
  if (s.cho && s.jung) return String.fromCharCode(0xac00 + (CHO.indexOf(s.cho) * 21 + JUNG.indexOf(s.jung)) * 28 + JONG.indexOf(s.jong));
  return s.cho || s.jung || '';
}

/** 자모 하나를 넣는다 → { commit: 확정된 글자, state: 새 조합 상태, keys: 새 상태를 만든 자모들 } */
function feedJamo(state, keys, c) {
  const s = { ...state };
  const done = (commit, next, nextKeys) => ({ commit, state: next, keys: nextKeys });
  if (isVowel(c)) {
    if (s.jong) { // 받침을 다음 글자의 초성으로 넘긴다
      const split = JONG_SPLIT[s.jong];
      const [stay, move] = split || ['', s.jong];
      return done(renderSyllable({ ...s, jong: stay }), { cho: move, jung: c, jong: '' }, [move, c]);
    }
    if (s.jung) {
      const pair = VOWEL_PAIR[s.jung + c];
      if (pair) return done('', { ...s, jung: pair }, [...keys, c]);
      return done(renderSyllable(s), { cho: '', jung: c, jong: '' }, [c]);
    }
    if (s.cho) return done('', { ...s, jung: c }, [...keys, c]);
    return done('', { cho: '', jung: c, jong: '' }, [c]);
  }
  // 자음
  if (s.cho && s.jung && !s.jong && JONG.includes(c)) return done('', { ...s, jong: c }, [...keys, c]);
  if (s.jong && JONG_PAIR[s.jong + c]) return done('', { ...s, jong: JONG_PAIR[s.jong + c] }, [...keys, c]);
  return done(renderSyllable(s), { cho: c, jung: '', jong: '' }, [c]);
}

/** 자모 목록으로 조합 상태를 다시 만든다 (지우기용: 한 글자 안의 자모는 확정 없이 다시 조합된다) */
function rebuild(keys) {
  let state = EMPTY();
  let ks = [];
  for (const k of keys) ({ state, keys: ks } = feedJamo(state, ks, k));
  return { state, keys: ks };
}

// ---------- 자판 ----------
const LAYOUT = {
  ko: [['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'], ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'], ['shift', 'ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ', 'back']],
  en: [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'back']],
  sym: [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], ['-', '/', ':', ';', '(', ')', '₩', '&', '@', '"'], ['%', '~', '.', ',', '?', '!', "'", '+', 'back']],
};
const KO_SHIFT = { 'ㅂ': 'ㅃ', 'ㅈ': 'ㅉ', 'ㄷ': 'ㄸ', 'ㄱ': 'ㄲ', 'ㅅ': 'ㅆ', 'ㅐ': 'ㅒ', 'ㅔ': 'ㅖ' };

const ICON = {
  back: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H8l-6 7 6 7h13z"/><path d="m11 9 6 6m0-6-6 6"/></svg>',
  shift: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 3 12h5v8h8v-8h5z"/></svg>',
  hide: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
};

/**
 * 입력칸에 터치 키보드를 붙인다.
 * @param {{ input: HTMLInputElement, form: HTMLFormElement, mount?: (kb: HTMLElement) => void, onToggle?: (open: boolean) => void, pinned?: boolean }} opts
 *   pinned: 키보드를 항상 열어 둔다 (내리기 버튼 없음, 밖을 누르거나 보내도 닫히지 않음)
 */
export function attachTouchKeyboard({ input, form, mount, onToggle, pinned = false }) {
  input.setAttribute('inputmode', 'none'); // 기기 화면 키보드는 띄우지 않는다
  let lang = isEn() ? 'en' : 'ko';
  let mode = 'letters'; // letters | sym
  let shift = false;
  // 조합 상태: compStart 위치의 한 글자가 지금 조합 중인 글자
  let comp = EMPTY();
  let compKeys = [];
  let compStart = -1;

  const kb = el('div', { class: 'tkb hidden', role: 'group', 'aria-label': C('화면 키보드', 'On-screen keyboard') });
  const rowsBox = el('div', { class: 'tkb-rows' });
  const hideBtn = el('button', { type: 'button', class: 'tkb-hide', 'aria-label': C('키보드 내리기', 'Hide keyboard'), title: C('키보드 내리기', 'Hide keyboard') });
  hideBtn.innerHTML = ICON.hide;
  if (!pinned) kb.append(el('div', { class: 'tkb-top' }, hideBtn));
  kb.append(rowsBox);
  if (pinned) kb.classList.add('tkb-pinned');
  if (mount) mount(kb); else form.after(kb);

  // 누를 때 입력칸 포커스가 빠지지 않게 (커서·조합 유지)
  kb.addEventListener('pointerdown', (e) => e.preventDefault());
  kb.addEventListener('mousedown', (e) => e.preventDefault());

  const resetComp = () => { comp = EMPTY(); compKeys = []; compStart = -1; };
  // 다른 경로(실물 키보드·음성·커서 이동)로 칸이 바뀌었으면 조합을 끝낸다
  const compValid = () => {
    if (compStart < 0) return false;
    const txt = renderSyllable(comp);
    return input.value.slice(compStart, compStart + txt.length) === txt && input.selectionStart === compStart + txt.length && input.selectionEnd === input.selectionStart;
  };
  const setValue = (v, caret) => {
    input.value = v;
    input.setSelectionRange(caret, caret);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  // 커서 자리(선택 영역은 지우고)에 글자를 넣는다
  const insertText = (text) => {
    resetComp();
    const a = input.selectionStart ?? input.value.length;
    const b = input.selectionEnd ?? a;
    setValue(input.value.slice(0, a) + text + input.value.slice(b), a + text.length);
  };
  const typeJamo = (c) => {
    if (!compValid()) {
      resetComp();
      const a = input.selectionStart ?? input.value.length;
      const b = input.selectionEnd ?? a;
      if (b > a) setValue(input.value.slice(0, a) + input.value.slice(b), a);
      compStart = a;
    }
    const oldLen = renderSyllable(comp).length;
    const r = feedJamo(comp, compKeys, c);
    const now = renderSyllable(r.state);
    const v = input.value;
    setValue(v.slice(0, compStart) + r.commit + now + v.slice(compStart + oldLen), compStart + r.commit.length + now.length);
    compStart += r.commit.length;
    comp = r.state;
    compKeys = r.keys;
  };
  const backspace = () => {
    if (compValid() && compKeys.length) {
      const oldLen = renderSyllable(comp).length;
      ({ state: comp, keys: compKeys } = rebuild(compKeys.slice(0, -1)));
      const now = renderSyllable(comp);
      const v = input.value;
      setValue(v.slice(0, compStart) + now + v.slice(compStart + oldLen), compStart + now.length);
      if (!compKeys.length) resetComp();
      return;
    }
    resetComp();
    const a = input.selectionStart ?? input.value.length;
    const b = input.selectionEnd ?? a;
    if (b > a) setValue(input.value.slice(0, a) + input.value.slice(b), a);
    else if (a > 0) {
      const cut = /[\uD800-\uDBFF]/.test(input.value[a - 2] || '') ? 2 : 1; // 이모지 같은 두 칸 글자
      setValue(input.value.slice(0, a - cut) + input.value.slice(a), a - cut);
    }
  };

  const keyBtn = (k) => {
    const b = el('button', { type: 'button', class: 'tkb-key' });
    if (k === 'shift') {
      b.classList.add('tkb-fn', 'tkb-shift');
      b.innerHTML = ICON.shift;
      b.setAttribute('aria-label', 'Shift');
      b.setAttribute('aria-pressed', String(shift));
      b.dataset.k = 'shift';
    } else if (k === 'back') {
      b.classList.add('tkb-fn', 'tkb-back');
      b.innerHTML = ICON.back;
      b.setAttribute('aria-label', C('지우기', 'Delete'));
      b.dataset.k = 'back';
    } else {
      let ch = k;
      if (shift && lang === 'ko' && KO_SHIFT[k]) ch = KO_SHIFT[k];
      if (shift && lang === 'en' && mode === 'letters') ch = k.toUpperCase();
      b.textContent = ch;
      b.dataset.ch = ch;
    }
    return b;
  };
  const render = () => {
    rowsBox.textContent = '';
    const layout = mode === 'sym' ? LAYOUT.sym : LAYOUT[lang];
    layout.forEach((row, i) => {
      rowsBox.append(el('div', { class: 'tkb-row' + (i === 1 && mode !== 'sym' ? ' tkb-row-mid' : '') }, ...row.map(keyBtn)));
    });
    const modeBtn = el('button', { type: 'button', class: 'tkb-key tkb-fn', 'data-k': 'mode', text: mode === 'sym' ? (lang === 'ko' ? '가' : 'ABC') : '123' });
    const langBtn = el('button', { type: 'button', class: 'tkb-key tkb-fn', 'data-k': 'lang', text: lang === 'ko' ? '한/A' : 'A/한', 'aria-label': C('한글·영어 바꾸기', 'Switch Korean/English') });
    const space = el('button', { type: 'button', class: 'tkb-key tkb-space', 'data-k': 'space', 'aria-label': C('띄어쓰기', 'Space'), text: C('띄어쓰기', 'space') });
    const enter = el('button', { type: 'button', class: 'tkb-key tkb-enter', 'data-k': 'enter', text: C('보내기', 'Send') });
    rowsBox.append(el('div', { class: 'tkb-row tkb-row-bottom' }, modeBtn, langBtn, space, enter));
  };

  // 지우기 길게 누르면 계속 지운다
  let repeatTimer = 0;
  let repeated = false;
  const stopRepeat = () => { clearTimeout(repeatTimer); clearInterval(repeatTimer); repeatTimer = 0; };
  kb.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.tkb-back');
    if (!b) return;
    repeated = false;
    repeatTimer = setTimeout(() => {
      repeated = true;
      backspace();
      repeatTimer = setInterval(backspace, 70);
    }, 450);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) kb.addEventListener(ev, stopRepeat);

  kb.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b === hideBtn) { close(); return; }
    const k = b.dataset.k;
    if (b.dataset.ch) {
      const ch = b.dataset.ch;
      if (isVowel(ch) || isConsonant(ch)) typeJamo(ch); else insertText(ch);
      if (shift) { shift = false; render(); }
    } else if (k === 'back') {
      if (!repeated) backspace();
      repeated = false;
    } else if (k === 'shift') { shift = !shift; render(); }
    else if (k === 'space') insertText(' ');
    else if (k === 'mode') { mode = mode === 'sym' ? 'letters' : 'sym'; shift = false; render(); }
    else if (k === 'lang') { resetComp(); lang = lang === 'ko' ? 'en' : 'ko'; mode = 'letters'; shift = false; render(); }
    else if (k === 'enter') {
      resetComp();
      if (!input.value.trim()) return;
      form.requestSubmit();
      close();
    }
  });

  let isOpen = false;
  function open() {
    if (isOpen || input.readOnly || input.disabled) return;
    isOpen = true;
    render();
    kb.classList.remove('hidden');
    onToggle?.(true);
  }
  function close() {
    if (!isOpen || pinned) return;
    isOpen = false;
    stopRepeat();
    resetComp();
    kb.classList.add('hidden');
    input.blur();
    onToggle?.(false);
  }
  input.addEventListener('focus', open);
  input.addEventListener('pointerdown', () => { resetComp(); open(); });
  // 키보드·입력줄 밖을 누르면 닫는다
  document.addEventListener('pointerdown', (e) => {
    if (!isOpen || kb.contains(e.target) || form.contains(e.target)) return;
    close();
  });
  // 실물 키보드로 치면 조합을 끝낸다 (그 입력과 섞이지 않게)
  input.addEventListener('keydown', () => resetComp());
  form.addEventListener('submit', () => resetComp());
  if (pinned) open(); // 처음부터 열어 둔다
  return { open, close, element: kb };
}
