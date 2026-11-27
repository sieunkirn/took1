// 화면 언어 (한국어 / 영어 / 중국어 간체 / 일본어, 2026-11-27 네 언어). 서비스 전체가 같은 언어 설정을 쓴다.
// - 중국어·일본어 문구는 i18n-more.js 에 있다. 거기 없는 키는 영어로, 영어에도 없으면 한국어로 보인다
// - 언어는 브라우저 탭 저장소(sessionStorage 'took.lang')에 둔다. 키오스크 자동 초기화(store.clear)가 'took.*' 를 지우므로
//   다음 손님은 항상 한국어로 시작한다
// - 화면 문구는 STRINGS 에 키로 두고 t('키') 로 꺼낸다. HTML 에서는 data-i18n="키" (글자), data-i18n-aria="키" (aria-label)
// - 제품 이름: 영어일 때 글로벌 올리브영에서 짝지은 brand_en·name_en 을 쓰고, 없으면 한국어 이름을 그대로 둔다 (지어내지 않는다)
// 아직 영어 문구가 없는 화면은 한국어로 보인다 (STRINGS.en 에 없는 키는 한국어로 대신한다)
import { zh, ja } from './i18n-more.js';

const KEY = 'took.lang';
const LANGS = ['ko', 'en', 'zh', 'ja'];
// 휴대폰 QR 로 열면 화면 언어를 주소로 넘긴다 (?lang=en)
try {
  const want = new URLSearchParams(location.search).get('lang') ?? new URLSearchParams(location.hash.replace(/^#/, '')).get('lang'); // 팔레트 QR 은 #조각
  if (LANGS.includes(want)) sessionStorage.setItem(KEY, want);
} catch { /* 저장 불가 환경 */ }

export function lang() {
  try {
    const v = sessionStorage.getItem(KEY);
    if (LANGS.includes(v)) return v;
  } catch { /* 저장 불가 환경: 한국어 */ }
  return 'ko';
}
// isEn = '한국어가 아닌 화면' (2026-11-27 중국어·일본어 추가): 제품·브랜드·호수·매장 이름과 가격 표기는 외국어 화면이면 영어 자료를 쓴다
export const isEn = () => lang() !== 'ko';

/** 언어를 바꾸고 지금 화면을 새 언어로 다시 연다 (홈은 인트로 없이. 인트로 대기 화면에서 바꿀 땐 skipIntro: false) */
function setLang(next, { skipIntro = true } = {}) {
  try {
    sessionStorage.setItem(KEY, next);
    if (skipIntro && /(^|\/)(index\.html)?$/.test(location.pathname)) sessionStorage.setItem('took.homeSkipIntro', 'true');
  } catch { /* 저장 불가 환경 */ }
  // 새로고침(reload)이 아니라 같은 주소로 다시 들어간다: 맨 위 창에서 새로고침하면 device-frame.js 가 저장한 상태(took.*, 언어 포함)를 비운다
  location.replace(location.href);
}

const STRINGS = {
  ko: {
    'nav.reset': 'took(초기화)', 'nav.palette': '팔레트',
    'nav.fullscreenExit': '전체화면 종료', 'nav.fullscreenExitTitle': '전체화면을 종료합니다',
    'nav.fullscreenEnter': '전체화면 시작', 'nav.fullscreenEnterTitle': '브라우저 주소창을 숨깁니다',
    'idle.title': 'See You Soon', 'idle.sub': '잠시 후 화면이 자동으로 꺼져요', 'idle.unit': '초 후 화면 꺼짐',
    'idle.ask': '아직 이용 중이신가요?', 'idle.help': '계속 이용하려면 아래 버튼을 눌러주세요.\n이용이 없으면 대기 화면으로 전환돼요.', 'idle.keep': '계속 이용하기', 'idle.back': '돌아가기',
    'idle.desc': '{n}초 뒤 처음 화면으로 돌아가요. 지금까지 고른 색은 지워져요. 화면을 누르면 계속 이용할 수 있어요.',
    'card.brand': '브랜드', 'card.name': '제품명', 'card.price': '가격',
    'card.noImage': '이미지 준비 중', 
    'card.shade': '호수', 'card.shadeCount': '{n}가지 · 호수 정보 준비 중',
    'card.optPick': '호수를 선택해 주세요', 'card.optCount': '{n}가지', 'card.optList': '호수 {n}가지',
    'finish.glossy': '글로시', 'finish.matte': '매트', 'finish.satin': '새틴', 'finish.velvet': '벨벳', 'finish.sheer': '시어', 'finish.shimmer': '쉬머', 'finish.none': '정보 없음',
    'texture.matte': '매트', 'texture.satin': '새틴', 'texture.glossy': '글로시', 'texture.sheer': '시어', 'texture.shimmer': '쉬머',
    // 색상 기반 제품 추천 (recommend.html)
    // 제품 상세
    'detail.loading': '불러오는 중...', 
    'detail.none': '정보 없음', 
    'type.립틴트': '립틴트',
    // 팔레트
    'pal.camArea': '가상 립 메이크업 화면', 'pal.camRetry': '카메라 다시 연결',
    'pal.nfcApplied': '{name} 색을 발랐어요', 
    'pal.nfcRead': 'NFC 로 읽은 제품',
    'pal.result': '추천 제품', 
    // 립 카메라·톤 측정 (팔레트 화면이 쓴다)
    'lip.productApplied': '추천 제품 컬러를 입술에 발랐어요', 'lip.camUnavailable': '카메라를 사용할 수 없습니다',
    'lip.noTracker': '이 브라우저에서는 얼굴 인식을 사용할 수 없어 컬러를 적용하지 못했습니다.', 'lip.centerFace': '얼굴이 화면 가운데에 오도록 맞춰 주세요.',
    'lip.camDenied': '카메라 권한이 거부되었습니다. 주소창의 카메라 권한을 허용한 뒤 "카메라 다시 연결"을 눌러 주세요.',
    'lip.camDeniedFilm': '카메라 권한이 허용되지 않았어요. 카메라 허용 창은 Android 화면이라 터치 필름 보정이 걸리지 않아, 필름으로 누르면 엉뚱한 곳(거부·바깥)이 눌려요. 블루투스 마우스로 허용하거나, Chrome 주소창 왼쪽 아이콘 > 권한 > 카메라를 "허용"으로 바꾼 뒤 "카메라 다시 연결"을 눌러 주세요.',
    'lip.camPromptFilm': '카메라 허용 창이 떠요. 이 창은 터치 필름 보정이 안 되니 블루투스 마우스로 "사이트 방문 중 허용"을 눌러 주세요. 한 번 허용하면 다음부터는 묻지 않아요.',
    'lip.camNotFound': '사용할 수 있는 카메라를 찾지 못했습니다. 카메라를 연결한 뒤 다시 시도해 주세요.',
    'lip.camBusy': '카메라가 다른 프로그램에서 사용 중입니다. 다른 프로그램을 닫고 다시 시도해 주세요.', 'lip.camFailed': '카메라를 시작하지 못했습니다: ',
    'lip.camPreparing': '카메라를 준비하고 있습니다\n권한 요청이 뜨면 허용해 주세요',
    'lip.camInsecure': '이 브라우저 또는 접속 주소에서는 카메라를 사용할 수 없습니다. (HTTPS 또는 localhost 접속 필요)',
    'lip.camNoAnswer': '카메라 요청에 응답이 없습니다. ① 앱 안 브라우저(카카오톡·네이버 등)가 아니라 Chrome 으로 열었는지 ② 주소창 왼쪽 아이콘에서 카메라가 허용인지 ③ 휴대기기 설정 > 애플리케이션 > Chrome > 권한에서 카메라가 허용인지 확인한 뒤 "카메라 다시 연결"을 눌러 주세요.',
    'lip.camRequesting': '카메라 권한을 요청하고 있습니다...','lip.camWaiting': '웹캠 연결이 끊어졌어요. 웹캠을 다시 꽂으면 자동으로 연결돼요.',
    'lip.faceLoading': '얼굴 인식 준비 중...', 
    'lip.recFail': '추천 제품을 불러오지 못했습니다.', 
    'lip.tryOn': '입술에 발라보기', 'lip.wearingNow': '지금 바르고 있어요', 'card.seeShades': '호수 보기', 'card.moreShades': '호수 보기', 'fc.shadesBack': '추천 제품으로 돌아가기', 'card.stockHere': '매장 재고', 'card.stockNear': '가까운 매장', 'st.title': '매장 재고', 'st.rowStock': '매장 재고', 'st.count': '{n}개', 'st.canBuy': '지금 살 수 있어요', 'st.nearby': '근처 매장', 'st.hereOut': '{out}이에요', 'st.out': '품절', 'st.nearest': '가장 가까운 구매 가능 매장', 'st.stockWord': '재고', 'st.walk': '도보 {n}분', 'st.none': '근처 매장도 모두 품절이에요', 
  },
  en: {
    'nav.reset': 'took (reset)', 'nav.palette': 'Palette',
    'nav.fullscreenExit': 'Exit full screen', 'nav.fullscreenExitTitle': 'Exit full-screen mode',
    'nav.fullscreenEnter': 'Enter full screen', 'nav.fullscreenEnterTitle': 'Hide the browser address bar',
    'idle.title': 'See You Soon', 'idle.sub': 'The screen will turn off shortly', 'idle.unit': 'seconds until sleep',
    'idle.ask': 'Still using TOOK?', 'idle.help': 'Tap the button below to keep using.\nIf not, the screen returns to standby.', 'idle.keep': 'Keep using', 'idle.back': 'Back',
    'idle.desc': 'Going back to the start in {n} seconds. Your chosen colors will be cleared. Tap the screen to keep using.',
    'card.brand': 'Brand', 'card.name': 'Product', 'card.price': 'Price',
    'card.noImage': 'Image coming soon', 
    'card.shade': 'Shade', 'card.shadeCount': '{n} shades · details coming soon',
    'card.optPick': 'Choose a shade', 'card.optCount': '{n} shades', 'card.optList': '{n} shades',
    'finish.glossy': 'Glossy', 'finish.matte': 'Matte', 'finish.satin': 'Satin', 'finish.velvet': 'Velvet', 'finish.sheer': 'Sheer', 'finish.shimmer': 'Shimmer', 'finish.none': 'N/A',
    'texture.matte': 'Matte', 'texture.satin': 'Satin', 'texture.glossy': 'Glossy', 'texture.sheer': 'Sheer', 'texture.shimmer': 'Shimmer',
    // Product detail
    // Color-based recommendations (recommend.html)
    'detail.loading': 'Loading...', 
    'detail.none': 'N/A', 
    'type.립틴트': 'Lip tint',
    // Palette
    'pal.camArea': 'Virtual lip makeup', 'pal.camRetry': 'Reconnect camera',
    'pal.nfcApplied': 'Trying on {name}', 
    'pal.nfcRead': 'Product from NFC',
    'pal.result': 'Recommended products', 
    // Lip camera & tone
    'lip.productApplied': 'Applied the recommended product color', 'lip.camUnavailable': 'Camera unavailable',
    'lip.noTracker': "Face tracking isn't available in this browser, so the color couldn't be applied.", 'lip.centerFace': 'Center your face on the screen.',
    'lip.camDenied': 'Camera access was denied. Allow the camera in the address bar, then tap "Reconnect camera".',
    'lip.camDeniedFilm': 'Camera access was not allowed. The permission popup is an Android screen, so the touch film calibration does not apply there and a film tap lands in the wrong place. Allow it with a Bluetooth mouse, or set Camera to "Allow" from the icon left of the Chrome address bar, then tap "Reconnect camera".',
    'lip.camPromptFilm': 'A camera permission popup will appear. The touch film calibration does not work on it, so tap "Allow while visiting the site" with a Bluetooth mouse. Once allowed, it will not ask again.',
    'lip.camNotFound': 'No camera found. Connect a camera and try again.',
    'lip.camBusy': 'Another app is using the camera. Close it and try again.', 'lip.camFailed': 'Could not start the camera: ',
    'lip.camPreparing': 'Getting the camera ready\nAllow access when asked',
    'lip.camInsecure': "The camera can't be used on this browser or address. (HTTPS or localhost required)",
    'lip.camNoAnswer': 'The camera request got no answer. Check that (1) the page is open in Chrome, not an in-app browser, (2) the camera is allowed in the address bar, (3) Chrome has camera permission in the device settings, then tap "Reconnect camera".',
    'lip.camRequesting': 'Requesting camera access...','lip.camWaiting': 'The webcam was disconnected. It reconnects automatically when you plug it back in.',
    'lip.faceLoading': 'Preparing face tracking...', 
    'lip.recFail': "Couldn't load recommendations.", 
    'lip.tryOn': 'Try on lips', 'lip.wearingNow': 'On your lips now', 'card.seeShades': 'See shades', 'card.moreShades': 'See shades', 'fc.shadesBack': 'Back to suggestions', 'card.stockHere': 'In store', 'card.stockNear': 'Nearby stores', 'st.title': 'Store stock', 'st.rowStock': 'In store', 'st.count': '{n}', 'st.canBuy': 'Available now', 'st.nearby': 'Nearby stores', 'st.hereOut': '{out}', 'st.out': 'Sold out', 'st.nearest': 'Nearest store with stock', 'st.stockWord': 'In stock', 'st.walk': '{n} min walk', 'st.none': 'Sold out at all nearby stores', 
  },
};

/** 화면 문구. {n} 같은 자리는 vars 로 채운다 */
export function t(key, vars = {}) {
  const l = lang();
  const s = STRINGS[l][key] ?? (l !== 'ko' ? STRINGS.en[key] : undefined) ?? STRINGS.ko[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** data-i18n 속성이 있는 요소의 글자·aria-label 을 지금 언어로 바꾼다 */
export function applyI18n(root = document) {
  document.documentElement.lang = htmlLang();
  for (const node of root.querySelectorAll('[data-i18n]')) setText(node, t(node.dataset.i18n));
  for (const node of root.querySelectorAll('[data-i18n-aria]')) node.setAttribute('aria-label', t(node.dataset.i18nAria));
  for (const node of root.querySelectorAll('[data-i18n-title]')) node.setAttribute('title', t(node.dataset.i18nTitle));
  for (const node of root.querySelectorAll('[data-i18n-placeholder]')) node.setAttribute('placeholder', t(node.dataset.i18nPlaceholder));
}

/** 글자 넣기: 문구 속 줄바꿈(\n)은 <br> 로 */
export function setText(node, s) {
  const parts = String(s).split('\n');
  node.replaceChildren(...parts.flatMap((p, i) => (i ? [document.createElement('br'), p] : [p])));
}

// ---------- 언어 선택 메뉴 (🌐 Language ▾ → 현재 언어 + 다른 언어 목록) ----------
// 언어 이름: 자기 언어로 쓴 이름(native)과, 지금 화면 언어로 쓴 이름. 언어를 늘릴 땐 LANGS·STRINGS·여기에 함께 추가한다
const LANG_NAMES = {
  ko: { native: '한국어', ko: '한국어', en: 'Korean' },
  en: { native: 'English', ko: '영어', en: 'English' },
  zh: { native: '中文', ko: '중국어', en: 'Chinese' },
  ja: { native: '日本語', ko: '일본어', en: 'Japanese' },
};
STRINGS.zh = zh;
STRINGS.ja = ja;
/** <html lang> 에 넣을 값 (중국어는 간체) */
export const htmlLang = () => ({ zh: 'zh-CN' }[lang()] || lang());


STRINGS.ko['lang.menu'] = '언어 선택';
STRINGS.en['lang.menu'] = 'Choose language';
// 기기 선택 해제 (common.js deviceResetButton)
Object.assign(STRINGS.ko, {
  'nav.deviceReset': '기기 선택 해제', 'nav.deviceResetTitle': '태블릿 고정을 풀고 처음 상태로 돌아가요',
  'nav.deviceResetConfirm': '이 기기의 태블릿 고정을 풀고 처음 상태로 돌아갈까요?',
});
Object.assign(STRINGS.en, {
  'nav.deviceReset': 'Reset device', 'nav.deviceResetTitle': 'Unpin tablet mode and go back to the start',
  'nav.deviceResetConfirm': 'Unpin the tablet mode on this device and go back to the start?',
});
STRINGS.ko['theme.dark'] = '다크 모드'; STRINGS.ko['theme.light'] = '라이트 모드';
STRINGS.en['theme.dark'] = 'Dark mode'; STRINGS.en['theme.light'] = 'Light mode';

// 홈 시작 버튼 (2026-11-15)
Object.assign(STRINGS.ko, {
  'home.choose': '어떻게 시작할까요?',
  'home.toPalette': '카메라로 발라 보기', 
   'home.toTag': '제품 태그하기',
});
Object.assign(STRINGS.en, {
  'home.choose': 'How would you like to start?',
  'home.toPalette': 'Try on with the camera', 
   'home.toTag': 'Tag a product',
});
// TOOK_prototype 디자인 화면 (2026-11-16): 홈 알약 버튼 · Find Your Color(팔레트)
Object.assign(STRINGS.ko, {
 'home.tapToStart': '화면을 눌러 시작하세요', 'home.tap': 'Tap The Screen',
  'fc.pageTitle': 'took(툭) - Find Your Color', 'fc.title': 'Find Your Color', 'fc.sub': '나만의 컬러를 찾아보세요',
  'fc.sheet': '추천 제품 보기', 'fc.sheetClose': '추천 제품 닫기', 'fc.dial': '컬러 다이얼 (돌려서 색 고르기, 손잡이 아래 칸이 고른 색)',
  'fc.texture': '텍스처: {name} (누르면 바뀌어요)', 'fc.textures': '질감 (옆으로 밀어 바꾸기)',
  'fc.searching': '비슷한 제품을 찾고 있어요', 'fc.none': '비슷한 제품이 없어요', 
});
Object.assign(STRINGS.en, {
 'home.tapToStart': 'Tap the screen to start', 'home.tap': 'Tap The Screen',
  'fc.pageTitle': 'took - Find Your Color', 'fc.title': 'Find Your Color', 'fc.sub': 'Find your own color',
  'fc.sheet': 'Show matching products', 'fc.sheetClose': 'Close matching products', 'fc.dial': 'Color dial (turn it; the segment under the handle is your color)',
  'fc.texture': 'Texture: {name} (tap to change)', 'fc.textures': 'Textures (swipe to change)',
  'fc.searching': 'Looking for similar products', 'fc.none': 'No similar products', 
});
// 추천 시트 안내 (2026-11-21)
Object.assign(STRINGS.ko, {
  'fc.guide': '지금 바른 색과 비슷한 추천 립 {n}개예요',
  // 질감까지 맞춘 추천 (2026-11-24)
  'fc.guideTex': '지금 바른 색과 비슷한 {tex} 립 {n}개예요',
  'fc.guideMix': '{tex} 립 {n}개 · 비슷한 색 다른 질감 {m}개',
  'fc.noTex': '{tex} 제품은 아직 없어서 비슷한 색 립 {m}개를 보여 줘요',
});
Object.assign(STRINGS.en, {
  'fc.guide': '{n} lips similar to the color you are wearing',
  'fc.guideTex': '{n} {tex} lips similar to the color you are wearing',
  'fc.guideMix': '{n} {tex} lips · {m} similar colors in other textures',
  'fc.noTex': 'No {tex} products yet — showing {m} lips in a similar color',
});
// NFC 태그 시트 (2026-11-19, js/nfc-window.js): 태그하면 바로 바르고 아래에 호수 줄
Object.assign(STRINGS.ko, {
  'nw.close': '닫기', 'nw.recent': '방금 태그한 립', 'nw.similar': '이 색과 비슷한 립 보기',
  'nw.pickShade': '들고 계신 호수를 골라 주세요', 'nw.browseShade': '호수를 누르면 입술에 발라 드려요', 'nw.wearing': '지금 바른 호수', 'nw.shadeCount': '{n}가지',
  'nw.noShades': '호수 정보 준비 중이에요 · 대표 색을 발랐어요',
  'nw.unknown': '등록되지 않은 태그예요', 'nw.unknownSub': '태그를 다시 한 번 리더기 가운데에 대 주세요',
  // NFC 안내·인식 모달 (2026-11-22)
  'nm.title': '제품을 리더기에 대 주세요', 'nm.sub': '들고 계신 립 제품의 색을 입술에 바로 발라 드려요',
  'nm.step1': '제품을 손에 들어요', 'nm.step2': '리더기에 톡 대요', 'nm.step3': '거울 속 입술에 바로 발라져요',
  'nm.dial': '테스트',
  'nm.hit': '인식했어요', 'nm.applied': '입술에 바로 발라드릴게요', 'nm.toCard': '입술에 발라보기',
  // 카드 담기 (2026-11-23): 휴대폰 담기 화면(basket.html) · 거울에서 카드를 댔을 때
  'bk.title': '카드에 담기', 'bk.sub': '내 카드를 먼저 대고, 마음에 드는 립 제품 태그를 휴대폰 뒷면에 대 주세요.\n거울 리더기에 카드를 대면 담은 립이 입술에 발라져요.',
  'bk.start': 'NFC 켜고 시작', 'bk.listening': '휴대폰 뒷면에 태그를 대 주세요',
  'bk.noNfc': '이 휴대폰·브라우저는 NFC 읽기를 지원하지 않아요. 안드로이드 휴대폰의 Chrome 에서 열어 주세요.',
  'bk.nfcDenied': 'NFC 를 켜지 못했어요. 휴대폰 설정에서 NFC 를 켜고 다시 눌러 주세요.',
  'bk.step1': '내 카드', 'bk.cardWait': '카드를 휴대폰 뒷면에 대 주세요', 'bk.card': '카드 {code}', 'bk.changeCard': '카드 바꾸기',
  'bk.step2': '담은 립', 'bk.empty': '제품 태그를 대면 여기에 담겨요', 'bk.added': '{name} 담았어요', 'bk.cardSet': '카드를 연결했어요 · 이제 제품 태그를 대 주세요',
  'bk.cardSwitch': '다른 카드로 바꿨어요', 'bk.sameCard': '지금 연결된 카드예요', 'bk.unknownProduct': '등록되지 않은 제품 태그예요',
  'bk.remove': '빼기', 'bk.clear': '모두 비우기', 'bk.cleared': '카드를 비웠어요',
  'bk.search': '이름으로 찾아 담기', 'bk.searchPh': '브랜드·제품 이름', 'bk.noResult': '찾는 제품이 없어요',
  'bk.manualCard': '카드 번호 직접 넣기 (테스트용)', 'bk.manualOk': '연결',
  'bk.server': '서버에 연결하는 중… 잠들어 있으면 1분쯤 걸려요', 'bk.serverErr': '서버에 연결하지 못했어요 ({msg})',
  'bk.mirrorHint': '이제 거울 리더기에 카드를 대 보세요',
  'bk.cardHit': '카드에 담은 립 {n}개', 'bk.row': '카드에 담은 립', 'bk.newItem': '방금 담은 립이에요',
  'bk.tap': '휴대폰으로 거울에 찍기', 'bk.now': '거울에 바로 띄우기', 'bk.tapWait': '{s}초 안에 휴대폰 뒷면을 거울 리더기에 대 주세요',
  'bk.tapDone': '거울이 받았어요', 'bk.tapTimeout': '시간이 지났어요 · 다시 눌러 주세요', 'bk.nowSent': '거울에 띄웠어요', 'bk.restart': 'NFC 다시 켜기',
});
Object.assign(STRINGS.en, {
  'nw.close': 'Close', 'nw.recent': 'Just tagged', 'nw.similar': 'Similar lips',
  'nw.pickShade': 'Pick the shade you are holding', 'nw.browseShade': 'Tap a shade to try it on', 'nw.wearing': 'On your lips', 'nw.shadeCount': '{n} shades',
  'nw.noShades': 'Shade info coming soon · showing the main color',
  'nw.unknown': "This tag isn't registered", 'nw.unknownSub': 'Please tap it again on the center of the reader',
  'nm.title': 'Hold the product to the reader', 'nm.sub': 'We will put its color on your lips right away',
  'nm.step1': 'Pick up the product', 'nm.step2': 'Tap it on the reader', 'nm.step3': 'See it on your lips in the mirror',
  'nm.dial': 'Test',
  'nm.hit': 'Got it', 'nm.applied': 'Putting it on your lips now', 'nm.toCard': 'Try it on',
  'bk.title': 'Save to card', 'bk.sub': 'Tap your card first, then tap the lip product tags you like on the back of the phone.\nTap the card on the mirror reader to try them on.',
  'bk.start': 'Turn on NFC', 'bk.listening': 'Hold a tag to the back of the phone',
  'bk.noNfc': "This phone or browser can't read NFC. Please open it in Chrome on an Android phone.",
  'bk.nfcDenied': "Couldn't turn on NFC. Turn NFC on in the phone settings and try again.",
  'bk.step1': 'My card', 'bk.cardWait': 'Hold your card to the back of the phone', 'bk.card': 'Card {code}', 'bk.changeCard': 'Change card',
  'bk.step2': 'Saved lips', 'bk.empty': 'Tap product tags to save them here', 'bk.added': 'Saved {name}', 'bk.cardSet': 'Card linked · now tap product tags',
  'bk.cardSwitch': 'Switched to another card', 'bk.sameCard': 'This card is already linked', 'bk.unknownProduct': "This product tag isn't registered",
  'bk.remove': 'Remove', 'bk.clear': 'Clear all', 'bk.cleared': 'Card cleared',
  'bk.search': 'Find by name', 'bk.searchPh': 'Brand or product name', 'bk.noResult': 'No matching products',
  'bk.manualCard': 'Enter a card number (test)', 'bk.manualOk': 'Link',
  'bk.server': 'Connecting to the server… up to a minute if it was asleep', 'bk.serverErr': "Couldn't reach the server ({msg})",
  'bk.mirrorHint': 'Now tap the card on the mirror reader',
  'bk.cardHit': '{n} lips on your card', 'bk.row': 'Lips on your card', 'bk.newItem': 'Just saved',
  'bk.tap': 'Tap the phone on the mirror', 'bk.now': 'Show on the mirror now', 'bk.tapWait': 'Within {s}s, hold the back of the phone to the mirror reader',
  'bk.tapDone': 'The mirror got it', 'bk.tapTimeout': 'Time is up · please try again', 'bk.nowSent': 'Shown on the mirror', 'bk.restart': 'Turn NFC on again',
});

/**
 * 언어 선택 메뉴. 버튼을 누르면 아래에 목록이 열리고, 다른 언어를 고르면 화면이 그 언어로 다시 열린다.
 * @param {{ skipIntro?: boolean }} [opts] 홈 대기 화면에서는 skipIntro: false (같은 대기 화면을 새 언어로)
 */
/**
 * 네 언어를 나란히 보여 주는 선택 줄 (2026-11-27 사용자 선택 'A 오른쪽 위 네 칸'): 한국어 | English | 中文 | 日本語.
 * 지금 언어 칸만 흰 칸. 다른 칸을 누르면 그 언어로 화면이 다시 열린다 (홈은 대기·로고 화면을 건너뛰고 Tap The Screen 화면으로, took.homeFx)
 */
// onChange (2026-11-27 사용자 요청 "깜빡임 없이 자연스럽게"): 주면 화면을 다시 열지 않고 언어만 저장한 뒤 onChange(새 언어)를 부른다.
//   그 화면이 글자를 그 자리에서 바꾼다 (시작 화면 home.js). 안 주면 예전처럼 같은 화면을 새 언어로 다시 연다
export function langSwitch(cls = '', { onChange } = {}) {
  let cur = lang();
  const nav = document.createElement('nav');
  nav.className = cls;
  nav.setAttribute('aria-label', t('lang.menu'));
  // 흰 칸(손잡이)은 따로 둔 조각 하나: 다른 언어를 누르면 그 칸으로 미끄러져 간 뒤 화면이 바뀐다 (2026-11-27 사용자 요청:
  // 예전 시작 알약 버튼의 손잡이가 미끄러지던 움직임처럼. 같은 곡선·같은 시간 = took-ui.css .hs-mb-knob)
  const thumb = document.createElement('i');
  thumb.className = 'lang-thumb';
  thumb.setAttribute('aria-hidden', 'true');
  nav.append(thumb);
  const place = (b, animate) => {
    if (!b.offsetWidth) return false;
    thumb.style.transition = animate ? '' : 'none';
    thumb.style.width = b.offsetWidth + 'px';
    thumb.style.transform = 'translateX(' + b.offsetLeft + 'px)';
    return true;
  };
  let busy = false;
  for (const code of LANGS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.lang = { zh: 'zh-CN' }[code] || code;
    b.textContent = LANG_NAMES[code].native;
    b.setAttribute('aria-pressed', String(code === cur));
    b.addEventListener('click', () => {
      if (code === cur || busy) return;
      busy = true;
      for (const o of nav.querySelectorAll('button')) o.setAttribute('aria-pressed', String(o === b));
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      place(b, !still);
      if (onChange) { // 다시 열지 않는다: 손잡이가 미끄러지는 동안 글자가 그 자리에서 바뀐다
        try { sessionStorage.setItem(KEY, code); } catch { /* 저장 불가 환경: 이 화면에서만 */ }
        cur = code;
        busy = false;
        nav.setAttribute('aria-label', t('lang.menu'));
        onChange(code);
        return;
      }
      try { if (/(^|\/)(index\.html)?$/.test(location.pathname)) sessionStorage.setItem('took.homeFx', '1'); } catch { /* 저장 불가 환경 */ }
      setTimeout(() => setLang(code, { skipIntro: false }), still ? 0 : 380); // 손잡이가 다 간 뒤(.32초) 화면을 바꾼다
    });
    nav.append(b);
  }
  // 처음 자리: 화면에 붙고 글꼴이 준비된 뒤 지금 언어 칸에 맞춘다 (움직임 없이)
  const now = () => nav.querySelector('button[aria-pressed="true"]');
  const settle = () => { if (!busy && !thumb.style.width && !place(now(), false)) requestAnimationFrame(settle); };
  requestAnimationFrame(settle);
  document.fonts?.ready.then(() => { if (!busy && cur === lang()) place(now(), false); });
  return nav;
}

/**
 * 한국어 ↔ 영어 한 번에 바꾸는 작은 버튼 (TOOK_prototype 디자인 화면용, 2026-11-16).
 * 홈에서 바꾸면 다시 열 때 대기·로고 화면을 건너뛰고 시작 버튼(3번) 화면으로 (took.homeFx)
 */
export function langToggle(cls = '') {
  const cur = lang();
  const next = cur === 'ko' ? 'en' : 'ko';
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.lang = next;
  b.textContent = next === 'en' ? 'EN' : '한국어';
  b.setAttribute('aria-label', t('lang.menu') + ' · ' + LANG_NAMES[next].native);
  b.addEventListener('click', () => {
    try { if (/(^|\/)(index\.html)?$/.test(location.pathname)) sessionStorage.setItem('took.homeFx', '1'); } catch { /* 저장 불가 환경 */ }
    setLang(next, { skipIntro: false });
  });
  return b;
}

// ---------- 다크 모드 (배경 검정) ----------
// 언어 버튼 옆 버튼으로 켜고 끈다. <html data-theme="dark"> 이면 wireframe.css 가 색 변수를 검정 바탕용으로 바꾼다.
// 기기 설정처럼 남도록 localStorage 'took.theme' 에 둔다 (키오스크 자동 초기화는 sessionStorage 만 지우므로 유지된다)
const THEME_KEY = 'took.theme';
export function theme() {
  try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}
function applyTheme(v = theme()) {
  if (v === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
}
applyTheme(); // 이 모듈을 읽는 모든 화면에서 바로 적용

// 아이콘 SVG 틀 (다크 모드 버튼 등)
const svg =(inner, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const MOON = '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>';
const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';

/** 다크 모드 켜기/끄기 버튼 (언어 메뉴 옆). 지금 상태의 반대쪽을 보여 준다: 밝은 화면에선 '다크 모드' */
export function themeToggle() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-toggle';
  const draw = () => {
    const dark = theme() === 'dark';
    btn.innerHTML = `${svg(dark ? SUN : MOON, 18)}<span>${t(dark ? 'theme.light' : 'theme.dark')}</span>`;
    btn.setAttribute('aria-pressed', String(dark));
  };
  btn.addEventListener('click', () => {
    const next = theme() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch { /* 저장 불가 환경: 이 화면에서만 */ }
    applyTheme(next);
    draw();
  });
  draw();
  return btn;
}

// ---------- 제품 표시 ----------
/** 브랜드: 영어면 글로벌 표기(brand_en), 없으면 한국어 */
export const brandOf = (p) => (isEn() && p.brand_en) || p.brand;
/** 제품명: 영어면 글로벌 상품명(name_en), 짝이 없으면 한국어 이름 그대로 */
export const nameOf = (p) => (isEn() && p.name_en) || p.name;
export const displayName = (p) => [brandOf(p), nameOf(p), isEn() && p.name_en ? null : p.shade_name].filter(Boolean).join(' ');
/** 가격: 원화 그대로 (영어면 ₩13,000) */
export const priceText = (n) => (isEn() ? '₩' + Number(n).toLocaleString('en-US') : Number(n).toLocaleString('ko-KR') + '원');
export const finishText = (f) => t(f ? 'finish.' + f : 'finish.none');
