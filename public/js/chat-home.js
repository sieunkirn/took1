// 챗봇 홈 (손님 휴대폰 전용): 휴대폰 챗봇의 왼쪽 위 로고를 누르면 오는 화면. 한눈에 보이게 요소를 적게:
//  ① 인사 한 줄
//  ② 매장에서 만든 색 카드(있을 때): 색 견본(실제 색) + 제형·농도·톤 + 버튼 하나(대화가 있으면 '대화 이어가기', 없으면 '이 색으로 상담 시작')
//  ③ 바로 물어보기 칩 3개 (누르면 챗봇이 그 질문으로 바로 답한다: chat.html?q=…)
//  아래 고정 입력줄: 누르면 챗봇 입력칸으로 (chat.html?focus=1). 맨 아래 한 줄 고지
// 이 휴대폰에 저장된 상담 상태(common.js store → tookPhone.*)만 읽는다. 서버에 따로 저장하지 않는다.
import { renderNav, PHONE, store, el, toast } from './common.js';
import { isEn, t as tr } from './i18n.js';

// 매장 태블릿은 팔레트만 쓴다 (챗봇은 손님 휴대폰에서만)
if (!PHONE) location.replace('palette.html');

const C = (ko, en) => (isEn() ? en : ko);
document.title = C('took(툭) - 챗봇 홈', 'took - Chat home');
renderNav();

const $ = (id) => document.getElementById(id);
const home = $('ph-home');
const handoff = store.get('chatHandoff');
const talked = store.get('chatUserMessages', []).some((m) => m.role === 'user');
const season = store.get('lipMatch')?.season || handoff?.tone || null;
const chat = (q) => 'chat.html?q=' + encodeURIComponent(q);

// ① 인사
home.append(el('header', { class: 'ph-hello' },
  el('p', { class: 'ph-eyebrow', text: C('took AI 도우미', 'took AI assistant') }),
  el('h1', { text: handoff?.hex ? C('고른 색으로 이어서 볼까요?', 'Shall we keep going with your color?') : C('어떤 립을 찾아볼까요?', 'What lip are you looking for?') })));

// ② 매장에서 만든 색
if (handoff?.hex) {
  const swatch = el('span', { class: 'ph-swatch', 'aria-hidden': 'true' });
  swatch.style.background = handoff.hex; // 색 견본은 실제 색 (CLAUDE.md 예외)
  const facts = [
    handoff.finish && tr('texture.' + handoff.finish),
    Number.isFinite(handoff.intensity) && C(`농도 ${handoff.intensity}%`, `${handoff.intensity}%`),
    season && tr('season.' + season),
  ].filter(Boolean).join(' · ');
  home.append(el('section', { class: 'ph-card', 'aria-label': C('매장에서 만든 색', 'Your in-store color') },
    el('div', { class: 'ph-card-row' }, swatch,
      el('div', { class: 'ph-card-text' },
        el('span', { class: 'ph-card-label', text: C('매장에서 만든 색', 'Your in-store color') }),
        el('strong', { class: 'ph-card-facts', text: facts || handoff.hex }))),
    el('a', { class: 'ph-primary', href: talked ? 'chat.html' : chat(C('이 색과 비슷한 제품 추천해 줘', 'Recommend products similar to this color')) },
      el('span', { text: talked ? C('대화 이어가기', 'Continue the chat') : C('이 색으로 상담 시작', 'Start with this color') }),
      el('span', { class: 'ph-arrow', 'aria-hidden': 'true', text: '→' }))));
} else if (talked) {
  home.append(el('a', { class: 'ph-primary', href: 'chat.html' },
    el('span', { text: C('대화 이어가기', 'Continue the chat') }), el('span', { class: 'ph-arrow', 'aria-hidden': 'true', text: '→' })));
}

// ③ 바로 물어보기 (3개)
const QUESTIONS = handoff?.hex
  ? C(['조금 더 밝은 색', '2만원 이하로', '더 촉촉한 제형'], ['A bit lighter', 'Under 20,000 won', 'Glossier finish'])
  : C(['데일리 립 추천', '데이트 립 추천', '혈색 도는 립'], ['Everyday lip', 'Lip for a date', 'A healthy flush']);
// 칩 글자는 짧게, 챗봇에는 뜻이 분명한 문장으로 보낸다
const SENT = handoff?.hex
  ? C(['이 색보다 조금 더 밝은 거 추천해 줘', '이 색으로 2만원 이하 추천해 줘', '이 색인데 더 촉촉한 제형 추천해 줘'], ['Something a bit lighter than this color', 'This color under 20,000 won', 'This color but glossier'])
  : C(['데일리로 바를 립 추천해 줘', '데이트 립 추천해 줘', '혈색 도는 립 찾아 줘'], ['Recommend an everyday lip', 'Recommend a lip for a date', 'Find a lip that adds a healthy flush']);
home.append(el('section', { class: 'ph-quick', 'aria-label': C('바로 물어보기', 'Quick questions') },
  el('h2', { class: 'ph-label', text: C('바로 물어보기', 'Quick questions') }),
  el('div', { class: 'ph-chips' }, ...QUESTIONS.map((q, i) => el('a', { class: 'ph-chip', href: chat(SENT[i]), text: q })))));

// 결과 저장·지우기 (작게): 공유 시트(카카오톡·메시지 등) → 안 되면 링크 복사 / 이 기기에 저장된 대화 지우기
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

// 한 줄 고지 (AI 도우미·화면 색·사진 미저장·이 기기에만 저장·개인정보 안내)
home.append(el('p', { class: 'ph-foot' },
  el('span', { text: C('AI 도우미가 등록된 제품으로만 답해요 · 화면 속 색은 실제와 조금 다를 수 있어요 · 사진은 저장하지 않고, 대화는 이 휴대폰에만 30일 보관돼요 · ', 'An AI assistant answering from registered products only · On-screen colors may differ · No photos are saved; the chat stays on this phone for 30 days · ') }),
  el('a', { href: 'privacy.html', text: C('개인정보 안내', 'Privacy') })));

$('ph-askbar-text').textContent = C('궁금한 걸 물어보세요', 'Ask me anything');
$('ph-askbar').setAttribute('aria-label', C('챗봇에게 물어보기', 'Ask the chatbot'));
