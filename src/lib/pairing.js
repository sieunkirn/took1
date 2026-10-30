// 휴대폰 ↔ PC 연결 (서버 전용). PC 챗봇이 연결을 만들고 QR 로 주소를 보여 주면,
// 휴대폰이 찍은 바코드 번호를 서버가 모아 두고, PC 화면이 1초마다 새 소식을 가져간다(폴링).
// 실시간 스트림(SSE)은 무료 터널(cloudflared 빠른 터널)이 모아 두었다가 늦게 보내 쓰지 않는다.
// 연결 정보는 메모리에만 두고, 30분 동안 아무 일이 없으면 지운다.
import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';

const IDLE_MS = 30 * 60 * 1000;
const KEEP_EVENTS = 20;
const sessions = new Map(); // id → { active, seq, events: [{ seq, type, data }] }

function cleanup() {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.active > IDLE_MS) sessions.delete(id);
}

export function createSession() {
  cleanup();
  const id = randomBytes(8).toString('hex'); // 추측하기 어려운 연결 번호
  sessions.set(id, { active: Date.now(), seq: 0, events: [] });
  return id;
}

export function getSession(id) {
  cleanup();
  const s = sessions.get(String(id));
  if (s) s.active = Date.now();
  return s || null;
}

/** 휴대폰 쪽 소식(연결됨·바코드)을 쌓아 둔다 */
export function notify(id, type, data) {
  const s = getSession(id);
  if (!s) return false;
  s.events = [...s.events, { seq: ++s.seq, type, data }].slice(-KEEP_EVENTS);
  return true;
}

/** PC 가 마지막으로 받은 번호(after) 이후의 소식을 가져간다 */
export function poll(id, after = 0) {
  const s = getSession(id);
  if (!s) return null;
  return { events: s.events.filter((e) => e.seq > after), last: s.seq };
}

/** 같은 와이파이의 휴대폰이 접속할 PC 주소 (공유기 내부 주소를 우선) */
export function lanAddress() {
  const list = Object.values(networkInterfaces()).flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'))
    .map((a) => a.address);
  const rank = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
  return list.sort((a, b) => rank(a) - rank(b))[0] || null;
}
