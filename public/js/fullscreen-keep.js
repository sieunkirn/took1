// 전체화면 고정 (2026-11-13): 전체화면은 전용 버튼으로만 끌 수 있고, 그 밖에서 풀리면 다음 입력 때 복구한다.
// - 브라우저는 사용자 동작 안에서만 전체화면을 켜게 해 주므로 "입력이 올 때마다 확인"하는 방식이다.
//   화면(페이지)을 옮기면 Chrome 이 전체화면을 풀기 때문에, 옮긴 뒤 첫 터치에서 다시 켜진다.
//   옮겨도 끊기지 않게 하려면 꽉 찬 화면(kiosk.html: 화면이 틀 안에서 바뀐다)으로 열거나,
//   Chrome 을 키오스크 모드로 띄운다 (scripts/kiosk-chrome.bat, 처음부터 끝까지 전체화면).
// - 전체화면이 되면 Esc 를 잠근다(Keyboard Lock). 브라우저가 해제를 허용한 경우 다음 입력 때 다시 켠다.
// - 틀(kiosk.html) 안의 화면이면 맨 위 창을 전체화면으로 만든다 (같은 출처)
// - 자동 테스트(navigator.webdriver)에서는 전체화면을 요청하지 않는다.
// 모든 화면 <head> 에 일반 스크립트로 넣는다
(function () {
  'use strict';
  const KEY = 'took.keepFullscreen';

  // 전체화면을 걸 창: 같은 출처의 맨 위 창 (틀 안이면 틀 바깥)
  let top = window;
  try { if (window.top !== window && window.top.document) top = window.top; } catch { /* 다른 출처 틀: 이 창만 */ }
  const doc = top.document;

  const paused = () => { try { return top.sessionStorage.getItem(KEY) === 'off'; } catch { return false; } };
  const off = () => navigator.webdriver || paused();
  const isFull = () => !!doc.fullscreenElement || top.matchMedia('(display-mode: fullscreen)').matches;

  function requestFull(force = false) {
    if (navigator.webdriver || (!force && paused()) || isFull() || !doc.documentElement.requestFullscreen) return;
    try { return doc.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch { return undefined; }
  }
  function enter() {
    try { top.sessionStorage.removeItem(KEY); } catch { /* 저장 불가 환경 */ }
    return requestFull(true);
  }
  function exit() {
    try { top.sessionStorage.setItem(KEY, 'off'); } catch { /* 저장 불가 환경 */ }
    try { return doc.exitFullscreen?.(); } catch { return undefined; }
  }
  const api = { isFull, isOff: paused, request: () => requestFull(), enter, exit };
  try { top.tookFullscreen = api; } catch { /* 다른 출처 프레임 */ }

  function keepFull(e) {
    if (e?.target?.closest?.('[data-fullscreen-control]')) return;
    const request = requestFull();
    request?.catch?.(() => {});
  }
  // 손을 뗄 때·클릭·키 입력: 사용자 동작으로 인정되는 순간
  for (const t of ['pointerup', 'click', 'keydown']) window.addEventListener(t, keepFull, true);

  // 맨 위 창에서 한 번만: 전체화면이 되면 Esc 를 잠근다 (Esc 한 번에 풀리지 않게)
  if (top === window) {
    doc.addEventListener('fullscreenchange', () => {
      if (doc.fullscreenElement && !off()) navigator.keyboard?.lock?.(['Escape']).catch?.(() => {});
      top.dispatchEvent(new top.Event('took:fullscreenchange'));
    });
  }
})();
