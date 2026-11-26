// NFC 태그 → 등록 제품 (홈·팔레트 공통)
//
// 아이패드 웹(Safari)은 NFC 를 직접 읽지 못하므로, 키오스크에 외부 NFC 리더기(USB-C·블루투스, '키보드(HID) 모드')를 연결한다고 본다.
// 리더기는 태그를 대면 태그 번호(UID, 예: 04A1B2C3D4E5F6)나 태그에 써 둔 글자(예: 제품 ID)를 키보드처럼 아주 빠르게 치고 Enter 를 누른다.
// 사람은 그렇게 빨리 칠 수 없으므로(글자 사이 NFC_GAP ms 이하), 그런 입력만 태그로 보고 onTag(code) 를 부른다.
// 어느 칸에 커서가 있든 동작하고, 그 칸에 찍힌 글자는 지운다.
//
// 태그 → 제품 찾기 (findTagProduct, 아래 순서):
//  1) 태그 번호(UID)만 나오는 경우: 아래 NFC_TAGS 표에 '태그 번호 → 제품 ID' 를 적어 둔다 (표가 가장 먼저)
//  2) 태그에 제품 ID 를 써 둔 경우: 'OY-A000000241210' 또는 'A000000241210' 그대로 제품 ID 로 쓴다 (목록 등록 없이 바로 됨, 호수 구분은 없음)
//  3) 태그에 그 제품 포장의 바코드 번호(8~14자리 숫자, 예: 8809625240172)를 써 둔 경우: 바코드 검색과 같은 데이터로 찾는다
//     (목록 등록 없이 바로 되고 호수까지 찾음, 가장 권장). 바코드 스캐너는 쓰지 않는다(없는 기능).
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
  // 테스트용 실물 카드 3장 (2026-11-18, ACR1555U 로 메모장에 찍어 본 번호). 제품은 시험용 TEST0001~0003 과 같게 붙였다
  // 1번·3번은 메모에 글자가 몇 개 빠져 있다(정상 UID 는 14글자인데 11글자). 아래 matchTag 가 빠진 글자를 감안해 찾지만,
  // 관리자 화면 'NFC 태그 확인'에서 다시 대 보고 나온 14글자로 바꿔 적는 게 가장 확실하다
  '0408A322491': 'OY-A000000241210', // 테스트 카드 1번 (메모: 04 08 A 32 24 91, 일부 빠짐) · 롬앤 더 쥬시 래스팅 틴트
  '04379D1A322490': 'OY-A000001001860', // 테스트 카드 2번 (04 37 9D 1A 32 24 90) · 시튜에아 에어리 무스 벨벳
  '04BCE512490': 'OY-A000000205485', // 테스트 카드 3번 (메모: 04 BC E5 124 90, 일부 빠짐) · 토니모리 퍼펙트 립스 쇼킹 립
};

// 글자 사이 최대 간격(ms). 리더기는 보통 10~30ms 지만 블루투스(ACR1555U)는 가끔 늦게 몰려와 60ms 로는 앞부분이 잘렸다 (2026-11-18).
// 표 줄의 이름 (관리자 화면 'NFC 태그 확인'에 보여 줄 이름)
export const NFC_LABELS = {
  '0408A322491': '1번 카드',
  '04379D1A322490': '2번 카드',
  '04BCE512490': '3번 카드',
};

const NFC_GAP = 150;

// 태그 번호 표기를 하나로 맞춘다: 대문자, 콜론·공백 제거 (리더기마다 04:A1:B2… 처럼 나오기도 한다)
export function normalizeTag(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[:\s]/g, '');
}

// a 가 b 의 부분 수열인가 (b 에서 몇 글자를 빼면 a 가 되는가)
const isSubseq = (a, b) => { let i = 0; for (const ch of b) if (ch === a[i]) i++; return i === a.length; };

/**
 * 표에서 태그 찾기. 같은 번호가 먼저이고, 없으면 '글자가 빠진 읽기'를 감안한다:
 * 블루투스 키보드 입력은 가끔 글자를 몇 개 흘린다. 그래서 짧은 쪽이 긴 쪽에서 글자 몇 개만 뺀 것(순서 그대로)이고,
 * 짧은 쪽이 8글자 이상이며, 그렇게 맞는 표 줄이 딱 하나일 때만 같은 태그로 본다 (애매하면 등록되지 않은 태그로 둔다).
 * 돌려주는 값: 표의 키 (없으면 null)
 */
export function matchTag(raw) {
  const code = normalizeTag(raw);
  if (!code) return null;
  if (NFC_TAGS[code]) return code;
  if (!/^[0-9A-F]{8,}$/.test(code)) return null;
  const hits = Object.keys(NFC_TAGS).filter((k) => {
    if (k.length === code.length || !/^[0-9A-F]+$/.test(k)) return false;
    const [short, long] = k.length < code.length ? [k, code] : [code, k];
    return short.length >= 8 && long.length - short.length <= 6 && isSubseq(short, long);
  });
  return hits.length === 1 ? hits[0] : null;
}

