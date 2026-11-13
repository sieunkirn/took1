// 립 매핑 화면: 입술을 비추는 쪽. 카메라 켜고 끄기·멈춤 감시·입술 추적 루프, 아바타 그림, 화면 그리기.
import { $, el } from './common.js';
import { loadTracker, detectVideo, resetTracker } from './lip-tracker.js';
import { drawLipFrame, trackLips, stopStream, cameraErrorMessage } from './lip-view.js';
import { getCamSettings, videoConstraints, mountCamSettings } from './camera-settings.js';
import { t as tr } from './i18n.js';
import { video, view, viewCtx, STALL_MS, MAX_AUTO_RESTARTS, MAX_TRACK_ERRORS, RAF_STALL_MS, TIMER_FRAME_MS, state, setGuide, showError, setPlaceholder, guideText } from './lip-state.js';
import { collectSkin } from './lip-look.js';

// ---------- 그리기 ----------
// 지금 보여 주는 원본: 아바타 그림 또는 카메라 영상
export function sourceFrame() {
  if (state.source === 'avatar') {
    const img = state.avatar?.img;
    return img ? { src: img, w: img.naturalWidth, h: img.naturalHeight, mirror: false } : null;
  }
  const cam = getCamSettings();
  return { src: video, w: video.videoWidth, h: video.videoHeight, mirror: cam.mirror, rotate: cam.rotate };
}

function render() {
  const f = sourceFrame();
  if (!f?.w || !f?.h) return;
  drawLipFrame(viewCtx, f, state.lips, state);
}

// ---------- 카메라 ('카메라로 테스트하기'를 누르면 켜지고, 아바타로 바꾸거나 나갈 때 꺼진다) ----------
function stopCamera() {
  state.gen++; // 지금 await 중인 루프가 깨어나도 다음 프레임을 예약하지 않는다
  if (state.rafId) cancelAnimationFrame(state.rafId);
  clearTimeout(state.timerId);
  state.rafId = state.timerId = null;
  state.loopBusy = false;
  stopStream(state.stream);
  state.stream = null;
  video.srcObject = null;
}

// auto: 멈춤 감지로 다시 켜는 경우 (버튼으로 켤 때는 자동 재연결 횟수를 0 으로)
async function startCamera({ auto = false } = {}) {
  if (!auto) state.autoRestarts = 0;
  stopCamera();
  const gen = state.gen;
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
      video: videoConstraints(),
      audio: false,
    });
  } catch (e) {
    if (gen !== state.gen) return; // 기다리는 동안 다른 카메라·아바타로 바뀌었다
    setGuide('');
    showError(cameraErrorMessage(e));
    return;
  }
  const stream = state.stream;
  if (gen !== state.gen || state.source !== 'camera') { stopStream(stream); return; } // 권한을 기다리는 동안 아바타로 바꿨거나 다시 켰다
  // 카메라가 도중에 끊기면(장치 분리 등) 다시 연결할 수 있게 안내한다
  stream.getVideoTracks()[0]?.addEventListener('ended', () => {
    if (state.stream !== stream) return; // 우리가 끈 예전 스트림
    stopCamera();
    showError(tr('lip.camLost'));
  });
  state.lips = null;
  video.srcObject = stream;
  try {
    // 프레임을 하나도 안 보내는 웹캠이면 play() 가 끝나지 않는다 → 시간 제한
    await Promise.race([video.play(), new Promise((_, fail) => setTimeout(() => fail(Object.assign(new Error('stall'), { name: 'StallTimeout' })), STALL_MS))]);
  } catch (e) {
    if (gen !== state.gen) return;
    if (e.name === 'StallTimeout') { handleStall(); return; }
    stopCamera();
    showError(cameraErrorMessage(e));
    return;
  }
  if (gen !== state.gen) return;
  $('placeholder').classList.add('hidden');
  view.classList.remove('hidden');
  if (state.tracker === undefined) {
    setGuide(tr('lip.faceLoading'));
    state.tracker = await loadTracker();
    if (gen !== state.gen) return;
  }
  state.lastVideoTime = -1;
  state.lastFrameAt = state.lastLoopAt = performance.now();
  state.videoFrames = 0;
  watchFrames(gen);
  state.trackErrors = 0;
  state.loopGen = gen;
  loop(gen);
}

