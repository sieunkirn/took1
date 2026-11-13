// 팔레트 물감·섞는 칸 (팔레트 탭 palette.js)
//  - 물감 = 그라디언트 맵 (2026-11-13): 립 컬러 22색을 색 계열 순서로 이은 색 띠 하나 (예전 물감 버튼 22개 대신).
//    띠의 아무 곳이나 누르거나 끌다 놓으면 그 자리 색(OKLab 보간)이 한 방울 떨어진다. 띠 아래 정지점 동그라미는 뺐다
//  - 그라디언트에서 색을 고르면 현재 조합에 추가한다
//  - 혼합색은 선택 횟수를 가중치로 OKLab 공간에서 평균한다
//  - 조합 결과는 단색 견본으로 표시하고 onColor(hex) 로 입술에 바로 적용한다
// 물감·섞는 칸·조제한 색은 실제 색이다 (CLAUDE.md 예외)
import { el, store } from './common.js';
import { hexToRgb, rgbToHex } from '../lib/color.js';
import { PRESETS } from './lip-engine.js'; // 립 컬러 매핑 탭에서 고를 수 있는 색
import { t as tr } from './i18n.js';

// 물감 = 립 컬러 매핑 탭에서 고를 수 있는 컬러 (이름 대신 색상값)
export const ALL_PAINTS = PRESETS.map((hex, i) => ({ key: 'lip' + i, name: hex, hex, lip: true }));
export const PAINT = Object.fromEntries(ALL_PAINTS.map((p) => [p.key, p]));
const HEX_RE = /^#[0-9a-f]{6}$/i;
// 방울 = 색상값. 예전에 저장한 물감 이름('lip3')도 색상값으로 바꿔 읽는다
const toHex = (v) => (PAINT[v] ? PAINT[v].hex : HEX_RE.test(v || '') ? v.toUpperCase() : null);

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

// ---------- 그라디언트 맵: 22색을 색 계열이 이어지는 순서로, 같은 간격의 정지점에 ----------
// 왼쪽 끝 짙은 자두 → 베리 → 핑크 → 가운데 가장 밝은 누드 → 피치·코랄 → 레드 → 오른쪽 끝 짙은 와인.
// 밝기가 가운데로 갈수록 밝아졌다가 다시 짙어지고, 색이 차가운 쪽에서 따뜻한 쪽으로 한 방향으로만 흐른다
// (밝기만으로 줄 세우면 주황 레드와 자두색이 바로 붙어 띠가 얼룩져 보였다)
const GRADIENT_ORDER = ['#702050', '#8E3070', '#94607A', '#A04060', '#B8457A', '#D05A9C', '#E06090', '#D06A80', '#CC88A8', '#C08A94', '#E0A0A8',
  '#D89A78', '#E07070', '#D06A5A', '#E05050', '#D2321E', '#C8323F', '#B83A4B', '#A85A5E', '#A0202C', '#8E2E22', '#7A2635'];
const rank = (hex) => { const i = GRADIENT_ORDER.indexOf(hex.toUpperCase()); return i < 0 ? GRADIENT_ORDER.length : i; }; // 목록에 없는 새 프리셋은 맨 뒤
export const GRADIENT = ALL_PAINTS
  .map((p) => ({ ...p, ok: hexToOk(p.hex) }))
  .sort((a, b) => rank(a.hex) - rank(b.hex))
  .map((p, i, arr) => ({ ...p, at: i / (arr.length - 1) }));
/** 띠 위치 t(0~1)의 색 (정지점 사이는 OKLab 으로 잇는다 — 띠 그림과 같은 방식) */
export function gradientAt(t) {
  const n = GRADIENT.length - 1;
  const x = Math.min(1, Math.max(0, t)) * n;
  const i = Math.min(n - 1, Math.floor(x));
  return okToHex(lerpOk(GRADIENT[i].ok, GRADIENT[i + 1].ok, x - i));
}
function gradientCss() {
  const stops = GRADIENT.map((g) => `${g.hex} ${(g.at * 100).toFixed(2)}%`).join(', ');
  const ok = typeof CSS !== 'undefined' && CSS.supports?.('background-image', 'linear-gradient(in oklab to right, red, blue)');
  return `linear-gradient(${ok ? 'in oklab ' : ''}to right, ${stops})`;
}

