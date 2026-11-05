// NFC 태그 → 등록 제품 (챗봇·팔레트 공통)
//
// 아이패드 웹(Safari)은 NFC 를 직접 읽지 못하므로, 키오스크에 외부 NFC 리더기(USB-C·블루투스, '키보드(HID) 모드')를 연결한다고 본다.
// 리더기는 태그를 대면 태그 번호(UID, 예: 04A1B2C3D4E5F6)나 태그에 써 둔 글자(예: 제품 ID)를 키보드처럼 아주 빠르게 치고 Enter 를 누른다.
// 사람은 그렇게 빨리 칠 수 없으므로(글자 사이 NFC_GAP ms 이하), 그런 입력만 태그로 보고 onTag(code) 를 부른다.
// 어느 칸에 커서가 있든 동작하고, 그 칸에 찍힌 글자는 지운다.
//
// 태그 → 제품 찾기 (resolveTag):
//  1) 태그에 제품 ID 를 써 둔 경우: 'OY-A000000241210' 또는 'A000000241210' 그대로 제품 ID 로 쓴다 (목록 등록 없이 바로 됨, 권장)
//  2) 태그 번호(UID)만 나오는 경우: 아래 NFC_TAGS 표에 '태그 번호 → 제품 ID' 를 적어 둔다
// 등록되지 않은 태그는 제품을 지어내지 않고 '등록되지 않은 태그'로 알린다.

// 태그 번호 → 제품 ID. 실제 태그를 붙이면 리더기에 대 보고 나온 번호를 여기에 적는다.
// TEST 로 시작하는 6개는 실제 태그가 아닌 시험용 번호다 (리더기 없이 시험할 때 window.tookNfc('TEST0001') 로 흉내 낸다)
export const NFC_TAGS = {
  TEST0001: 'OY-A000000241210', // 시험용 · 롬앤 더 쥬시 래스팅 틴트
  TEST0002: 'OY-A000001001860', // 시험용 · 시튜에아 에어리 무스 벨벳
  TEST0003: 'OY-A000000205485', // 시험용 · 토니모리 퍼펙트 립스 쇼킹 립
  TEST0004: 'OY-A000000262953', // 시험용 · 에뛰드 듀오 픽싱 틴트
  TEST0005: 'OY-A000001002946', // 시험용 · 시튜에아 체크 더 미러 클라우드 클레이
  TEST0006: 'OY-A000000207056', // 시험용 · 3CE 레이지 팝 립 스테인
};

const NFC_GAP = 60; // 글자 사이 최대 간격(ms). 리더기는 보통 10~30ms, 사람은 100ms 이상

// 태그 번호 표기를 하나로 맞춘다: 대문자, 콜론·공백 제거 (리더기마다 04:A1:B2… 처럼 나오기도 한다)
export function normalizeTag(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[:\s]/g, '');
}

// 태그 → 제품 ID (없으면 null)
export function resolveTag(raw) {
  const code = normalizeTag(raw);
  if (!code) return null;
  if (NFC_TAGS[code]) return NFC_TAGS[code];
  if (/^OY-A\d{9,}$/.test(code)) return code;
  if (/^A\d{9,}$/.test(code)) return 'OY-' + code;
  return null;
}

// 리더기 입력 듣기. 키를 칠 때마다 간격을 재서, 빠른 연속 입력 + Enter 만 태그로 본다
export function listenNfc(onTag) {
  let buf = '';
  let last = 0;
  const keyChar = (e) => {
    if (e.key.length === 1 && /[0-9A-Za-z:\-]/.test(e.key)) return e.key;
    // 한글 입력 상태에서는 key 가 'Process' 나 한글로 올 수 있어 code 로 영문·숫자를 알아본다
    let m = /^Key([A-Z])$/.exec(e.code);
    if (m) return m[1];
    m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
    if (m) return m[1];
    if (e.code === 'Minus') return '-';
    return null;
  };
  const onKey = (e) => {
    const now = performance.now();
    if (now - last > NFC_GAP) buf = '';
    last = now;
    if (e.key === 'Enter' && buf.length >= 6) {
      const code = buf;
      buf = '';
      e.preventDefault(); // 입력칸이 태그 번호를 질문으로 보내지 않게 막는다
      e.stopPropagation();
      const t = e.target;
      if ((t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) && t.value.toUpperCase().endsWith(code.toUpperCase())) t.value = t.value.slice(0, -code.length);
      onTag(code);
      return;
    }
    const ch = keyChar(e);
    if (ch) buf += ch;
    else if (e.key !== 'Shift') buf = '';
  };
  window.addEventListener('keydown', onKey, true);
  // 리더기 없이 시험할 때: 개발자 도구에서 tookNfc('TEST0001') (리더기와 같은 길을 지난다)
  window.tookNfc = (code) => onTag(String(code));
  return () => window.removeEventListener('keydown', onKey, true);
}

// ---------- 휴대폰 NFC(Web NFC) 인식 결과 → 등록 제품 (팔레트) ----------
// 실물 테스트 카드: 가린 번호(앞 2바이트·끝 1바이트, js/nfc-test.js 의 maskUid) → 올리브영 제품 ID.
// 원래 카드 번호는 적지 않는다. 휴대폰 연결로 받은 결과(가린 번호만 옴)도 같은 값이다
export const NFC_CARD_PRODUCTS = {
  '9F:93:••:47': 'OY-A000000241210', // 토스뱅크 카드 → 롬앤 더 쥬시 래스팅 틴트 (테스트용 연결)
  '52:62:••:54': 'OY-A000001001860', // 음식물쓰레기 종량제 카드 → 시튜에아 에어리 무스 벨벳 (테스트용 연결)
};

// 실물 테스트 카드를 읽었을 때 제품 카드에 보일 모습: 이름·사진은 카드 자체로, 입술에 바를 색·제형은 연결한 제품(위 표)에서 가져온다.
// 실제 판매 제품이 아니므로 가격·올리브영 링크는 비운다. 사진은 사용자가 준 카드 사진 (images/nfc-test/)
export const NFC_CARD_DISPLAY = {
  // 브랜드 + 이름이 이어서 '토스뱅크 카드', '음쓰 카드'로 읽힌다 (알림 문구는 브랜드와 이름을 붙여 쓴다)
  '9F:93:••:47': { id: 'TEST-CARD-TOSS', brand: '토스뱅크', brand_en: 'Toss Bank', name: '카드', name_en: 'card', image_url: 'images/nfc-test/toss-bank-card.png' },
  '52:62:••:54': { id: 'TEST-CARD-WASTE', brand: '음쓰', brand_en: 'Food waste', name: '카드', name_en: 'card', image_url: 'images/nfc-test/food-waste-card.png' },
};

/** 연결한 제품(base) 위에 카드 모습을 덮어쓴 표시용 제품 (테스트 데이터) */
export function cardProduct(masked, base) {
  const d = NFC_CARD_DISPLAY[masked];
  if (!d || !base) return base || null;
  return { ...base, ...d, shade_name: '', price: null, list_price: null, url: null, url_en: null, source: 'test', test_card: true };
}

/** 휴대폰 NFC 인식 결과 → 제품 ID (없으면 null). 태그에 제품 ID 를 써 둔 경우(NDEF text) > 실물 테스트 카드 */
export function resolveReading(r) {
  for (const rec of r.records || []) {
    const id = rec.text ? resolveTag(rec.text) : null;
    if (id) return id;
  }
  return (r.masked && NFC_CARD_PRODUCTS[r.masked]) || null;
}
