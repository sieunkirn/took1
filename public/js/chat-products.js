// 챗봇 화면: 제품을 직접 가져와 묻기 = NFC 태그 (외부 리더기, js/nfc.js).
// 카메라 바코드 읽기(바코드 버튼·비추기 창·사진·번호 입력 패널)는 2026-11-20 사용자 요청으로 뺐다.
// 숫자만 치는 USB 바코드 스캐너는 NFC 리더기와 같은 길(listenNfc → findTagProduct, 포장 바코드 번호로 호수까지 찾음)로 그대로 된다
import { $, api, won, fullName, shortName } from './common.js';
import { isEn, finishText as finishName } from './i18n.js';
import { listenNfc, findTagProduct, createNfcHint } from './nfc.js';
import { C, START, state, save, loadBase } from './chat-state.js';
import { renderLog, streamReply } from './chat-view.js';
import { speaker } from './chat-input.js';

// 태그한 제품을 기준 제품으로 정하고, 대화에 제품 설명과 이어서 물어볼 질문을 띄운다. 말할 문장을 돌려준다
async function describeProduct(p) {
  state.baseId = p.id;
  await loadBase();
  const text = [`${fullName(p)} · ${p.finish ? `${finishName(p.finish)} · ` : ''}${won(p.price)}.`, isEn() ? '' : p.description,
    C('이 제품을 기준으로 비슷한 색·더 저렴한 제품을 찾을 수 있어요.', 'I can find similar colors or cheaper products based on this one.')].filter(Boolean).join(' ');
  state.messages.push({
    role: 'bot', text, products: [p],
    suggestions: C(['비슷한 색상 찾아 줘', '더 저렴한 제품 추천해 줘', '더 글로시한 제품 추천해 줘', '제품 정보 알려 줘'], ['Find similar colors', 'Something cheaper', 'Something glossier', 'Tell me about this product']),
  });
  return text;
}

// 제품에 붙은 태그를 리더기에 톡 올리면 그 제품을 설명하고 기준 제품으로 정한다
const nfcHint = $('nfc-hint');
const NFC_IDLE = C('립 제품을 리더기에 올려 보세요.', 'Place a lip product on the reader.');
const nfcFlash = createNfcHint(nfcHint, { idleText: NFC_IDLE, ms: 2500 });
async function handleTag(raw) {
  speaker.stop();
  state.messages.push({ role: 'user', text: C('제품을 리더기에 올렸어요', 'Tapped a product on the reader') });
  const p = await findTagProduct(raw, api); // 태그 표·제품 ID·바코드 번호(호수까지) 순서로 찾는다
  let text;
  if (p) {
    nfcFlash(C(`읽었어요 · ${shortName(p)}`, `Read · ${shortName(p)}`));
    text = await describeProduct(p);
  } else {
    nfcFlash(C('등록되지 않은 태그예요', 'Unregistered tag'));
    text = C(`등록되지 않은 태그예요. 다른 제품을 올리거나 찾는 립을 말로 알려 주세요.`, `This tag isn't registered. Tap another product or tell me what lip you're looking for.`);
    state.messages.push({ role: 'bot', text, suggestions: START });
  }
  speaker.speak(text);
  save();
  await streamReply(state.messages.length - 1);
  renderLog();
}
if (nfcHint) nfcHint.textContent = NFC_IDLE;
listenNfc(handleTag);
