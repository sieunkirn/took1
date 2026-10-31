// 립 컬러 매핑 카메라: 카메라(항상 켜짐) → 입술 추적 → 선택 컬러 합성 → 어울리는 컬러 / 제품 추천.
// 같은 스크립트를 세 화면이 쓴다. 화면에 없는 조절 요소(어울리는 컬러, 프리셋, 조제 슬라이더, 추천 버튼)는 건너뛴다.
//  - lip-together.html (body[data-recommend="inline"]): 오른쪽 패널에 제품 추천을 보여 준다
//  - studio.html (body[data-layout="studio"]): 챗봇(chat.js)과 한 화면. 추천은 챗봇이 '추천' 탭에 보여 준다
//  - palette.html: 색은 팔레트(palette.js)가 took:apply 로 보낸다
// 창 이벤트  보냄: took:color { hex, texture } / took:recommend { hex } / took:show-tab { tab }
//            받음: took:apply { hex, finish, quiet, source }
import { renderNav, store, api, el, productCard, FINISH_LABELS, fullName, shortName, toast, skeletonCards } from './common.js';
import { hexToRgb, rgbToHsl, hslToHex } from '../lib/color.js';
import { loadTracker, detectVideo } from './lip-tracker.js';
import { applyLipColor, smoothLips, measureTone, classifyTone, matchPresets, SEASONS, TONE_THRESHOLDS, TEXTURES, PRESETS } from './lip-engine.js';

renderNav();

const $ = (id) => document.getElementById(id);
const video = $('video');
const view = $('view');
const viewCtx = view.getContext('2d', { willReadFrequently: true });

const INLINE = document.body.dataset.recommend === 'inline';
const STUDIO = document.body.dataset.layout === 'studio';
const MATCH_FRAMES = 15; // 피부색은 여러 프레임 평균으로 측정해 순간적인 빛 변화의 영향을 줄인다
const MATCH_TIMEOUT_MS = 6000;
// 제품 제형 → 가장 가까운 가상 텍스처
const FINISH_TO_TEXTURE = { glossy: 'glossy', matte: 'matte', satin: 'satin', velvet: 'matte' };

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
};

// ---------- 안내 / 오류 ----------
function setGuide(text) {
  if ($('guide').textContent !== text) $('guide').textContent = text;
}

function showError(text) {
  $('error').textContent = text;
  $('error').classList.toggle('hidden', !text);
  $('cam-retry').classList.toggle('hidden', !text);
  if (text) setPlaceholder(false, '카메라를 사용할 수 없습니다');
}

// 카메라 준비 중에는 로딩 스피너를, 사용할 수 없을 때는 안내 문구만 보여준다
function setPlaceholder(loading, text) {
  $('placeholder').classList.toggle('loading', loading);
  $('placeholder-text').textContent = text;
}

function guideText() {
  if (state.tracker === null) return '이 브라우저에서는 얼굴 인식을 사용할 수 없어 컬러를 적용하지 못했습니다.';
  if (!state.lips) return '얼굴이 화면 가운데에 오도록 맞춰 주세요.';
  if (state.analyze) return '피부 톤을 측정하고 있어요. 정면을 보고 잠시 기다려 주세요.';
  return '';
}

// ---------- 그리기 ----------
function render() {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return;
  if (view.width !== w || view.height !== h) { view.width = w; view.height = h; }
  viewCtx.save();
  viewCtx.setTransform(-1, 0, 0, 1, w, 0); // 셀피 화면처럼 좌우 반전
  viewCtx.drawImage(video, 0, 0, w, h);
  viewCtx.restore();
  if (state.lips) applyLipColor(viewCtx, state.lips, w, h, true, state);
}

// ---------- 카메라 (페이지에 들어오면 바로 켜지고, 나갈 때 꺼진다) ----------
function cameraErrorMessage(e) {
  switch (e?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return '카메라 권한이 거부되었습니다. 주소창의 카메라 권한을 허용한 뒤 "카메라 다시 연결"을 눌러 주세요.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return '사용할 수 있는 카메라를 찾지 못했습니다. 카메라를 연결한 뒤 다시 시도해 주세요.';
    case 'NotReadableError':
      return '카메라가 다른 프로그램에서 사용 중입니다. 다른 프로그램을 닫고 다시 시도해 주세요.';
    default:
      return '카메라를 시작하지 못했습니다: ' + (e?.message || e);
  }
}

