// 상단 메뉴: TOOK 로고(누르면 홈으로), 챗봇 링크, 다크 모드 버튼, 자동 초기화 연결. (언어 버튼은 홈에만, 2026-11-17)
import { t, themeToggle, applyI18n } from './i18n.js';
import { el } from './dom.js';
import { store, HERE } from './store.js';
import { STATIC } from './api.js';
import { getPicks } from './chat-picks.js';
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
// keep: 챗봇의 '거울 화면으로' 버튼처럼 저장한 상태(대화·섞은 색)를 지우지 않고 돌아갈 때
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
  if (IN_CHAT_MODAL) return setupInModal();
  // 상단 메뉴 없는 화면 (<body data-nav="none">, 2026-11-16 TOOK_prototype 디자인의 Find Your Color):
  // 메뉴·챗봇 버튼은 그리지 않고 문구 적용과 키오스크 자동 초기화만 한다 (로고·버튼은 화면이 직접 그린다)
  if (document.body.dataset.nav === 'none') {
    navDone = true;
    applyI18n();
    setupIdleReset(opts.idle);
    return;
  }
  // 챗봇 화면(2026-11-13): 로고와 전체화면 버튼만 남긴다 (챗봇·팔레트·거울·다크 모드·언어·기기 해제 버튼 없음)
  // TOOK_prototype 무드 화면(body.tui-mood: 제품 상세·호수 안내 등)도 로고만 (2026-11-16). 챗봇 플로팅 버튼은 챗봇 화면이 아닐 때 그대로
  const mood = document.body.classList.contains('tui-mood');
  const minimal = HERE === 'chat.html' || mood;
  const nav = el('header', { class: minimal ? 'nav nav-min' : 'nav' },
    // 로고(TOOK 그림): 누르면 저장된 상태를 모두 지우고 홈(대기 화면)으로. 읽어 주는 이름은 'took(초기화)'
    // TOOK_prototype 무드 화면(body.tui-mood)은 새 로고(마크 + TOOK)
    el('strong', {}, Object.assign(el('a', { href: 'index.html', id: 'nav-reset', class: 'nav-logo', 'aria-label': t('nav.reset'), title: t('nav.reset'), onclick: goHomeWithMotion }), { innerHTML: document.body.classList.contains('tui-mood') ? logoFull() : logoSvg() })),
    // 상단 '홈'·'팔레트' 메뉴는 2026-11-09 뺐다 (로고 = 시작 화면)
    // 오른쪽 끝: 다크 모드 켜기/끄기 (언어 전환은 2026-11-17 사용자 요청으로 홈 화면에서만 — 여기서는 뺐다)
    // AI 뷰티 챗봇: 2026-11-15 상단 메뉴 링크 대신 오른쪽 아래 플로팅 버튼(chatFab)으로 옮겼다
    // 팔레트 (2026-11-13 다시 추가): 챗봇 옆에서 바로 팔레트로
    minimal ? null : freshLink('palette.html', t('nav.palette')),
    minimal ? null : el('div', { class: 'nav-lang' }, themeToggle()),
  );
  document.body.prepend(nav);
  applyI18n();
  setupIdleReset(opts.idle);
  const reset = minimal ? null : deviceResetButton();
  if (reset) nav.append(reset);
  nav.append(fullscreenButton());
  if (!minimal || (mood && HERE !== 'chat.html')) document.body.append(chatFab());
}

// ---------- AI 뷰티 챗봇 모달 (2026-11-15) ----------
// 오른쪽 아래 플로팅 버튼을 누르면 지금 화면 위에 챗봇(chat.html)을 iframe 으로 띄운다.
// 닫아도 iframe 은 그대로 숨겨 두어 다시 열면 대화가 그대로 있고, 다른 화면으로 가도 대화는 sessionStorage 에 남아 이어진다
// (자동 초기화·로고 누르기 때만 지워진다)
const IN_CHAT_MODAL = (() => { try { return !!window.frameElement?.classList.contains('chat-modal-frame'); } catch { return false; } })();

// 모달 안의 챗봇: 상단 메뉴·자동 초기화는 바깥 화면이 맡는다. 조작은 바깥 화면의 자동 초기화 타이머에 알린다
function setupInModal() {
  document.documentElement.classList.add('in-chat-modal');
  const host = window.parent;
  for (const type of ['pointerdown', 'keydown', 'touchstart', 'wheel', 'input']) {
    window.addEventListener(type, () => { try { host.dispatchEvent(new host.Event('took:activity')); } catch { /* 없음 */ } }, { capture: true, passive: true });
  }
  applyI18n();
}

