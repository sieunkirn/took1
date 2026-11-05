// NFC 태그 인식 테스트 (직원용, nfc-test.html · nfc-phone.html 공통)
//
// 실제 동작과 시뮬레이션을 나눈다:
//  - 실제: Web NFC(안드로이드 Chrome, 이 기기), 휴대폰 연결(갤럭시 S24 가 읽고 서버를 거쳐 전달), 외부 리더기(키보드 모드, js/nfc.js)
//  - 시뮬레이션: 화면의 'TOOK-001' 등 버튼. 태그를 읽은 것처럼 같은 처리 길을 지나지만 '시뮬레이션'으로 표시한다
//
// Web NFC 가 할 수 있는 것 / 없는 것 (Chrome 89+ 안드로이드, HTTPS, 화면이 켜져 있고 탭이 앞에 있을 때만):
//  - NDEF 형식 태그: 시리얼 번호(UID)와 NDEF 레코드(text·url 등)를 읽는다
//  - NDEF 로 포맷할 수 있는 빈 태그: 시리얼 번호만 읽고 레코드는 0개
//  - NDEF 가 아닌 카드(티머니·캐시비 같은 교통카드, 많은 출입카드): 'readingerror' 만 온다. 번호도 기술 종류도 알 수 없다
//  - 태그 기술 종류(NfcA·IsoDep·MIFARE 등)는 Web NFC 가 알려 주지 않는다 (네이티브 앱이 필요)
//  - 125kHz 출입카드는 휴대폰 NFC(13.56MHz)가 아예 감지하지 못한다
//
// 민감 정보: 교통카드·출입카드 번호는 저장하지 않고(메모리에만, 새로고침하면 사라짐), 다른 기기로 보낼 때는 원래 번호 대신
// 가린 번호(앞 2바이트·끝 1바이트)와 되돌릴 수 없는 지문(해시)만 보낸다. 카드의 보안 영역은 읽지 않는다(읽을 방법도 없다).

// 테스트용 가상 제품 (실제 판매 제품 데이터와 섞지 않는다)
export const NFC_TEST_PRODUCTS = {
  'TOOK-001': { id: 'TOOK-001', name: '테스트 립스틱 A', type: '립스틱', note: '시뮬레이션용 가상 데이터' },
  'TOOK-002': { id: 'TOOK-002', name: '테스트 립스틱 B', type: '립스틱', note: '시뮬레이션용 가상 데이터' },
  'TOOK-003': { id: 'TOOK-003', name: '테스트 립스틱 C', type: '립스틱', note: '시뮬레이션용 가상 데이터' },
  // 손에 있는 실물 카드로 시험하기 위한 테스트 제품 (카드 자체를 제품으로 본다)
  'TOOK-T01': { id: 'TOOK-T01', name: '토스뱅크 카드', type: '테스트용 실물 카드', image: 'images/nfc-test/toss-bank-card.png', note: '테스트용 가상 제품 (카드 번호만 가려서 사용, 결제 정보는 읽지 않음)' },
  'TOOK-T02': { id: 'TOOK-T02', name: '음쓰카드', type: '테스트용 실물 카드', image: 'images/nfc-test/food-waste-card.png', note: '테스트용 가상 제품 (카드 번호는 가려서만 표시)' },
};

// 실물 테스트 카드 표: 가린 번호(앞 2바이트·끝 1바이트) → 테스트 제품.
// 원래 카드 번호는 코드에 적지 않는다. 가린 번호는 휴대폰 연결로 받을 때도 같아서 두 방식 모두 맞춰진다.
// (가린 번호가 같은 다른 카드는 거의 없지만 0 은 아니다. 테스트 용도로만 쓴다)
// 갤럭시 S24 Chrome 에서 실제로 읽힌 값 (2026-11-05)
export const NFC_CARD_MAP = {
  '9F:93:••:47': 'TOOK-T01', // 토스뱅크 카드
  '52:62:••:54': 'TOOK-T02', // 음식물쓰레기 종량제 카드
};

/**
 * 인식 결과 → 테스트 제품 (없으면 product: null). 우선순위: 태그에 적힌 식별값 > 임시 연결 > 실물 테스트 카드 표
 * 등록되지 않은 카드는 제품을 지어내지 않는다
 * @param {Map<string,string>} [bindings] 화면에서 임시 연결한 지문 → 제품 ID
 */
