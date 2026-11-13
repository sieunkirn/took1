// 키오스크 자동 초기화: 한동안 조작이 없으면 안내 후 저장한 상태를 지우고 홈으로 간다.
import { t } from './i18n.js';
import { el } from './dom.js';
import { store } from './store.js';

// ---------- 키오스크 자동 초기화 ----------
// 손님이 떠난 뒤 다음 손님에게 앞 손님의 대화·측정한 톤·고른 색이 보이지 않게, 한동안 조작이 없으면 안내 후 지우고 홈으로 간다.
// - 대기 시간 기본 90초. 기기마다 바꾸려면 그 기기 브라우저에서 localStorage['took.idleSeconds'] = '120' (10초 이상)
// - 안내가 뜬 뒤 15초 안에 '계속하기'나 화면 아무 곳을 누르면 그대로 이어서 쓴다
// - 읽어주기·음성 듣기 중에는 기다린다. 홈에 지울 것이 없으면 아무것도 하지 않는다
// - 직원용 화면(음성 정확도 측정·시연용 바코드)은 <body data-idle-reset="off"> 로 끈다
const IDLE_DEFAULT_S = 90;
const IDLE_WARN_S = 15;

function idleSeconds() {
  try {
    const v = Number(localStorage.getItem('took.idleSeconds'));
    if (v >= 10) return v;
  } catch { /* 저장소를 못 쓰는 환경: 기본값 */ }
  return IDLE_DEFAULT_S;
}

/** 저장한 상태를 모두 지우고 홈으로 (자동 초기화·'처음으로' 버튼) */
export function resetToHome() {
  store.clear();
  location.href = 'index.html';
}

function hasSessionState() {
  try {
    return Object.keys(sessionStorage).some((k) => k.startsWith('took.') && k !== 'took.homeSkipIntro');
  } catch { return false; }
}

export function setupIdleReset(custom = {}) {
  if (document.body.dataset.idleReset === 'off') return;
  const onHome = /(^|\/)(index\.html)?$/.test(location.pathname);
  let timer = null;
  let dialog = null;
  let countdown = null;
  let busySince = 0;
  // 읽어주는 중이거나 듣는 중(마이크 버튼에 listening 표시)이면 손님이 아직 있다.
  // 다만 speechSynthesis.speaking 이 끝나지 않고 남는 브라우저가 있어, 이 이유로는 최대 60초만 미룬다
  const busy = () => {
    const now = !!window.speechSynthesis?.speaking || !!document.querySelector('.listening');
    if (!now) { busySince = 0; return false; }
    busySince ||= Date.now();
    return Date.now() - busySince < 60000;
  };

  const seconds = () => {
    const v = Number(custom.seconds?.());
    return v >= 10 ? v : idleSeconds();
  };
  // 초기화: 기본은 저장한 상태를 지우고 홈으로, 화면이 따로 정했으면 그 동작 (거울 모드: 대기 화면으로)
  const reset = () => {
    if (!custom.onReset) return resetToHome();
    clearInterval(countdown);
    dialog?.remove();
    dialog = null;
    custom.onReset();
    schedule();
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(onIdle, seconds() * 1000);
  };
  const onIdle = () => {
    if (custom.active && !custom.active()) return schedule(); // 지울 것이 없는 상태(예: 거울 대기 화면)
    if (document.hidden || busy() || (onHome && !hasSessionState())) return schedule();
    showWarning();
  };
  const dismiss = () => {
    clearInterval(countdown);
    dialog?.remove();
    dialog = null;
    schedule();
  };
  // 안내: 글 대신 줄어드는 원 + 남은 초, 그리고 아이콘 버튼 두 개(손가락 = 계속, 집 = 처음으로).
  // 자세한 설명은 화면 읽기 프로그램용으로만 둔다
  function showWarning() {
    let left = IDLE_WARN_S;
    const num = el('span', { class: 'idle-num', 'aria-hidden': 'true', text: String(left) });
    const desc = el('p', { id: 'idle-desc', class: 'sr-only' });
    const update = () => {
      num.textContent = String(left);
      desc.textContent = t('idle.desc', { n: left });
    };
    update();
    const ring = el('div', { class: 'idle-ring', style: `--idle-s: ${IDLE_WARN_S}s` });
    ring.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="track" cx="60" cy="60" r="52"/><circle class="bar" cx="60" cy="60" r="52" pathLength="100"/></svg>';
    ring.append(num);
    const icon = (path) => {
      const s = el('span', { class: 'idle-icon', 'aria-hidden': 'true' });
      s.innerHTML = `<svg viewBox="0 0 24 24">${path}</svg>`;
      return s;
    };
    const HAND = '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.2a5 5 0 0 1-4-2L4.6 15.6a1.5 1.5 0 0 1 2.3-1.9L9 16"/>';
    const HOME = '<path d="M3 11 12 4l9 7M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"/>';
    const keep = el('button', { type: 'button', class: 'primary', 'aria-label': t('idle.keepAria'), onclick: dismiss }, icon(HAND), el('span', { text: t('idle.keep') }));
    dialog = el('div', { class: 'idle-overlay', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': t('idle.title'), 'aria-describedby': 'idle-desc',
      // 안내 바깥을 눌러도 계속 쓰는 것으로 본다
      onpointerdown: (e) => { if (e.target === dialog) dismiss(); } },
    el('div', { class: 'idle-box' },
      ring,
      desc,
      el('div', { class: 'idle-actions' }, keep,
        el('button', { type: 'button', 'aria-label': t('idle.homeAria'), onclick: reset }, icon(HOME), el('span', { text: t('idle.home') })))));
    document.body.append(dialog);
    keep.focus();
    countdown = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(countdown);
        reset();
      } else update();
    }, 1000);
  }

  for (const type of ['pointerdown', 'keydown', 'touchstart', 'wheel', 'input']) {
    window.addEventListener(type, () => { if (!dialog) schedule(); }, { capture: true, passive: true });
  }
  schedule();
  // 테스트 버튼: 기다리지 않고 안내를 바로 띄운다 (지울 것이 없어도 띄운다)
  return { warnNow: () => { if (!dialog) { clearTimeout(timer); showWarning(); } } };
}
