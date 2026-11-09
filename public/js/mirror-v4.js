// 거울 ver4 (mirror-v4.html): 하프미러 창 모드. 거울 ver3(js/mirror.js)를 복제해 레이아웃만 바꿨다 (ver3 파일은 건드리지 않음).
// 하프미러에서는 검은 부분 = 거울, 밝은 부분 = 화면이므로 화면 대부분을 검정으로 두고 카메라 영상은 눈높이의 '창'에만 그린다.
//  1) 대기: 전체 검정 + 아래 안내. 홍보 사진은 직원 설정(끄기 기본 / 작게 / 전체). 카메라 스트림은 꺼 둔다(프라이버시)
//  2) 전환: NFC 태그(js/nfc.js) 또는 화면 터치 → 카메라를 켜고 창 안의 영상이 0.6초 페이드인. NFC 로 올린 제품은 그 색을 바로 입힌다
//  3) 체험: 창(가로 중앙, 높이 --m4-win-h, 중심 높이 --m4-win-y) 안에 영상 + 입술 매핑(js/lip-view.js). 시작하면 팔레트가 바로 뜬다
//     독은 창 아래(가로 화면은 오른쪽). 독이 커지면 layout() 이 창 높이를 줄여 절대 겹치지 않게 한다
//  4) 유휴: common.js 자동 초기화 → 대기로 돌아가며 스트림을 끈다
// 직원용 설정(?setup=1 또는 왼쪽 위 2초 누르기): ver3 항목 + 창 높이·창 세로 위치·창 테두리·대기 홍보 사진. 저장 키 took.mirror4
import { renderNav, store, api, el, shortName, won, skeletonCards, MOVING_TO_TAB_FRAME } from './common.js';
import { loadTracker } from './lip-tracker.js';
import { drawLipFrame, trackLips, stopStream, cameraErrorMessage, FINISH_TO_TEXTURE } from './lip-view.js';
import { createMixer, PAINT } from './palette-mixer.js'; // 팔레트 탭과 같은 물감·섞는 칸
import { TEXTURES, measureTone, classifyTone, matchPresets } from './lip-engine.js'; // 텍스처 · 내 톤 측정 (팔레트 탭과 같은 기준)
import { listenNfc, resolveTag } from './nfc.js';
import { loadZXing } from './barcode-scan.js'; // QR 그리기
import { t as tr, isEn, brandOf, nameOf, displayName } from './i18n.js';

const $ = (id) => document.getElementById(id);
const video = $('video');
const view = $('view');
const viewCtx = view.getContext('2d', { willReadFrequently: true });
const DEFAULT_HEX = '#C08A94'; // 립 매핑 화면과 같은 처음 색

// ---------- 설정 (localStorage took.mirror) ----------
const CFG_KEY = 'took.mirror4'; // ver3(took.mirror)와 섞이지 않게 따로
const CFG_DEFAULT = { rotate: 0, flip: true, scale: 1, trigger: 'both', idle: 30, phoneBase: '', winH: 65, winY: 40, border: false, photo: 'off' };
function loadCfg() {
  let v = {};
  try { v = JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch { /* 저장소를 못 쓰는 환경: 기본값 */ }
  const num = (x, lo, hi, d) => (Number.isFinite(Number(x)) && Number(x) >= lo && Number(x) <= hi ? Number(x) : d);
  return {
    rotate: [0, 90, 180, 270].includes(Number(v.rotate)) ? Number(v.rotate) : CFG_DEFAULT.rotate,
    flip: typeof v.flip === 'boolean' ? v.flip : CFG_DEFAULT.flip,
    scale: num(v.scale, 0.8, 1.3, CFG_DEFAULT.scale),
    trigger: ['nfc', 'touch', 'both'].includes(v.trigger) ? v.trigger : CFG_DEFAULT.trigger,
    idle: num(v.idle, 10, 600, CFG_DEFAULT.idle),
    phoneBase: typeof v.phoneBase === 'string' && /^https?:\/\/\S+$/.test(v.phoneBase) ? v.phoneBase : '',
    winH: num(v.winH, 40, 90, CFG_DEFAULT.winH), // 창 높이 (화면 높이의 %)
    winY: num(v.winY, 20, 60, CFG_DEFAULT.winY), // 창 중심의 세로 위치 (화면 위에서 %)
    border: typeof v.border === 'boolean' ? v.border : CFG_DEFAULT.border, // 창 테두리 (1px 흰색 30%)
    photo: ['off', 'small', 'full'].includes(v.photo) ? v.photo : CFG_DEFAULT.photo, // 대기 홍보 사진
  };
}
const cfg = loadCfg();
function saveCfg() {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* 저장 불가 환경 */ }
  applyCfg();
}
const allows = (kind) => cfg.trigger === 'both' || cfg.trigger === kind;
function applyCfg() {
  const root = document.documentElement.style;
  root.setProperty('--mirror-scale', String(cfg.scale));
  root.setProperty('--m4-win-h', cfg.winH + 'dvh');
  root.setProperty('--m4-win-y', cfg.winY + 'dvh');
  $('mirror-stage').classList.toggle('m4-border', cfg.border);
  $('mirror-hint-touch').classList.toggle('hidden', !allows('touch'));
  showStandbyPhoto();
  layout();
}

