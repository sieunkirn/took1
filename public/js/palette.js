// 팔레트(테스트): 물감을 떨어뜨리고 저어서 립 색을 조제하는 화면.
//  - 물감을 누르면 한 방울이 포물선을 그리며 섞는 칸으로 날아가고, 끌어다 놓으면 놓은 자리에 떨어진다
//  - 떨어진 물감은 소용돌이 줄무늬로 퍼지면서 바탕색이 새 혼합색으로 천천히 바뀐다
//  - 섞는 칸을 드래그하면 저은 방향으로 줄무늬가 생긴다
//  - 혼합색은 방울 수를 가중치로 OKLab 공간에서 평균한다 (사람 눈에 고르게 섞여 보이는 공간)
//  - 섞는 칸 색이 바뀌는 동안 같은 색을 took:apply 이벤트로 보내 왼쪽 카메라 입술(lip.js)에 바로 입힌다
//  - 초기화: 팔레트를 비우고 입술 색을 기본 컬러로 되돌린다
import { renderNav, store, api, el, productCard, toast, skeletonCards, shortName, NFC_TEST_MENU } from './common.js';
import { listenNfc, resolveTag, resolveReading } from './nfc.js'; // 제품 NFC 태그 → 그 제품 색을 입술에
import { startWebNfc, webNfcSupport, makeDedupe } from './nfc-test.js'; // 휴대폰 NFC (Web NFC)
import { pairPhoneForNfc } from './nfc-relay.js'; // 휴대폰으로 읽고 이 화면에 띄우기
import { loadZXing } from './barcode-scan.js'; // QR 그리기
import { hexToRgb, rgbToHex } from '../lib/color.js';
import { PRESETS } from './lip-engine.js'; // 립 컬러 매핑 탭에서 고를 수 있는 색
import { t as tr } from './i18n.js'; // 화면 문구 (한국어/영어)

renderNav();

const $ = (id) => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// 물감 = 립 컬러 매핑 탭에서 고를 수 있는 컬러 (이름 대신 색상값)
const ALL_PAINTS = PRESETS.map((hex, i) => ({ key: 'lip' + i, name: hex, hex, lip: true }));
const PAINT = Object.fromEntries(ALL_PAINTS.map((p) => [p.key, p]));
const MAX_DROPS = 40;
const DEFAULT_LOOK = { hex: '#C08A94', finish: 'matte' }; // 립 컬러 매핑 기본 컬러

// 왼쪽 카메라 입술에 색을 입힌다 (quiet: 알림 없이)
function toLips(hex, { finish = null, quiet = true, source = '팔레트에서 조제한 색' } = {}) {
  window.dispatchEvent(new CustomEvent('took:apply', { detail: { hex, finish, quiet, source } }));
}

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

// ---------- 상태 ----------
let drops = (store.get('paletteDrops', []) || []).filter((k) => PAINT[k]).slice(0, MAX_DROPS);
let mixOk = mixOf(drops);
let shownOk = mixOk; // 화면에 보이는 바탕색 (새 혼합색으로 천천히 따라간다)

// ---------- 물감 ----------
const paintButton = (p) => el('button', {
  type: 'button', class: 'paint' + (p.lip ? ' paint-lip' : ''), 'data-key': p.key, title: p.name,
  'aria-label': tr('pal.dropAria', { name: p.name }),
}, el('span', { class: 'paint-blob', style: `--c:${p.hex}` }), p.lip ? null : el('span', { class: 'paint-name', text: p.name }));
const paintBtns = ALL_PAINTS.map(paintButton);
$('lip-paints').replaceChildren(...paintBtns);

// ---------- 섞는 칸 캔버스 ----------
const canvas = $('mix-canvas');
const ctx = canvas.getContext('2d');
let W = 0;
let H = 0;
let CX = 0;
let CY = 0;
let R = 0; // 섞는 칸 반지름
const particles = []; // 퍼지는 물감 줄무늬
const splashes = []; // 떨어질 때 퍼지는 고리
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

