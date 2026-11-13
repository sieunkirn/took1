// 외부 터치 필름 좌표 보정 (2026-11-13)
// 기기: 갤럭시탭 S10 FE+ 세로 + 하프미러 유리 + 유리 뒷면 15인치 PCAP 터치 필름(USB).
// 안드로이드가 필름 전체 면적을 화면 전체에 그대로 대응시켜서 축이 뒤바뀌고(회전·반전) 크기·위치가 어긋난다.
// 루팅 없이 OS 에서 고칠 수 없어서 웹 안에서 "들어온 원본 좌표 → 손가락이 실제로 닿은 화면 좌표" 아핀 변환을 건다.
//
// - 보정값이 없으면 아무것도 막지 않는다 (10초 길게 누르기 감지만 수동(passive)으로 듣는다)
// - 보정값이 있으면 pointerType 이 touch 인 입력만 바꾼다. 마우스는 그대로 (블루투스 마우스로 설정 작업)
// - 모든 화면 <head> 에 일반 스크립트로 넣는다. 미리보기 틀(preview.html·kiosk.html) 안의 화면이면
//   좌표를 맨 위 창 기준으로 올려 맨 위 창의 엔진 하나가 변환하고, 변환한 자리의 요소를 같은 출처 iframe 안까지 찾아 내려간다
//
// 주소 뒤에 붙이는 값
//   ?calib=1      보정 화면 열기 (화면 아무 곳이나 10초 길게 눌러도 열린다)
//   ?calib=reset  저장한 보정값 지우기
//   ?calibdebug=1 원본 좌표(빨강)·보정 좌표(초록)를 화면에 표시 (=0 으로 끈다, 탭을 닫을 때까지 유지)
//   ?calibsim=1   기기 없이 PC 에서 검증: 입력에 가짜 왜곡(90° 회전 + 가로 0.85·세로 0.77 + 이동)을 먼저 걸고 마우스도 터치로 본다 (=0 으로 끈다)
(function (G) {
  'use strict';

  // ---------- 아핀 변환 계산 (브라우저 밖 단위 테스트에서도 쓴다) ----------
  // 행렬 m = [a, b, c, d, e, f] : x' = a·x + b·y + c, y' = d·x + e·y + f
  const applyAffine = (m, x, y) => [m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5]];

  /** 3×3 연립방정식 A·v = r (가우스 소거, 부분 피벗). 풀 수 없으면 null */
  function solve3(A, r) {
    const M = A.map((row, i) => [...row, r[i]]);
    for (let c = 0; c < 3; c++) {
      let p = c;
      for (let i = c + 1; i < 3; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
      if (Math.abs(M[p][c]) < 1e-9) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let i = 0; i < 3; i++) {
        if (i === c) continue;
        const k = M[i][c] / M[c][c];
        for (let j = c; j < 4; j++) M[i][j] -= k * M[c][j];
      }
    }
    return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
  }

  /**
   * 점 쌍 [{ raw: [x, y], real: [x, y] }, …] 로 원본 → 실제 아핀 변환을 최소제곱으로 구한다.
   * 회전·축 교환·반전·크기·위치를 한 번에 푼다 (방향을 가정하지 않는다). 3점 이상, 한 줄 위에 있지 않아야 한다.
   * → { m, rms, max } (rms·max = 남은 오차 px) 또는 null
   */
  function solveAffine(pairs) {
    if (!Array.isArray(pairs) || pairs.length < 3) return null;
    // 숫자 안정성: 원본 좌표를 평균 0 · 크기 1 근처로 옮겨서 푼 뒤 되돌린다
    const n = pairs.length;
    const mx = pairs.reduce((s, p) => s + p.raw[0], 0) / n;
    const my = pairs.reduce((s, p) => s + p.raw[1], 0) / n;
    const sc = Math.sqrt(pairs.reduce((s, p) => s + (p.raw[0] - mx) ** 2 + (p.raw[1] - my) ** 2, 0) / n) || 1;
    const AtA = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const AtX = [0, 0, 0];
    const AtY = [0, 0, 0];
    for (const p of pairs) {
      const row = [(p.raw[0] - mx) / sc, (p.raw[1] - my) / sc, 1];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) AtA[i][j] += row[i] * row[j];
        AtX[i] += row[i] * p.real[0];
        AtY[i] += row[i] * p.real[1];
      }
    }
    const u = solve3(AtA, AtX);
    const v = solve3(AtA, AtY);
    if (!u || !v) return null;
    // 정규화를 되돌린다: x' = u0·(x-mx)/sc + u1·(y-my)/sc + u2
    const m = [u[0] / sc, u[1] / sc, u[2] - (u[0] * mx + u[1] * my) / sc,
      v[0] / sc, v[1] / sc, v[2] - (v[0] * mx + v[1] * my) / sc];
    if (!m.every(Number.isFinite) || Math.abs(m[0] * m[4] - m[1] * m[3]) < 1e-6) return null;
    let sum = 0;
    let max = 0;
    for (const p of pairs) {
      const [x, y] = applyAffine(m, p.raw[0], p.raw[1]);
      const d = Math.hypot(x - p.real[0], y - p.real[1]);
      sum += d * d;
      max = Math.max(max, d);
    }
    return { m, rms: Math.sqrt(sum / n), max };
  }

  function invertAffine(m) {
    const det = m[0] * m[4] - m[1] * m[3];
    if (Math.abs(det) < 1e-12) return null;
    const a = m[4] / det, b = -m[1] / det, d = -m[3] / det, e = m[0] / det;
    return [a, b, -(a * m[2] + b * m[5]), d, e, -(d * m[2] + e * m[5])];
  }

  G.TookAffine = { solveAffine, applyAffine, invertAffine };
  if (typeof document === 'undefined' || typeof window === 'undefined') return; // 단위 테스트(node)

  // ---------- 브라우저 ----------
  const W = window;
  const KEY = 'took.touchCalib'; // 실제 기기 보정값
  const SIM_KEY = 'took.touchCalibSim'; // 시뮬레이션 보정값 (실제 값과 섞이지 않게 따로)
  const LONG_PRESS_MS = 10000;
  const TAP_SLOP = 15; // 이만큼 움직이면 탭(click)이 아니다 (안드로이드 터치 기준과 비슷하게)
  const PAN_SLOP = 8; // 이만큼 움직이면 스크롤을 시작할지 정한다
  const Z = 2147483647;

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* 저장 불가 환경 */ } },
  };
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* 저장 불가 환경 */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch { /* 저장 불가 환경 */ } },
  };

  // 주소 값: 이 창의 것을 읽어 둔다 (sim·debug 는 탭을 닫을 때까지 기억한다. 화면을 옮겨 다녀도 유지)
  const params = new URLSearchParams(location.search);
  const flag = (name, key) => {
    const v = params.get(name);
    if (v === '1') ss.set(key, '1');
    else if (v === '0') ss.del(key);
  };
  flag('calibsim', 'tookCalib.sim');
  flag('calibdebug', 'tookCalib.debug');
  if (params.get('calib') === 'reset') { ls.del(KEY); ls.del(SIM_KEY); }

  // ---------- 엔진: 맨 위 같은 출처 창에 하나 ----------
  let ROOT = W;
  try {
    let w = W;
    while (w.parent !== w) { void w.parent.document; w = w.parent; } // 다른 출처면 여기서 멈춘다
    ROOT = w;
  } catch { /* 다른 출처 부모: 그 아래까지만 */ }
  const engine = (() => {
    try { if (ROOT.__tookCalib) return ROOT.__tookCalib; } catch { /* 없음 */ }
    const e = createEngine(ROOT);
    try { ROOT.__tookCalib = e; } catch { /* 없음 */ }
    return e;
  })();
  engine.addWindow(W);
  if (params.get('calib') === '1') {
    // 주소에서 calib=1 은 지워 둔다 (저장한 뒤 새로고침해도 다시 열리지 않게)
    params.delete('calib');
    try { history.replaceState(history.state, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash); } catch { /* 없음 */ }
    const go = () => engine.startCalib();
    if (ROOT.document.body) go(); else ROOT.addEventListener('DOMContentLoaded', go, { once: true });
  } else if (params.get('calibtest') === '1') {
    const go = () => engine.startTest();
    if (ROOT.document.body) go(); else ROOT.addEventListener('DOMContentLoaded', go, { once: true });
  }

  function createEngine(root) {
    const rdoc = root.document;
    const sim = ss.get('tookCalib.sim') === '1';
    const debug = ss.get('tookCalib.debug') === '1';
    const storeKey = sim ? SIM_KEY : KEY;
    const load = () => {
      try {
        const v = JSON.parse(ls.get(storeKey));
        return v && Array.isArray(v.m) && v.m.length === 6 && v.m.every(Number.isFinite) && v.frame === 'screen' ? v : null; // 예전(창 안쪽 기준) 값은 버린다 → 다시 보정
      } catch { return null; }
    };
    let saved = load();
    let calib = null; // 보정 화면 상태
    let test = null; // 정확도 테스트 화면 상태
    const syn = new WeakSet(); // 우리가 만든 이벤트 (다시 가로채지 않게)
    const wins = new Set();
    const gestures = new Map(); // pointerId → 진행 중인 터치
    let fling = 0;
    const listeners = new Set(); // 상태가 바뀌면 알린다 (미리보기의 터치 보정 버튼 상자)
    const notify = () => listeners.forEach((f) => { try { f(); } catch { /* 닫힌 화면 */ } });

    const isActive = () => !!(saved || sim || debug || calib || test);

    // 시뮬레이션: 필름이 화면에 잘못 대응된 모습을 흉내 낸다 (90° 회전 + 가로 0.85·세로 0.77 + 이동)
    const simDistort = (x, y) => {
      const Wd = root.innerWidth, Hd = root.innerHeight;
      const u = x / Wd, v = y / Hd;
      return [Wd * (0.08 + 0.85 * v), Hd * (0.1 + 0.77 * (1 - u))];
    };
    // 좌표 기준 (2026-11-13 수정): 필름은 늘 '화면 전체'에 대응되므로 원본·실제 좌표를 화면 기준(screenX/Y)으로 풀어 둔다.
    // 창 안쪽(client) 기준으로 풀면 주소창이 보일 때 보정한 값이 전체화면에서 주소창 높이만큼 어긋난다.
    // curOff = 지금 이벤트의 '화면 → 맨 위 창 안쪽' 차이 (screen - client). 이벤트마다 그 이벤트 값으로 다시 잰다
    let curOff = [0, 0];
    const toClient = (q) => [q[0] - curOff[0], q[1] - curOff[1]];
    const applyC = (m, p) => toClient(applyAffine(m, p[0], p[1]));
    const correct = (p) => toClient(saved ? applyAffine(saved.m, p[0], p[1]) : p);

    // ---------- 창(iframe) 사이 좌표 ----------
    // iframe 과 그 조상에 걸린 transform 의 선형 부분 (preview.html 의 scale, kiosk.html 의 rotate·scale)
    function frameLinear(fr) {
      let a = 1, b = 0, c = 0, d = 1;
      for (let n = fr; n && n.nodeType === 1; n = n.parentElement) {
        const t = n.ownerDocument.defaultView.getComputedStyle(n).transform;
        if (t && t !== 'none') {
          const m = new DOMMatrixReadOnly(t);
          [a, b, c, d] = [m.a * a + m.c * b, m.b * a + m.d * b, m.a * c + m.c * d, m.b * c + m.d * d];
        }
      }
      return { a, b, c, d };
    }
    // 아핀 변환은 요소의 가운데를 바깥 사각형(getBoundingClientRect)의 가운데로 보낸다 → 가운데 기준으로 옮긴다
    function childToParent(fr, x, y) {
      const r = fr.getBoundingClientRect();
      const L = frameLinear(fr);
      const px = x + fr.clientLeft - fr.offsetWidth / 2, py = y + fr.clientTop - fr.offsetHeight / 2;
      return [r.left + r.width / 2 + L.a * px + L.c * py, r.top + r.height / 2 + L.b * px + L.d * py];
    }
    function parentToChild(fr, X, Y) {
      const r = fr.getBoundingClientRect();
      const L = frameLinear(fr);
      const det = L.a * L.d - L.b * L.c || 1;
      const dx = X - (r.left + r.width / 2), dy = Y - (r.top + r.height / 2);
      const px = (L.d * dx - L.c * dy) / det, py = (-L.b * dx + L.a * dy) / det;
      return [px + fr.offsetWidth / 2 - fr.clientLeft, py + fr.offsetHeight / 2 - fr.clientTop];
    }
    function toRoot(win, x, y) {
      let p = [x, y];
      for (let w = win; w !== root && w.frameElement; w = w.parent) p = childToParent(w.frameElement, p[0], p[1]);
      return p;
    }
    function fromRoot(win, X, Y) {
      const chain = [];
      for (let w = win; w !== root && w.frameElement; w = w.parent) chain.unshift(w.frameElement);
      let p = [X, Y];
      for (const fr of chain) p = parentToChild(fr, p[0], p[1]);
      return p;
    }
    /** 맨 위 창 좌표의 요소를 같은 출처 iframe 안까지 찾는다 → { win, el, x, y(그 창 좌표) } */
    function deepHit(X, Y) {
      let win = root, x = X, y = Y;
      for (let i = 0; i < 6; i++) {
        const el = win.document.elementFromPoint(x, y);
        if (!el) return null;
        if (el.tagName === 'IFRAME') {
          let cw = null;
          try { cw = el.contentWindow; if (!cw.document.documentElement) cw = null; } catch { cw = null; }
          if (cw) { [x, y] = parentToChild(el, x, y); win = cw; continue; }
        }
        return { win, el, x, y };
      }
      return null;
    }

    // ---------- 이벤트 만들기 ----------
    function firePointer(g, type, el, x, y, extra = {}) {
      const win = g.win;
      const down = type === 'pointerdown' || type === 'pointermove';
      const init = {
        bubbles: !/enter|leave/.test(type), cancelable: !/cancel|enter|leave/.test(type), composed: true, view: win,
        clientX: x, clientY: y, screenX: x, screenY: y, pointerId: g.id, pointerType: 'touch', isPrimary: true,
        button: type === 'pointermove' ? -1 : 0, buttons: down ? 1 : 0, width: 20, height: 20, pressure: down ? 0.5 : 0, ...extra,
      };
      const ev = new (win.PointerEvent || win.MouseEvent)(type, init);
      syn.add(ev);
      el.dispatchEvent(ev);
      return ev;
    }
    function fireMouse(g, type, el, x, y) {
      const win = g.win;
      const init = { bubbles: true, cancelable: true, composed: true, view: win, clientX: x, clientY: y, screenX: x, screenY: y,
        button: 0, buttons: type === 'mousedown' ? 1 : 0, detail: 1 };
      const ev = type === 'click' && win.PointerEvent
        ? new win.PointerEvent('click', { ...init, pointerId: g.id, pointerType: 'touch', isPrimary: true })
        : new win.MouseEvent(type, init);
      syn.add(ev);
      el.dispatchEvent(ev);
      return ev;
    }
    function fireTouch(g, type, x, y) {
      const win = g.win;
      try {
        const t = new win.Touch({ identifier: g.id, target: g.el, clientX: x, clientY: y, pageX: x + win.scrollX, pageY: y + win.scrollY, screenX: x, screenY: y, radiusX: 10, radiusY: 10, force: 0.5 });
        const live = type === 'touchend' || type === 'touchcancel' ? [] : [t];
        const ev = new win.TouchEvent(type, { bubbles: true, cancelable: type !== 'touchcancel', composed: true, view: win, touches: live, targetTouches: live, changedTouches: [t] });
        syn.add(ev);
        g.el.dispatchEvent(ev);
        return ev;
      } catch { return null; } // Touch 생성자가 없는 브라우저 (PC Firefox 등)
    }

    // ---------- 브라우저 기본 동작 대신 하기 ----------
    const FOCUSABLE = 'input:not([type=range]):not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable=""], [contenteditable="true"]';
    const TEXT_INPUT = 'input:not([type]), input[type=text], input[type=search], input[type=email], input[type=tel], input[type=url], input[type=number], input[type=password], textarea';
    function emulateFocus(g, el) {
      const doc = g.win.document;
      const f = el.closest?.(FOCUSABLE);
      if (f && !f.disabled) {
        // 안드로이드 시스템 키보드는 페이지 밖이라 보정이 안 된다 → 띄우지 않는다 (챗봇은 화면 터치 키보드를 쓴다)
        if (f.matches(TEXT_INPUT)) f.setAttribute('inputmode', 'none');
        if (doc.activeElement !== f) f.focus();
      } else if (doc.activeElement && doc.activeElement !== doc.body && doc.activeElement.matches?.(FOCUSABLE)) {
        doc.activeElement.blur();
      }
    }
    function setPressed(g, on) {
      for (let n = g.el; n && n.nodeType === 1; n = n.parentElement) n.classList.toggle('took-press', on);
    }
    function rangeValue(input, x) {
      const r = input.getBoundingClientRect();
      const min = Number(input.min || 0), max = Number(input.max || 100);
      const stepAttr = input.step;
      const step = stepAttr === 'any' ? 0 : Number(stepAttr || 1);
      const thumb = 20; // 손잡이 반지름만큼 양끝을 뺀다 (대략)
      let t = (x - r.left - thumb / 2) / Math.max(1, r.width - thumb);
      t = Math.min(1, Math.max(0, t));
      let v = min + t * (max - min);
      if (step > 0) v = min + Math.round((v - min) / step) * step;
      return String(Math.min(max, Math.max(min, v)));
    }
    function setRange(g, x) {
      const v = rangeValue(g.range, x);
      if (g.range.value === v) return;
      g.range.value = v;
      const ev = new g.win.Event('input', { bubbles: true });
      g.range.dispatchEvent(ev);
      g.rangeChanged = true;
    }
    const canScroll = (n, axis) => (axis === 'y' ? n.scrollHeight > n.clientHeight + 1 : n.scrollWidth > n.clientWidth + 1);
    function allowedAxes(el, win) {
      let x = true, y = true;
      for (let n = el; n && n.nodeType === 1 && n !== win.document.documentElement; n = n.parentElement) {
        const ta = win.getComputedStyle(n).touchAction || 'auto';
        if (ta === 'none') return { x: false, y: false };
        if (/pan-/.test(ta)) {
          if (!/pan-x|pan-left|pan-right/.test(ta)) x = false;
          if (!/pan-y|pan-up|pan-down/.test(ta)) y = false;
        }
      }
      return { x, y };
    }
    function findScroller(el, win, axis) {
      const doc = win.document;
      for (let n = el; n && n.nodeType === 1 && n !== doc.body && n !== doc.documentElement; n = n.parentElement) {
        const ov = axis === 'y' ? win.getComputedStyle(n).overflowY : win.getComputedStyle(n).overflowX;
        if (/auto|scroll|overlay/.test(ov) && canScroll(n, axis)) return n;
      }
      const se = doc.scrollingElement;
      if (se && canScroll(se, axis)) {
        const ov = (n) => (axis === 'y' ? win.getComputedStyle(n).overflowY : win.getComputedStyle(n).overflowX);
        if (ov(doc.documentElement) !== 'hidden' && (!doc.body || ov(doc.body) !== 'hidden')) return se;
      }
      return null;
    }
    function startFling(sc, vx, vy) {
      cancelAnimationFrame(fling);
      let last = performance.now();
      const step = (now) => {
        const dt = Math.min(40, now - last);
        last = now;
        sc.scrollLeft -= vx * dt;
        sc.scrollTop -= vy * dt;
        const k = Math.pow(0.95, dt / 16);
        vx *= k; vy *= k;
        if (Math.hypot(vx, vy) > 0.02) fling = requestAnimationFrame(step);
      };
      if (Math.hypot(vx, vy) > 0.3) fling = requestAnimationFrame(step);
    }
    // 네이티브 select 는 시스템 팝업이라 보정이 안 된다 → 페이지 안 목록으로 고른다
    function openSelect(sel) {
      const doc = sel.ownerDocument;
      const win = doc.defaultView;
      const box = doc.createElement('div');
      box.setAttribute('role', 'listbox');
      box.style.cssText = `position:fixed;inset:0;z-index:${Z - 2};display:grid;place-items:center;background:rgba(0,0,0,.35);`;
      const list = doc.createElement('div');
      list.style.cssText = 'min-width:260px;max-width:86vw;max-height:70vh;overflow:auto;padding:8px;border-radius:16px;background:var(--paper,#fff);color:var(--ink,#111);box-shadow:0 10px 40px rgba(0,0,0,.3);display:flex;flex-direction:column;gap:4px;';
      [...sel.options].forEach((o, i) => {
        if (o.hidden) return;
        const b = doc.createElement('button');
        b.type = 'button';
        b.textContent = o.textContent;
        b.disabled = o.disabled;
        b.setAttribute('role', 'option');
        b.setAttribute('aria-selected', String(i === sel.selectedIndex));
        b.style.cssText = `min-height:52px;padding:8px 16px;text-align:left;font-size:17px;border-radius:10px;border:1px solid ${i === sel.selectedIndex ? 'var(--ink,#111)' : 'transparent'};background:var(--paper,#fff);color:inherit;`;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          box.remove();
          if (sel.selectedIndex === i) return;
          sel.selectedIndex = i;
          sel.dispatchEvent(new win.Event('input', { bubbles: true }));
          sel.dispatchEvent(new win.Event('change', { bubbles: true }));
        });
        list.append(b);
      });
      box.append(list);
      box.addEventListener('click', (e) => { if (e.target === box) box.remove(); });
      doc.body.append(box);
    }

    // ---------- 보정된 터치 처리 ----------
    function down(id, P, raw) {
      cancelAnimationFrame(fling);
      const q = correct(P);
      const Wd = root.innerWidth, Hd = root.innerHeight;
      debugShow(raw, q);
      // 유리의 화면 바깥 부분을 누른 경우: 이 터치 전체를 무시한다
      if (q[0] < 0 || q[1] < 0 || q[0] >= Wd || q[1] >= Hd) { gestures.set(id, { ignored: true }); return; }
      const hit = deepHit(q[0], q[1]);
      if (!hit) { gestures.set(id, { ignored: true }); return; }
      const g = { id, win: hit.win, el: hit.el, start: [hit.x, hit.y], last: [hit.x, hit.y], q0: q, mode: null, track: [[performance.now(), hit.x, hit.y]] };
      gestures.set(id, g);
      prepareWindow(g.win);
      const pd = firePointer(g, 'pointerdown', g.el, hit.x, hit.y);
      const ts = fireTouch(g, 'touchstart', hit.x, hit.y);
      g.noCompat = pd.defaultPrevented; // pointerdown 을 막으면 호환 마우스 이벤트(mousedown 등)는 없다
      g.noClick = !!ts?.defaultPrevented; // touchstart 를 막으면 click 도 없다
      setPressed(g, true);
      const range = g.el.closest?.('input[type=range]');
      if (range && !range.disabled && !pd.defaultPrevented) {
        g.mode = 'range';
        g.range = range;
        setRange(g, hit.x);
      }
    }
    function move(id, P, raw) {
      const g = gestures.get(id);
      const q = correct(P);
      debugShow(raw, q);
      if (!g || g.ignored) return;
      const [x, y] = fromRoot(g.win, q[0], q[1]);
      const now = performance.now();
      g.track.push([now, x, y]);
      while (g.track.length > 2 && now - g.track[0][0] > 100) g.track.shift();
      if (g.mode === 'range') { setRange(g, x); firePointer(g, 'pointermove', g.el, x, y); g.last = [x, y]; return; }
      if (g.mode === 'scroll') {
        g.scroller.scrollLeft -= g.axis === 'x' ? x - g.last[0] : 0;
        g.scroller.scrollTop -= g.axis === 'y' ? y - g.last[1] : 0;
        g.last = [x, y];
        return;
      }
      const dx = x - g.start[0], dy = y - g.start[1];
      if (!g.mode && Math.hypot(dx, dy) > PAN_SLOP) {
        // 스크롤을 시작할지: 손가락 방향의 축을 그 요소(touch-action)가 허락하고 스크롤할 곳이 있으면 스크롤
        const axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        const ok = allowedAxes(g.el, g.win)[axis];
        const sc = ok ? findScroller(g.el, g.win, axis) : null;
        if (sc) {
          g.mode = 'scroll'; g.axis = axis; g.scroller = sc;
          setPressed(g, false);
          firePointer(g, 'pointercancel', g.el, x, y);
          fireTouch(g, 'touchcancel', x, y);
          g.scroller.scrollLeft -= axis === 'x' ? x - g.last[0] : 0;
          g.scroller.scrollTop -= axis === 'y' ? y - g.last[1] : 0;
          g.last = [x, y];
          return;
        }
        g.mode = 'drag';
      }
      if (Math.hypot(dx, dy) > TAP_SLOP) setPressed(g, false);
      // 드래그 중에는 처음 눌린 요소로 계속 보낸다 (터치의 암묵적 포인터 캡처와 같다)
      firePointer(g, 'pointermove', g.el, x, y);
      fireTouch(g, 'touchmove', x, y);
      g.last = [x, y];
    }
    function up(id, P, raw, cancelled) {
      const g = gestures.get(id);
      gestures.delete(id);
      const q = P ? correct(P) : null;
      if (q) debugShow(raw, q);
      if (!g || g.ignored) return;
      setPressed(g, false);
      const [x, y] = q ? fromRoot(g.win, q[0], q[1]) : g.last;
      if (g.mode === 'scroll') {
        const t = g.track;
        if (t.length > 1) {
          const dt = Math.max(1, t.at(-1)[0] - t[0][0]);
          startFling(g.scroller, g.axis === 'x' ? (t.at(-1)[1] - t[0][1]) / dt : 0, g.axis === 'y' ? (t.at(-1)[2] - t[0][2]) / dt : 0);
        }
        return;
      }
      if (cancelled) {
        firePointer(g, 'pointercancel', g.el, x, y);
        fireTouch(g, 'touchcancel', x, y);
        return;
      }
      firePointer(g, 'pointerup', g.el, x, y);
      const te = fireTouch(g, 'touchend', x, y);
      if (g.mode === 'range') {
        if (g.rangeChanged) g.range.dispatchEvent(new g.win.Event('change', { bubbles: true }));
        return;
      }
      // 탭: 많이 움직이지 않았을 때만 호환 마우스 이벤트와 click (안드로이드 Chrome 순서: pointerup → touchend → mousedown → mouseup → click)
      const moved = Math.hypot(x - g.start[0], y - g.start[1]);
      if (moved > TAP_SLOP || g.noClick || te?.defaultPrevented) return;
      const upHit = deepHit(q ? q[0] : 0, q ? q[1] : 0);
      let target = g.el;
      if (upHit && upHit.win === g.win) { while (target && !target.contains(upHit.el)) target = target.parentElement; }
      if (!target || !target.isConnected) target = g.el.isConnected ? g.el : null;
      if (!target) return;
      if (!g.noCompat) {
        const md = fireMouse(g, 'mousedown', target, x, y);
        if (!md.defaultPrevented) emulateFocus(g, target);
        fireMouse(g, 'mouseup', target, x, y);
      }
      const ck = fireMouse(g, 'click', target, x, y);
      const sel = target.closest?.('select');
      if (sel && !sel.disabled && !ck.defaultPrevented) openSelect(sel);
    }

    // ---------- 창마다 준비 (보정이 켜졌을 때만) ----------
    const PRESS_CSS = `
      html { touch-action: none; }
      button.took-press:not(:disabled), .btn-primary.took-press, .btn-line.took-press, .photo-btn.took-press { transform: scale(0.96); transition-duration: 0.08s; }
      input[type="range"].took-press::-webkit-slider-thumb { transform: scale(1.18); }
      .paint.took-press .paint-blob { transform: scale(0.9); }
      .tkb-key.took-press { background: var(--line-2); }
      .tkb-fn.took-press { background: var(--faint); }
      .tkb-enter.took-press { background: var(--ink-2); }`;
    function prepareWindow(win) {
      if (!isActive() || win.__tookCalibReady) return;
      const doc = win.document;
      if (!doc.head) return;
      win.__tookCalibReady = true;
      const st = doc.createElement('style');
      st.id = 'took-calib-css';
      st.textContent = PRESS_CSS;
      doc.head.append(st);
      // 합성 이벤트의 pointerId 로 setPointerCapture 를 부르면 오류가 날 수 있다 (팔레트 섞는 칸 등). 드래그는 처음 요소로 계속 보내므로 캡처는 이미 흉내 낸 셈이다
      const P = win.Element.prototype;
      for (const name of ['setPointerCapture', 'releasePointerCapture']) {
        const orig = P[name];
        P[name] = function (id) { try { return orig.call(this, id); } catch { return undefined; } };
      }
    }

    // ---------- 원본 입력 가로채기 ----------
    const POINTER = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'];
    const BLOCK_TOUCH = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];
    const BLOCK_MOUSE = ['mousedown', 'mousemove', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu'];
    function managed(e) {
      if (!isActive()) return false;
      if (e.type.startsWith('touch')) return true;
      if (typeof e.pointerType === 'string' && e.pointerType) return e.pointerType === 'touch' || (sim && e.pointerType === 'mouse');
      if (sim) return true; // 시뮬레이션: 마우스도 터치로 본다
      return !!e.sourceCapabilities?.firesTouchEvents; // 터치에서 생긴 호환 마우스 이벤트
    }
    /** 원본 좌표(화면 기준)를 돌려주고 curOff 를 이 이벤트 값으로 맞춘다 */
    function rawRoot(e, win) {
      const c = toRoot(win, e.clientX, e.clientY);
      if (sim) { curOff = [0, 0]; return simDistort(c[0], c[1]); } // 시뮬레이션은 창 안쪽 기준 그대로
      const sx = e.screenX, sy = e.screenY;
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) { curOff = [0, 0]; return c; }
      curOff = [sx - c[0], sy - c[1]];
      return [sx, sy];
    }
    let primary = null; // 한 손가락만 (첫 손가락)
    function onRaw(e) {
      if (syn.has(e)) return;
      const win = e.view || e.target?.ownerDocument?.defaultView || W;
      // 시뮬레이션에서도 테스트용 버튼(미리보기의 터치 보정 상자, 보정 화면의 닫기)은 마우스가 있는 자리 그대로 눌린다
      if (sim && !e.type.startsWith('touch') && e.pointerType !== 'touch' && e.target?.closest?.('[data-calib-exempt]')) return;
      longPress(e, win);
      if (!managed(e)) return;
      if (e.cancelable) e.preventDefault();
      e.stopImmediatePropagation();
      if (!POINTER.includes(e.type)) return;
      if (e.type === 'pointerup' && !sim) requestFull(); // 사용자 동작 안에서만 전체화면을 켤 수 있다
      if (sim && e.type === 'pointermove' && e.buttons === 0 && primary === null) { if (debug) debugShow(rawRoot(e, win), correct(rawRoot(e, win)), true); return; }
      const P = rawRoot(e, win);
      if (calib) { calibInput(e.type, e.pointerId, P); return; }
      if (test) { testInput(e.type, e.pointerId, P); return; }
      if (e.type === 'pointerdown') {
        if (primary !== null) return;
        primary = e.pointerId;
        down(e.pointerId, P, P);
      } else if (e.pointerId === primary) {
        if (e.type === 'pointermove') move(e.pointerId, P, P);
        else { primary = null; up(e.pointerId, P, P, e.type === 'pointercancel'); }
      }
    }
    // 시뮬레이션에서 마우스로 끌면 이미지·글자가 끌려가지 않게
    function onDragStart(e) { if (sim && isActive()) e.preventDefault(); }

    // ---------- 전체화면 ----------
    function requestFull() {
      try {
        if (rdoc.fullscreenElement || root.matchMedia('(display-mode: fullscreen)').matches) return;
        const p = rdoc.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
        p?.catch?.(() => {});
      } catch { /* 지원 안 함 */ }
    }

    // ---------- 10초 길게 누르기 → 보정 화면 ----------
    // 보정이 어긋나 있어도 들어갈 수 있게 원본 터치(touch 이벤트, 시뮬레이션은 마우스)로만 잰다. 막지 않고 듣기만 한다
    let lp = null;
    function longPress(e, win) {
      const t = e.type;
      const startT = (sim ? t === 'mousedown' : t === 'touchstart' && e.touches?.length === 1);
      const endT = sim ? t === 'mouseup' : (t === 'touchend' || t === 'touchcancel' || (t === 'touchstart' && e.touches?.length > 1));
      if (startT && !calib && !test) {
        clearLongPress();
        const t0 = performance.now();
        lp = { tick: setInterval(() => {
          const left = Math.ceil((LONG_PRESS_MS - (performance.now() - t0)) / 1000);
          if (left <= 0) { clearLongPress(); startCalib(); return; }
          if (performance.now() - t0 > 3000) showHint(`계속 누르고 있으면 터치 보정 화면이 열려요 · ${left}`);
        }, 250) };
      } else if (endT) clearLongPress();
    }
    function clearLongPress() {
      if (lp) clearInterval(lp.tick);
      lp = null;
      showHint('');
    }
    let hintEl = null;
    function showHint(text) {
      if (!text) { hintEl?.remove(); hintEl = null; return; }
      if (!hintEl) {
        hintEl = rdoc.createElement('div');
        hintEl.style.cssText = `position:fixed;left:50%;top:24px;translate:-50% 0;z-index:${Z};padding:10px 18px;border-radius:999px;background:#111;color:#fff;font:600 15px/1.3 system-ui,sans-serif;pointer-events:none;`;
        rdoc.body?.append(hintEl);
      }
      hintEl.textContent = text;
    }

    // ---------- 디버그 표시 ----------
    let dbg = null;
    function debugShow(raw, q, hover) {
      if (!debug || !rdoc.body) return;
      if (!dbg) {
        dbg = rdoc.createElement('div');
        dbg.style.cssText = `position:fixed;inset:0;z-index:${Z - 1};pointer-events:none;font:600 12px/1.2 ui-monospace,monospace;`;
        dbg.innerHTML = '<div data-r style="position:absolute;width:16px;height:16px;margin:-8px;border-radius:50%;background:#e00;opacity:.8"></div>'
          + '<div data-g style="position:absolute;width:16px;height:16px;margin:-8px;border-radius:50%;background:#0a0;opacity:.85"></div>'
          + '<div data-t style="position:absolute;left:8px;bottom:8px;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.75);color:#fff;white-space:pre"></div>';
        rdoc.body.append(dbg);
      }
      const r = dbg.querySelector('[data-r]'), g = dbg.querySelector('[data-g]'), t = dbg.querySelector('[data-t]');
      const rc = toClient(raw); // 빨간 점은 창 안쪽 좌표로 그린다 (숫자는 화면 기준 원본값)
      r.style.left = rc[0] + 'px'; r.style.top = rc[1] + 'px';
      g.style.left = q[0] + 'px'; g.style.top = q[1] + 'px';
      g.style.background = q[0] < 0 || q[1] < 0 || q[0] >= root.innerWidth || q[1] >= root.innerHeight ? '#888' : '#0a0';
      const size = `${root.innerWidth}×${root.innerHeight}`;
      const savedSize = saved?.size ? `${saved.size[0]}×${saved.size[1]}` : '-';
      t.textContent = `원본(빨강) ${raw[0].toFixed(0)}, ${raw[1].toFixed(0)}${hover ? ' (안 누름)' : ''}\n보정(초록) ${q[0].toFixed(0)}, ${q[1].toFixed(0)}\n`
        + `보정값 ${saved ? '있음' : '없음'}${sim ? ' · 시뮬레이션' : ''} · 창 ${size}${saved && savedSize !== size ? ` (보정 때 ${savedSize})` : ''} · 창 위치 ${curOff[0].toFixed(0)}, ${curOff[1].toFixed(0)}`
        + (rdoc.fullscreenElement ? ' · 전체화면' : '');
    }

    // ---------- 보정 화면 ----------
    const TARGETS = [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9], [0.5, 0.5]];
    function startCalib() {
      if (calib) return;
      if (!rdoc.body) { root.addEventListener('DOMContentLoaded', startCalib, { once: true }); return; }
      clearLongPress();
      for (const g of gestures.values()) if (!g.ignored) { setPressed(g, false); firePointer(g, 'pointercancel', g.el, g.last[0], g.last[1]); }
      gestures.clear();
      primary = null;
      const ov = rdoc.createElement('div');
      ov.id = 'took-calib';
      ov.style.cssText = `position:fixed;inset:0;z-index:${Z};background:#fff;color:#111;font:500 17px/1.45 system-ui,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;`;
      ov.innerHTML = `
        <div data-msg style="position:absolute;left:50%;top:34%;translate:-50% -50%;width:min(80%,520px);text-align:center;word-break:keep-all"></div>
        <div data-cross style="position:absolute;width:64px;height:64px;margin:-32px;display:none">
          <div style="position:absolute;left:31px;top:0;width:2px;height:64px;background:#111"></div>
          <div style="position:absolute;top:31px;left:0;height:2px;width:64px;background:#111"></div>
          <div data-ring style="position:absolute;inset:16px;border:2px solid #111;border-radius:50%"></div>
        </div>
        <div data-dots style="position:absolute;inset:0;pointer-events:none"></div>
        <div data-btns style="position:absolute;left:50%;top:62%;translate:-50% 0;display:none;gap:14px">
          <button type="button" data-act="save" style="min-width:140px;min-height:64px;font-size:19px;font-weight:700;border-radius:14px;border:0;background:#111;color:#fff">저장</button>
          <button type="button" data-act="retry" style="min-width:140px;min-height:64px;font-size:19px;font-weight:700;border-radius:14px;border:2px solid #111;background:#fff;color:#111">다시 하기</button>
          <button type="button" data-act="test" style="min-width:220px;min-height:64px;font-size:18px;font-weight:700;border-radius:14px;border:2px solid #111;background:#fff;color:#111">지금 보정값으로 테스트만</button>
        </div>
        <div data-finger style="position:absolute;width:30px;height:30px;margin:-15px;border-radius:50%;background:rgba(0,0,0,.25);border:2px solid #111;display:none;pointer-events:none"></div>
        <button type="button" data-act="cancel" data-calib-exempt style="position:absolute;right:12px;top:12px;min-height:40px;padding:4px 14px;border-radius:10px;border:1px solid #999;background:#fff;color:#555;font-size:14px">닫기 (마우스·Esc)</button>`;
      rdoc.body.append(ov);
      calib = { ov, step: -1, pts: [], cur: null, result: null };
      wins.forEach(prepareWindow);
      ov.addEventListener('click', (e) => { // 마우스(보정 대상이 아닌 입력)로 누른 버튼
        const act = e.target.closest?.('[data-act]')?.dataset.act;
        if (act) calibAction(act);
      });
      root.addEventListener('keydown', calibKey, true);
      calibIntro();
    }
    function calibKey(e) { if (e.key === 'Escape') { e.preventDefault(); calibAction('cancel'); } }
    const q$ = (s) => calib.ov.querySelector(s);
    const showBtns = (acts) => {
      q$('[data-btns]').style.display = acts.length ? 'flex' : 'none';
      for (const b of calib.ov.querySelectorAll('[data-btns] [data-act]')) b.style.display = acts.includes(b.dataset.act) ? '' : 'none';
    };
    /** 보정 화면 버튼 중 맞은 것 (q = 보정된 좌표) */
    const btnAt = (root, q) => [...root.querySelectorAll('[data-act]')].find((b) => {
      if (b.offsetParent === null) return false;
      const r = b.getBoundingClientRect();
      return q[0] >= r.left && q[0] <= r.right && q[1] >= r.top && q[1] <= r.bottom;
    });
    function calibIntro() {
      calib.step = -1; calib.pts = []; calib.result = null;
      showBtns(saved ? ['test'] : []); // 보정값이 있으면 그 값으로 테스트만 해 볼 수도 있다
      q$('[data-cross]').style.display = 'none';
      q$('[data-finger]').style.display = 'none';
      q$('[data-dots]').innerHTML = '';
      q$('[data-msg]').innerHTML = '<b style="font-size:22px">터치 보정</b><br>화면을 한 번 누르면 시작해요.<br>십자 표시 5개가 차례로 나오면 가운데를 손가락으로 1초쯤 눌렀다 떼 주세요.'
        + (sim ? '<br><small style="color:#666">시뮬레이션: 마우스 입력에 가짜 왜곡이 걸려 있어요</small>' : '');
    }
    function calibShowTarget() {
      const [u, v] = TARGETS[calib.step];
      const c = q$('[data-cross]');
      c.style.display = 'block';
      c.style.left = u * root.innerWidth + 'px';
      c.style.top = v * root.innerHeight + 'px';
      q$('[data-ring]').style.background = '';
      q$('[data-msg]').innerHTML = `${calib.step + 1} / ${TARGETS.length}<br>십자 가운데를 눌렀다 떼 주세요`;
    }
    function calibInput(type, id, P) {
      const c = calib;
      if (type === 'pointerdown') {
        if (c.cur) return;
        c.cur = { id, sx: 0, sy: 0, n: 0 };
      }
      if (!c.cur || c.cur.id !== id) return;
      if (type === 'pointerdown' || type === 'pointermove') {
        c.cur.sx += P[0]; c.cur.sy += P[1]; c.cur.n++;
        if (c.step >= 0 && c.step < TARGETS.length) q$('[data-ring]').style.background = 'rgba(0,0,0,.2)';
        if (c.result) { // 확인 화면: 손가락 위치에 점이 따라다닌다 (방금 구한 행렬로 보정)
          const q = applyC(c.result.m, P);
          const f = q$('[data-finger]');
          f.style.display = 'block'; f.style.left = q[0] + 'px'; f.style.top = q[1] + 'px';
          c.cur.q = q;
        }
        return;
      }
      // 손을 뗐다
      const cur = c.cur;
      c.cur = null;
      if (type === 'pointercancel') { if (c.step >= 0 && !c.result) q$('[data-ring]').style.background = ''; return; }
      if (c.step === -1) { // 시작
        if (saved) { const b = btnAt(q$('[data-btns]'), correct(P)); if (b) { calibAction(b.dataset.act); return; } }
        showBtns([]);
        c.size = [root.innerWidth, root.innerHeight];
        c.step = 0;
        // 전체화면으로 바뀌어 크기가 달라지면 그때 첫 표시를 그린다
        setTimeout(calibShowTarget, sim ? 0 : 400);
        return;
      }
      if (c.result) {
        const q = cur.q || applyC(c.result.m, P);
        const b = btnAt(q$('[data-btns]'), q);
        if (b) calibAction(b.dataset.act);
        return;
      }
      // 누르고 있는 동안의 좌표 평균
      const raw = [cur.sx / cur.n, cur.sy / cur.n];
      const [u, v] = TARGETS[c.step];
      // 실제 좌표도 화면 기준으로 (표시 자리 + 이 터치 때의 창 위치)
      c.pts.push({ raw, real: [u * root.innerWidth + curOff[0], v * root.innerHeight + curOff[1]], off: curOff.slice() });
      c.step++;
      if (c.step < TARGETS.length) { calibShowTarget(); return; }
      q$('[data-cross]').style.display = 'none';
      const res = solveAffine(c.pts);
      if (!res) {
        calibIntro();
        q$('[data-msg]').innerHTML = '보정값을 구하지 못했어요 (점이 한 줄로 찍혔어요).<br>화면을 한 번 누르면 다시 시작해요.';
        return;
      }
      c.result = res;
      c.size = [root.innerWidth, root.innerHeight];
      // 표시와 보정된 점을 같이 보여 준다
      q$('[data-dots]').innerHTML = c.pts.map((p) => {
        const a = applyAffine(res.m, p.raw[0], p.raw[1]);
        const q = [a[0] - p.off[0], a[1] - p.off[1]];
        return `<div style="position:absolute;left:${p.real[0] - p.off[0]}px;top:${p.real[1] - p.off[1]}px;width:22px;height:22px;margin:-11px;border:2px solid #111;border-radius:50%"></div>`
          + `<div style="position:absolute;left:${q[0]}px;top:${q[1]}px;width:8px;height:8px;margin:-4px;border-radius:50%;background:#111"></div>`;
      }).join('');
      q$('[data-msg]').innerHTML = `<b style="font-size:22px">확인</b><br>화면 아무 곳이나 눌러 보세요. 손가락 자리에 점이 따라오면 맞은 거예요.<br>`
        + `남은 오차: 평균 ${res.rms.toFixed(1)}px · 최대 ${res.max.toFixed(1)}px<br><small style="color:#666">저장하면 바로 정확도 테스트(표시 9개)로 넘어가요</small>`;
      showBtns(['save', 'retry']);
    }
    function calibAction(act) {
      if (!calib) return;
      if (act === 'retry') { calibIntro(); showBtns([]); calib.step = 0; calibShowTarget(); return; }
      if (act === 'test') { closeCalib(); startTest(); return; }
      if (act === 'save' && calib.result) {
        saved = { frame: 'screen', m: calib.result.m, rms: calib.result.rms, max: calib.result.max, size: calib.size, at: new Date().toISOString() };
        const ok = ls.set(storeKey, JSON.stringify(saved));
        closeCalib();
        wins.forEach(prepareWindow);
        if (!ok) toast('이 브라우저는 저장이 안 돼서 이번 화면에서만 적용돼요');
        startTest(); // 저장하자마자 맞는지 눌러 본다
        return;
      }
      if (act === 'cancel') closeCalib();
    }
    function closeCalib() {
      calib?.ov.remove();
      calib = null;
      root.removeEventListener('keydown', calibKey, true);
      notify();
    }

    // ---------- 정확도 테스트: 표시 9개를 보정된 좌표로 눌러 맞았는지 본다 ----------
    const TEST_TARGETS = [[0.15, 0.12], [0.5, 0.12], [0.85, 0.12], [0.15, 0.5], [0.5, 0.5], [0.85, 0.5], [0.15, 0.88], [0.5, 0.88], [0.85, 0.88]];
    const HIT_R = 30; // 이 반지름(px) 안이면 맞음 (손가락 버튼 크기 정도)
    function startTest() {
      if (calib || test) return;
      if (!rdoc.body) { root.addEventListener('DOMContentLoaded', startTest, { once: true }); return; }
      clearLongPress();
      gestures.clear();
      primary = null;
      const ov = rdoc.createElement('div');
      ov.id = 'took-calib-test';
      ov.style.cssText = `position:fixed;inset:0;z-index:${Z};background:#fff;color:#111;font:500 17px/1.45 system-ui,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;`;
      ov.innerHTML = `
        <div data-msg style="position:absolute;left:50%;top:30%;translate:-50% -50%;width:min(80%,520px);text-align:center;word-break:keep-all"></div>
        <div data-dots style="position:absolute;inset:0;pointer-events:none"></div>
        <div data-btns style="position:absolute;left:50%;top:62%;translate:-50% 0;display:none;gap:14px">
          <button type="button" data-act="done" style="min-width:140px;min-height:64px;font-size:19px;font-weight:700;border-radius:14px;border:0;background:#111;color:#fff">끝내기</button>
          <button type="button" data-act="again" style="min-width:140px;min-height:64px;font-size:19px;font-weight:700;border-radius:14px;border:2px solid #111;background:#fff;color:#111">다시 테스트</button>
          <button type="button" data-act="recal" style="min-width:140px;min-height:64px;font-size:19px;font-weight:700;border-radius:14px;border:2px solid #111;background:#fff;color:#111">다시 보정</button>
        </div>
        <button type="button" data-act="done" data-calib-exempt style="position:absolute;right:12px;top:12px;min-height:40px;padding:4px 14px;border-radius:10px;border:1px solid #999;background:#fff;color:#555;font-size:14px">닫기 (마우스·Esc)</button>`;
      rdoc.body.append(ov);
      test = { ov, i: 0, res: [], cur: null };
      wins.forEach(prepareWindow);
      ov.addEventListener('click', (e) => { // 마우스로 누른 버튼
        const act = e.target.closest?.('[data-act]')?.dataset.act;
        if (act) testAction(act);
      });
      root.addEventListener('keydown', testKey, true);
      testShow();
      notify();
    }
    function testKey(e) { if (e.key === 'Escape') { e.preventDefault(); testAction('done'); } }
    const tq = (s) => test.ov.querySelector(s);
    const ring = (x, y, r, style) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${r * 2}px;height:${r * 2}px;margin:-${r}px;border-radius:50%;${style}"></div>`;
    function testShow() {
      const t = test;
      tq('[data-btns]').style.display = 'none';
      if (t.i === 0) tq('[data-dots]').innerHTML = '';
      const [u, v] = TEST_TARGETS[t.i];
      const x = u * root.innerWidth, y = v * root.innerHeight;
      t.target = [x, y];
      tq('[data-dots]').querySelector('[data-now]')?.remove();
      tq('[data-dots]').insertAdjacentHTML('beforeend', `<div data-now>${ring(x, y, HIT_R, 'border:3px solid #111;background:rgba(0,0,0,.08)')}${ring(x, y, 3, 'background:#111')}</div>`);
      tq('[data-msg]').innerHTML = `<b style="font-size:22px">정확도 테스트</b><br>${t.i + 1} / ${TEST_TARGETS.length} · 동그라미 가운데를 눌러 주세요`;
    }
    function testInput(type, id, P) {
      const t = test;
      if (type === 'pointerdown') { if (!t.cur) t.cur = id; return; }
      if (t.cur !== id || type === 'pointermove') return;
      t.cur = null;
      if (type === 'pointercancel') return;
      const q = correct(P);
      if (t.i >= TEST_TARGETS.length) { // 결과 화면: 버튼도 보정된 좌표로 누른다
        const b = btnAt(tq('[data-btns]'), q);
        if (b) testAction(b.dataset.act);
        return;
      }
      const d = Math.hypot(q[0] - t.target[0], q[1] - t.target[1]);
      const hit = d <= HIT_R;
      t.res.push(d);
      tq('[data-now]')?.remove();
      tq('[data-dots]').insertAdjacentHTML('beforeend',
        ring(t.target[0], t.target[1], HIT_R, `border:2px ${hit ? 'solid' : 'dashed'} #111`)
        + ring(q[0], q[1], 6, hit ? 'background:#111' : 'background:#fff;border:2px solid #111')
        + `<div style="position:absolute;left:${t.target[0]}px;top:${t.target[1] + HIT_R + 4}px;translate:-50% 0;font-size:13px;font-weight:700">${hit ? '맞음' : '빗나감'} ${d.toFixed(0)}px</div>`);
      t.i++;
      if (t.i < TEST_TARGETS.length) { testShow(); return; }
      const n = t.res.filter((v) => v <= HIT_R).length;
      const avg = t.res.reduce((s, v) => s + v, 0) / t.res.length;
      const max = Math.max(...t.res);
      t.summary = { n, total: TEST_TARGETS.length, avg, max };
      lastSummary = t.summary;
      tq('[data-msg]').innerHTML = `<b style="font-size:22px">${n === TEST_TARGETS.length ? '모두 맞았어요' : `${TEST_TARGETS.length}개 중 ${n}개 맞음`}</b><br>`
        + `손가락과 눌린 자리 차이: 평균 ${avg.toFixed(0)}px · 최대 ${max.toFixed(0)}px<br><small style="color:#666">검은 점 = 실제로 눌린 자리. 빗나간 곳이 많으면 다시 보정해 주세요</small>`;
      tq('[data-btns]').style.display = 'flex';
      notify();
    }
    function testAction(act) {
      if (!test) return;
      if (act === 'again') { test.i = 0; test.res = []; testShow(); return; }
      closeTest();
      if (act === 'recal') startCalib();
    }
    function closeTest() {
      test?.ov.remove();
      test = null;
      root.removeEventListener('keydown', testKey, true);
      notify();
    }

    // ---------- 밖에서 쓰는 조작 (미리보기의 터치 보정 버튼 상자) ----------
    function setFlag(name, on) {
      const key = name === 'sim' ? 'tookCalib.sim' : 'tookCalib.debug';
      if (on) ss.set(key, '1'); else ss.del(key);
      root.location.reload(); // 시뮬레이션·좌표 표시는 화면을 다시 열어 적용한다
    }
    function reset() {
      ls.del(storeKey);
      saved = null;
      lastSummary = null;
      toast(sim ? '시뮬레이션 보정값을 지웠어요' : '터치 보정값을 지웠어요');
      notify();
    }
    function status() {
      return { sim, debug, saved: saved ? { rms: saved.rms, max: saved.max, at: saved.at } : null, lastTest: lastSummary };
    }
    let lastSummary = null; // 마지막 정확도 테스트 결과
    function toast(text) {
      const t = rdoc.createElement('div');
      t.textContent = text;
      t.style.cssText = `position:fixed;left:50%;bottom:40px;translate:-50% 0;z-index:${Z};padding:12px 20px;border-radius:999px;background:#111;color:#fff;font:600 16px/1.3 system-ui,sans-serif;pointer-events:none;`;
      rdoc.body.append(t);
      setTimeout(() => t.remove(), 2600);
    }

    function addWindow(win) {
      if (wins.has(win)) return;
      wins.add(win);
      for (const t of [...POINTER, ...BLOCK_TOUCH, ...BLOCK_MOUSE]) win.addEventListener(t, onRaw, { capture: true, passive: false });
      win.addEventListener('dragstart', onDragStart, true);
      win.addEventListener('pagehide', () => wins.delete(win));
      if (win.document.head) prepareWindow(win);
      else win.document.addEventListener('DOMContentLoaded', () => prepareWindow(win), { once: true });
    }

    return {
      addWindow, startCalib, startTest, setFlag, reset, status,
      onChange(f) { listeners.add(f); return () => listeners.delete(f); },
      get saved() { return saved; }, get sim() { return sim; },
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
