// 팔레트 물감·섞는 칸 (팔레트 탭 palette.js)
//  - 물감을 누르면 한 방울이 섞는 칸 가운데에 바로 떨어진다 (날아가는 모션·끌어다 놓기는 2026-11-11 삭제)
//  - 가운데에서 물감이 동그랗게 퍼지고 파문(물결 고리)이 번지면서 바탕색이 새 혼합색으로 천천히 바뀐다 (Ripple Effect, 2026-11-11)
//  - 방울 수 제한 없음 (2026-11-11, 예전 최대 40방울)
//  - 섞는 칸을 드래그하면 저은 방향으로 줄무늬가 생긴다
//  - 혼합색은 방울 수를 가중치로 OKLab 공간에서 평균한다 (사람 눈에 고르게 섞여 보이는 공간)
//  - 섞는 칸 색이 바뀌는 동안 onColor(hex) 로 계속 알려 준다 (입술에 바로 입히기). 다 비우면 onColor(null)
// 물감·섞는 칸·조제한 색은 실제 색이다 (CLAUDE.md 예외)
import { el, store } from './common.js';
import { hexToRgb, rgbToHex } from '../lib/color.js';
import { PRESETS } from './lip-engine.js'; // 립 컬러 매핑 탭에서 고를 수 있는 색
import { t as tr } from './i18n.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// 물감 = 립 컬러 매핑 탭에서 고를 수 있는 컬러 (이름 대신 색상값)
export const ALL_PAINTS = PRESETS.map((hex, i) => ({ key: 'lip' + i, name: hex, hex, lip: true }));
export const PAINT = Object.fromEntries(ALL_PAINTS.map((p) => [p.key, p]));

