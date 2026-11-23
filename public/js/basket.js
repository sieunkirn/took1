// 카드 담기 API (2026-11-23). 휴대폰 담기 화면(basket.html)과 거울(nfc-window.js)이 같이 쓴다.
// 기록은 서버(server.js /api/basket)에만 있다. Vercel·앱(APK) 같은 정적 화면은 서버가 없으므로 Render 서버로 보낸다.
// Render 무료 플랜은 15분 쉬면 잠들고, 깨는 데 50초쯤 걸린다 → 거울은 열려 있는 동안 10분마다 깨워 둔다(keepAwake).
import { STATIC } from './api.js';

export const BASKET_SERVER = STATIC ? 'https://took-y6rn.onrender.com' : '';
const URL_ = BASKET_SERVER + '/api/basket';

async function call(method, query, body, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(URL_ + (query ? '?' + new URLSearchParams(query) : ''), {
      method,
      signal: ctl.signal,
      cache: 'no-store',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '서버 오류 ' + res.status);
    return data; // { card, items: [제품], updated }
  } finally {
    clearTimeout(timer);
  }
}

// 휴대폰은 서버가 깨어나길 기다릴 수 있게 길게, 거울은 태그 반응이 늦지 않게 짧게
export const getBasket = (card, { timeoutMs = 60000 } = {}) => call('GET', { card }, null, timeoutMs);
export const addToBasket = (card, id) => call('POST', null, { card, id }, 60000);
export const removeFromBasket = (card, id) => call('DELETE', { card, id }, null, 60000);
export const clearBasket = (card) => call('DELETE', { card }, null, 60000);

/** 서버 깨워 두기: 지금 한 번, 그 뒤 10분마다 (끄는 함수를 돌려준다) */
export function keepAwake() {
  const ping = () => getBasket('PING0000', { timeoutMs: 70000 }).catch(() => {});
  ping();
  const id = setInterval(ping, 10 * 60 * 1000);
  return () => clearInterval(id);
}

// ---------- 거울에 보내기 (2026-11-23, server.js handleSend) ----------
const SEND_URL = BASKET_SERVER + '/api/basket/send';
async function sendCall(method, query, body, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(SEND_URL + (query ? '?' + new URLSearchParams(query) : ''), {
      method, signal: ctl.signal, cache: 'no-store',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '서버 오류 ' + res.status);
    return data.sent || null; // { id, card, mode: 'tap'|'now', at }
  } finally {
    clearTimeout(timer);
  }
}
/** 휴대폰: mode 'tap' = 20초 안에 휴대폰을 거울 리더기에 댈게요, 'now' = 거울에 바로 띄워 주세요 */
export const sendToMirror = (card, mode) => sendCall('POST', null, { card, mode }, 60000);
/** 거울: 지금 보낸 카드 (없으면 null) */
export const getSent = ({ timeoutMs = 4000 } = {}) => sendCall('GET', null, null, timeoutMs);
/** 거울: 받은 것 지우기 (같은 걸 두 번 띄우지 않게) */
export const takeSent = (id) => sendCall('DELETE', { id }, null, 8000).catch(() => null);
