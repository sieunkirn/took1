// 팔레트(테스트): 물감을 떨어뜨리고 저어서 립 색을 조제하는 화면.
//  - 물감·섞는 칸(떨어뜨리기·젓기·OKLab 혼합)은 js/palette-mixer.js 
//  - 섞는 칸 색이 바뀌는 동안 같은 색을 took:apply 이벤트로 보내 왼쪽 카메라 입술(lip.js)에 바로 입힌다
//  - 초기화: 팔레트를 비우고 입술 색을 기본 컬러로 되돌린다
import { renderNav, store, api, el, productCard, toast, skeletonCards, shortName, NFC_TEST_MENU } from './common.js';
import { listenNfc, resolveTag, resolveReading, cardProduct } from './nfc.js'; // 제품 NFC 태그 → 그 제품 색을 입술에
import { startWebNfc, webNfcSupport, makeDedupe } from './nfc-test.js'; // 휴대폰 NFC (Web NFC)
import { pairPhoneForNfc } from './nfc-relay.js'; // 휴대폰으로 읽고 이 화면에 띄우기
import { loadZXing } from './barcode-scan.js'; // QR 그리기
import { createMixer, ALL_PAINTS, PAINT } from './palette-mixer.js'; // 물감·섞는 칸
import { t as tr, isEn } from './i18n.js'; // 화면 문구 (한국어/영어)

renderNav();

const $ = (id) => document.getElementById(id);
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
  // 섞는 동안 입술에 계속 입히고, 다 비우면 기본 컬러로
  onColor: (hex) => (hex ? toLips(hex) : toLips(DEFAULT_LOOK.hex, { finish: DEFAULT_LOOK.finish, source: '기본 컬러' })),
  onChange: () => render(),
});
const paintBtns = mixer.paintBtns;

// ---------- 결과·레시피 ----------
// 휴대폰으로 넘길 마지막 결과: 추천을 받은 색과 그때 받은 추천 제품(앞의 3개)
const result = { hex: null, recs: [] };
function render() {
  const hex = mixer.hex();
  $('mix-empty').classList.toggle('hidden', !!hex);
  $('undo').disabled = !mixer.count();
  $('find').disabled = !hex;
  $('reset').disabled = !hex;
  $('take-phone').disabled = !hex;
  // 조제한 색은 섞는 칸에 보이므로 옆에 색상값과 방울 수만 적는다
  $('mix-hex').textContent = hex ? `${hex}
${tr('pal.drops', { n: mixer.count() })}` : '';
}

$('undo').addEventListener('click', () => mixer.undo());
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

// 나에게 어울리는 컬러 (lip.js 가 측정): 팔레트의 같은 물감에 '내 톤' 표시, 추천 컬러를 누르면 한 방울 떨어뜨린다
function markPicks(picks = []) {
  for (const b of paintBtns) b.classList.toggle('paint-pick', picks.includes(PAINT[b.dataset.key].hex));
}
window.addEventListener('took:match', (e) => markPicks(e.detail.picks));
window.addEventListener('took:pick', (e) => {
  const p = ALL_PAINTS.find((x) => x.hex === e.detail.hex);
  if (!p) return;
  if (document.querySelector('.palette.show-result')) showResult(false); // 추천 결과를 보던 중이면 섞는 칸을 다시 연다
  requestAnimationFrame(() => mixer.fly(p.key, e.detail.from));
});
markPicks(store.get('lipMatch')?.picks);

$('find').addEventListener('click', async () => {
  const hex = mixer.hex();
  showResult(true);
  $('res-swatch').style.background = hex;
  $('res-hex').textContent = tr('pal.mixed', { hex });
  $('rec-status').textContent = tr('pal.searching', { hex });
  $('rec-list').replaceChildren(...skeletonCards(4));
  const { ok, body } = await api('api/recommend?' + new URLSearchParams({ hex, limit: 6 }));
  if (!ok) {
    $('rec-status').textContent = body.error || tr('lip.recFail');
    $('rec-list').replaceChildren();
    return;
  }
  result.hex = hex;
  result.recs = body.products.slice(0, 3).map((p) => p.id);
  $('rec-status').textContent = tr('pal.found', { hex, n: body.products.length });
  $('rec-list').replaceChildren(...body.products.map((p) => productCard(p, {
    extraActions: [el('button', {
      type: 'button',
      text: tr('lip.tryOn'),
      onclick: () => toLips(p.color_hex, { finish: p.finish, quiet: false, source: '추천 제품 색' }),
    })],
  })));
});

