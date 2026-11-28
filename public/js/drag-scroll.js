// 손가락으로 목록 밀기 (2026-11-28 갤탭 APK '제품 시트 제품 드래그가 안 됨')
// 갤탭 앱에서는 브라우저 기본 스크롤(overflow: auto 를 손가락으로 밀기)이 먹지 않았다. 메인 스레드가 비어 있어도(화면 막힘 13ms) 마찬가지였다.
// 다이얼·질감 줄처럼 손가락 움직임(pointer 이벤트)을 직접 받아 scrollTop/scrollLeft 를 움직인다. 터치·마우스·보정 터치 모두 같은 길로 온다.
//  - 8px 넘게 움직여야 끌기로 본다. 그 전에 떼면 그냥 톡(버튼 누르기)
//  - 끌었으면 손 뗀 뒤 그 자리 버튼의 click 은 막는다 (밀다가 카드가 눌리지 않게)
//  - 손을 빨리 떼면 관성으로 조금 더 미끄러진다
//  - 끄는 동안은 scroll-snap 을 꺼 둔다 (scrollTop 을 바꿀 때마다 칸에 달라붙어 덜컥거리지 않게), 끝나면 원래대로
// 브라우저 기본 밀기와 겹치지 않게 이 목록들은 CSS 에서 touch-action: none (took-tagged.css)
const LISTS = [
  ['.fc-rec-list', 'y'], // 추천 제품 시트
  ['.fc-sh-grid', 'y'],  // 호수 시트
  ['.fd-body', 'y'],     // 자세히 보기
  ['.nt-chips', 'x'],    // NFC 창 호수 줄
  ['.nt-recent', 'x'],   // NFC 창 최근 태그
];
const SLOP = 8; // 이만큼(화면 px) 움직이면 끌기
const flings = new Map(); // 요소 → 관성 애니메이션 id
let g = null; // 끄는 중 { el, axis, id, x0, y0, start, k, moved, track }
let noClickUntil = 0;

const pos = (el, axis) => (axis === 'y' ? el.scrollTop : el.scrollLeft);
const setPos = (el, axis, v) => { if (axis === 'y') el.scrollTop = v; else el.scrollLeft = v; };
const maxPos = (el, axis) => (axis === 'y' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth);

function stopFling(el) {
  const id = flings.get(el);
  if (id) cancelAnimationFrame(id);
  flings.delete(el);
}
function release(el) {
  el.style.scrollSnapType = '';
  el.classList.remove('drag-scrolling');
}

function onDown(e) {
  if (g || (e.pointerType === 'mouse' && e.button !== 0)) return;
  for (const [sel, axis] of LISTS) {
    const el = e.target.closest?.(sel);
    if (!el) continue;
    const wasFlinging = flings.has(el);
    stopFling(el);
    if (wasFlinging) release(el);
    if (maxPos(el, axis) <= 1) return; // 밀 것이 없다
    // 화면 px → 요소 px (900×1440 무대·키오스크 틀이 CSS 로 줄어 있다)
    const r = el.getBoundingClientRect();
    const k = axis === 'y' ? (el.offsetHeight ? r.height / el.offsetHeight : 1) : (el.offsetWidth ? r.width / el.offsetWidth : 1);
    g = { el, axis, id: e.pointerId, x0: e.clientX, y0: e.clientY, start: pos(el, axis), k: k || 1, moved: false, track: [[e.timeStamp, pos(el, axis)]] };
    if (wasFlinging) noClickUntil = performance.now() + 250; // 미끄러지는 목록을 잡아 멈춘 톡은 누르기가 아니다
    return;
  }
}

function onMove(e) {
  if (!g || e.pointerId !== g.id) return;
  const d = g.axis === 'y' ? g.y0 - e.clientY : g.x0 - e.clientX; // 화면 px (위로 밀면 +)
  if (!g.moved) {
    if (Math.abs(d) < SLOP) return;
    g.moved = true;
    g.el.style.scrollSnapType = 'none';
    g.el.classList.add('drag-scrolling');
    try { g.el.setPointerCapture(e.pointerId); } catch { /* 보정 터치(가짜 포인터) */ }
  }
  if (e.cancelable) e.preventDefault();
  const v = Math.max(0, Math.min(maxPos(g.el, g.axis), g.start + d / g.k));
  setPos(g.el, g.axis, v);
  g.track.push([e.timeStamp, v]);
  while (g.track.length > 2 && e.timeStamp - g.track[0][0] > 100) g.track.shift();
}

function onUp(e) {
  if (!g || e.pointerId !== g.id) return;
  const { el, axis, moved, track } = g;
  g = null;
  if (!moved) return;
  noClickUntil = performance.now() + 350;
  // 관성: 마지막 0.1초 속도로 미끄러지다 점점 멈춘다
  const a = track[0], b = track[track.length - 1];
  let v = e.type === 'pointerup' && b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) : 0; // 요소 px/ms
  v = Math.max(-6, Math.min(6, v));
  if (Math.abs(v) < 0.05) { release(el); return; }
  let last = performance.now();
  const step = (now) => {
    const dt = Math.min(40, now - last);
    last = now;
    const max = maxPos(el, axis);
    const next = pos(el, axis) + v * dt;
    setPos(el, axis, Math.max(0, Math.min(max, next)));
    v *= Math.pow(0.95, dt / 16);
    if (Math.abs(v) < 0.02 || next <= 0 || next >= max) { flings.delete(el); release(el); return; }
    flings.set(el, requestAnimationFrame(step));
  };
  flings.set(el, requestAnimationFrame(step));
}

// 끌고 난 뒤의 click 은 버튼까지 가지 않게 막는다
function onClick(e) {
  if (performance.now() < noClickUntil) { e.preventDefault(); e.stopPropagation(); noClickUntil = 0; }
}

export function setupDragScroll(root = document) {
  root.addEventListener('pointerdown', onDown, true);
  root.addEventListener('pointermove', onMove, { capture: true, passive: false });
  root.addEventListener('pointerup', onUp, true);
  root.addEventListener('pointercancel', onUp, true);
  root.addEventListener('click', onClick, true);
  // 끄는 동안 목록 안 그림·글자를 끌어 옮기거나 고르지 않게
  root.addEventListener('dragstart', (e) => { if (g?.moved) e.preventDefault(); }, true);
}
