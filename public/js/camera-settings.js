// 웹캠 설정값 (카메라 고르기·해상도·프레임·좌우 반전·회전)
//  - 설정 창: 관리자 화면 → '웹캠 연결 설정' (camera-setup.html, 2026-11-22 갤탭에서 웹캠이 잘 안 잡혀 다시 만듦)
//    (카메라 화면의 ⚙ 설정 버튼은 2026-11-17 사용자 요청으로 뺐고 git 기록에 있음)
//  - 쓰는 곳: lip-camera.js(거울) · color-calib.html(카메라 색 보정)
//  - 기기에 계속 남도록 localStorage 에 둔다. 키오스크 자동 초기화(store.clear, sessionStorage)에 지워지지 않는다

// 툭 앱(APK)에서는 USB 웹캠을 앱이 직접 열어 getUserMedia 에 끼워 넣는다 (갤탭이 USB 웹캠을 카메라로 등록하지 않아서, 2026-11-22)
import './uvc-bridge.js';

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
  // zoom: true = Chrome 에 줌 조절 권한도 같이 요청 (이게 없으면 줌 값이 안 보여서 widestZoom 이 못 바꾼다, 2026-11-23)
  const v = { width: { ideal: w }, height: { ideal: h }, zoom: true };
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

// ---------- 가장 넓게 (2026-11-23 사용자 요청 "좀 더 광각으로") ----------
// 줌을 지원하는 웹캠(Chrome 에서 zoom 이 보이는 것)은 줌을 가장 작은 값으로 맞춰 렌즈가 담는 전체를 쓴다.
// 줌이 없는 웹캠은 이미 가장 넓게 찍고 있으므로 그대로 둔다. 화면 축소(여백 생김)는 11-22 사용자 요청으로 쓰지 않는다.
/** @returns {Promise<string>} 결과 설명 (진단 기록용) */
export async function widestZoom(track) {
  const cap = track?.getCapabilities?.()?.zoom;
  if (!cap || typeof cap.min !== 'number') return '줌 없음 (렌즈 그대로 가장 넓게)';
  const now = track.getSettings?.().zoom;
  if (now === cap.min) return `줌 ${cap.min} (가장 넓게, 범위 ${cap.min}~${cap.max})`;
  try {
    await track.applyConstraints({ advanced: [{ zoom: cap.min }] });
    return `줌 ${now ?? '?'} → ${cap.min} (가장 넓게, 범위 ${cap.min}~${cap.max})`;
  } catch (e) {
    return `줌 바꾸기 실패: ${e?.name || e}`;
  }
}
