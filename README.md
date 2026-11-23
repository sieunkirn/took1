# took(툭)

매장에 두는 **스마트미러 립 키오스크**입니다. 손님이 거울 앞에 서면 카메라가 입술을 찾아 립 색을 바로 발라 보여 주고, 들고 온 제품(NFC 태그)이나 색 다이얼로 색을 고른 뒤 호수를 정해 가져가게 합니다.

- 기기: 노트북(Windows + Chrome)을 세로 모니터에 연결한 스마트미러. USB 웹캠(**USB 2.0 Camera**, USB VID 0C49 / PID 636F), 블루투스 NFC 리더기(키보드 모드). 설치형 프로그램 없이 브라우저만으로 돈다
- 화면: 세로 **900×1440**(5:8) 하나를 기준으로 그린다
- 언어: 한국어 / 영어 (서비스 전체)

프로젝트 규칙(디자인·개발·데이터 원칙, 작업 방식)은 [CLAUDE.md](CLAUDE.md) 에 있습니다.

---

## 손님 흐름

```
시작 화면(영상) ──터치──▶ 거울 ──┬─ ① 제품 올리기: NFC 태그
                                 └─ ② 색 돌려 보기: 원형 다이얼
                                        │
                              입술에 발라 보기 → 호수 고르기 → 가져가기
```

### 시작 화면 (`index.html`, `js/home.js`)
- 배경 영상(`videos/home.mp4`) + 가운데 TOOK 로고 + 'Tap The Screen'. 화면 아무 곳이나 누르면 4번 버튼 화면으로 간다 (2026-11-21)
- 순서: 제품 장면(영상 3.45~4.95초, 1.5초) + 로고 → 입술 장면(1.5초) + 로고 → **3초째** 'Tap The Screen' (2026-11-20). 이후 입술 장면만 되풀이
- 언어(한/영) 버튼은 시작 화면에만 있다
- 4번 화면(2026-11-21, Figma GP `1667:704`): 검정 바탕, 로고가 위(y 380.77)로 올라가고 알약 버튼 2개가 세로로. 1 스캔 = 거울(`palette.html`) · 2 NFC = 거울에서 '제품을 태그해보세요' 안내 후 리더기 기다리기. 아이콘은 `images/home-menu/`. 시작 화면은 요청 없이 바꾸지 않는다
- 시작 화면을 **5초 길게 누르면** 관리자 화면(`admin.html`)이 열린다

### 거울 (`palette.html`, Find Your Color)
- 카메라가 화면 전체를 채우고, 얼굴을 따라 괄호 4개가 감싼다. 입술에는 고른 색이 실시간으로 칠해진다
- **다이얼**: 원형 그래프 28칸(빨강·핑크·오렌지·누드 × 7칸)이 손가락을 따라 돌고, 놓으면 칸에 멈춘다. 색은 모두 립 DB 의 실제 색
- **질감 동그라미**: matte · glossy · satin · sheer · shimmer. 옆으로 밀어 고른다
- **로고 버튼**: 지금 색과 비슷한 제품 추천(화면 아래 절반 시트, 카드 2열). 색을 바꾸면 목록도 다시 찾는다
- 시트 왼쪽 위 **내 톤으로 추천받기**: 누르면 "재는 중…" → 카메라로 피부 톤을 재(`js/lip-look.js`) 버튼 오른쪽에 "내 톤 · 여름 쿨" + 추천 색 3개. 첫 번째 색을 바로 입술·다이얼에 바르고 그 색의 제품으로 목록을 바꾼다(다른 색을 누르면 그 색으로). 얼굴을 찾기 전엔 꺼짐
- **왼쪽 세로 메뉴** (2026-11-22, Figma `1653:469`, 늘 펼친 4칸): 스캔 · NFC('제품을 태그해보세요' 안내) · 점 9개(추천 시트 열기/닫기) · 집. "홈 알약"이라고 하면 이 메뉴를 말하는 것일 수 있다

