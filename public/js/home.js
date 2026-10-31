// 홈 화면 인터랙션
//  1) 인트로: 처음에는 가운데에 제목만 크게 → 글자가 하나씩 튀어 오른 뒤 제자리로 → 나머지가 여러 방향에서 날아든다
//  2) 배경: 커서를 피해 밀려나고 진해지는 회색 점 격자, 누르면 물결이 퍼진다
//  3) 제목 글자는 커서가 가까우면 들썩이고, 버튼은 커서 쪽으로 끌려오고, 기능 카드는 커서 방향으로 기운다
//  4) 아래 영역은 스크롤해서 보일 때 나타난다
// 동작 줄이기 설정이면 인트로·배경 움직임 없이 바로 보여 준다. 화면 클릭·키 입력으로 인트로를 건너뛸 수 있다.
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
root.dataset.homeReady = '1'; // index.html 의 안전장치(스크립트가 안 돌면 숨김 해제)에 알린다

const hero = document.querySelector('.hero');
const title = hero.querySelector('h1');

// ---------- 제목 글자 나누기 ----------
const text = title.textContent.trim();
title.setAttribute('aria-label', text);
const letters = [...text].map((ch, k) => {
  const s = document.createElement('span');
  s.className = 'ch';
  s.textContent = ch;
  s.setAttribute('aria-hidden', 'true');
  s.style.setProperty('--k', String(k));
  return s;
});
title.replaceChildren(...letters);

// ---------- 등장 대상 ----------
const reveal = [];
function mark(elm, from, delay = 0) {
  if (!elm) return;
  elm.classList.add('rv');
  elm.dataset.from = from;
  elm.style.setProperty('--d', delay + 'ms');
  reveal.push(elm);
}
mark(hero.querySelector('.eyebrow'), 'left', 0);
mark(hero.querySelector('.hero-lead'), 'up', 120);
mark(hero.querySelector('.hero-actions'), 'up', 240);
document.querySelectorAll('.section-title').forEach((h) => mark(h, 'left', 0));
document.querySelectorAll('.home-menu .feature').forEach((f, i) => mark(f, i % 2 ? 'right' : 'left', 120 + i * 120));
document.querySelectorAll('.steps li').forEach((li, i) => mark(li, 'up', 100 + i * 110));
mark(document.querySelector('.recent'), 'up', 100);
mark(document.querySelector('.home-note'), 'up', 0);

let ready = false; // 인트로가 끝나야 등장을 시작한다
const waiting = new Set();
function show(elm) {
  if (elm.classList.contains('in')) return;
  elm.classList.add('in');
  // 다 나타난 뒤에는 등장용 전환을 떼어서 마우스 반응(카드 들림 등)이 늦지 않게 한다
  const delay = parseFloat(elm.style.getPropertyValue('--d')) || 0;
  setTimeout(() => {
    elm.classList.remove('rv', 'in');
    delete elm.dataset.from;
  }, delay + 950);
}
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    io.unobserve(e.target);
    if (ready) show(e.target); else waiting.add(e.target);
  }
}, { threshold: 0.12 });
reveal.forEach((r) => io.observe(r));

// ---------- 인트로 ----------
function placeTitleCenter() {
  const r = title.getBoundingClientRect();
  const scale = Math.min(2.4, (innerWidth * 0.72) / r.width);
  title.style.setProperty('--ix', innerWidth / 2 - (r.left + r.width / 2) + 'px');
  title.style.setProperty('--iy', innerHeight / 2 - (r.top + r.height / 2) + 'px');
  title.style.setProperty('--is', String(scale));
}
function finishIntro() {
  if (ready) return;
  ready = true;
  title.classList.add('split');
  root.classList.add('intro-go');
  waiting.forEach(show);
  waiting.clear();
  setTimeout(() => root.classList.remove('intro', 'intro-go'), 1200);
  removeEventListener('pointerdown', skip, true);
  removeEventListener('keydown', skip, true);
}
const skip = () => finishIntro();

if (reduce || !root.classList.contains('motion')) {
  root.classList.remove('intro', 'motion');
  ready = true;
  reveal.forEach((r) => r.classList.remove('rv'));
} else {
  scrollTo(0, 0);
  addEventListener('pointerdown', skip, true);
  addEventListener('keydown', skip, true);
  // 상단 메뉴가 그려진 뒤(다음 프레임)에 제목 자리를 재야 가운데가 맞는다
  requestAnimationFrame(() => {
    if (ready) return;
    placeTitleCenter();
    title.classList.add('split'); // 이때부터 글자가 튀어 오른다 (CSS)
    setTimeout(finishIntro, 150 + letters.length * 70 + 650);
  });
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

// ---------- 제목 글자 들썩임 · 자석 버튼 · 기울어지는 카드 ----------
if (finePointer && !reduce) {
  let raf = 0;
  addEventListener('pointermove', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!ready) return;
      for (const s of letters) {
        const r = s.getBoundingClientRect();
        const dist = Math.hypot(pointer.x - (r.left + r.width / 2), pointer.y - (r.top + r.height / 2));
        const k = Math.max(0, 1 - dist / 220);
        s.style.setProperty('--lift', (-k * k * 16).toFixed(1) + 'px');
      }
    });
  }, { passive: true });

  for (const btn of document.querySelectorAll('.hero-actions a')) {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      btn.style.translate = `${(dx * 0.22).toFixed(1)}px ${(dy * 0.32).toFixed(1)}px`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.translate = ''; });
  }

  for (const card of document.querySelectorAll('.home-menu .feature')) {
    card.addEventListener('pointermove', (e) => {
      if (card.classList.contains('rv')) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      card.style.transform = `perspective(900px) rotateX(${((0.5 - py) * 8).toFixed(2)}deg) rotateY(${((px - 0.5) * 10).toFixed(2)}deg) translateY(-4px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  }
}
