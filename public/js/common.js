// 공통 모듈: API 호출, 페이지 간 상태(sessionStorage), 제품 카드 렌더링, 공통 네비게이션
import { FINISH_LABELS, FAMILY_LABELS, finishLabel } from '../lib/constants.js';
import { fullName as koFullName, shortName as koShortName } from '../lib/catalog.js';
import { toast, skeletonCards } from './motion.js'; // 화면 움직임(모든 화면 공통)
import { t, isEn, languageMenu, applyI18n, brandOf, nameOf, displayName, storeUrlOf, priceText, finishText as finishName } from './i18n.js'; // 화면 언어

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

// URL 쿼리 → 없으면 go() 로 전달된 값
export function qs(name) {
  const fromUrl = new URLSearchParams(location.search).get(name);
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
    // 색상값 옆에 실제 색 견본 (무채색 규칙의 예외: 제품 색 표시)
    [t('card.color'), [el('span', { class: 'color-dot', style: `background:${product.color_hex}`, 'aria-hidden': 'true' }), product.color_hex]],
    [t('card.finish'), finishName(product.finish)],
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
      storeLink(product),
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

export function renderNav() {
  if (document.querySelector('header.nav')) return; // 합본 화면처럼 스크립트 두 개가 함께 부르면 한 번만 그린다
  const nav = el('header', { class: 'nav' },
    // 로고: 저장된 상태를 모두 지우고 홈으로 이동 (처음 상태로 초기화)
    el('strong', {}, el('a', { href: 'index.html', text: t('nav.reset'), id: 'nav-reset', onclick: () => store.clear() })),
    // 상단 '홈' 버튼으로 가면 홈 인트로 애니메이션을 건너뛴다 (index.html 머리 스크립트가 읽고 지운다)
    Object.assign(freshLink('index.html', t('nav.home')), { onclick: () => { store.remove('navCurrent.index.html'); store.set('homeSkipIntro', true); } }),
    // 홈의 두 갈래와 같은 순서. 립 컬러 매핑·합본 화면은 파일만 남기고 메뉴에서 뺐다
    freshLink('palette.html', t('nav.palette')), // 물감을 섞어 립 색 조제 + 카메라로 발라 보기
    freshLink('chat.html', t('nav.chat')),
    // 테스트 단계 직원용: NFC 태그 인식 테스트 (배포 때는 NFC_TEST_MENU 를 false 로)
    NFC_TEST_MENU ? freshLink('nfc-test.html', t('nav.nfcTest')) : null,
    // 언어 전환 (오른쪽 끝): 한국어 화면에선 'English', 영어 화면에선 '한국어'
    el('div', { class: 'nav-lang' }, languageMenu()),
  );
  document.body.prepend(nav);
  applyI18n();
  // 가로·세로 바꿔 보기 (테스트 단계, 직원용): 가로 화면에서는 '세로로 보기' → 세로 미리보기(portrait.html)로 지금 화면을 연다.
  // 세로 미리보기 안에서는 '가로로 보기' → 미리보기를 닫고 지금 화면으로 돌아간다. 실제로 세워 둔 iPad 에서는 버튼을 숨긴다
  if (ORIENT_BUTTON) {
    const page = location.pathname.split('/').pop() || 'index.html';
    const inPreview = window.top !== window && /portrait\.html$/.test(window.top.location.pathname);
    if (inPreview || matchMedia('(orientation: landscape)').matches) {
      nav.append(el('button', {
        type: 'button', class: 'nav-orient', text: t(inPreview ? 'nav.landscape' : 'nav.portrait'), title: t(inPreview ? 'nav.landscapeTitle' : 'nav.portraitTitle'),
        onclick: () => {
          if (inPreview) window.top.location.href = page;
          else location.href = 'portrait.html?page=' + encodeURIComponent(page);
        },
      }));
    }
  }
  const idle = setupIdleReset();
  // 테스트 단계: 90초를 기다리지 않고 자동 초기화 안내를 바로 띄워 본다 (오른쪽 끝). 배포 때는 IDLE_TEST_BUTTON 을 false 로
  if (IDLE_TEST_BUTTON && idle) {
    nav.append(el('button', { type: 'button', class: 'nav-idle-test', text: t('nav.idleTest'), title: t('nav.idleTestTitle'), onclick: idle.warnNow }));
  }
}

const IDLE_TEST_BUTTON = true;
export const NFC_TEST_MENU = true; // 상단 메뉴의 'NFC 테스트' (테스트 단계)
const ORIENT_BUTTON = true; // 가로·세로 바꿔 보기 버튼 (배포 때 false 로)

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

function setupIdleReset() {
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

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(onIdle, idleSeconds() * 1000);
  };
  const onIdle = () => {
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
        el('button', { type: 'button', 'aria-label': t('idle.homeAria'), onclick: resetToHome }, icon(HOME), el('span', { text: t('idle.home') })))));
    document.body.append(dialog);
    keep.focus();
    countdown = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(countdown);
        resetToHome();
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
