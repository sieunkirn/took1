// 말·입력 보정 (서버/브라우저 공용, 외부 의존성 없음).
// 1) 한글 숫자·띄어 쓴 금액을 숫자로: "만 오천 원 이하" → "15000원 이하", "1만5천원" → "15000원"
// 2) 편집 거리 (scripts/match-oliveyoung-global.js 가 영어·한국어 이름 맞추기에 쓴다)

// ---------- 금액 ----------
const KO_DIGIT = { 일: 1, 한: 1, 이: 2, 두: 2, 삼: 3, 세: 3, 사: 4, 네: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
const NUM = '(?:\\d+(?:[.,]\\d+)?|[일한이두삼세사네오육칠팔구])';
const LIMIT = '(?=\\s*(?:이하|미만|아래|까지|이내|정도|대|짜리|선|안쪽|안으로|이상|넘|초과|부터|안\\s*넘))';
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

// ---------- 편집 거리 ----------
/** 두 글자열(또는 배열)의 편집 거리: 한 글자 넣기·빼기·바꾸기를 몇 번 해야 같아지는지 */
export function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}
