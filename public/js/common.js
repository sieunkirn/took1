// 공통 모듈: API 호출, 페이지 간 상태(sessionStorage), 제품 카드 렌더링, 공통 네비게이션
import { FINISH_LABELS, FAMILY_LABELS, finishLabel } from '../lib/constants.js';
import { fullName, shortName } from '../lib/catalog.js';

export { FINISH_LABELS, FAMILY_LABELS, finishLabel, fullName, shortName };

// 수집하지 않은 정보는 비워 두고, 추정한 값은 추정이라고 표시한다 (올리브영 데이터)
const shadeText = (p) => p.shade_name || (p.color_options ? `${p.color_options}가지 중 대표색` : '대표색');
const finishText = (p) => (p.finish ? FINISH_LABELS[p.finish] + (p.finish_source === 'product_name' ? ' (상품명 기준 추정)' : '') : '정보 없음');
const familyText = (p) => (FAMILY_LABELS[p.color_family] || p.color_family) + (p.color_family_source === 'estimated_from_color' ? ' (색상값으로 추정)' : '');

/** 올리브영 상세 페이지 링크 (새 창) */
export function storeLink(p, text = '올리브영에서 보기') {
  return p.url ? el('a', { href: p.url, text, target: '_blank', rel: 'noopener noreferrer' }) : null;
}

// 정적 모드: 서버 없이(예: claude.ai Artifact 링크) 같은 추천/검색/챗봇 로직을 브라우저에서 실행한다.
// 빌드 스크립트(scripts/build-static.js)가 <meta name="took-mode" content="static"> 을 넣는다.
export const STATIC = !!document.querySelector('meta[name="took-mode"][content="static"]');

let localApi = null;
async function getLocalApi() {
  if (!localApi) {
    localApi = (async () => {
      const [catalog, rec, chat, color] = await Promise.all([
        import('../lib/catalog.js'), import('../lib/recommend.js'), import('../lib/chat.js'), import('../lib/color.js'),
      ]);
      catalog.setProducts(await (await fetch(new URL('../data/products.json', import.meta.url))).json());
      return { catalog, rec, chat, color };
    })();
  }
  return localApi;
}

// server.js 의 /api 라우트와 같은 응답을 브라우저에서 만든다
async function staticApi(path, options) {
  const { catalog, rec, chat, color } = await getLocalApi();
  const url = new URL(path, 'http://local');
  const q = url.searchParams;
  const ok = (body) => ({ ok: true, status: 200, body });
  const fail = (status, error) => ({ ok: false, status, body: { error } });
  if (url.pathname === '/api/products') {
    const finish = q.get('finish');
    return ok({ products: catalog.allProducts().filter((p) => !finish || p.finish === finish) });
  }
  let m = url.pathname.match(/^\/api\/products\/barcode\/([^/]*)$/);
  if (m) {
    const code = catalog.normalizeBarcode(decodeURIComponent(m[1]));
    if (!/^\d{8,14}$/.test(code)) return fail(400, '바코드는 8~14자리 숫자여야 합니다.');
    const p = catalog.findByBarcode(code);
    return ok({ found: !!p, product: p, barcode: code });
  }
  m = url.pathname.match(/^\/api\/products\/([^/]+)$/);
  if (m) {
    const p = catalog.findById(decodeURIComponent(m[1]));
    return p ? ok({ product: p }) : fail(404, '제품을 찾을 수 없습니다.');
  }
  if (url.pathname === '/api/recommend') {
    const hex = color.normalizeHex(q.get('hex') || '');
    if (!hex) return fail(400, 'hex 파라미터가 필요합니다.');
    const limit = Math.min(30, Math.max(1, Number(q.get('limit')) || 10));
    const excludeIds = (q.get('exclude') || '').split(',').filter(Boolean);
    return ok({ hex, products: rec.recommendByColor(hex, { finish: q.get('finish') || null, limit, excludeIds }) });
  }
  if (url.pathname === '/api/chat') {
    const body = JSON.parse(options.body || '{}');
    if (!body.message) return fail(400, 'message 가 필요합니다.');
    return ok({ engine: 'rule-based', ...chat.answer({ message: body.message, baseProductId: body.baseProductId, selectedHex: body.selectedHex, context: body.context, tone: body.tone }) });
  }
  return fail(404, '알 수 없는 API 입니다.');
}

export async function api(path, options = {}) {
  if (STATIC) return staticApi(path, options);
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

// 페이지 이동 후에도 데이터가 유지되도록 sessionStorage 에 저장한다 (탭을 닫으면 초기화).
export const store = {
  get(key, fallback = null) {
    try {
      const v = sessionStorage.getItem('took.' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { sessionStorage.setItem('took.' + key, JSON.stringify(value)); } catch { /* 저장 불가 환경 */ }
  },
  remove(key) {
    try { sessionStorage.removeItem('took.' + key); } catch { /* noop */ }
  },
  // took 이 저장한 값(선택 색상, 추천 결과, 대화, 바코드 등)을 모두 지운다
  clear() {
    try {
      Object.keys(sessionStorage).filter((k) => k.startsWith('took.')).forEach((k) => sessionStorage.removeItem(k));
    } catch { /* noop */ }
  },
};

export const won = (n) => Number(n).toLocaleString('ko-KR') + '원';
// 페이지 이동: 전달값을 sessionStorage 에도 저장한다 (정적 모드에서는 URL 쿼리 없이 이동)
export function go(page, params = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''));
  store.set('nav', { page, params: clean });
  const query = new URLSearchParams(clean).toString();
  location.href = page + (!STATIC && query ? '?' + query : '');
}

// 이 페이지로 go() 이동하며 전달된 값. 새로고침해도 유지되고, 메뉴로 새로 들어오면 비워진다.
const HERE = location.pathname.split('/').pop() || 'index.html';
const NAV_PARAMS = (() => {
  const nav = store.get('nav');
  if (nav && nav.page === HERE) {
    store.set('navCurrent.' + HERE, nav.params);
    store.remove('nav');
  }
  return store.get('navCurrent.' + HERE, {});
})();

// URL 쿼리 → 없으면 go() 로 전달된 값
export function qs(name) {
  const fromUrl = new URLSearchParams(location.search).get(name);
  if (fromUrl !== null) return fromUrl;
  return NAV_PARAMS[name] ?? null;
}

// 전달값 없이 페이지를 새로 여는 링크 (메뉴 등)
function freshLink(page, text) {
  return el('a', { href: page, text, onclick: () => store.remove('navCurrent.' + page) });
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined) node.append(c);
  return node;
}

