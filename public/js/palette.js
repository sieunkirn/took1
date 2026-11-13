// 팔레트(테스트): 물감을 떨어뜨리고 저어서 립 색을 조제하는 화면.
//  - 물감·섞는 칸(떨어뜨리기·젓기·OKLab 혼합)은 js/palette-mixer.js 
//  - 섞는 칸 색이 바뀌는 동안 같은 색을 took:apply 이벤트로 보내 왼쪽 카메라 입술(lip.js)에 바로 입힌다
//  - 초기화: 팔레트를 비우고 입술 색을 기본 컬러로 되돌린다
import { $, el, renderNav, store, api, go, tryOnCard, toast, skeletonCards, shortName } from './common.js';
import { listenNfc, resolveTag, cardProduct, createNfcHint } from './nfc.js'; // 제품 NFC 태그 → 그 제품 색을 입술에
import { createMixer } from './palette-mixer.js'; // 물감·섞는 칸
import { t as tr } from './i18n.js'; // 화면 문구 (한국어/영어)

const RECOMMEND_COUNT = 6; // 고른 색과 비슷한 제품을 몇 개 보여 줄지

renderNav();

const DEFAULT_LOOK = { hex: '#C08A94', finish: 'matte' }; // 립 컬러 매핑 기본 컬러

// 왼쪽 카메라 입술에 색을 입힌다 (quiet: 알림 없이)
function toLips(hex, { finish = null, quiet = true, source = '팔레트에서 조제한 색' } = {}) {
  window.dispatchEvent(new CustomEvent('took:apply', { detail: { hex, finish, quiet, source } }));
}

// ---------- 물감·섞는 칸 ----------
const mixer = createMixer({
  paintsEl: $('lip-paints'),
  canvas: $('mix-canvas'),
  storeKey: 'paletteDrops',
  // 색을 고를 때마다 입술에 바로 반영하고, 선택을 비우면 기본 컬러로
  onColor: (hex) => (hex ? toLips(hex) : toLips(DEFAULT_LOOK.hex, { finish: DEFAULT_LOOK.finish, source: '기본 컬러' })),
  onChange: () => render(),
});

// ---------- 결과·선택 색상 ----------
// 휴대폰으로 넘길 마지막 결과: 추천을 받은 색과 그때 받은 추천 제품(앞의 3개)
const result = { hex: null, recs: [] };
function render() {
  const hex = mixer.hex();
  $('find').disabled = !hex;
  $('reset').disabled = !hex;
  $('take-phone').disabled = !hex;
  $('mix-hex').textContent = hex || tr('pal.mixEmpty');
  $('mix-canvas').setAttribute('aria-label', hex ? tr('pal.mixAria', { hex }) : tr('pal.mixEmpty'));
}
// 추천 결과 보기: 오른쪽에는 조제한 색과 추천 제품만 남긴다. '다시 섞기'는 섞던 팔레트로 돌아간다
function showResult(on) {
  document.querySelector('.palette').classList.toggle('show-result', on);
}
$('back-mix').addEventListener('click', () => showResult(false));

// 다시하기(팔레트 오른쪽 위 아이콘): 팔레트를 비우고 입술 색을 기본 컬러로

$('reset').addEventListener('click', () => {
  showResult(false);
  mixer.reset(); // 비우고 입술은 기본 컬러로
  $('rec-list').replaceChildren();
  $('rec-status').textContent = '';
  result.hex = null;
  result.recs = [];
  toast(tr('pal.resetDone'));
});

// 나에게 어울리는 컬러 (lip.js 가 측정): 팔레트의 같은 색에 '내 톤' 표시, 추천 컬러를 누르면 조합에 추가한다
window.addEventListener('took:pick', (e) => {
  if (!e.detail?.hex) return;
  if (document.querySelector('.palette.show-result')) showResult(false); // 추천 결과를 보던 중이면 섞는 칸을 다시 연다
  requestAnimationFrame(() => mixer.addColor(e.detail.hex));
});

