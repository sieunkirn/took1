// 거울 위 플로팅 퀵 추천 (2026-11-21 사용자 요청 "챗봇이라기보다 거울에 플로팅 버튼으로 간단하게, 터치 몇 번이면").
// 시안: 시안-퀵리플라이/mirror-float-demo.png
// 질문 세 개 (2026-11-21 사용자 설계):
//   ① 언제? 데일리 · 데이트 · 면접 · 하객·행사 (2026-11-21 사용자 요청으로 4개, 하객과 행사를 하나로. 칸마다 선 아이콘)
//   ② 톤? 봄 웜 · 여름 쿨 · 가을 웜 · 겨울 쿨 — 모르면 '내 톤 측정해 보기' → 측정 도우미(얼굴 맞추기 안내·얼굴을 찾으면 3초 세고 자동 시작)
//      누르는 순간 그 톤에 맞는 립 색(lip-engine.js matchPresets)을 입술에 미리 바른다
//   ③ 분위기? 화사하게 · 차분하게 · 자연스럽게 · 또렷하게
// 끝나면: 톤 색을 언제·분위기에 맞게 밝기·채도를 조금 옮긴 색을 입술에 바르고(누르는 순간 보이게), 제형 조건(분위기 > 언제)과 함께
// 가운데 로고 버튼의 추천 시트를 연다 (palette.js onDone: 시트 상단에 고른 답으로 안내 멘트, 1위 제품을 바로 바름).
// 그래도 마음에 안 들면 (시트의 '마음에 안 드세요?' → openRefine): 무엇이 아쉬운지 묻는다 — 가격(상한 고르기) · 건조해요(촉촉한 글로시) ·
// 지속력(매트·벨벳) · 발색(더 진하게) · 처음부터. 고르면 palette.js onRefine 이 조건을 더해 시트를 다시 연다.
// 제형으로 바꾸는 규칙(건조 → 글로시, 지속력 → 매트·벨벳)은 제품 데이터의 finish 값만 쓴다 (제품별 보습·지속력 정보는 데이터에 없어 지어내지 않는다)
// 창은 얼굴 아래(다이얼 자리, y 870~)에만 떠서 입술을 가리지 않는다. 좌표는 900×1440 무대 기준 px (css/took-quick.css)
import { el } from './dom.js';
import { t } from './i18n.js';
import { REDUCE_MOTION as reduce } from './motion.js';
import { matchPresets } from './lip-engine.js';
import { api } from './common.js';
import { hexToRgb, rgbToHsl, hslToHex } from '../lib/color.js';

