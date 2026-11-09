// 챗봇 시작 화면 (손님 휴대폰 전용): 휴대폰 챗봇의 왼쪽 위 로고를 누르면 오는 화면. 챗봇의 시작을 알리는 간단한 화면:
//  - 챗봇 동그라미(옛 홈의 챗봇 쪽): 예시 대화에서 질문이 한 글자씩 타이핑된다 (실제 대화 아님)
//  - 제목 한 줄 + 설명 한 줄
//  - 매장에서 만든 색(QR 로 가져온 결과가 있을 때): 색 견본(실제 색) + 제형·농도·톤 한 줄
//  - 버튼 하나: 대화가 있으면 '대화 이어가기', 매장 결과만 있으면 그 색으로 상담 시작, 둘 다 없으면 '대화 시작하기'
//  - 작게: 결과 저장·공유 / 이 기기에서 대화 지우기
// 이 휴대폰에 저장된 상담 상태(common.js store → tookPhone.*)만 읽는다. 서버에 따로 저장하지 않는다.
import { renderNav, PHONE, store, el, toast } from './common.js';
import { isEn, t as tr } from './i18n.js';

// 매장 태블릿은 팔레트만 쓴다 (챗봇은 손님 휴대폰에서만)
if (!PHONE) location.replace('palette.html');

const C = (ko, en) => (isEn() ? en : ko);
document.title = C('took(툭) - AI 뷰티 챗봇', 'took - AI beauty chat');
renderNav();

const $ = (id) => document.getElementById(id);
const home = $('ph-home');
const handoff = store.get('chatHandoff');
const talked = store.get('chatUserMessages', []).some((m) => m.role === 'user');
const season = store.get('lipMatch')?.season || handoff?.tone || null;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// 버튼이 가는 곳: 대화가 있으면 이어서, 매장 결과만 있으면 그 색으로 바로 상담, 없으면 새 대화
const startHref = talked || !handoff?.hex ? 'chat.html' : 'chat.html?q=' + encodeURIComponent(C('이 색과 비슷한 제품 추천해 줘', 'Recommend products similar to this color'));
const startText = talked ? C('대화 이어가기', 'Continue the chat') : C('대화 시작하기', 'Start chatting');

// 챗봇 동그라미 (누르면 버튼과 같은 곳)
const circle = el('a', { class: 'ph-circle', href: startHref, 'aria-hidden': 'true', tabindex: '-1' });
circle.innerHTML = '<span class="mirror chat-demo"><span class="cd-msgs">'
  + '<span class="cd-bubble bot" id="cd-bot"></span>'
  + '<span class="cd-bubble me"><span id="chat-demo-text"></span><i class="cd-caret"></i></span>'
  + '<span class="cd-bubble bot typing"><i></i><i></i><i></i></span></span></span>';

const parts = [
  circle,
  el('p', { class: 'ph-eyebrow', text: C('took AI 도우미', 'took AI assistant') }),
  el('h1', { text: C('툭에게 물어보세요', 'Ask Took') }),
  el('p', { class: 'ph-sub', text: handoff?.hex
    ? C('매장에서 만든 색으로 어울리는 립을 같이 찾아 드려요.', 'I’ll help you find lips for the color you made in store.')
    : C('찾는 색, 바를 자리, 입술 고민을 편하게 말해 주세요.', 'Tell me the color, occasion or lip concern you have in mind.') }),
];
if (handoff?.hex) {
  const swatch = el('span', { class: 'ph-swatch', 'aria-hidden': 'true' });
  swatch.style.background = handoff.hex; // 색 견본은 실제 색 (CLAUDE.md 예외)
  const facts = [
    handoff.finish && tr('texture.' + handoff.finish),
    Number.isFinite(handoff.intensity) && C(`농도 ${handoff.intensity}%`, `${handoff.intensity}%`),
    season && tr('season.' + season),
  ].filter(Boolean).join(' · ');
  parts.push(el('div', { class: 'ph-color', role: 'group', 'aria-label': C('매장에서 만든 색', 'Your in-store color') }, swatch,
    el('span', { class: 'ph-color-text' }, el('span', { class: 'ph-color-label', text: C('매장에서 만든 색', 'Your in-store color') }), el('strong', { text: facts || handoff.hex }))));
}
parts.push(el('a', { class: 'ph-primary', href: startHref }, el('span', { text: startText }), el('span', { class: 'ph-arrow', 'aria-hidden': 'true', text: '→' })));
home.append(el('section', { class: 'ph-start' }, ...parts));

$('cd-bot').textContent = handoff?.hex ? C('매장에서 만든 색으로 이어서 볼까요?', 'Shall we keep going with your color?') : C('찾는 립 컬러를 편하게 말씀해 주세요', 'Tell me the lip color you want');
const DEMO_Q = handoff?.hex
  ? C(['조금 더 밝은 색 있어?', '2만원 이하로 보여 줘', '더 촉촉한 제형은?'], ['Anything a bit lighter?', 'Under 20,000 won?', 'Something glossier?'])
  : C(['데이트 립 추천해 줘', '데일리로 바를 립', '혈색 도는 립 찾아 줘'], ['A lip for a date', 'An everyday lip', 'Something with a healthy flush']);
const demo = $('chat-demo-text');
demo.textContent = DEMO_Q[0];
if (!reduce) {
  (async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let qi = 0; ; qi = (qi + 1) % DEMO_Q.length) {
      await wait(2600);
      const q = DEMO_Q[(qi + 1) % DEMO_Q.length];
      for (let n = 1; n <= q.length; n++) { demo.textContent = q.slice(0, n); await wait(70); }
    }
  })();
}

// 작게: 결과 저장·공유 (공유 시트 → 안 되면 링크 복사) / 이 기기에서 대화 지우기
const shareUrl = store.get('chatHandoffUrl');
const tools = el('div', { class: 'ph-tools' });
if (shareUrl) {
  tools.append(el('button', {
    type: 'button', class: 'ph-link', text: C('결과 저장·공유', 'Save or share'),
    onclick: async () => {
      const data = { title: C('took 립 컬러 결과', 'My took lip color'), text: C('매장에서 만든 립 색과 추천 제품이에요.', 'My lip color from the store and picks.'), url: shareUrl };
      try {
        if (navigator.share) { await navigator.share(data); return; }
      } catch (err) { if (err?.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(shareUrl); toast(C('링크를 복사했어요. 북마크해 두면 언제든 이어서 볼 수 있어요.', 'Link copied. Bookmark it to come back anytime.')); }
      catch { prompt(C('이 링크를 복사해 두세요', 'Copy this link'), shareUrl); }
    },
  }));
}
if (handoff || talked) {
  tools.append(el('button', {
    type: 'button', class: 'ph-link', text: C('이 기기에서 대화 지우기', 'Delete chat from this device'),
    onclick: () => {
      if (!confirm(C('이 휴대폰에 저장된 대화와 매장 결과를 모두 지울까요? 되돌릴 수 없어요.', 'Delete the chat and in-store result saved on this phone? This cannot be undone.'))) return;
      store.clear();
      try { localStorage.removeItem('tookPhone.savedAt'); } catch { /* 없음 */ }
      location.replace('chat-home.html');
    },
  }));
}
if (tools.children.length) home.append(tools);
