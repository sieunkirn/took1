import { renderNav, api, store, el, qs, go, productDetailTable, imagePlaceholder } from './common.js';

renderNav();
const form = document.getElementById('barcode-form');
const input = document.getElementById('barcode-input');
const result = document.getElementById('barcode-result');
const detail = document.getElementById('barcode-detail');
const goChat = document.getElementById('go-chat');
const goSimilar = document.getElementById('go-similar');
let current = null;

function showProduct(p) {
  current = p;
  store.set('barcodeLast', { barcode: p.barcode, id: p.id });
  result.replaceChildren(el('p', { text: `검색 성공: ${p.barcode} → ${[p.brand, p.name, p.shade_name].filter(Boolean).join(' ')}` }));
  detail.replaceChildren(el('div', { class: 'row' }, imagePlaceholder(p)), productDetailTable(p));
  goChat.disabled = false;
  goSimilar.disabled = false;
}

function clearProduct(message) {
  current = null;
  result.replaceChildren(el('p', { class: 'msg', text: message }));
  detail.textContent = '검색된 제품이 없습니다.';
  goChat.disabled = true;
  goSimilar.disabled = true;
}

async function search(raw) {
  const code = String(raw).replace(/\s+/g, '');
  if (!code) return clearProduct('바코드를 입력하세요.');
  if (!/^\d{8,14}$/.test(code)) {
    clearProduct(`바코드는 8~14자리 숫자여야 합니다: ${code}`);
  } else {
    result.textContent = '검색 중...';
    const { ok, body } = await api('api/products/barcode/' + encodeURIComponent(code));
    if (ok && body.found) showProduct(body.product);
    else if (ok) clearProduct(`검색 결과가 없습니다. 등록되지 않은 바코드입니다: ${code}`);
    else clearProduct(body.error || '검색 중 오류가 발생했습니다.');
  }
  // 연속 스캔을 위해 입력창을 비우고 포커스를 유지한다
  input.value = '';
  input.focus();
}

// 스캐너가 보내는 Enter 와 검색 버튼 모두 submit 이벤트로 처리된다
form.addEventListener('submit', (e) => {
  e.preventDefault();
  search(input.value);
});
document.getElementById('barcode-clear').addEventListener('click', () => {
  input.value = '';
  input.focus();
});
goChat.addEventListener('click', () => {
  if (!current) return;
  store.set('chatBaseId', current.id);
  go('chat.html', { base: current.id });
});
goSimilar.addEventListener('click', () => {
  if (!current) return;
  go('recommend.html', { hex: current.color_hex, exclude: current.id, source: 'barcode' });
});

const { body } = await api('api/products');
document.querySelector('#demo-barcodes tbody').replaceChildren(...body.products.map((p) =>
  el('tr', {},
    el('td', {}, el('a', { href: '#', 'data-barcode': p.barcode, text: p.barcode, onclick: (e) => { e.preventDefault(); input.value = p.barcode; search(p.barcode); } })),
    el('td', { text: p.brand }), el('td', { text: p.name }), el('td', { text: p.shade_name || '대표색' }))));

// 이전 검색 결과 복원 (상세 페이지 등에서 돌아온 경우)
const last = store.get('barcodeLast');
const initial = qs('code') || last?.barcode;
if (initial) search(initial);
