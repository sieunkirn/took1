// 홈 1~4번 화면. 좌표는 모두 900×1440 무대 기준 (ui-stage.js)
// 2026-11-18 시안: 1~3번은 로고 자리가 똑같다 (가로 가운데, 로고 세로 중심 = 화면 50%). 화면마다 바뀌는 건 배경과 문구뿐
// 배경 영상은 기존 videos/home.mp4 하나 (2026-11-19 사용자 요청: 따로 만든 입술 영상은 빼고 기존 영상만).
// 0~4.95초 제품 클로즈업 → 그 뒤 원래 영상의 입술 장면. 2·3번 동안은 입술 장면(4.95초~끝)만 되풀이한다
// 2026-11-20 사용자 요청 "Tap The Screen 3초만에": 영상을 3.45초부터 틀어 제품 장면은 끝 1.5초만 보여 주고, 입술 장면 1.5초 뒤 3번 = 처음부터 3초
//  1 제품 장면(3.45~4.95초) + 가운데 로고. 1.5초 뒤(또는 누르면) 2로
//  2 입술 영상 + 같은 로고. 1.5초 뒤(또는 누르면) 3으로
//  3 2번 + 로고 아래 "Tap The Screen". 입술 영상 반복. 누르면 바로 팔레트로 (2026-11-18 사용자 요청)
//  4 (지금은 평소 흐름에 없음, ?step=4 로만) 시작: 로고가 위로 올라가며 빛나고 알약 버튼이 나온다. 로고·버튼은 한 덩어리로 화면 가운데쯤, 버튼은 원본보다 1.2배 크게 + 아래 이름표 (2026-11-16 사용자 요청 "버튼 배치 더 예쁘게")
//     왼쪽 스캔 아이콘 = 카메라로 발라 보기(팔레트 Find Your Color), 오른쪽 음성 아이콘 = AI 뷰티 챗봇
//     버튼은 원본 3번 화면의 세 모양 순서대로 빛난다: 평소(어두운 분홍) → 손가락을 대면(분홍) → 떼는 순간(흰색) → 다음 화면
// 예전 홈(점선 얼굴·시계·버튼 두 개·다크 모드·언어 버튼)은 프로토타입에 없어 뺐다 (git 기록 a840e68 에 있음)
import { store } from './common.js';
import { t, lang, langToggle } from './i18n.js';
import { REDUCE_MOTION as reduce } from './motion.js';
import { logoFull } from './brand.js';
import { fitStage } from './ui-stage.js';
import { listenNfc } from './nfc.js';

document.documentElement.lang = lang(); // 홈은 applyI18n 을 부르지 않아 <html lang> 을 직접 맞춘다
try { sessionStorage.removeItem('took.homeSkipIntro'); } catch { /* 저장 불가 환경 */ }

// 스캔 아이콘: 네 모서리 괄호 (원본 36×35, 선 굵기 3.5)
const SCAN_SVG = '<svg class="hs-ico-scan" viewBox="0 0 36 35" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M2.2 10.6V6.8a4.6 4.6 0 0 1 4.6-4.6h3.6"/><path d="M25.6 2.2h3.6a4.6 4.6 0 0 1 4.6 4.6v3.6"/>'
  + '<path d="M33.8 24.4v3.8a4.6 4.6 0 0 1-4.6 4.6h-3.6"/><path d="M10.4 32.8H6.8a4.6 4.6 0 0 1-4.6-4.6v-3.8"/></g></svg>';
// 음성 아이콘: 둥근 막대 다섯 개 (원본 위치·높이 그대로)
const WAVE_SVG = '<svg class="hs-ico-wave" viewBox="0 0 60 34" aria-hidden="true" focusable="false"><g fill="currentColor">'
  + '<rect x="0" y="12" width="6" height="9" rx="3"/><rect x="11" y="4" width="8" height="25" rx="4"/><rect x="25" y="0" width="7.4" height="33" rx="3.7"/>'
  + '<rect x="38" y="4" width="7.4" height="25" rx="3.7"/><rect x="51" y="9" width="8" height="16" rx="4"/></g></svg>';

const stage = document.getElementById('stage');
fitStage(stage);
// 쌓는 순서: 배경 영상(소리 없음) → 어두운 덮개 → 로고 → 문구
stage.innerHTML = `<video class="hs-video" src="videos/home.mp4" autoplay muted playsinline preload="auto" aria-hidden="true" tabindex="-1"></video><div class="hs-dim" aria-hidden="true"></div>${logoFull('hs-logo')}
  <p class="hs-tap" aria-hidden="true">Tap The Screen</p>
  <div class="hs-start" data-state="a" data-side="scan">
    <div class="hs-glow" aria-hidden="true"><i></i></div>
    <div class="hs-pill" role="group">
      <span class="hs-knob" aria-hidden="true"></span>
      <button type="button" class="hs-opt hs-opt-scan">${SCAN_SVG}</button>
      <button type="button" class="hs-opt hs-opt-voice">${WAVE_SVG}</button>
    </div>
    <div class="hs-labels" aria-hidden="true"><span class="hs-label-scan">${t('home.labelScan')}</span><span class="hs-label-voice">${t('home.labelVoice')}</span></div>
  </div>
  <p class="sr-only" id="hs-help"></p>`;
