// 립 컬러 매핑 카메라: 테스트 방식 선택(아바타 / 카메라) → 입술 추적 → 선택 컬러 합성 → 어울리는 컬러 / 제품 추천.
// 화면에 들어오면 카메라를 자동으로 켜며, '아바타로 테스트하기'로 샘플 그림에 색을 입힐 수 있다.
// 같은 스크립트를 세 화면이 쓴다. 화면에 없는 조절 요소(어울리는 컬러, 프리셋, 조제 슬라이더, 추천 버튼)는 건너뛴다.
//  - lip-together.html (body[data-recommend="inline"]): 오른쪽 패널에 제품 추천을 보여 준다
//  - studio.html (body[data-layout="studio"]): 챗봇(chat.js)과 한 화면. 추천은 챗봇이 '추천' 탭에 보여 준다
//  - palette.html (body[data-layout="palette"]): 색은 팔레트(palette.js)가 took:apply 로 보낸다.
//    어울리는 컬러는 바로 입히지 않고, 누르면 팔레트에 한 방울 떨어지도록 took:pick 으로 넘긴다
// 창 이벤트  보냄: took:color { hex, texture } / took:recommend { hex } / took:show-tab { tab }
//                  took:match { season, picks } / took:pick { hex, from } (팔레트 화면)
//            받음: took:apply { hex, finish, quiet, source }
// 파일 구성: lip-state.js(상태·안내) · lip-camera.js(카메라·아바타·그리기) · lip-look.js(색 고르기·어울리는 컬러·추천)
//           이 파일은 화면을 처음 열 때 할 일(이전 선택 되살리기)을 맡는다.
//           lip-look.js 를 lip-camera.js 보다 먼저 불러와야 예전과 같은 순서(카메라 → 색 고르기)로 준비된다.
import { $, store } from './common.js';
import { TEXTURES } from './lip-engine.js';
import { t as tr } from './i18n.js';
import { INLINE, state, setGuide, setPlaceholder } from './lip-state.js';
import { applyLook, showMatchPicks, showInlineRecommend } from './lip-look.js';

// ---------- 시작: 이전 선택 복원 → 카메라 ----------
const savedLook = store.get('lipDisplay') || {};
if (TEXTURES[savedLook.texture]) state.texture = savedLook.texture;
if (Number.isFinite(savedLook.intensity)) state.intensity = savedLook.intensity;
const savedColor = store.get('lipColor');
if (savedColor?.hex) state.hex = savedColor.hex;
const savedMatch = store.get('lipMatch');
if ($('match-result') && savedMatch?.picks?.length) {
  $('match-result').textContent = tr('lip.prevMatch');
  showMatchPicks(savedMatch.picks);
}
applyLook();
setPlaceholder(false, ''); // 테스트 방식 안내 문구는 뺐다 (위 두 버튼으로 고른다)
setGuide('');
// 제품 상세에서 돌아오면 보던 추천 목록을 다시 연다
const savedInline = INLINE && store.get('lipInlineRec');
if (savedInline?.hex) showInlineRecommend(savedInline.hex);
