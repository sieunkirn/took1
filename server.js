// took(툭) 개발 서버: 정적 파일 + 제품 API (Node 내장 모듈만 사용)
import { createServer } from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createServer as createHttpsServer } from 'node:https';
import { readFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allProducts, allDemoProducts, shadesOf, findById, findByBarcode, normalizeBarcode } from './src/lib/repository.js';
import { recommendByColor } from './src/lib/recommend.js';
import { hybridAnswer } from './src/lib/llm/agent.js';
import { abEnabled, abStats, recordEvent } from './src/lib/ab.js';
import { llmConfig, llmEnabled } from './src/lib/llm/client.js';
import { normalizeHex } from './src/lib/color.js';
import { BROWSER_LIBS } from './src/lib/browser-libs.js';
import { setRealOnlyGetter } from './src/lib/catalog.js';

const root = dirname(fileURLToPath(import.meta.url));
// .env (LLM 주소·키 등 서버 전용 설정). 없으면 규칙 챗봇만 쓴다
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const PUBLIC = join(root, 'public');
const SHARED_LIB = join(root, 'src/lib'); // 브라우저에서 /lib/color.js 등으로 재사용
const BROWSER_LIB_SET = new Set(BROWSER_LIBS);

// 실데이터만 보기 (2026-11-20): 화면이 'X-Took-Real-Only: 1' 을 보내면 그 요청에서 시연용 제품·호수를 뺀다 (public/js/demo.js).
// 서버 전체로 켜려면 환경변수 TOOK_REAL_ONLY=1. 요청마다 따로 기억해서(AsyncLocalStorage) 동시에 온 요청끼리 섞이지 않는다
const realOnlyScope = new AsyncLocalStorage();
setRealOnlyGetter(() => realOnlyScope.getStore() ?? process.env.TOOK_REAL_ONLY === '1');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.svg': 'image/svg+xml', // 아바타 테스트 그림 (samples/)
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 1e5) throw new Error('요청 본문이 너무 큽니다.');
  }
  return data ? JSON.parse(data) : {};
}

async function handleApi(req, res, url) {
  const path = url.pathname;
  const q = url.searchParams;

  if (req.method === 'GET' && path === '/api/products') {
    const finish = q.get('finish');
    return sendJson(res, 200, { products: allProducts().filter((p) => !finish || p.finish === finish) });
  }
  // 호수 안내·바코드 찾기가 쓰는 시연용 호수 데이터 (테스트 데이터)
  if (req.method === 'GET' && path === '/api/demo-products') return sendJson(res, 200, { products: allDemoProducts() });
  // 한 제품의 호수 전체 (호수 안내 shades.html). id 는 제품·호수·시연용 제품 어느 것이든 된다
  if (req.method === 'GET' && path === '/api/shades') {
    const p = findById(q.get('id') || '');
    return p ? sendJson(res, 200, { product: p, shades: shadesOf(p) }) : sendJson(res, 404, { error: '제품을 찾을 수 없습니다.' });
  }
  let m = path.match(/^\/api\/products\/barcode\/([^/]*)$/);
  if (req.method === 'GET' && m) {
    const code = normalizeBarcode(decodeURIComponent(m[1]));
    if (!/^\d{8,14}$/.test(code)) return sendJson(res, 400, { error: '바코드는 8~14자리 숫자여야 합니다.', barcode: code });
    const p = findByBarcode(code);
    // 미등록 바코드도 정상적인 검색 결과(결과 없음)로 응답한다
    return sendJson(res, 200, { found: !!p, product: p, barcode: code });
  }
  m = path.match(/^\/api\/products\/([^/]+)$/);
  if (req.method === 'GET' && m) {
    const p = findById(decodeURIComponent(m[1]));
    return p ? sendJson(res, 200, { product: p }) : sendJson(res, 404, { error: '제품을 찾을 수 없습니다.' });
  }
  if (req.method === 'GET' && path === '/api/recommend') {
    const hex = normalizeHex(q.get('hex') || '');
    if (!hex) return sendJson(res, 400, { error: 'hex 파라미터(예: #B3122E)가 필요합니다.' });
    const limit = Math.min(30, Math.max(1, Number(q.get('limit')) || 10));
    const excludeIds = (q.get('exclude') || '').split(',').filter(Boolean);
    const products = recommendByColor(hex, { finish: q.get('finish') || null, limit, excludeIds });
    return sendJson(res, 200, { hex, products });
  }
  if (req.method === 'POST' && path === '/api/chat') {
    const body = await readBody(req);
    if (!body.message || typeof body.message !== 'string') return sendJson(res, 400, { error: 'message 가 필요합니다.' });
    // 규칙 챗봇 먼저, 규칙이 뜻을 못 잡은 말만 LLM (설정했을 때). engine 으로 어느 쪽이 답했는지 알려 준다
    return sendJson(res, 200, await hybridAnswer({ message: body.message, baseProductId: body.baseProductId, selectedHex: body.selectedHex, context: body.context, tone: body.tone, lang: body.lang === 'en' ? 'en' : 'ko',
      // 상담 프롬프트의 '지금 상황': 어느 기기에서 묻는지, 매장 팔레트에서 넘어온 제형·농도 (src/lib/llm/agent.js contextNote)
      session: typeof body.session === 'string' ? body.session.slice(0, 32) : null, // 말투 다듬기 A/B 나누기용 무작위 id (개인정보 아님)
      handoff: body.handoff && typeof body.handoff === 'object' ? { finish: String(body.handoff.finish || ''), intensity: Number(body.handoff.intensity) } : null }));
  }
  // 말투 다듬기 A/B (src/lib/ab.js): 화면 행동 기록(빠른 답장·제품 카드 클릭)과 집계 보기. 질문 글·개인정보는 받지 않는다
  if (req.method === 'POST' && path === '/api/ab-event') {
    const body = await readBody(req).catch(() => ({}));
    return sendJson(res, 200, { ok: abEnabled() && recordEvent(String(body.session || ''), String(body.name || '')) });
  }
  if (req.method === 'GET' && path === '/api/ab-stats') {
    return sendJson(res, 200, { enabled: abEnabled(), llm: llmEnabled(), stats: abStats() });
  }
  return sendJson(res, 404, { error: '알 수 없는 API 입니다.' });
}

