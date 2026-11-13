// 음성 인식 정확도 측정 (voice-test.html, 테스트용).
// 챗봇과 같은 듣기(listenOnce)·보정(normalizeForChat)을 거쳐, 읽을 문장과 들은 말을 비교한다.
// - 글자 정확도: 띄어쓰기·문장부호를 뺀 글자 기준 1 - (편집 거리 / 읽을 문장 글자 수). 보정 전(인식 그대로)과 보정 후를 따로 잰다
// - 뜻 일치: 읽을 문장과 들은 말을 각각 챗봇이 해석한 조건(제형·색·브랜드·가격·상황 등)이 같은가
// 결과는 이 기기의 브라우저에만 저장되고(localStorage), 내려받기로 파일을 만든다.
import { $, renderNav, api, el } from './common.js';
import { listenOnce, speechApi, voiceErrorMessage } from './voice.js';
import { parseMessage, normalizeForChat } from '../lib/chat.js';
import { editDistance } from '../lib/spoken.js';

renderNav();

// 기본으로 읽을 문장: 브랜드·제형·가격·상황·톤·이어지는 질문처럼 챗봇이 실제로 받는 말
const BASE_SENTENCES = [
  '롬앤 글로시한 틴트 추천해 줘', '페리페라 핑크 립 보여 줘', '3CE 매트 립 있어?', '클리오 코랄 추천해 줘', '컬러그램 제품 보여 줘',
  '에뛰드 로즈 계열 알려 줘', '무지개맨션 립 추천해 줘', '투쿨포스쿨 브라운 있어?', '릴리바이레드 벨벳 틴트', '웨이크메이크 누드 립',
  '2만원 이하 글로시한 코랄 추천해 줘', '만 오천 원 이하 립 보여 줘', '3만원 넘는 립 있어?', '1만원 이하 매트 레드', '제일 싼 립 알려 줘',
  '데일리로 바를 립 추천해 줘', '면접 볼 때 바를 립 추천해 줘', '결혼식 하객 립 뭐가 좋아?', '장례식 갈 때 바를 립', '소개팅 때 바를 촉촉한 립',
  '쿨톤인데 어울리는 립 추천해 줘', '웜톤 립 추천해 줘', '여름 쿨톤한테 맞는 립', '겨쿨 립 추천해 줘', '입술이 건조한데 뭐가 좋아?',
  '지속력 좋은 립 추천해 줘', 'MLBB 느낌 나는 거', '벽돌색 립 있어?', '번들거리는 건 싫어', '혈색 도는 립 추천해 줘',
  '첫 번째 거 자세히 알려 줘', '그중에 제일 싼 거는?', '두 번째랑 세 번째 비교해 줘', '매트한 걸로 바꿔 줘', '더 보여 줘',
  '버건디 립 추천해 줘', '새틴 제형 있어?', '벨벳 말고 글로시로', '졸려', '고마워',
];
// 뜻 일치를 볼 때 비교하는 조건 (챗봇 검색·대화에 영향을 주는 것만)
const INTENT_KEYS = ['finish', 'families', 'exclude', 'brand', 'maxPrice', 'minPrice', 'price', 'superlative', 'tone', 'situations',
  'concerns', 'similar', 'lightness', 'ordinals', 'compare', 'more', 'small', 'unknownBrand'];
const STORE_KEY = 'took.voiceTest';

let brands = [];
let sentences = [...BASE_SENTENCES];
let results = {}; // 문장 → 측정 결과
let current = null; // 듣는 중인 { sentence, session }

try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  if (saved) {
    results = saved.results || {};
    sentences = [...new Set([...BASE_SENTENCES, ...(saved.extra || [])])];
  }
} catch { /* 저장소를 못 쓰는 환경: 이번 화면에서만 기록한다 */ }
const save = () => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ results, extra: sentences.filter((s) => !BASE_SENTENCES.includes(s)) })); } catch { /* 저장 불가 */ }
};

