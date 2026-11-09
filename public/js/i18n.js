// 화면 언어 (한국어 / 영어). 서비스 전체가 같은 언어 설정을 쓴다.
// - 언어는 브라우저 탭 저장소(sessionStorage 'took.lang')에 둔다. 키오스크 자동 초기화(store.clear)가 'took.*' 를 지우므로
//   다음 손님은 항상 한국어로 시작한다
// - 화면 문구는 STRINGS 에 키로 두고 t('키') 로 꺼낸다. HTML 에서는 data-i18n="키" (글자), data-i18n-aria="키" (aria-label)
// - 제품 이름: 영어일 때 글로벌 올리브영에서 짝지은 brand_en·name_en 을 쓰고, 없으면 한국어 이름을 그대로 둔다 (지어내지 않는다)
// 아직 영어 문구가 없는 화면은 한국어로 보인다 (STRINGS.en 에 없는 키는 한국어로 대신한다)
const KEY = 'took.lang';
export const LANGS = ['ko', 'en'];
// 휴대폰 QR 로 열면 화면 언어를 주소로 넘긴다 (?lang=en)
try {
  const want = new URLSearchParams(location.search).get('lang');
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
export function setLang(next, { skipIntro = true } = {}) {
  try {
    sessionStorage.setItem(KEY, next);
    if (skipIntro && /(^|\/)(index\.html)?$/.test(location.pathname)) sessionStorage.setItem('took.homeSkipIntro', 'true');
  } catch { /* 저장 불가 환경 */ }
  location.reload();
}

const STRINGS = {
  ko: {
    'nav.reset': 'took(초기화)', 'nav.home': '홈', 'nav.palette': '팔레트', 'nav.chat': 'AI 뷰티 챗봇',
    'nav.portrait': '세로로 보기', 'nav.portraitTitle': 'iPad 를 세웠을 때 화면으로 바꿔 봅니다', 'nav.landscape': '가로로 보기', 'nav.landscapeTitle': 'iPad 를 눕혔을 때 화면으로 돌아갑니다',
    'nav.idleTest': '자동 초기화 테스트', 'nav.idleTestTitle': '조작이 없을 때 뜨는 안내를 바로 띄웁니다',
    'idle.title': '계속 이용하시나요?', 'idle.desc': '{n}초 뒤 처음 화면으로 돌아가요. 지금까지의 대화와 고른 색은 지워져요.',
    'idle.keep': '계속', 'idle.keepAria': '계속 이용하기', 'idle.home': '처음으로', 'idle.homeAria': '처음 화면으로',
    'home.brandWord': '툭', 'home.title': '툭.', 'home.lead': 'AI가 내 입술을 찾아 바로 발라 보고, 찰떡 컬러의 립까지 찾아 줘요',
    'home.palette': '섞어서 발라 보기', 'home.paletteAria': '팔레트에서 립 색 섞어 발라 보기',
    'home.chat': '말로 물어보기', 'home.chatAria': 'AI 뷰티 챗봇에게 물어보기', 'home.chatBot': '찾는 립 컬러를 편하게 말씀해 주세요',
    'home.touch': '화면을 눌러 시작하기', 'home.standby': '제품을 태그해보세요', 'home.standbyTouch': '또는 화면을 눌러 시작해요',
    'card.brand': '브랜드', 'card.name': '제품명', 'card.color': '색상값', 'card.finish': '제형', 'card.price': '가격',
    'card.noImage': '이미지 준비 중', 'card.store': '올리브영에서 보기', 'card.detail': '상세 보기',
    'finish.glossy': '글로시', 'finish.matte': '매트', 'finish.satin': '새틴', 'finish.velvet': '벨벳', 'finish.none': '정보 없음',
    'family.red': '레드', 'family.pink': '핑크', 'family.coral': '코랄', 'family.orange': '오렌지', 'family.nude': '누드',
    'family.brown': '브라운', 'family.rose': '로즈', 'family.berry': '베리', 'family.plum': '플럼', 'family.burgundy': '버건디',
    'texture.matte': '매트', 'texture.satin': '새틴', 'texture.glossy': '글로시', 'texture.sheer': '시어', 'texture.shimmer': '쉬머',
    'season.spring': '봄 웜', 'season.summer': '여름 쿨', 'season.autumn': '가을 웜', 'season.winter': '겨울 쿨',
    'season.spring.desc': '밝고 따뜻한 톤', 'season.summer.desc': '밝고 부드러운 쿨 톤', 'season.autumn.desc': '깊고 따뜻한 톤', 'season.winter.desc': '깊고 선명한 쿨 톤',
    // 제품 상세
    'detail.pageTitle': 'took(툭) - 제품 상세', 'detail.title': '제품 상세 정보', 'detail.imageArea': '제품 이미지 영역', 'detail.imagePlaceholder': '제품 이미지 플레이스홀더',
    'detail.infoArea': '제품 정보 영역', 'detail.loading': '불러오는 중...', 'detail.actions': '연결 기능', 'detail.back': '이전 화면으로',
    'detail.toChat': '이 제품으로 챗봇에 질문하기', 'detail.toSimilar': '비슷한 색상 제품 보기', 'detail.home': '홈으로 돌아가기',
    'detail.noId': '제품 ID 가 없습니다.', 'detail.notFound': '제품을 찾을 수 없습니다.',
    'detail.source': '출처', 'detail.sourceOy': '올리브영 (수집 시점의 판매가)', 'detail.sourceVirtual': '시연용 가상 데이터',
    'detail.barcode': '바코드', 'detail.type': '종류', 'detail.shade': '색상명', 'detail.hex': '색상값(HEX)', 'detail.lab': '색상값(Lab)',
    'detail.family': '색상 계열', 'detail.desc': '설명', 'detail.originalName': '올리브영 상품명', 'detail.store': '올리브영',
    'detail.storeOpen': '상세 페이지 열기 (새 창)', 'detail.none': '정보 없음', 'detail.listPrice': '정가 {price}',
    'detail.shadeOf': '{n}가지 중 대표색', 'detail.shadeRep': '대표색', 'detail.byName': ' (상품명 기준 추정)', 'detail.byColor': ' (색상값으로 추정)',
    'type.립틴트': '립틴트',
    // 팔레트
    'pal.pageTitle': 'took(툭) - 팔레트', 'pal.camArea': '가상 립 메이크업 화면', 'pal.camRetry': '카메라 다시 연결',
    'pal.match': '나에게 어울리는 컬러', 'pal.matchBtn': '내 톤으로 추천받기', 'pal.matchSwatches': '추천 컬러', 'pal.matchMore': '측정값 · 안내',
    'pal.matchNote': '볼·이마 피부색으로 톤을 추정한 참고용 결과입니다. 조명에 따라 달라질 수 있어요.',
    'pal.board': '팔레트', 'pal.reset': '처음부터 다시 섞기', 'pal.paints': '립 컬러 물감', 'pal.mixAria': '섞는 칸 (드래그하면 저어져요)',
    'pal.mixEmpty': '물감을 눌러\n떨어뜨려요', 'pal.undo': '한 방울 빼기', 'pal.finishArea': '텍스처와 제품 추천', 'pal.textures': '텍스처',
    'pal.nfcIdle': '립 제품을 리더기에 톡 올리면 그 색을 발라 봐요', 'pal.nfcApplied': '{name} 색을 발랐어요', 'pal.nfcUnknown': '등록되지 않은 태그예요',
    'pal.nfcStart': '휴대폰 NFC 켜기', 'pal.nfcStop': 'NFC 끄기', 'pal.nfcStarting': 'NFC 를 켜는 중… 권한 창이 뜨면 허용해 주세요',
    'pal.nfcSlow': '아직 안 켜졌어요. NFC 설정이 켜져 있는지, Chrome 앱에서 열었는지 확인하고 다시 눌러 주세요', 'pal.nfcOn': 'NFC 켜짐 · 카드를 휴대폰 뒷면에 대 주세요',
    'pal.nfcFail': 'NFC 를 켜지 못했어요', 'pal.nfcRetry': '카드를 읽지 못했어요. 1~2초 대고 다시 시도해 주세요', 'pal.nfcRead': 'NFC 로 읽은 제품',
    'pal.nfcPair': '휴대폰으로 NFC 읽기', 'pal.nfcPairTitle': '휴대폰을 NFC 리더기로', 'pal.nfcPairHelp': '휴대폰 카메라로 QR 을 찍어 Chrome 으로 열고 "NFC 읽기 시작"을 누르세요. 카드를 대면 이 화면에 제품이 떠요.',
    'pal.nfcPairWait': '휴대폰 연결을 기다리는 중이에요', 'pal.nfcPairOk': '휴대폰이 연결됐어요', 'pal.nfcPairPhoneOn': '휴대폰 NFC 켜짐 · 카드를 휴대폰에 대 주세요',
    'pal.nfcPairNoServer': '휴대폰 연결은 서버(npm start)를 켠 https 주소에서만 돼요', 'pal.nfcPairHttp': '주의: http 주소라 휴대폰 NFC 가 막혀요. https(터널) 주소로 이 화면을 열어 주세요',
    'pal.nfcPairEnded': '휴대폰 연결이 끝났어요. 다시 눌러 주세요', 'pal.nfcClose': '닫기', 'pal.nfcNewCode': '번호 바꾸기', 'pal.nfcCodeHelp': '휴대폰 Chrome 에서 아래 주소를 열고 네 자리 번호를 입력하세요. QR 을 찍어도 돼요. 휴대폰은 번호를 기억해서 다음부터는 주소만 열면 돼요.', 'pal.nfcReconnected': '서버가 다시 켜져서 같은 번호로 다시 연결했어요',
    'pal.intensity': '농도', 'pal.find': '이 색과 비슷한 제품 추천', 'pal.result': '추천 제품', 'pal.backMix': '← 다시 섞기',
    'pal.dropAria': '{name} 물감 한 방울 떨어뜨리기', 'pal.maxDrops': '한 번에 {n}방울까지 섞을 수 있어요', 'pal.drops': '{n}방울',
    'pal.resetDone': '색을 초기화했어요', 'pal.mixed': '조제한 색 {hex}', 'pal.searching': '{hex} 와 비슷한 제품을 찾는 중...',
    'pal.found': '조제한 색 {hex} 와 비슷한 제품 {n}개 (색이 가까운 순)',
    // 립 카메라·톤 측정 (팔레트 화면이 쓴다)
    'lip.camUnavailable': '카메라를 사용할 수 없습니다', 'lip.avatarMeasuring': '아바타의 피부 톤을 측정하고 있어요.',
    'lip.avatarNoTone': '아바타 그림에서는 피부 톤을 잴 수 없어요. 어울리는 컬러는 카메라로 테스트해 주세요.',
    'lip.noTracker': '이 브라우저에서는 얼굴 인식을 사용할 수 없어 컬러를 적용하지 못했습니다.', 'lip.centerFace': '얼굴이 화면 가운데에 오도록 맞춰 주세요.',
    'lip.measuring': '피부 톤을 측정하고 있어요. 정면을 보고 잠시 기다려 주세요.',
    'lip.camDenied': '카메라 권한이 거부되었습니다. 주소창의 카메라 권한을 허용한 뒤 "카메라 다시 연결"을 눌러 주세요.',
    'lip.camNotFound': '사용할 수 있는 카메라를 찾지 못했습니다. 카메라를 연결한 뒤 다시 시도해 주세요.',
    'lip.camBusy': '카메라가 다른 프로그램에서 사용 중입니다. 다른 프로그램을 닫고 다시 시도해 주세요.', 'lip.camFailed': '카메라를 시작하지 못했습니다: ',
    'lip.camPreparing': '카메라를 준비하고 있습니다\n권한 요청이 뜨면 허용해 주세요',
    'lip.camInsecure': '이 브라우저 또는 접속 주소에서는 카메라를 사용할 수 없습니다. (HTTPS 또는 localhost 접속 필요)',
    'lip.camRequesting': '카메라 권한을 요청하고 있습니다...', 'lip.camLost': '카메라 연결이 끊어졌습니다. "카메라 다시 연결"을 눌러 주세요.',
    'lip.faceLoading': '얼굴 인식 준비 중...', 'lip.imgFail': '그림을 불러오지 못했어요', 'lip.avatarLoading': '아바타를 불러오고 있습니다',
    'lip.avatarFail': '아바타를 불러오지 못했습니다', 'lip.sourceGroup': '테스트 방식', 'lip.useCamera': '카메라로 테스트하기',
    'lip.avatarNext': '다른 아바타로 바꾸기 ({i}/{n})', 'lip.useAvatar': '아바타로 테스트하기', 'lip.selected': '선택한 컬러 {hex} · {texture}',
    'lip.colorAria': '컬러 {hex}', 'lip.matchFaceFail': '얼굴을 충분히 인식하지 못했습니다. 밝은 곳에서 정면을 보고 다시 시도해 주세요.',
    'lip.matchSkinFail': '피부색을 측정하지 못했습니다. 밝은 곳에서 정면을 보고 다시 시도해 주세요.',
    'lip.matchNear': " 경계에 가까워 '{label}'일 수도 있어요.", 'lip.matchResult': '추정 톤: {label} ({desc}).{near} ',
    'lip.matchPalette': '추천 컬러를 누르면 팔레트에 한 방울 떨어져요. 팔레트에도 같은 물감을 표시해 두었어요.',
    'lip.matchApplied': '추천 컬러 3가지 중 첫 번째를 적용했어요.',
    'lip.mHue': '피부 색상각 {v}° (웜 기준 {t}° 이상)', 'lip.mLight': '피부 밝기 L {v} (밝은 톤 기준 {t})', 'lip.mNoContrast': '눈썹 대비 측정 안 됨',
    'lip.mContrast': '피부-눈썹 대비 {v} (기준 {t})', 'lip.mWb': '눈 흰자 기준 조명 보정 적용', 'lip.mNoWb': '조명 보정 못 함(눈 흰자 인식 실패)',
    'lip.ref': '기준 컬러 {hex} 와 비슷한 제품 (색상 유사도 높은 순)', 'lip.recLoading': '추천 제품을 불러오는 중...',
    'lip.recFail': '추천 제품을 불러오지 못했습니다.', 'lip.recCount': "{n}개 제품 · '입술에 발라보기'를 누르면 카메라 화면에 바로 적용됩니다.",
    'lip.recNone': '비슷한 제품이 없습니다.', 'lip.tryOn': '입술에 발라보기', 'lip.applying': '입술에 적용 중: {name}{finish}',
    'lip.appliedToast': '{name} 컬러를 입술에 발랐어요', 'lip.productApplied': '추천 제품 컬러를 입술에 발랐어요',
    'lip.prevMatch': '이전에 추천받은 컬러입니다. 다시 측정하려면 버튼을 눌러 주세요.',
    'lip.chooseMode': '아래에서 테스트 방식을 골라 주세요\n아바타 그림 또는 내 카메라로 립 컬러를 발라 볼 수 있어요',
    // 음성
    'voice.denied': '마이크 권한이 거부되었습니다. 주소창의 마이크 권한을 허용한 뒤 다시 눌러 주세요.',
    'voice.noSpeech': '말소리가 들리지 않았습니다. 버튼을 다시 누르고 말씀해 주세요.', 'voice.noMic': '마이크를 찾지 못했습니다. 마이크 연결을 확인해 주세요.',
    'voice.network': '음성 인식 서비스에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.', 'voice.error': '음성 인식 중 오류가 발생했습니다: {code}',
    'voice.unsupported': '이 브라우저는 음성 인식을 지원하지 않습니다. Safari(iPad), Chrome 또는 Edge 에서 사용해 주세요.',
    'voice.listening': '말씀해 주세요. 말을 멈추면 자동으로 질문을 보냅니다.', 'voice.heard': '들은 내용: "{text}"',
    // 챗봇 화면
    'chat.pageTitle': 'took(툭) - AI 뷰티 챗봇',
    'chat.title': 'took 뷰티 챗봇',
    'chat.subtitle': '등록 제품 기반 추천 · 규칙 기반(외부 AI 미연결)',
    'chat.tts': '답변 소리로 읽어주기',
    'chat.reset': '새 대화',
    'chat.base': '기준 제품:',
    'chat.baseClear': '해제',
    'chat.compare': '비교함',
    'chat.compareRun': '비교하기',
    'chat.compareClear': '비우기',
    'chat.voice': '말로 질문하기',
    'chat.heard': '들은 말',
    'chat.scanOpen': '바코드로 제품 알아보기',
    'chat.side': '바코드 찾기와 추천 제품',
    'chat.close': '닫기',
    'chat.scanner': '바코드 스캐너',
    'chat.scannerTitle': '스캐너로 립 제품의 바코드를 찍어 주세요',
    'chat.scannerDesc': '찍으면 어떤 제품인지 바로 대화로 설명하고, 그 제품을 기준으로 비슷한 색·더 저렴한 제품을 찾아 드려요.',
    'chat.scannerReady': '스캐너 대기 중',
    'chat.typeNumber': '스캐너가 못 읽으면 번호로 입력',
    'chat.ok': '확인',
    'chat.noScanner': '스캐너가 없을 때',
    'chat.phone': '휴대폰으로 찍기',
    'chat.qr': '휴대폰 연결 QR 코드',
    'chat.qrWait': 'QR 준비 중',
    'chat.step1': '휴대폰 기본 카메라로 QR을 비춰요.',
    'chat.step2': '열린 화면에서 \"바코드 사진 찍기\".',
    'chat.step3': '제품 설명이 이 대화에 떠요.',
    'chat.pcCam': 'PC 카메라로 찍기',
    'chat.camOff': '카메라가 꺼져 있어요',
    'chat.camStart': '카메라로 바코드 찍기',
    'chat.camStop': '카메라 끄기',
    'chat.photo': '사진으로 찍기',
    'chat.demoBarcodes': '시연용 바코드 보기 (새 창)',
    'voice.candidates': ' (후보 {n}개 중 선택)', 'voice.understood': ' → 이해한 내용: "{text}"', 'voice.nothing': '인식된 말이 없습니다. 버튼을 다시 누르고 말씀해 주세요.',
  },
  en: {
    'nav.reset': 'took (reset)', 'nav.home': 'Home', 'nav.palette': 'Palette', 'nav.chat': 'AI Beauty Chat',
    'nav.portrait': 'Portrait view', 'nav.portraitTitle': 'Preview the screen with the iPad upright', 'nav.landscape': 'Landscape view', 'nav.landscapeTitle': 'Back to the screen with the iPad lying flat',
    'nav.idleTest': 'Test auto reset', 'nav.idleTestTitle': 'Show the idle notice now',
    'idle.title': 'Still there?', 'idle.desc': 'Going back to the start in {n} seconds. Your chat and chosen colors will be cleared.',
    'idle.keep': 'Continue', 'idle.keepAria': 'Keep using', 'idle.home': 'Start over', 'idle.homeAria': 'Back to the start screen',
    'home.brandWord': 'took', 'home.title': 'took.', 'home.lead': 'AI finds your lips, tries colors on instantly, and picks the lip product that suits you',
    'home.palette': 'Mix & try on', 'home.paletteAria': 'Mix lip colors on the palette and try them on',
    'home.chat': 'Ask by voice', 'home.chatAria': 'Ask the AI beauty chat', 'home.chatBot': 'Tell me the lip color you are looking for',
    'home.touch': 'Tap the screen to start', 'home.standby': 'Tag a product to start', 'home.standbyTouch': 'or touch the screen to start',
    'card.brand': 'Brand', 'card.name': 'Product', 'card.color': 'Color', 'card.finish': 'Finish', 'card.price': 'Price',
    'card.noImage': 'Image coming soon', 'card.store': 'View on OLIVE YOUNG', 'card.detail': 'Details',
    'finish.glossy': 'Glossy', 'finish.matte': 'Matte', 'finish.satin': 'Satin', 'finish.velvet': 'Velvet', 'finish.none': 'N/A',
    'family.red': 'Red', 'family.pink': 'Pink', 'family.coral': 'Coral', 'family.orange': 'Orange', 'family.nude': 'Nude',
    'family.brown': 'Brown', 'family.rose': 'Rose', 'family.berry': 'Berry', 'family.plum': 'Plum', 'family.burgundy': 'Burgundy',
    'texture.matte': 'Matte', 'texture.satin': 'Satin', 'texture.glossy': 'Glossy', 'texture.sheer': 'Sheer', 'texture.shimmer': 'Shimmer',
    'season.spring': 'Spring Warm', 'season.summer': 'Summer Cool', 'season.autumn': 'Autumn Warm', 'season.winter': 'Winter Cool',
    'season.spring.desc': 'bright, warm tone', 'season.summer.desc': 'light, soft cool tone', 'season.autumn.desc': 'deep, warm tone', 'season.winter.desc': 'deep, vivid cool tone',
    // Product detail
    'detail.pageTitle': 'took - Product details', 'detail.title': 'Product details', 'detail.imageArea': 'Product image', 'detail.imagePlaceholder': 'Product image placeholder',
    'detail.infoArea': 'Product information', 'detail.loading': 'Loading...', 'detail.actions': 'Next steps', 'detail.back': 'Back',
    'detail.toChat': 'Ask the chat about this product', 'detail.toSimilar': 'See similar colors', 'detail.home': 'Back to home',
    'detail.noId': 'No product ID.', 'detail.notFound': 'Product not found.',
    'detail.source': 'Source', 'detail.sourceOy': 'OLIVE YOUNG Korea (price at collection time)', 'detail.sourceVirtual': 'Demo data',
    'detail.barcode': 'Barcode', 'detail.type': 'Type', 'detail.shade': 'Shade', 'detail.hex': 'Color (HEX)', 'detail.lab': 'Color (Lab)',
    'detail.family': 'Color family', 'detail.desc': 'Description', 'detail.originalName': 'OLIVE YOUNG Korea name', 'detail.store': 'OLIVE YOUNG',
    'detail.storeOpen': 'Open product page (new window)', 'detail.none': 'N/A', 'detail.listPrice': 'list price {price}',
    'detail.shadeOf': 'representative of {n} shades', 'detail.shadeRep': 'representative shade', 'detail.byName': ' (estimated from product name)', 'detail.byColor': ' (estimated from color)',
    'type.립틴트': 'Lip tint',
    // Palette
    'pal.pageTitle': 'took - Palette', 'pal.camArea': 'Virtual lip makeup', 'pal.camRetry': 'Reconnect camera',
    'pal.match': 'Colors that suit me', 'pal.matchBtn': 'Find my tone', 'pal.matchSwatches': 'Suggested colors', 'pal.matchMore': 'Measurements · notes',
    'pal.matchNote': 'A rough tone estimate from cheek and forehead skin color. Lighting can change the result.',
    'pal.board': 'Palette', 'pal.reset': 'Start mixing over', 'pal.paints': 'Lip color paints', 'pal.mixAria': 'Mixing well (drag to stir)',
    'pal.mixEmpty': 'Tap a paint\nto drop it in', 'pal.undo': 'Remove a drop', 'pal.finishArea': 'Texture and product picks', 'pal.textures': 'Texture',
    'pal.nfcIdle': 'Tap a lip product on the reader to try its color', 'pal.nfcApplied': 'Trying on {name}', 'pal.nfcUnknown': 'Unregistered tag',
    'pal.nfcStart': 'Turn on phone NFC', 'pal.nfcStop': 'Turn off NFC', 'pal.nfcStarting': 'Turning on NFC… allow it if asked',
    'pal.nfcSlow': "Not on yet. Check that NFC is on and that you're in the Chrome app, then tap again", 'pal.nfcOn': 'NFC on · hold a card to the back of the phone',
    'pal.nfcFail': "Couldn't turn on NFC", 'pal.nfcRetry': "Couldn't read the card. Hold it for 1–2 seconds and try again", 'pal.nfcRead': 'Product from NFC',
    'pal.nfcPair': 'Read NFC with a phone', 'pal.nfcPairTitle': 'Use a phone as the NFC reader', 'pal.nfcPairHelp': 'Scan the QR with the phone camera, open it in Chrome and tap the start button. Tap a card and the product shows up here.',
    'pal.nfcPairWait': 'Waiting for the phone', 'pal.nfcPairOk': 'Phone connected', 'pal.nfcPairPhoneOn': 'Phone NFC on · tap a card on the phone',
    'pal.nfcPairNoServer': 'Phone pairing only works on an https address with the server running (npm start)', 'pal.nfcPairHttp': 'Note: phone NFC is blocked on http. Open this page through an https (tunnel) address',
    'pal.nfcPairEnded': 'The phone connection ended. Tap again', 'pal.nfcClose': 'Close', 'pal.nfcNewCode': 'New number', 'pal.nfcCodeHelp': 'On the phone, open this address in Chrome and enter the 4-digit number, or scan the QR. The phone remembers the number, so next time just open the address.', 'pal.nfcReconnected': 'The server restarted, so we reconnected with the same number',
    'pal.intensity': 'Intensity', 'pal.find': 'Find products in this color', 'pal.result': 'Recommended products', 'pal.backMix': '← Mix again',
    'pal.dropAria': 'Drop one drop of {name}', 'pal.maxDrops': 'You can mix up to {n} drops at a time', 'pal.drops': '{n} drops',
    'pal.resetDone': 'Colors reset', 'pal.mixed': 'Mixed color {hex}', 'pal.searching': 'Finding products similar to {hex}...',
    'pal.found': '{n} products similar to mixed color {hex} (closest first)',
    // Lip camera & tone
    'lip.camUnavailable': 'Camera unavailable', 'lip.avatarMeasuring': "Measuring the avatar's skin tone.",
    'lip.avatarNoTone': "Skin tone can't be measured on the avatar picture. Use the camera to find colors that suit you.",
    'lip.noTracker': "Face tracking isn't available in this browser, so the color couldn't be applied.", 'lip.centerFace': 'Center your face on the screen.',
    'lip.measuring': 'Measuring your skin tone. Look straight ahead and wait a moment.',
    'lip.camDenied': 'Camera access was denied. Allow the camera in the address bar, then tap "Reconnect camera".',
    'lip.camNotFound': 'No camera found. Connect a camera and try again.',
    'lip.camBusy': 'Another app is using the camera. Close it and try again.', 'lip.camFailed': 'Could not start the camera: ',
    'lip.camPreparing': 'Getting the camera ready\nAllow access when asked',
    'lip.camInsecure': "The camera can't be used on this browser or address. (HTTPS or localhost required)",
    'lip.camRequesting': 'Requesting camera access...', 'lip.camLost': 'The camera was disconnected. Tap "Reconnect camera".',
    'lip.faceLoading': 'Preparing face tracking...', 'lip.imgFail': "Couldn't load the picture", 'lip.avatarLoading': 'Loading the avatar',
    'lip.avatarFail': "Couldn't load the avatar", 'lip.sourceGroup': 'Try-on mode', 'lip.useCamera': 'Try with camera',
    'lip.avatarNext': 'Switch avatar ({i}/{n})', 'lip.useAvatar': 'Try with avatar', 'lip.selected': 'Selected color {hex} · {texture}',
    'lip.colorAria': 'Color {hex}', 'lip.matchFaceFail': "Couldn't see your face clearly. Face forward in a bright place and try again.",
    'lip.matchSkinFail': "Couldn't measure your skin color. Face forward in a bright place and try again.",
    'lip.matchNear': " It's near the boundary, so it could also be '{label}'.", 'lip.matchResult': 'Estimated tone: {label} ({desc}).{near} ',
    'lip.matchPalette': 'Tap a suggested color to drop it on the palette. The same paints are marked on the palette.',
    'lip.matchApplied': 'Applied the first of 3 suggested colors.',
    'lip.mHue': 'Skin hue {v}° (warm if ≥ {t}°)', 'lip.mLight': 'Skin lightness L {v} (light if ≥ {t})', 'lip.mNoContrast': 'Brow contrast not measured',
    'lip.mContrast': 'Skin–brow contrast {v} (threshold {t})', 'lip.mWb': 'Lighting corrected with eye whites', 'lip.mNoWb': 'Lighting not corrected (eye whites not found)',
    'lip.ref': 'Products similar to {hex} (most similar first)', 'lip.recLoading': 'Loading recommendations...',
    'lip.recFail': "Couldn't load recommendations.", 'lip.recCount': '{n} products · Tap "Try on lips" to apply it on the camera view.',
    'lip.recNone': 'No similar products.', 'lip.tryOn': 'Try on lips', 'lip.applying': 'On your lips: {name}{finish}',
    'lip.appliedToast': 'Applied {name} to your lips', 'lip.productApplied': 'Applied the recommended product color',
    'lip.prevMatch': 'These colors were suggested earlier. Tap the button to measure again.',
    'lip.chooseMode': 'Choose a try-on mode below\nTry lip colors on an avatar picture or with your own camera',
    // Voice
    'voice.denied': 'Microphone access was denied. Allow the microphone in the address bar, then tap again.',
    'voice.noSpeech': "I didn't hear anything. Tap the button and speak again.", 'voice.noMic': 'No microphone found. Check the microphone connection.',
    'voice.network': "Couldn't reach the speech service. Check the internet connection.", 'voice.error': 'Speech recognition error: {code}',
    'voice.unsupported': "This browser doesn't support speech recognition. Please use Safari (iPad), Chrome or Edge.",
    'voice.listening': 'Go ahead and speak. Your question is sent when you stop talking.', 'voice.heard': 'Heard: "{text}"',
    // Chat screen
    'chat.pageTitle': "took - AI Beauty Chat",
    'chat.title': "took beauty chat",
    'chat.subtitle': "Recommends registered products · rule-based (no external AI)",
    'chat.tts': "Read replies aloud",
    'chat.reset': "New chat",
    'chat.base': "Base product:",
    'chat.baseClear': "Clear",
    'chat.compare': "Compare",
    'chat.compareRun': "Compare",
    'chat.compareClear': "Clear",
    'chat.voice': "Ask by voice",
    'chat.heard': "What I heard",
    'chat.scanOpen': "Look up by barcode",
    'chat.side': "Barcode lookup and recommendations",
    'chat.close': "Close",
    'chat.scanner': "Barcode scanner",
    'chat.scannerTitle': "Scan a lip product barcode",
    'chat.scannerDesc': "I will describe the product in the chat and find similar colors or cheaper options based on it.",
    'chat.scannerReady': "Scanner ready",
    'chat.typeNumber': "If the scanner fails, type the number",
    'chat.ok': "OK",
    'chat.noScanner': "No scanner?",
    'chat.phone': "Scan with your phone",
    'chat.qr': "Phone pairing QR code",
    'chat.qrWait': "Preparing QR",
    'chat.step1': "Point your phone's camera at the QR.",
    'chat.step2': "On the page that opens, tap \"Take a barcode photo\".",
    'chat.step3': "The product info appears in this chat.",
    'chat.pcCam': "Scan with the PC camera",
    'chat.camOff': "The camera is off",
    'chat.camStart': "Scan with camera",
    'chat.camStop': "Turn off camera",
    'chat.photo': "Use a photo",
    'chat.demoBarcodes': "Demo barcodes (new window)",
    'voice.candidates': ' (picked from {n} candidates)', 'voice.understood': ' → understood: "{text}"', 'voice.nothing': "Nothing was recognized. Tap the button and speak again.",
  },
};

/** 화면 문구. {n} 같은 자리는 vars 로 채운다 */
export function t(key, vars = {}) {
  const s = STRINGS[lang()][key] ?? STRINGS.ko[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** 한 언어의 문구 목록 (예시 질문처럼 여러 개인 것) */
const LISTS = {
  ko: { 'home.questions': ['데이트 립 추천해 줘', '데일리로 바를 립 추천해 줘', '입술이 건조한데 뭐가 좋아?', '2만원 이하 글로시한 코랄 추천해 줘'] },
  en: { 'home.questions': ['Recommend a lip for a date', 'Something for everyday wear', 'My lips are dry. What should I use?', 'A glossy coral under ₩20,000'] },
};
export const tList = (key) => LISTS[lang()][key] ?? LISTS.ko[key] ?? [];

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
// 팔레트 → 휴대폰으로 가져가기 (palette.js openTake, chat.js 의 from=palette)
Object.assign(STRINGS.ko, {
  'pal.take': '휴대폰으로 가져가기', 'pal.takeTitle': '휴대폰으로 이어서 상담하기',
  'pal.takeHelp': '휴대폰 카메라로 QR 을 찍으면 이 결과로 챗봇과 이어서 대화해요. 사진·영상은 보내지 않아요.',
  'pal.takeSummary': '{hex} · {texture} · 농도 {n}%', 'pal.takeClose': '닫기', 'pal.takeQrAria': '휴대폰 챗봇 연결 QR 코드',
  'pal.takeNoQr': 'QR 을 그리지 못했어요. 아래 주소를 휴대폰에서 열어 주세요.',
});
Object.assign(STRINGS.en, {
  'pal.take': 'Take it to my phone', 'pal.takeTitle': 'Continue on your phone',
  'pal.takeHelp': 'Scan the QR with your phone camera to keep chatting about this result. No photos or video are sent.',
  'pal.takeSummary': '{hex} · {texture} · intensity {n}%', 'pal.takeClose': 'Close', 'pal.takeQrAria': 'QR code to continue the chat on your phone',
  'pal.takeNoQr': "Couldn't draw the QR. Open the address below on your phone.",
});
STRINGS.ko['theme.dark'] = '다크 모드'; STRINGS.ko['theme.light'] = '라이트 모드';
STRINGS.en['theme.dark'] = 'Dark mode'; STRINGS.en['theme.light'] = 'Light mode';

const svg = (inner, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const GLOBE = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>';
const CHEVRON = '<path d="m6 9 6 6 6-6"/>';

/**
 * 언어 선택 메뉴. 버튼을 누르면 아래에 목록이 열리고, 다른 언어를 고르면 화면이 그 언어로 다시 열린다.
 * @param {{ skipIntro?: boolean }} [opts] 홈 대기 화면에서는 skipIntro: false (같은 대기 화면을 새 언어로)
 */
export function languageMenu({ skipIntro = true } = {}) {
  const cur = lang();
  const box = document.createElement('div');
  box.className = 'lang-menu';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'lang-trigger';
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', t('lang.menu'));
  trigger.innerHTML = `${svg(GLOBE, 18)}<span>Language</span>${svg(CHEVRON, 16)}`;
  const pop = document.createElement('div');
  pop.className = 'lang-pop';
  pop.setAttribute('role', 'menu');
  pop.hidden = true;
  const head = document.createElement('p');
  head.className = 'lang-cur';
  head.textContent = t('lang.current', { name: LANG_NAMES[cur][cur] });
  pop.append(head, document.createElement('hr'));
  for (const code of LANGS.filter((c) => c !== cur)) {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.lang = code;
    // "English (영어)" 처럼 그 언어 이름 + 지금 화면 언어로 쓴 이름
    item.textContent = `${LANG_NAMES[code].native} (${LANG_NAMES[code][cur]})`;
    item.addEventListener('click', () => setLang(code, { skipIntro }));
    pop.append(item);
  }
  const open = (on) => {
    pop.hidden = !on;
    trigger.setAttribute('aria-expanded', String(on));
    if (on) pop.querySelector('[role=menuitem]')?.focus();
  };
  trigger.addEventListener('click', () => open(pop.hidden));
  // 바깥을 누르거나 Esc 를 누르면 닫는다
  document.addEventListener('pointerdown', (e) => { if (!box.contains(e.target)) open(false); }, true);
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { open(false); trigger.focus(); }
  });
  box.append(trigger, pop);
  return box;
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