// 태그 → 제품 ID (없으면 null)
export function resolveTag(raw) {
  const code = normalizeTag(raw);
  if (!code) return null;
  const key = matchTag(code);
  if (key) return NFC_TAGS[key];
  if (/^OY-A\d{9,}$/.test(code)) return code;
  if (/^A\d{9,}$/.test(code)) return 'OY-' + code;
  return null;
}

// 태그에 써 둔 바코드 번호 (8~14자리 숫자가 아니면 null)
export function tagBarcode(raw) {
  const code = normalizeTag(raw);
  return /^\d{8,14}$/.test(code) ? code : null;
}

/**
 * 태그 → 등록 제품 (없으면 null). 표·제품 ID 를 먼저 보고, 아니면 바코드 번호로 찾는다(호수까지).
 * api 는 common.js 의 api (주소 → { ok, body }). 이 파일을 node 테스트에서도 불러오도록 인자로 받는다.
 */
export async function findTagProduct(raw, api) {
  const id = resolveTag(raw);
  if (id) {
    const r = await api('api/products/' + encodeURIComponent(id));
    return (r?.ok && r.body?.product) || null;
  }
  const code = tagBarcode(raw);
  if (code) {
    const r = await api('api/products/barcode/' + code);
    return (r?.ok && r.body?.found && r.body.product) || null;
  }
  return null;
}

// 리더기 입력 듣기. 키를 칠 때마다 간격을 재서, 빠른 연속 입력 + Enter 만 태그로 본다
/**
 * 태그를 읽었을 때 안내 줄에 문구를 잠깐 띄웠다가 평소 문구(idleText)로 되돌리는 함수를 만든다.
 * node 가 없는 화면에서는 아무 일도 하지 않는다.
 */
export function createNfcHint(node, { idleText = '', ms }) {
  let timer = null;
  return (text) => {
    if (!node) return;
    node.textContent = text;
    node.classList.add('hit');
    clearTimeout(timer);
    timer = setTimeout(() => { node.textContent = idleText; node.classList.remove('hit'); }, ms);
  };
}

// 키가 실제로 들어온 시각(ms, 1970년 기준). 처리한 시각(performance.now)으로 재면 팔레트가 카메라·입술 추적으로 잠깐 멈춘 사이
// 들어온 글자들이 늦게 한꺼번에 처리되면서 간격이 NFC_GAP 을 넘어 번호 앞부분이 잘린다 → 이벤트에 찍힌 시각(timeStamp)으로 잰다 (2026-11-18).
// 키오스크 틀(kiosk.html)이 넘겨 준 키는 틀이 원래 키의 시각을 tookAt 에 담아 준다 (틀과 화면은 시각 기준점이 달라서 절대 시각으로 맞춘다)
const keyTime = (e) => e.tookAt || (e.timeStamp ? performance.timeOrigin + e.timeStamp : Date.now());

// ACR1555U(블루투스 키보드 모드) 기본 출력은 '04 A1 B2 C3 D4 E5 F6' + Enter 처럼 바이트 사이에 띄어쓰기가 들어간다.
// 그래서 빠르게 이어 들어오는 띄어쓰기는 버리지 않고 건너뛴다(raw 에는 남겨 입력칸에서 지울 때 쓴다).
export function listenNfc(onTag) {
  let buf = '';
  let raw = '';
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
    const now = keyTime(e);
    if (now - last > NFC_GAP) { buf = ''; raw = ''; }
    last = now;
    if (e.key === 'Enter' && buf.length >= 6) {
      const code = buf;
      const typed = raw.trimEnd();
      buf = '';
      raw = '';
      e.preventDefault(); // 입력칸이 태그 번호를 질문으로 보내지 않게 막는다
      e.stopPropagation();
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
        const v = t.value.trimEnd();
        if (v.toUpperCase().endsWith(typed.toUpperCase())) t.value = v.slice(0, -typed.length);
        else if (v.toUpperCase().endsWith(code.toUpperCase())) t.value = v.slice(0, -code.length);
      }
      onTag(code);
      return;
    }
    const ch = keyChar(e);
    if (ch) { buf += ch; raw += ch; }
    else if (e.key === ' ' && buf) {
      raw += ' ';
      // 리더기가 바이트 사이에 치는 띄어쓰기가 포커스가 남은 버튼을 누르지 않게 막는다 (2026-11-18, 실제 키 입력으로 확인한 문제).
      // 입력칸은 막지 않는다: 사람이 치는 띄어쓰기일 수 있고, 태그면 아래 Enter 처리에서 찍힌 글자를 지운다
      const tg = e.target;
      if (!(tg instanceof HTMLInputElement || tg instanceof HTMLTextAreaElement || tg?.isContentEditable)) e.preventDefault();
    }
    else if (e.key !== 'Shift') { buf = ''; raw = ''; }
  };
  window.addEventListener('keydown', onKey, true);
  // 리더기 없이 시험할 때: 개발자 도구에서 tookNfc('TEST0001') (리더기와 같은 길을 지난다)
  window.tookNfc = (code) => onTag(String(code));
  return () => window.removeEventListener('keydown', onKey, true);
}
