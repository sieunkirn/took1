// 립 매핑 화면: 색 고르기. 프리셋·텍스처·농도·색 조제 슬라이더, 나에게 어울리는 컬러(피부 톤 측정), 제품 추천.
import { $, store, api, tryOnCard, fullName, shortName, toast, skeletonCards } from './common.js';
import { hexToRgb, rgbToHsl, hslToHex } from '../lib/color.js';
import { FINISH_TO_TEXTURE } from './lip-view.js';
import { measureTone, classifyTone, matchPresets, TONE_THRESHOLDS, TEXTURES, PRESETS } from './lip-engine.js';
import { t as tr, finishText as finishName } from './i18n.js';
import { STUDIO, PALETTE, MATCH_FRAMES, MATCH_TIMEOUT_MS, state } from './lip-state.js';
import { sourceFrame, samples } from './lip-camera.js';

const RECOMMEND_COUNT = 6; // 고른 색과 비슷한 제품을 몇 개 보여 줄지

// ---------- 컬러 / 텍스처 / 농도 ----------
export function applyLook() {
  for (const b of document.querySelectorAll('#swatches button, #match-swatches button')) {
    b.setAttribute('aria-pressed', String(b.dataset.hex === state.hex));
  }
  for (const b of $('textures').children) b.setAttribute('aria-pressed', String(b.dataset.texture === state.texture));
  $('intensity').value = state.intensity;
  $('intensity-out').textContent = state.intensity + '%';
  // 선택한 컬러(색상값·텍스처) 문구는 2026-11-11 화면에서 뺐다
  store.set('lipDisplay', { texture: state.texture, intensity: state.intensity });
  syncMixSliders();
  window.tookLipHex = state.hex; // 합본 화면에서 챗봇이 늦게 로드돼도 현재 색을 알 수 있게
  window.dispatchEvent(new CustomEvent('took:color', { detail: { hex: state.hex, texture: state.texture } }));
}

// 고른 색은 다른 화면(홈 최근 기록, 챗봇 기준 색)에서도 쓰도록 저장한다
function saveColor(hex, source) {
  store.set('lipColor', { ...rgbToHsl(hexToRgb(hex)), hex, source });
}

function selectColor(hex, source = '립 컬러 매핑 컬러 선택') {
  state.hex = hex;
  saveColor(hex, source);
  applyLook();
}

// 제품 색과 제형을 입술에 입힌다
function applyProduct(hex, finish, source) {
  if (FINISH_TO_TEXTURE[finish]) state.texture = FINISH_TO_TEXTURE[finish];
  selectColor(hex, source);
}

function swatchButton(hex) {
  const b = Object.assign(document.createElement('button'), { type: 'button', title: hex });
  b.dataset.hex = hex;
  b.style.background = hex;
  b.setAttribute('aria-label', tr('lip.colorAria', { hex }));
  b.addEventListener('click', () => {
    if (PALETTE) window.dispatchEvent(new CustomEvent('took:pick', { detail: { hex, from: b } }));
    else selectColor(hex);
  });
  return b;
}

$('swatches')?.replaceChildren(...PRESETS.map(swatchButton));
$('textures').replaceChildren(...Object.entries(TEXTURES).map(([key, t]) => {
  const b = Object.assign(document.createElement('button'), { type: 'button', textContent: tr('texture.' + key) });
  b.dataset.texture = key;
  b.addEventListener('click', () => { state.texture = key; applyLook(); });
  return b;
}));
$('intensity').addEventListener('input', (e) => { state.intensity = Number(e.target.value); applyLook(); });

// 색 조제: 색상·채도·명도 슬라이더로 직접 만든 색 (합본 화면)
const mix = ['h', 's', 'l'].map((k) => [k, $(`mix-${k}`)]).filter(([, input]) => input);
function syncMixSliders() {
  if (!mix.length) return;
  const hsl = rgbToHsl(hexToRgb(state.hex));
  for (const [k, input] of mix) {
    input.value = Math.round(hsl[k]);
    $(`mix-${k}-out`).textContent = Math.round(hsl[k]) + (k === 'h' ? '°' : '%');
  }
}
for (const [, input] of mix) {
  input.addEventListener('input', () => {
    const [h, s, l] = mix.map(([, i]) => Number(i.value));
    selectColor(hslToHex({ h, s, l }), '직접 조제한 컬러');
  });
}

// ---------- 나에게 어울리는 컬러 (피부·눈 흰자 측정) ----------
export function collectSkin() {
  const a = state.analyze;
  const tone = state.source === 'avatar' ? state.avatar?.tone : state.lips?.tone;
  const f = sourceFrame();
  if (tone && f) {
    const m = measureTone(f.src, f.w, f.h, tone);
    if (m?.skin) a.samples.push(m);
  }
  if (a.samples.length >= MATCH_FRAMES) finishMatch();
  else if (performance.now() - a.started > MATCH_TIMEOUT_MS) {
    state.analyze = null;
    $('match-result').textContent = tr('lip.matchFaceFail');
  }
}