### ① 제품 올리기 — NFC 태그 (`js/nfc.js`, `js/nfc-window.js`)
손님은 이미 실물을 들고 있다는 전제로 만든다.
- **안내 모달** (2026-11-22, Figma 'NFC 버튼 시안' D·F): 거울 왼쪽 알약의 NFC 버튼이나 홈의 NFC 버튼을 누르면 거울 가운데 세로 상자(640px)에 '제품을 리더기에 대 주세요' + 3단계 + '리더기 기다리는 중' + [다이얼로 고르기 (테스트용)]. 이 버튼은 **시연·테스트용**으로, 리더기 없이 화면 목록(/api/products)에서 아무 제품이나 골라 태그된 것처럼 '인식했어요' → 제품 카드로 보낸다. 닫기·바깥·Esc 로 닫힌다. 안내 중 등록 안 된 태그를 대면 상자 안에 '?' 를 3.2초 보이고 다시 안내
- **인식했어요 모달** (Figma '제품 인식 후 시안' H): 태그를 읽으면 입술에 바로 바르고, 같은 상자에 제품 사진·브랜드·이름·호수/제형/가격을 2.2초 보여 준 뒤(남은 시간 막대) 아래 제품 카드로 넘어간다. [제품 보기]·바깥을 누르면 바로 넘어간다
- 제품 카드: 다이얼 자리에 시트가 올라온다: 사진·브랜드·이름·제형·가격 / "들고 계신 호수를 골라 주세요" + 실제 호수 줄(누를 때마다 입술 색 변경) / [이 색과 비슷한 립 보기] · [가져가기]
- 시작 화면에서 태그해도 거울로 넘어가 바로 바른다
- 등록되지 않은 태그는 작은 '?' 시트가 잠깐 떴다 내려간다
- 태그 → 제품 찾는 순서: ① `NFC_TAGS` 표(태그 번호 UID) ② 태그에 써 둔 제품 ID(`A000…`) ③ 태그에 써 둔 **포장 바코드 번호**(호수까지 찾음)
- 지금 리더기(ACS ACR1555U)는 UID 만 내보내므로 태그는 ① 표에 등록해야 한다. 테스트 카드 3장 등록됨
- **바코드 스캐너는 없는 기능이다.** USB 바코드 스캐너도, 카메라로 바코드 읽기도 쓰지 않는다. 바코드 번호는 ③처럼 NFC 태그 안에 써 둔 경우에만 쓴다
- 시험: 브라우저 콘솔에서 `tookNfc('TEST0001')`

### 호수 고르기 · 가져가기
- 추천 카드에는 '호수' 줄(색 견본 + '04 피그피그 · 40가지 중')이 있고, 호수 안내(`shades.html`)에서 호수를 눌러 비교·발라 보기
- **가져가기** 시트(`js/takeaway.js`): 매장 위치·재고·휴대폰 QR(`js/qr.js`, 직접 만든 QR 생성기). NFC 시트의 분홍 버튼, 추천 카드의 '가져가기'에서 연다
- 매장·재고는 가짜 데이터다(`js/store-stock.js`, 화면에 '시연용' 배지)

### 자동 초기화 (`js/idle-reset.js`)
- **90초 동안 조작이 없으면** 줄어드는 원 + 남은 초(10초) 안내. 아무 곳이나 누르면 계속, 0초가 되면 고른 색·언어를 모두 지우고 시작 화면으로
- 읽어주기·음성 듣기 중에는 기다린다(최대 60초)
- 기기마다 대기 시간 바꾸기: 그 기기 콘솔에서 `localStorage.setItem('took.idleSeconds', '120')` (10초 이상)
- 직원용 화면은 `<body data-idle-reset="off">`

---

## 디자인

### 색 (2026-11-20)
- **핑크는 `#FF007B` 한 가지만 쓴다.** 강조 버튼, 손님 말풍선, 진행 점·밑줄 등. 눌렸을 때만 `#D60067`
- 그라데이션·빛 번짐(glow)·유리 테두리를 버튼에 쓰지 않는다. 면은 단색
- 어두운 화면: 바탕 `#0B0B0C` · 면 `#1E1E21` · 눌림 `#2A2A2E` · 선 `#2E2E33` · 흐린 글 `#9B9BA1` · 글 `#FFFFFF`
- 파일 위치: 제품 상세·호수 안내·색상 추천은 `css/took-flat.css` 맨 위 변수(`--f-accent` 등) / 시작 화면·거울은 `css/took-ui.css` 끝 '색 통일' 절 / NFC 시트 `css/took-nfc.css` / 가져가기 `css/took-take.css` / 자동 초기화 `css/wireframe.css` 의 `.idle-keep`
- 예외(그대로 둠): 거울의 색 다이얼(색 칸·유리 손잡이), 립·제품의 실제 색(카메라 입술·색 견본·질감 동그라미·제품 사진), 거울 왼쪽 세로 유리 메뉴(Figma 원본)

