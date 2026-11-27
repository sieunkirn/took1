// 휴대폰 담기 화면 (basket.html, 2026-11-23): 휴대폰이 진열대 리더기 역할을 한다.
// 1) 손님 카드를 휴대폰 뒷면에 대면 그 카드 번호(UID)를 '내 카드'로 연결한다 (카드에는 아무것도 쓰지 않는다)
// 2) 립 제품 태그를 대면 서버에 '카드 번호 → 제품'으로 담는다 (태그 → 제품 찾기는 거울과 같은 nfc.js 규칙: 태그 번호 표 · 제품 ID · 바코드 번호)
// 3) 거울 리더기에 같은 카드를 대면 담은 립이 입술에 발라진다 (nfc-window.js)
// NFC 읽기는 Web NFC(NDEFReader) → 안드로이드 Chrome 에서만 된다. 아이폰·PC 는 '카드 번호 직접 넣기'와 '이름으로 찾아 담기'로만 시험할 수 있다.
// 카드 고르는 규칙: 연결된 카드가 없을 때 처음 댄 태그 = 내 카드(제품 태그 번호로 등록된 카드도 손님 카드로 쓸 수 있게).
// 다만 제품 ID·바코드를 글자로 써 둔 태그는 분명한 제품 태그라 카드로 쓰지 않는다. 카드가 있을 때는 제품이면 담고, 제품이 아니면 다른 카드로 바꾼다.
import { api } from './api.js';
import { el, $ } from './dom.js';
import { t, applyI18n, langToggle, brandOf, nameOf, shadeOf } from './i18n.js';
import { normalizeTag, resolveTag, findTagProduct } from './nfc.js';
import { getBasket, addToBasket, removeFromBasket, clearBasket, sendToMirror, getSent } from './basket.js';

const CARD_KEY = 'tookBasket.card';
let card = null;
let items = []; // 담은 제품 (서버 순서 = 오래된 것 → 최근)
let lastNew = null;

applyI18n();
document.title = 'took · ' + t('bk.title');
$('bk-lang').append(langToggle('bk-langbtn'));

// ---------- 안내 줄 ----------
const statusEl = $('bk-status');
let listening = false;
let statusTimer = 0;
function status(text, kind = '') {
  clearTimeout(statusTimer);
  statusEl.textContent = text;
  statusEl.className = 'bk-status' + (kind ? ' ' + kind : '');
  // 잠깐 띄운 문구는 3초 뒤 '태그를 대 주세요'로 돌아간다
  if (kind === 'hit' || kind === 'err') statusTimer = setTimeout(idleStatus, 3500);
}
const idleStatus = () => (listening ? status(t('bk.listening'), 'on') : status(''));

// 서버가 잠들어 있으면 깨는 데 오래 걸린다 → 1.2초 넘게 걸리면 '연결하는 중' 안내
async function withServer(promise) {
  const slow = setTimeout(() => status(t('bk.server'), 'on'), 1200);
  try {
    const r = await promise;
    clearTimeout(slow);
    if (statusEl.textContent === t('bk.server')) idleStatus();
    return r;
  } catch (e) {
    clearTimeout(slow);
    status(t('bk.serverErr', { msg: e.name === 'AbortError' ? 'timeout' : e.message }), 'err');
    return null;
  }
}