stage.append(langToggle('hs-lang')); // 한국어/영어 (4번 시작 화면 오른쪽 위에서만 보인다)
const video = stage.querySelector('.hs-video');
const pill = stage.querySelector('.hs-pill');
const box = stage.querySelector('.hs-start'); // 눌린 단계(data-state a·b·c)와 고른 쪽(data-side)
pill.setAttribute('aria-label', t('home.choose'));
stage.querySelector('.hs-opt-scan').setAttribute('aria-label', t('home.toPalette'));
stage.querySelector('.hs-opt-voice').setAttribute('aria-label', t('home.toChat'));
stage.querySelector('#hs-help').textContent = t('home.tapToStart');

// ---------- 1 → 2 → 3 (배경 영상 장면에 맞춘다) ----------
const LIPS_AT = 4.95; // home.mp4 에서 제품 장면이 끝나고 입술 장면이 시작하는 시각(초)
const PRODUCT_MS = 1500; // 1번(제품 장면)을 보여 주는 시간: 영상을 LIPS_AT 보다 이만큼 앞에서 튼다 (2026-11-20, 예전엔 4.95초 전부)
const LIPS_MS = 1500; // 2번 화면을 보여 주는 시간 (3번은 누를 때까지 기다린다) → Tap The Screen = PRODUCT_MS + LIPS_MS = 3초
const PRODUCT_FROM = LIPS_AT - PRODUCT_MS / 1000; // 1번에서 영상을 틀기 시작하는 시각(초)
// 1번 시작: 영상을 제품 장면 끝 1.5초 앞으로 (영상 정보가 오기 전이면 온 뒤에)
function seekProduct() {
  const seek = () => { if (step === 1 && video.currentTime < PRODUCT_FROM) video.currentTime = PRODUCT_FROM; };
  if (video.readyState >= 1) seek();
  else video.addEventListener('loadedmetadata', seek, { once: true });
}
let step = 0;
let autoTimer = null;
function toLips() {
  if (stage.classList.contains('hs-lips-on')) return;
  stage.classList.add('hs-lips-on');
  if (video.currentTime < LIPS_AT) video.currentTime = LIPS_AT; // 눌러서 건너뛰었으면 입술 장면으로
  video.play().catch(() => {});
}
// 입술 장면 되풀이: 끝나면 처음(제품 장면)이 아니라 입술 장면 시작으로 (구간 이동은 서버의 부분 요청 Range 가 필요하다)
video.addEventListener('ended', () => {
  if (!stage.classList.contains('hs-lips-on')) return;
  video.currentTime = LIPS_AT;
  video.play().catch(() => {});
});
function go(n, { instant = false } = {}) {
  clearTimeout(autoTimer);
  step = n;
  stage.classList.toggle('hs-instant', instant || reduce);
  stage.dataset.step = String(n);
  if (instant || reduce) requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove('hs-instant')));
  // 1 → 2 는 타이머로 정확히 1.5초 (영상이 늦게 나와도 Tap The Screen 은 3초). 영상이 먼저 입술 장면에 닿아도 2로
  if (n === 1) { seekProduct(); autoTimer = setTimeout(() => go(2), PRODUCT_MS); watchCut(); }
  if (n >= 2) toLips(); // 2번부터는 입술 장면 (누르거나 ?step= 으로 건너뛴 경우 영상도 그 장면으로)
  if (n === 2) autoTimer = setTimeout(() => go(3), LIPS_MS);
}
// 1번: 영상이 입술 장면에 닿는 순간 2로
function watchCut() {
  if (step !== 1) return;
  if (video.currentTime >= LIPS_AT) { go(2); return; }
  requestAnimationFrame(watchCut);
}
// 1·2번 화면은 아무 곳이나 누르면 다음으로, 3번("Tap The Screen")은 누르면 바로 팔레트로 (2026-11-18 사용자 요청. 손을 뗄 때 한 번만)
function next() {
  if (leaving) return;
  if (step === 1 || step === 2) go(step + 1);
  else if (step === 3) { leaving = true; clearTimeout(autoTimer); start('scan'); }
}
stage.addEventListener('pointerup', next);
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && step < 4) { e.preventDefault(); next(); }
});

