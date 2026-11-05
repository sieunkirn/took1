// 휴대폰 ↔ 이 화면 연결 (NFC 용). 서버(/api/pair)에 연결을 만들고 QR 주소를 돌려준 뒤,
// 휴대폰(nfc-phone.html)이 보낸 소식을 0.6초마다 가져와 onEvent 로 넘긴다 (바코드 QR 연결과 같은 폴링 방식)
// 정적 배포(Vercel)에는 서버가 없어서 쓸 수 없다 → { ok: false, reason: 'noserver' }
import { api } from './common.js';

export async function pairPhoneForNfc({ onEvent, onEnd }) {
  const { ok, body } = await api('api/pair', { method: 'POST', body: JSON.stringify({ target: 'nfc' }) }).catch(() => ({ ok: false, body: {} }));
  if (!ok || !body.id) return { ok: false, reason: 'noserver' };
  if (!body.phoneUrl) return { ok: false, reason: 'noaddress' };
  const id = body.id;
  let after = 0;
  let stopped = false;
  const timer = setInterval(async () => {
    const r = await api(`api/pair/${id}/poll?after=${after}`).catch(() => ({ ok: false, status: 0 }));
    if (stopped) return;
    if (r.status === 404) { stop(); onEnd?.(); return; }
    if (!r.ok) return; // 잠깐 끊김: 다음 번에 다시
    after = r.body.last;
    for (const e of r.body.events) onEvent(e);
  }, 600);
  function stop() { stopped = true; clearInterval(timer); }
  window.addEventListener('pagehide', stop);
  return { ok: true, phoneUrl: body.phoneUrl, stop };
}