// ---------- 그리기 ----------
function itemRow(p, button) {
  const pic = p.image_url
    ? el('img', { src: p.image_url, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' })
    : el('span', { class: 'bk-sw', 'aria-hidden': 'true' });
  if (!p.image_url && p.color_hex) pic.style.background = p.color_hex;
  const dot = el('i', { class: 'bk-dot', 'aria-hidden': 'true' });
  if (p.color_hex) dot.style.background = p.color_hex; // 립 색은 실제 색
  return el('li', { class: 'bk-item' + (p.id === lastNew ? ' new' : '') }, pic,
    el('span', { class: 'bk-t' }, el('span', { class: 'bk-b', text: brandOf(p) }),
      el('span', { class: 'bk-n' }, dot, nameOf(p) + (p.shade_name ? ' · ' + shadeOf(p) : ''))),
    button);
}

function render() {
  const line = $('bk-cardline');
  line.textContent = card ? t('bk.card', { code: card.match(/.{1,2}/g).join(' ') }) : t('bk.cardWait');
  line.classList.toggle('set', !!card);
  $('bk-change').hidden = !card;
  $('bk-clear').hidden = !card || !items.length;
  $('bk-count').textContent = items.length ? `(${items.length})` : '';
  $('bk-list').replaceChildren(...[...items].reverse().map((p) =>
    itemRow(p, el('button', { type: 'button', onclick: () => remove(p) }, t('bk.remove')))));
  $('bk-empty').hidden = items.length > 0;
  $('bk-mirror').hidden = !(card && items.length);
  $('bk-send').hidden = !(card && items.length);
}

// ---------- 카드 ----------
async function setCard(code, { quiet = false } = {}) {
  card = normalizeTag(code);
  items = [];
  try { localStorage.setItem(CARD_KEY, card); } catch { /* 저장 불가 환경 */ }
  render();
  if (!quiet) status(t('bk.cardSet'), 'hit');
  const b = await withServer(getBasket(card));
  if (b && normalizeTag(code) === card) {
    card = b.card || card; // 서버가 찾은 같은 카드(글자가 빠진 번호를 맞춘 경우)
    items = b.items || [];
    render();
  }
}

function unsetCard() {
  card = null;
  items = [];
  try { localStorage.removeItem(CARD_KEY); } catch { /* 저장 불가 환경 */ }
  render();
  idleStatus();
}

// ---------- 담기·빼기 ----------
async function add(p) {
  if (!card) { status(t('bk.cardWait'), 'err'); return; }
  const b = await withServer(addToBasket(card, p.id));
  if (!b) return;
  items = b.items || [];
  lastNew = p.id;
  render();
  status(t('bk.added', { name: nameOf(p) }), 'hit');
  navigator.vibrate?.(60);
}

async function remove(p) {
  const b = await withServer(removeFromBasket(card, p.id));
  if (!b) return;
  items = b.items || [];
  render();
}

$('bk-clear').addEventListener('click', async () => {
  const b = await withServer(clearBasket(card));
  if (!b) return;
  items = [];
  render();
  status(t('bk.cleared'), 'hit');
});
$('bk-change').addEventListener('click', unsetCard);
$('bk-manual-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = normalizeTag($('bk-manual').value);
  if (!/^[0-9A-Z]{4,32}$/.test(v)) return;
  $('bk-manual').value = '';
  e.target.closest('details').open = false;
  setCard(v);
});

// ---------- 태그 읽기 ----------
// 태그 → 제품. 태그 번호(표에 등록된 번호)를 먼저 보고, 다음으로 태그에 써 둔 글자(제품 ID·바코드 번호)를 본다
async function productOf(serial, texts) {
  if (serial && resolveTag(serial)) {
    const p = await findTagProduct(serial, api).catch(() => null);
    if (p) return { p, written: false };
  }
  for (const s of texts) {
    const p = await findTagProduct(s, api).catch(() => null);
    if (p) return { p, written: true };
  }
  return null;
}

let busy = false;
let last = { code: '', at: 0 };
export async function onTag(serial, texts = []) {
  const code = normalizeTag(serial);
  const key = code || texts.join('|');
  if (!key || busy) return;
  if (key === last.code && Date.now() - last.at < 1500) return; // 같은 태그가 이어서 두 번 읽힌 것
  last = { code: key, at: Date.now() };
  busy = true;
  try {
    const found = await productOf(code, texts);
    if (!card) {
      if (found?.written || !code) { status(t('bk.cardWait'), 'err'); return; }
      await setCard(code);
      return;
    }
    if (code && (code === card || (code.length >= 8 && card.length >= 8 && (code.includes(card) || card.includes(code))))) {
      status(t('bk.sameCard'), 'hit');
      return;
    }
    if (found) { await add(found.p); return; }
    if (!code) { status(t('bk.unknownProduct'), 'err'); return; }
    await setCard(code, { quiet: true });
    status(t('bk.cardSwitch'), 'hit');
  } finally {
    busy = false;
  }
}
window.tookBasketTag = onTag; // 휴대폰 없이 시험: tookBasketTag('04379D1A322490')

const decodeRecord = (r) => {
  try {
    if (r.recordType === 'text') return new TextDecoder(r.encoding || 'utf-8').decode(r.data);
    if (r.recordType === 'url' || r.recordType === 'absolute-url') return new TextDecoder().decode(r.data);
    if (r.mediaType?.startsWith('text/')) return new TextDecoder().decode(r.data);
  } catch { /* 읽을 수 없는 기록 */ }
  return null;
};

const startBtn = $('bk-start');
if (!('NDEFReader' in window)) {
  startBtn.hidden = true;
  status(t('bk.noNfc'), '');
  statusEl.classList.add('err');
}
let scanCtl = null;
async function startScan() {
  if (listening) return;
  try {
    scanCtl = new AbortController();
    const reader = new NDEFReader();
    await reader.scan({ signal: scanCtl.signal });
    listening = true;
    startBtn.setAttribute('aria-pressed', 'true');
    startBtn.disabled = true;
    startBtn.textContent = t('bk.listening');
    idleStatus();
    reader.addEventListener('reading', (e) => {
      const texts = (e.message?.records || []).map(decodeRecord).filter(Boolean).map((s) => s.trim());
      onTag(e.serialNumber || '', texts);
    });
    reader.addEventListener('readingerror', () => status(t('bk.unknownProduct'), 'err'));
  } catch (e) {
    status(t('bk.nfcDenied') + (e?.name ? ` (${e.name})` : ''), 'err');
  }
}
// 휴대폰을 거울 리더기에 '카드처럼' 대려면 휴대폰이 NFC 를 읽는 중이면 안 된다(읽는 쪽끼리는 서로 못 읽는다) → 읽기를 멈춘다
function stopScan() {
  scanCtl?.abort();
  scanCtl = null;
  if (!listening) return;
  listening = false;
  startBtn.removeAttribute('aria-pressed');
  startBtn.disabled = false;
  startBtn.textContent = t('bk.restart');
  idleStatus();
}
startBtn.addEventListener('click', startScan);

// ---------- 거울에 보내기 ----------
// 찍기: 서버에 '이 카드가 20초 안에 찍어요'를 남기고 휴대폰 NFC 읽기를 멈춘다. 리더기가 휴대폰(모르는 번호)을 읽으면 거울이 이 카드를 띄운다.
// 휴대폰이 리더기에 보이는 번호는 댈 때마다 바뀌어서, 번호가 아니라 '방금 누른 카드'로 알아본다 (거울 한 대 기준)
// 바로 띄우기: 찍지 않고 거울이 3초마다 확인해서 띄운다
const sendStatus = $('bk-send-status');
let sendTimer = 0;
async function send(mode) {
  if (!card) return;
  clearInterval(sendTimer);
  if (mode === 'tap') stopScan();
  sendStatus.className = 'bk-send-status wait';
  sendStatus.textContent = t('bk.server');
  const sent = await sendToMirror(card, mode).catch((e) => { sendStatus.textContent = t('bk.serverErr', { msg: e.message }); return null; });
  if (!sent) return;
  const until = Date.now() + (mode === 'tap' ? 20000 : 12000);
  const tick = async () => {
    const left = Math.ceil((until - Date.now()) / 1000);
    if (left <= 0) {
      clearInterval(sendTimer);
      sendStatus.className = 'bk-send-status';
      sendStatus.textContent = t('bk.tapTimeout');
      return;
    }
    if (mode === 'tap') sendStatus.textContent = t('bk.tapWait', { s: left });
    else sendStatus.textContent = t('bk.nowSent');
    const now = await getSent({ timeoutMs: 3000 }).catch(() => undefined);
    if (now !== undefined && now?.id !== sent.id && Date.now() < until) { // 거울이 받아서 지웠다
      clearInterval(sendTimer);
      sendStatus.className = 'bk-send-status';
      sendStatus.textContent = t('bk.tapDone');
      navigator.vibrate?.([60, 60, 60]);
    }
  };
  tick();
  sendTimer = setInterval(tick, 1000);
}
$('bk-tap').addEventListener('click', () => send('tap'));
$('bk-now').addEventListener('click', () => send('now'));

// ---------- 이름으로 찾아 담기 ----------
let pool = null;
const qEl = $('bk-q');
let qTimer = 0;
qEl.addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(search, 150); });
async function search() {
  const q = qEl.value.trim().toLowerCase();
  const box = $('bk-results');
  if (!q) { box.replaceChildren(); return; }
  if (!pool) {
    const r = await api('api/products').catch(() => null);
    pool = (r?.ok && r.body?.products) || [];
  }
  const hits = pool.filter((p) => [p.brand, p.name, p.brand_en, p.name_en, p.brand_zh, p.name_zh, p.brand_ja, p.name_ja, p.shade_name, p.shade_color_en, p.shade_color_zh, p.shade_color_ja].filter(Boolean).join(' ').toLowerCase().includes(q)).slice(0, 20);
  box.replaceChildren(...(hits.length
    ? hits.map((p) => itemRow(p, el('button', { type: 'button', 'aria-label': '+ ' + nameOf(p), onclick: () => add(p) }, '+')))
    : [el('li', { class: 'bk-empty', text: t('bk.noResult') })]));
}

// ---------- 처음 ----------
let saved = null;
try { saved = localStorage.getItem(CARD_KEY); } catch { /* 저장 불가 환경 */ }
render();
if (saved) setCard(saved, { quiet: true });