### 원본 디자인
- 시작 화면·거울은 TOOK_prototype(Figma 900×1440)을 그대로 옮긴 화면이다. `css/took-ui.css` + 900×1440 무대(`js/ui-stage.js`)에 원본 좌표대로 그린다. 바꿀 때는 원본 PNG(`TOOK_prototype/took-prototype/public/screens`)와 겹쳐 비교한다
- 글꼴 Pretendard

### 화면 틀
- 어떤 기기에서 열어도 `js/device-frame.js` 가 화면을 5:8 틀(`kiosk.html?page=…`) 안으로 옮긴다. 틀은 창 안에 들어가는 가장 큰 5:8 상자를 가운데 두고 남는 곳은 검게 채운다
- 예외: 터치 보정(`calib.html`), PC 미리보기(`preview.html`), 자동 테스트(`navigator.webdriver`)
- 전체화면: 첫 터치 뒤 주소창까지 숨기는 전체화면으로 들어간다. Esc 는 지원 브라우저에서 잠그고, 강제로 풀리면 다음 입력 때 복구한다. 키오스크 PC 는 `scripts/kiosk-chrome.bat` 로 켠다
- 스크롤바는 숨기고 터치·휠 스크롤은 유지한다

---

## 실행

Node 18 이상.

```bash
npm install            # MediaPipe·ZXing 을 public/vendor 로 복사 + 얼굴 모델 다운로드 (postinstall)
npm start              # http://localhost:3000
npm test               # 단위 테스트 (색 계산·추천·바코드 번호 찾기·터치 보정·호수)
npm run e2e            # Playwright 전체 흐름 테스트 (가짜 카메라)
```

### 빌드
```bash
npm run build:web      # 서버 없는 정적 버전 → dist/static (Vercel 용)
npm run build:static   # 같은 정적 버전, claude.ai Artifact 용
npm run e2e:static     # 정적 버전으로 흐름 테스트
npm run build:apk      # 안드로이드 APK → dist/apk/took.apk (정적 버전 내장 WebView, 음성 인식 없음)
npm run icon:apk       # 앱 아이콘 다시 만들기: android/icon/mark.svg(TOOK 마크, 핑크 #FF007B·검정 바탕) → android/res/
```
- 정적 버전은 `src/lib` 모듈(검색·추천)을 브라우저에서 그대로 돌린다. 페이지 간 값은 sessionStorage(`js/store.js` 의 `go()` / `qs()`)
- Artifact 에서는 카메라가 막혀 있어 샘플 그림·사진 업로드로만 체험된다

### 배포
| 곳 | 주소 | 방식 |
|---|---|---|
| Vercel (정적) | https://took-sieunkirns-projects.vercel.app | GitHub `main` 에 push 하면 자동 배포. 설정은 `vercel.json` |
| Render (서버) | https://took-y6rn.onrender.com | `render.yaml`. 대시보드에서 Manual Deploy. 무료 플랜이라 15분 쉬면 잠들고 깨는 데 약 50초 |

- 공개 사이트라 올리브영 수집 데이터와 상품 이미지가 외부에 보인다는 점에 유의
- 임시 https 주소가 필요하면: `cloudflared tunnel --url http://localhost:3000`

---

## 데이터

| 출처 | 파일 | 내용 | 쓰는 곳 |
|---|---|---|---|
| 올리브영 수집 (실제) | `src/data/products.oliveyoung.json` | 립 제품 272개(중복 12개 삭제, 이유는 `products-removed.json`) | 서버·정적 버전 |
| 올리브영 호수 (실제) | `src/data/shades.oliveyoung.json` → `products.shades.json` | 200개 제품·2,033호수 | 거울·추천·호수 안내·NFC |
| 시연용 가상 제품 | `src/data/products.json` | 27개 (바코드 있음) | 단위·e2e 테스트, `TOOK_DATA=virtual` |
| 시연용 호수·재고 | `src/data/products.demo.json` | 가상 11종 42개 | 호수 안내. 화면에 '시연용' 배지 |
| 영어 이름 | `src/data/oliveyoung.global.raw.json` | 글로벌 올리브영 319개 | 영어 버전 |

- **지어내지 않는다**: 수집하지 않은 정보(바코드·색 이름·설명 등)는 비워 두고 '정보 없음'으로 보인다. 색 계열·제형은 색값·상품명으로 **추정**한 값이며 화면에 그렇게 표시한다
- 호수 이름·바코드는 올리브영 옵션 목록, 색상값은 색 칩 사진에서 뽑은 추정값(`color_source`). 칩 사진을 쓸 수 없는 호수는 빼고 `skipped` 에 적는다
- 호수가 없는 제품은 거울 화면 목록(추천·검색)에서 뺀다(`src/lib/catalog.js`). ID·바코드로 찾기는 된다
- 영어로 답할 때는 영어 이름이 있는 제품 안에서만 추천한다. 이름을 지어내지 않는다
- 대표 이미지는 `public/images/lip-tints` (크롤링 폴더에서 복사)