$('find').addEventListener('click', async () => {
  const hex = mixer.hex();
  showResult(true);
  $('res-swatch').style.background = hex;
  $('res-hex').textContent = tr('pal.mixed', { hex });
  $('rec-status').textContent = tr('pal.searching', { hex });
  $('rec-list').replaceChildren(...skeletonCards(4));
  const { ok, body } = await api('api/recommend?' + new URLSearchParams({ hex, limit: RECOMMEND_COUNT }));
  if (!ok) {
    $('rec-status').textContent = body.error || tr('lip.recFail');
    $('rec-list').replaceChildren();
    return;
  }
  result.hex = hex;
  result.recs = body.products.slice(0, 3).map((p) => p.id);
  $('rec-status').textContent = tr('pal.found', { hex, n: body.products.length });
  $('rec-list').replaceChildren(...body.products.map((product) => tryOnCard(product, (p) => toLips(p.color_hex, { finish: p.finish, quiet: false, source: '추천 제품 색' }))));
});

// ---------- 챗봇과 이어서 상담: 지금 결과(색·텍스처·농도·내 톤·추천 제품)를 이 태블릿의 챗봇으로 넘긴다 ----------
//   chat.html?from=palette&hex=색&fin=텍스처&int=농도&tone=내 톤&recs=추천 제품 ID(최대 3개)
//   챗봇(chat.js paletteHandoff)이 이 값으로 첫인사를 하고 기준 색으로 쓴다. (2026-11-11 손님 휴대폰 QR 대신)
function takeData() {
  const showing = !!document.querySelector('.palette.show-result');
  const hex = showing && result.hex ? result.hex : mixer.hex();
  const look = store.get('lipDisplay') || {};
  return {
    hex,
    fin: look.texture || 'matte',
    int: Number.isFinite(look.intensity) ? Math.round(look.intensity) : 80,
    tone: store.get('lipMatch')?.season || null,
    recs: hex && hex === result.hex ? result.recs : [],
  };
}
function openTake() {
  const d = takeData();
  if (!d.hex) return;
  go('chat.html', { from: 'palette', hex: d.hex, fin: d.fin, int: String(d.int), tone: d.tone, recs: d.recs.length ? d.recs.join(',') : null });
}
$('take-phone').addEventListener('click', openTake);
$('take-phone-res').addEventListener('click', openTake);

// ---------- NFC 태그: 립 제품을 리더기에 올리면 그 제품 색을 바로 입술에 바른다 (js/nfc.js) ----------
const nfcHint = $('nfc-hint');
const nfcFlash = createNfcHint(nfcHint, { ms: 3000 });
// 기다리는 동안의 안내 문구는 뺐다: 태그를 읽었을 때만 잠깐 알려 준다
// 읽은 제품: 그 색을 입술에 바르고, 오른쪽 ④ 자리에 제품 카드를 띄운다 (NFC 리더기)
// masked: 실물 테스트 카드면 그 가린 번호 → 제품 카드를 카드 이름·사진으로 보여 준다 (색은 연결한 제품 색)
async function showNfcProduct(id, masked = null) {
  const found = id ? await api('api/products/' + encodeURIComponent(id)) : null;
  const p = cardProduct(masked, found?.ok ? found.body.product : null);
  if (!p?.color_hex) { nfcFlash(tr('pal.nfcUnknown')); return; }
  toLips(p.color_hex, { finish: p.finish, quiet: false, source: shortName(p) });
  nfcFlash(tr('pal.nfcApplied', { name: shortName(p) }));
  result.hex = p.color_hex;
  result.recs = p.id && !String(p.id).startsWith('TEST-') ? [p.id] : []; // 실물 테스트 카드는 등록 제품이 아니라 넘기지 않는다
  showResult(true);
  $('res-swatch').style.background = p.color_hex;
  $('res-hex').textContent = tr('pal.nfcRead');
  $('rec-status').textContent = '';
  $('rec-list').replaceChildren(tryOnCard(p, () => toLips(p.color_hex, { finish: p.finish, quiet: false, source: shortName(p) })));
}
listenNfc((code) => showNfcProduct(resolveTag(code))); // 바코드로 찾기 화면은 2026-11-11 삭제

mixer.start(); // 섞어 둔 색이 있으면 입술에 바로 입히고 그리기 시작
