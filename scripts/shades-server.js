// 호수 수집·검수용 로컬 서버 (개발용, 배포하지 않는다).   npm run shades:server → http://localhost:8766
//  GET  /todo          아직 모으지 않은(또는 실패한) 올리브영 상품 번호 목록 → 브라우저 수집기(shades-collect.browser.js)가 쓴다
//  POST /collect       상품 하나의 수집 결과 → src/data/shades-raw/<상품번호>.json
//  GET  /review        검수 화면: 자동 판정이 애매한 호수 사진을 보고 '넣기' / '빼기'
//  GET  /api/review    검수 대기 목록,  POST /api/decision { key, value: 'ok' | 'exclude' }
//  GET  /status        모은 상품 수·검수 대기 수
//  GET  /all           전체 검수 화면: 모든 제품·모든 호수의 상태(자동 통과·사람이 넣음·뺌·자동 제외·검수 대기)를 보고 고친다
//  GET  /api/all       제품별 상태 개수,  GET /api/product?goodsNo=…  한 제품의 호수(옵션 묶음)·후보 사진
//  POST /api/decision  { key, value: 'ok'|'exclude'|'reset', hex?, clear?: [같은 호수의 다른 옵션 key] }
//  POST /api/build     검수 결과를 앱 데이터에 반영 (npm run shades:build 와 같다)
// 올리브영 페이지(https)에서 이 서버(localhost)로 보내므로 CORS 와 사설망 접근(Private Network Access) 헤더를 붙인다.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { RAW_DIR, REVIEW_FILE, loadRaw, loadReview, buildSource, inspectProduct } from './build-shades-source.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.SHADES_PORT) || 8766;
const products = JSON.parse(readFileSync(join(root, 'src/data/products.oliveyoung.json'), 'utf8'));
mkdirSync(RAW_DIR, { recursive: true });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Private-Network': 'true',
};
const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...CORS });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
async function readBody(req) {
  let s = '';
  for await (const c of req) { s += c; if (s.length > 5e6) throw new Error('너무 큼'); }
  return JSON.parse(s || '{}');
}

const goodsOf = (p) => p.id.replace(/^OY-/, '');
function collected() {
  const done = new Set();
  for (const f of readdirSync(RAW_DIR)) {
    if (!f.endsWith('.json')) continue;
    const raw = JSON.parse(readFileSync(join(RAW_DIR, f), 'utf8'));
    if (!raw.error) done.add(raw.goodsNo);
  }
  return done;
}
const pending = () => buildSource({ raws: loadRaw(), review: loadReview(), products }).pending;
const labelOf = Object.fromEntries(products.map((p) => [goodsOf(p), `${p.brand} ${p.name}`]));
const rawOf = (goodsNo) => {
  const f = join(RAW_DIR, goodsNo + '.json');
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
};
// 전체 검수: 한 호수를 화면에 보낼 모양. 보여 줄 사진 = 고른 옵션, 없으면 판정이 가장 나은 후보
const RANK = { ok: 0, review: 1, bad: 2 };
function groupView(g) {
  const best = g.pick || [...g.options].sort((a, b) => RANK[a.verdict] - RANK[b.verdict] || a.white - b.white)[0];
  return {
    key: g.key, label: g.label, status: g.status, hex: best.hex, img: best.img, shownKey: best.key,
    decided: g.options.some((o) => o.decision != null),
    options: g.options.map((o) => ({ key: o.key, alt: o.alt, img: o.img, hex: o.hex, verdict: o.verdict, decision: o.decision })),
  };
}
function summary() {
  const review = loadReview();
  return loadRaw().filter((r) => !r.error && labelOf[r.goodsNo]).map((raw) => {
    const count = { auto: 0, manual: 0, excluded: 0, bad: 0, pending: 0 };
    for (const g of inspectProduct(raw, review)) count[g.status]++;
    return { goodsNo: raw.goodsNo, label: labelOf[raw.goodsNo], count };
  }).sort((a, b) => a.label.localeCompare(b.label, 'ko'));
}

