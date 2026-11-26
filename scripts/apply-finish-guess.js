// 상품명에 질감 단어가 없어 finish 가 비어 있는 올리브영 제품에 사람이 정한 추정 질감(src/data/finish-guess.json)을 넣는다.
// 그다음 시연용 질감 배정(src/data/finish-demo.json, 2026-11-26)을 덮어쓴다 → finish_source: 'demo'
// 실행: npm run finish:guess   (products.oliveyoung.json 과 products.shades.json 을 고쳐 쓴다)
// import:oliveyoung 도 이 함수를 써서, 다시 가져와도 추정 질감·시연용 배정이 남는다. import:shades 는 제품의 finish 를 그대로 옮긴다.
//
// 데이터 원칙(CLAUDE.md): 실제 표기가 아닌 추정이라 finish_source: 'guess', 시연용 배정은 'demo' 로 구분한다.
// 상품명에서 이미 질감을 찾은 제품(finish_source: 'product_name')은 건드리지 않는다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const GUESS_FILE = join(root, 'src/data/finish-guess.json');
// 시연용 질감 배정 (2026-11-26 사용자 요청): 실데이터에 시어·쉬머가 거의 없어, 질감이 애매한(추정·단서 없음) 실제 제품을 시연용으로 배정한 표
export const DEMO_FILE = join(root, 'src/data/finish-demo.json');

export function loadFinishGuess(file = GUESS_FILE) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  return Object.fromEntries(Object.entries(raw).filter(([k, v]) => !k.startsWith('_') && v?.finish));
}

/** finish 가 비어 있는 레코드(제품·호수)에 추정 질감을 넣는다. 호수는 line(제품 id)으로 찾는다. 바꾼 수를 돌려준다 */
export function applyFinishGuess(list, guess = loadFinishGuess()) {
  let changed = 0;
  for (const p of list) {
    const g = guess[p.line || p.id];
    if (p.finish || !g) continue;
    p.finish = g.finish;
    p.finish_source = 'guess';
    changed++;
  }
  return changed;
}

// also = 시연용으로 '이 질감 목록에도 나온다' (2026-11-26 사용자 요청 "가짜여도 좋으니까 빈칸이 있어선 안돼").
// 제품 하나는 질감이 하나라, 근처에 제품이 하나뿐인 색(진한 주황 90~100% 등)은 질감 다섯 칸을 다 채울 수 없다.
// 그래서 원래 질감(finish)은 그대로 두고 다른 질감 추천에도 나오게 한다 → 레코드의 finish_also. 상품명에 질감이 적힌 제품도 된다(원래 질감을 안 바꾸므로)
const ALSO_OK = ['matte', 'glossy', 'satin', 'sheer', 'shimmer'];
const alsoOf = (v) => (Array.isArray(v?.also) ? v.also.filter((t) => ALSO_OK.includes(t)) : []);

export function loadFinishDemo(file = DEMO_FILE) {
  if (!existsSync(file)) return {};
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  return Object.fromEntries(Object.entries(raw).filter(([k, v]) => !k.startsWith('_') && (v?.finish || alsoOf(v).length)));
}

/** 시연용 질감 배정을 덮어쓴다 (추정·비어 있는 질감만, 상품명에서 찾은 실제 질감은 그대로). 호수는 line(제품 id)으로 찾는다.
 *  also(더 나오는 질감)는 finish_also 로 넣는다 (원래 질감은 그대로).
 *  표에서 빠진 제품(전에 'demo' 였던 것)은 원래 추정 질감(finish-guess.json, 없으면 비움)으로 되돌린다. 바꾼 수를 돌려준다 */
export function applyFinishDemo(list, demo = loadFinishDemo(), guess = loadFinishGuess()) {
  let changed = 0;
  for (const p of list) {
    const d = demo[p.line || p.id];
    const also = alsoOf(d);
    if (String(p.finish_also || '') !== String(also)) {
      if (also.length) p.finish_also = also;
      else delete p.finish_also;
      changed++;
    }
    if (!d?.finish && p.finish_source === 'demo') {
      const g = guess[p.line || p.id];
      p.finish = g ? g.finish : null;
      p.finish_source = g ? 'guess' : null;
      changed++;
      continue;
    }
    if (!d?.finish || p.finish_source === 'product_name') continue;
    if (p.finish === d.finish && p.finish_source === 'demo') continue;
    p.finish = d.finish;
    p.finish_source = 'demo';
    changed++;
  }
  return changed;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const guess = loadFinishGuess();
  const demo = loadFinishDemo();
  for (const [name, indent] of [['products.oliveyoung.json', 2], ['products.shades.json', 1]]) {
    const file = join(root, 'src/data', name);
    const list = JSON.parse(readFileSync(file, 'utf8'));
    const n = applyFinishGuess(list, guess);
    const d = applyFinishDemo(list, demo, guess);
    writeFileSync(file, JSON.stringify(list, null, indent) + '\n');
    console.log(`${name}: 추정 질감 ${n}개 · 시연용 배정 ${d}개 넣음`);
  }
}
