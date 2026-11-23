// 화면 언어 (한국어 / 영어). 서비스 전체가 같은 언어 설정을 쓴다.
// - 언어는 브라우저 탭 저장소(sessionStorage 'took.lang')에 둔다. 키오스크 자동 초기화(store.clear)가 'took.*' 를 지우므로
//   다음 손님은 항상 한국어로 시작한다
// - 화면 문구는 STRINGS 에 키로 두고 t('키') 로 꺼낸다. HTML 에서는 data-i18n="키" (글자), data-i18n-aria="키" (aria-label)
// - 제품 이름: 영어일 때 글로벌 올리브영에서 짝지은 brand_en·name_en 을 쓰고, 없으면 한국어 이름을 그대로 둔다 (지어내지 않는다)
// 아직 영어 문구가 없는 화면은 한국어로 보인다 (STRINGS.en 에 없는 키는 한국어로 대신한다)
const KEY = 'took.lang';
const LANGS = ['ko', 'en'];
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
export const isEn = () => lang() === 'en';

/** 언어를 바꾸고 지금 화면을 새 언어로 다시 연다 (홈은 인트로 없이. 인트로 대기 화면에서 바꿀 땐 skipIntro: false) */
function setLang(next, { skipIntro = true } = {}) {
  try {
    sessionStorage.setItem(KEY, next);
    if (skipIntro && /(^|\/)(index\.html)?$/.test(location.pathname)) sessionStorage.setItem('took.homeSkipIntro', 'true');
  } catch { /* 저장 불가 환경 */ }
  location.reload();
}

