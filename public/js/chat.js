// 사용자용 AI 뷰티 챗봇: 대화와 다음 질문 버튼, 마이크로 말해서 묻기.
// 넓은 화면은 추천 제품을 오른쪽 패널에 고정하고(대화엔 짧은 목록만), 좁은 화면은 대화 안에 카드로 보여 준다(CSS 로 전환).
// 제품 카드의 '+ 비교'로 비교함에 담고(최대 3개) '비교하기'를 누르면 대화에 비교표를 보여 준다.
// 오른쪽 패널은 추천 목록이 없을 때 '바코드로 제품 알아보기'(카메라 스캔·번호 입력)를 보여 주고, 인식한 제품을 대화로 설명한다.
// 답변은 규칙 기반 엔진(src/lib/chat.js)이 만든다.
// 파일 구성: chat-state.js(상태) · chat-view.js(그리기) · chat-input.js(음성·키보드) · chat-products.js(바코드·NFC)
//           이 파일은 질문 보내기(send)와 버튼 연결, 화면을 처음 열 때 할 일을 맡는다.
import { $, api, store, qs, won, fullName } from './common.js';
import { normalizeHex } from '../lib/color.js';
import { lang as uiLang, t as tr } from './i18n.js';
import { spokenReply } from './voice.js';
import { C, STUDIO, BARCODE_PANEL, showTab, log, input, START, state, base, AB_ID, track, save, loadBase, setBrands } from './chat-state.js';
import { runCompare, renderLog, streamAt, streamReply } from './chat-view.js';
import { speaker } from './chat-input.js';
import { stopScan } from './chat-products.js';

const TYPING_MIN_MS = 700; // 답이 아무리 빨라도 타이핑 표시를 이만큼은 보여 준다

// ---------- 보내기 ----------
export async function send(text) {
  const message = text.trim();
  if (!message || state.typing || streamAt >= 0) return;
  state.messages.push({ role: 'user', text: message });
  state.typing = true;
  renderLog();
  input.value = '';
  const started = performance.now();
  const { ok, body } = await api('api/chat', {
    method: 'POST',
    body: JSON.stringify({
      message, baseProductId: state.baseId, selectedHex: state.selectedHex,
      context: state.ctx, tone: store.get('lipMatch')?.season || null, // 립 컬러 매핑에서 측정한 톤
      lang: uiLang(), // 묻고 답하는 언어
      handoff: store.get('chatHandoff'), // 상담 프롬프트가 기기·매장 결과를 알게
      session: AB_ID, // 말투 다듬기 A/B
    }),
  });
  // 타이핑 표시를 잠깐은 보여 준다 (답이 너무 빨라 깜빡이고 지나가지 않게)
  const wait = ok ? TYPING_MIN_MS - (performance.now() - started) : 0;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  state.typing = false;
  if (!ok) {
    state.messages.push({ role: 'bot', text: C('답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.', "Couldn't get a reply. Please try again shortly.") }); // 오류 내용은 괄호로 덧붙이지 않는다
  } else {
    const newList = JSON.stringify(body.context?.shown || []) !== JSON.stringify(state.ctx?.shown || []);
    state.ctx = body.context || null;
    // 제품 번호는 대화에서 "두 번째 거"처럼 가리킬 수 있게 목록 순서를 따른다
    const shown = state.ctx?.shown || [];
    const products = body.products.map((p, i) => ({ ...p, n: shown.includes(p.id) ? shown.indexOf(p.id) + 1 : i + 1 }));
    // 새 목록이면 패널을 바꾸고, "2번 자세히"처럼 목록을 가리키는 답이면 패널의 그 제품을 강조한다
    if (newList) {
      state.list = products;
      state.focus = [];
      // 새 추천 목록이 오면 패널을 목록으로 바꾼다 (바코드 카메라는 끈다)
      if (products.length) {
        state.panel = 'list';
        stopScan();
        showTab('rec'); // 합본 화면: 추천 탭으로
      }
    } else {
      state.focus = products.map((p) => p.id).filter((id) => state.list.some((x) => x.id === id));
    }
    state.messages.push({ role: 'bot', kind: body.kind || null, text: body.reply, suggestions: body.suggestions || [], products });
    speaker.speak(spokenReply(body));
    if (body.action?.type === 'setBase') {
      state.baseId = body.action.id;
      await loadBase();
    }
    // 못 알아들음 폴백 3단계 (딥리서치 P1): 1~2번째는 챗봇이 무난한 추천과 예시 버튼으로 받고,
    // 연달아 3번째면 한 번 사과하고 매장 직원 안내 + 매장에서 만든 색 카드(직원이 보고 이어서 도울 수 있게). 이모지 없음
    const miss = body.unsure ? (store.get('chatMiss', 0) + 1) : 0;
    store.set('chatMiss', miss);
    if (miss === 3) {
      const h = store.get('chatHandoff');
      state.messages.push({
        role: 'bot',
        text: C('몇 번 제대로 알아듣지 못했네요. 죄송해요. 옆에 있는 매장 직원에게 도움을 요청해 주세요. 아래 예시처럼 짧게 물어보셔도 돼요.', "Sorry, I didn't quite get that a few times. Please ask a staff member nearby. You can also try a short question below."),
        ...(h?.hex ? { swatch: { hex: h.hex, label: C('매장에서 만든 색', 'Your in-store color'), facts: [h.finish && tr('texture.' + h.finish), Number.isFinite(h.intensity) && C(`농도 ${h.intensity}%`, `intensity ${h.intensity}%`)].filter(Boolean).join(' · ') } } : {}),
        suggestions: START.slice(0, 3),
      });
    }
  }
  // 오래된 대화는 앞에서부터 지워 저장 공간을 아낀다
  if (state.messages.length > 60) state.messages = state.messages.slice(-60);
  save();
  await streamReply(state.messages.length - 1);
  renderLog();
}

