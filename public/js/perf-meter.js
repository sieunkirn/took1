// 시간 표시 (2026-11-28, 관리자 '기능 점검' 줄의 스위치로 켠다)
// 거울 화면 왼쪽 위에 웹캠 한 장을 처리하는 데 걸린 시간을 보여 준다. 갤럭시탭에서 어디가 느린지 재려고 넣었다.
//  - 입술 찾기: lip-tracker.js detectVideo (얼굴 인식 모델)
//  - 색 칠하기: lip-view.js drawLipFrame (영상 그리기 + 입술 색 입히기)
//  - 초당 장수: 1초에 실제로 처리한 웹캠 프레임 수 (30 근처면 부드럽다)
// 한 장에 33ms 를 넘기면 1초에 30장을 못 그려 거울이 끊겨 보인다.
// 값은 이 기기 브라우저에 남는다. 키는 admin.html 의 PERF_KEY 와 같아야 한다. 기본은 꺼짐(11-29 사용자 요청), 관리자에서 켠 기기만 '1'
export const PERF_KEY = 'took.perf';
export function perfOn() {
  try { return localStorage.getItem(PERF_KEY) === '1'; } catch { return false; }
}

const KEEP = 60; // 최근 60장(약 2초)으로 평균·최대를 낸다
const BUDGET_MS = 33;

export function createPerfMeter({ info = () => ({}) } = {}) {
  const track = [], paint = [], at = [];
  const box = document.createElement('div');
  box.className = 'perf-meter';
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:fixed;left:12px;top:12px;z-index:99999;pointer-events:none;'
    + 'background:rgba(0,0,0,.78);color:#fff;font:600 15px/1.45 ui-monospace,Menlo,Consolas,monospace;'
    + 'padding:10px 14px;border-radius:10px;white-space:pre;';
  box.textContent = '시간 재는 중…';
  document.body.append(box);

  // ---- 터치·메인 스레드·화면 갱신 (2026-11-28 '해상도를 올리면 터치가 아예 안 됨' 원인 재기) ----
  // 위의 '색 칠하기'는 그리기 명령을 넣는 시간뿐이라 JPEG 풀기·GPU 올리기·메모리 정리(GC)로 막히는 건 안 보인다. 그래서 따로 잰다:
  //  - 터치: 최근 2초에 페이지가 받은 터치 수와, 손가락이 닿은 때(e.timeStamp)부터 페이지가 받은 때까지 걸린 시간
  //    (0회인데 눌렀다 = 페이지까지 안 온다(브라우저·GPU 쪽), 지연이 크다 = 메인 스레드가 막혀 있다)
  //  - 메인 막힘: 최근 2초 동안 50ms 넘게 메인 스레드를 잡은 일(long task)의 합과 가장 긴 것
  //  - 화면 갱신: 1초에 화면을 몇 번 새로 그렸나 (60 근처가 정상, 낮으면 GPU·합성이 밀린다)
  const touches = []; // { at, delay }
  const onTouch = (e) => { const now = performance.now(); touches.push({ at: now, delay: Math.max(0, now - e.timeStamp) }); };
  addEventListener('pointerdown', onTouch, { capture: true, passive: true });
  const longs = []; // { at, dur }
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) longs.push({ at: e.startTime + e.duration, dur: e.duration }); })
      .observe({ type: 'longtask', buffered: false });
  } catch { /* long task 미지원 */ }
  const rafs = [];
  const tick = (t) => { rafs.push(t); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const recent = (arr, ms, now) => { while (arr.length && now - (arr[0].at ?? arr[0]) > ms) arr.shift(); return arr; };

  const push = (arr, v) => { arr.push(v); if (arr.length > KEEP) arr.shift(); };
  const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  const max = (a) => (a.length ? Math.max(...a) : 0);
  const ms = (v) => v.toFixed(1).padStart(5) + 'ms';

  function show() {
    const now = performance.now();
    const fps = at.filter((t) => now - t <= 1000).length;
    const total = track.map((v, i) => v + (paint[i] || 0));
    const i = info();
    // 입술 찾기를 워커에서 하면(2026-11-28) 화면(터치)을 막는 건 색 칠하기뿐이다
    const inWorker = /워커/.test(i.delegate || '');
    const block = inWorker ? paint : total;
    const over = block.filter((v) => v > BUDGET_MS).length;
    const tc = recent(touches, 2000, now), lt = recent(longs, 2000, now), rf = recent(rafs, 1000, now);
    const tDelay = tc.map((x) => x.delay), lDur = lt.map((x) => x.dur);
    const sum = (a) => a.reduce((s, v) => s + v, 0);
    box.textContent = [
      `입술 찾기  평균${ms(avg(track))}  최대${ms(max(track))}${i.delegate ? `  (${i.delegate})` : ''}`,
      `색 칠하기  평균${ms(avg(paint))}  최대${ms(max(paint))}`,
      inWorker ? `화면 막힘  평균${ms(avg(paint))}  최대${ms(max(paint))}  (입술 찾기는 따로)` : `합계       평균${ms(avg(total))}  최대${ms(max(total))}`,
      `초당 장수  ${fps}장   33ms 넘은 장 ${over}/${block.length}`,
      i.size ? `영상 크기  ${i.size}` : '',
      `터치       ${String(tc.length).padStart(2)}회  지연 평균${ms(avg(tDelay))}  최대${ms(max(tDelay))}  (최근 2초)`,
      `메인 막힘  합계${ms(sum(lDur))}  가장 긴 것${ms(max(lDur))}  (최근 2초, 50ms 넘은 일)`,
      `화면 갱신  ${rf.length}번/초`,
    ].filter(Boolean).join('\n');
  }
  setInterval(show, 500);

  return {
    /** 웹캠 한 장 처리 기록 (trackMs: 입술 찾기, paintMs: 그리기·색 칠하기) */
    frame(trackMs, paintMs) {
      push(track, trackMs);
      push(paint, paintMs);
      push(at, performance.now());
    },
  };
}