export function showMatchPicks(picks) {
  $('match-swatches').replaceChildren(...picks.map(swatchButton));
  $('match-swatches').classList.remove('hidden');
}

function finishMatch() {
  const { samples } = state.analyze;
  state.analyze = null;
  const tone = classifyTone(samples);
  if (!tone) {
    $('match-result').textContent = tr('lip.matchSkinFail');
    return;
  }
  const picks = matchPresets(tone.season, 3);
  const near = tone.runnerUp ? tr('lip.matchNear', { label: tr('season.' + tone.runnerUp) }) : '';
  $('match-result').textContent = tr('lip.matchResult', { label: tr('season.' + tone.season), desc: tr('season.' + tone.season + '.desc'), near })
    + tr(PALETTE ? 'lip.matchPalette' : 'lip.matchApplied');
  // 측정값: 기준값 조정에 쓸 수 있도록 그대로 보여준다
  const m = tone.metrics, T = TONE_THRESHOLDS;
  if ($('match-metrics')) $('match-metrics').textContent = [
    tr('lip.mHue', { v: m.hue.toFixed(1), t: T.warmHue }),
    tr('lip.mLight', { v: m.L.toFixed(1), t: T.lightL }),
    m.contrast === null ? tr('lip.mNoContrast') : tr('lip.mContrast', { v: m.contrast.toFixed(1), t: T.contrast }),
    tr(m.wb ? 'lip.mWb' : 'lip.mNoWb'),
  ].join(' · ');
  showMatchPicks(picks);
  store.set('lipMatch', { season: tone.season, picks });
  if (PALETTE) window.dispatchEvent(new CustomEvent('took:match', { detail: { season: tone.season, picks } }));
  else selectColor(picks[0]);
}

$('match')?.addEventListener('click', () => {
  $('match-result').textContent = '';
  if ($('match-metrics')) $('match-metrics').textContent = '';
  state.analyze = { samples: [], started: performance.now() };
  $('match').disabled = true;
});

// ---------- 제품 추천 ----------
// 합본 화면에서는 오른쪽 '추천' 탭의 목록에 그린다
export async function showInlineRecommend(hex) {
  const ref = tr('lip.ref', { hex });
  if (STUDIO) {
    window.dispatchEvent(new CustomEvent('took:show-tab', { detail: { tab: 'rec' } }));
  } else {
    store.set('lipInlineRec', { hex });
    $('controls').classList.add('hidden');
    $('rec-panel').classList.remove('hidden');
    $('rec-ref').textContent = ref;
  }
  $('rec-status').textContent = tr('lip.recLoading');
  $('rec-list').replaceChildren(...skeletonCards(3));
  const { ok, body } = await api('api/recommend?' + new URLSearchParams({ hex, limit: RECOMMEND_COUNT }));
  if (!ok) {
    $('rec-status').textContent = body.error || tr('lip.recFail');
    return;
  }
  $('rec-status').textContent = (STUDIO ? ref + ' · ' : '') + (body.products.length
    ? tr('lip.recCount', { n: body.products.length })
    : tr('lip.recNone'));
  $('rec-list').replaceChildren(...body.products.map((product) => tryOnCard(product, (p) => {
    applyProduct(p.color_hex, p.finish, `제품 ${shortName(p)}`);
    $('rec-status').textContent = tr('lip.applying', { name: fullName(p), finish: p.finish ? ` (${finishName(p.finish)})` : '' });
    toast(tr('lip.appliedToast', { name: shortName(p) }));
  })));
}

$('recommend')?.addEventListener('click', () => {
  saveColor(state.hex, '립 컬러 매핑 컬러 선택');
  // 합본 화면: 같은 화면의 챗봇이 이 색과 비슷한 제품을 찾아 '추천' 탭에 보여 준다
  if (STUDIO) window.dispatchEvent(new CustomEvent('took:recommend', { detail: { hex: state.hex } }));
  else showInlineRecommend(state.hex);
});
$('rec-back')?.addEventListener('click', () => {
  store.remove('lipInlineRec');
  $('rec-panel').classList.add('hidden');
  $('controls').classList.remove('hidden');
});

// 다른 스크립트가 색을 보낸다: 합본의 챗봇 추천 카드 '입술에 발라보기', 팔레트(섞는 동안 quiet 로 계속)
window.addEventListener('took:apply', (e) => {
  const { hex, finish, quiet = false, source = '추천 제품 색' } = e.detail;
  applyProduct(hex, finish, source);
  if (!quiet) toast(tr('lip.productApplied'));
});