### 시연용 표시 · 실데이터만 보기
- 판단은 `src/lib/catalog.js` 의 `isDemo(제품)` 하나: `source` 가 `oliveyoung` 이 아니면 시연용이다
- 화면 표시는 `public/js/demo.js` 의 `demoBadge()` 하나(무채색 테두리 '시연용' / 'Demo'). 제품 카드·호수 안내·가져가기·매장 재고 창에 붙는다
- **실데이터만 보기**: 아무 화면 주소에 `?real=1` 을 붙여 한 번 열면 그 기기에서 계속 켜진다(`localStorage['took.realOnly']`), `?real=0` 으로 끈다. 켜면 시연용 제품·호수가 추천·검색·바코드·이름 찾기에서 빠지고 매장 재고 칸·버튼도 숨는다
- 서버 전체로 켜려면 환경변수 `TOOK_REAL_ONLY=1`. 화면은 요청마다 `X-Took-Real-Only: 1` 머리말로 알린다

### 데이터 다시 만들기
```bash
npm run import:oliveyoung [크롤링 JSON]   # 기본 ../크롤링c/oliveyoung_lip_tints.json, 이미지도 다시 복사
npm run match:global                      # 영어 이름 붙이기
npm run import:shades                     # 호수 원본 → products.shades.json
npm run seed                              # 가상 제품 다시 만들기
```

### 호수 수집·검수
1. 올리브영 페이지에서 `scripts/shades-collect.browser.js` 실행 (서버 직접 요청은 403 이라 브라우저로만) → `src/data/shades-raw/`
2. `npm run shades:build` — 자동 판정(ok 사용 · bad 제외 · review 는 사람 검수). 기준은 `scripts/build-shades-source.js` 의 `classify`
3. `npm run shades:server` → `/review`(애매한 것만 넣기/빼기) · `/all`(전체 검수·색 고치기·되돌리기·'앱에 반영')

---

## 직원용 화면

| 화면 | 여는 법 | 하는 일 |
|---|---|---|
| 관리자 `admin.html` | 시작 화면 5초 길게 누르기 | 터치 범위 조정·조정값 복사, NFC 태그 확인, 아래 시험 화면들로 이동 |
| NFC 테스트 `nfc-test.html` | 관리자 | 리더기 입력·태그 해석 확인 |
| 터치 보정 `calib.html` | 주소 또는 `?calib=1` | 거울 유리 터치 필름 좌표 보정(십자 5개) → 정확도 테스트(동그라미 9개) |
| 카메라 색 보정 `color-calib.html` | 관리자 → '카메라 색 보정' | 흰 종이를 가운데 네모에 대고 측정 → 카메라 색 틀어짐을 되돌릴 값(채널별 이득)을 저장, 웹캠이 되면 자동 색·밝기 고정. 내 톤 추천이 눈 흰자 대신 이 값을 쓴다(`js/color-calib.js`). 어느 기기에서나 같게 쓰려면 '보정값 복사'의 `C1.…` 코드를 `BUILT_IN_CODE` 에 |
| PC 미리보기 `preview.html` | 노트북에서 열면 자동 | 필름 흉내·보정 시험, 필름 색 시뮬레이션 |

- 터치 보정값은 그 브라우저 localStorage 에 남는다. 어느 기기에서나 같은 값을 쓰려면 관리자에서 복사한 `T1.…` 코드를 `js/touch-calib.js` 의 `BUILT_IN_CODE` 에 넣는다

---

## 구조

```
server.js                 정적 파일 + REST API (Node 내장 http, 런타임 의존성 없음)
src/lib/                  서버·브라우저 공용 (목록은 browser-libs.js)
  color.js                HEX/HSL/Lab 변환, CIEDE2000
  repository.js           제품 저장소 (JSON, 이후 DB 교체 지점)
  catalog.js              화면에 보일 제품 목록(호수 있는 제품만)
  recommend.js            색 기반 추천
  spoken.js               말·입력 보정 (한글 금액, 비슷한 발음)
public/
  index.html              시작 화면
  palette.html            거울 (Find Your Color)
  shades.html product.html recommend.html   호수 안내·제품 상세·색상 추천
  kiosk.html              5:8 화면 틀
  js/                     lip-*.js 입술 추적·칠하기 · palette*.js 거울 · nfc*.js NFC
                          · takeaway.js 가져가기 · i18n.js 한/영 문구 · idle-reset.js · touch-calib.js · nav.js 상단 메뉴
  css/                    took-ui.css(시작·거울) · took-flat.css(어두운 화면) · took-nfc.css · took-take.css · wireframe.css(공통)
scripts/                  데이터 변환·호수 수집·빌드·키오스크 실행
test/                     unit · e2e
android/                  APK 소스 (아이콘 원본 icon/mark.svg, 만든 PNG res/)
```

