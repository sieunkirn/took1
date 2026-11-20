// 웹캠 설정값 읽기 (카메라 고르기·해상도·좌우 반전·회전). 설정 창(⚙ 버튼)은 2026-11-17 사용자 요청으로 뺐고(git 기록에 있음),
// 예전에 저장한 값은 계속 적용한다 (lip-camera.js · color-calib.js 등)
//  - 기기에 계속 남도록 localStorage 에 둔다. 키오스크 자동 초기화(store.clear, sessionStorage)에 지워지지 않는다

const KEY = 'took.camSettings';
const DEFAULTS = { deviceId: '', res: '960', mirror: true, rotate: 0 };
const RES = { 480: [640, 480], 720: [1280, 720], 960: [1280, 960], 1080: [1920, 1080] };

export function getCamSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}


/** getUserMedia 의 video 조건. 고른 카메라가 빠져 있으면 아무 카메라나 쓴다(ideal) */
export function videoConstraints(s = getCamSettings()) {
  const [w, h] = RES[s.res] || RES[960];
  const v = { width: { ideal: w }, height: { ideal: h } };
  if (s.deviceId) v.deviceId = { ideal: s.deviceId };
  else v.facingMode = 'user';
  return v;
}
