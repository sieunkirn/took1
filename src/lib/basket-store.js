// 카드 담기 (2026-11-23): 손님 NFC 카드 번호(UID) → 담은 제품 ID 목록.
// 휴대폰 담기 화면(public/basket.html)이 카드와 제품 태그를 읽어 여기에 쌓고, 거울은 같은 카드를 리더기에 대면 이 목록을 가져간다.
// 카드에는 아무것도 쓰지 않는다(카드는 번호표 역할만). 서버 메모리 + 파일(있으면)에 둔다.
// Render 무료 플랜은 잠들면 메모리·파일이 사라질 수 있다 → 시연용 기록이고, 오래 두는 데이터가 아니다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export const BASKET_MAX = 20; // 카드 하나에 담는 제품 수
const CARD_MAX = 500; // 기억하는 카드 수 (넘으면 오래된 것부터 지운다)

// 카드 번호 표기를 하나로: 대문자, 콜론·공백·하이픈 제거 (휴대폰 Web NFC 는 04:a1:b2…, 리더기는 04 A1 B2… 로 준다)
export function normalizeCard(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[:\s-]/g, '');
}
export const validCard = (c) => /^[0-9A-Z]{4,32}$/.test(c);

// a 가 b 의 부분 수열인가 (b 에서 몇 글자를 빼면 a 가 되는가)
const isSubseq = (a, b) => { let i = 0; for (const ch of b) if (ch === a[i]) i++; return i === a.length; };

export function createBasketStore({ file = null } = {}) {
  /** @type {Map<string, { items: string[], updated: number }>} */
  const cards = new Map();
  if (file && existsSync(file)) {
    try {
      for (const [k, v] of Object.entries(JSON.parse(readFileSync(file, 'utf8')))) {
        if (validCard(k) && Array.isArray(v?.items)) cards.set(k, { items: v.items.filter((x) => typeof x === 'string').slice(-BASKET_MAX), updated: Number(v.updated) || 0 });
      }
    } catch { /* 깨진 파일은 무시하고 빈 목록으로 */ }
  }
  let saveTimer = null;
  const save = () => {
    if (!file) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { writeFileSync(file, JSON.stringify(Object.fromEntries(cards))); } catch { /* 쓸 수 없는 곳이면 메모리만 */ } }, 200);
    saveTimer.unref?.();
  };

  /**
   * 카드 찾기. 같은 번호가 먼저이고, 없으면 리더기가 글자를 몇 개 흘린 경우를 감안한다(nfc.js matchTag 와 같은 규칙):
   * 짧은 쪽이 8글자 이상, 길이 차이 6 이하, 순서대로 부분 수열이고, 그렇게 맞는 카드가 딱 하나일 때만 같은 카드로 본다.
   */
  function match(raw) {
    const code = normalizeCard(raw);
    if (!validCard(code)) return null;
    if (cards.has(code)) return code;
    const hits = [...cards.keys()].filter((k) => {
      if (k.length === code.length) return false;
      const [short, long] = k.length < code.length ? [k, code] : [code, k];
      return short.length >= 8 && long.length - short.length <= 6 && isSubseq(short, long);
    });
    return hits.length === 1 ? hits[0] : null;
  }

  const view = (card) => {
    const c = cards.get(card);
    return { card, items: c ? [...c.items] : [], updated: c?.updated || 0 };
  };

  return {
    match,
    get(raw) {
      const key = match(raw);
      return key ? view(key) : { card: normalizeCard(raw), items: [], updated: 0 };
    },
    /** 담기. 이미 있으면 맨 뒤(가장 최근)로 옮긴다 */
    add(raw, id) {
      const key = match(raw) || normalizeCard(raw);
      if (!validCard(key)) throw new Error('카드 번호가 올바르지 않습니다.');
      const c = cards.get(key) || { items: [], updated: 0 };
      c.items = [...c.items.filter((x) => x !== id), id].slice(-BASKET_MAX);
      c.updated = Date.now();
      cards.delete(key);
      cards.set(key, c); // Map 순서 = 최근 사용 순
      while (cards.size > CARD_MAX) cards.delete(cards.keys().next().value);
      save();
      return view(key);
    },
    /** id 가 있으면 그 제품만, 없으면 카드 목록 전체를 비운다 */
    remove(raw, id = null) {
      const key = match(raw);
      if (!key) return { card: normalizeCard(raw), items: [], updated: 0 };
      if (id) {
        const c = cards.get(key);
        c.items = c.items.filter((x) => x !== id);
        c.updated = Date.now();
      } else cards.delete(key);
      save();
      return view(key);
    },
  };
}
