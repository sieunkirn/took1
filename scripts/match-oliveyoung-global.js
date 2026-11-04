// 한국 올리브영 립틴트(src/data/products.oliveyoung.json)를 글로벌 올리브영(영어) 상품과 짝지어 영어 이름을 붙인다.
//   node scripts/match-oliveyoung-global.js            짝짓기 결과만 보여 준다 (파일은 안 바꾼다)
//   node scripts/match-oliveyoung-global.js --apply    결과를 products.oliveyoung.json 에 넣는다 (brand_en, name_en, url_en, global_id)
// 글로벌 상품 목록: src/data/oliveyoung.global.raw.json (global.oliveyoung.com '립 글로스 & 립 틴트' 분류에서 브라우저로 모은 것)
//
// 데이터 원칙(CLAUDE.md): 영어 이름을 지어내지 않는다.
// - 브랜드 영어명은 글로벌 목록에 실제로 있는 표기만 쓴다 (BRAND_EN)
// - 상품명은 같은 브랜드 안에서 단어가 충분히 겹치는 글로벌 상품이 있을 때만 붙인다. 애매하면 붙이지 않고 '검토' 목록에 남긴다
// - 사람이 보고 정한 짝은 MANUAL 에 적는다 (null = 글로벌에 같은 상품이 없다고 확인)
// import-oliveyoung.js 로 데이터를 다시 만들면 이 스크립트를 --apply 로 다시 돌린다
import { readFileSync, writeFileSync } from 'node:fs';

const KO_FILE = new URL('../src/data/products.oliveyoung.json', import.meta.url);
const GLOBAL_FILE = new URL('../src/data/oliveyoung.global.raw.json', import.meta.url);
const GLOBAL_URL = (id) => `https://global.oliveyoung.com/product/detail?prdtNo=${id}`;

// 한국 브랜드 → 글로벌 목록의 브랜드 표기 (글로벌에 없는 브랜드는 넣지 않는다)
export const BRAND_EN = {
  '3CE': '3CE', 'VDL': 'VDL', '네이밍': 'NAMING.', '노노어': 'nonoer', '누즈': 'nuse', '더샘': 'THE SAEM', '더페이스샵': 'THE FACE SHOP',
  '데이지크': 'dasique', '디어달리아': 'DEAR DAHLIA', '딘토': 'Dinto', '라네즈': 'LANEIGE', '라카': 'Laka', '러브플레르': 'lovefleur',
  '롬앤': 'rom&nd', '리스키': 'RISKY', '릴리바이레드': 'lilybyred', '머지': 'MERZY', '메리몽드': 'merrymonde', '모렛': 'molette',
  '모브닝': 'MAUVNING', '모우모우': 'moumou', '무지개맨션': 'MUZIGAE MANSION', '뮤드': 'mude.', '밀크터치': 'MilkTouch', '바닐라코': 'BANILA CO',
  '브레이': 'BRAYE', '비디비치': 'VIDIVICI', '삐아': 'BBIA', '시에로': 'Siero', '씨스터앤': 'SISTER ANN', '앤드바이롬앤': '&nd by rom&nd',
  '앤디얼': 'andear', '어뮤즈': 'AMUSE', '어바웃톤': 'ABOUT_TONE', '어퓨': "A'pieu", '얼리언스': 'Earlyance', '얼터너티브스테레오': 'Alternativestereo',
  '에뛰드': 'ETUDE', '에스쁘아': 'espoir', '에크멀': 'EQUMAL', '엔트로피': 'ENTROPY makeup', '오아드': 'Oiad', '오플로우': 'OFFLOW',
  '웨이크메이크': 'wakemake', '이글립스': 'eglips', '이더앤': 'EITHER&', '입큰': 'IPKN', '잉가': 'INGA', '자빈드서울': 'JAVIN DE SEOUL',
  '정샘물': 'JUNGSAEMMOOL', '지베르니': 'Giverny', '컬러그램': 'colorgram', '케이트': 'KATE', '코드글로컬러': 'CODE GLOKOLOR', '코랄헤이즈': 'Coralhaze',
  '코스노리': 'COSNORI', '코시에로': 'COSIERO', '클리오': 'CLIO', '킬릿': 'KILLIT', '태오앤더': 'teo and the', '토니모리': 'TONYMOLY',
  '투슬래시포': 'TWOSLASHFOUR', '투에이엔': '2aN', '투쿨포스쿨': 'too cool for school', '투크': 'Tooq', '티르티르': 'TIRTIR', '팁토우': 'tiptoe',
  '패션캣': 'PASSIONCAT', '페리페라': 'peripera', '포렌코즈': 'FORENCOS', '포트레': 'Portré', '폰들리': 'fondly', '퓌': 'fwee', '피브': 'FEEV',
  '하트퍼센트': 'Heart Percent', '헤라': 'HERA', '홀리카홀리카': 'Holika Holika', '힌스': 'hince',
};

