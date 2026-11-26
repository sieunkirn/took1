// 거울(립 매핑) 텍스처·농도 버튼. 색은 palette.js 가 took:apply 로 보낸다.
import { $, store, toast } from './common.js';
import { TEXTURES } from './lip-engine.js';
import { FINISH_TO_TEXTURE } from './lip-view.js';
import { t as tr } from './i18n.js';
import { state } from './lip-state.js';

// ---------- 컬러 / 텍스처 / 농도 ----------
export function applyLook() {
  for (const b of $('textures').children) b.setAttribute('aria-pressed', String(b.dataset.texture === state.texture));
  $('intensity').value = state.intensity;
  $('intensity-out').textContent = state.intensity + '%';
  store.set('lipDisplay', { texture: state.texture, intensity: state.intensity });
  window.tookLipHex = state.hex; // 지금 입술 색 (자동 테스트가 읽는다)
  window.dispatchEvent(new CustomEvent('took:color', { detail: { hex: state.hex, texture: state.texture } }));
}

$('textures').replaceChildren(...Object.entries(TEXTURES).map(([key, t]) => {
  const b = Object.assign(document.createElement('button'), { type: 'button', textContent: tr('texture.' + key) });
  b.dataset.texture = key;
  b.addEventListener('click', () => { state.texture = key; applyLook(); });
  return b;
}));
$('intensity').addEventListener('input', (e) => { state.intensity = Number(e.target.value); applyLook(); });

// 거울(palette.js)이 색을 보낸다: 다이얼을 돌리는 동안은 quiet 로 계속, 제품을 바르면 제형도 같이
window.addEventListener('took:apply', (e) => {
  const { hex, finish, quiet = false } = e.detail;
  if (FINISH_TO_TEXTURE[finish]) state.texture = FINISH_TO_TEXTURE[finish];
  state.hex = hex;
  applyLook();
  if (!quiet) toast(tr('lip.productApplied'));
});