const STRINGS = {
  ko: {
    'nav.reset': 'took(초기화)', 'nav.palette': '팔레트',
    'nav.fullscreenExit': '전체화면 종료', 'nav.fullscreenExitTitle': '전체화면을 종료합니다',
    'nav.fullscreenEnter': '전체화면 시작', 'nav.fullscreenEnterTitle': '브라우저 주소창을 숨깁니다',
    'idle.title': 'See You Soon', 'idle.sub': '잠시 후 화면이 자동으로 꺼져요', 'idle.label': 'AUTO SLEEP', 'idle.unit': '초 후 화면 꺼짐',
    'idle.ask': '아직 이용 중이신가요?', 'idle.help': '계속 이용하려면 아래 버튼을 눌러주세요.\n이용이 없으면 대기 화면으로 전환돼요.', 'idle.keep': '계속 이용하기', 'idle.back': '돌아가기',
    'idle.desc': '{n}초 뒤 처음 화면으로 돌아가요. 지금까지 고른 색은 지워져요. 화면을 누르면 계속 이용할 수 있어요.',
    'home.touch': '화면을 눌러 시작하기', 'home.standby': '제품을 태그해보세요', 'home.standbyTouch': '또는 화면을 눌러 시작해요',
    'card.brand': '브랜드', 'card.name': '제품명', 'card.finish': '제형', 'card.price': '가격',
    'card.noImage': '이미지 준비 중', 'card.store': '올리브영에서 보기', 'card.detail': '상세 보기',
    'card.shade': '호수', 'card.shadeCount': '{n}가지 · 호수 정보 준비 중',
    'card.optPick': '호수를 선택해 주세요', 'card.optCount': '{n}가지', 'card.optList': '호수 {n}가지',
    'detail.colorSource': '색상값 출처', 'detail.colorChip': '올리브영 색상 칩 사진에서 뽑은 색 (실제 발색과 다를 수 있어요)',
    'finish.glossy': '글로시', 'finish.matte': '매트', 'finish.satin': '새틴', 'finish.velvet': '벨벳', 'finish.none': '정보 없음',
    'family.red': '레드', 'family.pink': '핑크', 'family.coral': '코랄', 'family.orange': '오렌지', 'family.nude': '누드',
    'family.brown': '브라운', 'family.rose': '로즈', 'family.berry': '베리', 'family.plum': '플럼', 'family.burgundy': '버건디',
    'texture.matte': '매트', 'texture.satin': '새틴', 'texture.glossy': '글로시', 'texture.sheer': '시어', 'texture.shimmer': '쉬머',
    'season.spring': '봄 웜', 'season.summer': '여름 쿨', 'season.autumn': '가을 웜', 'season.winter': '겨울 쿨',
    'season.spring.desc': '밝고 따뜻한 톤', 'season.summer.desc': '밝고 부드러운 쿨 톤', 'season.autumn.desc': '깊고 따뜻한 톤', 'season.winter.desc': '깊고 선명한 쿨 톤',
    // 색상 기반 제품 추천 (recommend.html)
    'rec.pageTitle': 'took(툭) - 제품 추천', 'rec.title': '색상 기반 제품 추천', 'rec.refArea': '기준 색상 정보',
    'rec.method': '추천 방식: 기준 색상과 각 제품 색상의 CIEDE2000 색차(ΔE)를 계산해 작은 순서로 정렬합니다. 유사도 = 100 − 2 × ΔE (최소 0%).',
    'rec.finishFilter': '제형 필터', 'rec.all': '전체', 'rec.count': '개수', 'rec.listArea': '추천 결과 목록',
    'rec.recolor': '다시 조색하기',
    'rec.src.lip': '립 컬러 매핑에서 선택한 색상', 'rec.src.barcode': '바코드 검색 제품의 색상', 'rec.src.product': '제품 상세의 색상',
    'rec.noHex': '전달된 색상값이 없습니다. 립 컬러 매핑에서 색상을 선택하세요.', 'rec.result': '{n}개 제품 (유사도 높은 순)',
    'rec.ref': '기준 색상: {hex} ({src})', 'rec.refNone': '기준 색상: 없음',
    // 제품 상세
    'detail.pageTitle': 'took(툭) - 제품 상세', 'detail.title': '제품 상세 정보', 'detail.imageArea': '제품 이미지 영역', 'detail.imagePlaceholder': '제품 이미지 플레이스홀더',
    'detail.infoArea': '제품 정보 영역', 'detail.loading': '불러오는 중...', 'detail.actions': '연결 기능', 'detail.back': '이전 화면으로',
 'detail.toSimilar': '비슷한 색상 제품 보기', 'detail.home': '홈으로 돌아가기',
    'detail.noId': '제품 ID 가 없습니다.', 'detail.notFound': '제품을 찾을 수 없습니다.',
    'detail.source': '출처', 'detail.sourceOy': '올리브영 (수집 시점의 판매가)', 'detail.sourceVirtual': '시연용 가상 데이터',
    'detail.barcode': '바코드', 'detail.type': '종류', 'detail.shade': '색상명', 'detail.hex': '색상값(HEX)', 'detail.lab': '색상값(Lab)',
    'detail.family': '색상 계열', 'detail.desc': '설명', 'detail.originalName': '올리브영 상품명', 'detail.store': '올리브영',
    'detail.storeOpen': '상세 페이지 열기 (새 창)', 'detail.none': '정보 없음', 'detail.listPrice': '정가 {price}',
    'detail.shadeOf': '{n}가지 중 대표색', 'detail.shadeRep': '대표색', 'detail.byName': ' (상품명 기준 추정)', 'detail.byColor': ' (색상값으로 추정)',
    'type.립틴트': '립틴트',
    // 팔레트
    'pal.pageTitle': 'took(툭) - 팔레트', 'pal.camArea': '가상 립 메이크업 화면', 'pal.camRetry': '카메라 다시 연결',
    'pal.match': '나에게 어울리는 컬러', 'pal.toneBtn': '내 톤으로 추천받기', 'pal.toneBusy': '재는 중… 정면을 봐 주세요', 'pal.toneResult': '내 톤 · {label}', 'pal.toneNoCam': '카메라가 켜져 있어야 톤을 잴 수 있어요. 카메라를 연결해 주세요.', 'pal.matchSwatches': '추천 컬러',
    'pal.board': '팔레트', 'pal.reset': '처음부터 다시 선택', 'pal.paints': '립 컬러 팔레트', 'pal.mixAria': '선택한 색 견본 {hex}',
    'pal.mixCurrent': '현재 색상', 'pal.mixEmpty': '색을 고르면 선택 색상이 여기에 보여요',
    'pal.gradAria': '색상 선택 (누르거나 끌어 색을 고르세요)', 'pal.finishArea': '텍스처와 제품 추천', 'pal.textures': '텍스처',
    'pal.nfcApplied': '{name} 색을 발랐어요', 'pal.nfcUnknown': '등록되지 않은 태그예요',
    'pal.nfcRead': 'NFC 로 읽은 제품',
    'pal.intensity': '농도', 'pal.find': '이 색과 비슷한 제품 추천', 'pal.result': '추천 제품', 'pal.backMix': '← 다시 선택',
    'pal.resetDone': '색을 초기화했어요', 'pal.mixed': '선택한 색 {hex}', 'pal.searching': '{hex} 와 비슷한 제품을 찾는 중...',
    'pal.found': '선택한 색 {hex} 와 비슷한 제품 {n}개 (색이 가까운 순)',
    // 립 카메라·톤 측정 (팔레트 화면이 쓴다)
    'lip.camUnavailable': '카메라를 사용할 수 없습니다',
    'lip.avatarNoTone': '아바타 그림에서는 피부 톤을 잴 수 없어요. 어울리는 컬러는 카메라로 테스트해 주세요.',
    'lip.noTracker': '이 브라우저에서는 얼굴 인식을 사용할 수 없어 컬러를 적용하지 못했습니다.', 'lip.centerFace': '얼굴이 화면 가운데에 오도록 맞춰 주세요.',
    'lip.measuring': '피부 톤을 측정하고 있어요. 정면을 보고 잠시 기다려 주세요.',
    'lip.camDenied': '카메라 권한이 거부되었습니다. 주소창의 카메라 권한을 허용한 뒤 "카메라 다시 연결"을 눌러 주세요.',
    'lip.camDeniedFilm': '카메라 권한이 허용되지 않았어요. 카메라 허용 창은 Android 화면이라 터치 필름 보정이 걸리지 않아, 필름으로 누르면 엉뚱한 곳(거부·바깥)이 눌려요. 블루투스 마우스로 허용하거나, Chrome 주소창 왼쪽 아이콘 > 권한 > 카메라를 "허용"으로 바꾼 뒤 "카메라 다시 연결"을 눌러 주세요.',
    'lip.camPromptFilm': '카메라 허용 창이 떠요. 이 창은 터치 필름 보정이 안 되니 블루투스 마우스로 "사이트 방문 중 허용"을 눌러 주세요. 한 번 허용하면 다음부터는 묻지 않아요.',
    'lip.camNotFound': '사용할 수 있는 카메라를 찾지 못했습니다. 카메라를 연결한 뒤 다시 시도해 주세요.',
    'lip.camBusy': '카메라가 다른 프로그램에서 사용 중입니다. 다른 프로그램을 닫고 다시 시도해 주세요.', 'lip.camFailed': '카메라를 시작하지 못했습니다: ',
    'lip.camPreparing': '카메라를 준비하고 있습니다\n권한 요청이 뜨면 허용해 주세요',
    'lip.camInsecure': '이 브라우저 또는 접속 주소에서는 카메라를 사용할 수 없습니다. (HTTPS 또는 localhost 접속 필요)',
    'lip.camNoAnswer': '카메라 요청에 응답이 없습니다. ① 앱 안 브라우저(카카오톡·네이버 등)가 아니라 Chrome 으로 열었는지 ② 주소창 왼쪽 아이콘에서 카메라가 허용인지 ③ 휴대기기 설정 > 애플리케이션 > Chrome > 권한에서 카메라가 허용인지 확인한 뒤 "카메라 다시 연결"을 눌러 주세요.',
    'lip.camRequesting': '카메라 권한을 요청하고 있습니다...','lip.camWaiting': '웹캠 연결이 끊어졌어요. 웹캠을 다시 꽂으면 자동으로 연결돼요.',
    'lip.faceLoading': '얼굴 인식 준비 중...', 'lip.imgFail': '그림을 불러오지 못했어요', 'lip.avatarLoading': '아바타를 불러오고 있습니다',
    'lip.avatarFail': '아바타를 불러오지 못했습니다', 'lip.sourceGroup': '테스트 방식', 'lip.useCamera': '카메라로 테스트하기',
    'lip.avatarNext': '다른 아바타로 바꾸기 ({i}/{n})', 'lip.useAvatar': '아바타로 테스트하기',
    'lip.colorAria': '컬러 {hex}', 'lip.matchFaceFail': '얼굴을 충분히 인식하지 못했습니다. 밝은 곳에서 정면을 보고 다시 시도해 주세요.',
    'lip.matchSkinFail': '피부색을 측정하지 못했습니다. 밝은 곳에서 정면을 보고 다시 시도해 주세요.',
    'lip.matchNear': " 경계에 가까워 '{label}'일 수도 있어요.", 'lip.matchResult': '추정 톤: {label} ({desc}).{near} ',
    'lip.matchPalette': '아래 추천 컬러를 누르면 바로 발라 볼 수 있어요.',
    'lip.matchApplied': '추천 컬러 3가지 중 첫 번째를 적용했어요.',
    'lip.mHue': '피부 색상각 {v}° (웜 기준 {t}° 이상)', 'lip.mLight': '피부 밝기 L {v} (밝은 톤 기준 {t})', 'lip.mNoContrast': '눈썹 대비 측정 안 됨',
    'lip.mContrast': '피부-눈썹 대비 {v} (기준 {t})', 'lip.mWb': '눈 흰자 기준 조명 보정 적용', 'lip.mCalib': '흰 종이 기준 조명 보정 적용(관리자 색 보정)', 'lip.mNoWb': '조명 보정 못 함(눈 흰자 인식 실패)',
    'lip.ref': '기준 컬러 {hex} 와 비슷한 제품 (색상 유사도 높은 순)', 'lip.recLoading': '추천 제품을 불러오는 중...',
    'lip.recFail': '추천 제품을 불러오지 못했습니다.', 'lip.recCount': "{n}개 제품 · '입술에 발라보기'를 누르면 카메라 화면에 바로 적용됩니다.",
    'lip.recNone': '비슷한 제품이 없습니다.', 'lip.tryOn': '입술에 발라보기', 'lip.applying': '입술에 적용 중: {name}{finish}',
    'lip.appliedToast': '{name} 컬러를 입술에 발랐어요', 'lip.productApplied': '추천 제품 컬러를 입술에 발랐어요',
    'lip.prevMatch': '이전에 추천받은 컬러입니다. 다시 측정하려면 버튼을 눌러 주세요.',
  },
  en: {
    'nav.reset': 'took (reset)', 'nav.palette': 'Palette',
    'nav.fullscreenExit': 'Exit full screen', 'nav.fullscreenExitTitle': 'Exit full-screen mode',
    'nav.fullscreenEnter': 'Enter full screen', 'nav.fullscreenEnterTitle': 'Hide the browser address bar',
    'idle.title': 'See You Soon', 'idle.sub': 'The screen will turn off shortly', 'idle.label': 'AUTO SLEEP', 'idle.unit': 'seconds until sleep',
    'idle.ask': 'Still using TOOK?', 'idle.help': 'Tap the button below to keep using.\nIf not, the screen returns to standby.', 'idle.keep': 'Keep using', 'idle.back': 'Back',
    'idle.desc': 'Going back to the start in {n} seconds. Your chosen colors will be cleared. Tap the screen to keep using.',
    'home.touch': 'Tap the screen to start', 'home.standby': 'Tag a product to start', 'home.standbyTouch': 'or touch the screen to start',
    'card.brand': 'Brand', 'card.name': 'Product', 'card.finish': 'Finish', 'card.price': 'Price',
    'card.noImage': 'Image coming soon', 'card.store': 'View on OLIVE YOUNG', 'card.detail': 'Details',
    'card.shade': 'Shade', 'card.shadeCount': '{n} shades · details coming soon',
    'card.optPick': 'Choose a shade', 'card.optCount': '{n} shades', 'card.optList': '{n} shades',
    'detail.colorSource': 'Color source', 'detail.colorChip': 'Taken from the OLIVE YOUNG color chip photo (may differ from the real color)',
    'finish.glossy': 'Glossy', 'finish.matte': 'Matte', 'finish.satin': 'Satin', 'finish.velvet': 'Velvet', 'finish.none': 'N/A',
    'family.red': 'Red', 'family.pink': 'Pink', 'family.coral': 'Coral', 'family.orange': 'Orange', 'family.nude': 'Nude',
    'family.brown': 'Brown', 'family.rose': 'Rose', 'family.berry': 'Berry', 'family.plum': 'Plum', 'family.burgundy': 'Burgundy',
    'texture.matte': 'Matte', 'texture.satin': 'Satin', 'texture.glossy': 'Glossy', 'texture.sheer': 'Sheer', 'texture.shimmer': 'Shimmer',
    'season.spring': 'Spring Warm', 'season.summer': 'Summer Cool', 'season.autumn': 'Autumn Warm', 'season.winter': 'Winter Cool',
    'season.spring.desc': 'bright, warm tone', 'season.summer.desc': 'light, soft cool tone', 'season.autumn.desc': 'deep, warm tone', 'season.winter.desc': 'deep, vivid cool tone',
    // Product detail
    // Color-based recommendations (recommend.html)
    'rec.pageTitle': 'took - Recommendations', 'rec.title': 'Color-based recommendations', 'rec.refArea': 'Reference color',
    'rec.method': 'How it works: we compute the CIEDE2000 color difference (ΔE) between the reference color and each product, and sort from smallest. Similarity = 100 − 2 × ΔE (min 0%).',
    'rec.finishFilter': 'Finish', 'rec.all': 'All', 'rec.count': 'Count', 'rec.listArea': 'Results',
    'rec.recolor': 'Mix again',
    'rec.src.lip': 'picked in lip mapping', 'rec.src.barcode': 'color of the scanned product', 'rec.src.product': 'color from product details',
    'rec.noHex': 'No color was passed. Pick a color in lip mapping first.', 'rec.result': '{n} products (most similar first)',
    'rec.ref': 'Reference color: {hex} ({src})', 'rec.refNone': 'Reference color: none',
    'detail.pageTitle': 'took - Product details', 'detail.title': 'Product details', 'detail.imageArea': 'Product image', 'detail.imagePlaceholder': 'Product image placeholder',
    'detail.infoArea': 'Product information', 'detail.loading': 'Loading...', 'detail.actions': 'Next steps', 'detail.back': 'Back',
 'detail.toSimilar': 'See similar colors', 'detail.home': 'Back to home',
    'detail.noId': 'No product ID.', 'detail.notFound': 'Product not found.',
    'detail.source': 'Source', 'detail.sourceOy': 'OLIVE YOUNG Korea (price at collection time)', 'detail.sourceVirtual': 'Demo data',
    'detail.barcode': 'Barcode', 'detail.type': 'Type', 'detail.shade': 'Shade', 'detail.hex': 'Color (HEX)', 'detail.lab': 'Color (Lab)',
    'detail.family': 'Color family', 'detail.desc': 'Description', 'detail.originalName': 'OLIVE YOUNG Korea name', 'detail.store': 'OLIVE YOUNG',
    'detail.storeOpen': 'Open product page (new window)', 'detail.none': 'N/A', 'detail.listPrice': 'list price {price}',
    'detail.shadeOf': 'representative of {n} shades', 'detail.shadeRep': 'representative shade', 'detail.byName': ' (estimated from product name)', 'detail.byColor': ' (estimated from color)',
    'type.립틴트': 'Lip tint',
    // Palette
    'pal.pageTitle': 'took - Palette', 'pal.camArea': 'Virtual lip makeup', 'pal.camRetry': 'Reconnect camera',
    'pal.match': 'Colors that suit me', 'pal.toneBtn': 'Match my tone', 'pal.toneBusy': 'Measuring… look straight ahead', 'pal.toneResult': 'My tone · {label}', 'pal.toneNoCam': 'The camera needs to be on to measure your tone. Please connect the camera.', 'pal.matchSwatches': 'Suggested colors',
    'pal.board': 'Palette', 'pal.reset': 'Start over', 'pal.paints': 'Lip color palette', 'pal.mixAria': 'Selected color swatch {hex}',
    'pal.mixCurrent': 'Current color', 'pal.mixEmpty': 'Choose a color to see it here',
    'pal.gradAria': 'Choose a color (tap or drag to select it)', 'pal.finishArea': 'Texture and product picks', 'pal.textures': 'Texture',
    'pal.nfcApplied': 'Trying on {name}', 'pal.nfcUnknown': 'Unregistered tag',
    'pal.nfcRead': 'Product from NFC',
    'pal.intensity': 'Intensity', 'pal.find': 'Find products in this color', 'pal.result': 'Recommended products', 'pal.backMix': '← Choose again',
    'pal.resetDone': 'Colors reset', 'pal.mixed': 'Selected color {hex}', 'pal.searching': 'Finding products similar to {hex}...',
    'pal.found': '{n} products similar to selected color {hex} (closest first)',
    // Lip camera & tone
    'lip.camUnavailable': 'Camera unavailable',
    'lip.avatarNoTone': "Skin tone can't be measured on the avatar picture. Use the camera to find colors that suit you.",
    'lip.noTracker': "Face tracking isn't available in this browser, so the color couldn't be applied.", 'lip.centerFace': 'Center your face on the screen.',
    'lip.measuring': 'Measuring your skin tone. Look straight ahead and wait a moment.',
    'lip.camDenied': 'Camera access was denied. Allow the camera in the address bar, then tap "Reconnect camera".',
    'lip.camDeniedFilm': 'Camera access was not allowed. The permission popup is an Android screen, so the touch film calibration does not apply there and a film tap lands in the wrong place. Allow it with a Bluetooth mouse, or set Camera to "Allow" from the icon left of the Chrome address bar, then tap "Reconnect camera".',
    'lip.camPromptFilm': 'A camera permission popup will appear. The touch film calibration does not work on it, so tap "Allow while visiting the site" with a Bluetooth mouse. Once allowed, it will not ask again.',
    'lip.camNotFound': 'No camera found. Connect a camera and try again.',
    'lip.camBusy': 'Another app is using the camera. Close it and try again.', 'lip.camFailed': 'Could not start the camera: ',
    'lip.camPreparing': 'Getting the camera ready\nAllow access when asked',
    'lip.camInsecure': "The camera can't be used on this browser or address. (HTTPS or localhost required)",
    'lip.camNoAnswer': 'The camera request got no answer. Check that (1) the page is open in Chrome, not an in-app browser, (2) the camera is allowed in the address bar, (3) Chrome has camera permission in the device settings, then tap "Reconnect camera".',
    'lip.camRequesting': 'Requesting camera access...','lip.camWaiting': 'The webcam was disconnected. It reconnects automatically when you plug it back in.',
    'lip.faceLoading': 'Preparing face tracking...', 'lip.imgFail': "Couldn't load the picture", 'lip.avatarLoading': 'Loading the avatar',
    'lip.avatarFail': "Couldn't load the avatar", 'lip.sourceGroup': 'Try-on mode', 'lip.useCamera': 'Try with camera',
    'lip.avatarNext': 'Switch avatar ({i}/{n})', 'lip.useAvatar': 'Try with avatar',
    'lip.colorAria': 'Color {hex}', 'lip.matchFaceFail': "Couldn't see your face clearly. Face forward in a bright place and try again.",
    'lip.matchSkinFail': "Couldn't measure your skin color. Face forward in a bright place and try again.",
    'lip.matchNear': " It's near the boundary, so it could also be '{label}'.", 'lip.matchResult': 'Estimated tone: {label} ({desc}).{near} ',
    'lip.matchPalette': 'Tap a suggested color below to try it on right away.',
    'lip.matchApplied': 'Applied the first of 3 suggested colors.',
    'lip.mHue': 'Skin hue {v}° (warm if ≥ {t}°)', 'lip.mLight': 'Skin lightness L {v} (light if ≥ {t})', 'lip.mNoContrast': 'Brow contrast not measured',
    'lip.mContrast': 'Skin–brow contrast {v} (threshold {t})', 'lip.mWb': 'Lighting corrected with eye whites', 'lip.mCalib': 'Lighting corrected with the white-paper calibration', 'lip.mNoWb': 'Lighting not corrected (eye whites not found)',
    'lip.ref': 'Products similar to {hex} (most similar first)', 'lip.recLoading': 'Loading recommendations...',
    'lip.recFail': "Couldn't load recommendations.", 'lip.recCount': '{n} products · Tap "Try on lips" to apply it on the camera view.',
    'lip.recNone': 'No similar products.', 'lip.tryOn': 'Try on lips', 'lip.applying': 'On your lips: {name}{finish}',
    'lip.appliedToast': 'Applied {name} to your lips', 'lip.productApplied': 'Applied the recommended product color',
    'lip.prevMatch': 'These colors were suggested earlier. Tap the button to measure again.',
  },
};