// 한국 상품명의 외래어 → 영어 단어 (붙어 쓴 말은 여러 단어로)
const WORDS = {
  틴트: 'tint', 립: 'lip', 립틴트: 'lip tint', 글로우: 'glow', 블러: 'blur', 미니: 'mini', 벨벳: 'velvet', 워터: 'water', 듀이: 'dewy',
  글레이즈: 'glaze', 무드: 'mood', 더: 'the', 글로이: 'glowy', 듀: 'dew', 컬러: 'color', 쥬시: 'juicy', 젤리: 'jelly', 리퀴드: 'liquid',
  포션: 'potion', 탕후루: 'tanghulu', 탱글: 'tangle', 글램: 'glam', 워터풀: 'waterful', 메이크업: 'makeup', 오브제: 'objet', 오버: 'over',
  스테인: 'stain', 블러링: 'blurring', 커버: 'cover', 베어: 'bare', 드롭: 'drop', 누디: 'nude', 젤: 'gel', 도트: 'dote', 온: 'on',
  글로시: 'glossy', 라이어: 'liar', 매트: 'matte', 베일: 'veil', 핏: 'fit', 놋트: 'knot', 누드: 'nude', 글로스: 'gloss', 잉크: 'ink',
  플럼퍼: 'plumper', 몬스터: 'monster', 무스: 'mousse', 씬: 'thin', 래스팅: 'lasting', 픽싱: 'fixing', 클라우드: 'cloud', 피팅: 'fitting',
  프루티: 'fruity', 센슈얼: 'sensual', 샤인: 'shine', 시럽: 'syrup', 타투: 'tattoo', 슬레인: 'slayn', 하이퍼: 'hyper', 오프: 'off',
  참: 'cham charm', 젤링: 'jelling', 퍼스트: 'first', 립앤치크: 'lip cheek', 겟잇틴트: 'get it tint', 겟잇: 'get it', 워터리즘: 'waterism',
  에어리: 'airy', 퍼펙트: 'perfect', 오일: 'oil', 스웨이: 'sway', 꾸뛰르: 'couture', 미러: 'mirror', 듀오: 'duo', 블러글로이: 'blur glowy',
  주스팝박스: 'juicepop box', 치크: 'cheek', 로즈: 'rose', 옵세션: 'obsession', 스테이핏: 'stay fit', 누: 'nu', 립스테인: 'lip stain',
  파우더: 'powder', 레이어: 'layer', 허니: 'honey', 볼드: 'bold', 긱: 'geek', 라스트: 'last', 글래싱: 'glassing', 맥시: 'maxi',
  글레이어: 'glayer', 필: 'peel', 블러젤리: 'blur jelly', 플럼핑: 'plumping', 프라이머: 'primer', 슈가: 'sugar', 젤핏: 'jel fit',
  소르베: 'sorbet', 제로: 'zero', 쉬어: 'sheer', 하트: 'heart', 핑크: 'pink', 페어링: 'pairing', 베이스: 'base', 디어: 'dear',
  달링: 'darling', 립프레션: 'lip pression', 케어: 'care', 팟: 'pot', 락: 'lock', 과즙팡: 'juicy pang', 글래스: 'glass', 셔터: 'shutter',
  슬릭: 'sleek', 트윈: 'twin', 카라멜: 'caramel', 크리스탈글램틴트: 'crystal glam tint', 오버글레이즈: 'over glaze', 몽글: 'mongle',
  윗아웃: 'without', 볼륨: 'volume', 시럽틴트: 'syrup tint', 밀크: 'milk', 클레이: 'clay', 퍼지: 'fudge', 레이지: 'lazy', 팝: 'pop',
  티슈오프: 'tissue off', 립티크: 'liptique', 글로시틴트: 'glossy tint', '3d': '3d', 볼류밍: 'voluming', 플러쉬: 'plush flush', 플러시: 'plush flush',
  듀이풀: 'dewyful', 칠러: 'chiller', 딥: 'deep', 수채화: 'watercolor', 립타투: 'lip tattoo', 코튼: 'cotton', 볼륨메이트: 'volumate',
  레이어링: 'layering', 드레시: 'dressy', 코팅: 'coating', 블랙: 'black', 윙크: 'wink', 쉐이드: 'shade', 파우더키스: 'powder kiss',
  파우더믹싱: 'powder mixing', 워터틴트: 'water tint', 피오니: 'peony', 구미: 'gummy', 픽서: 'fixer', 실버: 'silver', 티슈: 'tissue',
  퓨어: 'pure', 틴트글리트: 'tint glit', 미스티: 'misty', 메가: 'mega', 타이: 'tie', 업: 'up', '2x': '2x', 캔디: 'candy', 럭키: 'lucky',
  베어블러: 'bare blur', 스무디: 'smoothie', 글래스팅: 'glasting', 워터젤: 'water gel', 블러싱: 'blushing', 펜던트: 'pendant',
  워터바이브틴트: 'water vibe tint', 아이시: 'icy', 글로우래스팅: 'glow lasting', 키스: 'kiss', 웨이브: 'wave', 아쿠아: 'aqua',
  벨벳틴트: 'velvet tint', 비비드: 'vivid', 립마커: 'lip marker', 립베일: 'lip veil', 모브: 'mauve', 크리미: 'creamy', 멜로우: 'mellow',
  글램드롭: 'glam drop', 슬립: 'sleep', 멜팅: 'melting', 블러쉬드: 'blushed', 엔젤링: 'angel ring', 바운싱: 'bouncing', 블러렛: 'blurlet',
  쥬시탱탱: 'juicy taeng', 글로셔너: 'glotioner', 무스탱: 'mousse tang', 매터: 'matter', 에어: 'air', 글래시: 'glassy', 밤: 'balm',
  크리스탈: 'crystal', 퍼펙션: 'perfection', 컨실: 'conceal', 위시: 'wish', 뮤티드: 'muted', 글라세: 'glace', 픽스온: 'fix on',
  수플레: 'souffle', 워터핏: 'water fit', 젤러블: 'jellable', 익스트림: 'extreme', 글라시: 'glassy', 블러리: 'blurry',
  잉크더젤러블틴트: 'ink the jellable tint', 모찌블러틴트: 'mochi blur tint', 베어글로스: 'bare gloss', 글레이즈드: 'glazed',
  허그: 'hug', 엔젤: 'angel', 샷: 'shot', 리들: 'reedle', 블러핏: 'blur fit', 스타일러: 'styler', 미드나잇: 'midnight', 젤리핏: 'jelly fit',
  틴티드: 'tinted', 앰플: 'ampoule', 다이아: 'diamond', 큐브: 'cube', 쥬스: 'juice', 스플래시: 'splash', 에센셜: 'essential',
  아이엠: "i'm", 립스: 'lips', 원: 'one', 웨이: 'way', 립스틱: 'stick', 라인: 'line', 하이: 'high', 글로우락젤리틴트: 'glow lock jelly tint',
  하트크러쉬: 'heart crush', 블러쉬: 'blush', 타임: 'time', 투: 'to', 바이올렛: 'violet', 쇼킹: 'shocking', 버터: 'butter',
  골드: 'gold', 사틴: 'satin', 새틴: 'satin', 웜: 'warm', 쿨: 'cool', 프로: 'pro', 포기블러: 'foggy blur', 멀티: 'multi',
};
// 거의 모든 상품에 나오는 말은 점수를 적게 준다
const WEAK = new Set(['tint', 'lip', 'color', 'the', 'makeup', 'set', 'edition', 'mini', 'gloss', 'on', 'to', 'one', 'way']);

