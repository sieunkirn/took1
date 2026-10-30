// 사용자용 립 컬러 매핑: 카메라(항상 켜짐) → 실제 입술 추적 → 선택 컬러 합성 → 어울리는 컬러 추천 / 제품 추천.
// lip.html(추천따로): 제품 추천을 추천 화면으로 이동해 보여준다.
// lip-together.html(추천 같이, body[data-recommend="inline"]): 카메라는 그대로 두고 오른쪽 패널에 제품 추천을 보여준다.
// 테스트·검증용 기능(샘플 그림, 사진 업로드, 입술색 추출, HSL 조절, 색상값 표)은 lip-test.html 에 있다.
import { renderNav, store, go, api, el, productCard, FINISH_LABELS, fullName, shortName } from './common.js';
import { hexToRgb, rgbToHsl } from '../lib/color.js';
import { loadTracker, detectVideo } from './lip-tracker.js';
import { applyLipColor, smoothLips, measureTone, classifyTone, matchPresets, SEASONS, TONE_THRESHOLDS, TEXTURES, PRESETS } from './lip-engine.js';

renderNav();

const $ = (id) => document.getElementById(id);
const video = $('video');
const view = $('view');
const viewCtx = view.getContext('2d', { willReadFrequently: true });

const INLINE = document.body.dataset.recommend === 'inline';
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
    $('match').disabled = !state.lips || !!state.analyze;
  }
  state.rafId = requestAnimationFrame(loop);
}

$('cam-retry').addEventListener('click', () => { stopCamera(); startCamera(); });

// ---------- 나에게 어울리는 컬러 ----------
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
  $('match-swatches').replaceChildren(...picks.map(swatchButton));
  $('match-swatches').classList.remove('hidden');
  store.set('lipMatch', { season: tone.season, picks });
  selectColor(picks[0]);
}

$('match').addEventListener('click', () => {
  $('match-result').textContent = '';
  $('match-metrics').textContent = '';
  state.analyze = { samples: [], started: performance.now() };
  $('match').disabled = true;
});

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
}

function selectColor(hex) {
  state.hex = hex;
  store.set('lipColor', { ...rgbToHsl(hexToRgb(hex)), hex, source: '립 컬러 매핑 컬러 선택' });
  applyLook();
}

function swatchButton(hex) {
  const b = Object.assign(document.createElement('button'), { type: 'button', title: hex });
  b.dataset.hex = hex;
  b.style.background = hex;
  b.setAttribute('aria-label', '컬러 ' + hex);
  b.addEventListener('click', () => selectColor(hex));
  return b;
}

$('swatches').replaceChildren(...PRESETS.map(swatchButton));
$('textures').replaceChildren(...Object.entries(TEXTURES).map(([key, t]) => {
  const b = Object.assign(document.createElement('button'), { type: 'button', textContent: t.label });
  b.dataset.texture = key;
  b.addEventListener('click', () => { state.texture = key; applyLook(); });
  return b;
}));
$('intensity').addEventListener('input', (e) => { state.intensity = Number(e.target.value); applyLook(); });

// ---------- 제품 추천 ----------
// 추천 같이 화면: 제품 제형을 가장 가까운 가상 텍스처로 바꿔 입술에 적용한다
const FINISH_TO_TEXTURE = { glossy: 'glossy', matte: 'matte', satin: 'satin', velvet: 'matte' };

async function showInlineRecommend(hex) {
  store.set('lipInlineRec', { hex });
  $('controls').classList.add('hidden');
  $('rec-panel').classList.remove('hidden');
  $('rec-ref').textContent = `기준 컬러 ${hex} 와 비슷한 제품 (색상 유사도 높은 순)`;
  $('rec-status').textContent = '추천 제품을 불러오는 중...';
  $('rec-list').replaceChildren();
  const { ok, body } = await api('api/recommend?' + new URLSearchParams({ hex, limit: 6 }));
  if (!ok) {
    $('rec-status').textContent = body.error || '추천 제품을 불러오지 못했습니다.';
    return;
  }
  $('rec-status').textContent = body.products.length
    ? `${body.products.length}개 제품 · '입술에 발라보기'를 누르면 카메라 화면에 바로 적용됩니다.`
    : '비슷한 제품이 없습니다.';
  $('rec-list').replaceChildren(...body.products.map((p) => productCard(p, {
    from: 'lip-together',
    extraActions: [el('button', {
      type: 'button',
      text: '입술에 발라보기',
      onclick: () => {
        state.hex = p.color_hex;
        state.texture = FINISH_TO_TEXTURE[p.finish] || state.texture;
        store.set('lipColor', { ...rgbToHsl(hexToRgb(p.color_hex)), hex: p.color_hex, source: `제품 ${shortName(p)}` });
        applyLook();
        $('rec-status').textContent = `입술에 적용 중: ${fullName(p)}${p.finish ? ` (${FINISH_LABELS[p.finish]})` : ''}`;
      },
    })],
  })));
}

$('recommend').addEventListener('click', () => {
  store.set('lipColor', { ...rgbToHsl(hexToRgb(state.hex)), hex: state.hex, source: '립 컬러 매핑 컬러 선택' });
  if (INLINE) {
    showInlineRecommend(state.hex);
    return;
  }
  store.remove('recommendQuery');
  store.set('lipReturn', 'lip.html');
  go('recommend.html', { hex: state.hex, source: 'lip' });
});
if (INLINE) {
  $('rec-back').addEventListener('click', () => {
    store.remove('lipInlineRec');
    $('rec-panel').classList.add('hidden');
    $('controls').classList.remove('hidden');
  });
}
window.addEventListener('pagehide', stopCamera);

// 이전 선택 복원 (추천 화면에서 '다시 조색하기'로 돌아온 경우 등)
const savedLook = store.get('lipDisplay') || {};
if (TEXTURES[savedLook.texture]) state.texture = savedLook.texture;
if (Number.isFinite(savedLook.intensity)) state.intensity = savedLook.intensity;
const savedColor = store.get('lipColor');
if (savedColor?.hex) state.hex = savedColor.hex;
const savedMatch = store.get('lipMatch');
if (savedMatch?.picks?.length) {
  $('match-result').textContent = '이전에 추천받은 컬러입니다. 다시 측정하려면 버튼을 눌러 주세요.';
  $('match-swatches').replaceChildren(...savedMatch.picks.map(swatchButton));
  $('match-swatches').classList.remove('hidden');
}
applyLook();
// 제품 상세에서 돌아오면 보던 추천 목록을 다시 연다
const savedInline = INLINE && store.get('lipInlineRec');
if (savedInline?.hex) showInlineRecommend(savedInline.hex);
startCamera();