$('compare-run').addEventListener('click', runCompare);
// 제품 카드에서 올리브영으로 가는 클릭 (A/B 지표)
log.addEventListener('click', (e) => { const a = e.target.closest?.('a[href]'); if (a && /oliveyoung/i.test(a.href)) track('card_click'); });
$('compare-clear').addEventListener('click', () => {
  state.compare = [];
  save();
  renderLog();
});

$('chat-reset').addEventListener('click', () => {
  speaker.stop();
  store.remove('chatMiss');
  state.messages = [];
  state.ctx = null;
  state.list = [];
  state.focus = [];
  save();
  renderLog();
});
$('base-clear').addEventListener('click', async () => {
  state.baseId = null;
  await loadBase();
  renderLog();
});

// 브랜드 목록(음성 후보 고르기용)은 등록 제품 데이터에서 가져온다
api('api/products').then(async ({ ok, body }) => {
  if (!ok) return;
  setBrands([...new Set(body.products.map((p) => p.brand))]);
  // 바코드가 하나도 없는 데이터(올리브영 수집 데이터)면 미리 알려 준다
  const demo = await api('api/demo-products');
  if (!body.products.some((p) => p.barcode) && !demo.body.products?.length) {
    $('scan-note').textContent = C('지금 쓰는 올리브영 상품 데이터에는 바코드 정보가 아직 없어요. 바코드를 찍어도 "등록되지 않은 제품"으로 나오니, 찾는 립을 말로 물어봐 주세요.', 'The current OLIVE YOUNG product data has no barcodes yet, so scans show as "not registered". Please ask for the lip you want instead.');
    $('scan-note').classList.remove('hidden');
  }
});
await loadBase();
// 바코드 검색·제품 상세에서 기준 제품을 가지고 들어온 경우 안내
if (qs('base') && base && !state.messages.some((m) => m.baseNotice === base.id)) {
  state.messages.push({
    role: 'bot', baseNotice: base.id,
    text: C(`기준 제품: ${fullName(base)}. "더 저렴한 거", "비슷한 색", "더 촉촉한 제형"처럼 물어보세요.`, `Base product: ${fullName(base)}. Try asking "something cheaper", "similar colors" or "a glossier finish".`),
    suggestions: C(['더 저렴한 제품 추천해 줘', '비슷한 색상 찾아 줘', '더 글로시한 제품 추천해 줘', '이 제품 가격 얼마야?'], ['Something cheaper', 'Find similar colors', 'Something glossier', 'How much is this product?']),
  });
  save();
}
// 매장 팔레트의 '챗봇과 이어서 상담'으로 가져온 결과 (palette.js openTake): 그 결과로 대화를 시작한다.
//   ?from=palette&hex=색&fin=텍스처&int=농도&tone=내 톤&recs=추천 제품 ID 들
//   색은 이후 질문의 기준 색(selectedHex), 톤은 추천에 쓰는 내 톤(lipMatch)으로 쓴다. 같은 결과로 다시 열면 인사는 한 번만
const TEXTURE_KEYS = ['matte', 'satin', 'glossy', 'sheer', 'shimmer'];
const SEASON_KEYS = ['spring', 'summer', 'autumn', 'winter'];
async function paletteHandoff() {
  const hex = normalizeHex(qs('hex') || '');
  if (qs('from') !== 'palette' || !hex) return;
  const fin = TEXTURE_KEYS.includes(qs('fin')) ? qs('fin') : null;
  const n = Math.round(Number(qs('int')));
  const strength = Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
  const tone = SEASON_KEYS.includes(qs('tone')) ? qs('tone') : null;
  const ids = (qs('recs') || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 3);
  const key = [hex, fin, strength, tone, ids.join(',')].join('|');
  state.selectedHex = hex;
  store.set('chatHandoff', { hex, finish: fin, intensity: strength, tone });
  if (tone) store.set('lipMatch', { ...(store.get('lipMatch') || {}), season: tone });
  if (state.messages.some((m) => m.handoff === key)) return;
  const found = await Promise.all(ids.map((id) => api('api/products/' + encodeURIComponent(id)).catch(() => null)));
  const products = found.filter((r) => r?.ok && r.body.product).map((r, i) => ({ ...r.body.product, n: i + 1 }));
  // 색상값(#A0202C)은 손님에게 뜻이 없어 글에서 빼고, 말풍선 위 색 견본 카드로 보여 준다 (딥리서치 P0)
  const facts = [fin && tr('texture.' + fin), strength !== null && C(`농도 ${strength}%`, `intensity ${strength}%`), tone && C(`${tr('season.' + tone)} (추정)`, `${tr('season.' + tone)} (estimate)`)].filter(Boolean).join(' · ');
  // 첫인사 (상담 프롬프트 src/lib/llm/agent.js 와 같은 성격): 인사·AI 도우미 소개 → 가져온 결과 → 할 수 있는 것 → 한계 고지. 아래 바로답변 3개
  // 한 문장에 한 가지 말만, 짧게 (화면에서는 문장마다 줄이 바뀐다). 버튼 안내('아래 버튼을 누르거나…')는 버튼이 보이니 뺐다
  const text = C('안녕하세요, 립 색을 같이 찾아 드리는 AI 도우미 툭이에요. 매장에서 만든 색을 가져왔어요.', "Hi, I'm Took, an AI assistant that helps you find lip colors. I brought over the color you made in store.")
    + (products.length
      ? C(' 매장에서 추천받은 제품도 아래에 담았어요.', ' Your in-store picks are below.')
      : C(' 이 색과 비슷한 립을 같이 찾아볼까요?', ' Shall we find lips close to this color?'))
    + C(' 화면 속 색은 실제 발색과 조금 다를 수 있어요.', ' On-screen colors may look a little different in real life.');
  if (products.length) {
    state.list = products;
    state.focus = [];
    state.panel = 'list';
  }
  state.messages.push({
    role: 'bot', handoff: key, text, products,
    swatch: { hex, label: C('매장에서 만든 색', 'Your in-store color'), facts },
    // 바로답변: 규칙 챗봇이 알아듣는 짧은 말 (한/영 모두 확인)
    suggestions: C(['이 색이랑 비슷한 립', '더 밝은 색', '더 촉촉하게', '2만원 이하로'], ['Recommend products similar to this color', 'Lighter than this color', 'Glossy in this color', 'This color under 20,000 won']),
  });
  save();
}
await paletteHandoff();
if (!BARCODE_PANEL) {
  $('scan-open')?.remove(); // 좁은 화면의 바코드 버튼
  $('rec-panel').setAttribute('aria-label', C('추천 제품', 'Recommended products'));
}
renderLog();

// 합본 화면: 립 매핑에서 고른 색을 챗봇의 기준 색으로 쓰고, '이 컬러로 제품 추천'을 챗봇 질문으로 처리한다
if (STUDIO) {
  if (window.tookLipHex) state.selectedHex = window.tookLipHex; // 립 매핑이 먼저 로드된 경우
  window.addEventListener('took:color', (e) => { state.selectedHex = e.detail.hex; });
  window.addEventListener('took:recommend', (e) => {
    state.selectedHex = e.detail.hex;
    send(C('지금 고른 색과 비슷한 제품 추천해 줘', 'Recommend products similar to my chosen color'));
  });
}
// 스캐너가 없을 때: 접으면 PC 카메라를 끈다 (휴대폰 QR 연결은 2026-11-13 삭제)
$('scan-alt')?.addEventListener('toggle', (e) => {
  if (!e.target.open) stopScan();
});