const norm = (s) => String(s).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9가-힣' ]+/g, ' ').replace(/\s+/g, ' ').trim();
// 영어 상품명 단어: 홍보 문구([...])와 옵션 괄호는 빼고 본다
function enWords(name) {
  const plain = name.replace(/\[[^\]]*\]/g, ' ').replace(/\((set\/single|\d+\s*colou?rs?|\d+\s*options?|warm\/cool[^)]*)\)/gi, ' ');
  return new Set(norm(plain).split(' ').filter(Boolean));
}
function koWords(name) {
  const out = [];
  for (const t of norm(name).split(' ')) {
    if (WORDS[t]) out.push(...WORDS[t].split(' ').map((w) => ({ w, alt: WORDS[t].split(' ') })));
    else if (/^[a-z0-9]+$/.test(t)) out.push({ w: t });
  }
  return out;
}
const colorsOf = (s) => Number((String(s).match(/(\d+)\s*colou?rs?/i) || String(s).match(/(\d+)\s*(?:컬러|종)/) || [])[1]) || null;
const isMini = (s) => /mini|미니/i.test(s);

function score(ko, g) {
  const E = enWords(g.name);
  const K = koWords(ko.name);
  if (!K.length) return 0;
  // '참'처럼 영어 표기가 둘인 말은 하나만 맞아도 된다
  const seen = new Set();
  let got = 0, all = 0, strong = 0;
  for (const { w } of K) {
    if (seen.has(w)) continue;
    seen.add(w);
    const wt = WEAK.has(w) ? 0.3 : 1;
    all += wt;
    if (E.has(w)) {
      got += wt;
      if (!WEAK.has(w)) strong++;
    }
  }
  // 'cham charm' 처럼 영어 표기가 둘인 말은 한쪽만 맞으면 된다: 맞지 않은 쪽은 분모에서 뺀다
  for (const t of norm(ko.name).split(' ')) {
    const alts = WORDS[t]?.split(' ');
    if (alts && t === '참' && alts.some((a) => E.has(a))) all -= alts.filter((a) => !E.has(a)).length;
  }
  if (!strong) return 0; // 'tint'·'lip' 같은 흔한 말만 맞으면 짝으로 보지 않는다
  let s = all ? got / all : 0;
  const kc = colorsOf(ko.original_name), gc = colorsOf(g.name);
  if (kc && gc) s += kc === gc ? 0.15 : -0.05;
  if (isMini(ko.name) !== isMini(g.name)) s -= 0.25;
  return Math.round(s * 100) / 100;
}