// ① 언제 — 색을 옮길 양(밝기 dl·채도 ds, 0~100 단위)과 어울리는 제형
const WHENS = [
  { key: 'daily', dl: 4, ds: -8, fin: '' }, // 매일: 맑고 가볍게
  { key: 'date', dl: 3, ds: 6, fin: 'glossy' }, // 생기·윤기
  { key: 'interview', dl: 0, ds: -15, fin: 'matte,velvet' }, // 단정하게
  { key: 'event', dl: -2, ds: 4, fin: '' }, // 하객·행사: 화사하지만 튀지 않게 (예전 하객 +2/-4 · 행사 -6/+12 의 가운데쯤)
];
// 언제 아이콘 (선 아이콘, 글자 왼쪽): 데일리 = 해(매일 아침), 데이트 = 하트, 면접 = 서류 가방, 하객·행사 = 반짝임
const ICON = {
  daily: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  date: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/>',
  interview: '<rect x="3" y="7.5" width="18" height="12.5" rx="2.2"/><path d="M8.5 7.5V5.8A1.8 1.8 0 0 1 10.3 4h3.4a1.8 1.8 0 0 1 1.8 1.8v1.7M3 12.5h18"/>',
  event: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
};
const iconSvg = (k) => `<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

// ② 퍼스널 컬러 4개 → 그 톤에 가장 어울리는 립 프리셋 색 (lip-engine.js SEASONS 기준, 톤 측정 결과와 같은 규칙)
const SEASONS = ['spring', 'summer', 'autumn', 'winter'].map((key) => ({ key, hex: matchPresets(key, 1)[0] }));
// ③ 분위기 — 제형이 있으면 언제보다 먼저
const MOODS = [
  { key: 'bright', dl: 5, ds: 10, fin: 'glossy' },
  { key: 'calm', dl: -5, ds: -10, fin: 'matte,velvet' },
  { key: 'natural', dl: 3, ds: -18, fin: '' },
  { key: 'vivid', dl: -3, ds: 18, fin: '' },
];
// 마음에 안 들 때
const REFINES = ['price', 'dry', 'long', 'pigment', 'again'];
// 가격 드래그 바 (2026-11-21 사용자 요청 "가격을 드래그 바 형식으로", "가격은 우리 립 DB 에 있는 가격대로"):
// 범위 = 추천 목록 제품의 가장 싼 값 ~ 가장 비싼 값 (api/price-range), 처음 위치 = 가운데값, 500원 단위.
// 아래 값은 서버에서 못 받았을 때만 쓰는 대비값 (2026-11-21 기준 DB: 6,500 ~ 52,000원, 가운데값 16,000원)
const PRICE = { min: 6500, max: 52000, step: 500, start: 16000 };
let priceLoaded = null;
function loadPriceRange() {
  priceLoaded ||= api('api/price-range').then((r) => {
    if (r.ok && r.body.max > r.body.min) Object.assign(PRICE, { min: r.body.min, max: r.body.max, start: r.body.median || r.body.min });
  }).catch(() => { /* 대비값 그대로 */ });
  return priceLoaded;
}
const COUNTDOWN = 3; // 측정 도우미: 얼굴을 찾고 이만큼(초) 세면 자동으로 잰다
const NUDGE_DELAY = 1200; // 들어오고 이만큼 뒤 말풍선
const NUDGE_MS = 6500; // 말풍선이 떠 있는 시간 (글자가 펼쳐진 뒤부터)
const TYPING_MS = 750; // 말풍선이 '…'(입력 중)으로 있다가 글자로 펼쳐지기까지
const EASE_OUT = 'cubic-bezier(.22, 1, .36, 1)';
const X_SVG = '<svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const CAM_SVG = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="4.2"/><path d="M4.5 20.5c1.6-3.2 4.3-4.8 7.5-4.8s5.9 1.6 7.5 4.8"/><path d="M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M17 3h2.5A1.5 1.5 0 0 1 21 4.5V7"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const MARK = '<span class="mq-fab-mark" aria-hidden="true">took</span>';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** 톤 색을 언제·분위기에 맞게 옮긴 색 */
export function shiftHex(hex, ...moves) {
  const c = rgbToHsl(hexToRgb(hex));
  const dl = moves.reduce((n, m) => n + (m?.dl || 0), 0);
  const ds = moves.reduce((n, m) => n + (m?.ds || 0), 0);
  return hslToHex({ h: c.h, s: clamp(c.s + ds, 15, 90), l: clamp(c.l + dl, 30, 75) }).toUpperCase();
}

/**
 * stage = 팔레트 900×1440 무대.
 * onOpen(): 창이 열릴 때 (NFC 창·추천 시트 닫기) · onPreview(hex): 고른 색을 입술에 · onSeason(key): 손님이 직접 고른 퍼스널 컬러
 * faceState(): 'nocam' | 'noface' | 'ok' — 측정 도우미가 얼굴이 화면에 맞는지 보여 줄 때
 * onTone(): 내 톤 재기 → Promise<{ ok, label, hex } | { ok: false, msg }> (palette.js 가 lip-look.js 톤 측정을 돌린다. 결과 색은 그쪽에서 입술에 바른다)
 * onDone({ hex, finish, note }): 설문 끝 — 추천 시트 열기 (hex 는 이미 onPreview 로 발랐다, note = 시트 상단 안내 멘트)
 * onRefine({ kind, value }): 마음에 안 들 때 고른 것 (price: value = 상한 원, dry · long · pigment)
 */
export function createQuick({ stage, onOpen, onPreview, onSeason, faceState, onTone, onDone, onRefine }) {
  let step = 0; // 0 닫힘 · 1 언제 · 2 톤 · 3 분위기 · 6 측정 도우미 · 4 재는 중 · 5 측정 실패 · 7 아쉬운 점 · 8 가격
  let when = null;
  let pick = null; // { hex, key, label, measured? }
  let seq = 0;
  let toneMsg = '';
  let price = 0; // 가격 드래그 바 값 (0 = 아직 안 움직임 → 가운데값, 다시 열면 마지막 값)
  loadPriceRange();
  let helpTimer = 0; // 측정 도우미: 얼굴 상태 살피기
  let count = 0; // 세기 시작한 초 (0 = 세지 않는 중)
  let countAt = 0;

  const fab = el('button', { type: 'button', class: 'mq-fab', id: 'mq-fab', 'aria-expanded': 'false', 'aria-controls': 'mq', 'aria-label': t('mq.open'), onclick: () => (step ? close() : open()) });
  fab.innerHTML = MARK;
  let nudgeTap = () => open(); // 말풍선을 누르면 할 일 (say 로 바뀐다)
  const nudge = el('button', { type: 'button', class: 'mq-nudge', hidden: '', 'aria-live': 'polite', onclick: () => { hideNudge(); nudgeTap(); } });
  const box = el('section', { class: 'mq', id: 'mq', hidden: '', role: 'dialog', 'aria-live': 'polite', 'aria-label': t('mq.title') });
  stage.append(box, nudge, fab);
  stage.addEventListener('pointerdown', (e) => { if (!nudge.contains(e.target) && !fab.contains(e.target)) hideNudge(); }, true); // 다른 곳을 만지면 말풍선은 비켜 준다

  const dots = (n) => el('div', { class: 'mq-top' },
    el('div', { class: 'mq-dots', 'aria-hidden': 'true' }, [1, 2, 3].map((i) => el('i', { class: n === i ? 'on' : '' }))),
    el('em', { text: `${n} / 3` }));
  const btn = (text, onclick, cls = '') => el('button', { type: 'button', class: 'mq-btn ' + cls, onclick, text });
  const opt = (label, sub, onclick, { hex, pressed, cls = '' } = {}) => el('button', { type: 'button', class: 'mq-opt mq-season ' + cls, 'aria-pressed': String(!!pressed), onclick },
    ...[hex ? el('span', { class: 'mq-sw', style: `--c:${hex}`, 'aria-hidden': 'true' }) : null,
      el('span', { class: 'mq-season-t' }, el('strong', { text: label }), sub ? el('span', { text: sub }) : null)].filter(Boolean));

  function render() {
    box.dataset.step = String(step);
    if (step !== 6) stopHelp();
    if (step === 1) {
      box.replaceChildren(dots(1), el('h3', { text: t('mq.qWhen') }),
        el('div', { class: 'mq-opts' }, WHENS.map((w) => {
          const b = opt(t('mq.when.' + w.key), t('mq.whenSub.' + w.key), () => chooseWhen(w), { pressed: when?.key === w.key, cls: 'mq-when' });
          b.prepend(el('span', { class: 'mq-ico', 'aria-hidden': 'true' }));
          b.firstChild.innerHTML = iconSvg(w.key);
          return b;
        })));
    } else if (step === 2) {
      box.replaceChildren(dots(2), el('h3', { text: t('mq.q1') }),
        el('div', { class: 'mq-opts' }, SEASONS.map((x) => opt(t('season.' + x.key), t('mq.sdesc.' + x.key), () => chooseSeason(x), { hex: x.hex, pressed: pick?.key === x.key }))),
        measureButton());
    } else if (step === 3) {
      box.replaceChildren(...[dots(3),
        pick ? el('p', { class: 'mq-tone-res' }, el('span', { class: 'mq-sw', style: `--c:${pick.hex}`, 'aria-hidden': 'true' }),
          t(pick.measured ? 'mq.toneIs' : 'mq.tonePicked', { label: pick.label })) : null,
        el('h3', { text: t('mq.qMood') }),
        el('div', { class: 'mq-opts' }, MOODS.map((m) => opt(t('mq.mood.' + m.key), t('mq.moodSub.' + m.key), () => chooseMood(m),
          { hex: shiftHex(pick?.hex || '#D56287', when, m) })))].filter(Boolean));
    } else if (step === 6) renderHelp();
    else if (step === 4) {
      box.replaceChildren(
        el('div', { class: 'mq-scan', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')),
        el('h3', { text: t('mq.toneLook') }),
        el('p', { class: 'mq-msg', text: t('mq.toneBusy') }),
        el('div', { class: 'mq-btns' }, btn(t('mq.back'), () => go(2))));
    } else if (step === 5) {
      box.replaceChildren(el('h3', { text: t('mq.toneFail') }), el('p', { class: 'mq-msg', text: toneMsg }),
        el('div', { class: 'mq-btns' }, btn(t('mq.pickSelf'), () => go(2)), btn(t('mq.toneRetry'), () => go(6), 'mq-pink')));
    } else if (step === 7) {
      box.replaceChildren(el('h3', { text: t('mq.qRefine') }),
        el('div', { class: 'mq-opts' }, REFINES.map((k) => opt(t('mq.refine.' + k), t('mq.refineSub.' + k), () => chooseRefine(k), { cls: k === 'again' ? 'mq-wide' : '' }))));
    } else if (step === 8) {
      // 드래그 바: 끄는 동안 큰 글씨로 'N원 이하'가 바뀌고, 채운 부분(핑크)이 따라온다. [이 가격으로 보기]를 눌러야 다시 찾는다 (끄는 중엔 찾지 않는다)
      const out = el('strong', { class: 'mq-price-val' });
      if (!price) price = PRICE.start;
      const range = el('input', { type: 'range', class: 'mq-range', min: PRICE.min, max: PRICE.max, step: PRICE.step, value: Math.min(PRICE.max, Math.max(PRICE.min, price)), 'aria-label': t('mq.qPrice') });
      const sync = () => {
        price = Number(range.value);
        out.textContent = t('mq.priceUnder', { n: price.toLocaleString('en-US') });
        range.style.setProperty('--p', ((price - PRICE.min) / (PRICE.max - PRICE.min)) * 100 + '%');
        range.setAttribute('aria-valuetext', out.textContent);
      };
      range.addEventListener('input', sync);
      sync();
      box.replaceChildren(el('h3', { text: t('mq.qPrice') }), out, range,
        el('div', { class: 'mq-range-ends', 'aria-hidden': 'true' }, el('span', { text: t('mq.priceEnd', { n: PRICE.min.toLocaleString('en-US') }) }), el('span', { text: t('mq.priceEnd', { n: PRICE.max.toLocaleString('en-US') }) })),
        el('div', { class: 'mq-btns mq-btns-top' }, btn(t('mq.back'), () => go(7)), btn(t('mq.priceGo'), () => finishRefine('price', price), 'mq-pink')));
    }
  }
  // ② 아래 긴 버튼: 잘 모르겠어요 · 내 톤 측정해 보기
  function measureButton() {
    const b = el('button', { type: 'button', class: 'mq-tone', onclick: () => go(6) },
      el('span', { class: 'mq-tone-ic' }),
      el('span', { class: 'mq-tone-t' }, el('strong', { text: t('mq.measure') }), el('span', { text: t('mq.measureSub') })));
    b.firstChild.innerHTML = CAM_SVG;
    return b;
  }

  // ---------- 측정 도우미 ----------
  // 무엇을 하면 되는지 세 줄로 안내하고, 얼굴이 화면에 들어왔는지 실시간으로 보여 준다.
  // 얼굴을 찾은 채로 COUNTDOWN 초가 지나면 자동으로 재기 시작 (버튼을 누르면 바로). 얼굴을 놓치면 세기를 멈춘다
  const helpStatus = el('p', { class: 'mq-help-st', 'aria-live': 'polite' });
  const helpGo = el('button', { type: 'button', class: 'mq-btn mq-pink', onclick: () => startTone() });
  const helpRows = ['face', 'front', 'light'].map((k) => el('li', { 'data-k': k }, el('i', { class: 'mq-ck', 'aria-hidden': 'true' }), el('span', { text: t('mq.help.' + k) })));
  helpRows.forEach((r) => { r.firstChild.innerHTML = CHECK_SVG; });
  function renderHelp() {
    count = 0;
    box.replaceChildren(el('h3', { text: t('mq.helpTitle') }), el('ol', { class: 'mq-help' }, helpRows), helpStatus,
      el('div', { class: 'mq-btns' }, btn(t('mq.back'), () => go(2)), helpGo));
    tickHelp();
    clearInterval(helpTimer);
    helpTimer = setInterval(tickHelp, 200);
  }
  function tickHelp() {
    if (step !== 6) { stopHelp(); return; }
    const st = faceState ? faceState() : 'ok';
    const ok = st === 'ok';
    helpRows[0].classList.toggle('done', ok);
    helpStatus.dataset.st = st;
    if (!ok) count = 0;
    else if (!count) { count = COUNTDOWN; countAt = performance.now(); }
    const left = ok ? Math.max(0, count - Math.floor((performance.now() - countAt) / 1000)) : 0;
    helpStatus.textContent = st === 'nocam' ? t('mq.st.nocam') : st === 'noface' ? t('mq.st.noface') : t('mq.st.ok', { n: left });
    helpGo.textContent = ok ? t('mq.startIn', { n: left }) : t('mq.startNow');
    if (ok && left === 0) startTone();
  }
  function stopHelp() { clearInterval(helpTimer); helpTimer = 0; count = 0; }

  function chooseWhen(w) { when = w; go(pick ? 3 : 2); } // 말풍선에서 톤부터 쟀으면 바로 ③
  function chooseSeason(x) {
    pick = { hex: x.hex, key: x.key, label: t('season.' + x.key) };
    onPreview(x.hex);
    onSeason?.(x.key);
    go(3);
  }
  async function startTone() {
    if (!onTone || step === 4) return;
    const my = ++seq;
    go(4);
    let r;
    try { r = await onTone(); } catch { r = { ok: false }; }
    if (my !== seq || step !== 4) return;
    if (r?.ok) { pick = { hex: r.hex, label: r.label, measured: true }; go(when ? 3 : 1); return; } // 추천 색은 palette.js 가 이미 입술에 발랐다
    toneMsg = r?.msg || t('mq.toneFailSub');
    go(5);
  }
  function chooseMood(m) {
    const hex = shiftHex(pick.hex, when, m);
    const finish = m.fin || when?.fin || '';
    const note = t('mq.guide3', { when: t('mq.when.' + when.key), tone: pick.label, mood: t('mq.mood.' + m.key) });
    onPreview(hex);
    close();
    onDone({ hex, finish, note });
  }
  function chooseRefine(k) {
    if (k === 'again') { restart(); return; }
    if (k === 'price') { go(8); return; }
    finishRefine(k);
  }
  function finishRefine(kind, value) {
    close();
    onRefine?.({ kind, value });
  }

  function go(n) {
    step = n;
    render();
    if (!reduce) box.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE_OUT });
  }
  function restart() { seq++; when = null; pick = null; go(1); }

  /** 창 열기. tone: 바로 측정 도우미 (말풍선 '내 톤…') · refine: 바로 '무엇이 아쉬우세요?' (추천 시트의 '마음에 안 드세요?') */
  function open({ tone = false, refine = false } = {}) {
    hideNudge(true);
    onOpen?.();
    box.hidden = false;
    stage.classList.add('mq-open');
    fab.classList.add('on');
    fab.innerHTML = X_SVG;
    fab.setAttribute('aria-expanded', 'true');
    fab.setAttribute('aria-label', t('mq.close'));
    if (!reduce) box.animate([{ opacity: 0, transform: 'translateY(24px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 340, easing: EASE_OUT });
    if (tone) { seq++; when = null; pick = null; go(6); } else if (refine) go(7); else restart();
  }
  function close() {
    seq++;
    step = 0;
    stopHelp();
    box.hidden = true;
    stage.classList.remove('mq-open');
    fab.classList.remove('on');
    fab.innerHTML = MARK;
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('aria-label', t('mq.open'));
  }

  // ---------- 말풍선 ----------
  // 2026-11-21 사용자 요청: 립 매핑 중간중간 '지금 바른 거랑 비슷한 거 추천해 드릴까요?' 같은 말풍선, 애니메이션은 자연스럽게.
  // 메신저처럼: 버튼 쪽에서 작은 '…'(입력 중) 풍선이 톡 튀어나오고 → 글자로 펼쳐지고(오른쪽 아래 꼬리 쪽은 그대로) → 떠 있는 동안 살짝 둥실 →
  // 사라질 때는 버튼 쪽으로 오므라든다. 동작 줄이기 설정이면 움직임 없이 바로 보이고 사라진다.
  // say({ text, sub, hex, onTap }): 창이 닫혀 있을 때만 띄운다. hex 가 있으면 지금 입술 색 동그라미를 같이 보여 준다
  let nudgeTimer = 0;
  let nudgeSeq = 0;
  function hideNudge(instant = false) {
    clearTimeout(nudgeTimer);
    const my = ++nudgeSeq;
    if (nudge.hidden) return;
    if (instant || reduce) { nudge.hidden = true; return; }
    nudge.classList.remove('float');
    const a = nudge.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate(16px, 8px) scale(.82)' }],
      { duration: 220, easing: 'cubic-bezier(.4, 0, 1, 1)' });
    a.onfinish = () => { if (my === nudgeSeq) nudge.hidden = true; };
  }
  function say({ text, sub, hex, onTap }) {
    if (step) return false;
    clearTimeout(nudgeTimer);
    const my = ++nudgeSeq;
    nudgeTap = onTap || (() => open());
    const content = [
      hex ? el('i', { class: 'mq-nudge-sw', style: `--c:${hex}`, 'aria-hidden': 'true' }) : null,
      el('span', { class: 'mq-nudge-t' }, el('strong', { text }), sub ? el('span', { text: sub }) : null)].filter(Boolean); // replaceChildren 은 null 을 'null' 글자로 넣는다
    nudge.setAttribute('aria-label', [text, sub].filter(Boolean).join(' ').replace(/\n/g, ' '));
    if (reduce) {
      nudge.classList.remove('typing');
      nudge.replaceChildren(...content);
      nudge.hidden = false;
      nudgeTimer = setTimeout(hideNudge, NUDGE_MS);
      return true;
    }
    // 1) '…' 풍선이 버튼 쪽에서 톡
    nudge.getAnimations().forEach((a) => a.cancel());
    nudge.classList.remove('float');
    nudge.classList.add('typing');
    nudge.replaceChildren(el('span', { class: 'mq-typing', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')));
    nudge.hidden = false;
    nudge.animate([
      { opacity: 0, transform: 'translate(26px, 14px) scale(.4)' },
      { opacity: 1, transform: 'translate(-3px, -2px) scale(1.06)', offset: 0.65 },
      { opacity: 1, transform: 'none' }],
    { duration: 460, easing: 'cubic-bezier(.2, .9, .3, 1)' });
    fab.animate([{ transform: 'none' }, { transform: 'scale(1.09)' }, { transform: 'scale(.97)' }, { transform: 'none' }], { duration: 520, easing: 'ease-out' });
    // 2) 글자로 펼쳐지기: 크기가 커지는 동안 오른쪽 아래(꼬리)는 그대로, 왼쪽 위로 자란다 (clip-path), 글자는 살짝 늦게 떠오른다
    nudgeTimer = setTimeout(() => {
      if (my !== nudgeSeq) return;
      const w0 = nudge.offsetWidth;
      const h0 = nudge.offsetHeight;
      nudge.classList.remove('typing');
      nudge.replaceChildren(...content);
      const dw = Math.max(0, nudge.offsetWidth - w0);
      const dh = Math.max(0, nudge.offsetHeight - h0);
      const r = '26px 26px 6px 26px';
      nudge.animate([{ clipPath: `inset(${dh}px 0 0 ${dw}px round ${r})` }, { clipPath: `inset(0 0 0 0 round ${r})` }], { duration: 420, easing: EASE_OUT });
      content.forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 320, delay: 140 + i * 60, easing: 'ease-out', fill: 'backwards' }));
      setTimeout(() => { if (my === nudgeSeq) nudge.classList.add('float'); }, 460); // 3) 떠 있는 동안 둥실
      nudgeTimer = setTimeout(hideNudge, NUDGE_MS);
    }, TYPING_MS);
    return true;
  }
  nudgeTimer = setTimeout(() => say({ text: t('mq.nudge'), sub: t('mq.nudgeSub') }), NUDGE_DELAY);

  return { open, openRefine: () => open({ refine: true }), close, say, hideNudge, isOpen: () => step > 0 };
}
