// 립 컬러 매핑 카메라: 테스트 방식 선택(아바타 / 카메라) → 입술 추적 → 선택 컬러 합성 → 어울리는 컬러 / 제품 추천.
// 지금은 테스트 단계라 카메라가 자동으로 켜지지 않는다. '아바타로 테스트하기'는 입술 위치가 미리 저장된 샘플 그림(samples/)에
// 색을 입히고, '카메라로 테스트하기'를 눌러야 카메라가 켜진다.
// 같은 스크립트를 세 화면이 쓴다. 화면에 없는 조절 요소(어울리는 컬러, 프리셋, 조제 슬라이더, 추천 버튼)는 건너뛴다.
//  - lip-together.html (body[data-recommend="inline"]): 오른쪽 패널에 제품 추천을 보여 준다
//  - studio.html (body[data-layout="studio"]): 챗봇(chat.js)과 한 화면. 추천은 챗봇이 '추천' 탭에 보여 준다
//  - palette.html (body[data-layout="palette"]): 색은 팔레트(palette.js)가 took:apply 로 보낸다.
//    어울리는 컬러는 바로 입히지 않고, 누르면 팔레트에 한 방울 떨어지도록 took:pick 으로 넘긴다
// 창 이벤트  보냄: took:color { hex, texture } / took:recommend { hex } / took:show-tab { tab }
//                  took:match { season, picks } / took:pick { hex, from } (팔레트 화면)
//            받음: took:apply { hex, finish, quiet, source }
import { renderNav, store, api, el, productCard, FINISH_LABELS, fullName, shortName, toast, skeletonCards } from './common.js';
import { hexToRgb, rgbToHsl, hslToHex } from '../lib/color.js';
import { loadTracker, detectVideo } from './lip-tracker.js';
import { drawLipFrame, trackLips, stopStream, cameraErrorMessage, FINISH_TO_TEXTURE } from './lip-view.js'; // 그리기·카메라 공통 (거울 모드와 함께 쓴다)
import { measureTone, classifyTone, matchPresets, SEASONS, TONE_THRESHOLDS, TEXTURES, PRESETS } from './lip-engine.js';
import { t as tr, setText, finishText as finishName } from './i18n.js'; // 화면 문구 (한국어/영어). 이 파일엔 t 라는 지역 변수가 있어 tr 로 부른다

renderNav();

const $ = (id) => document.getElementById(id);
const video = $('video');
const view = $('view');
const viewCtx = view.getContext('2d', { willReadFrequently: true });

const INLINE = document.body.dataset.recommend === 'inline';
const STUDIO = document.body.dataset.layout === 'studio';
const PALETTE = document.body.dataset.layout === 'palette';
const MATCH_FRAMES = 15; // 피부색은 여러 프레임 평균으로 측정해 순간적인 빛 변화의 영향을 줄인다
const MATCH_TIMEOUT_MS = 6000;

const state = {
  hex: '#C08A94', // 처음 들어왔을 때의 기본 컬러 (프리셋 중 차분한 로즈 핑크)
  texture: 'matte',
  intensity: 80,
  stream: null,
  tracker: undefined, // undefined: 미로드, null: 사용 불가
  lips: null,
  rafId: null,
  lastVideoTime: -1,
  analyze: null, // { samples: [], started } 측정 중일 때만
  source: null, // 'avatar' | 'camera' | null(아직 고르지 않음)
  avatar: null, // { img, i, tone } 아바타 모드일 때 그림과 피부 측정 지점(얼굴 인식이 되면)
};

// ---------- 안내 / 오류 ----------
function setGuide(text) {
  if ($('guide').textContent !== text) $('guide').textContent = text;
}

function showError(text) {
  $('error').textContent = text;
  $('error').classList.toggle('hidden', !text);
  $('cam-retry').classList.toggle('hidden', !text);
  if (text) setPlaceholder(false, tr('lip.camUnavailable'));
}