const PAGE = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>호수 검수</title>
<style>
body{margin:0;font:15px/1.5 system-ui,sans-serif;background:#f4f4f4;color:#111}
header{position:sticky;top:0;background:#111;color:#fff;padding:14px 20px;display:flex;gap:16px;align-items:center;z-index:1}
header b{font-size:18px} header span{opacity:.75}
main{padding:16px 20px}
.help{background:#fff;border-radius:12px;padding:12px 16px;margin-bottom:16px;line-height:1.7}
.prod{margin:0 0 20px}.prod h2{font-size:16px;margin:0 0 8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.it{background:#fff;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px}
.it.done{opacity:.35}
.pics{display:flex;gap:10px;align-items:center}
.pic{position:relative;flex:none}
.pics img{display:block;width:140px;height:140px;object-fit:contain;border-radius:8px;background:#eee;cursor:crosshair}
.mark{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px #000;pointer-events:none;display:none}
.side{display:flex;flex-direction:column;gap:6px;align-items:flex-start;min-width:0}
.dot{width:48px;height:48px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}
.hex{width:88px;font:13px ui-monospace,monospace;padding:4px 6px;border:1px solid #bbb;border-radius:6px}
.hex.bad{border-color:#c00}
.changed{font-size:12px;color:#06c}
.nm{font-weight:600}.alt{font-size:12px;color:#666;word-break:keep-all}
.btns{display:flex;gap:6px}.btns button{flex:1;font:inherit;padding:8px;border-radius:999px;border:1px solid #111;background:#fff;cursor:pointer}
.btns button.ok{background:#111;color:#fff}
.empty{background:#fff;border-radius:12px;padding:24px;text-align:center}
</style></head><body>
<header><b>호수 검수</b><span id="count">불러오는 중…</span></header>
<main>
<div class="help">자동 판정이 애매한 호수만 모았어요. 왼쪽은 올리브영 옵션 사진, 오른쪽 동그라미는 지금 저장될 색이에요.<br>
<b>스포이드</b>: 사진에서 입술 색이 보이는 곳을 누르면 그 자리 색(주변 5×5 평균)으로 바뀌어요 · <b>색상코드</b>: 칸에 #RRGGBB 로 직접 고쳐도 돼요<br>
<b>넣기</b>: 동그라미 색으로 저장 · <b>빼기</b>: 세트·병·상자 사진이라 색을 믿기 어려울 때 (뺀 호수는 화면에 나오지 않아요)</div>
<div id="list"></div></main>
<script>
const $ = (s) => document.querySelector(s);
const IMG = 'https://image.oliveyoung.co.kr/cfimages/cf-goods/uploads/images/';
let items = [];
async function load() {
  items = (await (await fetch('/api/review')).json()).pending;
  render();
}
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const isHex = (s) => /^#[0-9A-F]{6}$/i.test(s);
// 스포이드: 누른 자리 주변 5×5 픽셀 평균 (이미지 서버가 CORS 를 열어 둬서 캔버스로 읽을 수 있다)
function sample(img, ev) {
  const r = img.getBoundingClientRect();
  const w = img.naturalWidth, h = img.naturalHeight;
  const s = Math.min(r.width / w, r.height / h); // object-fit: contain
  const ox = (r.width - w * s) / 2, oy = (r.height - h * s) / 2;
  const x = Math.round((ev.clientX - r.left - ox) / s), y = Math.round((ev.clientY - r.top - oy) / s);
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(Math.max(0, x - 2), Math.max(0, y - 2), 5, 5).data;
  let R = 0, G = 0, B = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
  return { hex: toHex(R / n, G / n, B / n), left: ev.clientX - r.left, top: ev.clientY - r.top };
}
function render() {
  const left = items.filter((x) => !x.done).length;
  $('#count').textContent = '남은 검수 ' + left + '개 / 전체 ' + items.length + '개';
  if (!items.length) { $('#list').innerHTML = '<div class="empty">검수할 호수가 없어요.</div>'; return; }
  const by = {};
  for (const x of items) (by[x.label] ||= []).push(x);
  $('#list').innerHTML = '';
  for (const [label, xs] of Object.entries(by)) {
    const sec = document.createElement('section'); sec.className = 'prod';
    sec.innerHTML = '<h2></h2><div class="grid"></div>'; sec.querySelector('h2').textContent = label;
    for (const x of xs) sec.querySelector('.grid').appendChild(card(x));
    $('#list').appendChild(sec);
  }
}
function card(x) {
  x.cur ||= x.hex;
  const d = document.createElement('div'); d.className = 'it' + (x.done ? ' done' : '');
  d.innerHTML = '<div class="pics"><div class="pic"><img alt="옵션 사진 (누르면 그 자리 색을 가져와요)" crossorigin="anonymous"><span class="mark"></span></div>'
    + '<div class="side"><span class="dot"></span><input class="hex" maxlength="7" aria-label="색상코드"><span class="changed"></span></div></div>'
    + '<div class="nm"></div><div class="alt"></div><div class="btns"><button class="ok">넣기</button><button class="no">빼기</button></div>';
  const img = d.querySelector('img'), dot = d.querySelector('.dot'), hex = d.querySelector('.hex'), mark = d.querySelector('.mark'), changed = d.querySelector('.changed');
  img.src = IMG + x.img + '?RS=300x0';
  const show = () => { dot.style.background = x.cur; hex.value = x.cur; hex.classList.remove('bad'); changed.textContent = x.cur !== x.hex ? '자동 ' + x.hex + ' → 고침' : ''; };
  img.onclick = (ev) => {
    let s;
    try { s = sample(img, ev); } catch (e) { alert('이 사진은 색을 읽을 수 없어요. 색상코드를 직접 넣어 주세요.'); return; }
    if (!s) return;
    x.cur = s.hex; mark.style.display = 'block'; mark.style.left = s.left + 'px'; mark.style.top = s.top + 'px'; show();
  };
  hex.oninput = () => {
    let v = hex.value.trim().toUpperCase(); if (v && v[0] !== '#') v = '#' + v;
    if (isHex(v)) { x.cur = v; dot.style.background = v; hex.classList.remove('bad'); changed.textContent = v !== x.hex ? '자동 ' + x.hex + ' → 고침' : ''; }
    else hex.classList.add('bad');
  };
  d.querySelector('.nm').textContent = x.shade + (x.done ? ' · ' + (x.done === 'ok' ? '넣음 ' + x.cur : '뺌') : '');
  d.querySelector('.alt').textContent = x.alt;
  d.querySelector('.ok').onclick = () => { if (!isHex(x.cur)) return hex.classList.add('bad'); decide(x, 'ok'); };
  d.querySelector('.no').onclick = () => decide(x, 'exclude');
  show();
  return d;
}
async function decide(x, value) {
  const body = { key: x.key, value };
  if (value === 'ok' && x.cur !== x.hex) body.hex = x.cur; // 고친 색만 보낸다
  const r = await fetch('/api/decision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) return alert((await r.json()).error || '저장하지 못했어요');
  x.done = value; render();
}
load();
</script></body></html>`;

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (req.method === 'GET' && url.pathname === '/todo') {
      const done = collected();
      return send(res, 200, { todo: products.map(goodsOf).filter((g) => !done.has(g)) });
    }
    if (req.method === 'POST' && url.pathname === '/collect') {
      const body = await readBody(req);
      if (!/^A\d{9,}$/.test(body.goodsNo || '')) return send(res, 400, { error: '상품 번호가 이상해요' });
      const file = join(RAW_DIR, body.goodsNo + '.json');
      if (body.error && existsSync(file) && !JSON.parse(readFileSync(file, 'utf8')).error) return send(res, 200, { kept: true }); // 성공한 자료를 실패로 덮지 않는다
      writeFileSync(file, JSON.stringify(body, null, 1) + '\n');
      return send(res, 200, { ok: true, options: body.options?.length ?? 0 });
    }
    if (req.method === 'GET' && url.pathname === '/status') {
      return send(res, 200, { products: products.length, collected: collected().size, pending: pending().length });
    }
    if (req.method === 'GET' && url.pathname === '/review') return send(res, 200, PAGE, 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/all') return send(res, 200, readFileSync(join(root, 'scripts/shades-review-all.html'), 'utf8'), 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/api/all') return send(res, 200, { products: summary() });
    if (req.method === 'GET' && url.pathname === '/api/product') {
      const raw = rawOf(url.searchParams.get('goodsNo') || '');
      if (!raw || raw.error) return send(res, 404, { error: '모으지 않은 상품이에요' });
      return send(res, 200, { goodsNo: raw.goodsNo, label: labelOf[raw.goodsNo], groups: inspectProduct(raw, loadReview()).map(groupView) });
    }
    if (req.method === 'POST' && url.pathname === '/api/build') {
      const out = execFileSync(process.execPath, [join(root, 'scripts/build-shades-source.js')], { encoding: 'utf8' });
      return send(res, 200, { ok: true, log: out.trim() });
    }
    // 수집기 코드 (콘솔에 붙여 넣는 대신 불러올 때)
    if (req.method === 'GET' && url.pathname === '/collector.js') return send(res, 200, readFileSync(join(root, 'scripts/shades-collect.browser.js'), 'utf8'), 'text/javascript; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/api/review') {
      const label = Object.fromEntries(products.map((p) => [goodsOf(p), `${p.brand} ${p.name}`]));
      return send(res, 200, { pending: pending().map((x) => ({ ...x, label: label[x.goodsNo] || x.goodsNo })) });
    }
    if (req.method === 'POST' && url.pathname === '/api/decision') {
      const { key, value, hex, clear = [] } = await readBody(req);
      const okKey = (k) => /^A\d{9,}:\d+$/.test(k || '');
      if (!okKey(key) || !['ok', 'exclude', 'reset', 'hold'].includes(value) || !Array.isArray(clear) || !clear.every(okKey)) return send(res, 400, { error: '잘못된 값' });
      if (hex != null && !/^#[0-9A-F]{6}$/i.test(hex)) return send(res, 400, { error: '색상코드는 #RRGGBB 형식이어야 해요' });
      const review = loadReview();
      // 같은 호수의 다른 옵션에 남은 결정은 지운다 (한 호수에 결정은 하나). reset 은 자동 판정으로 되돌리기
      for (const k of clear) delete review[k];
      if (value === 'reset') delete review[key];
      // 색을 고쳐서 넣으면 { value: 'ok', hex } 로 저장한다 (build-shades-source.js 가 그 색을 쓴다)
      else review[key] = value === 'ok' && hex ? { value, hex: hex.toUpperCase() } : value;
      writeFileSync(REVIEW_FILE, JSON.stringify(review, null, 1) + '\n');
      return send(res, 200, { ok: true });
    }
    send(res, 404, { error: '없는 주소' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}).listen(PORT, () => console.log(`호수 수집·검수 서버: http://localhost:${PORT}  (검수 화면 /review)`));
