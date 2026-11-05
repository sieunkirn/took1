// 휴대폰 ↔ 이 화면 연결 (NFC 용, 팔레트·NFC 테스트 공통).
// 서버(/api/pair)에 연결을 열면 네 자리 번호가 나온다. 휴대폰은 nfc-phone.html 에서 그 번호를 입력하거나 QR 을 찍어 연결한다.
// 이 화면은 번호를 기억해 두고(localStorage), 새로 고치거나 서버가 다시 켜져 연결이 사라져도 같은 번호로 다시 연다.
// 휴대폰이 보낸 소식은 0.6초마다 가져와 onEvent 로 넘긴다 (바코드 QR 연결과 같은 폴링 방식)
// 정적 배포(Vercel)에는 서버가 없어서 쓸 수 없다 → { ok: false, reason: 'noserver' }
import { api } from './common.js';

const CODE_KEY = 'took.nfcPairCode';
const readCode = () => { try { return localStorage.getItem(CODE_KEY); } catch { return null; } };
const saveCode = (c) => { try { localStorage.setItem(CODE_KEY, c); } catch { /* 저장할 수 없는 환경: 이번에만 쓴다 */ } };

/**
 * @param {{ onEvent: (e: object) => void, onReconnect?: () => void, fresh?: boolean }} opts
 *   fresh: 기억한 번호를 버리고 새 번호를 받는다 ('번호 바꾸기')
 */
export async function pairPhoneForNfc({ onEvent, onReconnect, fresh = false }) {
  let code = fresh ? null : readCode();
  let id = null;
  async function open() {
    const { ok, body } = await api('api/pair', { method: 'POST', body: JSON.stringify({ target: 'nfc', code }) }).catch(() => ({ ok: false, body: {} }));
    if (!ok || !body.id) return null;
    id = body.id;
    code = body.code;
    saveCode(code);
    return body;
  }
  const first = await open();
  if (!first) return { ok: false, reason: 'noserver' };
  if (!first.phoneUrl) return { ok: false, reason: 'noaddress' };
  let after = 0;
  let stopped = false;
  let reopening = false;
  const timer = setInterval(async () => {
    if (reopening) return;
    const r = await api(`api/pair/${id}/poll?after=${after}`).catch(() => ({ ok: false, status: 0 }));
    if (stopped) return;
    if (r.status === 404) {
      // 서버가 다시 켜졌거나(무료 서버가 잠들었다 깸) 오래 쓰지 않아 연결이 사라졌다: 같은 번호로 다시 연다
      reopening = true;
      if (await open()) { after = 0; onReconnect?.(); }
      reopening = false;
      return;
    }
    if (!r.ok) return; // 잠깐 끊김: 다음 번에 다시
    after = r.body.last;
    for (const e of r.body.events) onEvent(e);
  }, 600);
  function stop() { stopped = true; clearInterval(timer); }
  window.addEventListener('pagehide', stop);
  return { ok: true, code: first.code, phoneUrl: first.phoneUrl, phoneBase: first.phoneBase, stop };
}