function addSwirl(x, y, hex, n, power = 1) {
  if (reduce) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (1.5 + Math.random() * 4) * power;
    const px = x + Math.cos(a) * Math.random() * 10;
    const py = y + Math.sin(a) * Math.random() * 10;
    particles.push({
      x: px, y: py, trail: [[px, py]],
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      hex, life: 1, decay: 0.005 + Math.random() * 0.008,
      w: 1.5 + Math.random() * 5,
    });
  }
  if (particles.length > 900) particles.splice(0, particles.length - 900);
}

// 바탕색 전환: 섞는 칸 색이 새 혼합색으로 바뀌는 동안 입술 색도 같이 따라간다
function stepBlend() {
  if (!blend) return;
  const k = Math.min(1, (performance.now() - blend.t0) / 1500);
  const e = 1 - (1 - k) ** 3;
  shownOk = blend.from ? lerpOk(blend.from, blend.to, e) : blend.to;
  const now = performance.now();
  if (k >= 1 || now - lastLipSend > 90) {
    lastLipSend = now;
    toLips(okToHex(k >= 1 ? blend.to : shownOk));
  }
  if (k >= 1) blend = null;
}

function frame(t) {
  requestAnimationFrame(frame); // 그리다가 오류가 나도 다음 프레임은 이어진다
  stepBlend();
  if (R > 4) draw(t); // 팔레트가 숨겨져 크기가 0이면 그리지 않는다
}

