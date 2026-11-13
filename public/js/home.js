// 홈 = 대기 화면 (옛 거울 ver4 대기 화면): 왼쪽 위 TOOK 로고, 오른쪽 위 시계, 가운데 점선 얼굴(천천히 밝아졌다 어두워짐), 아래 안내 두 줄.
// 화면 아무 곳이나 누르면(키보드도) 바로 팔레트로 간다. 오른쪽 아래 다크 모드·언어 버튼은 눌러도 넘어가지 않는다.
// 라이트·다크 모드에 따라 흰 바탕+검정 선 / 검정 바탕+흰 선 (색은 wireframe.css 의 --paper·--ink)
import { t, languageMenu, themeToggle } from './i18n.js';
import { store, logoSvg } from './common.js';
import { REDUCE_MOTION as reduce } from './motion.js';


try { sessionStorage.removeItem('took.homeSkipIntro'); } catch { /* 저장 불가 환경 */ } // 옛 인트로 건너뛰기 표시 (지금은 쓰지 않음)

const FACE_SVG = '<svg class="hs-face" viewBox="0 0 200 250" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="0 9.5">'
  + '<path d="M100 16C146 16 164 50 164 96C164 150 150 190 128 212C118 222 110 226 100 226C90 226 82 222 72 212C50 190 36 150 36 96C36 50 54 16 100 16Z"/>'
  + '<path d="M37 112C27 108 24 122 28 138C31 150 37 155 42 152"/><path d="M163 112C173 108 176 122 172 138C169 150 163 155 158 152"/>'
  + '<path d="M62 108H86M114 108H138M62 126H86M114 126H138"/><path d="M90 160Q100 170 110 160"/><path d="M82 190H118"/></g></svg>';

const box = document.getElementById('home-standby');
box.setAttribute('aria-label', t('home.touch'));
box.innerHTML = `<div class="hs-top" aria-hidden="true">${logoSvg('hs-logo')}<time class="hs-clock"></time></div>${FACE_SVG}`;
const hint = document.createElement('p');
hint.className = 'hs-hint';
hint.textContent = t('home.standby');
const sub = document.createElement('p');
sub.className = 'hs-sub';
sub.textContent = t('home.standbyTouch');
const langWrap = document.createElement('div');
langWrap.className = 'intro-lang';
langWrap.append(themeToggle(), languageMenu({ skipIntro: false }));
box.append(hint, sub, langWrap);

const clock = box.querySelector('.hs-clock');
const tick = () => {
  const now = new Date();
  clock.textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  clock.dateTime = now.toISOString();
};
tick();
setInterval(tick, 1000);

let leaving = false;
const LEAVE_MS = 650;
// 팔레트로 넘어가는 움직임: 얼굴·안내·시계·버튼은 살짝 커지며 사라지고, 왼쪽 위 TOOK 로고는 팔레트 상단 메뉴의 로고 자리로 줄어들며 날아간다.
// 팔레트 화면은 로고가 그 자리에 있는 채로 나머지가 아래에서 떠오른다 (palette.html 머리 스크립트 + wireframe.css .enter-fx)
function navLogoRect() {
  // 상단 메뉴는 팔레트에서 그려지므로, 같은 스타일의 메뉴를 보이지 않게 잠깐 만들어 로고 자리를 잰다
  const probe = document.createElement('header');
  probe.className = 'nav';
  probe.style.cssText = 'position:fixed;top:0;left:0;right:0;visibility:hidden;pointer-events:none';
  probe.innerHTML = `<strong><a class="nav-logo">${logoSvg()}</a></strong>`;
  document.body.append(probe);
  const r = probe.querySelector('svg').getBoundingClientRect();
  probe.remove();
  return r;
}
function leave() {
  try { sessionStorage.setItem('took.enterFx', '1'); } catch { /* 저장 불가 환경: 팔레트는 그냥 열린다 */ }
  if (reduce) { location.href = 'palette.html'; return; }
  box.classList.add('hs-leaving');
  const logo = box.querySelector('.hs-logo');
  const from = logo.getBoundingClientRect();
  const to = navLogoRect();
  const k = to.height / from.height;
  logo.animate([{ transform: 'none' }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${k})` }],
    { duration: LEAVE_MS, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
  setTimeout(() => { location.href = 'palette.html'; }, LEAVE_MS);
}
const go = (e) => {
  // 다크 모드·언어 버튼을 누르거나 그 안에서 키를 누르면 넘어가지 않고 버튼이 받는다
  if (leaving || e.target?.closest?.('.intro-lang') || langWrap.contains(document.activeElement)) return;
  leaving = true;
  e.preventDefault();
  store.remove('navCurrent.palette.html'); // 팔레트는 이전 전달값 없이 새로 연다
  leave();
};
// 팔레트 상단 로고로 왔으면(common.js goHomeWithMotion): 로고는 이미 제자리, 얼굴 → 안내 글 순서로 떠오른다
try {
  if (sessionStorage.getItem('took.homeFx') && !reduce) box.classList.add('hs-arrive');
  sessionStorage.removeItem('took.homeFx');
} catch { /* 저장 불가 환경 */ }
box.addEventListener('pointerdown', go);
addEventListener('keydown', go, true);
