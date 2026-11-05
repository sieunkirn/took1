// 휴대폰 ↔ PC 연결 (서버 전용). PC 챗봇이 연결을 만들고 QR 로 주소를 보여 주면,
// 휴대폰이 찍은 바코드 번호를 서버가 모아 두고, PC 화면이 1초마다 새 소식을 가져간다(폴링).
// 실시간 스트림(SSE)은 무료 터널(cloudflared 빠른 터널)이 모아 두었다가 늦게 보내 쓰지 않는다.
// 연결 정보는 메모리에만 두고, 30분 동안 아무 일이 없으면 지운다.
import { randomBytes, randomInt } from 'node:crypto';
import { networkInterfaces } from 'node:os';

const IDLE_MS = 30 * 60 * 1000;
const KEEP_EVENTS = 20;
const sessions = new Map(); // id → { active, seq, events: [{ seq, type, data }], code }
// 네 자리 연결 번호 (NFC 테스트): 휴대폰에서 번호를 입력해 연결한다. 번호 → 연결 id
const codes = new Map();
// 틀린 번호를 여러 번 넣으면 잠시 막는다 (네 자리는 1만 가지라 마구 넣어 맞히는 것을 막기 위해)
const JOIN_MAX_FAILS = 8;
const JOIN_BLOCK_MS = 5 * 60 * 1000;
const joinFails = new Map(); // 접속 주소 → { n, first }

function cleanup() {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.active > IDLE_MS) sessions.delete(id);
  for (const [code, id] of codes) if (!sessions.has(id)) codes.delete(code);
  for (const [who, f] of joinFails) if (now - f.first > JOIN_BLOCK_MS) joinFails.delete(who);
}

export function createSession(code = null) {
  cleanup();
  const id = randomBytes(8).toString('hex'); // 추측하기 어려운 연결 번호
  sessions.set(id, { active: Date.now(), seq: 0, events: [], code });
  if (code) codes.set(code, id);
  return id;
}

/** 네 자리 번호 → 살아 있는 연결 id (없으면 null) */
export function sessionByCode(code) {
  cleanup();
  const id = codes.get(String(code));
  return id && sessions.has(id) ? id : null;
}

/**
 * 컴퓨터 화면이 쓸 번호로 연결을 연다. 전에 쓰던 번호(want)가 있으면 그 번호를 그대로 쓴다
 * (서버가 다시 켜져 연결이 사라졌어도 같은 번호로 다시 만든다). 다른 화면이 쓰고 있거나 없으면 새 번호
 * @returns {{ id: string, code: string }}
 */
export function openCodeSession(want = null) {
  cleanup();
  if (want && /^\d{4}$/.test(want)) {
    const id = sessionByCode(want);
    if (id) return { id, code: want }; // 같은 화면이 다시 연결 (새로 고침 등)
    return { id: createSession(want), code: want };
  }
  for (let i = 0; i < 200; i++) {
    const code = String(randomInt(0, 10000)).padStart(4, '0');
    if (!sessionByCode(code)) return { id: createSession(code), code };
  }
  throw new Error('빈 연결 번호가 없어요.');
}

/** 휴대폰이 번호로 연결. who: 접속 주소(틀린 횟수 세기). 결과 { id } | { error: 'blocked' | 'wrong' } */
export function joinByCode(code, who = '') {
  cleanup();
  const f = joinFails.get(who);
  if (f && f.n >= JOIN_MAX_FAILS) return { error: 'blocked' };
  const id = /^\d{4}$/.test(String(code)) ? sessionByCode(code) : null;
  if (id) { joinFails.delete(who); return { id }; }
  if (f) f.n++;
  else joinFails.set(who, { n: 1, first: Date.now() });
  return { error: 'wrong' };
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