// 카메라 준비 중에는 로딩 스피너를, 사용할 수 없을 때는 안내 문구만 보여준다
function setPlaceholder(loading, text) {
  $('placeholder').classList.toggle('loading', loading);
  setText($('placeholder-text'), text); // 줄바꿈(\n)은 <br>
}

function guideText() {
  if (state.source === 'avatar') {
    if (state.analyze) return tr('lip.avatarMeasuring');
    return state.avatar?.tone ? '' : tr('lip.avatarNoTone');
  }
  if (state.tracker === null) return tr('lip.noTracker');
  if (!state.lips) return tr('lip.centerFace');
  if (state.analyze) return tr('lip.measuring');
  return '';
}

// ---------- 그리기 ----------
// 지금 보여 주는 원본: 아바타 그림 또는 카메라 영상
function sourceFrame() {
  if (state.source === 'avatar') {
    const img = state.avatar?.img;
    return img ? { src: img, w: img.naturalWidth, h: img.naturalHeight, mirror: false } : null;
  }
  return { src: video, w: video.videoWidth, h: video.videoHeight, mirror: true };
}

function render() {
  const f = sourceFrame();
  if (!f?.w || !f?.h) return;
  drawLipFrame(viewCtx, f, state.lips, state);
}

// ---------- 카메라 ('카메라로 테스트하기'를 누르면 켜지고, 아바타로 바꾸거나 나갈 때 꺼진다) ----------
function stopCamera() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  stopStream(state.stream);
  state.stream = null;
  video.srcObject = null;
}

async function startCamera() {
  stopCamera();
  state.source = 'camera';
  state.analyze = null;
  setSourceButtons();
  view.classList.add('hidden');
  $('placeholder').classList.remove('hidden');
  showError('');
  setPlaceholder(true, tr('lip.camPreparing'));
  if (!navigator.mediaDevices?.getUserMedia) {
    showError(tr('lip.camInsecure'));
    return;
  }
  setGuide(tr('lip.camRequesting'));
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });
  } catch (e) {
    setGuide('');
    showError(cameraErrorMessage(e));
    return;
  }
  // 카메라가 도중에 끊기면(장치 분리 등) 다시 연결할 수 있게 안내한다
  state.stream.getVideoTracks()[0]?.addEventListener('ended', () => {
    stopCamera();
    showError(tr('lip.camLost'));
  });
  if (state.source !== 'camera') { stopCamera(); return; } // 권한을 기다리는 동안 아바타로 바꿨다
  state.lips = null;
  video.srcObject = state.stream;
  await video.play();
  $('placeholder').classList.add('hidden');
  view.classList.remove('hidden');
  if (state.tracker === undefined) {
    setGuide(tr('lip.faceLoading'));
    state.tracker = await loadTracker();
  }
  state.lastVideoTime = -1;
  loop();
}

// 새 카메라 프레임마다 입술을 찾은 뒤 같은 프레임에 색을 입힌다 (입술 위치와 영상이 항상 맞는다)
async function loop() {
  if (state.source === 'avatar') {
    if (state.analyze) collectSkin();
    render();
    setGuide(guideText());
    if ($('match')) $('match').disabled = !state.avatar?.tone || !!state.analyze;
    state.rafId = requestAnimationFrame(loop);
    return;
  }
  if (!state.stream) return;
  if (video.readyState >= 2) {
    if (state.tracker && video.currentTime !== state.lastVideoTime) {
      state.lastVideoTime = video.currentTime;
      state.lips = await trackLips(state.lips, video);
      if (state.analyze) collectSkin();
    }
    render();
    setGuide(guideText());
    if ($('match')) $('match').disabled = !state.lips || !!state.analyze;
  }
  state.rafId = requestAnimationFrame(loop);
}

$('cam-retry').addEventListener('click', startCamera);
window.addEventListener('pagehide', stopCamera);

// ---------- 아바타 (입술 위치가 저장된 샘플 그림) ----------
let samples = null;
const loadImage = (src) => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => fail(new Error(tr('lip.imgFail')));
  img.src = src;
});