async function serveStatic(res, pathname, range) {
  let file;
  if (pathname.startsWith('/lib/')) {
    const name = pathname.slice(5);
    if (!BROWSER_LIB_SET.has(name)) return notFound(res);
    file = join(SHARED_LIB, name);
  } else {
    const rel = normalize(decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
    file = join(PUBLIC, rel);
    if (!file.startsWith(PUBLIC)) return notFound(res);
  }
  try {
    const s = await stat(file);
    if (!s.isFile()) return notFound(res);
    const type = MIME[extname(file)] || 'application/octet-stream';
    // 부분 요청(Range): 영상 구간 이동(currentTime)이 되려면 필요하다 (홈 배경 영상의 입술 장면 반복, 2026-11-18)
    const m = /^bytes=(\d*)-(\d*)$/.exec(range || '');
    if (m && (m[1] || m[2])) {
      const start = m[1] ? Number(m[1]) : Math.max(0, s.size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), s.size - 1) : s.size - 1;
      if (start > end || start >= s.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${s.size}` });
        return res.end();
      }
      const buf = (await readFile(file)).subarray(start, end + 1);
      res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${s.size}`, 'Content-Length': buf.length });
      return res.end(buf);
    }
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes' });
    res.end(await readFile(file));
  } catch {
    notFound(res);
  }
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
}

async function handler(req, res) {
  {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        const realOnly = req.headers['x-took-real-only'] === '1' || process.env.TOOK_REAL_ONLY === '1';
        await realOnlyScope.run(realOnly, () => handleApi(req, res, url));
      }
      else await serveStatic(res, url.pathname, req.headers.range);
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
  }
}

export function createApp() {
  return createServer(handler);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  // HTTPS: iPad Safari 는 HTTPS 에서만 카메라를 허용한다. certs/ 에 인증서가 있으면(npm run cert) HTTPS 로 실행
  const keyFile = process.env.HTTPS_KEY || join(root, 'certs/key.pem');
  const certFile = process.env.HTTPS_CERT || join(root, 'certs/cert.pem');
  const useHttps = process.env.HTTPS !== '0' && existsSync(keyFile) && existsSync(certFile);
  const server = useHttps
    ? createHttpsServer({ key: readFileSync(keyFile), cert: readFileSync(certFile) }, handler)
    : createApp();
  const scheme = useHttps ? 'https' : 'http';
  server.listen(port, '0.0.0.0', () => {
    console.log(`took(툭) 서버 실행: ${scheme}://localhost:${port}`);
    console.log(llmEnabled() ? `  챗봇: 규칙 + LLM 보조 (${llmConfig().model})` : '  챗봇: 규칙만 (.env 에 LLM_BASE_URL·LLM_MODEL 을 넣으면 LLM 보조가 켜집니다)');
    for (const list of Object.values(networkInterfaces())) {
      for (const a of list || []) {
        if (a.family === 'IPv4' && !a.internal) console.log(`  같은 Wi-Fi 의 iPad 에서 접속: ${scheme}://${a.address}:${port}`);
      }
    }
    if (!useHttps) console.log('  ※ http 로 접속한 iPad 에서는 카메라가 차단됩니다. 카메라가 필요하면 npm run cert 후 다시 실행하세요.');
  });
}