옛 화면 `lip-together.html`(립 컬러 매핑)은 파일이 남아 있지만 손님 흐름에는 없다.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/products?finish=` | 전체 제품 |
| GET | `/api/products/:id` | 제품 상세 (없으면 404) |
| GET | `/api/products/barcode/:code` | 바코드 번호로 찾기 → `{found, product}` (형식 오류 400). NFC 태그에 써 둔 바코드 번호로 찾을 때 쓴다 |
| GET | `/api/shades` | 호수 데이터 |
| GET | `/api/demo-products` | 시연용 호수·재고 데이터 |
| GET | `/api/recommend?hex=&finish=&limit=&exclude=` | 색차(ΔE2000) 가까운 순 추천 |

## 추천 규칙
- 유사도 = `max(0, 100 − 2 × ΔE2000)`. 무작위 요소 없음
- 호수가 있는 제품은 가장 가까운 호수로 보여 준다

---

## 실제와 시연 구분 · 남은 일
- **가짜**: 매장·재고(`store-stock.js`), 시연용 호수 42개, 가상 제품 27개
- **추정값**: 호수 색(칩 사진), 색 계열·제형(색값·상품명)
- **확인 안 됨**: APK 의 카메라 흐름
- NFC 테스트 카드 1·3번은 글자가 빠진 번호로 등록돼 있다(부분 일치로 인식). 온전한 번호를 받으면 `NFC_TAGS` 를 바꿀 것
- 입술 추적은 정면 얼굴 1명 기준. 조명에 따라 색이 달라질 수 있다
- 계정·서버 저장(히스토리 등)은 없다. 개인화는 한 손님 세션 안에서만

## 삭제한 기능 (복구는 git 기록에서)
- 2026-11-11: 휴대폰 NFC 읽기(`nfc-phone.html`), 바코드로 찾기 화면(`find.html`), 호수 매대 위치 안내
- 2026-11-13: 휴대폰 QR 바코드 연결(`scan-phone.html`·`/api/pair`), 음성 정확도 측정(`voice-test.html`)
- 2026-11-17: 카메라 설정 ⚙ 버튼(저장된 설정은 계속 적용), 자동 초기화의 '계속'·'처음으로' 버튼
- 2026-11-20: 카메라 바코드 읽기 전부 — 거울 웹캠 자동 읽기, 챗봇 바코드 버튼·'바코드 비추기' 창, 합본 화면 바코드 탭(카메라·사진·번호 입력), 관리자 바코드 카메라 테스트(`barcode-test.html`), `js/barcode-scan.js`·ZXing 복사. NFC 태그에 써 둔 바코드 번호로 찾기와 `/api/products/barcode` 는 남김
- 2026-11-22: AI 뷰티 챗봇 전부 — `chat.html`, `js/chat*.js`, 규칙 챗봇·LLM 보조·말투 A/B(`src/lib/chat*.js`·`llm/`·`ab.js`·`claims.js`·`situations.js`·`aliases.js`), `/api/chat`·`/api/ab-*`, 챗봇 평가(`eval:chat`·`eval:friendly`·`test/eval`), 합본 화면 `studio.html`, 홈 4번의 음성(챗봇) 버튼, 거울 왼쪽 메뉴의 음성 버튼·'이 컬러로 제품 찾기', NFC 시트의 '챗봇에게 물어보기', 제품 카드의 '챗봇에 담기', 제품 상세·색상 추천의 '챗봇에 질문하기', 상단 챗봇 플로팅 버튼·모달, 거울 플로팅 퀵 추천(`js/mirror-quick.js`·말풍선·'마음에 안 드세요?'·`/api/price-range`), 거울 첫 화면 안내(`js/fc-intro.js`)
- 2026-11-22: USB 바코드 스캐너 — 없는 기능으로 정리(문서·흐름도에서 뺌). 바코드 스캐너 기기를 쓰지 않는다
- 그 전: iPad·갤럭시탭 기준 실행, 상단 메뉴, 거울·NFC 옛 테스트 화면