/** 화면 문구. {n} 같은 자리는 vars 로 채운다 */
export function t(key, vars = {}) {
  const s = STRINGS[lang()][key] ?? STRINGS.ko[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** data-i18n 속성이 있는 요소의 글자·aria-label 을 지금 언어로 바꾼다 */
export function applyI18n(root = document) {
  document.documentElement.lang = lang();
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
};
STRINGS.ko['lang.current'] = '현재 언어: {name}';
STRINGS.en['lang.current'] = 'Current language: {name}';
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
STRINGS.ko['home.admin'] = '관리자'; STRINGS.en['home.admin'] = 'Admin';
// 홈 시작 버튼 (2026-11-15)
Object.assign(STRINGS.ko, {
  'home.choose': '어떻게 시작할까요?',
  'home.toPalette': '카메라로 발라 보기', 'home.toPaletteDesc': '거울 앞에서 립 색을 섞어 바로 발라 봐요',
   'home.toTag': '제품 태그하기',
});
Object.assign(STRINGS.en, {
  'home.choose': 'How would you like to start?',
  'home.toPalette': 'Try on with the camera', 'home.toPaletteDesc': 'Mix lip colors and try them on in the mirror',
   'home.toTag': 'Tag a product',
});
// TOOK_prototype 디자인 화면 (2026-11-16): 홈 알약 버튼 · Find Your Color(팔레트)
Object.assign(STRINGS.ko, {
 'home.tapToStart': '화면을 눌러 시작하세요',
  'fc.pageTitle': 'took(툭) - Find Your Color', 'fc.title': 'Find Your Color', 'fc.sub': '나만의 컬러를 찾아보세요',
  'fc.sheet': '추천 제품 보기', 'fc.sheetClose': '추천 제품 닫기', 'fc.dial': '컬러 다이얼 (돌려서 색 고르기, 손잡이 아래 칸이 고른 색)',
  'fc.theme': '다크 모드 켜기/끄기', 'fc.swatch': '컬러 {hex}', 'fc.families': '컬러 계열',
  'fc.family': '{name} 계열 · {hex}', 'fc.fam.red': '빨강', 'fc.fam.pink': '핑크', 'fc.fam.purple': '보라', 'fc.fam.orange': '오렌지', 'fc.fam.nude': '누드',
  'fc.texture': '텍스처: {name} (누르면 바뀌어요)', 'fc.textures': '질감 (옆으로 밀어 바꾸기)', 'fc.menu': '메뉴', 'fc.menuToggle': '메뉴 펼치기/접기', 'fc.menuScan': '컬러 찾기 (지금 화면)', 'fc.menuNfc': 'NFC 태그로 제품 올리기',
  'fc.searching': '비슷한 제품을 찾고 있어요', 'fc.found': '이 컬러와 비슷한 제품 {n}개', 'fc.none': '비슷한 제품이 없어요', 'fc.back': '← 컬러 다시 고르기',
});
Object.assign(STRINGS.en, {
 'home.tapToStart': 'Tap the screen to start',
  'fc.pageTitle': 'took - Find Your Color', 'fc.title': 'Find Your Color', 'fc.sub': 'Find your own color',
  'fc.sheet': 'Show matching products', 'fc.sheetClose': 'Close matching products', 'fc.dial': 'Color dial (turn it; the segment under the handle is your color)',
  'fc.theme': 'Toggle dark mode', 'fc.swatch': 'Color {hex}', 'fc.families': 'Color families',
  'fc.family': '{name} · {hex}', 'fc.fam.red': 'Red', 'fc.fam.pink': 'Pink', 'fc.fam.purple': 'Purple', 'fc.fam.orange': 'Orange', 'fc.fam.nude': 'Nude',
  'fc.texture': 'Texture: {name} (tap to change)', 'fc.textures': 'Textures (swipe to change)', 'fc.menu': 'Menu', 'fc.menuToggle': 'Open or close the menu', 'fc.menuScan': 'Find your color (this screen)', 'fc.menuNfc': 'Tag a product (NFC)',
  'fc.searching': 'Looking for similar products', 'fc.found': '{n} products similar to this color', 'fc.none': 'No similar products', 'fc.back': '← Choose the color again',
});
// 추천 시트 안내 (2026-11-21)
Object.assign(STRINGS.ko, {
  'fc.guide': '지금 바른 색과 비슷한 추천 립 {n}개예요',
});
Object.assign(STRINGS.en, {
  'fc.guide': '{n} lips similar to the color you are wearing',
});
// NFC 태그 시트 (2026-11-19, js/nfc-window.js): 태그하면 바로 바르고 아래에 호수 줄
Object.assign(STRINGS.ko, {
  'nw.close': '닫기', 'nw.recent': '방금 태그한 립', 'nw.take': '가져가기', 'nw.similar': '이 색과 비슷한 립 보기',
  'nw.pickShade': '들고 계신 호수를 골라 주세요', 'nw.wearing': '지금 입은 호수', 'nw.shadeCount': '{n}가지',
  'nw.noShades': '호수 정보 준비 중이에요 · 대표 색을 발랐어요',
  'nw.unknown': '등록되지 않은 태그예요', 'nw.unknownSub': '태그를 다시 한 번 리더기 가운데에 대 주세요',
  // NFC 안내·인식 모달 (2026-11-22)
  'nm.title': '제품을 리더기에 대 주세요', 'nm.sub': '들고 계신 립 제품의 색을 입술에 바로 발라 드려요',
  'nm.step1': '제품을 손에 들어요', 'nm.step2': '리더기에 톡 대요', 'nm.step3': '거울 속 입술에 바로 발라져요',
  'nm.waiting': '리더기 기다리는 중', 'nm.dial': '다이얼로 고르기 (테스트용)',
  'nm.hit': '인식했어요', 'nm.applied': '입술에 바로 발라드릴게요', 'nm.toCard': '제품 보기',
});
Object.assign(STRINGS.en, {
  'nw.close': 'Close', 'nw.recent': 'Just tagged', 'nw.take': 'Take it home', 'nw.similar': 'Similar lips',
  'nw.pickShade': 'Pick the shade you are holding', 'nw.wearing': 'Wearing', 'nw.shadeCount': '{n} shades',
  'nw.noShades': 'Shade info coming soon · showing the main color',
  'nw.unknown': "This tag isn't registered", 'nw.unknownSub': 'Please tap it again on the center of the reader',
  'nm.title': 'Hold the product to the reader', 'nm.sub': 'We will put its color on your lips right away',
  'nm.step1': 'Pick up the product', 'nm.step2': 'Tap it on the reader', 'nm.step3': 'See it on your lips in the mirror',
  'nm.waiting': 'Waiting for the reader', 'nm.dial': 'Choose with the dial (test)',
  'nm.hit': 'Got it', 'nm.applied': 'Putting it on your lips now', 'nm.toCard': 'See product',
});

/**
 * 언어 선택 메뉴. 버튼을 누르면 아래에 목록이 열리고, 다른 언어를 고르면 화면이 그 언어로 다시 열린다.
 * @param {{ skipIntro?: boolean }} [opts] 홈 대기 화면에서는 skipIntro: false (같은 대기 화면을 새 언어로)
 */
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
/** 제품 링크: 영어면 글로벌 올리브영 상세(url_en), 없으면 한국 올리브영 */
export const storeUrlOf = (p) => (isEn() && p.url_en) || p.url;
/** 가격: 원화 그대로 (영어면 ₩13,000) */
export const priceText = (n) => (isEn() ? '₩' + Number(n).toLocaleString('en-US') : Number(n).toLocaleString('ko-KR') + '원');
export const finishText = (f) => t(f ? 'finish.' + f : 'finish.none');
