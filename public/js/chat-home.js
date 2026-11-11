// 챗봇 시작 화면 (손님 휴대폰 전용): 휴대폰 챗봇의 왼쪽 위 로고를 누르면 오는 화면. ChatGPT·Gemini 시작 화면처럼 (2026-11-11):
//  - 가운데: 작은 인사 + 큰 질문 한 줄
//  - 매장에서 만든 색(QR 로 가져온 결과가 있을 때): 색 견본(실제 색) + 제형·농도·톤 한 줄, 누르면 그 색으로 상담
//  - 이전 대화가 있으면 '이전 대화 이어가기'
//  - 아래쪽: 추천 질문 카드 4개 (누르면 그 질문으로 대화 시작)
//  - 맨 아래 고정 입력줄: 마이크 · 입력칸 · 보내기. 보내면 chat.html?q= 로 넘어가 바로 질문한다
//  - 작게: 결과 저장·공유 / 이 기기에서 대화 지우기
// 이 휴대폰에 저장된 상담 상태(common.js store → tookPhone.*)만 읽는다. 서버에 따로 저장하지 않는다.
import { renderNav, PHONE, store, el, toast, api } from './common.js';
import { isEn, t as tr } from './i18n.js';
import { setupVoiceInput, speechApi } from './voice.js';

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

// 질문 하나를 들고 챗봇으로 (chat.js 가 ?q= 를 받아 바로 보낸다)
const askHref = (q) => 'chat.html?q=' + encodeURIComponent(q.trim().slice(0, 200));
const ask = (q) => { if (q.trim()) location.href = askHref(q); };

// ---------- 가운데 인사 ----------
const parts = [el('div', { class: 'ph-greet' },
  el('h1', {},
    el('span', { class: 'ph-hi', text: C('안녕하세요', 'Hi there') }),
    el('span', { text: handoff?.hex ? C('매장에서 만든 색, 이어서 볼까요?', 'Shall we keep going with your color?') : C('어떤 립을 찾고 있어요?', 'What lip are you looking for?') })))];

// 매장에서 만든 색: 누르면 그 색과 비슷한 제품으로 상담 (이미 대화했으면 그 대화로)
if (handoff?.hex) {
  const swatch = el('span', { class: 'ph-swatch', 'aria-hidden': 'true' });
  swatch.style.background = handoff.hex; // 색 견본은 실제 색 (CLAUDE.md 예외)
  const facts = [
    handoff.finish && tr('texture.' + handoff.finish),
    Number.isFinite(handoff.intensity) && C(`농도 ${handoff.intensity}%`, `${handoff.intensity}%`),
    season && tr('season.' + season),
  ].filter(Boolean).join(' · ');
  parts.push(el('a', { class: 'ph-row', href: talked ? 'chat.html' : askHref(C('이 색과 비슷한 제품 추천해 줘', 'Recommend products similar to this color')) },
    swatch,
    el('span', { class: 'ph-row-text' }, el('span', { class: 'ph-row-label', text: C('매장에서 만든 색', 'Your in-store color') }), el('strong', { text: facts || handoff.hex })),
    el('span', { class: 'ph-arrow', 'aria-hidden': 'true', text: '→' })));
}
if (talked) {
  parts.push(el('a', { class: 'ph-row', href: 'chat.html' },
    el('span', { class: 'ph-row-text' }, el('span', { class: 'ph-row-label', text: C('이 휴대폰에 저장된 대화', 'Saved on this phone') }), el('strong', { text: C('이전 대화 이어가기', 'Continue your chat') })),
    el('span', { class: 'ph-arrow', 'aria-hidden': 'true', text: '→' })));
}

