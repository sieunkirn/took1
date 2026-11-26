// 카메라 색 보정 (2026-11-20): 관리자 화면 → '카메라 색 보정'(color-calib.html)에서 컬러체커의 흰색 칸을 한 번 찍어 맞춘다 (2026-11-26 흰 종이 → 컬러체커 흰색 칸).
//  - 흰색 칸은 원래 흰색(무채색)이니, 그 칸이 노랗게/파랗게 찍힌 만큼 빨강·초록·파랑에 곱할 값(이득, 선형 RGB)을 구한다
//  - 웹캠이 지원하면 그때의 화이트밸런스·노출을 고정해 둔다(자동 색 맞춤이 손님마다 바뀌지 않게)
//  - 값은 이 기기 localStorage 에 남고, '보정값 복사'로 받은 코드(C1.…)를 BUILT_IN_CODE 에 넣으면 어느 기기에서나 같은 값을 쓴다
//    (터치 보정 touch-calib.js 의 T1 코드와 같은 방식)
// DOM 없이 불러와도 되는 순수 모듈이다 (node 단위 테스트에서 씀)

const KEY = 'took.colorCalib';
// 관리자 화면 '보정값 복사'로 받은 코드(C1.…)를 여기에 붙여 넣으면 웹에 고정된다. 비어 있으면 기기에 저장한 값만 쓴다
export const BUILT_IN_CODE = '';

const REF_WHITE = 235; // 노출을 고정했을 때 흰색 칸을 이 밝기(sRGB)의 흰색으로 맞춘다 (눈 흰자 기준색과 비슷한 밝기)
const GAIN_MIN = 0.25, GAIN_MAX = 8;

export const toLinear = (v) => { const c = Math.max(0, Math.min(255, v)) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (lin) => 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];

/**
 * 흰색 칸을 찍은 평균색(sRGB 0~255)으로 채널별 이득(선형 RGB에 곱하는 값)을 구한다.
 * 노출을 고정했으면 밝기까지 기준 흰색에 맞추고, 아니면 밝기는 그대로 두고 색 틀어짐만 없앤다
 * (노출이 자동이면 손님 얼굴을 찍을 때 밝기가 또 바뀌므로 흰 칸 밝기에 맞추는 건 의미가 없다)
 */
export function computeGain(rgb, { exposureLocked = false } = {}) {
  const lin = rgb.map(toLinear);
  const target = exposureLocked ? toLinear(REF_WHITE) : lum(lin);
  return lin.map((c) => Math.min(GAIN_MAX, Math.max(GAIN_MIN, target / Math.max(1e-4, c))));
}

/**
 * 측정한 네모 칸이 흰색 기준으로 쓸 만한지 본다.
 * @param {{ mean: number[], std: number, clipped: number }} s mean=평균 sRGB, std=밝기 표준편차, clipped=하얗게 날아간 픽셀 비율
 * @returns {null | 'dark' | 'bright' | 'uneven' | 'colored'} 문제 없으면 null
 */
export function checkSample({ mean, std, clipped = 0 }) {
  const y = 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2];
  if (y < 60) return 'dark';
  if (clipped > 0.25 || Math.min(...mean) > 252) return 'bright';
  if (std > 22) return 'uneven';
  const hi = Math.max(...mean), lo = Math.min(...mean);
  if ((hi - lo) / hi > 0.6) return 'colored'; // 조명 색으로는 이만큼 틀어지지 않는다 → 흰색 칸이 아니다
  return null;
}

/** 이득을 쉬운 말로: 카메라가 어떤 색 쪽으로 찍고 있었나 */
export function describeCast(gain) {
  const [r, , b] = gain;
  const warm = b / r; // 파랑을 더 올려야 하면 노랗게(따뜻하게) 찍고 있었다
  if (warm > 1.08) return '카메라가 노랗게(따뜻하게) 찍고 있었어요 → 파랑을 올려 되돌려요';
  if (warm < 0.92) return '카메라가 파랗게(차갑게) 찍고 있었어요 → 빨강을 올려 되돌려요';
  if (gain[1] < 0.93) return '카메라가 초록빛으로 찍고 있었어요 → 초록을 내려 되돌려요';
  if (gain[1] > 1.08) return '카메라가 분홍빛으로 찍고 있었어요 → 초록을 올려 되돌려요';
  return '색 틀어짐이 거의 없어요';
}

// ---------- 코드 (C1.base64url(JSON)) ----------
const b64url = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));

