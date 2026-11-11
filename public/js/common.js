// 공통 모듈: API 호출, 페이지 간 상태(sessionStorage), 제품 카드 렌더링, 공통 네비게이션
import { FINISH_LABELS, FAMILY_LABELS, finishLabel } from '../lib/constants.js';
import { fullName as koFullName, shortName as koShortName } from '../lib/catalog.js';
import { toast, skeletonCards } from './motion.js'; // 화면 움직임(모든 화면 공통)
import { t, isEn, languageMenu, themeToggle, applyI18n, brandOf, nameOf, displayName, storeUrlOf, priceText, finishText as finishName } from './i18n.js'; // 화면 언어

// 화면에 보이는 제품 이름: 영어 화면이면 글로벌 올리브영 영어 이름(없으면 한국어 이름), 한국어면 그대로
export const fullName = (p) => (isEn() ? displayName(p) : koFullName(p));
export const shortName = (p) => (isEn() ? `${brandOf(p)} ${nameOf(p)}` : koShortName(p));
export { FINISH_LABELS, FAMILY_LABELS, finishLabel, toast, skeletonCards };

// 수집하지 않은 정보는 비워 두고, 추정한 값은 추정이라고 표시한다 (올리브영 데이터)
const shadeText = (p) => p.shade_name || (p.color_options ? t('detail.shadeOf', { n: p.color_options }) : t('detail.shadeRep'));
const finishText = (p) => (p.finish ? finishName(p.finish) + (p.finish_source === 'product_name' ? t('detail.byName') : '') : t('detail.none'));
const familyText = (p) => t('family.' + p.color_family) + (p.color_family_source === 'estimated_from_color' ? t('detail.byColor') : '');

/** 올리브영 상세 페이지 링크 (새 창) */
export function storeLink(p, text = t('card.store')) {
  const url = storeUrlOf(p); // 영어면 글로벌 올리브영
  return url ? el('a', { href: url, text, target: '_blank', rel: 'noopener noreferrer' }) : null;
}

// 정적 모드: 서버 없이(예: claude.ai Artifact 링크) 같은 추천/검색/챗봇 로직을 브라우저에서 실행한다.
// 빌드 스크립트(scripts/build-static.js)가 <meta name="took-mode" content="static"> 을 넣는다.
export const STATIC = !!document.querySelector('meta[name="took-mode"][content="static"]');