function draw(t) {
  ctx.clearRect(0, 0, W, H);
  // 팔레트 칸 (무채색): 그림자 없이 흰 판보다 한 단계 짙은 회색 접시 (그림자는 캔버스 끝에서 네모로 잘려 보였다)
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.fillStyle = '#f0f0f0';
  ctx.fill();

  if (shownOk) {
    // 물감 웅덩이: 가장자리가 살짝 출렁인다
    const pr = puddleR();
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const wob = reduce ? 0 : Math.sin(a * 3 + t / 700) * 2.2 + Math.sin(a * 5 - t / 900) * 1.4;
      const x = CX + Math.cos(a) * (pr + wob);
      const y = CY + Math.sin(a) * (pr + wob);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = okToHex(shownOk);
    ctx.fill();
    ctx.save();
    ctx.clip();

    // 줄무늬: 가운데를 도는 소용돌이 + 저은 힘
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
    // 윤기 (흰 빛 반사)
    const g = ctx.createRadialGradient(CX - pr * 0.35, CY - pr * 0.4, 2, CX - pr * 0.35, CY - pr * 0.4, pr * 0.9);
    g.addColorStop(0, 'rgba(255,255,255,0.42)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(CX - pr, CY - pr, pr * 2, pr * 2);
    ctx.restore();
  }

  // 떨어진 자리 고리
  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i];
    const k = (performance.now() - s.t0) / 600;
    if (k >= 1) { splashes.splice(i, 1); continue; }
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6 + k * 46, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.85})`;
    ctx.lineWidth = 3 * (1 - k) + 0.5;
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- 방울 떨어뜨리기 ----------
function dropAt(key, x, y) {
  if (drops.length >= MAX_DROPS) {
    toast(tr('pal.maxDrops', { n: MAX_DROPS }));
    return;
  }
  const before = mixOk;
  drops.push(key);
  mixOk = mixOf(drops);
  blend = { from: shownOk || mixOk, to: mixOk, t0: performance.now() };
  if (!before) shownOk = hexToOk(PAINT[key].hex);
  // 웅덩이 안쪽으로 떨어진 자리를 맞춘다
  const pr = puddleR();
  const dx = x - CX;
  const dy = y - CY;
  const d = Math.hypot(dx, dy);
  if (d > pr * 0.8) { x = CX + (dx / d) * pr * 0.8; y = CY + (dy / d) * pr * 0.8; }
  addSwirl(x, y, PAINT[key].hex, 90, 1.2);
  if (before) addSwirl(CX, CY, okToHex(before), 40, 0.7); // 원래 색 줄무늬도 함께 돌아 마블처럼 보인다
  splashes.push({ x, y, t0: performance.now() });
  save();
  render();
}

// 누른 물감에서 섞는 칸까지 방울이 포물선을 그리며 날아간다
function fly(key, fromEl, target) {
  const a = fromEl.getBoundingClientRect();
  const c = canvas.getBoundingClientRect();
  const tx = target ? target.x : c.left + CX + (Math.random() - 0.5) * 40;
  const ty = target ? target.y : c.top + CY + (Math.random() - 0.5) * 40;
  const sx = a.left + a.width / 2;
  const sy = a.top + a.height / 2;
  if (reduce) { dropAt(key, tx - c.left, ty - c.top); return; }
  const blob = el('span', { class: 'fly-drop', style: `--c:${PAINT[key].hex}` });
  document.body.append(blob);
  const peak = Math.min(sy, ty) - 80;
  const anim = blob.animate([
    { transform: `translate(${sx}px, ${sy}px) scale(0.6)` },
    { transform: `translate(${lerp(sx, tx, 0.5)}px, ${peak}px) scale(1.15)`, offset: 0.45 },
    { transform: `translate(${tx}px, ${ty}px) scale(0.85, 1.15)`, offset: 0.92 },
    { transform: `translate(${tx}px, ${ty}px) scale(1.5, 0.5)` },
  ], { duration: 560, easing: 'cubic-bezier(0.3, 0, 0.6, 1)' });
  anim.onfinish = () => {
    blob.remove();
    dropAt(key, tx - c.left, ty - c.top);
  };
}

// 물감: 누르면 날려 보내고, 끌면 손가락/커서를 따라오다가 섞는 칸에 놓으면 그 자리에 떨어진다
for (const btn of paintBtns) {
  btn.addEventListener('pointerdown', (e) => {
    const key = btn.dataset.key;
    const startX = e.clientX;
    const startY = e.clientY;
    let ghost = null;
    btn.setPointerCapture(e.pointerId);
    const move = (ev) => {
      if (!ghost && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
        ghost = el('span', { class: 'fly-drop dragging', style: `--c:${PAINT[key].hex}` });
        document.body.append(ghost);
      }
      if (ghost) ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
    };
    const up = (ev) => {
      btn.removeEventListener('pointermove', move);
      btn.removeEventListener('pointerup', up);
      btn.removeEventListener('pointercancel', up);
      if (!ghost) { fly(key, btn); return; }
      ghost.remove();
      const c = canvas.getBoundingClientRect();
      const x = ev.clientX - c.left;
      const y = ev.clientY - c.top;
      if (Math.hypot(x - CX, y - CY) <= R) dropAt(key, x, y);
    };
    btn.addEventListener('pointermove', move);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
  });
  // 키보드(Enter/Space)로 누르면 click 만 온다
  btn.addEventListener('click', (e) => { if (e.detail === 0) fly(btn.dataset.key, btn); });
}

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

// ---------- 결과·레시피 ----------
function save() {
  store.set('paletteDrops', drops);
}

function render() {
  const hex = mixOk ? okToHex(mixOk) : null;
  $('mix-empty').classList.toggle('hidden', !!hex);
  $('undo').disabled = !drops.length;
  $('find').disabled = !hex;
  $('reset').disabled = !hex;
  // 조제한 색은 섞는 칸에 보이므로 옆에 색상값과 방울 수만 적는다
  $('mix-hex').textContent = hex ? `${hex}