// 웹캠이 실제 프레임을 보낼 때마다 센다. 스트림 영상의 currentTime 은 웹캠이 멈춰도 계속 늘어나서
// 멈춤을 알 수 없다 (실제로 확인함). requestVideoFrameCallback 은 새 프레임이 올 때만 불린다
const RVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
function watchFrames(gen) {
  if (!RVFC) return; // 지원하지 않는 브라우저: currentTime 으로 대신 판단한다
  const onFrame = () => {
    if (gen !== state.gen) return;
    state.frameNo++;
    state.lastFrameAt = performance.now();
    video.requestVideoFrameCallback(onFrame);
  };
  video.requestVideoFrameCallback(onFrame);
}

// 새 프레임이 한동안 안 온다: 웹캠이 끊기지 않은 채 멈췄다 → 몇 번까지는 저절로 다시 켠다
function handleStall() {
  if (state.autoRestarts < MAX_AUTO_RESTARTS) {
    state.autoRestarts++;
    console.warn(`[took] 웹캠 프레임이 ${STALL_MS / 1000}초 동안 멈춰 다시 켭니다 (${state.autoRestarts}/${MAX_AUTO_RESTARTS})`);
    startCamera({ auto: true });
  } else {
    stopCamera();
    showError(tr('lip.camLost'));
  }
}

// 추적 오류가 계속되면(GPU 컨텍스트 끊김 등) 추적기를 새로 만든다. 그동안은 영상만 보여 준다
async function reloadTracker() {
  console.warn('[took] 입술 추적 오류가 계속돼 추적기를 다시 만듭니다');
  state.trackErrors = 0;
  state.tracker = undefined; // 루프는 추적 없이 영상만 그린다
  state.lips = null;
  resetTracker();
  state.tracker = await loadTracker();
}

// 새 카메라 프레임마다 입술을 찾은 뒤 같은 프레임에 색을 입힌다 (입술 위치와 영상이 항상 맞는다)
// gen: 이 루프를 시작한 세대. 카메라를 다시 켜거나 끄면 예전 루프는 여기서 멈춘다
function scheduleNext(gen) {
  if (state.useTimer) state.timerId = setTimeout(() => loop(gen), TIMER_FRAME_MS);
  else state.rafId = requestAnimationFrame(() => loop(gen));
}

async function loop(gen = state.gen) {
  if (gen !== state.gen) return;
  state.lastLoopAt = performance.now();
  if (state.source === 'avatar') {
    try {
      if (state.analyze) collectSkin();
      render();
      setGuide(guideText());
      if ($('match')) $('match').disabled = !state.avatar?.tone || !!state.analyze;
    } catch (e) {
      console.warn('[took] 아바타 그리기 오류:', e);
    }
    scheduleNext(gen);
    return;
  }
  if (!state.stream) return;
  // 어떤 오류가 나도 다음 프레임은 반드시 예약한다 (예전에는 오류 한 번에 화면이 굳었다)
  try {
    // 타이머로 그릴 때는 requestVideoFrameCallback 도 멈춰 있을 수 있어 currentTime 으로 새 프레임을 판단한다
    const frame = RVFC && !state.useTimer ? state.frameNo : video.currentTime;
    if (video.readyState >= 2 && frame !== state.lastVideoTime) {
      state.lastVideoTime = frame;
      if (!RVFC) state.lastFrameAt = performance.now();
      state.autoRestarts = 0; // 프레임이 다시 들어온다
      if (state.tracker) {
        state.loopBusy = true;
        try {
          state.lips = await trackLips(state.lips, video);
          state.trackErrors = 0;
        } catch (e) {
          if (gen !== state.gen) return;
          console.warn('[took] 입술 추적 오류:', e);
          if (++state.trackErrors >= MAX_TRACK_ERRORS) reloadTracker();
        } finally {
          if (gen === state.gen) state.loopBusy = false;
        }
        if (gen !== state.gen) return;
        if (state.analyze) collectSkin();
      }
    } else if (performance.now() - state.lastFrameAt > STALL_MS && !document.hidden) {
      handleStall();
      return;
    }
    if (video.readyState >= 2) {
      render();
      setGuide(guideText());
      if ($('match')) $('match').disabled = !state.lips || !!state.analyze;
    }
  } catch (e) {
    console.warn('[took] 카메라 프레임 처리 오류:', e);
  }
  if (gen !== state.gen) return;
  scheduleNext(gen);
}

