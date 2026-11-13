// 공통 모듈의 입구. 화면 파일들은 여기서 한꺼번에 가져다 쓴다.
// 실제 코드는 역할별 파일에 있다:
//   device-frame.js 기기 모드·미리보기 틀 · api.js 서버 API(정적 모드 포함) · store.js 저장·화면 이동
//   dom.js 요소 만들기 · product-view.js 제품 카드·상세 표 · nav.js 상단 메뉴 · idle-reset.js 자동 초기화
export { urlParam, DEVICE_MODE, TAB_FRAME, MOVING_TO_TAB_FRAME } from './device-frame.js'; // 가장 먼저: 틀로 옮기기·새로고침 처리
export { FINISH_LABELS, FAMILY_LABELS, finishLabel } from '../lib/constants.js';
export { toast, skeletonCards } from './motion.js'; // 화면 움직임(모든 화면 공통)
export { STATIC, api } from './api.js';
export { store, go, qs } from './store.js';
export { $, el } from './dom.js';
export { fullName, shortName, storeLink, won, detailLink, tryOnCard, productCard, productDetailTable } from './product-view.js';
export { logoSvg, renderNav } from './nav.js';
export { resetToHome } from './idle-reset.js';
