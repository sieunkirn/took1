// 말소리 별칭 (서버/브라우저 공용). 음성 인식이 브랜드·용어를 영어나 다른 표기로 받아 적을 때 챗봇이 아는 말로 바꾼다.
// 예) "romand" · "롬 앤" → 롬앤, "쓰리씨이" → 3CE, "warm tone" → 웜톤
// - 브랜드 별칭은 지금 제품 데이터에 있는 브랜드만 쓴다 (chat.js 의 chatAliases 가 거른다)
// - 영어 별칭은 단어 경계에서만, 한글 별칭은 단어 첫머리에서만 바꾼다 ("macaron" 의 mac 은 바꾸지 않는다)
// 새 오인식이 보이면 여기에 한 줄 추가하면 된다
export const BRAND_ALIASES = {
  '롬앤': ['romand', 'rom&nd', 'rom and', '롬 앤', '롬엔', '롬앤드'],
  '앤드바이롬앤': ['and by romand', '앤드 바이 롬앤'],
  '페리페라': ['peripera', '페리 페라', '패리패라', '페리패라', '패리 패라'],
  '클리오': ['clio'],
  '3CE': ['3ce', '3 ce', 'three ce', '쓰리씨이', '쓰리 씨이', '쓰리 씨 이', '쓰리씨'],
  '에뛰드': ['etude', '에튀드', '에튜드'],
  '라네즈': ['laneige', '라네주'],
  '헤라': ['hera'],
  '맥': ['mac', 'm.a.c', '엠에이씨'],
  '어뮤즈': ['amuse', '아뮤즈'],
  '힌스': ['hince'],
  '삐아': ['bbia'],
  '컬러그램': ['colorgram', 'color gram', '칼라그램', '컬러그람', '칼라 그램'],
  '라카': ['laka'],
  '무지개맨션': ['muzigae mansion', '무지개 맨션'],
  '투쿨포스쿨': ['too cool for school', '투 쿨 포 스쿨', '투쿨 포 스쿨', '투쿨포 스쿨'],
  '토니모리': ['tonymoly', 'tony moly', '토니 모리'],
  '릴리바이레드': ['lilybyred', 'lily by red', '릴리 바이 레드', '릴리바이 레드'],
  '에스쁘아': ['espoir', '에스뿌아', '에스프아'],
  '웨이크메이크': ['wakemake', 'wake make', '웨이크 메이크'],
  '바닐라코': ['banila co', 'banilaco', '바닐라 코'],
  '데이지크': ['dasique', '데이지 크'],
  '디어달리아': ['dear dahlia', '디어 달리아'],
  '키스미': ['kissme', 'kiss me', '키스 미'],
  '정샘물': ['jungsaemmool', 'jung saem mool', '정 샘물'],
  '더샘': ['the saem', '더 샘'],
  '어퓨': ["a'pieu", 'apieu'],
  '홀리카홀리카': ['holika holika', '홀리카 홀리카'],
  '티르티르': ['tirtir', '티르 티르'],
  '베네피트': ['benefit', '베네핏'],
  '케이트': ['kate'],
  '딘토': ['dinto'],
  '퓌': ['fwee'],
  '머지': ['merzy'],
  '하트퍼센트': ['heart percent', '하트 퍼센트'],
  '비디비치': ['vdivov'],
  'VDL': ['브이디엘'],
  'YNM': ['와이엔엠'],
  '메리몽드': ['merrymonde'],
  '엔트로피': ['entropy'],
};

// 브랜드가 아닌 챗봇 용어
export const WORD_ALIASES = {
  '웜톤': ['warm tone', 'warmtone', '웜 톤', '워톤'],
  '쿨톤': ['cool tone', 'cooltone', '쿨 톤', '굴톤'],
  'MLBB': ['엠엘비비', '엠 엘 비 비', '엠엘 비비'],
  '글로시': ['glossy', '글로씨'],
  '새틴': ['satin', '세틴'],
  '버건디': ['burgundy', '버건 디', '버간디'],
};