function stopCamera() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
  state.stream = null;
  video.srcObject = null;
}

async function startCamera() {
  showError('');
  setPlaceholder(true, ['카메라를 준비하고 있습니다', '권한 요청이 뜨면 허용해 주세요'].join('\n'));
  if (!navigator.mediaDevices?.getUserMedia) {
    showError('이 브라우저 또는 접속 주소에서는 카메라를 사용할 수 없습니다. (HTTPS 또는 localhost 접속 필요)');
    return;
  }
  setGuide('카메라 권한을 요청하고 있습니다...');
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
    showError('카메라 연결이 끊어졌습니다. "카메라 다시 연결"을 눌러 주세요.');
  });
  state.lips = null;
  video.srcObject = state.stream;
  await video.play();
  $('placeholder').classList.add('hidden');
  view.classList.remove('hidden');
  if (state.tracker === undefined) {
    setGuide('얼굴 인식 준비 중...');
    state.tracker = await loadTracker();
  }
  state.lastVideoTime = -1;
  loop();
}

// 새 카메라 프레임마다 입술을 찾은 뒤 같은 프레임에 색을 입힌다 (입술 위치와 영상이 항상 맞는다)
async function loop() {
  if (!state.stream) return;
  if (video.readyState >= 2) {
    if (state.tracker && video.currentTime !== state.lastVideoTime) {
      state.lastVideoTime = video.currentTime;
      state.lips = smoothLips(state.lips, await detectVideo(video, performance.now()));
      if (state.analyze) collectSkin();
    }
    render();
    setGuide(guideText());
    if ($('match')) $('match').disabled = !state.lips || !!state.analyze;
  }
  state.rafId = requestAnimationFrame(loop);
}

$('cam-retry').addEventListener('click', () => { stopCamera(); startCamera(); });
window.addEventListener('pagehide', stopCamera);

// ---------- 컬러 / 텍스처 / 농도 ----------
function applyLook() {
  for (const b of document.querySelectorAll('#swatches button, #match-swatches button')) {
    b.setAttribute('aria-pressed', String(b.dataset.hex === state.hex));
  }
  for (const b of $('textures').children) b.setAttribute('aria-pressed', String(b.dataset.texture === state.texture));
  $('intensity').value = state.intensity;
  $('intensity-out').textContent = state.intensity + '%';
  $('color-name').textContent = `선택한 컬러 ${state.hex} · ${TEXTURES[state.texture].label}`;
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
  b.setAttribute('aria-label', '컬러 ' + hex);
  b.addEventListener('click', () => selectColor(hex));
  return b;
}

