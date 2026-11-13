// 말·입력 보정 (서버/브라우저 공용, 외부 의존성 없음).
// 1) 한글 숫자·띄어 쓴 금액을 숫자로: "만 오천 원 이하" → "15000원 이하", "1만5천원" → "15000원"
// 2) 비슷한 발음 보정: 음성 인식이 잘못 받아 적은 단어를 챗봇이 아는 단어로 바꾼다 ("그로시" → "글로시", "코럴" → "코랄")
//    한글을 자모로 나눠 비교하고, 소리가 비슷한 자모(ㄱ/ㅋ, ㅐ/ㅔ, ㅏ/ㅓ, 받침 ㄷ/ㅅ 등)끼리는 적은 비용으로 계산한다.

// ---------- 금액 ----------
const KO_DIGIT = { 일: 1, 한: 1, 이: 2, 두: 2, 삼: 3, 세: 3, 사: 4, 네: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
const NUM = '(?:\\d+(?:[.,]\\d+)?|[일한이두삼세사네오육칠팔구])';
const LIMIT = '(?=\\s*(?:이하|미만|아래|까지|이내|정도|대|짜리|선|이상|넘|초과|부터|안\\s*넘))';
// [N]만 [M]천 [원] / N천 [원] — 뒤에 이하·미만 같은 말이 올 때만 금액으로 본다 ("만들어" 같은 말은 건드리지 않음)
// 숫자 없는 "천 원"은 '원'까지 있어야 금액으로 본다 ("추천 선물"의 '천'을 금액으로 읽지 않게)
const AMOUNT_RE = new RegExp(`(${NUM})?\\s*만\\s*(?:(${NUM})\\s*천)?\\s*원?${LIMIT}|(${NUM})\\s*천\\s*원?${LIMIT}|(?<![가-힣])천\\s*원${LIMIT}`, 'g');

const numOf = (s, fallback) => {
  if (s === undefined || s === '') return fallback;
  return KO_DIGIT[s] ?? Number(String(s).replace(/,/g, ''));
};

export function normalizeAmounts(text) {
  return text.replace(AMOUNT_RE, (m, man, chunInMan, chun) => {
    const value = /^천\s*원$/.test(m) ? 1000
      : chun !== undefined
      ? numOf(chun, 1) * 1000
      : numOf(man, 1) * 10000 + (chunInMan !== undefined ? numOf(chunInMan, 1) * 1000 : 0);
    return Number.isFinite(value) ? `${Math.round(value)}원` : m;
  });
}

// ---------- 자모 분해와 발음 거리 ----------
export const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
export const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
export const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

/** 두 글자열(또는 배열)의 편집 거리: 한 글자 넣기·빼기·바꾸기를 몇 번 해야 같아지는지 */
export function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

// 받침은 '_' 를 붙여 초성과 구분한다 (예: "글" → ㄱ ㅡ ㄹ_)
function toJamo(word) {
  const out = [];
  for (const ch of word) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) { out.push(ch); continue; }
    out.push(CHO[Math.floor(code / 588)], JUNG[Math.floor((code % 588) / 28)]);
    const jong = JONG[code % 28];
    if (jong) out.push(jong + '_');
  }
  return out;
}

// 소리가 비슷해 음성 인식이 자주 헷갈리는 자모 묶음
const SIMILAR = [
  'ㄱㄲㅋ', 'ㄷㄸㅌ', 'ㅂㅃㅍ', 'ㅈㅉㅊ', 'ㅅㅆ', 'ㄴㄹ',
  'ㅐㅔㅒㅖ', 'ㅏㅓ', 'ㅓㅗ', 'ㅗㅜ', 'ㅜㅡ', 'ㅡㅣㅢ', 'ㅚㅙㅞㅐㅔ', 'ㅑㅕ', 'ㅘㅏ', 'ㅝㅓ', 'ㅟㅣ',
].map((g) => [...g]);
// 받침은 실제 소리(대표음)가 같으면 거의 같은 것으로 본다
const SIMILAR_JONG = ['ㄱㄲㅋㄳㄺ', 'ㄷㅅㅆㅈㅊㅌㅎ', 'ㅂㅍㅄㄿ', 'ㄴㄵㄶ', 'ㄹㄼㄽㄾㅀ', 'ㅁㄻ'].map((g) => [...g].map((j) => j + '_'));
// 받침끼리 자주 헷갈리는 소리: 콧소리(ㄴ/ㅇ/ㅁ), 입술소리(ㅁ/ㅂ)
const NEAR_JONG = ['ㄴㅇㅁ', 'ㅁㅂ'].map((g) => [...g].map((j) => j + '_'));

function subCost(a, b) {
  if (a === b) return 0;
  if (SIMILAR_JONG.some((g) => g.includes(a) && g.includes(b))) return 0.2;
  if (SIMILAR.some((g) => g.includes(a) && g.includes(b))) return 0.3;
  if (NEAR_JONG.some((g) => g.includes(a) && g.includes(b))) return 0.4;
  return 1;
}
const indelCost = (j) => (j.endsWith('_') ? 0.5 : 1); // 받침은 말할 때 자주 빠지거나 붙는다

export function jamoDistance(a, b) {
  const x = toJamo(a), y = toJamo(b);
  const d = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
  for (let i = 1; i <= x.length; i++) d[i][0] = d[i - 1][0] + indelCost(x[i - 1]);
  for (let j = 1; j <= y.length; j++) d[0][j] = d[0][j - 1] + indelCost(y[j - 1]);
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + indelCost(x[i - 1]),
        d[i][j - 1] + indelCost(y[j - 1]),
        d[i - 1][j - 1] + subCost(x[i - 1], y[j - 1]),
      );
    }
  }
  return d[x.length][y.length];
}