// ---------- 휴대폰으로 가져가기: 지금 결과를 QR 로 넘겨 손님 휴대폰에서 챗봇과 이어서 대화 ----------
// QR 에는 숫자·글자 값만 담는다 (서버에 저장하지 않고, 카메라 사진·영상은 넘기지 않는다):
//   chat.html?from=palette&hex=색&fin=텍스처&int=농도&tone=내 톤&recs=추천 제품 ID(최대 3개)&take=1&lang=en
//   take=1: 손님 휴대폰이라 키오스크 자동 초기화를 하지 않는다 (common.js)
// QR 주소: 공개 주소로 띄웠으면 지금 주소, localhost 면 서버가 알려 주는 같은 와이파이 PC 주소 (휴대폰은 localhost 를 열 수 없다)
let phoneBaseCache;
async function phoneBase() {
  const here = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  if (!/^(localhost|127\.|\[::1\])/.test(location.hostname)) return here;
  if (phoneBaseCache === undefined) {
    const r = await api('api/phone-base').catch(() => null);
    phoneBaseCache = r?.ok && r.body.base ? r.body.base : null;
  }
  return phoneBaseCache || here;
}
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
async function openTake() {
  const d = takeData();
  if (!d.hex) return;
  const q = new URLSearchParams({ from: 'palette', hex: d.hex, fin: d.fin, int: String(d.int) });
  if (d.tone) q.set('tone', d.tone);
  if (d.recs.length) q.set('recs', d.recs.join(','));
  q.set('take', '1');
  if (isEn()) q.set('lang', 'en');
  const dlg = $('take-dialog');
  $('take-swatch').style.background = d.hex;
  $('take-summary').textContent = tr('pal.takeSummary', { hex: d.hex, texture: tr('texture.' + d.fin), n: d.int })
    + (d.tone ? ' · ' + tr('season.' + d.tone) : '');
  $('take-qr').replaceChildren();
  delete $('take-qr').dataset.url;
  $('take-url').textContent = '';
  dlg.showModal();
  const url = (await phoneBase()) + 'chat.html?' + q;
  if (!dlg.open) return;
  $('take-qr').dataset.url = url;
  $('take-url').textContent = url.replace(/^https?:\/\//, '').replace(/\?.*$/, '');
  const ZXing = await loadZXing().catch(() => null);
  if (ZXing) {
    const qr = new ZXing.BrowserQRCodeSvgWriter().write(url, 240, 240);
    qr.setAttribute('shape-rendering', 'crispEdges'); // 칸 경계를 흐리지 않아 휴대폰 카메라가 잘 읽는다
    $('take-qr').replaceChildren(qr);
  } else {
    $('take-qr').replaceChildren(el('p', { class: 'small', text: tr('pal.takeNoQr') }));
    $('take-url').textContent = url; // QR 을 그릴 수 없으면 전체 주소를 그대로
  }
}
$('take-phone').addEventListener('click', openTake);
$('take-phone-res').addEventListener('click', openTake);
$('take-close').addEventListener('click', () => $('take-dialog').close());
$('take-dialog').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }); // 바깥(어두운 곳)을 누르면 닫기

// ---------- NFC 태그: 립 제품을 리더기에 올리면 그 제품 색을 바로 입술에 바른다 (js/nfc.js) ----------
const nfcHint = $('nfc-hint');
let nfcTimer = null;
function nfcFlash(text) {
  nfcHint.textContent = text;
  nfcHint.classList.add('hit');
  clearTimeout(nfcTimer);
  nfcTimer = setTimeout(() => { nfcHint.textContent = tr('pal.nfcIdle'); nfcHint.classList.remove('hit'); }, 3000);
}
nfcHint.textContent = tr('pal.nfcIdle');
// 읽은 제품: 그 색을 입술에 바르고, 오른쪽 ④ 자리에 제품 카드를 띄운다 (리더기·휴대폰 NFC 공통)
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
  $('rec-list').replaceChildren(productCard(p, {
    extraActions: [el('button', { type: 'button', text: tr('lip.tryOn'), onclick: () => toLips(p.color_hex, { finish: p.finish, quiet: false, source: shortName(p) }) })],
  }));
}
listenNfc((code) => showNfcProduct(resolveTag(code)));

