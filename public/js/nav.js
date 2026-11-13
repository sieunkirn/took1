// 상단 메뉴: TOOK 로고(누르면 홈으로), 챗봇 링크, 다크 모드·언어 버튼, 자동 초기화 연결.
import { t, languageMenu, themeToggle, applyI18n } from './i18n.js';
import { el } from './dom.js';
import { store, HERE } from './store.js';
import { DEVICE_MODE } from './device-frame.js';
import { setupIdleReset } from './idle-reset.js';

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
//  3) 시작 화면(home.js)은 로고가 이미 그 자리에 있고, 얼굴 → 안내 글 순서로 떠오른다 (sessionStorage took.homeFx)
// 저장한 상태는 먼저 비운다(처음 상태로). 동작 줄이기 설정이면 바로 이동
const HOME_FX_MS = 650;
function goHomeWithMotion(e) {
  store.clear();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; // 링크 그대로
  const svg = e.currentTarget.querySelector('svg');
  if (!svg) return;
  e.preventDefault();
  try { sessionStorage.setItem('took.homeFx', '1'); } catch { /* 저장 불가 환경: 시작 화면은 그냥 나온다 */ }
  const from = svg.getBoundingClientRect();
  // 시작 화면 로고 자리: 같은 스타일의 시작 화면을 보이지 않게 잠깐 만들어 잰다
  const probe = el('main', { class: 'home-standby', style: 'visibility:hidden;pointer-events:none' });
  probe.innerHTML = `<div class="hs-top">${logoSvg('hs-logo')}</div>`;
  document.body.append(probe);
  const to = probe.querySelector('svg').getBoundingClientRect();
  probe.remove();
  const veil = el('div', { class: 'home-veil', 'aria-hidden': 'true' });
  const fly = el('div', { class: 'home-fly', 'aria-hidden': 'true' });
  fly.innerHTML = logoSvg();
  Object.assign(fly.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
  document.body.append(veil, fly);
  svg.style.visibility = 'hidden';
  veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease-out', fill: 'forwards' });
  const k = to.width / from.width;
  fly.animate([{ transform: 'none' }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${k})` }],
    { duration: HOME_FX_MS, delay: 80, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
  setTimeout(() => { location.href = 'index.html'; }, HOME_FX_MS + 120);
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

/**
 * 상단 메뉴 + 키오스크 자동 초기화
 * @param {{ idle?: { seconds?: () => number, active?: () => boolean, onReset?: () => void } }} [opts]
 *   idle: 화면마다 자동 초기화를 바꿀 때 (거울 모드: 30초, 대기 화면이면 기다리기만, 초기화하면 홈 대신 대기 화면으로)
 */
export function renderNav(opts = {}) {
  if (document.querySelector('header.nav')) return; // 합본 화면처럼 스크립트 두 개가 함께 부르면 한 번만 그린다
  const nav = el('header', { class: 'nav' },
    // 로고(TOOK 그림): 누르면 저장된 상태를 모두 지우고 홈(대기 화면)으로. 읽어 주는 이름은 'took(초기화)'
    el('strong', {}, Object.assign(el('a', { href: 'index.html', id: 'nav-reset', class: 'nav-logo', 'aria-label': t('nav.reset'), title: t('nav.reset'), onclick: goHomeWithMotion }), { innerHTML: logoSvg() })),
    // 상단 '홈'·'팔레트' 메뉴는 2026-11-09 뺐다 (로고 = 시작 화면)
    // 오른쪽 끝: 다크 모드 켜기/끄기 + 언어 전환
    // AI 뷰티 챗봇 (2026-11-11 손님 휴대폰을 없애고 태블릿으로 합침)
    freshLink('chat.html', t('nav.chat')),
    el('div', { class: 'nav-lang' }, themeToggle(), languageMenu()),
  );
  document.body.prepend(nav);
  applyI18n();
  const idle = setupIdleReset(opts.idle);
  // 테스트 단계: 90초를 기다리지 않고 자동 초기화 안내를 바로 띄워 본다 (오른쪽 끝). 배포 때는 IDLE_TEST_BUTTON 을 false 로
  if (IDLE_TEST_BUTTON && idle) {
    nav.append(el('button', { type: 'button', class: 'nav-idle-test', text: t('nav.idleTest'), title: t('nav.idleTestTitle'), onclick: idle.warnNow }));
  }
  const reset = deviceResetButton();
  if (reset) nav.append(reset);
}

const IDLE_TEST_BUTTON = true;
