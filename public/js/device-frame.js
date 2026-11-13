// 기기 모드와 미리보기 틀: 노트북·PC 에서 열면 세로 탭 크기 틀(preview.html) 안에 화면을 띄우고, 새로고침하면 처음 상태로 돌린다.
// 불러오는 순간 동작한다 (common.js 가 가장 먼저 불러온다).
// ---------- 노트북·PC: 갤럭시탭 세로 크기 틀로 보기 ----------
// 키오스크는 스탠드형 동그란 거울 안에 갤럭시탭 S10 FE+ 를 세로로 넣어 쓴다(2026-11-11 가로에서 다시 세로로). 노트북·PC(마우스 화면)에서 열면
// 창을 꽉 채우지 않고 세로 미리보기(preview.html)의 탭 크기 틀(800×1280 을 창에 맞춤) 안에 지금 화면을 띄운다.
// - 노트북을 세로로 세워 쓰는 꽉 찬 화면(kiosk.html)은 자동으로 가지 않는다. 미리보기의 '꽉 찬 화면' 버튼으로 들어간다
// - 터치 화면(실제 탭, pointer: coarse)·?device=tablet 으로 고정한 기기·직원 도구 화면·자동 테스트(navigator.webdriver)는 그대로
// 주소 값: ?쿼리 → 없으면 #조각
const HASH_PARAMS = (() => { try { return new URLSearchParams(location.hash.replace(/^#/, '')); } catch { return new URLSearchParams(); } })();
export function urlParam(name) {
  const v = new URLSearchParams(location.search).get(name);
  return v !== null ? v : HASH_PARAMS.get(name);
}
// 기기 모드 (주소 뒤 ?device=tablet, localStorage took.deviceMode):
//   tablet = 이 기기는 매장 태블릿 그 자체 (미리보기 틀 없이 화면을 바로 그린다. 모든 화면은 세로 기준).
//   주소 뒤 ?device=tablet 으로도 정하고, ?device=auto 로 해제한다. 손님 휴대폰 모드는 2026-11-11 없앴다
export const DEVICE_MODE = (() => {
  try {
    const want = new URLSearchParams(location.search).get('device');
    if (want === 'tablet') localStorage.setItem('took.deviceMode', want);
    else if (want === 'auto') localStorage.removeItem('took.deviceMode');
    const v = localStorage.getItem('took.deviceMode');
    if (v && v !== 'tablet') localStorage.removeItem('took.deviceMode'); // 예전 휴대폰 모드 설정은 지운다
    return v === 'tablet' ? v : null;
  } catch { return null; }
})();
// 예전 손님 휴대폰 표시(창 이름 took-phone)와 저장값(tookPhone.*)이 남아 있으면 지운다
try {
  if (window.name === 'took-phone') window.name = '';
  Object.keys(localStorage).filter((k) => k.startsWith('tookPhone.')).forEach((k) => localStorage.removeItem(k));
} catch { /* 저장 불가 환경 */ }
export const TAB_FRAME = true;
/** 이 화면을 탭 크기 틀로 옮기는 중이면 true (곧 다시 열리므로 화면마다 한 번만 할 일은 건너뛴다) */
export let MOVING_TO_TAB_FRAME = false;
const TAB_FRAME_SKIP = ['preview.html', 'kiosk.html'];
// 새로고침(F5·새로고침 버튼)하면 처음 상태로: 기기 설정(태블릿 고정)을 풀고, 저장한 상태(took.*)를 비우고
// 첫 화면(시작 화면, 노트북이면 태블릿 미리보기)으로.
// 직원 도구 화면은 그대로. 미리보기(preview.html)는 그 화면 스크립트가 같은 일을 한다
(function reloadToStart() {
  const page = location.pathname.split('/').pop() || 'index.html';
  if (TAB_FRAME_SKIP.includes(page)) return;
  const nav = performance.getEntriesByType?.('navigation')?.[0];
  if (nav?.type !== 'reload') return;
  if (window.top !== window) return; // 미리보기 틀 안의 화면은 틀(preview.html)이 처음 상태로 되돌린다
  try { localStorage.removeItem('took.deviceMode'); } catch { /* 저장 불가 환경 */ }
  try { window.name = ''; } catch { /* 없음 */ }
  try { Object.keys(sessionStorage).filter((k) => k.startsWith('took.')).forEach((k) => sessionStorage.removeItem(k)); } catch { /* 저장 불가 환경 */ }
  if (page === 'index.html' && !DEVICE_MODE) return; // 이미 첫 화면 (아래 틀 옮기기는 그대로)
  MOVING_TO_TAB_FRAME = true; // 곧 다른 화면으로 가므로 화면마다 한 번만 할 일은 건너뛴다
  location.replace('index.html');
})();
// 거울 화면 미리보기(preview.html)로 옮기기: 2026-11-13 주석 처리 (PC 에서도 화면을 틀 없이 바로 연다). 되살리려면 아래 주석을 풀면 된다
// (function openInTabFrame() {
//   const page = location.pathname.split('/').pop() || 'index.html';
//   if (!TAB_FRAME || window.top !== window || navigator.webdriver || TAB_FRAME_SKIP.includes(page) || DEVICE_MODE) return;
//   if (matchMedia('(pointer: coarse)').matches || !matchMedia('(min-width: 700px)').matches) return; // 실제 탭(터치)·작은 화면은 그대로
//   MOVING_TO_TAB_FRAME = true;
//   location.replace('preview.html?page=' + encodeURIComponent(page + location.search));
// })();
