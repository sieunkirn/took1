// 서버 API 호출. 정적 모드(서버 없음)에서는 같은 응답을 브라우저에서 만든다.
// 정적 모드: 서버 없이(예: claude.ai Artifact 링크) 같은 추천/검색 로직을 브라우저에서 실행한다.
// 빌드 스크립트(scripts/build-static.js)가 <meta name="took-mode" content="static"> 을 넣는다.
import { realOnly } from './demo.js'; // 실데이터만 보기 설정 (정적 모드는 demo.js 가 catalog 에 직접 알린다)

export const STATIC = !!document.querySelector('meta[name="took-mode"][content="static"]');

let localApi = null;
async function getLocalApi() {
  if (!localApi) {
    localApi = (async () => {
      const [catalog, rec, color] = await Promise.all([
        import('../lib/catalog.js'), import('../lib/recommend.js'), import('../lib/color.js'),
      ]);
      catalog.setProducts(await (await fetch(new URL('../data/products.json', import.meta.url))).json());
      catalog.setDemoProducts(await (await fetch(new URL('../data/products.demo.json', import.meta.url))).json());
      // 실제 호수 데이터 (없는 옛 빌드면 빈 목록)
      catalog.setShades(await fetch(new URL('../data/products.shades.json', import.meta.url)).then((r) => (r.ok ? r.json() : [])).catch(() => []));
      return { catalog, rec, color };
    })();
  }
  return localApi;
}

/** 제품 데이터 미리 읽기 (2026-11-27 "제품 시트 열 때 로딩이 오래 걸림"): 정적 모드(앱)는 첫 추천 때에야 제품·호수 데이터(2.4MB)를 읽고 풀어서
 * 시트를 처음 열 때마다(자동 초기화로 화면이 새로 열린 뒤에도) 오래 걸렸다. 거울이 화면을 연 직후 미리 불러 둔다. 서버 모드는 할 일이 없다 */
export function warmApi() {
  if (STATIC) getLocalApi().catch(() => {});
}

// server.js 의 /api 라우트와 같은 응답을 브라우저에서 만든다
async function staticApi(path, options) {
  const { catalog, rec, color } = await getLocalApi();
  const url = new URL(path, 'http://local');
  const q = url.searchParams;
  const ok = (body) => ({ ok: true, status: 200, body });
  const fail = (status, error) => ({ ok: false, status, body: { error } });
  if (url.pathname === '/api/products') {
    const finish = q.get('finish');
    return ok({ products: catalog.allProducts().filter((p) => !finish || p.finish === finish) });
  }
  if (url.pathname === '/api/demo-products') return ok({ products: catalog.allDemoProducts() });
  if (url.pathname === '/api/shades') {
    const p = catalog.findById(q.get('id') || '');
    return p ? ok({ product: p, shades: catalog.shadesOf(p) }) : fail(404, '제품을 찾을 수 없습니다.');
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
    if (q.get('texture')) return ok({ hex, texture: q.get('texture'), ...rec.recommendByTexture(hex, q.get('texture'), { limit, excludeIds }) });
    return ok({ hex, products: rec.recommendByColor(hex, { finish: q.get('finish') || null, maxPrice: Number(q.get('maxPrice')) || null, limit, excludeIds }) });
  }
  return fail(404, '알 수 없는 API 입니다.');
}

export async function api(path, options = {}) {
  if (STATIC) return staticApi(path, options);
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(realOnly() ? { 'X-Took-Real-Only': '1' } : {}), ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}
