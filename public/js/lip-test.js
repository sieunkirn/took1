import { renderNav, store, go } from './common.js';
import { hslToHex, hexToRgb, rgbToHsl, hexToLab, rgbToHex } from '../lib/color.js';
import { loadTracker, detectVideo, detectImage, fixedLips } from './lip-tracker.js';
import { lipsPath, applyLipColor, smoothLips, imageLoaded, TEXTURES, PRESETS } from './lip-engine.js';

renderNav();

const DEFAULT_COLOR = { h: 350, s: 70, l: 40 };

const $ = (id) => document.getElementById(id);
const video = $('video');
const photo = $('photo');
const mapCanvas = $('map-canvas');
const mapCtx = mapCanvas.getContext('2d', { willReadFrequently: true });
const sliders = { h: $('hue'), s: $('sat'), l: $('lig') };

const state = {
  color: { ...DEFAULT_COLOR },
  colorSource: '기본값',
  source: null, // 'camera' | 'sample' | 'photo'
  samples: [], // 체험용 그림 샘플 목록 (/samples/samples.json)
  sample: null,
  stream: null,
  tracker: undefined, // undefined: 미로드, null: 사용 불가
  lips: null,
  lipsFixed: false,
  rafId: null,
  lastVideoTime: -1,
  trackText: '',
  texture: 'matte',
  intensity: 80,
};

// ---------- 색상 상태 ----------
function currentHex() {
  return hslToHex(state.color);
}

function renderColorInfo() {
  const hex = currentHex();
  const rgb = hexToRgb(hex);
  const lab = hexToLab(hex);
  $('hue-out').textContent = state.color.h + '°';
  $('sat-out').textContent = state.color.s + '%';
  $('lig-out').textContent = state.color.l + '%';
  $('ci-hex').textContent = hex;
  $('ci-rgb').textContent = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  $('ci-hsl').textContent = `${state.color.h}°, ${state.color.s}%, ${state.color.l}%`;
  $('ci-lab').textContent = `L* ${lab.L.toFixed(1)} / a* ${lab.a.toFixed(1)} / b* ${lab.b.toFixed(1)}`;
  $('ci-source').textContent = state.colorSource;
  for (const b of $('swatches').children) b.setAttribute('aria-pressed', String(b.dataset.hex === hex));
}

function setColor(hsl, source) {
  state.color = { h: Math.round(hsl.h), s: Math.round(hsl.s), l: Math.round(hsl.l) };
  state.colorSource = source;
  for (const k of ['h', 's', 'l']) sliders[k].value = state.color[k];
  store.set('lipColor', { ...state.color, hex: currentHex(), source });
  renderColorInfo();
  if (state.source !== 'camera') renderMap(); // 카메라는 루프에서 계속 그린다
}

for (const k of ['h', 's', 'l']) {
  sliders[k].addEventListener('input', () => {
    setColor({ ...state.color, [k]: Number(sliders[k].value) }, '슬라이더 조절');
  });
}
$('reset').addEventListener('click', () => setColor(DEFAULT_COLOR, '기본값(초기화)'));


function sourceElement() {
  if (state.source === 'camera') return video;
  if (state.source === 'photo' || state.source === 'sample') return photo;
  return null;
}

function sourceSize(src) {
  if (src === video) return [video.videoWidth, video.videoHeight];
  if (src === photo) return [photo.naturalWidth, photo.naturalHeight];
  return [src.width, src.height];
}

function renderMap() {
  const src = sourceElement();
  const ctx = mapCtx;
  if (!src) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
    ctx.fillStyle = '#555';
    ctx.font = '16px sans-serif';
    ctx.fillText('입술 매핑 영역: 영상 소스 없음', 20, 30);
    return;
  }
  const [w, h] = sourceSize(src);
  if (!w || !h) return;
  if (mapCanvas.width !== w || mapCanvas.height !== h) {
    mapCanvas.width = w;
    mapCanvas.height = h;
  }
  const mirror = state.source === 'camera';
  ctx.save();
  if (mirror) ctx.setTransform(-1, 0, 0, 1, w, 0);
  ctx.drawImage(src, 0, 0, w, h);
  ctx.restore();
  if (state.lips) {
    applyLipColor(ctx, state.lips, w, h, mirror, { hex: currentHex(), texture: state.texture, intensity: state.intensity });
    // 실제 추적이 아닌 고정/저장 좌표일 때만 점선으로 표시해 구분한다
    if (state.lipsFixed) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = Math.max(1, w / 400);
      ctx.setLineDash([6, 4]);
      ctx.stroke(lipsPath(state.lips, w, h, mirror));
      ctx.setLineDash([]);
    }
  }
}

function setTrackStatus(text) {
  if (text !== state.trackText) {
    state.trackText = text;
    $('track-status').textContent = text;
  }
  $('extract').disabled = !state.lips;
}

