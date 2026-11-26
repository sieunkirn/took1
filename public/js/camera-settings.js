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
// rotate = 웹캠을 돌려 달았을 때 화면을 돌리는 각도 (0·90·180·270, 기본 0)
// (광각·얼굴 따라가기·전체 담기·기본 270° 회전은 2026-11-23 사용자 요청으로 뺐다. 지금은 그냥 꽉 채운 웹캠 화면)
export const CAM_DEFAULTS = { deviceId: '', label: '', res: '960', fps: 0, mirror: true, rotate: 0 };
export const CAM_RES = { 480: [640, 480], 720: [1280, 720], 960: [1280, 960], 1080: [1920, 1080] };

export function getCamSettings() {
  try { return { ...CAM_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...CAM_DEFAULTS }; }
}

/** 저장 (관리자 웹캠 연결 설정 화면). 저장할 수 없는 환경이면 false */
export function saveCamSettings(s) {
  const v = {};
  for (const k of Object.keys(CAM_DEFAULTS)) v[k] = k in s ? s[k] : CAM_DEFAULTS[k]; // 지금 쓰는 값만 (뺀 기능의 예전 값은 저장할 때 버린다)
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
const EXTERNAL_LABEL = /facing external|external|usb|uvc|webcam|logitech|brio|c920|c922|c930|lenovo|17ef:|elgato|obsbot|razer|외장/i;
const BUILT_IN_LABEL = /facing (front|back)|front|rear|back camera|integrated|easycamera|built[\s-]?in|내장|전면|후면/i;
export function isExternalCamera(label = '') {
  if (/facing external/i.test(label)) return true;
  return EXTERNAL_LABEL.test(label) && !BUILT_IN_LABEL.test(label);
}

// ---------- 웹캠 줌은 가장 넓게 (2026-11-23) ----------
// 줌 되는 웹캠은 줌을 가장 작은 값으로 맞춰 렌즈가 담는 전체를 쓴다. 줌 없는 웹캠은 그대로.
/** @returns {Promise<string>} 결과 설명 (진단 기록용) */
export async function widestZoom(track) {
  const cap = track?.getCapabilities?.()?.zoom;
  if (!cap || typeof cap.min !== 'number') return '웹캠 줌 없음';
  const now = track.getSettings?.().zoom;
  if (now === cap.min) return `웹캠 줌 ${cap.min} (가장 넓게, 범위 ${cap.min}~${cap.max})`;
  try {
    await track.applyConstraints({ advanced: [{ zoom: cap.min }] });
    return `웹캠 줌 ${now ?? '?'} → ${cap.min} (가장 넓게)`;
  } catch (e) {
    return `웹캠 줌 바꾸기 실패: ${e?.name || e}`;
  }
}
