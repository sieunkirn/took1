# APK 최종 배포 로드맵 (2026-11-22 점검)

전제: 최종 결과물은 **took.apk(앱 안 화면, 오프라인)** 하나. 노트북+모니터 Chrome 키오스크·Vercel 은 보조.
점검 기준 상태: 단위 테스트 34/34 통과, APK 27.9MB, UVC 웹캠 작업은 아직 커밋 전.

---

## 1단계 — 배포를 막는 것 (보안·서명·오프라인) · 약 1일

| # | 문제 | 위치 | 고칠 방향 |
|---|---|---|---|
| 1-1 | **디버그 키로 서명**. PC 가 바뀌면 덮어 설치 불가, 키 공개값(android) | `scripts/build-apk.js` 서명 부분 | 툭 전용 release keystore 만들고 백업(USB+클라우드). 비밀번호는 환경변수로, 저장소엔 넣지 않기 |
| 1-2 | **원격 디버깅 항상 켜짐** (`setWebContentsDebuggingEnabled(true)`) | `MainActivity.java` createWebView | 빌드 옵션(`--debug`)일 때만 켜기 |
| 1-3 | **JS 브릿지 `TookUvc` 가 모든 페이지에 노출**. `shouldOverrideUrlLoading` 이 false 라 외부 링크로 나가도 그 사이트가 브릿지를 씀 (주석은 "앱 안 화면만" 이라고 되어 있음) | `MainActivity.java` | 우리 호스트 외 주소는 막거나 외부 브라우저로. 브릿지 메서드 안에서도 현재 출처 확인 |
| 1-4 | `/__uvc/frame` 응답에 `Access-Control-Allow-Origin: *` | `MainActivity.java` shouldInterceptRequest | 우리 출처만 허용 |
| 1-5 | **글꼴을 CDN 에서 받음** (Pretendard·Inter). 인터넷 없으면 글꼴 바뀌고 900×1440 배치 틀어짐 | `index.html`·`palette.html`·`product.html` 등 `<link>` | woff2 를 `public/fonts/` 에 넣고 로컬 `@font-face` 로 |
| 1-6 | 개발·테스트 화면이 APK 에 그대로 들어감 (`nfc-test`, `preview`, `lip-together`, `calib` 등) | `scripts/build-static.js` | APK 빌드용 제외 목록 추가. 관리자(홈 5초)로 들어가는 화면만 남김 |
| 1-7 | 앱 2개(툭/툭 웹) 중 최종본 결정 | `build-apk.js` VARIANTS | 최종 = took.apk. took-web 은 개발용 옵션(`--web`)으로만 |

## 2단계 — 용량·성능 · 약 1일 (목표 27.9MB → 12MB 안팎)

| # | 문제 | 크기 | 고칠 방향 |
|---|---|---|---|
| 2-1 | MediaPipe wasm 이 SIMD/비SIMD 두 벌 | 19MB 중 9.3MB | 안드로이드 WebView(Chrome 91+)는 SIMD 지원 → APK 에서 `nosimd` 빼기 |
| 2-2 | 립 틴트 사진 285장 원본 그대로 | 16MB | 화면 표시 크기로 줄이고 WebP 변환 (빌드 단계에서) |
| 2-3 | `products.shades.json` 2.4MB, 들여쓰기 포함 | 2.4MB | APK 용은 필요한 필드만 남기고 압축(minify) |
| 2-4 | `touch-calib.js`(1,115줄)가 모든 화면에 로드. 앱에선 보정값도 비움 | — | "적용" 부분과 "보정 화면 UI" 를 나눠, 일반 화면엔 적용 부분만 |
| 2-5 | `dist/apk/` 에 옛 zip(took.zip, took (2).zip, cam.zip) 쌓임 | 53MB | 빌드 시작 때 비우기 |

## 3단계 — 클린코드 · 2~3일