function trackMessage() {
  if (state.tracker === null) {
    return state.source === 'sample'
      ? '입술 추적 모듈을 사용할 수 없어 샘플 그림에 저장된 입술 좌표(점선)를 사용합니다. 실제 추적이 아닙니다.'
      : '입술 추적 모듈을 사용할 수 없어 고정 영역(점선, 화면 중앙 하단)을 입술 위치로 가정합니다. 실제 추적이 아닙니다.';
  }
  if (!state.lips) return '얼굴/입술이 감지되지 않았습니다. 얼굴 정면이 화면에 보이도록 해 주세요.';
  return `입술 추적 중 (MediaPipe Face Landmarker, 윤곽점 ${state.lips.outer.length + state.lips.inner.length}개)`;
}

async function ensureTracker() {
  if (state.tracker !== undefined) return state.tracker;
  setTrackStatus('입술 추적 모듈 로딩 중...');
  state.tracker = await loadTracker();
  return state.tracker;
}

// ---------- 소스 전환 ----------
function showSource(which) {
  $('source-placeholder').classList.toggle('hidden', !!which);
  video.classList.toggle('hidden', which !== 'camera');
  photo.classList.toggle('hidden', which !== 'photo' && which !== 'sample');
  video.style.transform = 'scaleX(-1)'; // 셀피 화면처럼 좌우 반전
}

function stopCamera() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
  state.stream = null;
  video.srcObject = null;
  $('cam-stop').disabled = true;
  $('cam-start').disabled = false;
}

function showError(text) {
  const box = $('cam-error');
  box.replaceChildren(document.createTextNode(text + ' '));
  const demoBtn = document.createElement('button');
  demoBtn.type = 'button';
  demoBtn.textContent = '샘플 그림으로 체험 계속하기';
  demoBtn.addEventListener('click', () => startSample());
  box.append(demoBtn);
  box.classList.remove('hidden');
}

function hideError() {
  $('cam-error').classList.add('hidden');
}

function cameraErrorMessage(e) {
  switch (e?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return '카메라 권한이 거부되었습니다. 브라우저 주소창의 권한 설정에서 카메라를 허용한 뒤 다시 시도하세요.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return '사용 가능한 카메라 장치를 찾지 못했습니다.';
    case 'NotReadableError':
      return '카메라가 다른 프로그램에서 사용 중이거나 열 수 없습니다.';
    default:
      return '카메라를 시작하지 못했습니다: ' + (e?.message || e);
  }
}

async function startCamera() {
  hideError();
  if (!navigator.mediaDevices?.getUserMedia) {
    showError('이 브라우저 또는 접속 주소에서는 카메라를 사용할 수 없습니다. (HTTPS 또는 localhost 접속이 필요합니다)');
    return;
  }
  $('cam-start').disabled = true;
  $('cam-status').textContent = '카메라 권한 요청 중...';
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });
  } catch (e) {
    $('cam-start').disabled = false;
    $('cam-status').textContent = '카메라 꺼짐';
    showError(cameraErrorMessage(e));
    return;
  }
  state.source = 'camera';
  state.lips = null;
  showSource('camera');
  video.srcObject = state.stream;
  await video.play();
  $('cam-stop').disabled = false;
  $('cam-status').textContent = `카메라 실행 중 (${video.videoWidth}×${video.videoHeight})`;
  await ensureTracker();
  state.lastVideoTime = -1;
  loop();
}

async function loop() {
  if (state.source !== 'camera' || !state.stream) return;
  if (video.readyState >= 2) {
    if (state.tracker && video.currentTime !== state.lastVideoTime) {
      state.lastVideoTime = video.currentTime;
      state.lips = smoothLips(state.lips, await detectVideo(video, performance.now()));
      state.lipsFixed = false;
    } else if (state.tracker === null) {
      state.lips = fixedLips();
      state.lipsFixed = true;
    }
    renderMap();
    setTrackStatus(trackMessage());
  }
  state.rafId = requestAnimationFrame(loop);
}

// 체험 모드: 그림풍 인물 샘플에 실제 입술 추적을 적용한다
async function loadSamples() {
  try {
    const res = await fetch('samples/samples.json');
    state.samples = res.ok ? await res.json() : [];
  } catch {
    state.samples = [];
  }
  const sel = $('sample-select');
  sel.replaceChildren(...state.samples.map((x) => Object.assign(document.createElement('option'), { value: x.id, textContent: x.label })));
  $('sample-start').disabled = !state.samples.length;
}

async function showImage(src, source, statusText) {
  stopCamera();
  hideError();
  photo.src = src;
  await imageLoaded(photo);
  if (!photo.naturalWidth) {
    showError('이미지를 열 수 없습니다.');
    return false;
  }
  state.source = source;
  state.lips = null;
  showSource(source);
  $('cam-status').textContent = `${statusText} (${photo.naturalWidth}×${photo.naturalHeight})`;
  return true;
}

