// 키오스크 자동 초기화: 한동안 조작이 없으면 안내 후 저장한 상태를 지우고 홈으로 간다.
import { t } from './i18n.js';
import { el } from './dom.js';
import { store } from './store.js';
import { logoFull } from './brand.js';

// ---------- 키오스크 자동 초기화 ----------
// 손님이 떠난 뒤 다음 손님에게 앞 손님의 대화·측정한 톤·고른 색이 보이지 않게, 한동안 조작이 없으면 안내 후 지우고 홈으로 간다.
// - 대기 시간 기본 90초. 기기마다 바꾸려면 그 기기 브라우저에서 localStorage['took.idleSeconds'] = '120' (10초 이상)
// - 안내('See You Soon' 자동 꺼짐 화면)가 뜬 뒤 10초 안에 화면 아무 곳이나(계속 이용하기 버튼 포함) 누르면 그대로 이어서 쓴다
// - 읽어주기·음성 듣기 중에는 기다린다. 홈에 지울 것이 없으면 아무것도 하지 않는다
// - 직원용 화면은 <body data-idle-reset="off"> 로 끈다
const IDLE_DEFAULT_S = 90;
const IDLE_WARN_S = 10; // 2026-11-19 디자인('10 초 후 화면 꺼짐')에 맞춰 15→10초

function idleSeconds() {
  try {
    const v = Number(localStorage.getItem('took.idleSeconds'));
    if (v >= 10) return v;
  } catch { /* 저장소를 못 쓰는 환경: 기본값 */ }
  return IDLE_DEFAULT_S;
}

/** 저장한 상태를 모두 지우고 홈으로 (자동 초기화) */
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
    dialog?.dispatchEvent(new Event('took:closed'));
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
  // 계속 쓰기: 안내는 0.75초 동안 부드럽게 사라지며(누른 버튼이 눌렸다 빛나고 → 글자·원이 위아래로 흩어지며 흐려지고 → 검정 막이 걷힘)
  // 그동안 화면을 덮고 있는다 (안내를 닫은 그 터치가 아래 버튼까지 누르지 않게). 모션은 wireframe.css .idle-closing
  const CLOSE_MS = 760;
  const dismiss = () => {
    clearInterval(countdown);
    const d = dialog;
    dialog = null;
    if (d) { d.dispatchEvent(new Event('took:closed')); d.classList.add('idle-closing'); setTimeout(() => d.remove(), CLOSE_MS); }
    schedule();
  };
  // 안내: 'See You Soon' 자동 꺼짐 화면 (2026-11-19 사용자 디자인). 화면 전체를 검정으로 덮고
  // 위 가운데 로고·제목·AUTO SLEEP·남은 초 원(분홍 점이 시계 방향으로 돌며 흰 원이 줄어듦)·'아직 이용 중이신가요?'·계속 이용하기 버튼.
  // 뒤로·계속 버튼은 물론 화면 아무 곳이나 누르거나 키를 누르면 계속 쓰고, 0초가 되면 처음 화면으로.
  // 화면 속은 900×1440 기준 좌표로 그리고 창 크기에 맞춰 통째로 줄인다(--k)
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
    ring.innerHTML = '<svg viewBox="0 0 560 560" aria-hidden="true">'
      + '<defs><radialGradient id="idle-disc" cx=".5" cy=".5" r=".5"><stop offset=".78" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></radialGradient></defs>'
      + '<circle class="outer" cx="280" cy="280" r="260" fill="url(#idle-disc)"/>'
      + '<circle class="track" cx="280" cy="280" r="220"/>'
      + '<circle class="bar" cx="280" cy="280" r="220" pathLength="100"/>'
      + '<g class="dot-rot"><circle class="dot" cx="500" cy="280" r="9"/></g></svg>';
    ring.append(el('div', { class: 'idle-count' }, num, el('span', { class: 'idle-unit', 'aria-hidden': 'true', text: t('idle.unit') })));
    const back = el('button', { type: 'button', class: 'idle-back', 'aria-label': t('idle.back') });
    back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6"/></svg>';
    const logo = el('div', { class: 'idle-logo', 'aria-hidden': 'true' });
    logo.innerHTML = logoFull();
    const screen = el('div', { class: 'idle-screen' },
      back, logo,
      el('h2', { class: 'idle-title', text: t('idle.title') }),
      el('p', { class: 'idle-sub', text: t('idle.sub') }),
      el('p', { class: 'idle-label', text: t('idle.label') }),
      ring,
      el('p', { class: 'idle-ask', text: t('idle.ask') }),
      el('p', { class: 'idle-help', text: t('idle.help') }),
      el('button', { type: 'button', class: 'idle-keep', text: t('idle.keep') }),
      desc);
    dialog = el('div', { class: 'idle-overlay', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': t('idle.ask'), 'aria-describedby': 'idle-desc', tabindex: '-1',
      // 화면 어디를 눌러도(뒤로·계속 버튼 포함) 계속 쓰는 것으로 본다. 키보드도 아무 키나
      onpointerdown: (e) => { e.preventDefault(); if (dialog) e.target.closest?.('.idle-keep, .idle-back')?.classList.add('idle-pressed'); dismiss(); },
      onkeydown: (e) => { e.preventDefault(); dismiss(); } },
    screen);
    const fit = () => dialog?.style.setProperty('--k', String(Math.min(innerWidth / 900, innerHeight / 1440)));
    fit();
    window.addEventListener('resize', fit);
    dialog.addEventListener('took:closed', () => window.removeEventListener('resize', fit));
    document.body.append(dialog);
    dialog.focus();
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