${tr('pal.drops', { n: drops.length })}` : '';
}

$('undo').addEventListener('click', () => {
  drops.pop();
  const before = shownOk;
  mixOk = mixOf(drops);
  blend = mixOk ? { from: before, to: mixOk, t0: performance.now() } : null;
  if (!mixOk) {
    shownOk = null;
    particles.length = 0;
    toLips(DEFAULT_LOOK.hex, { finish: DEFAULT_LOOK.finish, source: '기본 컬러' });
  }
  save();
  render();
});
// 추천 결과 보기: 오른쪽에는 조제한 색과 추천 제품만 남긴다. '다시 섞기'는 섞던 팔레트로 돌아간다
function showResult(on) {
  document.querySelector('.palette').classList.toggle('show-result', on);
}
$('back-mix').addEventListener('click', () => showResult(false));

// 다시하기(팔레트 오른쪽 위 아이콘): 팔레트를 비우고 입술 색을 기본 컬러로

$('reset').addEventListener('click', () => {
  showResult(false);
  drops = [];
  mixOk = null;
  shownOk = null;
  blend = null;
  particles.length = 0;
  save();
  render();
  $('rec-list').replaceChildren();
  $('rec-status').textContent = '';
  toLips(DEFAULT_LOOK.hex, { finish: DEFAULT_LOOK.finish, source: '기본 컬러' });
  toast(tr('pal.resetDone'));
});

// 나에게 어울리는 컬러 (lip.js 가 측정): 팔레트의 같은 물감에 '내 톤' 표시, 추천 컬러를 누르면 한 방울 떨어뜨린다
function markPicks(picks = []) {
  for (const b of paintBtns) b.classList.toggle('paint-pick', picks.includes(PAINT[b.dataset.key].hex));
}
window.addEventListener('took:match', (e) => markPicks(e.detail.picks));
window.addEventListener('took:pick', (e) => {
  const p = ALL_PAINTS.find((x) => x.hex === e.detail.hex);
  if (!p) return;
  if (document.querySelector('.palette.show-result')) showResult(false); // 추천 결과를 보던 중이면 섞는 칸을 다시 연다
  requestAnimationFrame(() => fly(p.key, e.detail.from));
});
markPicks(store.get('lipMatch')?.picks);

$('find').addEventListener('click', async () => {
  const hex = okToHex(mixOk);
  showResult(true);
  $('res-swatch').style.background = hex;
  $('res-hex').textContent = tr('pal.mixed', { hex });
  $('rec-status').textContent = tr('pal.searching', { hex });
  $('rec-list').replaceChildren(...skeletonCards(4));
  const { ok, body } = await api('api/recommend?' + new URLSearchParams({ hex, limit: 6 }));
  if (!ok) {
    $('rec-status').textContent = body.error || tr('lip.recFail');
    $('rec-list').replaceChildren();
    return;
  }
  $('rec-status').textContent = tr('pal.found', { hex, n: body.products.length });
  $('rec-list').replaceChildren(...body.products.map((p) => productCard(p, {
    extraActions: [el('button', {
      type: 'button',
      text: tr('lip.tryOn'),
      onclick: () => toLips(p.color_hex, { finish: p.finish, quiet: false, source: '추천 제품 색' }),
    })],
  })));
});

// ---------- NFC 태그: 립 제품을 리더기에 올리면 그 제품 색을 바로 입술에 바른다 (js/nfc.js) ----------
const nfcHint = $('nfc-hint');
let nfcTimer = null;
function nfcFlash(text) {
  nfcHint.textContent = text;
  nfcHint.classList.add('hit');
  clearTimeout(nfcTimer);
  nfcTimer = setTimeout(() => { nfcHint.textContent = tr('pal.nfcIdle'); nfcHint.classList.remove('hit'); }, 3000);
}
nfcHint.textContent = tr('pal.nfcIdle');
// 읽은 제품: 그 색을 입술에 바르고, 오른쪽 ④ 자리에 제품 카드를 띄운다 (리더기·휴대폰 NFC 공통)
async function showNfcProduct(id) {
  const found = id ? await api('api/products/' + encodeURIComponent(id)) : null;
  const p = found?.ok ? found.body.product : null;
  if (!p?.color_hex) { nfcFlash(tr('pal.nfcUnknown')); return; }
  toLips(p.color_hex, { finish: p.finish, quiet: false, source: shortName(p) });
  nfcFlash(tr('pal.nfcApplied', { name: shortName(p) }));
  showResult(true);
  $('res-swatch').style.background = p.color_hex;
  $('res-hex').textContent = tr('pal.nfcRead');
  $('rec-status').textContent = '';
  $('rec-list').replaceChildren(productCard(p, {
    extraActions: [el('button', { type: 'button', text: tr('lip.tryOn'), onclick: () => toLips(p.color_hex, { finish: p.finish, quiet: false, source: shortName(p) }) })],
  }));
}
listenNfc((code) => showNfcProduct(resolveTag(code)));

// ---------- 휴대폰 NFC (테스트 단계, 상단 메뉴의 NFC 테스트와 같은 기준) ----------
// 같은 카드를 2.5초 안에 다시 읽으면 다시 처리하지 않는다. 읽지 못한 카드는 다시 대 보라고 알린다
const isDupReading = makeDedupe();
function onReading(r) {
  if (isDupReading(r)) return;
  if (r.kind === 'unreadable') { nfcFlash(tr('pal.nfcRetry')); return; }
  showNfcProduct(resolveReading(r));
}
if (NFC_TEST_MENU) {
  $('pal-nfc-row').classList.remove('hidden');
  const state = (text) => { $('pal-nfc-state').textContent = text; };
  if (webNfcSupport().ok) {
    // 이 기기(안드로이드 Chrome)가 직접 읽는다
    const btn = $('pal-nfc-start');
    btn.classList.remove('hidden');
    let stop = null;
    let attempt = null;
    let slow = null;
    btn.addEventListener('click', async () => {
      if (stop) { stop(); stop = null; btn.textContent = tr('pal.nfcStart'); state(''); return; }
      if (attempt) attempt.abort(); // 켜지는 중에 다시 누르면 처음부터 다시
      const ctrl = new AbortController();
      attempt = ctrl;
      state(tr('pal.nfcStarting'));
      clearTimeout(slow);
      slow = setTimeout(() => { if (attempt === ctrl) state(tr('pal.nfcSlow')); }, 6000);
      try {
        const stopFn = await startWebNfc({
          signal: ctrl.signal,
          onReading,
          onFail: () => onReading({ kind: 'unreadable', masked: '', fp: null, tookId: null, records: [] }),
        });
        if (attempt !== ctrl) return;
        attempt = null; clearTimeout(slow);
        stop = stopFn;
        btn.textContent = tr('pal.nfcStop');
        state(tr('pal.nfcOn'));
      } catch {
        if (attempt !== ctrl) return;
        attempt = null; clearTimeout(slow);
        state(tr('pal.nfcFail'));
      }
    });
  } else {
    // 컴퓨터·iPad: 휴대폰을 QR 로 연결해 휴대폰이 읽은 카드를 받는다 (서버 필요)
    const btn = $('pal-nfc-pair');
    const dlg = $('pal-nfc-dialog');
    const pairState = (text) => { $('pal-nfc-pairstate').textContent = text; };
    let pairing = null;
    btn.classList.remove('hidden');
    $('pal-nfc-close').addEventListener('click', () => dlg.close());
    btn.addEventListener('click', async () => {
      dlg.showModal();
      if (pairing) return; // 이미 연결 중이면 QR 만 다시 보여 준다
      pairState(tr('pal.nfcPairWait'));
      const res = await pairPhoneForNfc({
        onEvent: (e) => {
          if (e.type === 'phone') { pairState(tr('pal.nfcPairOk')); state(tr('pal.nfcPairOk')); }
          if (e.type === 'nfcstate' && e.data.state === 'ready') {
            state(tr('pal.nfcPairPhoneOn'));
            setTimeout(() => dlg.close(), 800); // 휴대폰 준비가 끝나면 팔레트가 보이게 닫는다
          }
          if (e.type === 'nfc') onReading({ ...e.data, records: e.data.records || [] });
        },
        onEnd: () => { pairing = null; state(tr('pal.nfcPairEnded')); },
      });
      if (!res.ok) { pairState(tr('pal.nfcPairNoServer')); return; }
      pairing = res;
      const ZXing = await loadZXing().catch(() => null);
      if (ZXing) {
        const qr = new ZXing.BrowserQRCodeSvgWriter().write(res.phoneUrl, 168, 168);
        qr.setAttribute('shape-rendering', 'crispEdges');
        $('pal-nfc-qr').replaceChildren(qr);
      }
      $('pal-nfc-url').textContent = res.phoneUrl;
      if (!res.phoneUrl.startsWith('https:')) pairState(tr('pal.nfcPairHttp'));
    });
  }
}

resize();
// 화면 배치에 따라 섞는 칸 크기가 바뀌면(추천 목록이 열릴 때 등) 캔버스 해상도를 다시 맞춘다
new ResizeObserver(resize).observe(canvas);
if (mixOk) {
  shownOk = mixOk;
  toLips(okToHex(mixOk)); // 다시 열면 섞어 둔 색을 입술에 바로 입힌다
}
render();
requestAnimationFrame(frame);