// ---------- 4번 알약 버튼: 누르는 동안 세 단계로 빛난다 ----------
// 2026-11-18부터 3번에서 바로 팔레트로 가서 평소 흐름에는 나오지 않는다 (?step=4 로만 열림)
let pressing = null;
let leaving = false;
const sideOf = (el) => (el?.closest('.hs-opt-voice') ? 'voice' : el?.closest('.hs-opt-scan') ? 'scan' : null);
pill.addEventListener('pointerdown', (e) => {
  if (step !== 4 || leaving) return;
  const side = sideOf(e.target);
  if (!side) return;
  pressing = { side, id: e.pointerId };
  box.dataset.side = side;
  box.dataset.state = 'b';
});
pill.addEventListener('pointerup', (e) => {
  if (!pressing || leaving) return;
  const { side } = pressing;
  pressing = null;
  // 손가락이 버튼 밖으로 나가서 떼면 취소
  const r = pill.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { box.dataset.state = 'a'; return; }
  press(side);
});
pill.addEventListener('pointercancel', () => { pressing = null; if (!leaving) box.dataset.state = 'a'; });
pill.addEventListener('pointerleave', (e) => { if (pressing && e.pointerType === 'mouse') { pressing = null; box.dataset.state = 'a'; } });
// 키보드(Enter·Space)로 누를 때: 같은 세 단계를 짧게 보여 준다
pill.addEventListener('click', (e) => {
  if (e.detail !== 0 || leaving) return;
  const side = sideOf(e.target);
  if (!side) return;
  box.dataset.side = side;
  box.dataset.state = 'b';
  setTimeout(() => press(side), 160);
});

function press(side) {
  if (leaving) return;
  leaving = true;
  box.dataset.side = side;
  box.dataset.state = 'c';
  setTimeout(() => start(side), reduce ? 0 : 320);
}

// ---------- NFC 태그 (2026-11-18): 홈 어느 단계에서든 립 제품을 리더기에 대면 팔레트로 넘어가 그 제품 색을 바로 바른다 ----------
// 찾기·안내(등록되지 않은 태그 포함)는 팔레트가 한다: 읽은 번호를 took.pendingTag 에 넘긴다 (palette.js)
listenNfc((code) => {
  if (leaving) return;
  try { sessionStorage.setItem('took.pendingTag', code); } catch { /* 저장 불가 환경: 팔레트만 열린다 */ }
  leaving = true;
  clearTimeout(autoTimer);
  if (step === 4) { box.dataset.side = 'scan'; box.dataset.state = 'c'; start('scan'); return; }
  store.remove('navCurrent.palette.html');
  location.href = 'palette.html';
});

// ---------- 다음 화면으로 ----------
// 팔레트: 로고가 Find Your Color 화면 왼쪽 위 작은 로고 자리로 줄어들며 날아가고, 나머지는 사라진다
const SMALL_LOGO = { left: 354.33, top: 66.31, k: 190 / 612 }; // palette 화면의 로고 (GP-홈화면 2026-11-18: 위 가운데 x 354.33~544.33, y 66.31~110.85)
function start(where) {
  if (where === 'voice') {
    store.remove('navCurrent.chat.html');
    location.href = 'chat.html';
    return;
  }
  store.remove('navCurrent.palette.html');
  try { sessionStorage.setItem('took.enterFx', '1'); } catch { /* 저장 불가 환경: 팔레트는 그냥 열린다 */ }
  if (reduce) { location.href = 'palette.html'; return; }
  stage.classList.add('hs-leaving');
  const logo = stage.querySelector('.hs-logo');
  // transform 은 로고의 원래 자리(CSS left 144, top 648) 기준이다. 3번 화면에서는 그 자리 그대로(none), 4번에서는 translateY(-200px)
  // 지금 보이는 상태에서 출발해, 원래 자리 기준으로 팔레트 로고 자리(위 가운데 354.33, 66.31 · 배율 190/612)에 정확히 멈춘다 (transform-origin 0 0)
  const BASE = { left: 144, top: 648 };
  const dx = SMALL_LOGO.left - BASE.left;
  const dy = SMALL_LOGO.top - BASE.top;
  const cs = getComputedStyle(logo);
  const from = cs.transform; // 지금 보이는 자리 그대로
  logo.style.transition = 'none';
  logo.animate([
    { transform: from === 'none' ? 'translate(0px, 0px)' : from, filter: cs.filter === 'none' ? 'drop-shadow(0 0 0 rgba(255, 255, 255, 0))' : cs.filter },
    { transform: `translate(${dx}px, ${dy}px) scale(${SMALL_LOGO.k})`, filter: 'drop-shadow(0 0 0 rgba(255, 255, 255, 0))' }, // 팔레트 로고는 빛 번짐 없음
  ], { duration: 650, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
  setTimeout(() => {
    // 키오스크 틀(kiosk.html) 안이면 페이지가 바뀌는 동안 틀이 같은 자리에 로고를 붙잡아 둔다 (팔레트가 그려지기 전 검은 깜빡임 막기)
    try { if (window.parent !== window) window.parent.tookHold?.(true); } catch { /* 틀 밖 */ }
    location.href = 'palette.html';
  }, 700);
}

// 언어를 바꿔 다시 열렸으면(took.homeFx) 바로 3번(Tap The Screen) 화면, 그 밖에(처음·초기화·로고) 1번부터
let arrive = false;
try {
  arrive = !!sessionStorage.getItem('took.homeFx');
  sessionStorage.removeItem('took.homeFx');
} catch { /* 저장 불가 환경 */ }
const want = Number(new URLSearchParams(location.search).get('step')); // 화면 확인용 ?step=1|2|3|4
go(want >= 1 && want <= 4 ? want : arrive ? 3 : 1, { instant: true });
window.tookHome = { go };