// ---------- 색 보정 훅 (localStorage took.colorProfile, 3×3 행렬) ----------
const PROFILE_KEY = 'took.colorProfile';
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function loadMatrix() {
  try {
    const v = JSON.parse(localStorage.getItem(PROFILE_KEY));
    const m = Array.isArray(v) ? v : v?.matrix;
    if (Array.isArray(m) && m.length === 9 && m.every((x) => Number.isFinite(Number(x)))) return m.map(Number);
  } catch { /* 없음 */ }
  return IDENTITY.slice();
}
function applyMatrix(m) {
  const identity = m.every((x, i) => x === IDENTITY[i]);
  const [a, b, c, d, e, f, g, h, i] = m;
  $('took-color-matrix').setAttribute('values', `${a} ${b} ${c} 0 0  ${d} ${e} ${f} 0 0  ${g} ${h} ${i} 0 0  0 0 0 1 0`);
  // 항등 행렬이면 필터를 아예 걸지 않는다 (전체 화면 필터는 매 프레임 GPU 비용)
  $('mirror').style.filter = identity ? '' : 'url(#took-color-profile)'; // 화면 전체(영상 + 독)
}

// ---------- 상태 ----------
const state = {
  phase: 'standby', // standby | starting | live
  stream: null,
  gen: 0, // 카메라를 켤 때마다 1씩: 끈 뒤 늦게 끝난 작업을 버린다
  tracker: undefined,
  lips: null,
  rafId: null,
  lastVideoTime: -1,
  tier: 0,
  fps: { n: 0, since: 0, slow: 0, value: 0 },
  look: { hex: DEFAULT_HEX, ...savedLook() },
  analyze: null, // 내 톤 측정 중일 때 { samples, started }
  panelFrom: 'main', // 추천 목록을 닫으면 돌아갈 곳 (main | palette)
  name: '',
};

function setPhase(phase) {
  state.phase = phase;
  document.body.dataset.mirror = phase;
  layout(); // 독이 나타나거나 사라지면 창 크기가 바뀐다
}

// ---------- 대기 홍보 사진 (직원 설정: 끄기 기본 / 작게 / 전체) ----------
// 사진은 ver3 와 같은 파일을 새로고침할 때마다 번갈아 쓴다. 지난번 순서는 ver3 와 같은 localStorage took.mirrorStandby
// 끄기·작게: 바탕은 검정(하프미러에서 거울로 보인다). 작게는 화면 폭 40% 이하 카드에 60% 밝기. 전체는 ver3 와 같다(사진 가장자리 색 바탕)
const STANDBY_SLIDES = [
  { src: 'images/mirror/standby.webp', bg: '#F5E7E7', tone: 'light' }, // 올영세일 (분홍)
  { src: 'images/mirror/standby-2.webp', bg: '#000000', tone: 'dark' }, // 올영세일 12.01–12.07 (검정)
];
const STANDBY_KEY = 'took.mirrorStandby';
let standbySlide = STANDBY_SLIDES[0];
(function pickStandby() {
  let last = -1;
  try {
    const v = localStorage.getItem(STANDBY_KEY);
    if (v !== null && Number.isInteger(Number(v))) last = Number(v);
  } catch { /* 저장소를 못 쓰는 환경: 첫 사진 */ }
  const k = (last + 1) % STANDBY_SLIDES.length;
  // 사진을 끈 상태에서는 순서를 넘기지 않는다. 노트북에서 탭 크기 틀로 옮겨 가는 첫 열림도 세지 않는다
  if (!MOVING_TO_TAB_FRAME && cfg.photo !== 'off') {
    try { localStorage.setItem(STANDBY_KEY, String(k)); } catch { /* 저장 불가 환경 */ }
  }
  standbySlide = STANDBY_SLIDES[k];
  // 파일이 없으면(images/mirror/ 에 아직 안 넣었으면) 첫 사진으로 대신한다
  if (k > 0) $('mirror-standby-img').addEventListener('error', () => { standbySlide = STANDBY_SLIDES[0]; showStandbyPhoto(); }, { once: true });
})();
function showStandbyPhoto() {
  const img = $('mirror-standby-img');
  const sec = $('mirror-standby');
  const full = cfg.photo === 'full';
  sec.dataset.photo = cfg.photo;
  sec.style.backgroundColor = full ? standbySlide.bg : '#000';
  sec.dataset.tone = full ? standbySlide.tone : 'dark';
  img.hidden = cfg.photo === 'off';
  // 끄기일 때는 사진을 아예 불러오지 않는다
  if (cfg.photo !== 'off' && img.getAttribute('src') !== standbySlide.src) img.src = standbySlide.src;
}

