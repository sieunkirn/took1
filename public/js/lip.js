// 거울(palette.html)의 립 컬러 매핑 카메라: 입술 추적 → 고른 색 합성. 화면에 들어오면 카메라를 자동으로 켠다.
// 창 이벤트  보냄: took:color { hex, texture }   받음: took:apply { hex, finish, quiet, source } (palette.js)
// 파일 구성: lip-state.js(상태·안내) · lip-camera.js(카메라·그리기) · lip-look.js(텍스처·농도)
//           이 파일은 화면을 처음 열 때 할 일(이전 텍스처·농도 되살리기)을 맡는다.
//           lip-look.js 를 lip-camera.js 보다 먼저 불러와야 예전과 같은 순서(카메라 → 색 고르기)로 준비된다.
import { $, store } from './common.js';
import { TEXTURES } from './lip-engine.js';
import { state, setGuide, setPlaceholder } from './lip-state.js';
import { applyLook } from './lip-look.js';

// ---------- 시작: 이전 선택 복원 → 카메라 ----------
const savedLook = store.get('lipDisplay') || {};
if (TEXTURES[savedLook.texture]) state.texture = savedLook.texture;
if (Number.isFinite(savedLook.intensity)) state.intensity = savedLook.intensity;
applyLook();
setPlaceholder(false, ''); // 테스트 방식 안내 문구는 뺐다 (위 두 버튼으로 고른다)
setGuide('');

