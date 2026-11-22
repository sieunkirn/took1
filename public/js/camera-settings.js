// 웹캠 설정값 (카메라 고르기·해상도·프레임·좌우 반전·회전)
//  - 설정 창: 관리자 화면 → '웹캠 연결 설정' (camera-setup.html, 2026-11-22 갤탭에서 웹캠이 잘 안 잡혀 다시 만듦)
//    (카메라 화면의 ⚙ 설정 버튼은 2026-11-17 사용자 요청으로 뺐고 git 기록에 있음)
//  - 쓰는 곳: lip-camera.js(거울) · color-calib.html(카메라 색 보정)
//  - 기기에 계속 남도록 localStorage 에 둔다. 키오스크 자동 초기화(store.clear, sessionStorage)에 지워지지 않는다

const KEY = 'took.camSettings';
// deviceId '' = 자동(외장 USB 웹캠이 보이면 그쪽, 없으면 전면 카메라). label 은 고른 카메라 이름(화면 표시·기록용)
// fps 0 = 웹캠 기본값
export const CAM_DEFAULTS = { deviceId: '', label: '', res: '960', fps: 0, mirror: true, rotate: 0 };
export const CAM_RES = { 480: [640, 480], 720: [1280, 720], 960: [1280, 960], 1080: [1920, 1080] };

export function getCamSettings() {
  try { return { ...CAM_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...CAM_DEFAULTS }; }
}

/** 저장 (관리자 웹캠 연결 설정 화면). 저장할 수 없는 환경이면 false */
export function saveCamSettings(s) {
  const v = { ...CAM_DEFAULTS, ...s };
  try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch { return false; }
}

export function clearCamSettings() {
  try { localStorage.removeItem(KEY); } catch { /* 저장 불가 환경 */ }
}

/** getUserMedia 의 video 조건. 고른 카메라가 빠져 있으면 아무 카메라나 쓴다(ideal) */
export function videoConstraints(s = getCamSettings()) {
  const [w, h] = CAM_RES[s.res] || CAM_RES[960];
  const v = { width: { ideal: w }, height: { ideal: h } };
  if (Number(s.fps) > 0) v.frameRate = { ideal: Number(s.fps), max: Number(s.fps) };
  if (s.deviceId) v.deviceId = { ideal: s.deviceId };
  else v.facingMode = 'user';
  return v;
}

// 카메라 이름으로 외장(USB) 웹캠인지 짐작한다.
// Android Chrome(갤탭)은 이름이 'camera2 0, facing front' 처럼 나오고, USB 웹캠은 'facing external' 이다
const EXTERNAL_LABEL = /facing external|external|usb|uvc|webcam|logitech|brio|c920|c922|c930|elgato|obsbot|razer|외장/i;
const BUILT_IN_LABEL = /facing (front|back)|front|rear|back camera|integrated|built[\s-]?in|내장|전면|후면/i;
export function isExternalCamera(label = '') {
  if (/facing external/i.test(label)) return true;
  return EXTERNAL_LABEL.test(label) && !BUILT_IN_LABEL.test(label);
}