// ---------- 추천 질문 카드: [제목, 설명, 실제로 보낼 질문] ----------
const SUGGEST = handoff?.hex
  ? C([
    ['비슷한 색 더 보기', '이 색과 가까운 제품', '이 색과 비슷한 제품 추천해 줘'],
    ['조금 더 밝게', '이 색보다 밝은 색', '이 색보다 밝은 색'],
    ['더 촉촉하게', '이 색으로 촉촉한 제형', '이 색으로 더 촉촉하게'],
    ['2만원 이하', '이 색으로 가격 낮게', '이 색으로 2만원 이하'],
  ], [
    ['More like this', 'Products close to this color', 'Recommend products similar to this color'],
    ['A bit lighter', 'Lighter than this color', 'Lighter than this color'],
    ['Glossier', 'This color, more moist', 'Glossy in this color'],
    ['Under 20,000 won', 'This color, lower price', 'This color under 20,000 won'],
  ])
  : C([
    ['데일리 립', '매일 바르기 좋은 색', '데일리로 바를 립 추천해 줘'],
    ['데이트 립', '분위기 있는 색으로', '데이트 립 추천해 줘'],
    ['건조한 입술', '촉촉한 제형 찾기', '입술이 건조한데 뭐가 좋아?'],
    ['2만원 이하', '글로시한 코랄로', '2만원 이하 글로시한 코랄 추천해 줘'],
  ], [
    ['Everyday lip', 'An easy daily color', 'Recommend an everyday lip'],
    ['Date lip', 'Something with a mood', 'Recommend a lip for a date'],
    ['Dry lips', 'Find a moist finish', 'My lips are dry. What should I use?'],
    ['Under 20,000 won', 'A glossy coral', 'A glossy coral under 20,000 won'],
  ]);
parts.push(el('div', { class: 'ph-sugs', role: 'group', 'aria-label': C('추천 질문', 'Suggested questions') },
  ...SUGGEST.map(([title, sub, q]) => el('button', { type: 'button', class: 'ph-sug', onclick: () => ask(q) },
    el('strong', { text: title }), el('span', { text: sub })))));

home.append(el('section', { class: 'ph-start' }, ...parts));

// ---------- 작게: 결과 저장·공유 (공유 시트 → 안 되면 링크 복사) / 이 기기에서 대화 지우기 ----------
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

// ---------- 맨 아래 고정 입력줄 (chat.html 입력줄과 같은 모양) ----------
const input = el('input', { type: 'text', id: 'chat-input', autocomplete: 'off', enterkeyhint: 'send', placeholder: C('툭에게 물어보기', 'Ask Took'), 'aria-label': C('질문 입력', 'Your question') });
const send = el('button', { type: 'submit', id: 'chat-send', class: 'icon-btn', 'aria-label': C('보내기', 'Send'), title: C('보내기', 'Send') });
send.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
const status = el('p', { class: 'ph-voice-status', 'aria-live': 'polite' });
const form = el('form', { class: 'chat-input', autocomplete: 'off' }, input, send);
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value.trim()) ask(input.value);
  else input.focus(); // 빈 칸이면 보내지 않고 입력칸으로
});
// 마이크: 이 브라우저가 음성 인식을 지원할 때만 (chat.html 과 같은 규칙). 들은 말로 바로 질문한다
if (speechApi()) {
  const mic = el('button', { type: 'button', id: 'voice', class: 'icon-btn', 'aria-pressed': 'false', 'aria-label': C('말로 질문하기', 'Ask by voice'), title: C('말로 질문하기', 'Ask by voice') });
  mic.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>';
  form.prepend(mic);
  let brands = [];
  api('api/products').then(({ ok, body }) => { if (ok) brands = [...new Set(body.products.map((p) => p.brand))]; });
  setupVoiceInput({
    button: mic, input, status, getBrands: () => brands,
    onText: (text) => ask(text),
    onListening: (on) => mic.classList.toggle('listening', on),
  });
} else {
  input.placeholder = C('툭에게 물어보기 (키보드 마이크로 말해도 돼요)', 'Ask Took (or use your keyboard mic)');
}
document.body.append(el('div', { class: 'ph-composer' }, status, form));
