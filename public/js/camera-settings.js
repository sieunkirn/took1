// 웹캠 설정: 립 매핑 카메라 화면(.stage) 오른쪽 위 ⚙ 버튼 → 설정 창
//  - 카메라 고르기(USB 웹캠이 여러 대일 때), 해상도, 좌우 반전, 회전(웹캠을 돌려 달았을 때)
//  - 기기에 계속 남도록 localStorage 에 둔다. 키오스크 자동 초기화(store.clear, sessionStorage)에 지워지지 않는다
import { isEn } from './i18n.js';

const KEY = 'took.camSettings';
const DEFAULTS = { deviceId: '', res: '960', mirror: true, rotate: 0 };
const RES = { 480: [640, 480], 720: [1280, 720], 960: [1280, 960], 1080: [1920, 1080] };

export function getCamSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

function saveCamSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 저장 불가 환경: 이번 화면에서만 적용 */ }
}

/** getUserMedia 의 video 조건. 고른 카메라가 빠져 있으면 아무 카메라나 쓴다(ideal) */
export function videoConstraints(s = getCamSettings()) {
  const [w, h] = RES[s.res] || RES[960];
  const v = { width: { ideal: w }, height: { ideal: h } };
  if (s.deviceId) v.deviceId = { ideal: s.deviceId };
  else v.facingMode = 'user';
  return v;
}

const L = () => (isEn()
  ? { title: 'Camera settings', cam: 'Camera', auto: 'Default camera', res: 'Resolution', mirror: 'Mirror (flip left-right)', rotate: 'Rotation', apply: 'Apply', cancel: 'Cancel', reset: 'Reset', refresh: 'Find cameras again', none: 'No camera found. Plug in the webcam and tap "Find cameras again".', perm: 'Allow camera access to see camera names.', cur: 'In use' }
  : { title: '카메라 설정', cam: '카메라', auto: '기본 카메라', res: '해상도', mirror: '좌우 반전 (거울처럼)', rotate: '회전', apply: '적용', cancel: '취소', reset: '처음 값으로', refresh: '카메라 다시 찾기', none: '카메라를 찾지 못했어요. 웹캠을 USB 에 꽂은 뒤 "카메라 다시 찾기"를 눌러 주세요.', perm: '카메라 권한을 허용하면 카메라 이름이 보여요.', cur: '사용 중' });

let dialog = null;

function build(onApply) {
  const l = L();
  dialog = document.createElement('dialog');
  dialog.className = 'cam-settings';
  dialog.innerHTML = `
    <form method="dialog">
      <h2>${l.title}</h2>
      <label>${l.cam}<select name="deviceId"></select></label>
      <p class="cam-note" hidden></p>
      <button type="button" class="cam-refresh">${l.refresh}</button>
      <label>${l.res}<select name="res">
        <option value="480">640 × 480</option>
        <option value="720">1280 × 720 (HD)</option>
        <option value="960">1280 × 960</option>
        <option value="1080">1920 × 1080 (Full HD)</option>
      </select></label>
      <label class="cam-check"><input type="checkbox" name="mirror"> ${l.mirror}</label>
      <fieldset><legend>${l.rotate}</legend>
        ${[0, 90, 180, 270].map((d) => `<label><input type="radio" name="rotate" value="${d}"> ${d}°</label>`).join('')}
      </fieldset>
      <div class="cam-actions">
        <button type="button" class="cam-reset">${l.reset}</button>
        <span></span>
        <button value="cancel">${l.cancel}</button>
        <button value="apply" class="btn-dark">${l.apply}</button>
      </div>
    </form>`;
  document.body.append(dialog);
  const f = dialog.querySelector('form');
  dialog.querySelector('.cam-refresh').addEventListener('click', () => fillDevices(f.deviceId.value));
  dialog.querySelector('.cam-reset').addEventListener('click', () => fill(DEFAULTS));
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close('cancel'); }); // 바깥 누르면 닫기
  dialog.addEventListener('close', () => {
    if (dialog.returnValue !== 'apply') return;
    const s = { deviceId: f.deviceId.value, res: f.res.value, mirror: f.mirror.checked, rotate: Number(f.rotate.value) || 0 };
    const prev = getCamSettings();
    saveCamSettings(s);
    onApply(s, { restart: s.deviceId !== prev.deviceId || s.res !== prev.res });
  });
}

async function fillDevices(selected) {
  const l = L();
  const sel = dialog.querySelector('select[name="deviceId"]');
  const note = dialog.querySelector('.cam-note');
  let cams = [];
  try { cams = (await navigator.mediaDevices?.enumerateDevices() || []).filter((d) => d.kind === 'videoinput'); } catch { /* 권한·환경 */ }
  const current = currentDeviceId?.() || '';
  sel.replaceChildren(new Option(l.auto, ''), ...cams.map((d, i) => new Option(
    `${d.label || `${l.cam} ${i + 1}`}${d.deviceId && d.deviceId === current ? ` · ${l.cur}` : ''}`, d.deviceId)));
  // 고른 카메라가 지금 빠져 있어도 목록에 남겨 둔다 (꽂으면 다시 그 카메라를 쓴다)
  if (selected && !cams.some((d) => d.deviceId === selected)) sel.append(new Option(`${l.cam} (${isEn() ? 'not connected' : '연결 안 됨'})`, selected));
  sel.value = selected || '';
  note.hidden = cams.length > 0 && cams.some((d) => d.label);
  note.textContent = cams.length ? l.perm : l.none;
}

function fill(s) {
  const f = dialog.querySelector('form');
  fillDevices(s.deviceId);
  f.res.value = String(s.res);
  f.mirror.checked = !!s.mirror;
  f.querySelector(`input[name="rotate"][value="${s.rotate}"]`).checked = true;
}

let currentDeviceId = null;

/**
 * ⚙ 버튼을 stage 에 붙인다
 * @param {HTMLElement} stage .stage
 * @param {{ onApply: (s, { restart: boolean }) => void, currentDeviceId?: () => string }} opts
 */
export function mountCamSettings(stage, { onApply, currentDeviceId: cur } = {}) {
  if (!stage) return;
  currentDeviceId = cur || null;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cam-gear';
  btn.title = btn.ariaLabel = L().title;
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  btn.addEventListener('click', () => {
    if (!dialog) build(onApply);
    fill(getCamSettings());
    dialog.showModal();
  });
  stage.append(btn);
}