export function imagePlaceholder(product) {
  return el('div', { class: 'placeholder img', text: product?.image_url ? '이미지: ' + product.image_url : '제품 이미지' });
}

export function detailLink(product, from, text = '상세 보기') {
  return el('a', { href: 'product.html', text, onclick: (e) => { e.preventDefault(); go('product.html', { id: product.id, from }); } });
}

/**
 * 제품 카드. 색상은 칠하지 않고 텍스트로만 표시한다.
 * @param {object} product
 * @param {{from?: string, extraActions?: HTMLElement[]}} opts
 */
// 카드에는 브랜드·제품명·색상값·제형·가격과 올리브영 링크만 보여 준다 (나머지 정보는 제품 상세 화면에)
// extraActions: 화면마다 필요한 버튼 (예: 립 컬러 매핑의 '입술에 발라보기')
export function productCard(product, { extraActions = [] } = {}) {
  const rows = [
    ['브랜드', product.brand],
    ['제품명', product.name],
    // 색상값 옆에 실제 색 견본 (무채색 규칙의 예외: 제품 색 표시)
    ['색상값', [el('span', { class: 'color-dot', style: `background:${product.color_hex}`, 'aria-hidden': 'true' }), product.color_hex]],
    ['제형', finishLabel(product.finish)],
    ['가격', won(product.price)],
  ];
  // 대표 이미지 자리: 모든 카드에 같은 크기로 두어 줄이 맞게 한다.
  // 이미지 주소가 없거나 불러오지 못하면(외부 사이트 이미지 차단 등) '이미지 준비 중' 자리로 바꾼다
  const noImage = () => el('div', { class: 'card-img card-img-empty', text: '이미지 준비 중' });
  const image = product.image_url
    ? el('img', {
      class: 'card-img', src: product.image_url, alt: fullName(product), loading: 'lazy', referrerpolicy: 'no-referrer',
      onerror: (e) => e.target.replaceWith(noImage()),
    })
    : noImage();
  return el('div', { class: 'card', 'data-product-id': product.id },
    image,
    el('dl', {}, rows.flatMap(([k, v]) => [el('dt', { text: k }), Array.isArray(v) ? el('dd', {}, ...v) : el('dd', { text: v })])),
    el('div', { class: 'actions' },
      storeLink(product),
      ...extraActions),
  );
}

export function productDetailTable(p) {
  const rows = [
    ['ID', p.id], ['출처', p.source === 'oliveyoung' ? '올리브영 (수집 시점의 판매가)' : '시연용 가상 데이터'],
    ['바코드', p.barcode || '정보 없음'], ['브랜드', p.brand], ['제품명', p.name], ['종류', p.type],
    ['색상명', shadeText(p)], ['색상값(HEX)', p.color_hex],
    ['색상값(Lab)', `L* ${p.color_lab.L} / a* ${p.color_lab.a} / b* ${p.color_lab.b}`],
    ['색상 계열', familyText(p)],
    ['제형', finishText(p)], ['가격', won(p.price) + (p.list_price && p.list_price !== p.price ? ` (정가 ${won(p.list_price)})` : '')],
    ['설명', p.description || '정보 없음'],
  ];
  if (p.original_name) rows.push(['올리브영 상품명', p.original_name]);
  return el('table', {}, el('tbody', {}, rows.map(([k, v]) => el('tr', {}, el('th', { text: k }), el('td', { text: v }))),
    p.url ? el('tr', {}, el('th', { text: '올리브영' }), el('td', {}, storeLink(p, '상세 페이지 열기 (새 창)'))) : null));
}

export function renderNav() {
  const nav = el('header', { class: 'nav' },
    // 로고: 저장된 상태를 모두 지우고 홈으로 이동 (처음 상태로 초기화)
    el('strong', {}, el('a', { href: 'index.html', text: 'took(초기화)', id: 'nav-reset', onclick: () => store.clear() })),
    freshLink('index.html', '홈'),
    freshLink('lip-together.html', '립 컬러 매핑'), // 추천 같이 버전(카메라 오른쪽에 제품 추천)
    // 숨긴 탭(파일은 유지): freshLink('lip.html', '립 컬러 매핑(추천따로)'), freshLink('lip-test.html', '립 컬러 매핑(테스트)'),
    // 숨긴 탭(파일은 유지): freshLink('barcode.html', '바코드 검색'),
    freshLink('chat.html', 'AI 뷰티 챗봇'),
    // 숨긴 탭(파일은 유지): freshLink('chat-test.html', '챗봇(테스트)'),
  );
  document.body.prepend(nav);
}
