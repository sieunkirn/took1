// took(툭) 개발 서버: 정적 파일 + 제품 API (Node 내장 모듈만 사용)
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allProducts, findById, findByBarcode, normalizeBarcode } from './src/lib/repository.js';
import { recommendByColor } from './src/lib/recommend.js';
import { answer } from './src/lib/chat.js';
import { normalizeHex } from './src/lib/color.js';
import { createSession, getSession, notify, poll, lanAddress } from './src/lib/pairing.js';

const root = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(root, 'public');
const SHARED_LIB = join(root, 'src/lib'); // 브라우저에서 /lib/color.js 등으로 재사용
const BROWSER_LIBS = new Set(['color.js', 'constants.js', 'catalog.js', 'recommend.js', 'chat.js', 'spoken.js']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
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
    return sendJson(res, 200, {
      engine: 'rule-based',
      ...answer({ message: body.message, baseProductId: body.baseProductId, selectedHex: body.selectedHex, context: body.context, tone: body.tone }),
    });
  }
  // ---------- 휴대폰 ↔ PC 연결 (QR) ----------
  if (req.method === 'POST' && path === '/api/pair') {
    const id = createSession();
    // PC 를 localhost 로 열었으면 휴대폰은 접속할 수 없으므로 같은 와이파이의 PC 주소로 안내한다.
    // 터널(cloudflared 등)로 공개 주소를 쓰면 원래 주소·https 여부는 X-Forwarded-* 헤더로 들어온다
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const local = /^(localhost|127\.|\[::1\])/.test(host);
    const ip = local ? lanAddress() : null;
    const scheme = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || (req.socket.encrypted ? 'https' : 'http');
    const where = local ? (ip ? `${ip}:${req.socket.localPort}` : null) : host;
    return sendJson(res, 200, { id, phoneUrl: where ? `${scheme}://${where}/scan-phone.html?s=${id}` : null });
  }
  m = path.match(/^\/api\/pair\/([0-9a-f]{16})\/(poll|hello|code)$/);
  if (m) {
    const [, id, action] = m;
    if (!getSession(id)) return sendJson(res, 404, { error: '연결이 끝났어요. PC 화면에서 QR 을 다시 띄워 주세요.' });
    if (req.method === 'GET' && action === 'poll') return sendJson(res, 200, poll(id, Number(q.get('after')) || 0));
    if (req.method === 'POST' && action === 'hello') {
      notify(id, 'phone', {});
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'POST' && action === 'code') {
      const body = await readBody(req);
      const code = normalizeBarcode(String(body.code || '')).replace(/\D/g, '');
      if (!/^\d{8,14}$/.test(code)) return sendJson(res, 400, { error: '바코드는 8~14자리 숫자여야 해요.' });
      const p = findByBarcode(code);
      notify(id, 'code', { code });
      return sendJson(res, 200, { ok: true, code, found: !!p, name: p ? `${p.brand} ${p.name} ${p.shade_name}` : null });
    }
  }
  return sendJson(res, 404, { error: '알 수 없는 API 입니다.' });
}

async function serveStatic(res, pathname) {
  let file;
  if (pathname.startsWith('/lib/')) {
    const name = pathname.slice(5);
    if (!BROWSER_LIBS.has(name)) return notFound(res);
    file = join(SHARED_LIB, name);
  } else {
    const rel = normalize(decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
    file = join(PUBLIC, rel);
    if (!file.startsWith(PUBLIC)) return notFound(res);
  }
  try {
    const s = await stat(file);
    if (!s.isFile()) return notFound(res);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
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
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else await serveStatic(res, url.pathname);
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
    for (const list of Object.values(networkInterfaces())) {
      for (const a of list || []) {
        if (a.family === 'IPv4' && !a.internal) console.log(`  같은 Wi-Fi 의 iPad 에서 접속: ${scheme}://${a.address}:${port}`);
      }
    }
    if (!useHttps) console.log('  ※ http 로 접속한 iPad 에서는 카메라가 차단됩니다. 카메라가 필요하면 npm run cert 후 다시 실행하세요.');
  });
}