// ---------- 카메라 창 배치 ----------
// 창 높이·중심 위치는 설정값(--m4-win-h, --m4-win-y). 가로폭은 영상 비율(회전 반영)에 맞춘다.
// 독이 보이면 독의 실제 크기를 재서 창이 독과 겹치지 않게 줄인다 (세로 화면: 창 아래, 가로 화면: 창 오른쪽). 바뀔 때는 CSS 가 0.3초 전환
const GAP = 16; // 창과 독·화면 가장자리 사이
const MIN_H = 0.2; // 창이 아무리 줄어도 화면 높이의 20%
const win = { x: 0, y: 0, w: 0, h: 0 };
function videoRatio() {
  if (view.width && view.height) return view.width / view.height;
  const size = cameraSize(state.tier); // 아직 영상이 없으면 청할 해상도로 짐작
  return cfg.rotate % 180 ? size.height / size.width : size.width / size.height;
}
function layout() {
  const VW = innerWidth;
  const VH = innerHeight;
  const landscape = VW > VH;
  const dock = $('mirror-dock');
  const d = getComputedStyle(dock).display !== 'none' ? dock.getBoundingClientRect() : null;
  let h = (cfg.winH / 100) * VH;
  let cy = (cfg.winY / 100) * VH;
  let maxW = VW - GAP * 2;
  if (d && d.height && !landscape) {
    // 세로: 창 아래끝이 독 위끝보다 GAP 만큼 위에 오게. 먼저 중심을 두고 높이를 줄이고, 그래도 안 되면 위로 올린다
    const limit = d.top - GAP;
    if (cy + h / 2 > limit) h = Math.max(VH * MIN_H, 2 * (limit - cy));
    if (cy + h / 2 > limit) cy = limit - h / 2;
    if (cy - h / 2 < GAP) { h = Math.max(VH * MIN_H, Math.min(h, limit - GAP)); cy = GAP + h / 2; }
  } else if (d && d.width && landscape) {
    maxW = d.left - GAP * 2; // 가로: 창 오른쪽끝이 독 왼쪽끝보다 GAP 만큼 왼쪽
  }
  h = Math.min(h, VH - GAP * 2);
  cy = Math.min(Math.max(cy, GAP + h / 2), VH - GAP - h / 2);
  const w = Math.max(0, Math.min(h * videoRatio(), maxW)); // 너무 넓으면 창은 그 폭까지만, 영상은 cover 로 잘린다
  let x = VW / 2 - w / 2; // 가로 중앙
  if (d && landscape) x = Math.min(x, d.left - GAP - w); // 독 자리를 넘으면 왼쪽으로 민다
  x = Math.max(GAP, x);
  Object.assign(win, { x: Math.round(x), y: Math.round(cy - h / 2), w: Math.round(w), h: Math.round(h) });
  const st = $('mirror-stage').style;
  st.setProperty('--m4-x', win.x + 'px');
  st.setProperty('--m4-top', win.y + 'px');
  st.setProperty('--m4-w', win.w + 'px');
  st.setProperty('--m4-h', win.h + 'px');
  showWinInfo();
}
function showWinInfo() {
  $('ms-win').textContent = tr('mirror4.winInfo', { w: win.w, h: win.h, x: win.x, y: win.y });
}

// 대기 화면 시계 (오른쪽 위, 24시간 HH:MM). 분이 바뀌는 때에 맞춰 다시 그린다
(function tickClock() {
  const now = new Date();
  $('m4-clock').textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  $('m4-clock').dateTime = now.toISOString();
  setTimeout(tickClock, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
})();

function setStatus(text) {
  $('mirror-status').textContent = text || '';
}

// 텍스처·농도: 팔레트 탭(lip.js)과 같은 저장값 took.lipDisplay
function savedLook() {
  const v = store.get('lipDisplay') || {};
  return { texture: TEXTURES[v.texture] ? v.texture : 'matte', intensity: Number.isFinite(v.intensity) ? v.intensity : 80 };
}
function saveLook() {
  store.set('lipDisplay', { texture: state.look.texture, intensity: state.look.intensity });
}

function showLook() {
  for (const b of $('mirror-textures').children) b.setAttribute('aria-pressed', String(b.dataset.texture === state.look.texture));
  $('mirror-intensity').value = state.look.intensity;
  $('mirror-intensity-out').textContent = state.look.intensity + '%';
  const name = state.name || tr('mirror.defaultColor');
  $('mirror-name').textContent = name;
  $('mirror-dot').style.background = state.look.hex;
  for (const b of $('mirror-strip').querySelectorAll('[data-hex]')) b.setAttribute('aria-pressed', String(b.dataset.hex === state.look.hex));
}

function applyColor(hex, name = hex) {
  state.look.hex = hex;
  state.name = name;
  showLook();
}

function applyProduct(p) {
  if (FINISH_TO_TEXTURE[p.finish]) { state.look.texture = FINISH_TO_TEXTURE[p.finish]; saveLook(); }
  applyColor(p.color_hex, shortName(p));
  setStatus(tr('mirror.applied', { name: shortName(p) }));
  palStatus(tr('mirror.applied', { name: shortName(p) })); // 팔레트가 떠 있으면 위 줄에
}

// ---------- 카메라 ----------
// 해상도 단계: 긴 변 기준. 30fps 를 못 내면 한 단계씩 낮춘다
const TIERS = [1280, 960, 640];
function cameraSize(tier) {
  const long = TIERS[tier];
  const short = Math.round((long * 9) / 16);
  // 화면이 세로면 세로 영상을 먼저 청한다. 웹캠을 90°/270° 돌려 달았으면 카메라 기준으로는 반대 방향
  const portraitScreen = innerHeight > innerWidth;
  const portraitCam = cfg.rotate % 180 ? !portraitScreen : portraitScreen;
  return portraitCam ? { width: short, height: long } : { width: long, height: short };
}

function stopCamera() {
  state.gen += 1;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  stopStream(state.stream);
  state.stream = null;
  video.srcObject = null;
  state.lips = null;
  showCamInfo();
}

async function startCamera() {
  stopCamera();
  const gen = state.gen;
  setPhase('starting');
  setStatus(tr('mirror.camStarting'));
  $('mirror-retry').classList.add('hidden');
  if (!navigator.mediaDevices?.getUserMedia) return cameraFailed(tr('lip.camInsecure'));
  const size = cameraSize(state.tier);
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: size.width }, height: { ideal: size.height }, frameRate: { ideal: 30 } },
      audio: false,
    });
  } catch (e) {
    if (gen === state.gen) cameraFailed(cameraErrorMessage(e));
    return;
  }
  if (gen !== state.gen) { stopStream(stream); return; } // 기다리는 동안 대기로 돌아갔다
  state.stream = stream;
  stream.getVideoTracks()[0]?.addEventListener('ended', () => {
    if (gen !== state.gen) return;
    stopCamera();
    cameraFailed(tr('lip.camLost'));
  });
  video.srcObject = stream;
  try { await video.play(); } catch { /* 자동 재생 제한: 프레임이 오면 그린다 */ }
  if (gen !== state.gen) return;
  setPhase('live');
  // 시작하면 팔레트가 바로 뜬다 (닫기 버튼 없음. 끝내기는 자동 초기화 → 대기 화면). NFC 로 올린 제품 화면이 먼저 떴으면 그대로
  if ($('mirror-product').classList.contains('hidden')) openPalette();
  // '카메라를 켜는 중' 만 지운다. 그사이 NFC 로 올린 제품 안내가 들어왔으면 그대로 둔다
  if ($('mirror-status').textContent === tr('mirror.camStarting')) setStatus('');
  state.lastVideoTime = -1;
  state.fps = { n: 0, since: performance.now(), slow: 0, value: 0 };
  loop(gen);
  if (state.tracker === undefined) state.tracker = await loadTracker();
  if (gen === state.gen && state.tracker === null) { setStatus(tr('lip.noTracker')); palStatus(tr('lip.noTracker')); }
}