/**
 * 팔레트 색 선택기 만들기
 * @param {object} o
 * @param {HTMLElement} o.paintsEl 색상 선택 띠를 넣을 칸
 * @param {HTMLCanvasElement} o.canvas 선택한 색 견본
 * @param {(hex: string|null) => void} [o.onColor] 색 선택이 바뀔 때 호출
 * @param {() => void} [o.onChange] 버튼 상태를 다시 그릴 때 호출
 * @param {string} [o.storeKey] 선택한 색을 저장할 키
 * @param {string} [o.plate] 색을 선택하기 전의 견본 바탕색
 */
export function createMixer({ paintsEl, canvas, onColor = () => {}, onChange = () => {}, storeKey = 'paletteDrops', plate }) {
  const saved = store.get(storeKey, []);
  let selected = toHex(Array.isArray(saved) ? saved.at(-1) : saved);

  // ---------- 물감: 그라디언트 맵 ----------
  // 색 띠 + 고르는 손잡이. 띠를 누르거나 끌다 놓으면 그 자리 색이 떨어진다
  let pos = 0.5; // 손잡이 자리 (0~1)
  const handle = el('span', { class: 'gmap-handle', 'aria-hidden': 'true' }); // 끌 때 손잡이 위에 뜨던 색 방울은 2026-11-13 뺐다
  const bar = el('div', {
    class: 'gmap-bar', role: 'slider', tabindex: '0', 'aria-label': tr('pal.gradAria'),
    'aria-valuemin': '0', 'aria-valuemax': '100', style: `background-image:${gradientCss()}`,
  }, handle);
  paintsEl.classList.add('gmap');
  paintsEl.replaceChildren(bar);

  function setPos(t) {
    pos = Math.min(1, Math.max(0, t));
    const hex = gradientAt(pos);
    handle.style.left = `${pos * 100}%`;
    handle.style.setProperty('--c', hex);
    bar.setAttribute('aria-valuenow', String(Math.round(pos * 100)));
    bar.setAttribute('aria-valuetext', hex);
    return hex;
  }
  setPos(pos);
  const posOf = (e) => {
    const r = bar.getBoundingClientRect();
    return r.width ? (e.clientX - r.left) / r.width : pos;
  };
  let picking = false;
  bar.addEventListener('pointerdown', (e) => {
    picking = true;
    bar.setPointerCapture(e.pointerId);
    bar.classList.add('picking');
    setPos(posOf(e));
  });
  bar.addEventListener('pointermove', (e) => { if (picking) setPos(posOf(e)); });
  bar.addEventListener('pointerup', (e) => {
    if (!picking) return;
    picking = false;
    bar.classList.remove('picking');
    addPaint(setPos(posOf(e)));
  });
  bar.addEventListener('pointercancel', () => { picking = false; bar.classList.remove('picking'); });
  // 키보드: 화살표로 손잡이를 옮기고 Enter·Space 로 떨어뜨린다
  bar.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setPos(pos - step);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setPos(pos + step);
    else if (e.key === 'Home') setPos(0);
    else if (e.key === 'End') setPos(1);
    else if (e.key === 'Enter' || e.key === ' ') addPaint(gradientAt(pos));
    else return;
    e.preventDefault();
  });

  // ---------- 선택 색 견본 ----------
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;

  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = selected || plate || (document.documentElement.dataset.theme === 'dark' ? '#1c1c1c' : '#f0f0f0');
    ctx.fillRect(0, 0, W, H);
  }

  const save = () => store.set(storeKey, selected ? [selected] : []);

  function addPaint(keyOrHex) {
    const hex = toHex(keyOrHex);
    if (!hex) return;
    selected = hex;
    save();
    draw();
    onChange();
    onColor(selected);
  }

  // ---------- 밖에서 쓰는 동작 ----------
  /** 처음부터 다시: 비우고 onColor(null) */
  function reset() {
    selected = null;
    save();
    draw();
    onChange();
    onColor(null);
  }
  /** 다시 열었을 때 저장한 색을 복원한다 */
  function start() {
    resize();
    new ResizeObserver(() => { resize(); draw(); }).observe(canvas);
    draw();
    if (selected) onColor(selected);
    onChange();
  }

  return {
    addColor: addPaint,
    reset,
    start,
    /** 지금 선택한 색 (없으면 null) */
    hex: () => selected,
    /** 현재 선택된 색을 단일 값으로 유지하므로 결과는 한 색상 배열 */
    colors: () => (selected ? [selected] : []),
  };
}