async function startSample(id = $('sample-select').value) {
  const sample = state.samples.find((x) => x.id === id) || state.samples[0];
  if (!sample) {
    showError('샘플 그림을 불러오지 못했습니다.');
    return;
  }
  state.sample = sample;
  if (!(await showImage(sample.src, 'sample', `체험 모드: ${sample.label}`))) return;
  const tracker = await ensureTracker();
  state.lips = tracker ? await detectImage(photo) : sample.lips;
  state.lipsFixed = !tracker;
  renderMap();
  setTrackStatus(trackMessage());
}

async function startPhoto(file) {
  if (!(await showImage(URL.createObjectURL(file), 'photo', '사진 체험 모드'))) return;
  const tracker = await ensureTracker();
  state.lips = tracker ? await detectImage(photo) : fixedLips();
  state.lipsFixed = !tracker;
  renderMap();
  setTrackStatus(trackMessage());
}

// 입술 영역 픽셀의 평균색을 원본(컬러) 프레임에서 계산한다. 화면에는 값만 표시된다.
function extractLipColor() {
  if (!state.lips) return;
  const src = sourceElement();
  const [w, h] = sourceSize(src);
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, w, h);
  const path = lipsPath(state.lips, w, h, false);
  const xs = state.lips.outer.map((p) => p.x * w), ys = state.lips.outer.map((p) => p.y * h);
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(w, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(h, Math.ceil(Math.max(...ys)));
  if (x1 <= x0 || y1 <= y0) return;
  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!ctx.isPointInPath(path, x + 0.5, y + 0.5, 'evenodd')) continue;
      const i = ((y - y0) * (x1 - x0) + (x - x0)) * 4;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
  }
  if (!n) return;
  const avg = { r: r / n, g: g / n, b: b / n };
  const from = { camera: '카메라', photo: '사진', sample: '샘플 그림' }[state.source];
  setColor(rgbToHsl(avg), `${from} 입술 영역 평균색(${rgbToHex(avg)}) 추출`);
}

$('cam-start').addEventListener('click', startCamera);
$('cam-stop').addEventListener('click', () => {
  stopCamera();
  state.source = null;
  state.lips = null;
  showSource(null);
  $('cam-status').textContent = '카메라 꺼짐';
  renderMap();
  setTrackStatus('입술 추적 대기 중');
});
$('sample-start').addEventListener('click', () => startSample());
$('sample-select').addEventListener('change', () => state.source === 'sample' && startSample());
$('photo-input').addEventListener('change', (e) => e.target.files[0] && startPhoto(e.target.files[0]));
$('extract').addEventListener('click', extractLipColor);
$('recommend').addEventListener('click', () => {
  const hex = currentHex();
  store.set('lipColor', { ...state.color, hex, source: state.colorSource });
  store.remove('recommendQuery');
  store.set('lipReturn', 'lip-test.html');
  go('recommend.html', { hex, source: 'lip' });
});
$('home').addEventListener('click', () => { location.href = 'index.html'; });
window.addEventListener('pagehide', stopCamera);

// ---------- 표시 설정: 텍스처 / 농도 / 프리셋 ----------
function applyDisplaySettings() {
  $('texture').value = state.texture;
  $('intensity').value = state.intensity;
  $('intensity-out').textContent = state.intensity + '%';
  store.set('lipDisplay', { texture: state.texture, intensity: state.intensity });
  if (state.source !== 'camera') renderMap();
}

$('texture').replaceChildren(...Object.entries(TEXTURES).map(([value, t]) => Object.assign(document.createElement('option'), { value, textContent: t.label })));
$('swatches').replaceChildren(...PRESETS.map((hex) => {
  const b = Object.assign(document.createElement('button'), { type: 'button', title: hex });
  b.dataset.hex = hex;
  b.style.background = hex;
  b.setAttribute('aria-label', '프리셋 ' + hex);
  b.addEventListener('click', () => {
    setColor(rgbToHsl(hexToRgb(hex)), `프리셋 ${hex}`);
    b.setAttribute('aria-pressed', 'true');
  });
  return b;
}));
$('texture').addEventListener('change', (e) => { state.texture = e.target.value; applyDisplaySettings(); });
$('intensity').addEventListener('input', (e) => { state.intensity = Number(e.target.value); applyDisplaySettings(); });
const savedDisplay = store.get('lipDisplay') || {};
if (TEXTURES[savedDisplay.texture]) state.texture = savedDisplay.texture;
if (Number.isFinite(savedDisplay.intensity)) state.intensity = savedDisplay.intensity;
applyDisplaySettings();

// 이전에 조절한 색상 복원 (추천 화면에서 '다시 조색하기'로 돌아온 경우)
const saved = store.get('lipColor');
if (saved) setColor(saved, String(saved.source || '').replace(/ \(이전 값 복원\)$/, '') + ' (이전 값 복원)');
else setColor(DEFAULT_COLOR, '기본값');
renderMap();
loadSamples();