// 다시 누르면 다음 그림으로 바뀐다
async function startAvatar() {
  const next = state.source === 'avatar' ? (state.avatar.i + 1) : 0;
  stopCamera();
  state.source = 'avatar';
  state.analyze = null;
  showError('');
  setSourceButtons();
  setPlaceholder(true, tr('lip.avatarLoading'));
  try {
    samples ||= await fetch('samples/samples.json').then((r) => r.json());
    const i = next % samples.length;
    const s = samples[i];
    const img = await loadImage(s.src);
    if (state.source !== 'avatar') return;
    state.avatar = { img, i, tone: null };
    state.lips = { outer: s.lips.outer, inner: s.lips.inner };
    $('placeholder').classList.add('hidden');
    view.classList.remove('hidden');
    setSourceButtons();
    loop();
    // 피부 톤 측정 지점은 얼굴 인식으로 찾는다 (그림이라 인식이 안 되면 어울리는 컬러는 카메라에서만)
    if (state.tracker === undefined) state.tracker = await loadTracker();
    const found = state.tracker ? await detectVideo(img, performance.now()) : null;
    if (state.source === 'avatar' && state.avatar.img === img) state.avatar.tone = found?.tone || null;
  } catch (e) {
    setPlaceholder(false, tr('lip.avatarFail'));
    setGuide(e.message);
  }
}

// 테스트 방식 버튼: 카메라 아래에 둘을 나란히. 지금 쓰는 쪽은 눌린 상태로 보인다
const sourceRow = el('div', { class: 'row source-row', role: 'group', 'aria-label': tr('lip.sourceGroup') },
  el('button', { type: 'button', id: 'use-avatar', onclick: startAvatar }),
  el('button', { type: 'button', id: 'use-camera', text: tr('lip.useCamera'), onclick: startCamera }));
$('cam-retry').closest('.row').before(sourceRow);
function setSourceButtons() {
  const n = samples?.length;
  $('use-avatar').textContent = state.source === 'avatar' && n ? tr('lip.avatarNext', { i: state.avatar ? state.avatar.i + 1 : 1, n }) : tr('lip.useAvatar');
  $('use-avatar').setAttribute('aria-pressed', String(state.source === 'avatar'));
  $('use-camera').setAttribute('aria-pressed', String(state.source === 'camera'));
}
setSourceButtons();

// ---------- 컬러 / 텍스처 / 농도 ----------
function applyLook() {
  for (const b of document.querySelectorAll('#swatches button, #match-swatches button')) {
    b.setAttribute('aria-pressed', String(b.dataset.hex === state.hex));
  }
  for (const b of $('textures').children) b.setAttribute('aria-pressed', String(b.dataset.texture === state.texture));
  $('intensity').value = state.intensity;
  $('intensity-out').textContent = state.intensity + '%';
  // 선택한 컬러(색상값·텍스처) 문구는 2026-11-11 화면에서 뺐다
  store.set('lipDisplay', { texture: state.texture, intensity: state.intensity });
  syncMixSliders();
  window.tookLipHex = state.hex; // 합본 화면에서 챗봇이 늦게 로드돼도 현재 색을 알 수 있게
  window.dispatchEvent(new CustomEvent('took:color', { detail: { hex: state.hex, texture: state.texture } }));
}

// 고른 색은 다른 화면(홈 최근 기록, 챗봇 기준 색)에서도 쓰도록 저장한다
function saveColor(hex, source) {
  store.set('lipColor', { ...rgbToHsl(hexToRgb(hex)), hex, source });
}

function selectColor(hex, source = '립 컬러 매핑 컬러 선택') {
  state.hex = hex;
  saveColor(hex, source);
  applyLook();
}

// 제품 색과 제형을 입술에 입힌다
function applyProduct(hex, finish, source) {
  if (FINISH_TO_TEXTURE[finish]) state.texture = FINISH_TO_TEXTURE[finish];
  selectColor(hex, source);
}