const plain = (s) => String(s).toLowerCase().replace(/[\s.,!?~'"·]/g, '');
const accuracy = (target, heard) => {
  const t = plain(target), h = plain(heard);
  return t.length ? Math.max(0, Math.round((1 - editDistance(t, h) / t.length) * 1000) / 10) : 0;
};
const intentOf = (text) => {
  const c = parseMessage(normalizeForChat(text, brands).text, brands);
  return JSON.stringify(Object.fromEntries(INTENT_KEYS.filter((k) => c[k] !== undefined).map((k) => [k, c[k]])));
};

async function measure(sentence) {
  if (current) { current.session.stop(); return; }
  const session = listenOnce({ getBrands: () => brands, onInterim: (t) => { const cell = document.querySelector(`[data-heard="${CSS.escape(sentence)}"]`); if (cell) cell.textContent = t; } });
  current = { sentence, session };
  render();
  const r = await session.done;
  current = null;
  if (!r.text && r.error) {
    results[sentence] = { error: r.error, at: new Date().toISOString() };
  } else {
    const fixed = normalizeForChat(r.text, brands);
    results[sentence] = {
      heard: r.text, // 인식 서비스가 준 말 (후보 중 고른 것)
      fixed: fixed.text, // 별칭·금액·발음 보정 후
      corrections: fixed.corrections,
      candidates: r.raw, // 조각별 후보 전체
      accRaw: accuracy(sentence, r.text),
      accFixed: accuracy(sentence, fixed.text),
      intentOk: intentOf(sentence) === intentOf(r.text),
      ms: r.ms,
      at: new Date().toISOString(),
    };
  }
  save();
  render();
}

function summary() {
  const done = sentences.map((s) => results[s]).filter((r) => r && !r.error);
  const avg = (k) => (done.length ? Math.round((done.reduce((a, r) => a + r[k], 0) / done.length) * 10) / 10 : 0);
  const ok = done.filter((r) => r.intentOk).length;
  const fails = sentences.filter((s) => results[s]?.error).length;
  return { measured: done.length, total: sentences.length, accRaw: avg('accRaw'), accFixed: avg('accFixed'), intentOk: ok, intentRate: done.length ? Math.round((ok / done.length) * 1000) / 10 : 0, errors: fails };
}

function render() {
  const s = summary();
  $('vt-sum').replaceChildren(
    el('div', {}, el('span', { class: 'muted small', text: '측정한 문장' }), el('strong', { text: `${s.measured} / ${s.total}` })),
    el('div', {}, el('span', { class: 'muted small', text: '글자 정확도 (인식 그대로)' }), el('strong', { text: `${s.accRaw}%` })),
    el('div', {}, el('span', { class: 'muted small', text: '글자 정확도 (보정 후)' }), el('strong', { text: `${s.accFixed}%` })),
    el('div', {}, el('span', { class: 'muted small', text: '뜻 일치' }), el('strong', { text: `${s.intentOk}개 · ${s.intentRate}%` })),
    el('div', {}, el('span', { class: 'muted small', text: '인식 실패' }), el('strong', { text: `${s.errors}개` })),
  );
  $('vt-rows').replaceChildren(...sentences.map((sentence, i) => {
    const r = results[sentence];
    const listening = current?.sentence === sentence;
    return el('tr', { class: listening ? 'listening' : '' },
      el('td', { text: String(i + 1) }),
      el('td', { text: sentence }),
      el('td', {}, el('button', {
        type: 'button', text: listening ? '멈추기' : r ? '다시' : '말하기',
        disabled: !!current && !listening, onclick: () => measure(sentence),
      })),
      el('td', { 'data-heard': sentence, text: listening ? '듣는 중…' : !r ? '' : r.error ? voiceErrorMessage(r.error)
        : r.fixed !== r.heard ? `${r.heard} → ${r.fixed}` : r.heard }),
      el('td', { text: r && !r.error ? (r.accFixed !== r.accRaw ? `${r.accRaw}% → ${r.accFixed}%` : `${r.accFixed}%`) : '' }),
      el('td', { text: r && !r.error ? (r.intentOk ? '일치' : '다름') : '' }));
  }));
}

function report() {
  return {
    measuredAt: new Date().toISOString(), userAgent: navigator.userAgent, summary: summary(),
    items: sentences.filter((s) => results[s]).map((s) => ({ sentence: s, ...results[s] })),
  };
}
$('vt-download').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(report(), null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `took-voice-test-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json` });
  document.body.append(a);
  a.click();
  a.remove();
});
$('vt-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(report(), null, 2));
    $('vt-msg').textContent = '결과를 복사했어요.';
  } catch {
    $('vt-msg').textContent = '복사하지 못했어요. 결과 내려받기를 써 주세요.';
  }
});
$('vt-clear').addEventListener('click', () => {
  if (!confirm('이 기기에 저장된 측정 결과를 모두 지울까요?')) return;
  results = {};
  save();
  render();
});
$('vt-add').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = $('vt-new').value.trim();
  if (t && !sentences.includes(t)) sentences.push(t);
  $('vt-new').value = '';
  save();
  render();
});

if (!speechApi()) {
  $('vt-support').textContent = '이 브라우저는 음성 인식을 지원하지 않아요. iPad Safari, Chrome 또는 Edge 에서 열어 주세요.';
  $('vt-support').classList.remove('hidden');
} else if (!window.isSecureContext) {
  $('vt-support').textContent = 'https 주소가 아니면 iPad 에서 마이크가 막힐 수 있어요. https 주소(배포 주소 또는 npm run cert)로 열어 주세요.';
  $('vt-support').classList.remove('hidden');
}
const { ok, body } = await api('api/products');
if (ok) brands = [...new Set(body.products.map((p) => p.brand))];
render();