// 사람이 보고 정한 짝 (한국 id → 글로벌 id, null = 글로벌 목록에서 같은 상품을 확인하지 못함). 2026-11-04 검토
// 근거가 이름·색 수·에디션처럼 둘 이상 겹칠 때만 짝짓고, 모음전·골라담기·묶음 기획은 같은 상품으로 보지 않는다
export const MANUAL = {
  // 컬러그램 '탕후루 탱글 틴트'는 글로벌에서 'Fruity Glass Tint' (딥 글레이즈 8색·밀크·미니 듀오가 이름 뒷부분까지 같다). 기본 상품은 글로벌 목록에 없다
  'OY-A000000219300': 'GA260741567', 'OY-A000000245109': 'GA260237614', 'OY-A000000201779': 'GA240322617',
  'OY-A000000188142': null, 'OY-A000000221670': null, 'OY-A000000257253': null,
  'OY-A000000230581': 'GA250732540', 'OY-A000000264398': 'GA250732540', // 누디 블러 틴트
  'OY-A000000243174': 'GA251236286', // 누디 블러 틴트 위글위글 세트 ↔ Wiggle Wiggle Edition Set
  'OY-A000000252904': null, // 메타몽 세트
  'OY-A000000245673': 'GA250631862', 'OY-A000000223676': 'GA250631862', // 긱 누드 컬러 커버 틴트
  'OY-A000000211068': 'GA240925944', // 브레이 씬 글로우 틴트 (2X 가 아닌 기본)
  'OY-A000000203735': 'GA240423159', // 릴리바이레드 스윗 라이어 밀키 틴트 14색
  'OY-A000000251137': 'GA260338620', // 앙큼 라이어 코팅 틴트 [산리오] 18종 ↔ [Sanrio EDITION] Bloody Liar Coating Tint (Renewed) 18 Colors
  'OY-A000000232518': 'GA250933246', // 3CE 벨벳 립 틴트 플러쉬
  'OY-A000000181619': 'GA230318060', // 에뛰드 픽싱 틴트 (듀오·포근이 아닌 기본)
  'OY-A000000227015': 'GA260641305', // 웨이크메이크 워터풀 글로우 틴트
  'OY-A000000180567': 'GA230418422', 'OY-A000000269076': 'GA230418422', // 토니모리 (겟잇틴트) 워터풀 버터
  'OY-A000000187713': 'GA230619416', // 토니모리 겟잇틴트 컬러풀워터
  'OY-A000000268671': 'GA260943775', // 토니모리 벨벳 블러링 립 틴트
  'OY-A000000184327': 'GA231121039', // 데이지크 쥬시 듀이 틴트 (글로우 아님)
  'OY-A000000179233': 'GA230117412', // 어뮤즈 젤핏 틴트 (미니·글로스 아님)
  'OY-A000000225803': 'GA250631314', // 딘토 블러글로이 미니
  'OY-A000000187348': 'GA230619320', // 삐아 로 틴트 9색 ↔ L'eau Tint 9 Colors
  'OY-A000000209309': 'GA240825105', // 앤디얼 글로우 립 컬러
  'OY-A000000136343': 'GA210002482', // 롬앤 글래스팅 워터 틴트
  'OY-A000000192644': 'GA231120997', // 더샘 새미스 에이드 샷 틴트
  'OY-A000000200344': 'GA240121956', // 메리몽드 밀크하트 틴트 립앤치크
  'OY-A000000235512': 'GA250933628', // 티르티르 워터리즘 글로우 틴트 4g
  'OY-A000000238093': 'GA251236252', // 태오앤더 밀키도톰 틴트
  'OY-A000000246318': 'GA260237619', // 앤드바이롬앤 글래시 밤 틴트 ↔ Glassy Bomb Tint
  'OY-A000000246909': 'GA260136957', // 어퓨 젤리 틴트
  'OY-A000000213067': 'GA250127768', // 어퓨 과즙팡 틴트 ↔ Juicy Pang Tint
  'OY-A000000249314': 'GA260237966', // 롬앤 미피 문방구 세트 4색 ↔ Miffy Stationery 4-Piece Set
  'OY-A000000251759': 'GA260338637', // 케이트 립 몬스터 크리스탈 팟
  'OY-A000000254445': 'GA260439504', // 페리페라 무드 글로이 틴트 키
  'OY-A000000208254': 'GA240724657', // 포렌코즈 속타투 틴트 ↔ Soak Tattoo Tint
  'OY-A000000223228': 'GA250530923', // VDL 립스테인 에센셜 글로우 틴트
  'OY-A000000216751': 'GA241227351', // 엔트로피 참 틴트 (글로시 겔)
  'OY-A000000216752': 'GA241227352', // 엔트로피 참 틴트 (베이스 블러리)
  // 글로벌 목록에서 같은 상품을 확인하지 못함 (묶음·기획·다른 변형)
  'OY-A000000201628': null, 'OY-A000000241170': null, 'OY-A000000248605': null, // 코시에로: 글로벌엔 '젤러시 글로우 틴트 플럼퍼'만 있다
  'OY-A000000248293': null, // 쥬시 래스팅 틴트 '제로'
  'OY-A000000107447': null, 'OY-A000000119882': null, // 머지 퍼스트 벨벳 틴트: 글로벌은 시즌 1/2로 나뉘어 어느 쪽인지 모른다
  'OY-A000000223309': null, // 잉가 벨벳 슈 틴트
  'OY-A000000225032': null, 'OY-A000000229582': null, // 삐아 로 틴트 미니, 바닐라코 쉬어 벨벳 베일 미니
  'OY-A000000228803': null, 'OY-A000000170148': null, 'OY-A000000238077': null,
  'OY-A000001002174': null, 'OY-A000001001829': null, 'OY-A000000266721': null, 'OY-A000000253833': null, 'OY-A000000267645': null,
  'OY-A000000259218': null, 'OY-A000000269067': null, 'OY-A000000250339': null, 'OY-A000000227870': null, 'OY-A000000227860': null,
  'OY-A000000198850': null, 'OY-A000000225815': null, 'OY-A000000232261': null, 'OY-A000000260935': null, 'OY-A000000262863': null,
  'OY-A000001002933': null, 'OY-A000000172372': null, 'OY-A000000173941': null, 'OY-A000000185439': null, 'OY-A000000212152': null,
  'OY-A000000226889': null, 'OY-A000000230959': null,
};