function cameraFailed(text) {
  setPhase('live'); // 독은 보여서 다시 연결·종료를 누를 수 있게
  closePanel(); // 팔레트 대신 '다시 연결' 버튼이 있는 줄
  setStatus(text);
  $('mirror-retry').classList.remove('hidden');
}

// 30fps 유지 확인: 입술 추적까지 마친 프레임 수를 2초마다 센다. 두 번 연속 24fps 미만이면 해상도를 한 단계 낮춘다
function countFrame() {
  const f = state.fps;
  f.n += 1;
  const now = performance.now();
  if (now - f.since < 2000) return;
  f.value = Math.round((f.n * 1000) / (now - f.since));
  f.n = 0;
  f.since = now;
  showCamInfo();
  f.slow = f.value < 24 ? f.slow + 1 : 0;
  if (f.slow >= 2 && state.tier < TIERS.length - 1) {
    f.slow = 0;
    lowerResolution();
  }
}

async function lowerResolution() {
  state.tier += 1;
  const size = cameraSize(state.tier);
  const track = state.stream?.getVideoTracks()[0];
  try {
    await track.applyConstraints({ width: { ideal: size.width }, height: { ideal: size.height }, frameRate: { ideal: 30 } });
  } catch {
    if (state.phase === 'live') startCamera(); // 바꿀 수 없는 카메라: 새 해상도로 다시 연다
  }
  $('ms-cam').textContent = tr('mirror.lowered', { w: size.width, h: size.height });
}

function showCamInfo() {
  const s = state.stream?.getVideoTracks()[0]?.getSettings?.();
  const cam = s?.width ? tr('mirror.camInfo', { w: s.width, h: s.height, fps: state.fps.value || '…' }) : tr('mirror.camOff');
  // 기기 화면 크기(CSS 픽셀)와 배율: 갤럭시탭 등 실제 기기의 값을 확인할 때
  const screenInfo = tr('mirror.screenInfo', { w: innerWidth, h: innerHeight, dpr: Math.round((devicePixelRatio || 1) * 100) / 100 });
  $('ms-cam').textContent = cam + ' · ' + screenInfo;
}

// 새 카메라 프레임마다 입술을 찾고 같은 프레임에 색을 입힌다 (립 매핑 화면과 같은 순서)
async function loop(gen) {
  if (gen !== state.gen || !state.stream) return;
  if (video.readyState >= 2 && video.videoWidth) {
    if (state.tracker && video.currentTime !== state.lastVideoTime) {
      state.lastVideoTime = video.currentTime;
      const lips = await trackLips(state.lips, video);
      if (gen !== state.gen) return;
      state.lips = lips;
      if (state.analyze) collectTone();
      countFrame();
    }
    updateMatchBtn();
    const before = view.width / view.height;
    drawLipFrame(viewCtx, { src: video, w: video.videoWidth, h: video.videoHeight, mirror: cfg.flip, rotate: cfg.rotate }, state.lips, state.look);
    if (view.width / view.height !== before) layout(); // 첫 프레임·회전: 창 가로폭을 영상 비율에 맞춘다
  }
  state.rafId = requestAnimationFrame(() => loop(gen));
}

// ---------- 대기 ↔ 체험 ----------
function wake() {
  if (state.phase !== 'standby') return;
  startCamera();
}