// ---------- 노트북·PC: 갤럭시탭 세로 크기 틀로 보기 ----------
// 키오스크는 스탠드형 동그란 거울 안에 갤럭시탭 S10 FE+ 를 세로로 넣어 쓴다(2026-11-11 가로에서 다시 세로로). 노트북·PC(마우스 화면)에서 열면
// 창을 꽉 채우지 않고 세로 미리보기(preview.html)의 탭 크기 틀(800×1280 을 창에 맞춤) 안에 지금 화면을 띄운다.
// - 터치 화면(실제 탭, pointer: coarse)·?device=tablet 으로 고정한 기기·직원 도구 화면·자동 테스트(navigator.webdriver)는 그대로
// 주소 값: ?쿼리 → 없으면 #조각
const HASH_PARAMS = (() => { try { return new URLSearchParams(location.hash.replace(/^#/, '')); } catch { return new URLSearchParams(); } })();
export function urlParam(name) {
  const v = new URLSearchParams(location.search).get(name);
  return v !== null ? v : HASH_PARAMS.get(name);
}
// 기기 모드 (주소 뒤 ?device=tablet, localStorage took.deviceMode):
//   tablet = 이 기기는 매장 태블릿 그 자체 (미리보기 틀 없이 화면을 바로 그린다. 모든 화면은 세로 기준).
//   주소 뒤 ?device=tablet 으로도 정하고, ?device=auto 로 해제한다. 손님 휴대폰 모드는 2026-11-11 없앴다
export const DEVICE_MODE = (() => {
  try {
    const want = new URLSearchParams(location.search).get('device');
    if (want === 'tablet') localStorage.setItem('took.deviceMode', want);
    else if (want === 'auto') localStorage.removeItem('took.deviceMode');
    const v = localStorage.getItem('took.deviceMode');
    if (v && v !== 'tablet') localStorage.removeItem('took.deviceMode'); // 예전 휴대폰 모드 설정은 지운다
    return v === 'tablet' ? v : null;
  } catch { return null; }
})();
// 예전 손님 휴대폰 표시(창 이름 took-phone)와 저장값(tookPhone.*)이 남아 있으면 지운다
try {
  if (window.name === 'took-phone') window.name = '';
  Object.keys(localStorage).filter((k) => k.startsWith('tookPhone.')).forEach((k) => localStorage.removeItem(k));
} catch { /* 저장 불가 환경 */ }
const SKEY = 'took.';
export const TAB_FRAME = true;
/** 이 화면을 탭 크기 틀로 옮기는 중이면 true (곧 다시 열리므로 화면마다 한 번만 할 일은 건너뛴다) */
export let MOVING_TO_TAB_FRAME = false;
const TAB_FRAME_SKIP = ['preview.html', 'scan-phone.html', 'barcodes.html', 'voice-test.html'];
// 새로고침(F5·새로고침 버튼)하면 처음 상태로: 기기 설정(태블릿 고정)을 풀고, 저장한 상태(took.*)를 비우고
// 첫 화면(시작 화면, 노트북이면 태블릿 미리보기)으로.
// 직원 도구 화면은 그대로. 미리보기(preview.html)는 그 화면 스크립트가 같은 일을 한다
(function reloadToStart() {
  const page = location.pathname.split('/').pop() || 'index.html';
  if (TAB_FRAME_SKIP.includes(page)) return;
  const nav = performance.getEntriesByType?.('navigation')?.[0];
  if (nav?.type !== 'reload') return;
  if (window.top !== window) return; // 미리보기 틀 안의 화면은 틀(preview.html)이 처음 상태로 되돌린다
  try { localStorage.removeItem('took.deviceMode'); } catch { /* 저장 불가 환경 */ }
  try { window.name = ''; } catch { /* 없음 */ }
  try { Object.keys(sessionStorage).filter((k) => k.startsWith('took.')).forEach((k) => sessionStorage.removeItem(k)); } catch { /* 저장 불가 환경 */ }
  if (page === 'index.html' && !DEVICE_MODE) return; // 이미 첫 화면 (아래 틀 옮기기는 그대로)
  MOVING_TO_TAB_FRAME = true; // 곧 다른 화면으로 가므로 화면마다 한 번만 할 일은 건너뛴다
  location.replace('index.html');
})();
(function openInTabFrame() {
  const page = location.pathname.split('/').pop() || 'index.html';
  if (!TAB_FRAME || window.top !== window || navigator.webdriver || TAB_FRAME_SKIP.includes(page) || DEVICE_MODE) return;
  if (matchMedia('(pointer: coarse)').matches || !matchMedia('(min-width: 700px)').matches) return; // 실제 탭(터치)·작은 화면은 그대로
  MOVING_TO_TAB_FRAME = true;
  location.replace('preview.html?page=' + encodeURIComponent(page + location.search));
})();

let localApi = null;
async function getLocalApi() {
  if (!localApi) {
    localApi = (async () => {
      const [catalog, rec, chat, color] = await Promise.all([
        import('../lib/catalog.js'), import('../lib/recommend.js'), import('../lib/chat.js'), import('../lib/color.js'),
      ]);
      catalog.setProducts(await (await fetch(new URL('../data/products.json', import.meta.url))).json());
      catalog.setDemoProducts(await (await fetch(new URL('../data/products.demo.json', import.meta.url))).json());
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
  if (url.pathname === '/api/demo-products') return ok({ products: catalog.allDemoProducts() });
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
    const pool = q.get('image') === '1' ? catalog.allProducts().filter((p) => p.image_url) : undefined;
    return ok({ hex, products: rec.recommendByColor(hex, { finish: q.get('finish') || null, limit, excludeIds, products: pool }) });
  }
  if (url.pathname === '/api/chat') {
    const body = JSON.parse(options.body || '{}');
    if (!body.message) return fail(400, 'message 가 필요합니다.');
    return ok({ engine: 'rule-based', ...chat.answer({ message: body.message, baseProductId: body.baseProductId, selectedHex: body.selectedHex, context: body.context, tone: body.tone, imageOnly: body.imageOnly === true, lang: body.lang === 'en' ? 'en' : 'ko' }) });
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
const BACKEND = () => sessionStorage;
export const store = {
  get(key, fallback = null) {
    try {
      const v = BACKEND().getItem(SKEY + key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try {
      BACKEND().setItem(SKEY + key, JSON.stringify(value));
    } catch { /* 저장 불가 환경 */ }
  },
  remove(key) {
    try { BACKEND().removeItem(SKEY + key); } catch { /* noop */ }
  },
  // took 이 저장한 값(선택 색상, 추천 결과, 대화, 바코드 등)을 모두 지운다
  clear() {
    try {
      const b = BACKEND();
      Object.keys(b).filter((k) => k.startsWith(SKEY)).forEach((k) => b.removeItem(k));
    } catch { /* noop */ }
  },
};

export const won = priceText; // 한국어 '13,000원', 영어 '₩13,000'
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

// URL 쿼리·#조각 → 없으면 go() 로 전달된 값
export function qs(name) {
  const fromUrl = urlParam(name);
  if (fromUrl !== null) return fromUrl;
  return NAV_PARAMS[name] ?? null;
}

// 전달값 없이 페이지를 새로 여는 링크 (메뉴 등)
function freshLink(page, text) {
  return el('a', { href: page, text, 'aria-current': page === HERE ? 'page' : null, onclick: () => store.remove('navCurrent.' + page) });
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

export function detailLink(product, from, text = t('card.detail')) {
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
    [t('card.brand'), brandOf(product)],
    [t('card.name'), nameOf(product)],
    // 색상값·제형 줄은 2026-11-11 카드에서 뺐다 (색은 제품 사진, 자세한 값은 제품 상세에서 본다)
    // 가격 숫자는 카드가 나타날 때 0에서 올라간다 (motion.js)
    [t('card.price'), Number.isFinite(Number(product.price)) && product.price !== null
      ? [el('span', { 'data-count': String(product.price), text: won(product.price) })]
      : (product.price == null ? t('detail.none') : won(product.price))], // 가격이 없는 테스트 제품은 '정보 없음'
  ];
  // 대표 이미지 자리: 모든 카드에 같은 크기로 두어 줄이 맞게 한다.
  // 이미지 주소가 없거나 불러오지 못하면(외부 사이트 이미지 차단 등) '이미지 준비 중' 자리로 바꾼다
  const noImage = () => el('div', { class: 'card-img card-img-empty', text: t('card.noImage') });
  const image = product.image_url
    ? el('img', {
      class: 'card-img', src: product.image_url, alt: displayName(product), loading: 'lazy', referrerpolicy: 'no-referrer',
      onerror: (e) => e.target.replaceWith(noImage()),
    })
    : noImage();
  return el('div', { class: 'card', 'data-product-id': product.id },
    image,
    el('dl', {}, rows.flatMap(([k, v]) => [el('dt', { text: k }), Array.isArray(v) ? el('dd', {}, ...v) : el('dd', { text: v })])),
    el('div', { class: 'actions' },
      ...extraActions),
  );
}

export function productDetailTable(p) {
  const rows = [
    ['ID', p.id], [t('detail.source'), p.source === 'oliveyoung' ? t('detail.sourceOy') : t('detail.sourceVirtual')],
    [t('detail.barcode'), p.barcode || t('detail.none')], [t('card.brand'), brandOf(p)], [t('card.name'), nameOf(p)], [t('detail.type'), t('type.' + p.type)],
    [t('detail.shade'), shadeText(p)], [t('detail.hex'), p.color_hex],
    [t('detail.lab'), `L* ${p.color_lab.L} / a* ${p.color_lab.a} / b* ${p.color_lab.b}`],
    [t('detail.family'), familyText(p)],
    [t('card.finish'), finishText(p)], [t('card.price'), won(p.price) + (p.list_price && p.list_price !== p.price ? ` (${t('detail.listPrice', { price: won(p.list_price) })})` : '')],
    [t('detail.desc'), p.description || t('detail.none')],
  ];
  if (p.original_name) rows.push([t('detail.originalName'), p.original_name]); // 한국 올리브영 원래 상품명 (영어 화면에서도 그대로)
  return el('table', {}, el('tbody', {}, rows.map(([k, v]) => el('tr', {}, el('th', { text: k }), el('td', { text: v }))),
    storeUrlOf(p) ? el('tr', {}, el('th', { text: t('detail.store') }), el('td', {}, storeLink(p, t('detail.storeOpen')))) : null));
}

// TOOK 로고 (사용자가 준 로고 그림을 따라 그림, 홈 대기 화면·상단 메뉴 공용): 굵은 T, 서로 맞닿은 두 O, 살짝 기운 K 기둥 + 길게 뻗은 사선 + 아래로 말리는 다리
const LOGO_INNER = '<g fill="currentColor">'
  + '<rect x="215" y="38" width="112" height="20"/><rect x="251" y="38" width="25" height="122"/>'
  + '<path d="M535 38H557L508 160H486Z"/>'
  + '</g><g fill="none" stroke="currentColor" stroke-width="24">'
  + '<ellipse cx="345" cy="98" rx="44" ry="50"/><ellipse cx="444" cy="98" rx="45" ry="50"/>'
  + '</g><g fill="none" stroke="currentColor" stroke-width="20">'
  + '<path d="M645 44L512 134"/><path d="M508 131C556 124 590 136 588 160"/>'
  + '</g></svg>';
/** TOOK 로고 SVG 문자열. 색은 글자색(currentColor)을 따른다 */
export const logoSvg = (cls = '') => `<svg class="${cls}" viewBox="212 36 442 126" role="img" aria-label="TOOK">${LOGO_INNER}</svg>`;

// 상단 로고 → 시작 화면(홈) 전환: 시작 화면 → 팔레트 움직임의 반대.
//  1) 종이색 막이 화면을 부드럽게 덮고(0.45초) 2) 메뉴의 TOOK 로고가 시작 화면의 큰 로고 자리로 커지며 날아간다(0.65초)
//  3) 시작 화면(home.js)은 로고가 이미 그 자리에 있고, 얼굴 → 안내 글 순서로 떠오른다 (sessionStorage took.homeFx)
// 저장한 상태는 먼저 비운다(처음 상태로). 동작 줄이기 설정이면 바로 이동
const HOME_FX_MS = 650;
function goHomeWithMotion(e) {
  store.clear();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; // 링크 그대로
  const svg = e.currentTarget.querySelector('svg');
  if (!svg) return;
  e.preventDefault();
  try { sessionStorage.setItem('took.homeFx', '1'); } catch { /* 저장 불가 환경: 시작 화면은 그냥 나온다 */ }
  const from = svg.getBoundingClientRect();
  // 시작 화면 로고 자리: 같은 스타일의 시작 화면을 보이지 않게 잠깐 만들어 잰다
  const probe = el('main', { class: 'home-standby', style: 'visibility:hidden;pointer-events:none' });
  probe.innerHTML = `<div class="hs-top">${logoSvg('hs-logo')}</div>`;
  document.body.append(probe);
  const to = probe.querySelector('svg').getBoundingClientRect();
  probe.remove();
  const veil = el('div', { class: 'home-veil', 'aria-hidden': 'true' });
  const fly = el('div', { class: 'home-fly', 'aria-hidden': 'true' });
  fly.innerHTML = logoSvg();
  Object.assign(fly.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
  document.body.append(veil, fly);
  svg.style.visibility = 'hidden';
  veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease-out', fill: 'forwards' });
  const k = to.width / from.width;
  fly.animate([{ transform: 'none' }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${k})` }],
    { duration: HOME_FX_MS, delay: 80, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
  setTimeout(() => { location.href = 'index.html'; }, HOME_FX_MS + 120);
}

// '기기 선택 해제': 이 기기를 태블릿으로 고정한 경우(DEVICE_MODE)에만 상단 메뉴에 보인다.
// 누르면 고정을 풀고 처음 상태(노트북이면 태블릿 미리보기)로 돌아간다. 미리보기 틀 안이면 틀 밖(최상위 창)을 옮긴다
function deviceResetButton() {
  if (!DEVICE_MODE) return null;
  return el('button', {
    type: 'button', class: 'nav-device-reset', text: t('nav.deviceReset'), title: t('nav.deviceResetTitle'),
    onclick: () => {
      if (!confirm(t('nav.deviceResetConfirm'))) return;
      try { localStorage.removeItem('took.deviceMode'); } catch { /* 저장 불가 환경 */ }
      try { window.name = ''; } catch { /* 없음 */ }
      try { window.top.location.replace('index.html?device=auto'); } catch { location.replace('index.html?device=auto'); }
    },
  });
}

/**
 * 상단 메뉴 + 키오스크 자동 초기화
 * @param {{ idle?: { seconds?: () => number, active?: () => boolean, onReset?: () => void } }} [opts]
 *   idle: 화면마다 자동 초기화를 바꿀 때 (거울 모드: 30초, 대기 화면이면 기다리기만, 초기화하면 홈 대신 대기 화면으로)
 */
export function renderNav(opts = {}) {
  if (document.querySelector('header.nav')) return; // 합본 화면처럼 스크립트 두 개가 함께 부르면 한 번만 그린다
  const nav = el('header', { class: 'nav' },
    // 로고(TOOK 그림): 누르면 저장된 상태를 모두 지우고 홈(대기 화면)으로. 읽어 주는 이름은 'took(초기화)'
    el('strong', {}, Object.assign(el('a', { href: 'index.html', id: 'nav-reset', class: 'nav-logo', 'aria-label': t('nav.reset'), title: t('nav.reset'), onclick: goHomeWithMotion }), { innerHTML: logoSvg() })),
    // 상단 '홈'·'팔레트' 메뉴는 2026-11-09 뺐다 (로고 = 시작 화면)
    // 오른쪽 끝: 다크 모드 켜기/끄기 + 언어 전환
    // AI 뷰티 챗봇 (2026-11-11 손님 휴대폰을 없애고 태블릿으로 합침)
    freshLink('chat.html', t('nav.chat')),
    el('div', { class: 'nav-lang' }, themeToggle(), languageMenu()),
  );
  document.body.prepend(nav);
  applyI18n();
  const idle = setupIdleReset(opts.idle);
  // 테스트 단계: 90초를 기다리지 않고 자동 초기화 안내를 바로 띄워 본다 (오른쪽 끝). 배포 때는 IDLE_TEST_BUTTON 을 false 로
  if (IDLE_TEST_BUTTON && idle) {
    nav.append(el('button', { type: 'button', class: 'nav-idle-test', text: t('nav.idleTest'), title: t('nav.idleTestTitle'), onclick: idle.warnNow }));
  }
  const reset = deviceResetButton();
  if (reset) nav.append(reset);
}

const IDLE_TEST_BUTTON = true;

// ---------- 키오스크 자동 초기화 ----------
// 손님이 떠난 뒤 다음 손님에게 앞 손님의 대화·측정한 톤·고른 색이 보이지 않게, 한동안 조작이 없으면 안내 후 지우고 홈으로 간다.
// - 대기 시간 기본 90초. 기기마다 바꾸려면 그 기기 브라우저에서 localStorage['took.idleSeconds'] = '120' (10초 이상)
// - 안내가 뜬 뒤 15초 안에 '계속하기'나 화면 아무 곳을 누르면 그대로 이어서 쓴다
// - 읽어주기·음성 듣기 중에는 기다린다. 홈에 지울 것이 없으면 아무것도 하지 않는다
// - 직원용 화면(음성 정확도 측정·시연용 바코드)은 <body data-idle-reset="off"> 로 끈다
const IDLE_DEFAULT_S = 90;
const IDLE_WARN_S = 15;

function idleSeconds() {
  try {
    const v = Number(localStorage.getItem('took.idleSeconds'));
    if (v >= 10) return v;
  } catch { /* 저장소를 못 쓰는 환경: 기본값 */ }
  return IDLE_DEFAULT_S;
}

/** 저장한 상태를 모두 지우고 홈으로 (자동 초기화·'처음으로' 버튼) */
export function resetToHome() {
  store.clear();
  location.href = 'index.html';
}

function hasSessionState() {
  try {
    return Object.keys(sessionStorage).some((k) => k.startsWith('took.') && k !== 'took.homeSkipIntro');
  } catch { return false; }
}

function setupIdleReset(custom = {}) {
  if (document.body.dataset.idleReset === 'off') return;
  const onHome = /(^|\/)(index\.html)?$/.test(location.pathname);
  let timer = null;
  let dialog = null;
  let countdown = null;
  let busySince = 0;
  // 읽어주는 중이거나 듣는 중(마이크 버튼에 listening 표시)이면 손님이 아직 있다.
  // 다만 speechSynthesis.speaking 이 끝나지 않고 남는 브라우저가 있어, 이 이유로는 최대 60초만 미룬다
  const busy = () => {
    const now = !!window.speechSynthesis?.speaking || !!document.querySelector('.listening');
    if (!now) { busySince = 0; return false; }
    busySince ||= Date.now();
    return Date.now() - busySince < 60000;
  };

  const seconds = () => {
    const v = Number(custom.seconds?.());
    return v >= 10 ? v : idleSeconds();
  };
  // 초기화: 기본은 저장한 상태를 지우고 홈으로, 화면이 따로 정했으면 그 동작 (거울 모드: 대기 화면으로)
  const reset = () => {
    if (!custom.onReset) return resetToHome();
    clearInterval(countdown);
    dialog?.remove();
    dialog = null;
    custom.onReset();
    schedule();
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(onIdle, seconds() * 1000);
  };
  const onIdle = () => {
    if (custom.active && !custom.active()) return schedule(); // 지울 것이 없는 상태(예: 거울 대기 화면)
    if (document.hidden || busy() || (onHome && !hasSessionState())) return schedule();
    showWarning();
  };
  const dismiss = () => {
    clearInterval(countdown);
    dialog?.remove();
    dialog = null;
    schedule();
  };
  // 안내: 글 대신 줄어드는 원 + 남은 초, 그리고 아이콘 버튼 두 개(손가락 = 계속, 집 = 처음으로).
  // 자세한 설명은 화면 읽기 프로그램용으로만 둔다
  function showWarning() {
    let left = IDLE_WARN_S;
    const num = el('span', { class: 'idle-num', 'aria-hidden': 'true', text: String(left) });
    const desc = el('p', { id: 'idle-desc', class: 'sr-only' });
    const update = () => {
      num.textContent = String(left);
      desc.textContent = t('idle.desc', { n: left });
    };
    update();
    const ring = el('div', { class: 'idle-ring', style: `--idle-s: ${IDLE_WARN_S}s` });
    ring.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="track" cx="60" cy="60" r="52"/><circle class="bar" cx="60" cy="60" r="52" pathLength="100"/></svg>';
    ring.append(num);
    const icon = (path) => {
      const s = el('span', { class: 'idle-icon', 'aria-hidden': 'true' });
      s.innerHTML = `<svg viewBox="0 0 24 24">${path}</svg>`;
      return s;
    };
    const HAND = '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.2a5 5 0 0 1-4-2L4.6 15.6a1.5 1.5 0 0 1 2.3-1.9L9 16"/>';
    const HOME = '<path d="M3 11 12 4l9 7M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"/>';
    const keep = el('button', { type: 'button', class: 'primary', 'aria-label': t('idle.keepAria'), onclick: dismiss }, icon(HAND), el('span', { text: t('idle.keep') }));
    dialog = el('div', { class: 'idle-overlay', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': t('idle.title'), 'aria-describedby': 'idle-desc',
      // 안내 바깥을 눌러도 계속 쓰는 것으로 본다
      onpointerdown: (e) => { if (e.target === dialog) dismiss(); } },
    el('div', { class: 'idle-box' },
      ring,
      desc,
      el('div', { class: 'idle-actions' }, keep,
        el('button', { type: 'button', 'aria-label': t('idle.homeAria'), onclick: reset }, icon(HOME), el('span', { text: t('idle.home') })))));
    document.body.append(dialog);
    keep.focus();
    countdown = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(countdown);
        reset();
      } else update();
    }, 1000);
  }

  for (const type of ['pointerdown', 'keydown', 'touchstart', 'wheel', 'input']) {
    window.addEventListener(type, () => { if (!dialog) schedule(); }, { capture: true, passive: true });
  }
  schedule();
  // 테스트 버튼: 기다리지 않고 안내를 바로 띄운다 (지울 것이 없어도 띄운다)
  return { warnNow: () => { if (!dialog) { clearTimeout(timer); showWarning(); } } };
}