$('swatches')?.replaceChildren(...PRESETS.map(swatchButton));
$('textures').replaceChildren(...Object.entries(TEXTURES).map(([key, t]) => {
  const b = Object.assign(document.createElement('button'), { type: 'button', textContent: t.label });
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
  if (state.lips?.tone) {
    const m = measureTone(video, video.videoWidth, video.videoHeight, state.lips.tone);
    if (m?.skin) a.samples.push(m);
  }
  if (a.samples.length >= MATCH_FRAMES) finishMatch();
  else if (performance.now() - a.started > MATCH_TIMEOUT_MS) {
    state.analyze = null;
    $('match-result').textContent = '얼굴을 충분히 인식하지 못했습니다. 밝은 곳에서 정면을 보고 다시 시도해 주세요.';
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
    $('match-result').textContent = '피부색을 측정하지 못했습니다. 밝은 곳에서 정면을 보고 다시 시도해 주세요.';
    return;
  }
  const picks = matchPresets(tone.season, 3);
  const near = tone.runnerUp ? ` 경계에 가까워 '${SEASONS[tone.runnerUp].label}'일 수도 있어요.` : '';
  $('match-result').textContent = `추정 톤: ${tone.label} (${tone.desc}).${near} 추천 컬러 3가지 중 첫 번째를 적용했어요.`;
  // 측정값: 기준값 조정에 쓸 수 있도록 그대로 보여준다
  const m = tone.metrics, T = TONE_THRESHOLDS;
  $('match-metrics').textContent = [
    `피부 색상각 ${m.hue.toFixed(1)}° (웜 기준 ${T.warmHue}° 이상)`,
    `피부 밝기 L ${m.L.toFixed(1)} (밝은 톤 기준 ${T.lightL})`,
    m.contrast === null ? '눈썹 대비 측정 안 됨' : `피부-눈썹 대비 ${m.contrast.toFixed(1)} (기준 ${T.contrast})`,
    m.wb ? '눈 흰자 기준 조명 보정 적용' : '조명 보정 못 함(눈 흰자 인식 실패)',
  ].join(' · ');
  showMatchPicks(picks);
  store.set('lipMatch', { season: tone.season, picks });
  selectColor(picks[0]);
}

$('match')?.addEventListener('click', () => {
  $('match-result').textContent = '';
  $('match-metrics').textContent = '';
  state.analyze = { samples: [], started: performance.now() };
  $('match').disabled = true;
});

// ---------- 제품 추천 ----------
// image: true 면 대표 이미지가 있는 제품만 모아서 추천한다 (테스트용 '이미지ver.' 버튼)
// 합본 화면에서는 오른쪽 '추천' 탭의 목록에 그린다
async function showInlineRecommend(hex, { image = false } = {}) {
  const ref = image
    ? `[이미지ver.] 이미지가 있는 제품 중 기준 컬러 ${hex} 와 비슷한 순`
    : `기준 컬러 ${hex} 와 비슷한 제품 (색상 유사도 높은 순)`;
  if (STUDIO) {
    window.dispatchEvent(new CustomEvent('took:show-tab', { detail: { tab: 'rec' } }));
  } else {
    store.set('lipInlineRec', { hex, image });
    $('controls').classList.add('hidden');
    $('rec-panel').classList.remove('hidden');
    $('rec-ref').textContent = ref;
  }
  $('rec-status').textContent = '추천 제품을 불러오는 중...';
  $('rec-list').replaceChildren(...skeletonCards(3));
  const { ok, body } = await api('api/recommend?' + new URLSearchParams(image ? { hex, limit: 30, image: 1 } : { hex, limit: 6 }));
  if (!ok) {
    $('rec-status').textContent = body.error || '추천 제품을 불러오지 못했습니다.';
    return;
  }
  $('rec-status').textContent = (STUDIO ? ref + ' · ' : '') + (body.products.length
    ? `${body.products.length}개 제품 · '입술에 발라보기'를 누르면 카메라 화면에 바로 적용됩니다.`
    : '비슷한 제품이 없습니다.');
  $('rec-list').replaceChildren(...body.products.map((p) => productCard(p, {
    extraActions: [el('button', {
      type: 'button',
      text: '입술에 발라보기',
      onclick: () => {
        applyProduct(p.color_hex, p.finish, `제품 ${shortName(p)}`);
        $('rec-status').textContent = `입술에 적용 중: ${fullName(p)}${p.finish ? ` (${FINISH_LABELS[p.finish]})` : ''}`;
        toast(`${shortName(p)} 컬러를 입술에 발랐어요`);
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
$('recommend-img')?.addEventListener('click', () => {
  saveColor(state.hex, '립 컬러 매핑 컬러 선택');
  showInlineRecommend(state.hex, { image: true });
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
  if (!quiet) toast('추천 제품 컬러를 입술에 발랐어요');
});

// ---------- 시작: 이전 선택 복원 → 카메라 ----------
const savedLook = store.get('lipDisplay') || {};
if (TEXTURES[savedLook.texture]) state.texture = savedLook.texture;
if (Number.isFinite(savedLook.intensity)) state.intensity = savedLook.intensity;
const savedColor = store.get('lipColor');
if (savedColor?.hex) state.hex = savedColor.hex;
const savedMatch = store.get('lipMatch');
if ($('match-result') && savedMatch?.picks?.length) {
  $('match-result').textContent = '이전에 추천받은 컬러입니다. 다시 측정하려면 버튼을 눌러 주세요.';
  showMatchPicks(savedMatch.picks);
}
applyLook();
// 제품 상세에서 돌아오면 보던 추천 목록을 다시 연다
const savedInline = INLINE && store.get('lipInlineRec');
if (savedInline?.hex) showInlineRecommend(savedInline.hex, { image: !!savedInline.image });
startCamera();