/** 대기(거울)로: 카메라를 끄고 고른 색·대화 등 저장한 상태를 지운다 (종료 버튼·자동 초기화) */
function toStandby() {
  stopCamera();
  closePanel();
  mixer.reset(); // 섞던 팔레트도 비운다
  setPhase('standby');
  setStatus('');
  palStatus('');
  markPicks([]);
  state.analyze = null;
  shownProduct = null;
  state.look = { hex: DEFAULT_HEX, texture: 'matte', intensity: 80 };
  state.name = '';
  state.tier = 0;
  showLook();
  viewCtx.clearRect(0, 0, view.width, view.height);
  const wasEn = isEn();
  store.clear();
  if (wasEn) location.reload(); // 언어 설정도 지워졌으니 한국어 화면으로 다시 연다 (다음 손님은 한국어로 시작)
}

// 화면 터치로 깨우기 (독·설정·왼쪽 위 길게 누르기 자리는 빼고)
$('mirror').addEventListener('click', (e) => {
  if (state.phase !== 'standby' || !allows('touch')) return;
  if (e.target.closest('#mirror-corner, #mirror-dock')) return;
  wake();
});

// NFC: 리더기에 제품을 올리면 깨우고 그 제품 색을 바로 입힌다
listenNfc(async (code) => {
  if (state.phase === 'standby' && !allows('nfc')) return;
  wake();
  const id = resolveTag(code);
  const { ok, body } = id ? await api('api/products/' + encodeURIComponent(id)) : { ok: false };
  if (ok && body.product?.color_hex) { applyProduct(body.product); showProduct(body.product); } // 제품 + 휴대폰 챗봇 QR
  else { setStatus(tr('mirror.unknownTag')); palStatus(tr('mirror.unknownTag')); } // 등록되지 않은 제품은 지어내지 않는다
});

// ---------- 독: 추천 제품 / 팔레트 / 종료 ----------
function openPanel(label, items) {
  state.panelFrom = $('mirror-palette').classList.contains('hidden') ? 'main' : 'palette';
  $('mirror-palette').classList.add('hidden');
  $('mirror-strip').setAttribute('aria-label', label);
  $('mirror-strip').replaceChildren(...items);
  $('mirror-strip').scrollLeft = 0;
  $('mirror-main').classList.add('hidden');
  $('mirror-panel').classList.remove('hidden');
  showLook();
}
function closePanel() {
  $('mirror-product').classList.add('hidden');
  $('mirror-panel').classList.add('hidden');
  $('mirror-palette').classList.add('hidden');
  $('mirror-result').classList.add('hidden');
  $('mirror-main').classList.remove('hidden');
}

// 팔레트: 팔레트 탭과 같은 물감·섞는 칸. 섞는 동안 그 색을 입술에 바로 입히고, 다 비우면 기본 색으로
const mixer = createMixer({
  paintsEl: $('mirror-paints'),
  canvas: $('mirror-mix'),
  storeKey: 'paletteDrops', // 팔레트 탭과 같은 저장값: 한쪽에서 섞은 색이 다른 쪽에도 그대로
  plate: 'rgba(255, 255, 255, 0.07)', // 아주 옅은 접시: 넓은 회색 면은 하프미러에서 뿌연 안개처럼 보인다
  onColor: (hex) => (hex ? applyColor(hex, tr('mirror.mixed', { hex })) : applyColor(DEFAULT_HEX, '')),
  onChange: () => {
    const n = mixer.count();
    $('mirror-mix-empty').classList.toggle('hidden', n > 0);
    $('mirror-undo').disabled = !n;
    $('mirror-mix-reset').disabled = !n;
    $('mirror-find').disabled = !n;
  },
});
function openPalette() {
  $('mirror-main').classList.add('hidden');
  $('mirror-panel').classList.add('hidden');
  $('mirror-result').classList.add('hidden');
  $('mirror-product').classList.add('hidden');
  $('mirror-palette').classList.remove('hidden');
}
$('mirror-palette-open').addEventListener('click', openPalette);
$('mirror-undo').addEventListener('click', () => mixer.undo());
$('mirror-mix-reset').addEventListener('click', () => mixer.reset());
// 비슷한 제품: 팔레트 탭의 '이 색과 비슷한 제품 추천'과 같은 추천(색이 가까운 순 6개).
// 거울에서는 카드를 단순하게: 사진·브랜드·제품명·가격만, 카드를 누르면 바로 입술에 바른다 (지금 바르는 카드는 '✓ 바르는 중')
let findSeq = 0;
let resultFrom = 'palette'; // 추천을 닫으면 돌아갈 곳 (palette | product)
$('mirror-find').addEventListener('click', () => findSimilar(mixer.hex(), 'palette'));
async function findSimilar(hex, from) {
  if (!hex) return;
  const seq = ++findSeq;
  resultFrom = from;
  $('mirror-back-mix').textContent = tr(from === 'product' ? 'mirror.backProduct' : 'pal.backMix');
  $('mirror-palette').classList.add('hidden');
  $('mirror-product').classList.add('hidden');
  $('mirror-result').classList.remove('hidden');
  $('mirror-res-swatch').style.background = hex;
  $('mirror-res-hex').textContent = tr('mirror.similarTitle');
  $('mirror-rec-status').textContent = tr('mirror.recLoading');
  $('mirror-rec-list').replaceChildren(...skeletonCards(4));
  $('mirror-rec-list').scrollLeft = 0;
  const { ok, body } = await api('api/recommend?' + new URLSearchParams({ hex, limit: 6 }));
  if (seq !== findSeq || $('mirror-result').classList.contains('hidden')) return; // 그사이 닫았거나 다시 눌렀다
  if (!ok) {
    $('mirror-rec-status').textContent = body.error || tr('lip.recFail');
    $('mirror-rec-list').replaceChildren();
    return;
  }
  $('mirror-rec-status').textContent = body.products.length ? tr('mirror.similarCount', { n: body.products.length }) : tr('mirror.recNone');
  $('mirror-rec-list').replaceChildren(...body.products.map(simpleCard));
}

