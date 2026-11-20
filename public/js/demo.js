// 시연용 데이터 표시 한곳 (2026-11-20, 로드맵 0단계)
//  - isDemo(제품): 올리브영 실데이터가 아니면 시연용 (판단은 src/lib/catalog.js 의 isDemo 하나로)
//  - demoBadge(): 화면마다 같은 모양·같은 말('시연용' / 'Demo')의 작은 배지
//  - 실데이터만 보기: 주소에 ?real=1 을 붙여 한 번 열면 이 기기에서 계속 켜진다(localStorage 'took.realOnly'). ?real=0 으로 끈다.
//    켜지면 시연용 제품·호수가 추천·검색·바코드·이름 찾기에서 빠지고, 가짜 매장 재고도 숨긴다.
//    서버 모드는 요청 머리말(X-Took-Real-Only)로 서버에 알리고(api.js), 정적 모드는 브라우저 안의 catalog 가 직접 거른다
import { isDemo, setRealOnlyGetter } from '../lib/catalog.js';
import { el } from './dom.js';
import { isEn } from './i18n.js';

export { isDemo };

const KEY = 'took.realOnly';

// 주소의 ?real=1 / ?real=0 을 기기 설정으로 저장 (키오스크 iframe 들은 같은 출처라 함께 따른다)
try {
  const v = new URLSearchParams(location.search).get('real');
  if (v === '1') localStorage.setItem(KEY, '1');
  else if (v === '0') localStorage.removeItem(KEY);
} catch { /* 저장소를 못 쓰면 기본값(끔) */ }

/** 실데이터만 보기가 켜져 있는지 */
export function realOnly() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

// 정적 모드에서는 브라우저 안의 catalog 가 실제로 데이터를 거르므로 같은 설정을 쓰게 한다
setRealOnlyGetter(realOnly);

export const demoText = () => (isEn() ? 'Demo' : '시연용');

/** '시연용' 배지. title 에 자세한 설명을 넣을 수 있다 */
export function demoBadge(title) {
  return el('span', { class: 'demo-badge', text: demoText(), title: title || null });
}

/** 제품이 시연용이면 배지, 아니면 null (el() 자식으로 그대로 넣을 수 있다) */
export function demoBadgeFor(p) {
  return isDemo(p) ? demoBadge() : null;
}
