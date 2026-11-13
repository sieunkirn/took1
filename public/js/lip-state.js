// 립 매핑 화면: 화면 준비(상단 메뉴)와 상태(고른 색·텍스처·농도, 카메라·추적 상황), 안내·오류 문구.
import { $, renderNav } from './common.js';
import { t as tr, setText } from './i18n.js';

renderNav();

export const video = $('video');
export const view = $('view');
export const viewCtx = view.getContext('2d', { willReadFrequently: true });

export const INLINE = document.body.dataset.recommend === 'inline';
export const STUDIO = document.body.dataset.layout === 'studio';
export const PALETTE = document.body.dataset.layout === 'palette';
export const MATCH_FRAMES = 15; // 피부색은 여러 프레임 평균으로 측정해 순간적인 빛 변화의 영향을 줄인다
export const MATCH_TIMEOUT_MS = 6000;
// 웹캠 멈춤 대비: 새 프레임이 이만큼 안 오면 카메라를 다시 켠다 (USB 절전·전원 부족으로 끊기지 않고 멈추는 경우)
export const STALL_MS = 4000;
export const MAX_AUTO_RESTARTS = 3; // 연속 자동 재연결 횟수. 넘으면 '다시 연결' 버튼 안내
export const MAX_TRACK_ERRORS = 10; // 추적 오류가 연속 이만큼이면 추적기를 새로 만든다
// 화면 갱신(requestAnimationFrame)이 이만큼 안 돌면 타이머로 대신 그린다.
// 꽉 찬 화면(kiosk.html)처럼 돌리고 키운 틀(iframe) 안에서는 브라우저가 화면 갱신을 멈추거나 늦출 수 있다
export const RAF_STALL_MS = 1500;
export const TIMER_FRAME_MS = 33; // 타이머로 그릴 때 간격 (약 30fps)

export const state = {
  hex: '#C08A94', // 처음 들어왔을 때의 기본 컬러 (프리셋 중 차분한 로즈 핑크)
  texture: 'matte',
  intensity: 80,
  stream: null,
  tracker: undefined, // undefined: 미로드, null: 사용 불가
  lips: null,
  rafId: null,
  timerId: null, // 타이머로 그릴 때(useTimer)의 다음 예약
  useTimer: false, // 화면 갱신이 멈춰 타이머로 그리는 중
  loopBusy: false, // 루프가 입술 추적을 기다리는 중 (이때는 감시가 루프를 다시 깨우지 않는다)
  lastLoopAt: 0, // 마지막으로 루프가 돈 시각
  videoFrames: 0, // getVideoPlaybackQuality().totalVideoFrames 마지막 값 (프레임 도착의 두 번째 증거)
  loopGen: -1, // 카메라 루프가 시작된 세대. 켜는 중(권한·재생·모델 로드 대기)에는 감시 타이머가 끼어들지 않는다
  gen: 0, // 카메라·아바타를 켤 때마다 1씩. 이전 세대의 루프는 깨어나도 스스로 멈춘다 (루프가 겹쳐 돌지 않게)
  lastVideoTime: -1, // 마지막으로 입술을 찾은 프레임 (frameNo 또는 currentTime)
  frameNo: 0, // 웹캠이 실제로 보낸 프레임 수 (requestVideoFrameCallback)
  lastFrameAt: 0, // 마지막으로 새 영상 프레임을 받은 시각
  trackErrors: 0, // 연속 추적 오류 수
  autoRestarts: 0, // 연속 자동 재연결 수 (프레임이 다시 들어오면 0)
  analyze: null, // { samples: [], started } 측정 중일 때만
  source: null, // 'avatar' | 'camera' | null(아직 고르지 않음)
  avatar: null, // { img, i, tone } 아바타 모드일 때 그림과 피부 측정 지점(얼굴 인식이 되면)
};

// ---------- 안내 / 오류 ----------
export function setGuide(text) {
  if ($('guide').textContent !== text) $('guide').textContent = text;
}

export function showError(text) {
  $('error').textContent = text;
  $('error').classList.toggle('hidden', !text);
  $('cam-retry').classList.toggle('hidden', !text);
  if (text) setPlaceholder(false, tr('lip.camUnavailable'));
}

// 카메라 준비 중에는 로딩 스피너를, 사용할 수 없을 때는 안내 문구만 보여준다
export function setPlaceholder(loading, text) {
  $('placeholder').classList.toggle('loading', loading);
  setText($('placeholder-text'), text); // 줄바꿈(\n)은 <br>
}

export function guideText() {
  if (state.source === 'avatar') {
    if (state.analyze) return tr('lip.avatarMeasuring');
    return state.avatar?.tone ? '' : tr('lip.avatarNoTone');
  }
  if (state.tracker === null) return tr('lip.noTracker');
  if (!state.lips) return tr('lip.centerFace');
  if (state.analyze) return tr('lip.measuring');
  return '';
}