export function resolveTestProduct(r, bindings = new Map()) {
  const P = NFC_TEST_PRODUCTS;
  if (r.tookId && NFC_TEST_MAP[r.tookId]) return { product: P[NFC_TEST_MAP[r.tookId]], by: `태그에 적힌 테스트용 식별값 ${r.tookId}` };
  if (r.fp && bindings.has(r.fp)) return { product: P[bindings.get(r.fp)], by: `임시 연결한 카드 (지문 ${r.fp.slice(0, 6)}…)` };
  if (r.masked && NFC_CARD_MAP[r.masked]) return { product: P[NFC_CARD_MAP[r.masked]], by: `등록한 테스트 카드 (번호 ${r.masked})` };
  return { product: null };
}

// 매핑 테이블: 태그에서 읽은 '테스트용 식별값' → 가상 제품 ID.
// 나중에 제품 스티커(NDEF)에 'TOOK-001' 같은 글자(text 레코드)나 이 글자가 들어간 주소(url 레코드)를 써 두면 바로 맞춰진다.
// 교통카드·출입카드의 번호는 여기에 적지 않는다. 시험할 때만 화면에서 '임시 연결'(메모리, 새로고침하면 사라짐)로 붙인다
export const NFC_TEST_MAP = {
  'TOOK-001': 'TOOK-001',
  'TOOK-002': 'TOOK-002',
  'TOOK-003': 'TOOK-003',
};

// 같은 태그를 이 시간 안에 다시 읽으면 다시 처리하지 않는다 (대고 있는 동안 여러 번 읽히거나 두 번 대는 경우)
export const DUP_MS = 2500;

/** 글자 안의 테스트용 식별값 'TOOK-001' 을 찾는다 ('took001', 'TOOK 001' 도 같은 값으로) */
export function findTookId(text) {
  const m = /TOOK[-_\s]?(\d{3})(?!\d)/i.exec(String(text || ''));
  return m ? `TOOK-${m[1]}` : null;
}

/** 시리얼 번호 표기 맞추기: '04:a1:b2' / '04A1B2' → '04:A1:B2' (16진수가 아니면 빈 글자) */
export function normalizeUid(raw) {
  const hex = String(raw || '').replace(/[:\-\s]/g, '').toUpperCase();
  if (!hex || hex.length % 2 || !/^[0-9A-F]+$/.test(hex)) return '';
  return hex.match(/../g).join(':');
}

/** 가린 번호: 앞 2바이트와 마지막 1바이트만 보인다 (04:A1:••:••:F6) */
export function maskUid(uid) {
  const parts = normalizeUid(uid).split(':').filter(Boolean);
  if (parts.length <= 3) return parts.map(() => '••').join(':');
  return parts.map((p, i) => (i < 2 || i === parts.length - 1 ? p : '••')).join(':');
}

