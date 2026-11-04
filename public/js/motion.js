// 화면 움직임(토스풍 인터랙션). common.js 가 불러오므로 모든 화면에 적용된다.
//  - 새로 그려진 제품 카드·말풍선이 아래에서 차례로 떠오른다
//  - 세그먼트(합본 탭, 텍스처 선택)는 선택 표시 밑판이 미끄러지듯 옮겨 간다
//  - 슬라이더는 현재 값까지 트랙을 채운다
//  - 가격 숫자가 0에서 올라간다
//  - toast(): 화면 아래에 잠깐 뜨는 알림, skeletonCards(): 불러오는 동안 보여 줄 회색 뼈대 카드
// 동작 줄이기(prefers-reduced-motion) 설정이면 움직임 없이 결과만 보여 준다.
import { priceText } from './i18n.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 카드·말풍선 차례로 떠오르기 ----------
const POP = '.card, .recent-row'; // 홈의 기능 카드·단계는 home.js 가 따로 움직인다
// 대화창은 말할 때마다 통째로 다시 그려서, 말풍선마다 '처음 본 시각'을 기억해 새 말풍선만 떠오르게 한다
const seenBubbles = new WeakMap(); // 대화창 → Map(말풍선 열쇠 → 처음 본 시각)
const POP_MS = 500;
let quietUntil = 0; // 화면을 처음 열 때 이전 대화를 복원하는 동안은 움직이지 않는다

function pop(node, i) {
  node.style.setProperty('--i', String(Math.min(i, 8)));
  node.classList.add('pop-in');
}

function animateNew(root) {
  // 대화창: 새로 늘어난 말풍선만 떠오르게 한다
  for (const logEl of root.matches?.('.chat-log') ? [root] : root.querySelectorAll?.('.chat-log') || []) {
    const seen = seenBubbles.get(logEl) || new Map();
    seenBubbles.set(logEl, seen);
    const now = performance.now();
    let fresh = 0;
    [...logEl.querySelectorAll(':scope > .bubble')].forEach((b, k) => {
      const key = k + ':' + b.textContent.slice(0, 60);
      const first = seen.get(key);
      if (first === undefined) {
        seen.set(key, now);
        if (now > quietUntil) pop(b, fresh++);
      } else if (now - first < POP_MS) {
        // 움직이는 도중에 다시 그려졌으면 이어서 움직인다
        pop(b, 0);
        b.style.animationDelay = `${first - now}ms`;
      }
    });
  }
  const items = root.matches?.(POP) ? [root] : [...(root.querySelectorAll?.(POP) || [])];
  const perParent = new Map();
  for (const item of items) {
    if (item.closest('.chat-log')) continue; // 말풍선 안 카드는 말풍선과 함께 움직인다
    const n = perParent.get(item.parentNode) || 0;
    perParent.set(item.parentNode, n + 1);
    pop(item, n);
    countUp(item);
  }
}

// ---------- 가격 숫자 올라가기 ----------
function countUp(root) {
  for (const span of root.querySelectorAll('[data-count]')) {
    const to = Number(span.dataset.count);
    if (!Number.isFinite(to) || reduce) continue;
    const start = performance.now();
    const dur = 600;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - t) ** 3;
      span.textContent = priceText(Math.round(to * eased)); // 한국어 '13,000원', 영어 '₩13,000'
      if (t < 1 && span.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

// ---------- 세그먼트 밑판 ----------
// 선택된 버튼 뒤로 흰 밑판(.seg-thumb)을 깔고, 선택이 바뀌면 그 자리로 미끄러져 간다
function segmented(group, attr) {
  if (group.querySelector(':scope > .seg-thumb')) return;
  const thumb = document.createElement('span');
  thumb.className = 'seg-thumb';
  thumb.setAttribute('aria-hidden', 'true');
  group.prepend(thumb);
  group.classList.add('has-thumb');
  let first = true;
  const place = () => {
    if (thumb.parentNode !== group) group.prepend(thumb); // 화면 스크립트가 버튼을 통째로 다시 그린 경우
    const on = group.querySelector(`:scope > [${attr}="true"]`);
    if (!on || !on.offsetWidth) { thumb.style.opacity = '0'; return; }
    if (first) thumb.style.transition = 'none';
    thumb.style.opacity = '1';
    thumb.style.width = on.offsetWidth + 'px';
    thumb.style.transform = `translateX(${on.offsetLeft}px)`;
    if (first) { thumb.getBoundingClientRect(); thumb.style.transition = ''; first = false; }
  };
  new MutationObserver(place).observe(group, { subtree: true, childList: true, attributes: true, attributeFilter: [attr] });
  new ResizeObserver(place).observe(group);
  place();
}

// ---------- 슬라이더 채우기 ----------
function fillRange(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  input.style.setProperty('--p', ((Number(input.value) - min) / (max - min || 1)) * 100 + '%');
}
const fillAllRanges = () => document.querySelectorAll('input[type="range"]').forEach(fillRange);
document.addEventListener('input', (e) => { if (e.target.matches?.('input[type="range"]')) fillRange(e.target); });
// 다른 스크립트가 값을 코드로 바꿀 때(색 선택 → 조제 슬라이더 맞추기)는 input 이벤트가 없어서 색 변경 이벤트에 맞춰 다시 칠한다
window.addEventListener('took:color', () => requestAnimationFrame(fillAllRanges));

// ---------- 토스트 ----------
let toastWrap;
export function toast(message, { ms = 2200 } = {}) {
  if (!toastWrap) {
    toastWrap = document.createElement('div');
    toastWrap.className = 'toast-wrap';
    toastWrap.setAttribute('role', 'status');
    toastWrap.setAttribute('aria-live', 'polite');
    document.body.append(toastWrap);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  toastWrap.append(t);
  while (toastWrap.children.length > 2) toastWrap.firstElementChild.remove();
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), reduce ? 0 : 250);
  }, ms);
}

// ---------- 스켈레톤 ----------
export function skeletonCards(n = 3) {
  return Array.from({ length: n }, () => {
    const card = document.createElement('div');
    card.className = 'card skeleton';
    card.setAttribute('aria-hidden', 'true');
    card.innerHTML = '<div class="sk sk-img"></div><div class="sk sk-line"></div><div class="sk sk-line short"></div><div class="sk sk-line shorter"></div>';
    return card;
  });
}

// ---------- 시작 ----------
function init() {
  document.querySelectorAll('.studio-tabs').forEach((g) => segmented(g, 'aria-selected'));
  document.querySelectorAll('.seg').forEach((g) => segmented(g, 'aria-pressed'));
  quietUntil = performance.now() + 400;
  fillAllRanges();
  setTimeout(fillAllRanges, 300); // 화면 스크립트가 처음 값을 넣은 뒤
  animateNew(document.body);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'childList' && r.target.classList?.contains('chat-log')) animateNew(r.target);
      for (const node of r.addedNodes) if (node.nodeType === 1 && !node.classList.contains('seg-thumb')) animateNew(node);
    }
  }).observe(document.body, { childList: true, subtree: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
