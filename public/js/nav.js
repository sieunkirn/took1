// 상단 메뉴: TOOK 로고(누르면 홈으로), 다크 모드 버튼, 자동 초기화 연결. (언어 버튼은 홈에만, 2026-11-17)
import { t, themeToggle, applyI18n } from './i18n.js';
import { el } from './dom.js';
import { store, HERE } from './store.js';
import { DEVICE_MODE } from './device-frame.js';
import { setupIdleReset } from './idle-reset.js';
import { logoFull } from './brand.js';

// 전달값 없이 페이지를 새로 여는 링크 (메뉴 등)
function freshLink(page, text) {
  return el('a', { href: page, text, 'aria-current': page === HERE ? 'page' : null, onclick: () => store.remove('navCurrent.' + page) });
}

// TOOK 로고 (사용자가 준 로고 그림을 따라 그림, 홈 대기 화면·상단 메뉴 공용): 굵은 T, 서로 맞닿은 두 O, 살짝 기운 K 기둥 + 길게 뻗은 사선 + 아래로 말리는 다리
const LOGO_INNER = '<g fill="currentColor">'
  + '<rect x="215" y="38" width="112" height="20"/><rect x="251" y="38" width="25" height="122"/>'
  + '<path d="M535 38H557L508 160H486Z"/>'
  + '</g><g fill="none" stroke="currentColor" stroke-width="24">'
  + '<ellipse cx="345" cy="98" rx="44" ry="50"/><ellipse cx="444" cy="98" rx="45" ry="50"/>'
  + '</g><g fill="none" stroke="currentColor" stroke-width="20">'
  + '<path d="M645 44L512 134"/><path d="M508 131C556 124 590 136 588 160"/>'
  + '</g></svg>';
/** TOOK 로고 SVG 문자열. 색은 글자색(currentColor)을 따른다 */
export const logoSvg = (cls = '') => `<svg class="${cls}" viewBox="212 36 442 126" role="img" aria-label="TOOK">${LOGO_INNER}</svg>`;

// 상단 로고 → 시작 화면(홈) 전환: 시작 화면 → 팔레트 움직임의 반대.
//  1) 종이색 막이 화면을 부드럽게 덮고(0.45초) 2) 메뉴의 TOOK 로고가 시작 화면의 큰 로고 자리로 커지며 날아간다(0.65초)
//  (2026-11-16 이후: 움직임 없이 홈 1번 마크 화면으로 간다)
// 저장한 상태는 먼저 비운다(처음 상태로). 동작 줄이기 설정이면 바로 이동
// keep: 저장한 상태(섞은 색 등)를 지우지 않고 돌아갈 때
function goHomeWithMotion(e, { keep = false } = {}) {
  // 2026-11-16 홈이 TOOK_prototype 화면으로 바뀌어, 옛 홈 로고 자리로 날아가던 움직임은 뺐다.
  // 초기화하면 홈은 1번(마크) 화면부터: 터치 → TOOK 로고 → 시작 버튼 (사용자 요청)
  if (!keep) store.clear();
  void e; // 링크 그대로 index.html 로 이동
}

// '기기 선택 해제': 이 기기를 태블릿으로 고정한 경우(DEVICE_MODE)에만 상단 메뉴에 보인다.
// 누르면 고정을 풀고 처음 상태(노트북이면 태블릿 미리보기)로 돌아간다. 미리보기 틀 안이면 틀 밖(최상위 창)을 옮긴다
function deviceResetButton() {
  if (!DEVICE_MODE) return null;
  return el('button', {
    type: 'button', class: 'nav-device-reset', text: t('nav.deviceReset'), title: t('nav.deviceResetTitle'),
    onclick: () => {
      if (!confirm(t('nav.deviceResetConfirm'))) return;
      try { localStorage.removeItem('took.deviceMode'); } catch { /* 저장 불가 환경 */ }
      try { window.name = ''; } catch { /* 없음 */ }
      try { window.top.location.replace('index.html?device=auto'); } catch { location.replace('index.html?device=auto'); }
    },
  });
}

function fullscreenButton() {
  let root = window;
  try { if (window.top !== window && window.top.document) root = window.top; } catch { /* 다른 출처 프레임 */ }
  const button = el('button', {
    type: 'button', class: 'nav-fullscreen', 'data-fullscreen-control': '',
    onclick: () => {
      const control = root.tookFullscreen;
      if (control?.isFull()) control.exit();
      else control?.enter();
    },
  });
  const update = () => {
    const exiting = !!root.tookFullscreen?.isFull();
    button.textContent = t(exiting ? 'nav.fullscreenExit' : 'nav.fullscreenEnter');
    button.title = t(exiting ? 'nav.fullscreenExitTitle' : 'nav.fullscreenEnterTitle');
    button.setAttribute('aria-label', button.title);
  };
  root.addEventListener('took:fullscreenchange', update);
  update();
  return button;
}

/**
 * 상단 메뉴 + 키오스크 자동 초기화
 * @param {{ idle?: { seconds?: () => number, active?: () => boolean, onReset?: () => void } }} [opts]
 *   idle: 화면마다 자동 초기화를 바꿀 때 (거울 모드: 30초, 대기 화면이면 기다리기만, 초기화하면 홈 대신 대기 화면으로)
 */
let navDone = false;
export function renderNav(opts = {}) {
  if (navDone || document.querySelector('header.nav')) return; // 합본 화면처럼 스크립트 두 개가 함께 부르면 한 번만 그린다
  // 상단 메뉴 없는 화면 (<body data-nav="none">, 2026-11-16 TOOK_prototype 디자인의 Find Your Color):
  // 메뉴는 그리지 않고 문구 적용과 키오스크 자동 초기화만 한다 (로고·버튼은 화면이 직접 그린다)
  if (document.body.dataset.nav === 'none') {
    navDone = true;
    applyI18n();
    setupIdleReset(opts.idle);
    return;
  }
  // TOOK_prototype 무드 화면(body.tui-mood: 제품 상세·호수 안내 등)은 로고와 전체화면 버튼만 (2026-11-16)
  const mood = document.body.classList.contains('tui-mood');
  const minimal = mood;
  const nav = el('header', { class: minimal ? 'nav nav-min' : 'nav' },
    // 로고(TOOK 그림): 누르면 저장된 상태를 모두 지우고 홈(대기 화면)으로. 읽어 주는 이름은 'took(초기화)'
    // TOOK_prototype 무드 화면(body.tui-mood)은 새 로고(마크 + TOOK)
    el('strong', {}, Object.assign(el('a', { href: 'index.html', id: 'nav-reset', class: 'nav-logo', 'aria-label': t('nav.reset'), title: t('nav.reset'), onclick: goHomeWithMotion }), { innerHTML: document.body.classList.contains('tui-mood') ? logoFull() : logoSvg() })),
    // 상단 '홈'·'팔레트' 메뉴는 2026-11-09 뺐다 (로고 = 시작 화면)
    // 오른쪽 끝: 다크 모드 켜기/끄기 (언어 전환은 2026-11-17 사용자 요청으로 홈 화면에서만 — 여기서는 뺐다)
    // 팔레트 (2026-11-13 다시 추가)
    minimal ? null : freshLink('palette.html', t('nav.palette')),
    minimal ? null : el('div', { class: 'nav-lang' }, themeToggle()),
  );
  document.body.prepend(nav);
  applyI18n();
  setupIdleReset(opts.idle);
  const reset = minimal ? null : deviceResetButton();
  if (reset) nav.append(reset);
  nav.append(fullscreenButton());
}