// ---------- 휴대폰 NFC (테스트 단계, 상단 메뉴의 NFC 테스트와 같은 기준) ----------
// 같은 카드를 2.5초 안에 다시 읽으면 다시 처리하지 않는다. 읽지 못한 카드는 다시 대 보라고 알린다
const isDupReading = makeDedupe();
function onReading(r) {
  if (isDupReading(r)) return;
  if (r.kind === 'unreadable') { nfcFlash(tr('pal.nfcRetry')); return; }
  showNfcProduct(resolveReading(r), r.masked);
}
if (NFC_TEST_MENU) {
  $('pal-nfc-row').classList.remove('hidden');
  const state = (text) => { $('pal-nfc-state').textContent = text; };
  if (webNfcSupport().ok) {
    // 이 기기(안드로이드 Chrome)가 직접 읽는다
    const btn = $('pal-nfc-start');
    btn.classList.remove('hidden');
    let stop = null;
    let attempt = null;
    let slow = null;
    btn.addEventListener('click', async () => {
      if (stop) { stop(); stop = null; btn.textContent = tr('pal.nfcStart'); state(''); return; }
      if (attempt) attempt.abort(); // 켜지는 중에 다시 누르면 처음부터 다시
      const ctrl = new AbortController();
      attempt = ctrl;
      state(tr('pal.nfcStarting'));
      clearTimeout(slow);
      slow = setTimeout(() => { if (attempt === ctrl) state(tr('pal.nfcSlow')); }, 6000);
      try {
        const stopFn = await startWebNfc({
          signal: ctrl.signal,
          onReading,
          onFail: () => onReading({ kind: 'unreadable', masked: '', fp: null, tookId: null, records: [] }),
        });
        if (attempt !== ctrl) return;
        attempt = null; clearTimeout(slow);
        stop = stopFn;
        btn.textContent = tr('pal.nfcStop');
        state(tr('pal.nfcOn'));
      } catch {
        if (attempt !== ctrl) return;
        attempt = null; clearTimeout(slow);
        state(tr('pal.nfcFail'));
      }
    });
  } else {
    // 컴퓨터·iPad: 휴대폰을 QR 로 연결해 휴대폰이 읽은 카드를 받는다 (서버 필요)
    const btn = $('pal-nfc-pair');
    const dlg = $('pal-nfc-dialog');
    const pairState = (text) => { $('pal-nfc-pairstate').textContent = text; };
    let pairing = null;
    btn.classList.remove('hidden');
    $('pal-nfc-close').addEventListener('click', () => dlg.close());
    // 번호 바꾸기: 지금 연결을 끊고 새 번호를 받는다 (번호를 아는 다른 휴대폰을 떼어 낼 때)
    $('pal-nfc-newcode').addEventListener('click', () => { pairing?.stop(); pairing = null; connect(true); });
    btn.addEventListener('click', () => { dlg.showModal(); if (!pairing) connect(false); });
    async function connect(fresh) {
      pairState(tr('pal.nfcPairWait'));
      $('pal-nfc-code').textContent = '';
      const res = await pairPhoneForNfc({
        fresh,
        onReconnect: () => state(tr('pal.nfcReconnected')),
        onEvent: (e) => {
          if (e.type === 'phone') { pairState(tr('pal.nfcPairOk')); state(tr('pal.nfcPairOk')); }
          if (e.type === 'nfcstate' && e.data.state === 'ready') {
            state(tr('pal.nfcPairPhoneOn'));
            setTimeout(() => dlg.close(), 800); // 휴대폰 준비가 끝나면 팔레트가 보이게 닫는다
          }
          if (e.type === 'nfc') onReading({ ...e.data, records: e.data.records || [] });
        },
      });
      if (!res.ok) { pairState(tr('pal.nfcPairNoServer')); return; }
      pairing = res;
      const ZXing = await loadZXing().catch(() => null);
      if (ZXing) {
        const qr = new ZXing.BrowserQRCodeSvgWriter().write(res.phoneUrl, 168, 168);
        qr.setAttribute('shape-rendering', 'crispEdges');
        $('pal-nfc-qr').replaceChildren(qr);
      }
      $('pal-nfc-url').textContent = res.phoneBase.replace(/^https?:\/\//, '');
      $('pal-nfc-code').textContent = res.code;
      if (!res.phoneUrl.startsWith('https:')) pairState(tr('pal.nfcPairHttp'));
    }
  }
}

mixer.start(); // 섞어 둔 색이 있으면 입술에 바로 입히고 그리기 시작
