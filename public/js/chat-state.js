// 챗봇 화면: 화면 준비(상단 메뉴)와 대화 상태. 대화 기록·추천 목록·비교함·기준 제품을 들고 있고 sessionStorage 에 저장한다.
import { $, renderNav, STATIC, api, store, qs, won, fullName } from './common.js';
import { normalizeHex } from '../lib/color.js';
import { isEn } from './i18n.js';

// 화면 문구: C(한국어, 영어). 챗봇 답은 서버(엔진)가 같은 언어로 만든다
export const C = (ko, en) => (isEn() ? en : ko);

renderNav();
// 합본 화면(studio.html): 오른쪽 탭(색 조제·챗봇·추천·바코드)이 보이는 영역을 정하고, 립 매핑(lip.js)과 창 이벤트로 주고받는다
//   받음: took:color { hex } / took:recommend { hex }   보냄: took:apply { hex, finish } / took:show-tab { tab }
export const STUDIO = document.body.dataset.layout === 'studio';
// 챗봇은 매장 태블릿에서 쓴다 (상단 메뉴 'AI 뷰티 챗봇', 팔레트의 '챗봇과 이어서 상담'). 손님 휴대폰 모드는 2026-11-11 없앴다
// 챗봇 화면의 바코드 찾기 패널: 지금은 뺀다 (오른쪽 패널은 추천 제품만). 다시 쓰려면 true 로 바꾼다.
// 합본 화면(studio)은 이 값과 상관없이 바코드를 그대로 쓴다
export const BARCODE_PANEL = STUDIO || false;
export const showTab = (tab) => STUDIO && window.dispatchEvent(new CustomEvent('took:show-tab', { detail: { tab } }));
export const log = $('chat-log');
export const input = $('chat-input');

export const START = C(['데일리 립 추천해 줘', '데이트 립 추천해 줘', '입술이 건조해요', '내 톤에 맞는 립'],
  ['Recommend an everyday lip', 'Recommend a lip for a date', 'My lips are dry. What should I use?', 'A glossy coral under 20,000 won']);

// 테스트 화면과 대화가 섞이지 않게 대화 기록은 따로 저장한다 (기준 제품·립 색상은 공유)
export const state = {
  baseId: qs('base') || store.get('chatBaseId'),
  // 기준 색: 주소 > 팔레트에서 가져온 색 > 립 컬러 매핑에서 고른 색
  selectedHex: normalizeHex(qs('hex') || '') || store.get('chatHandoff')?.hex || store.get('lipColor')?.hex || null,
  messages: store.get('chatUserMessages', []),
  ctx: store.get('chatUserContext', null), // 직전 대화 상태: 서버가 돌려준 context 를 다음 질문에 그대로 보낸다
  list: store.get('chatUserList', []), // 오른쪽 패널의 현재 추천 목록 (번호 = 대화에서 가리키는 번호)
  focus: store.get('chatUserFocus', []), // 최근 답변이 가리킨 제품 (패널에서 강조)
  compare: store.get('chatUserCompare', []), // 비교함에 담은 제품 (최대 3개)
  panel: store.get('chatUserPanel', null), // 오른쪽 패널: 'scan'(바코드) | 'list'(추천 목록)
  typing: false,
};
if (state.panel !== 'scan' && state.panel !== 'list') state.panel = state.list.length ? 'list' : 'scan';
if (!BARCODE_PANEL) state.panel = 'list';
export let base = null;
export let brands = [];

// 말투 다듬기 A/B (서버판, src/lib/ab.js): 대화마다 무작위 id 하나로 반을 나눈다. 개인정보가 아닌 무작위 값이고, 자동 초기화 때 지워진다.
// 화면 행동은 횟수만 보낸다(빠른 답장·올리브영 제품 카드 클릭). 서버 없는 정적 버전은 보내지 않는다
export const AB_ID = (() => {
  let id = store.get('abId');
  if (!/^[0-9a-f]{16}$/.test(id || '')) {
    id = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');
    store.set('abId', id);
  }
  return id;
})();
export const track = (name) => {
  if (STATIC) return;
  fetch('api/ab-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: AB_ID, name }), keepalive: true }).catch(() => {});
};

export function save() {
  store.set('chatBaseId', state.baseId);
  store.set('chatUserMessages', state.messages);
  store.set('chatUserContext', state.ctx);
  store.set('chatUserList', state.list);
  store.set('chatUserFocus', state.focus);
  store.set('chatUserCompare', state.compare);
  store.set('chatUserPanel', state.panel);
}

// ---------- 기준 제품 ----------
export async function loadBase() {
  base = null;
  if (state.baseId) {
    const { ok, body } = await api('api/products/' + encodeURIComponent(state.baseId));
    if (ok) base = body.product;
    else state.baseId = null;
  }
  $('base-chip').classList.toggle('hidden', !base);
  if (base) $('base-name').textContent = `${fullName(base)} (${won(base.price)})`;
  save();
}

/** 등록 제품의 브랜드 목록 (음성 인식 후보 고르기용) */
export function setBrands(list) {
  brands = list;
}
