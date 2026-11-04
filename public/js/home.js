// 홈 화면 인터랙션 (옛 툭ver2 대기 화면 구성, 무채색)
//  1) 인트로: 가운데에 큰 took. (화면을 터치할 때까지 대기) → took 의 두 o 가 각자 홈의 두 동그라미 한가운데로 톡 떨어지고,
//     닿은 자리에서 홈 동그라미가 o 크기부터 원래 크기로 퍼진다. 남은 t·k·온점은 상단 로고 자리로 → 제목·버튼이 차례로
//  2) 팔레트 쪽 예시 그림의 입술 색이 1초마다 톡톡 튀며 바뀌고, 챗봇 쪽 예시 대화는 질문이 타이핑된다
//  3) 배경: 커서를 피해 밀려나고 진해지는 회색 점 격자, 누르면 물결이 퍼진다
// 동작 줄이기 설정이면 인트로·배경 움직임 없이 바로 보여 준다. 화면 클릭·키 입력으로 인트로를 건너뛸 수 있다.
import { t, tList, languageMenu } from './i18n.js';

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
root.dataset.homeReady = '1'; // index.html 의 안전장치(스크립트가 안 돌면 숨김 해제)에 알린다

const home = document.getElementById('home');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const replay = (node) => { node.classList.remove('pop'); void node.getBoundingClientRect(); node.classList.add('pop'); };

// ---------- 예시 입술: 실제 립 색으로 톡톡 바뀐다 (무채색 규칙의 예외, CLAUDE.md) ----------
const DEMO = ['#E0115F', '#FF6F61', '#C0646A', '#B8457A', '#D2321E', '#FF7FA5', '#A0202C', '#E06090', '#D9734E', '#9B2D5C'];
let demoI = 0;
let ready = false; // 인트로가 끝났는지
setInterval(() => {
  if (!ready || reduce) return;
  demoI = (demoI + 1) % DEMO.length;
  home.style.setProperty('--lip', DEMO[demoI]);
  replay(document.getElementById('demo-lips'));
  replay(document.getElementById('sparks'));
}, 1000);

// ---------- 예시 대화: 챗봇 첫 화면의 추천 질문이 한 글자씩 타이핑된다 ----------
const QUESTIONS = tList('home.questions'); // 화면 언어에 맞춘 예시 질문 (i18n.js)
const demoText = document.getElementById('chat-demo-text');
demoText.textContent = QUESTIONS[0];
let qi = 0;
async function typeLoop() {
  for (;;) {
    await wait(2600);
    if (!ready) continue;
    qi = (qi + 1) % QUESTIONS.length;
    const q = QUESTIONS[qi];
    for (let n = 1; n <= q.length; n++) {
      demoText.textContent = q.slice(0, n);
      await wait(70);
    }
  }
}
if (!reduce) typeLoop();

// ---------- 인트로 ----------
const anims = [];
let introBox = null;
function finishIntro() {
  if (ready) return;
  ready = true;
  root.classList.add('intro-go'); // 상단 메뉴가 내려온다 (CSS)
  cleanupIntro();
  setTimeout(() => root.classList.remove('intro', 'intro-go', 'intro-nav'), 1200);
  removeEventListener('pointerdown', skip, true);
  removeEventListener('keydown', skip, true);
}
// 끝까지 봤으면 마지막 모습 그대로, 건너뛰었으면 바로 제자리로
function cleanupIntro() {
  for (const an of anims.splice(0)) an.cancel();
  introBox?.remove();
  introBox = null;
}
const skip = () => finishIntro();