const ko = JSON.parse(readFileSync(KO_FILE, 'utf8'));
const globalItems = JSON.parse(readFileSync(GLOBAL_FILE, 'utf8')).items;
const byBrand = {};
for (const g of globalItems) (byBrand[g.brand] ||= []).push(g);

const ACCEPT = 0.8; // 이 점수 이상이고
const MARGIN = 0.15; // 두 번째 후보보다 이만큼 높으면 자동으로 짝짓는다
const results = ko.map((p) => {
  const brandEn = BRAND_EN[p.brand] || null;
  if (p.id in MANUAL) {
    const g = MANUAL[p.id] && globalItems.find((x) => x.id === MANUAL[p.id]);
    return { p, brandEn, status: g ? 'manual' : 'none-confirmed', g, score: null };
  }
  if (!brandEn) return { p, brandEn, status: 'no-brand' };
  const cands = (byBrand[brandEn] || []).map((g) => ({ g, s: score(p, g) })).sort((a, b) => b.s - a.s);
  const [best, second] = cands;
  if (best && best.s >= ACCEPT && (!second || best.s - second.s >= MARGIN)) return { p, brandEn, status: 'auto', g: best.g, score: best.s, cands };
  return { p, brandEn, status: 'review', cands: cands.slice(0, 3) };
});

