// 화면 사이에 들고 다니는 값: sessionStorage 저장(store), 값과 함께 이동(go), 전달된 값 읽기(qs).
import { STATIC } from './api.js';
import { urlParam } from './device-frame.js';

const SKEY = 'took.';
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

// 페이지 이동: 전달값을 sessionStorage 에도 저장한다 (정적 모드에서는 URL 쿼리 없이 이동)
export function go(page, params = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''));
  store.set('nav', { page, params: clean });
  const query = new URLSearchParams(clean).toString();
  location.href = page + (!STATIC && query ? '?' + query : '');
}

// 이 페이지로 go() 이동하며 전달된 값. 새로고침해도 유지되고, 메뉴로 새로 들어오면 비워진다.
export const HERE = location.pathname.split('/').pop() || 'index.html';
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