const run =(node, frames, opts) => {
  const an = node.animate(frames, { fill: 'both', ...opts });
  anims.push(an);
  return an.finished;
};
// 대기 화면: 큰 took. 아래에 터치 표시가 깜빡이고, 화면 아무 곳이나 누르면(키보드도) 이어서 움직인다.
// 기다리는 동안은 인트로 막이 화면을 덮어, 아직 안 보이는 두 동그라미가 눌려 다른 화면으로 넘어가지 않게 한다
function waitForTouch() {
  return new Promise((resolve) => {
    const hint = document.createElement('span');
    hint.className = 'intro-touch';
    hint.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.2a5 5 0 0 1-4-2L4.6 15.6a1.5 1.5 0 0 1 2.3-1.9L9 16"/></svg>';
    // 시작 전에 언어부터 고를 수 있게 오른쪽 위에 언어 메뉴 (고르면 같은 대기 화면이 그 언어로 다시 열린다)
    const langWrap = document.createElement('div');
    langWrap.className = 'intro-lang';
    langWrap.append(languageMenu({ skipIntro: false }));
    introBox.append(hint, langWrap);
    introBox.classList.add('waiting');
    introBox.setAttribute('aria-label', t('home.touch'));
    introBox.removeAttribute('aria-hidden');
    const go = (e) => {
      // 언어 메뉴를 누르거나 메뉴 안에서 키를 누르면 시작하지 않고 메뉴가 받는다
      if (e.target?.closest?.('.intro-lang') || langWrap.contains(document.activeElement)) return;
      e.preventDefault();
      e.stopPropagation();
      langWrap.remove();
      introBox.removeEventListener('pointerdown', go);
      removeEventListener('keydown', go, true);
      introBox.classList.remove('waiting');
      introBox.setAttribute('aria-hidden', 'true');
      hint.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      resolve();
    };
    introBox.addEventListener('pointerdown', go);
    addEventListener('keydown', go, true);
  });
}