// 감시 타이머: 화면 갱신과 따로 1초마다 돈다 (화면 갱신이 멈추면 루프 안의 멈춤 감시도 같이 멈추므로)
//  - 웹캠 프레임 도착은 requestVideoFrameCallback 과 totalVideoFrames 둘 중 하나라도 늘면 인정한다
//    (화면 갱신이 늦어지면 requestVideoFrameCallback 도 같이 늦어진다)
//  - 루프가 RAF_STALL_MS 동안 안 돌았으면 화면 갱신이 멈춘 것 → 타이머로 그리기로 바꾸고 루프를 다시 깨운다
setInterval(() => {
  if (state.source !== 'camera' || !state.stream || state.loopGen !== state.gen || document.hidden) return;
  const now = performance.now();
  const q = video.getVideoPlaybackQuality?.().totalVideoFrames || 0;
  if (q !== state.videoFrames) { state.videoFrames = q; state.lastFrameAt = Math.max(state.lastFrameAt, now); }
  if (now - state.lastLoopAt > RAF_STALL_MS && !state.loopBusy) {
    if (!state.useTimer) {
      state.useTimer = true;
      console.warn(`[took] 화면 갱신(requestAnimationFrame)이 ${RAF_STALL_MS / 1000}초 넘게 멈춰 타이머로 그립니다`
        + ` (틀 안: ${window.top !== window}, 창 크기 ${innerWidth}×${innerHeight})`);
    }
    if (state.rafId) cancelAnimationFrame(state.rafId);
    clearTimeout(state.timerId);
    state.rafId = state.timerId = null;
    loop(state.gen);
  } else if (now - state.lastFrameAt > STALL_MS) {
    handleStall(); // 루프는 도는데 프레임이 안 온다 (보통은 루프 안에서 먼저 처리된다)
  }
}, 1000);

// 탭이 숨겨진 동안은 프레임 검사를 멈추므로, 돌아오면 멈춤 판정 시계를 새로 시작한다
document.addEventListener('visibilitychange', () => { if (!document.hidden) state.lastFrameAt = performance.now(); });

$('cam-retry').addEventListener('click', () => startCamera());
// 카메라 화면 오른쪽 위 ⚙: 카메라·해상도를 바꾸면 카메라를 다시 켜고, 반전·회전은 다음 프레임부터 바로 적용된다
mountCamSettings(view.closest('.stage'), {
  onApply: (s, { restart }) => {
    if (state.source === 'camera' && (restart || !state.stream)) startCamera();
    else render();
  },
  currentDeviceId: () => state.stream?.getVideoTracks()[0]?.getSettings().deviceId || '',
});
window.addEventListener('pagehide', stopCamera);

// ---------- 아바타 (입술 위치가 저장된 샘플 그림) ----------
export let samples = null;
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
  const gen = state.gen;
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
    if (gen !== state.gen || state.source !== 'avatar') return; // 그새 다시 눌렀거나 카메라로 바꿨다
    state.avatar = { img, i, tone: null };
    state.lips = { outer: s.lips.outer, inner: s.lips.inner };
    $('placeholder').classList.add('hidden');
    view.classList.remove('hidden');
    setSourceButtons();
    loop(gen);
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
  el('button', { type: 'button', id: 'use-camera', text: tr('lip.useCamera'), onclick: () => startCamera() }));
$('cam-retry').closest('.row').before(sourceRow);
function setSourceButtons() {
  const n = samples?.length;
  $('use-avatar').textContent = state.source === 'avatar' && n ? tr('lip.avatarNext', { i: state.avatar ? state.avatar.i + 1 : 1, n }) : tr('lip.useAvatar');
  $('use-avatar').setAttribute('aria-pressed', String(state.source === 'avatar'));
  $('use-camera').setAttribute('aria-pressed', String(state.source === 'camera'));
}
setSourceButtons();