/** 되돌릴 수 없는 지문(SHA-256 앞 16자리). 같은 카드면 같은 값이라 '임시 연결'에 쓰고, 원래 번호는 알 수 없다 */
export async function uidFingerprint(uid) {
  const norm = normalizeUid(uid);
  if (!norm || !globalThis.crypto?.subtle) return null;
  const bytes = new TextEncoder().encode('took-nfc-test|' + norm);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** NDEF 레코드 하나를 화면용으로 읽는다. text·url 만 글자로 풀고, 나머지는 종류와 크기만 */
export function describeRecord(rec) {
  const type = String(rec.recordType || 'unknown');
  const out = { type, mediaType: rec.mediaType || null, text: null, bytes: rec.data?.byteLength || 0 };
  try {
    if (rec.data && (type === 'text' || type === 'url' || type === 'absolute-url')) {
      out.text = new TextDecoder(rec.encoding || 'utf-8').decode(rec.data);
    }
  } catch { /* 풀 수 없는 인코딩 */ }
  return out;
}

/**
 * Web NFC 'reading' 이벤트 → 화면에서 쓰는 인식 결과
 * @returns {Promise<{kind:string, uid:string, masked:string, fp:string|null, tookId:string|null, records:object[]}>}
 */
export async function fromNdefEvent(e) {
  const records = [...(e.message?.records || [])].map(describeRecord);
  const uid = normalizeUid(e.serialNumber);
  let tookId = null;
  for (const r of records) tookId = tookId || findTookId(r.text);
  return {
    kind: records.length ? 'ndef' : 'ndef-empty',
    uid,
    masked: maskUid(uid),
    fp: await uidFingerprint(uid),
    tookId,
    records,
  };
}

/** 이 기기에서 Web NFC 를 쓸 수 있는지 (scan 전에 알 수 있는 것만) */
export function webNfcSupport() {
  if (typeof window === 'undefined') return { ok: false, code: 'unsupported' };
  if (!('NDEFReader' in window)) return { ok: false, code: 'unsupported' };
  if (!window.isSecureContext) return { ok: false, code: 'insecure' };
  return { ok: true, code: 'ok' };
}

// 상태 코드 → 안내 문장
export const NFC_STATE_TEXT = {
  idle: '아직 시작하지 않았어요',
  ready: '태그를 기다리는 중이에요 (휴대폰 뒷면 가운데에 카드를 대 주세요)',
  unsupported: '이 브라우저·기기는 Web NFC 를 지원하지 않아요. 안드로이드 Chrome(89 이상)에서 열어 주세요. iPad·PC·삼성 인터넷은 지원하지 않아요',
  insecure: 'https 주소가 아니라서 Web NFC 가 막혀 있어요. https 주소(Vercel 또는 cloudflared 터널)로 열어 주세요',
  denied: 'NFC 권한이 거부됐어요. Chrome 주소창 왼쪽 자물쇠 → 권한 → NFC 를 허용한 뒤 다시 시작해 주세요',
  off: 'NFC 가 꺼져 있어요. 설정 → 연결 → NFC 및 비접촉 결제를 켠 뒤 다시 시작해 주세요',
  nohw: '이 기기에는 NFC 가 없어요 (NFC 미지원 기기)',
  error: 'NFC 를 시작하지 못했어요. 페이지를 새로 고친 뒤 다시 시작해 주세요',
};

/** scan() 이 실패한 이유 → 상태 코드. Chrome: 권한 거부 NotAllowedError, NFC 꺼짐 NotReadableError, NFC 없음 NotSupportedError */
export function scanErrorCode(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError') return 'denied';
  if (name === 'NotReadableError') return 'off';
  if (name === 'NotSupportedError') return 'nohw';
  return 'error';
}

/**
 * Web NFC 읽기 시작 (반드시 버튼 누름 안에서 불러야 한다)
 * onReading(result) / onFail() 은 태그를 댈 때마다 불린다. 멈추는 함수를 돌려준다
 */
export async function startWebNfc({ onReading, onFail, signal }) {
  const sup = webNfcSupport();
  if (!sup.ok) throw Object.assign(new Error(sup.code), { code: sup.code });
  const reader = new window.NDEFReader();
  const ctrl = new AbortController();
  signal?.addEventListener('abort', () => ctrl.abort()); // 바깥에서 '다시 시도'로 버릴 때
  // 듣는 함수는 scan() 전에 단다 (Chrome 예제와 같은 순서. 시작 직후 대 둔 카드도 놓치지 않게)
  reader.addEventListener('reading', async (e) => { if (!ctrl.signal.aborted) onReading(await fromNdefEvent(e)); });
  reader.addEventListener('readingerror', () => { if (!ctrl.signal.aborted) onFail(); });
  // 권한 확인은 scan() 을 부르기 전에 기다리지 않는다: 버튼 누름(사용자 동작)이 scan() 까지 그대로 이어져야 권한 창이 뜬다
  try {
    await reader.scan({ signal: ctrl.signal });
  } catch (e) {
    throw Object.assign(new Error(e.message), { code: scanErrorCode(e) });
  }
  return () => ctrl.abort();
}

/** 인식 결과가 '같은 태그'인지 가르는 열쇠 (식별값 > 지문 > 읽기 실패) */
export function readingKey(r) {
  if (r.tookId) return 't:' + r.tookId;
  if (r.fp) return 'f:' + r.fp;
  if (r.kind === 'unreadable') return 'x:unreadable';
  return null;
}

/** 중복 거르기: 같은 열쇠를 DUP_MS 안에 다시 받으면 true */
export function makeDedupe(ms = DUP_MS, now = () => Date.now()) {
  let lastKey = null;
  let lastAt = 0;
  return (r) => {
    const key = readingKey(r);
    const t = now();
    const dup = !!key && key === lastKey && t - lastAt < ms;
    lastKey = key;
    lastAt = t;
    return dup;
  };
}

// 태그 종류 → 안내 문장
export const KIND_TEXT = {
  ndef: 'NDEF 태그 (데이터가 기록된 태그)',
  'ndef-empty': 'NDEF 로 쓸 수 있는 빈 태그 (기록된 데이터 없음, 번호만 읽힘)',
  unreadable: '감지됐지만 읽지 못한 태그',
  hid: '외부 리더기 입력 (키보드 모드)',
  simulation: '시뮬레이션 (실제 태그 아님)',
};