let chatModal = null;
function buildChatModal() {
  const frame = el('iframe', { class: 'chat-modal-frame', title: t('nav.chat'), allow: 'microphone; autoplay; fullscreen' });
  const close = el('button', { type: 'button', class: 'chat-modal-close', 'aria-label': t('chat.close'), title: t('chat.close'), onclick: () => closeChat() });
  close.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const box = el('div', { class: 'chat-modal-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('nav.chat') },
    el('div', { class: 'chat-modal-head' }, el('strong', { text: t('nav.chat') }), close), frame);
  const root = el('div', { class: 'chat-modal', hidden: '' }, box);
  root.addEventListener('pointerdown', (e) => { if (e.target === root) closeChat(); }); // 바깥(어두운 곳)을 누르면 닫는다
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) closeChat(); });
  document.body.append(root);
  chatModal = { root, frame };
  return chatModal;
}

/**
 * 챗봇 모달 열기. params 가 있으면(팔레트의 '챗봇과 이어서 상담') 그 값을 넘겨 챗봇을 새로 불러온다.
 * 없으면 이미 불러온 챗봇을 그대로 보여 준다 (처음이면 전달값 없이 연다)
 */
export function openChat(params = null) {
  const m = chatModal || buildChatModal();
  if (params) {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''));
    store.set('nav', { page: 'chat.html', params: clean });
    const query = new URLSearchParams(clean).toString();
    m.frame.src = 'chat.html' + (!STATIC && query ? '?' + query : '');
  } else if (!m.frame.getAttribute('src')) {
    store.remove('navCurrent.chat.html');
    m.frame.src = 'chat.html';
  }
  else {
    // 이미 불러온 챗봇: 그사이 '챗봇에 담기'로 담은 제품이 있으면 그걸로 이야기를 이어 간다 (chat.js picksHandoff)
    try { m.frame.contentWindow.dispatchEvent(new m.frame.contentWindow.Event('took:picks')); } catch { /* 아직 불러오는 중 */ }
  }
  m.root.hidden = false;
  document.documentElement.classList.add('chat-modal-open');
  m.root.querySelector('.chat-modal-box').animate([{ opacity: 0, transform: 'translateY(24px) scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  document.querySelector('.chat-fab')?.setAttribute('aria-expanded', 'true');
}

/** 챗봇 모달 닫기: 숨기기만 한다 (대화 유지). 읽어 주던 답은 멈춘다 */
export function closeChat({ toPalette = false } = {}) {
  if (!chatModal) return;
  try { chatModal.frame.contentWindow.speechSynthesis?.cancel(); } catch { /* 없음 */ }
  try { chatModal.frame.contentWindow.dispatchEvent(new chatModal.frame.contentWindow.Event('took:chat-hidden')); } catch { /* 없음 */ } // 바코드 비추기 카메라 창도 닫는다
  chatModal.root.hidden = true;
  document.documentElement.classList.remove('chat-modal-open');
  document.querySelector('.chat-fab')?.setAttribute('aria-expanded', 'false');
  document.querySelector('.chat-fab')?.focus();
  if (toPalette && HERE !== 'palette.html') location.href = 'palette.html';
}
window.tookChat = { open: openChat, close: closeChat };

// AI 뷰티 챗봇 플로팅 버튼 (오른쪽 아래 동그란 말풍선). 누르면 챗봇 모달을 연다
function chatFab() {
  const b = el('button', {
    type: 'button', class: 'chat-fab', 'aria-label': t('nav.chat'), title: t('nav.chat'), 'aria-haspopup': 'dialog', 'aria-expanded': 'false',
    onclick: () => openChat(),
  });
  b.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" stroke-width="2.6"/></svg>';
  // 담은 제품 수: 오른쪽 위 작은 동그라미 숫자 ('챗봇에 담기', chat-picks.js)
  const badge = el('span', { class: 'chat-fab-badge', 'aria-hidden': 'true' });
  b.append(badge);
  const sync = () => {
    const n = getPicks().length;
    badge.textContent = n ? String(n) : '';
    b.setAttribute('aria-label', n ? `${t('nav.chat')} · ${t('pick.count', { n })}` : t('nav.chat'));
  };
  window.addEventListener('took:picks-change', (e) => {
    sync();
    if (e.detail?.count) badge.animate([{ transform: 'scale(1.5)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
  });
  sync();
  return b;
}