const count = (st) => results.filter((r) => r.status === st).length;
console.log(`한국 ${ko.length}개 · 글로벌 ${globalItems.length}개`);
console.log(`  자동 짝 ${count('auto')} · 수동 짝 ${count('manual')} · 글로벌에 없음 확인 ${count('none-confirmed')} · 검토 필요 ${count('review')} · 글로벌에 없는 브랜드 ${count('no-brand')}`);
const verbose = process.argv.includes('--verbose');
if (verbose || process.argv.includes('--auto')) {
  console.log('\n[자동 짝]');
  for (const r of results.filter((x) => x.status === 'auto')) console.log(`  ${r.score}  ${r.p.id} ${r.p.brand} ${r.p.name}  →  ${r.g.id} ${r.g.name}`);
}
if (verbose || process.argv.includes('--review')) {
  console.log('\n[검토 필요]');
  for (const r of results.filter((x) => x.status === 'review')) {
    console.log(`  ${r.p.id} ${r.p.brand} ${r.p.name} (${colorsOf(r.p.original_name) || '?'}색)`);
    for (const c of r.cands) console.log(`      ${c.s}  ${c.g.id} ${c.g.name}`);
  }
}

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

/**
 * 영어 상품명: 글로벌 표기에서 앞의 브랜드(오타 표기 'cologram' 포함)·홍보 문구·옵션·색 수·용량·사은품 괄호를 뺀다.
 * 브랜드는 brand_en 으로 따로 둔다. "(Glossy Gel)", "(Renewed)" 처럼 상품을 가르는 괄호는 남긴다
 */
export function cleanEnName(name, brandEn) {
  let words = name.replace(/\[[^\]]*\]\s*/g, '').replace(/[’‘]/g, "'").trim().split(/\s+/);
  const brandWords = brandEn.toLowerCase().split(/\s+/);
  const head = words.slice(0, brandWords.length).map((w) => w.toLowerCase());
  if (head.join(' ') === brandWords.join(' ')) words = words.slice(brandWords.length);
  else if (brandWords.length === 1 && editDistance(head[0], brandWords[0]) <= 2) words = words.slice(1);
  return words.join(' ')
    .replace(/\s*\((set\/single|\d+\s*colou?rs?|\d+\s*options?|\+[^)]*)\)/gi, '')
    .replace(/\s+\d+\s*colou?rs?$/i, '')
    .replace(/\s+\d+(?:\.\d+)?\s*(?:g|ml)(?:\s*\+\s*\d+(?:\.\d+)?\s*(?:g|ml))?(?=\s|$)/gi, '')
    .replace(/\s+/g, ' ').trim();
}

if (process.argv.includes('--apply')) {
  for (const r of results) {
    r.p.brand_en = r.brandEn;
    const g = (r.status === 'auto' || r.status === 'manual') ? r.g : null;
    r.p.name_en = g ? cleanEnName(g.name, r.brandEn) : null;
    r.p.global_id = g ? g.id : null;
    r.p.url_en = g ? GLOBAL_URL(g.id) : null;
    r.p.name_en_source = g ? (r.status === 'manual' ? 'oliveyoung_global_manual' : 'oliveyoung_global_auto') : null;
  }
  writeFileSync(KO_FILE, JSON.stringify(ko, null, 2) + '\n');
  console.log(`\nproducts.oliveyoung.json 에 넣었어요 (영어 상품명 ${results.filter((r) => r.p.name_en).length}개, 영어 브랜드 ${results.filter((r) => r.p.brand_en).length}개)`);
}