function swatchButton(hex) {
  const b = Object.assign(document.createElement('button'), { type: 'button', title: hex });
  b.dataset.hex = hex;
  b.style.background = hex;
  b.setAttribute('aria-label', tr('lip.colorAria', { hex }));
  b.addEventListener('click', () => {
    if (PALETTE) window.dispatchEvent(new CustomEvent('took:pick', { detail: { hex, from: b } }));
    else selectColor(hex);
  });
  return b;
}

$('swatches')?.replaceChildren(...PRESETS.map(swatchButton));
$('textures').replaceChildren(...Object.entries(TEXTURES).map(([key, t]) => {
  const b = Object.assign(document.createElement('button'), { type: 'button', textContent: tr('texture.' + key) });
  b.dataset.texture = key;
  b.addEventListener('click', () => { state.texture = key; applyLook(); });
  return b;
}));
$('intensity').addEventListener('input', (e) => { state.intensity = Number(e.target.value); applyLook(); });

// 색 조제: 색상·채도·명도 슬라이더로 직접 만든 색 (합본 화면)
const mix = ['h', 's', 'l'].map((k) => [k, $(`mix-${k}`)]).filter(([, input]) => input);
function syncMixSliders() {
  if (!mix.length) return;
  const hsl = rgbToHsl(hexToRgb(state.hex));
  for (const [k, input] of mix) {
    input.value = Math.round(hsl[k]);
    $(`mix-${k}-out`).textContent = Math.round(hsl[k]) + (k === 'h' ? '°' : '%');
  }
}
for (const [, input] of mix) {
  input.addEventListener('input', () => {
    const [h, s, l] = mix.map(([, i]) => Number(i.value));
    selectColor(hslToHex({ h, s, l }), '직접 조제한 컬러');
  });
}

// ---------- 나에게 어울리는 컬러 (피부·눈 흰자 측정) ----------
function collectSkin() {
  const a = state.analyze;
  const tone = state.source === 'avatar' ? state.avatar?.tone : state.lips?.tone;
  const f = sourceFrame();
  if (tone && f) {
    const m = measureTone(f.src, f.w, f.h, tone);
    if (m?.skin) a.samples.push(m);
  }
  if (a.samples.length >= MATCH_FRAMES) finishMatch();
  else if (performance.now() - a.started > MATCH_TIMEOUT_MS) {
    state.analyze = null;
    $('match-result').textContent = tr('lip.matchFaceFail');
  }
}

function showMatchPicks(picks) {
  $('match-swatches').replaceChildren(...picks.map(swatchButton));
  $('match-swatches').classList.remove('hidden');
}

function finishMatch() {
  const { samples } = state.analyze;
  state.analyze = null;
  const tone = classifyTone(samples);
  if (!tone) {
    $('match-result').textContent = tr('lip.matchSkinFail');
    return;
  }
  const picks = matchPresets(tone.season, 3);
  const near = tone.runnerUp ? tr('lip.matchNear', { label: tr('season.' + tone.runnerUp) }) : '';
  $('match-result').textContent = tr('lip.matchResult', { label: tr('season.' + tone.season), desc: tr('season.' + tone.season + '.desc'), near })
    + tr(PALETTE ? 'lip.matchPalette' : 'lip.matchApplied');
  // 측정값: 기준값 조정에 쓸 수 있도록 그대로 보여준다
  const m = tone.metrics, T = TONE_THRESHOLDS;
  if ($('match-metrics')) $('match-metrics').textContent = [
    tr('lip.mHue', { v: m.hue.toFixed(1), t: T.warmHue }),
    tr('lip.mLight', { v: m.L.toFixed(1), t: T.lightL }),
    m.contrast === null ? tr('lip.mNoContrast') : tr('lip.mContrast', { v: m.contrast.toFixed(1), t: T.contrast }),
    tr(m.wb ? 'lip.mWb' : 'lip.mNoWb'),
  ].join(' · ');
  showMatchPicks(picks);
  store.set('lipMatch', { season: tone.season, picks });
  if (PALETTE) window.dispatchEvent(new CustomEvent('took:match', { detail: { season: tone.season, picks } }));
  else selectColor(picks[0]);
}

