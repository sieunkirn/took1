// 서버 API 호출. 정적 모드(서버 없음)에서는 같은 응답을 브라우저에서 만든다.
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