// 거울용 제품 카드: 카드 전체가 버튼 (사진 · 브랜드 · 제품명 · 가격 · 발라보기)
function simpleCard(p) {
  const noImage = () => el('span', { class: 'm-card-img m-card-noimg', text: tr('card.noImage') });
  const img = p.image_url
    ? el('img', { class: 'm-card-img card-img', src: p.image_url, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: (e) => e.target.replaceWith(noImage()) })
    : noImage();
  const cta = el('span', { class: 'm-card-cta', text: tr('mirror.tryOnShort') });
  const card = el('button', {
    type: 'button', class: 'm-card', 'data-product-id': p.id, 'aria-pressed': 'false', 'aria-label': tr('mirror.cardAria', { name: displayName(p) }),
    onclick: () => {
      applyProduct(p);
      for (const c of $('mirror-rec-list').querySelectorAll('.m-card')) {
        const on = c === card;
        c.setAttribute('aria-pressed', String(on));
        c.querySelector('.m-card-cta').textContent = tr(on ? 'mirror.wearing' : 'mirror.tryOnShort');
      }
    },
  },
  img,
  el('span', { class: 'm-card-text' },
    el('span', { class: 'm-card-brand', text: brandOf(p) }),
    el('span', { class: 'm-card-name', text: nameOf(p) }),
    el('span', { class: 'm-card-price', text: p.price == null ? tr('detail.none') : won(p.price) }),
    cta));
  return card;
}
// 다시 섞기(팔레트에서 왔을 때) · 제품으로(NFC 제품 화면에서 왔을 때)
$('mirror-back-mix').addEventListener('click', () => {
  $('mirror-result').classList.add('hidden');
  $(resultFrom === 'product' ? 'mirror-product' : 'mirror-palette').classList.remove('hidden');
});

// ---------- 선반에 올린 제품(NFC) + 손님 휴대폰으로 챗봇 이어가기 QR ----------
// QR 주소: 휴대폰용 주소(설정) > 공개 주소로 띄웠으면 지금 주소 > localhost 면 서버가 알려 주는 같은 와이파이 PC 주소
// take=1: 손님 휴대폰이라 키오스크 자동 초기화를 하지 않는다 (common.js). lang: 거울과 같은 언어
let shownProduct = null;
let phoneBaseCache;
async function phoneBase() {
  if (cfg.phoneBase) return cfg.phoneBase.replace(/\/?$/, '/');
  const here = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  if (!/^(localhost|127\.|\[::1\])/.test(location.hostname)) return here;
  if (phoneBaseCache === undefined) {
    const r = await api('api/phone-base').catch(() => null);
    phoneBaseCache = r?.ok && r.body.base ? r.body.base : null;
  }
  return phoneBaseCache || here;
}
async function phoneChatUrl(p) {
  const q = new URLSearchParams({ base: p.id, hex: p.color_hex, take: '1' });
  if (isEn()) q.set('lang', 'en');
  return (await phoneBase()) + 'chat.html?' + q;
}
async function showProduct(p) {
  shownProduct = p;
  const noImage = () => el('span', { class: 'mp-noimg', text: tr('card.noImage') });
  $('mp-img').replaceChildren(p.image_url
    ? el('img', { class: 'card-img', src: p.image_url, alt: '', referrerpolicy: 'no-referrer', onerror: (e) => e.target.replaceWith(noImage()) })
    : noImage());
  $('mp-brand').textContent = brandOf(p);
  $('mp-name').textContent = nameOf(p);
  $('mp-price').textContent = p.price == null ? tr('detail.none') : won(p.price);
  $('mirror-qr').replaceChildren();
  delete $('mirror-qr').dataset.url;
  for (const id of ['mirror-main', 'mirror-panel', 'mirror-palette', 'mirror-result']) $(id).classList.add('hidden');
  $('mirror-product').classList.remove('hidden');
  const url = await phoneChatUrl(p);
  if (shownProduct !== p) return;
  $('mirror-qr').dataset.url = url;
  const ZXing = await loadZXing().catch(() => null);
  if (shownProduct !== p) return;
  if (ZXing) {
    const qr = new ZXing.BrowserQRCodeSvgWriter().write(url, 200, 200);
    qr.setAttribute('shape-rendering', 'crispEdges');
    $('mirror-qr').replaceChildren(qr);
  } else {
    $('mirror-qr').replaceChildren(el('span', { class: 'mp-qr-url', text: url })); // QR 을 그릴 수 없으면 주소를 그대로
  }
}
$('mp-palette').addEventListener('click', openPalette);
$('mp-similar').addEventListener('click', () => shownProduct && findSimilar(shownProduct.color_hex, 'product'));

// 텍스처·농도 (팔레트 탭과 같은 다섯 가지 텍스처)
$('mirror-textures').replaceChildren(...Object.keys(TEXTURES).map((key) => el('button', {
  type: 'button', class: 'm-seg', 'data-texture': key, text: tr('texture.' + key),
  onclick: () => { state.look.texture = key; saveLook(); showLook(); },
})));
$('mirror-intensity').addEventListener('input', (e) => {
  state.look.intensity = Number(e.target.value);
  saveLook();
  showLook();
});