function valid(o) {
  return !!o && Array.isArray(o.gain) && o.gain.length === 3
    && o.gain.every((g) => Number.isFinite(g) && g >= GAIN_MIN && g <= GAIN_MAX);
}
const pick = (o) => ({
  gain: o.gain.map((g) => Math.round(g * 10000) / 10000),
  exposureLocked: !!o.exposureLocked,
  lock: o.lock || null,
  raw: o.raw ? o.raw.map((v) => Math.round(v)) : null,
  at: o.at || null,
});

export function encodeCode(o) {
  return valid(o) ? 'C1.' + b64url(JSON.stringify(pick(o))) : null;
}
export function decodeCode(code) {
  if (typeof code !== 'string' || !code.startsWith('C1.')) return null;
  try {
    const o = JSON.parse(unb64url(code.slice(3).trim()));
    return valid(o) ? pick(o) : null;
  } catch { return null; }
}

// ---------- 저장 ----------
const ls = () => { try { return globalThis.localStorage || null; } catch { return null; } };

function localCalib() {
  try {
    const o = JSON.parse(ls()?.getItem(KEY) || 'null');
    return valid(o) ? pick(o) : null;
  } catch { return null; }
}

/** 지금 쓰는 보정값: 이 기기에 저장한 값 → 웹에 고정한 값 → 없음(null) */
export function getColorCalib() {
  const local = localCalib();
  if (local) return { ...local, source: 'local' };
  const built = decodeCode(BUILT_IN_CODE);
  return built ? { ...built, source: 'builtin' } : null;
}
export function builtInCalib() { return decodeCode(BUILT_IN_CODE); }
export function saveColorCalib(o) {
  if (!valid(o)) return false;
  try { ls()?.setItem(KEY, JSON.stringify(pick({ ...o, at: o.at || new Date().toISOString() }))); return true; } catch { return false; }
}
export function clearColorCalib() {
  try { ls()?.removeItem(KEY); } catch { /* 저장 불가 환경 */ }
}

// ---------- 웹캠 자동 색·밝기 고정 ----------
/** 이 웹캠이 화이트밸런스·노출을 고정할 수 있나 (Chrome 의 MediaStreamTrack 확장 기능, 웹캠마다 다르다) */
export function lockSupport(track) {
  const caps = track?.getCapabilities?.() || {};
  return {
    wb: Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('manual'),
    exposure: Array.isArray(caps.exposureMode) && caps.exposureMode.includes('manual'),
  };
}

/** 지금 웹캠이 자동으로 맞춘 값 그대로 고정한다. 고정한 값을 돌려준다 (못 하면 null) */
export async function lockCamera(track) {
  const sup = lockSupport(track);
  if (!sup.wb && !sup.exposure) return null;
  const st = track.getSettings?.() || {};
  const lock = {};
  if (sup.wb) { lock.wb = true; if (Number.isFinite(st.colorTemperature)) lock.colorTemperature = st.colorTemperature; }
  if (sup.exposure) { lock.exposure = true; if (Number.isFinite(st.exposureTime)) lock.exposureTime = st.exposureTime; }
  return (await applyCameraLock(track, lock)) ? lock : null;
}

/** 저장해 둔 고정값을 웹캠에 적용한다. 지원하지 않는 웹캠이면 조용히 넘어간다. 하나라도 적용되면 true */
export async function applyCameraLock(track, lock = getColorCalib()?.lock) {
  if (!track?.applyConstraints || !lock) return false;
  const sup = lockSupport(track);
  let ok = false;
  const tryApply = async (c) => {
    try { await track.applyConstraints({ advanced: [c] }); ok = true; } catch (e) { console.warn('[took] 웹캠 고정 실패', c, e?.name || e); }
  };
  if (lock.wb && sup.wb) await tryApply(lock.colorTemperature ? { whiteBalanceMode: 'manual', colorTemperature: lock.colorTemperature } : { whiteBalanceMode: 'manual' });
  if (lock.exposure && sup.exposure) await tryApply(lock.exposureTime ? { exposureMode: 'manual', exposureTime: lock.exposureTime } : { exposureMode: 'manual' });
  return ok;
}

/** 자동으로 되돌린다 (다시 측정하기 전에) */
export async function unlockCamera(track) {
  const sup = lockSupport(track);
  try {
    if (sup.wb) await track.applyConstraints({ advanced: [{ whiteBalanceMode: 'continuous' }] });
    if (sup.exposure) await track.applyConstraints({ advanced: [{ exposureMode: 'continuous' }] });
  } catch { /* 지원 안 함 */ }
}