$('match')?.addEventListener('click', () => {
  $('match-result').textContent = '';
  if ($('match-metrics')) $('match-metrics').textContent = '';
  state.analyze = { samples: [], started: performance.now() };
  $('match').disabled = true;
});

// ---------- 제품 추천 ----------
// 합본 화면에서는 오른쪽 '추천' 탭의 목록에 그린다
async function showInlineRecommend(hex) {
  const ref = tr('lip.ref', { hex });
  if (STUDIO) {
    window.dispatchEvent(new CustomEvent('took:show-tab', { detail: { tab: 'rec' } }));
  } else {
    store.set('lipInlineRec', { hex });
    $('controls').classList.add('hidden');
    $('rec-panel').classList.remove('hidden');
    $('rec-ref').textContent = ref;
  }
  $('rec-status').textContent = tr('lip.recLoading');
  $('rec-list').replaceChildren(...skeletonCards(3));
  const { ok, body } = await api('api/recommend?' + new URLSearchParams({ hex, limit: 6 }));
  if (!ok) {
    $('rec-status').textContent = body.error || tr('lip.recFail');
    return;
  }
  $('rec-status').textContent = (STUDIO ? ref + ' · ' : '') + (body.products.length
    ? tr('lip.recCount', { n: body.products.length })
    : tr('lip.recNone'));
  $('rec-list').replaceChildren(...body.products.map((p) => productCard(p, {
    extraActions: [el('button', {
      type: 'button',
      text: tr('lip.tryOn'),
      onclick: () => {
        applyProduct(p.color_hex, p.finish, `제품 ${shortName(p)}`);
        $('rec-status').textContent = tr('lip.applying', { name: fullName(p), finish: p.finish ? ` (${finishName(p.finish)})` : '' });
        toast(tr('lip.appliedToast', { name: shortName(p) }));
      },
    })],
  })));
}

$('recommend')?.addEventListener('click', () => {
  saveColor(state.hex, '립 컬러 매핑 컬러 선택');
  // 합본 화면: 같은 화면의 챗봇이 이 색과 비슷한 제품을 찾아 '추천' 탭에 보여 준다
  if (STUDIO) window.dispatchEvent(new CustomEvent('took:recommend', { detail: { hex: state.hex } }));
  else showInlineRecommend(state.hex);
});
$('rec-back')?.addEventListener('click', () => {
  store.remove('lipInlineRec');
  $('rec-panel').classList.add('hidden');
  $('controls').classList.remove('hidden');
});

// 다른 스크립트가 색을 보낸다: 합본의 챗봇 추천 카드 '입술에 발라보기', 팔레트(섞는 동안 quiet 로 계속)
window.addEventListener('took:apply', (e) => {
  const { hex, finish, quiet = false, source = '추천 제품 색' } = e.detail;
  applyProduct(hex, finish, source);
  if (!quiet) toast(tr('lip.productApplied'));
});

// ---------- 시작: 이전 선택 복원 → 카메라 ----------
const savedLook = store.get('lipDisplay') || {};
if (TEXTURES[savedLook.texture]) state.texture = savedLook.texture;
if (Number.isFinite(savedLook.intensity)) state.intensity = savedLook.intensity;
const savedColor = store.get('lipColor');
if (savedColor?.hex) state.hex = savedColor.hex;
const savedMatch = store.get('lipMatch');
if ($('match-result') && savedMatch?.picks?.length) {
  $('match-result').textContent = tr('lip.prevMatch');
  showMatchPicks(savedMatch.picks);
}
applyLook();
setPlaceholder(false, ''); // 테스트 방식 안내 문구는 뺐다 (위 두 버튼으로 고른다)
setGuide('');
// 제품 상세에서 돌아오면 보던 추천 목록을 다시 연다
const savedInline = INLINE && store.get('lipInlineRec');
if (savedInline?.hex) showInlineRecommend(savedInline.hex);