// 내 톤 찾기: 카메라에서 볼·이마 피부와 눈 흰자를 여러 프레임 재서 톤을 추정하고(팔레트 탭과 같은 기준, 참고용),
// 어울리는 물감에 '내 톤' 표시. 결과는 팔레트 탭과 같은 저장값 took.lipMatch
const MATCH_FRAMES = 15;
const MATCH_TIMEOUT_MS = 6000;
// 팔레트 위 줄 글자: 안내가 있으면 안내, 없으면 '팔레트' 제목
function palStatus(text) {
  $('mirror-pal-status').textContent = text || tr('mirror.palette');
  $('mirror-pal-status').classList.toggle('is-title', !text);
}
function markPicks(picks = []) {
  for (const b of mixer.paintBtns) b.classList.toggle('paint-pick', picks.includes(PAINT[b.dataset.key].hex));
}
function updateMatchBtn() {
  const off = !state.tracker || !!state.analyze || state.phase !== 'live';
  if ($('mirror-match').disabled !== off) $('mirror-match').disabled = off;
}
function collectTone() {
  const a = state.analyze;
  const tone = state.lips?.tone;
  if (tone) {
    const m = measureTone(video, video.videoWidth, video.videoHeight, tone);
    if (m?.skin) a.samples.push(m);
  }
  if (a.samples.length >= MATCH_FRAMES) finishTone();
  else if (performance.now() - a.started > MATCH_TIMEOUT_MS) {
    state.analyze = null;
    palStatus(tr('lip.matchFaceFail'));
  }
}
function finishTone() {
  const { samples } = state.analyze;
  state.analyze = null;
  const tone = classifyTone(samples);
  if (!tone) { palStatus(tr('lip.matchSkinFail')); return; }
  const picks = matchPresets(tone.season, 3);
  store.set('lipMatch', { season: tone.season, picks });
  markPicks(picks);
  palStatus(tr('mirror.toneResult', { label: tr('season.' + tone.season) }));
}
$('mirror-match').addEventListener('click', () => {
  if (!state.lips?.tone) { palStatus(tr('lip.centerFace')); return; }
  state.analyze = { samples: [], started: performance.now() };
  palStatus(tr('lip.measuring'));
  updateMatchBtn();
});

$('mirror-rec').addEventListener('click', async () => {
  const hex = state.look.hex;
  openPanel(tr('mirror.recAria'), [el('p', { class: 'mirror-note', text: tr('mirror.recLoading') })]);
  const { ok, body } = await api('api/recommend?' + new URLSearchParams({ hex, limit: 8 }));
  if ($('mirror-panel').classList.contains('hidden')) return; // 그사이 닫았다
  if (!ok) { $('mirror-strip').replaceChildren(el('p', { class: 'mirror-note', text: body.error || tr('mirror.recFail') })); return; }
  if (!body.products.length) { $('mirror-strip').replaceChildren(el('p', { class: 'mirror-note', text: tr('mirror.recNone') })); return; }
  $('mirror-strip').replaceChildren(...body.products.map((p) => el('button', {
    type: 'button', class: 'm-prod', 'data-hex': p.color_hex, 'data-product-id': p.id, 'aria-label': tr('mirror.tryAria', { name: shortName(p) }),
    onclick: () => applyProduct(p),
  },
  el('span', { class: 'color-dot', style: `background:${p.color_hex}`, 'aria-hidden': 'true' }),
  el('span', { class: 'm-prod-text' },
    el('span', { class: 'm-prod-name', text: shortName(p) }),
    el('span', { class: 'm-prod-meta', text: p.price == null ? p.color_hex : `${p.color_hex} · ${won(p.price)}` })))));
  showLook();
});

$('mirror-back').addEventListener('click', () => {
  closePanel();
  if (state.panelFrom === 'palette') $('mirror-palette-open').click(); // 팔레트에서 열었으면 팔레트로
});
$('mirror-end').addEventListener('click', toStandby);
$('mirror-retry').addEventListener('click', startCamera);
window.addEventListener('pagehide', stopCamera);

// ---------- 터치 자리 표시 (짧은 물결) ----------
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.mirror-setup, header.nav')) return;
  const r = el('span', { class: 'mirror-ripple' + (reduceMotion ? ' still' : ''), style: `left:${e.clientX}px;top:${e.clientY}px`, 'aria-hidden': 'true' });
  document.body.append(r);
  setTimeout(() => r.remove(), 700);
}, { capture: true, passive: true });

// ---------- 직원용 설정 ----------
const setup = $('mirror-setup');
function openSetup() {
  syncSetup();
  showCamInfo();
  document.body.classList.add('mirror-setup-open'); // 상단 메뉴도 보인다 (다른 화면으로 가기·언어·자동 초기화 테스트)
  if (!setup.open) setup.show();
}
setup.addEventListener('close', () => document.body.classList.remove('mirror-setup-open'));
$('ms-close').addEventListener('click', () => setup.close());