// 단어 길이별 허용 거리: 비슷한 소리(ㄱ/ㅋ, ㅐ/ㅔ, 받침 등)끼리의 차이만 허용해 엉뚱한 단어로 바뀌지 않게 한다.
// 브랜드가 많아지면(올리브영 92개) 넉넉한 허용치는 "데이트 → 케이트" 같은 잘못된 보정을 만든다
const allowed = (word) => (word.length <= 2 ? 0.6 : word.length === 3 ? 0.7 : 1);
const isHangul = (s) => /^[가-힣]+$/.test(s);

/**
 * 문장 속 단어를 어휘 목록의 단어로 보정한다. 어휘 단어 뒤에 붙은 말(한, 색, 으로 등)은 그대로 둔다.
 * @param {string} text
 * @param {string[]} vocab 보정 대상이 되는 한글 단어 (제형·색·브랜드 등)
 * @param {string[]} [keep] 이미 뜻이 있는 말이라 보정하지 않는 단어 (데이트·면접·건조 등)
 * @returns {{ text: string, corrections: {from: string, to: string}[] }}
 */
export function correctWords(text, vocab, keep = []) {
  const words = vocab.filter(isHangul);
  const known = [...words, ...keep.filter(isHangul)];
  const corrections = [];
  text = joinSplitWords(text, words, known, corrections);
  const tokens = text.split(/(\s+)/).map((token) => {
    if (!/[가-힣]/.test(token) || known.some((w) => token.includes(w))) return token;
    let best = null;
    for (let k = Math.min(token.length, 6); k >= 2; k--) {
      const head = token.slice(0, k);
      if (!isHangul(head)) continue;
      for (const w of words) {
        if (Math.abs(w.length - head.length) > 1) continue;
        const dist = jamoDistance(head, w);
        if (dist <= allowed(w) && (!best || dist < best.dist)) best = { head, w, dist };
      }
    }
    if (!best) return token;
    corrections.push({ from: best.head, to: best.w });
    return best.w + token.slice(best.head.length);
  });
  return { text: tokens.join(''), corrections };
}

// 음성 인식이 한 단어를 띄어 적은 경우("패리 패라", "컬러 그램")를 붙여서 어휘 단어(세 글자 이상)로 고친다.
// 두 토막 모두 이미 아는 말이면 건드리지 않는다
function joinSplitWords(text, words, known, corrections) {
  const long = words.filter((w) => w.length >= 3);
  const parts = text.split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const a = parts[i], b = parts[i + 1];
    const joinable = b && /^[가-힣]+$/.test(a) && /^[가-힣]/.test(b)
      && !known.some((w) => a.includes(w)) && !known.some((w) => b.includes(w));
    let hit = null;
    if (joinable) {
      const joined = a + b;
      // 두 토막을 이은 앞부분이 어휘 단어와 비슷하면 그 단어로 (뒤에 붙은 조사·말은 그대로)
      for (let k = Math.min(joined.length, 6); k > a.length; k--) {
        const head = joined.slice(0, k);
        if (!isHangul(head)) continue;
        for (const w of long) {
          if (Math.abs(w.length - head.length) > 1) continue;
          const dist = jamoDistance(head, w);
          if (dist <= allowed(w) && (!hit || dist < hit.dist)) hit = { head, w, dist, rest: joined.slice(k) };
        }
      }
    }
    if (hit) {
      if (hit.head !== hit.w) corrections.push({ from: `${a} ${b}`, to: hit.w }); // 띄어쓰기만 다른 건 보정으로 알리지 않는다
      out.push(hit.w + hit.rest);
      i++;
    } else out.push(a);
  }
  return out.join(' ');
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * 말소리 별칭을 챗봇이 아는 말로 바꾼다 ("romand" → "롬앤", "쓰리씨이" → "3CE").
 * 영어 별칭은 단어 경계에서만(대소문자 무시), 한글 별칭은 단어 첫머리에서만 바꾼다.
 * @param {{ to: string, from: string[] }[]} aliases
 */
export function applyAliases(text, aliases = []) {
  const corrections = [];
  // 긴 별칭부터 ("too cool for school" 을 "cool" 보다 먼저)
  const pairs = aliases.flatMap(({ to, from }) => from.map((f) => ({ to, f }))).sort((x, y) => y.f.length - x.f.length);
  for (const { to, f } of pairs) {
    const ascii = /^[\x20-\x7e]+$/.test(f);
    const re = ascii
      ? new RegExp(`(^|[^a-z0-9])${escapeRe(f)}(?![a-z0-9])`, 'gi')
      : new RegExp(`(^|\\s)${escapeRe(f)}`, 'g');
    text = text.replace(re, (m, pre) => {
      const from = m.slice(pre.length);
      if (from.replace(/\s/g, '').toLowerCase() !== to.toLowerCase()) corrections.push({ from, to }); // 띄어쓰기만 다른 건 알리지 않는다
      return pre + to;
    });
  }
  return { text, corrections };
}

/** 말소리 별칭 + 금액 정리 + 발음 보정을 한 번에 */
export function normalizeSpoken(text, vocab, keep = [], aliases = []) {
  const a = applyAliases(normalizeAmounts(String(text || '')), aliases);
  const r = correctWords(a.text, vocab, keep);
  return { text: r.text, corrections: [...a.corrections, ...r.corrections] };
}