| # | 문제 | 위치 | 고칠 방향 |
|---|---|---|---|
| 3-1 | 큰 파일 | `palette.js` 845줄, `touch-calib.js` 1,115줄 | 다이얼·질감·시트·NFC 연결 등 역할별 모듈로 쪼개기 |
| 3-2 | **한글 문구가 JS 에 직접** (서비스 전체 한/영 방향과 어긋남) | `palette.js` 202줄, `touch-calib.js` 181, `lip-camera.js` 75, `home.js` 55, `nfc.js` 54 | `i18n.js` 키로 모으기. 관리자 화면은 한국어만 둬도 됨(범위 정하기) |
| 3-3 | `innerHTML` 27곳 — 수집 데이터(제품명 등)가 들어가면 깨지거나 스크립트 삽입 위험 | `touch-calib.js` 13, `idle-reset.js` 3 외 | 데이터가 들어가는 곳은 `textContent`/DOM 생성으로 |
| 3-4 | 빈 `catch {}` 6곳 — 오류가 사라짐 | `api.js`, `fullscreen-keep.js`, `home.js` | 최소 `console.warn` (logcat "took" 로 남음) |
| 3-5 | 날짜·요청 이력 주석 223곳 ("2026-11-22 사용자 요청" 등) | JS·CSS·HTML·Java 전체 | 이력은 git 에 맡기고 주석엔 "왜" 만 남기기 |
| 3-6 | 지운 기능 잔재: 음성 인식 주석, `RECORD_AUDIO` 권한 매핑, package.json 설명("바코드 검색·로우파이") | `MainActivity.java`, `build-apk.js`, `package.json` | 정리 |
| 3-7 | 화면 이동 `location.href` 15곳 + `replace` 4곳 흩어짐 | `public/js/*` | `nav.js` 한 곳으로 (뒤로 가기·초기화 동작 통일) |
| 3-8 | 규칙 문서와 실제가 다름 (CLAUDE.md "무채색" vs 실제 컬러 디자인 예외 다수) | `CLAUDE.md`, `README.md` | 현재 디자인 기준으로 다시 정리 |

## 4단계 — 안정성·검증 · 1~2일

- **실기기 체크리스트**: 첫 실행 카메라 권한 → 거부 → 다시 허용 / USB 웹캠 뽑았다 꽂기 / NFC 리더기 뽑았다 꽂기 / 인터넷 끊고 전체 흐름 / 화면 회전 / 30분 방치 후 대기 화면 복귀(idle-reset) / 렌더러 죽었을 때 재시작
- **장시간 구동**: 키오스크 8시간 켜 두고 메모리·발열 확인 (`adb shell dumpsys meminfo com.took.kiosk`)
- **e2e 를 APK 대상으로**: 지금 `e2e:static` 은 정적 파일 기준 → APK 와 같은 파일(`dist/static`)로 돌리는지 확인
- **UVC 코드 테스트**: `UvcCamera.java`(612줄)·`uvc.c` 는 테스트 없음 → 최소한 연결/해제/재연결 수동 시나리오 문서화
- 가짜 데이터 표시 확인: 매장 재고(가짜)·시연용 제품 42개가 "실제 정보"처럼 보이지 않는지 (CLAUDE.md 데이터 원칙)

## 5단계 — 배포 마무리 · 반나절

- `versionCode` 를 분 단위 시각 → `package.json` version 기반(예: 1.0.0 → 10000)으로. 버전명 1.0.0
- 빌드 한 줄 문서화: 필요 도구(JDK 17, SDK, NDK r27c), release 키 위치, 명령
- 설치·초기 설정 안내(관리자 화면 진입, 웹캠 설정, 터치 보정) 1쪽 문서
- 최종 APK SHA-256 기록, 설치 후 위 체크리스트 통과 확인

---

### 추천 순서
1단계 → 2단계(빠르게 효과 큼) → 4단계 실기기 체크 → 3단계(시간 남는 만큼, 3-3·3-4·3-6 먼저) → 5단계.
3단계는 기능을 바꾸지 않는 정리라, 시연 일정이 급하면 3-1·3-5 는 배포 뒤로 미뤄도 됨.