function syncSetup() {
  const press = (group, v) => { for (const b of $(group).children) b.setAttribute('aria-pressed', String(b.dataset.v === String(v))); };
  press('ms-rotate', cfg.rotate);
  press('ms-flip', cfg.flip ? 'on' : 'off');
  press('ms-trigger', cfg.trigger);
  $('ms-scale').value = cfg.scale;
  $('ms-scale-out').textContent = '×' + cfg.scale.toFixed(2);
  $('ms-idle').value = cfg.idle;
  press('ms-border', cfg.border ? 'on' : 'off');
  press('ms-photo', cfg.photo);
  $('ms-win-h').value = cfg.winH;
  $('ms-win-h-out').textContent = cfg.winH + '%';
  $('ms-win-y').value = cfg.winY;
  $('ms-win-y-out').textContent = cfg.winY + '%';
  $('ms-phone-base').value = cfg.phoneBase;
  $('ms-matrix').value = formatMatrix(loadMatrix());
}
const onSeg = (group, fn) => $(group).addEventListener('click', (e) => {
  const b = e.target.closest('button[data-v]');
  if (!b) return;
  fn(b.dataset.v);
  saveCfg();
  syncSetup();
});
onSeg('ms-rotate', (v) => {
  const before = cfg.rotate % 180;
  cfg.rotate = Number(v);
  // 카메라 방향이 바뀌면 그에 맞는 해상도로 다시 연다
  if (cfg.rotate % 180 !== before && state.stream) startCamera();
});
onSeg('ms-flip', (v) => { cfg.flip = v === 'on'; });
onSeg('ms-trigger', (v) => { cfg.trigger = v; });
onSeg('ms-border', (v) => { cfg.border = v === 'on'; });
onSeg('ms-photo', (v) => { cfg.photo = v; });
for (const [id, key] of [['ms-win-h', 'winH'], ['ms-win-y', 'winY']]) {
  $(id).addEventListener('input', (e) => {
    cfg[key] = Number(e.target.value);
    saveCfg();
    $(id + '-out').textContent = cfg[key] + '%';
  });
}
$('ms-scale').addEventListener('input', (e) => {
  cfg.scale = Number(e.target.value);
  saveCfg();
  $('ms-scale-out').textContent = '×' + cfg.scale.toFixed(2);
});
$('ms-phone-base').addEventListener('change', (e) => {
  const v = e.target.value.trim();
  cfg.phoneBase = /^https?:\/\/\S+$/.test(v) ? v : '';
  saveCfg();
  syncSetup();
  if (shownProduct && !$('mirror-product').classList.contains('hidden')) showProduct(shownProduct); // QR 다시 그리기
});
$('ms-idle').addEventListener('change', (e) => {
  const v = Math.round(Number(e.target.value));
  if (v >= 10 && v <= 600) cfg.idle = v;
  saveCfg();
  syncSetup();
});
$('ms-fullscreen').addEventListener('click', async () => {
  $('ms-fs-msg').textContent = '';
  try {
    if (!document.documentElement.requestFullscreen) throw new Error('unsupported');
    await document.documentElement.requestFullscreen();
  } catch {
    $('ms-fs-msg').textContent = tr('mirror.fullscreenFail');
  }
});

const formatMatrix = (m) => [0, 3, 6].map((i) => m.slice(i, i + 3).join(' ')).join('\n');
$('ms-matrix-apply').addEventListener('click', () => {
  const m = $('ms-matrix').value.trim().split(/[\s,]+/).filter(Boolean).map(Number);
  if (m.length !== 9 || !m.every(Number.isFinite)) { $('ms-matrix-msg').textContent = tr('mirror.matrixBad'); return; }
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ matrix: m })); } catch { /* 저장 불가 환경: 이번 화면에만 적용 */ }
  applyMatrix(m);
  $('ms-matrix-msg').textContent = tr('mirror.matrixSaved');
});
$('ms-matrix-reset').addEventListener('click', () => {
  try { localStorage.removeItem(PROFILE_KEY); } catch { /* noop */ }
  applyMatrix(IDENTITY);
  $('ms-matrix').value = formatMatrix(IDENTITY);
  $('ms-matrix-msg').textContent = tr('mirror.matrixSaved');
});

// 왼쪽 위 2초 길게 누르기
let pressTimer = null;
const corner = $('mirror-corner');
corner.addEventListener('pointerdown', () => {
  clearTimeout(pressTimer);
  pressTimer = setTimeout(openSetup, 2000);
});
for (const type of ['pointerup', 'pointerleave', 'pointercancel']) corner.addEventListener(type, () => clearTimeout(pressTimer));
corner.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- 시작 ----------
renderNav({
  idle: {
    seconds: () => cfg.idle,
    active: () => state.phase !== 'standby', // 대기 화면에는 지울 것이 없다
    onReset: toStandby,
  },
});
applyCfg();
applyMatrix(loadMatrix());
// 독 안의 패널이 바뀌어 독 크기가 바뀌면(팔레트·비슷한 제품 열고 닫기) 창을 다시 배치. 화면 크기·방향이 바뀔 때도
if ('ResizeObserver' in window) new ResizeObserver(() => layout()).observe($('mirror-dock'));
window.addEventListener('resize', () => { layout(); showCamInfo(); });
mixer.start(); // 섞어 둔 색이 있으면 바로 입힌다 (팔레트 탭에서 섞은 색도)
markPicks(store.get('lipMatch')?.picks); // 팔레트 탭에서 잰 내 톤 결과도 그대로
showLook();
showCamInfo();
if (new URLSearchParams(location.search).get('setup') === '1') openSetup();