// ---------- 색 공간 (OKLab) ----------
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055);
function hexToOk(hex) {
  const { r, g, b } = hexToRgb(hex);
  const R = toLin(r / 255);
  const G = toLin(g / 255);
  const B = toLin(b / 255);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function okToHex([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const ch = (v) => Math.round(Math.min(1, Math.max(0, toSrgb(v))) * 255);
  return rgbToHex({
    r: ch(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: ch(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: ch(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  });
}
const lerp = (a, b, t) => a + (b - a) * t;
const lerpOk = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t)];

function mixOf(drops) {
  if (!drops.length) return null;
  const sum = [0, 0, 0];
  for (const k of drops) {
    const o = hexToOk(PAINT[k].hex);
    sum[0] += o[0]; sum[1] += o[1]; sum[2] += o[2];
  }
  return sum.map((v) => v / drops.length);
}

/**
 * 팔레트 하나 만들기
 * @param {object} o
 * @param {HTMLElement} o.paintsEl 물감 버튼을 넣을 칸
 * @param {HTMLCanvasElement} o.canvas 섞는 칸
 * @param {(hex: string|null) => void} [o.onColor] 섞는 칸 색이 바뀌는 동안 계속 (다 비우면 null)
 * @param {() => void} [o.onChange] 방울을 넣거나 빼거나 비웠을 때 (버튼 상태 등을 다시 그릴 때)
 * @param {string} [o.storeKey] 섞은 방울을 저장할 이름 (sessionStorage took.<이름>)
 * @param {string} [o.plate] 섞는 접시 색 (기본: 옅은 회색, 다크 모드면 어두운 회색)
 */
export function createMixer({ paintsEl, canvas, onColor = () => {}, onChange = () => {}, storeKey = 'paletteDrops', plate }) {
  let drops = (store.get(storeKey, []) || []).filter((k) => PAINT[k]);
  let mixOk = mixOf(drops);
  let shownOk = mixOk; // 화면에 보이는 바탕색 (새 혼합색으로 천천히 따라간다)
  let shownPr = 0; // 화면에 보이는 웅덩이 반지름 (목표 크기로 부드럽게 따라간다. 첫 방울은 0에서 자란다)
  let lastT = 0;
  let grow = null; // 첫 방울이 퍼지는 중이면 { t0 }

  // ---------- 물감 ----------
  const paintButton = (p) => el('button', {
    type: 'button', class: 'paint' + (p.lip ? ' paint-lip' : ''), 'data-key': p.key, title: p.name,
    'aria-label': tr('pal.dropAria', { name: p.name }),
  }, el('span', { class: 'paint-blob', style: `--c:${p.hex}` }), p.lip ? null : el('span', { class: 'paint-name', text: p.name }));
  const paintBtns = ALL_PAINTS.map(paintButton);
  paintsEl.replaceChildren(...paintBtns);

  // ---------- 섞는 칸 캔버스 ----------
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let CX = 0;
  let CY = 0;
  let R = 0; // 섞는 칸 반지름
  const particles = []; // 퍼지는 물감 줄무늬
  const ripples = []; // 떨어진 자리에서 번지는 파문 { x, y, rgb, t0 }
  let blend = null; // { from, to, t0 } 바탕색 전환
  let lastLipSend = 0;

  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    CX = W / 2;
    CY = H / 2;
    R = Math.min(W, H) / 2 - 10;
  }

  // 물감 웅덩이 크기: 방울이 많을수록 칸을 더 채운다
  const puddleR = () => R * (0.42 + 0.5 * Math.min(1, drops.length / 12));

  // 바탕색 전환: 섞는 칸 색이 새 혼합색으로 바뀌는 동안 입술 색도 같이 따라간다
  function stepBlend() {
    if (!blend) return;
    const k = Math.min(1, (performance.now() - blend.t0) / 1500);
    const e = 1 - (1 - k) ** 3;
    shownOk = blend.from ? lerpOk(blend.from, blend.to, e) : blend.to;
    const now = performance.now();
    if (k >= 1 || now - lastLipSend > 90) {
      lastLipSend = now;
      onColor(okToHex(k >= 1 ? blend.to : shownOk));
    }
    if (k >= 1) blend = null;
  }

  function frame(t) {
    requestAnimationFrame(frame); // 그리다가 오류가 나도 다음 프레임은 이어진다
    stepBlend();
    // 웅덩이 크기: 첫 방울은 가운데에서 동그랗게 자라고, 방울이 늘면 조금씩 커진다 (빠르게 시작해 천천히 멈춤)
    const target = shownOk ? puddleR() : 0;
    const dt = Math.min(64, lastT ? t - lastT : 16);
    lastT = t;
    if (grow && !reduce) {
      // 첫 방울: 가운데에 닿자마자 넓게 퍼지고, 가장자리가 살짝 넘쳤다가 제자리에 멈춘다 (액체처럼)
      const k = Math.min(1, (t - grow.t0) / 700);
      const c = 0.9;
      const back = 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2;
      shownPr = target * Math.max(0, back);
      if (k >= 1) grow = null;
    } else {
      shownPr = reduce ? target : shownPr + (target - shownPr) * (1 - Math.exp(-dt / 150));
    }
    if (R > 4) draw(t); // 팔레트가 숨겨져 크기가 0이면 그리지 않는다
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    // 팔레트 칸: 그림자 없이 접시 하나 (그림자는 캔버스 끝에서 네모로 잘려 보였다)
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.fillStyle = plate ?? (document.documentElement.dataset.theme === 'dark' ? '#1c1c1c' : '#f0f0f0'); // 다크 모드면 어두운 접시
    ctx.fill();

    if (shownOk) {
      // 물감 웅덩이: 깔끔한 원 (출렁임은 2026-11-11 뺐다)
      const pr = shownPr;
      ctx.beginPath();
      ctx.arc(CX, CY, Math.max(0.5, pr), 0, Math.PI * 2);
      ctx.fillStyle = okToHex(shownOk);
      ctx.fill();
      ctx.save();
      ctx.clip();

      // 저은 결: 가운데를 도는 소용돌이 + 저은 힘
      ctx.lineCap = 'round';
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const dx = p.x - CX;
        const dy = p.y - CY;
        const dist = Math.hypot(dx, dy) || 1;
        const swirl = 0.9 + 26 / (dist + 20);
        p.vx += (-dy / dist) * swirl * 0.16;
        p.vy += (dx / dist) * swirl * 0.16;
        if (dist > pr - 6) { p.vx -= (dx / dist) * 0.6; p.vy -= (dy / dist) * 0.6; }
        p.vx *= 0.965;
        p.vy *= 0.965;
        p.x += p.vx; p.y += p.vy;
        // 지나온 자리를 꼬리로 남겨 마블 줄무늬처럼 그린다
        p.trail.push([p.x, p.y]);
        if (p.trail.length > 14) p.trail.shift();
        p.life -= p.decay;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(1, p.life * 1.3) * 0.8;
        ctx.strokeStyle = p.hex;
        ctx.lineWidth = p.w * (0.35 + p.life * 0.65);
        ctx.beginPath();
        ctx.moveTo(p.trail[0][0], p.trail[0][1]);
        for (let j = 1; j < p.trail.length; j++) ctx.lineTo(p.trail[j][0], p.trail[j][1]);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      drawRipples(pr);
      // 납작한 물감 웅덩이처럼 (2026-11-11): 예전 동그란 흰 반사광은 공처럼 보여서 뺐다
      // 가장자리 안쪽만 살짝 어둡게(물감 두께) + 왼쪽 위 가장자리를 따라 얇은 빛
      if (pr > 4) {
        const rim = ctx.createRadialGradient(CX, CY, pr * 0.72, CX, CY, pr);
        rim.addColorStop(0, 'rgba(0,0,0,0)');
        rim.addColorStop(1, 'rgba(0,0,0,0.14)');
        ctx.fillStyle = rim;
        ctx.fillRect(CX - pr, CY - pr, pr * 2, pr * 2);
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1.5, pr * 0.05);
        ctx.strokeStyle = 'rgba(255,255,255,0.32)';
        ctx.beginPath();
        ctx.arc(CX, CY, pr * 0.84, Math.PI * 1.08, Math.PI * 1.38);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  // 파문 (단정하게, 2026-11-11): 가운데에서 물감이 한 번 부드럽게 퍼져 바탕에 녹아들고, 얇은 고리 하나가 같이 번진다
  const RIPPLE_MS = 1400;
  function drawRipples(pr) {
    const now = performance.now();
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      const k = (now - rp.t0) / RIPPLE_MS;
      if (k >= 1) { ripples.splice(i, 1); continue; }
      const [r, g, b] = rp.rgb;
      const e = 1 - (1 - k) ** 3; // 처음엔 빠르게, 끝으로 갈수록 천천히
      const rad = Math.max(1, e * pr);
      // 퍼지는 물감: 가장자리만 살짝 흐리게, 퍼질수록 옅어진다
      const a = (1 - k) * 0.85;
      const fill = ctx.createRadialGradient(rp.x, rp.y, 0, rp.x, rp.y, rad);
      fill.addColorStop(0, `rgba(${r},${g},${b},${a})`);
      fill.addColorStop(0.85, `rgba(${r},${g},${b},${a})`);
      fill.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rad, 0, Math.PI * 2);
      ctx.fill();
      // 고리 하나: 물감 가장자리를 따라 얇게
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (ripples.length > 6) ripples.splice(0, ripples.length - 6); // 연달아 많이 떨어뜨려도 가볍게
  }

  const save = () => store.set(storeKey, drops);

  // ---------- 방울 떨어뜨리기 ----------
  function dropAt(key, x, y) {
    const before = mixOk;
    drops.push(key);
    mixOk = mixOf(drops);
    blend = { from: shownOk || mixOk, to: mixOk, t0: performance.now() };
    if (!before) { shownOk = hexToOk(PAINT[key].hex); shownPr = 0; grow = { t0: performance.now() }; } // 첫 방울: 웅덩이가 자라는 것 자체가 애니메이션 (파문 없음)
    if (!reduce && before) {
      const { r, g, b } = hexToRgb(PAINT[key].hex);
      ripples.push({ x, y, rgb: [r, g, b], t0: performance.now() });
    }
    save();
    onChange();
  }

  // 물감을 누르면 날아가는 모션 없이 섞는 칸 가운데에 바로 떨어져 파문이 퍼진다 (2026-11-11)
  // fly 는 밖(palette.js 추천 컬러)에서 부르는 이름이라 남겨 둔다
  const fly = (key) => dropAt(key, CX, CY);
  for (const btn of paintBtns) btn.addEventListener('click', () => fly(btn.dataset.key));

  // ---------- 젓기 ----------
  let stir = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!mixOk) return;
    canvas.setPointerCapture(e.pointerId);
    const c = canvas.getBoundingClientRect();
    stir = { x: e.clientX - c.left, y: e.clientY - c.top };
    canvas.classList.add('stirring');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!stir) return;
    const c = canvas.getBoundingClientRect();
    const x = e.clientX - c.left;
    const y = e.clientY - c.top;
    const vx = x - stir.x;
    const vy = y - stir.y;
    // 저은 자리 주변 줄무늬를 그 방향으로 민다
    for (const p of particles) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < 50) { p.vx += vx * 0.12 * (1 - d / 50); p.vy += vy * 0.12 * (1 - d / 50); }
    }
    if (Math.hypot(x - CX, y - CY) < puddleR() && Math.hypot(vx, vy) > 2) {
      // 저으면 바탕색보다 조금 밝고 어두운 결이 생긴다
      const [L, a, b] = mixOk;
      const shade = okToHex([Math.min(1, L + (Math.random() > 0.5 ? 0.08 : -0.08)), a, b]);
      particles.push({ x, y, trail: [[stir.x, stir.y], [x, y]], vx: vx * 0.4, vy: vy * 0.4, hex: shade, life: 1, decay: 0.012, w: 5 });
    }
    stir = { x, y };
  });
  const endStir = () => { stir = null; canvas.classList.remove('stirring'); };
  canvas.addEventListener('pointerup', endStir);
  canvas.addEventListener('pointercancel', endStir);

  // ---------- 밖에서 쓰는 동작 ----------
  /** 한 방울 빼기. 다 비면 onColor(null) */
  function undo() {
    drops.pop();
    const before = shownOk;
    mixOk = mixOf(drops);
    blend = mixOk ? { from: before, to: mixOk, t0: performance.now() } : null;
    if (!mixOk) {
      shownOk = null;
      particles.length = 0;
      ripples.length = 0;
      onColor(null);
    }
    save();
    onChange();
  }
  /** 처음부터 다시: 비우고 onColor(null) */
  function reset() {
    drops = [];
    mixOk = null;
    shownOk = null;
    blend = null;
    particles.length = 0;
    ripples.length = 0;
    save();
    onChange();
    onColor(null);
  }
  /** 다시 열었을 때 섞어 둔 색을 바로 알리고 그리기 시작 */
  function start() {
    resize();
    // 화면 배치에 따라 섞는 칸 크기가 바뀌면(추천 목록이 열릴 때 등) 캔버스 해상도를 다시 맞춘다
    new ResizeObserver(resize).observe(canvas);
    if (mixOk) {
      shownOk = mixOk;
      shownPr = puddleR(); // 다시 열면 자라는 애니메이션 없이 바로
      onColor(okToHex(mixOk)); // 다시 열면 섞어 둔 색을 입술에 바로 입힌다
    }
    onChange();
    requestAnimationFrame(frame);
  }

  return {
    paintBtns,
    fly,
    undo,
    reset,
    start,
    /** 지금 조제한 색 (없으면 null) */
    hex: () => (mixOk ? okToHex(mixOk) : null),
    /** 넣은 방울 수 */
    count: () => drops.length,
  };
}
