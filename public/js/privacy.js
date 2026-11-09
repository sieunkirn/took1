// 개인정보 안내 (한/영). 지금 코드가 실제로 하는 일만 적는다 (CLAUDE.md: 실제 구현과 시뮬레이션 구분).
// 생성형 AI 사용 여부는 서버에 물어본다(/api/ab-stats 의 llm). 서버 없는 정적 버전은 브라우저 안에서 규칙으로만 답한다.
import { renderNav, el, api, STATIC } from './common.js';
import { isEn } from './i18n.js';

const C = (ko, en) => (isEn() ? en : ko);
document.title = C('took(툭) - 개인정보 안내', 'took - Privacy');
renderNav();

const doc = document.getElementById('pv-doc');
const sec = (title, ...items) => el('section', { class: 'pv-sec' }, el('h2', { text: title }), ...items);
const row = (k, v) => el('div', { class: 'pv-row' }, el('dt', { text: k }), el('dd', { text: v }));

doc.append(
  el('h1', { text: C('개인정보 안내', 'Privacy notice') }),
  el('p', { class: 'pv-lead', text: C('took 은 립 색을 고르는 데 필요한 것만 쓰고, 사진·영상과 이름·연락처는 받지 않아요.', 'took only uses what it needs to help you pick a lip color. We never keep photos or video, and we never ask for your name or contact details.') }),
  sec(C('한눈에', 'At a glance'),
    el('ul', { class: 'pv-points' },
      el('li', { text: C('카메라 영상은 저장하거나 보내지 않아요.', 'Camera video is never saved or sent.') }),
      el('li', { text: C('계정·이름·연락처를 받지 않아요.', 'No account, name or contact details.') }),
      el('li', { text: C('QR 에는 색 정보만 담겨요.', 'The QR code carries only color details.') }),
      el('li', { text: C('휴대폰 대화는 이 휴대폰에만 30일 보관돼요.', 'Your phone chat stays only on this phone for 30 days.') }))),
  sec(C('무엇을 어떻게 처리하나요', 'What we process and how'),
    el('dl', { class: 'pv-list' },
      row(C('카메라 영상 (매장 태블릿)', 'Camera video (store tablet)'), C('입술 위치와 볼·이마의 밝기를 그 자리에서 계산해 색을 입혀 보여 줘요. 영상과 사진은 저장하지도, 어디로 보내지도 않아요. 카메라는 버튼을 눌러야 켜져요.', 'We calculate lip position and cheek/forehead brightness on the spot to show the color. Video and photos are never stored or sent anywhere. The camera starts only when you tap the button.')),
      row(C('퍼스널 톤 결과', 'Personal tone result'), C('카메라로 추정한 참고값이에요(진단이 아니에요). 태블릿 화면에만 잠시 있고, 자동 초기화 때 지워져요.', 'An estimate from the camera, not a diagnosis. It stays briefly on the tablet screen and is cleared on auto-reset.')),
      row(C('QR 링크', 'QR link'), C('색상값·제형·농도·톤·추천 제품 번호만 담겨요. 주소의 # 뒤에 담겨 서버로 전송되지 않아요.', 'Only the color value, finish, intensity, tone and recommended product numbers. They sit after the # in the address, which is never sent to the server.')),
      row(C('휴대폰 대화', 'Phone chat'), C('이 휴대폰 브라우저에만 저장돼요. 30일이 지나면 지워지고, 챗봇 홈의 "이 기기에서 대화 지우기"로 바로 지울 수 있어요.', 'Saved only in this phone’s browser. It is deleted after 30 days, and you can delete it anytime with "Delete chat from this device" on the chat home.')),
      row(C('질문 문장', 'Your questions'), C('답을 만들려고 took 서버로 보내요. took 은 질문 문장을 기록하지 않아요. 다만 서버를 운영하는 호스팅 업체는 접속 기록(주소·시간)을 남길 수 있어요.', 'Sent to the took server to make an answer. took does not log your questions, but the hosting provider may keep standard access logs (address and time).')),
      row(C('생성형 AI', 'Generative AI'), C('확인 중…', 'Checking…')))),
  sec(C('AI 도우미 안내', 'About the AI assistant'),
    el('p', { text: C('챗봇 "툭"은 사람이 아닌 AI 도우미예요. 등록된 제품 정보로만 답하고, 화면 속 색은 실제 발색과 조금 다를 수 있어요. 건강·성분은 판단하지 않으니 피부과나 약사와 상담해 주세요.', 'The chatbot "Took" is an AI assistant, not a person. It answers only from registered product data, and on-screen colors may look different in real life. It does not judge health or ingredients, so please consult a dermatologist or pharmacist.') })),
  sec(C('만 14세 미만', 'Under 14'),
    el('p', { text: C('만 14세 미만은 보호자와 함께 이용해 주세요.', 'If you are under 14, please use this with a parent or guardian.') })),
  sec(C('문의', 'Contact'),
    el('p', { text: C('매장에서는 직원에게 문의해 주세요. 운영자 연락처는 준비 중이에요.', 'In the store, please ask a staff member. An operator contact will be added soon.') })),
  el('p', { class: 'pv-draft', text: C('이 안내는 시범 운영용 초안이며, 법률 검토 전입니다. (2026-11-09)', 'This notice is a pilot draft and has not yet been legally reviewed. (2026-11-09)') }),
  el('p', {}, el('a', { href: 'javascript:history.back()', text: C('← 돌아가기', '← Back') })),
);

// 생성형 AI 사용 여부: 서버에 묻는다 (정적 버전은 서버가 없어 규칙만)
const aiRow = doc.querySelectorAll('.pv-row dd')[5];
(async () => {
  if (STATIC) { aiRow.textContent = C('쓰지 않아요. 이 버전은 정해진 규칙으로만 답해요.', 'Not used. This version answers with set rules only.'); return; }
  const r = await api('api/ab-stats').catch(() => null);
  aiRow.textContent = r?.ok && r.body.llm
    ? C('규칙으로 알아듣지 못한 질문과 일부 답의 말투 다듬기에 생성형 AI 를 써요. 이때 질문 문장(개인정보가 보이는 말은 제외)이 AI 제공 업체로 전송되며, 그 업체의 서버는 해외에 있을 수 있어요.', 'Generative AI is used for questions the rules don’t understand and to polish the tone of some answers. In that case your question (except messages containing personal details) is sent to the AI provider, whose servers may be outside Korea.')
    : C('지금은 쓰지 않아요. 정해진 규칙으로만 답해요.', 'Not used right now. Answers come from set rules only.');
})();