// 글자 o 의 고리(잉크가 칠해진 부분)의 화면 위 중심과 지름. 글자 상자는 위아래 여백이 있어 상자 가운데 ≠ 고리 가운데라 글꼴 값으로 잰다
function glyphRing(node) {
  const box = node.getBoundingClientRect();
  const cs = getComputedStyle(node);
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = cs.font;
  const m = ctx.measureText(node.textContent);
  // 줄 높이 안에서 글꼴 내용 영역은 가운데에 놓이고, 그 안에서 기준선은 글꼴 ascent 만큼 아래에 있다
  const lineH = parseFloat(cs.lineHeight) || box.height;
  const baseline = box.top + (lineH - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
  const left = box.left - m.actualBoundingBoxLeft;
  const d = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  return {
    box,
    cx: left + (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 + m.actualBoundingBoxLeft,
    cy: baseline - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2,
    d: Math.max(d, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent),
  };
}

async function playIntro() {
  if (ready) return;
  const nav = document.querySelector('header.nav');
  const logo = document.getElementById('nav-reset');
  const mirrors = [...home.querySelectorAll('.tap .mirror')];
  const fades = [home.querySelector('.at-hero'), ...home.querySelectorAll('.tap-label'), ...home.querySelectorAll('.orbit')];
  introBox = document.createElement('div');
  introBox.className = 'intro-logo';
  introBox.setAttribute('aria-hidden', 'true');
  // 글자를 하나씩 나눠 둔다: 두 o 는 홈의 두 원이 되고, t·k·온점은 상단 로고 자리로 간다
  introBox.innerHTML = '<span class="in"><span class="w"><span class="ch">t</span><span class="ch o">o</span><span class="ch o">o</span><span class="ch">k</span></span><span class="d"></span></span>';
  document.body.append(introBox);
  const word = introBox.querySelector('.w');
  const dot = introBox.querySelector('.d');
  const os = [...word.querySelectorAll('.o')];
  const rest = [...word.querySelectorAll('.ch:not(.o)'), dot];

  // 1) 가운데에 크게 등장하고, 손님이 화면을 터치할 때까지 기다린다 (키오스크 대기 화면)
  await run(introBox.firstElementChild, [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)' });
  await waitForTouch();
  if (ready) return;
  // 터치한 뒤부터는 다시 누르면 남은 인트로를 건너뛴다
  addEventListener('pointerdown', skip, true);
  addEventListener('keydown', skip, true);
  // 2) took 의 두 o 가 각자 홈의 두 원 한가운데로 톡 떨어지고, 그 자리에서 홈 원이 o 크기부터 퍼져 나온다.
  //    남은 t·k·온점은 상단 로고의 같은 글자 자리로 천천히 줄어들어 로고와 겹친다.
  //    메뉴는 위로 숨어 있으므로 내려온 뒤의 자리(메뉴 높이만큼 아래)를 겨눈다
  const SMOOTH = 'cubic-bezier(.65,0,.35,1)'; // 천천히 출발해 천천히 멈춘다
  const range = document.createRange();
  range.setStart(logo.firstChild, 0);
  range.setEnd(logo.firstChild, 4);
  const r = range.getBoundingClientRect();
  const hiddenBy = nav.getBoundingClientRect().top < 0 ? nav.offsetHeight : 0;
  const to = { left: r.left, top: r.top + hiddenBy, height: r.height };
  root.classList.add('intro-nav'); // 메뉴(로고 빼고)가 함께 내려온다
  const from = word.getBoundingClientRect();
  const k = to.height / from.height;
  const at = (x, y, s = 1) => `translate(${x}px, ${y}px) scale(${s})`;
  // t·k·온점: 단어 전체가 로고 자리로 줄어드는 것과 같은 위치로 (글자마다 단어 안의 자리를 유지), 가면서 옅어진다
  const moveRest = rest.map((node) => {
    const c = node.getBoundingClientRect();
    const tx = to.left + (c.left - from.left) * k - c.left;
    const ty = to.top + (c.top - from.top) * k - c.top;
    return run(node, [{ transform: 'none', opacity: 1 }, { transform: at(tx, ty, k), opacity: 0.85, offset: 0.8 }, { transform: at(tx, ty, k), opacity: 0 }],
      { duration: 1100, delay: 150, easing: SMOOTH });
  });
  // 로고는 글자가 거의 도착할 때 같은 자리에서 스르르
  run(logo, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 1000, easing: 'ease-out' });
  // 두 o: 조금 들렸다가 → 중력처럼 점점 빨라지며 원 한가운데로 톡 떨어진다 (크기는 글자 그대로, 색은 원 색으로 옅어진다).
  //       닿으면 그 자리에서 '진짜 홈 원'이 o 고리 크기에서 원래 크기로 퍼진다. 끝 모습이 홈 원 그 자체라 크기·굵기·테두리가 똑같다
  const DROP = 950; // 떨어지는 시간
  const SPREAD = 750; // 퍼지는 시간
  const drops = os.map((node, i) => {
    const ring = glyphRing(node); // 글자 o 고리의 실제 중심·지름 (글꼴 측정값)
    const m = mirrors[i].getBoundingClientRect();
    const x = m.left + m.width / 2 - ring.cx;
    const y = m.top + m.height / 2 - ring.cy;
    node.style.transformOrigin = `${ring.cx - ring.box.left}px ${ring.cy - ring.box.top}px`; // 고리 중심을 기준으로 움직인다
    const ink = getComputedStyle(node).color;
    const fall = run(node, [
      { transform: at(0, 0), color: ink, easing: 'cubic-bezier(.2,.6,.4,1)' },
      { transform: at(x * 0.1, -40), color: ink, offset: 0.24, easing: 'cubic-bezier(.55,0,.9,.45)' }, // 들림 → 떨어지기 시작
      { transform: at(x, y), color: '#d9d9d9' },
    ], { duration: DROP, delay: i * 120 });
    return fall.then(() => {
      // 닿는 순간 o 는 금방 사라지고, 같은 자리·같은 크기에서 홈 원이 퍼진다 (넘치지 않고 정확히 원래 크기에서 멈춘다)
      run(node, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out' });
      const s0 = ring.d / m.width;
      return run(mirrors[i], [
        { opacity: 0.9, transform: `scale(${s0})` },
        { opacity: 1, transform: 'scale(1)' },
      ], { duration: SPREAD, easing: 'cubic-bezier(.16,1,.3,1)' }).then(() =>
        // 원 안의 그림·예시 대화는 원이 다 퍼진 뒤에 스르르
        Promise.all([...mirrors[i].children].map((c) => run(c, [{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease-out' }))));
    });
  });
  // 원이 퍼지는 동안 원 안의 그림은 숨겨 둔다
  for (const m of mirrors) for (const c of m.children) run(c, [{ opacity: 0 }, { opacity: 0 }], { duration: DROP + SPREAD + 300 });
  await Promise.all([...moveRest, ...drops]);
  if (ready) return;
  replay(document.getElementById('sparks'));
  // 4) 제목·버튼·둘레 점: 아주 조금만 올라오며 천천히 차례로
  await Promise.all(fades.map((node, i) => run(node, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
    { duration: 650, delay: i * 70, easing: 'ease-out' })));
}

if (reduce || !root.classList.contains('motion')) {
  root.classList.remove('intro', 'motion');
  ready = true;
} else {
  scrollTo(0, 0);
  // 건너뛰기는 대기 화면을 터치한 뒤부터 켠다 (playIntro)
  // 상단 메뉴가 그려진 뒤(다음 프레임)에 자리를 재야 글자·온점이 맞게 떨어진다
  // 건너뛰면 애니메이션이 취소되며 finished 가 거절되므로 그 오류는 무시한다
  requestAnimationFrame(() => playIntro().catch(() => {}).finally(() => { finishIntro(); cleanupIntro(); }));
}

// ---------- 커서 위치 ----------
const pointer = { x: -9999, y: -9999, active: false };
addEventListener('pointermove', (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.active = true;
}, { passive: true });
document.addEventListener('pointerleave', () => { pointer.active = false; });
addEventListener('blur', () => { pointer.active = false; });

// ---------- 배경 점 격자 ----------
const canvas = document.createElement('canvas');
canvas.className = 'home-bg';
canvas.setAttribute('aria-hidden', 'true');
document.body.prepend(canvas);
const ctx = canvas.getContext('2d');
const GAP = 30;
const RANGE = 170; // 커서가 점을 밀어내는 거리
let W = 0;
let H = 0;
let dots = [];
const ripples = [];

function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth;
  H = innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dots = [];
  for (let y = GAP / 2; y < H + GAP; y += GAP) {
    for (let x = GAP / 2; x < W + GAP; x += GAP) dots.push({ x, y, ox: 0, oy: 0, f: 0 });
  }
  if (reduce) draw(0);
}

function draw(t) {
  ctx.clearRect(0, 0, W, H);
  const now = performance.now();
  for (let i = ripples.length - 1; i >= 0; i--) if (now - ripples[i].t0 > 1400) ripples.splice(i, 1);
  for (const d of dots) {
    let tx = 0;
    let ty = 0;
    let f = 0;
    if (pointer.active) {
      const dx = d.x - pointer.x;
      const dy = d.y - pointer.y;
      const dist = Math.hypot(dx, dy) || 1;
      const k = Math.max(0, 1 - dist / RANGE);
      f = k * k;
      tx += (dx / dist) * f * 26;
      ty += (dy / dist) * f * 26;
    }
    for (const r of ripples) {
      const age = now - r.t0;
      const dx = d.x - r.x;
      const dy = d.y - r.y;
      const dist = Math.hypot(dx, dy) || 1;
      const band = Math.exp(-(((dist - age * 0.75) / 34) ** 2)) * (1 - age / 1400);
      tx += (dx / dist) * band * 16;
      ty += (dy / dist) * band * 16;
      f = Math.max(f, band * 0.8);
    }
    // 커서가 없을 때는 아주 옅은 물결이 천천히 지나간다
    const idle = reduce ? 0 : (Math.sin(t / 1100 + d.x / 160 + d.y / 230) + 1) / 2;
    d.ox += (tx - d.ox) * 0.14;
    d.oy += (ty - d.oy) * 0.14;
    d.f += (f - d.f) * 0.18;
    const g = Math.round(208 - d.f * 180 - idle * 14);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.beginPath();
    ctx.arc(d.x + d.ox, d.y + d.oy, 1.1 + d.f * 2.4 + idle * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

resize();
addEventListener('resize', resize);
addEventListener('pointerdown', (e) => {
  if (!reduce) ripples.push({ x: e.clientX, y: e.clientY, t0: performance.now() });
});
if (!reduce) {
  const loop = (t) => {
    draw(t);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
