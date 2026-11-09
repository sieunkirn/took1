# QR로 여는 휴대폰 웹 챗봇 UX (took 휴대폰 상담 화면)

조사일: 2026-11-09. 맥락: 매장 태블릿 QR → 휴대폰 웹(앱 설치·로그인 없음) → 매장 립 컬러 결과를 이어받아 뷰티 챗봇이 카드·바로답변(quick reply)으로 추천.
출처 신뢰도 표기: [공식] = 표준/공식 문서·동료심사 연구, [커뮤니티] = 포럼·블로그·벤더 글.

## 1. 첫 화면 설계 (인사 말풍선, 이어받은 결과, 바로답변 수, 카드 캐러셀 vs 목록, 타이핑 표시, 메시지 속도, 자동 스크롤)

### Takeaway
버튼(바로답변)과 자유 입력을 둘 다 주고, 첫 화면에서 봇이 할 수 있는 일을 분명히 밝히며, 매장 결과(색·피니시)를 다시 묻지 말고 바로 보여 줘야 한다. 바로답변은 플랫폼 상한(Google 8개, Messenger 13개)보다 훨씬 적은 3~5개, 카드 캐러셀은 소수 후보(최대 10장 이하)일 때만 쓰는 것이 근거와 맞는다.

### Cited Findings
- NN/g 사용성 연구(2018, 미국 참가자 8명): 버튼과 자유 입력 "둘 다 있어야 한다"는 결론. 선택지가 될 수 있는 곳에서 타이핑을 강요하면 짜증, 자유 입력을 없애면 제한된 웹사이트처럼 느껴짐. — [NN/g, The User Experience of Chatbots](https://www.nngroup.com/articles/chatbots/) [공식]
- 같은 연구: 봇이 이미 받은 정보(주소 등)를 이어가지 못하고 다시 묻는 것이 대표적 실패. 좋은 봇은 맥락을 추론하고 앞뒤 이동을 허용. → took에서는 매장 결과를 다시 묻지 않는 근거. — [NN/g](https://www.nngroup.com/articles/chatbots/) [공식]
- 같은 연구: 캐러셀은 "적은 수의 선택지"에는 적합, 긴 결과 목록에는 부적합. 사용자는 제일 좋은 결과를 보고 있는지 의심 → 정렬·필터 제공 권장. — [NN/g](https://www.nngroup.com/articles/chatbots/) [공식]
- 같은 연구: 사용자는 캐러셀 이미지 등 거의 모든 비텍스트 요소를 누를 수 있다고 기대; "링크·버튼은 분명히 표시될 때 가장 잘 작동". — [NN/g](https://www.nngroup.com/articles/chatbots/) [공식]
- 같은 연구: 봇이라는 사실과 할 수 있는 일을 처음에 밝혀야 사용자가 기대치를 맞추고 더 직접적인 표현을 씀. "메인 메뉴" 링크가 기능 발견에 도움. — [NN/g](https://www.nngroup.com/articles/chatbots/) [공식]
- NN/g(생성형 AI 신규 사용자 연구): 초보자는 대화형인 줄도 모르는 경우가 있고, 넓은 예시 프롬프트가 상세한 작성법 안내보다 효과적. — [NN/g, New Users Need Support with Generative-AI Tools](https://www.nngroup.com/articles/new-AI-users-onboarding/) [공식]
- NN/g: 대화창 옆 GUI 요소(제안 항목, 되묻기)가 "표현의 장벽"을 낮출 수 있음; 끝없이 스크롤되는 채팅창은 반복 수정 행동을 잘 지원하지 못함. — [NN/g, Response Outlining](https://www.nngroup.com/articles/response-outlining/), [NN/g, Accordion Editing and Apple Picking](https://www.nngroup.com/articles/accordion-editing-apple-picking/) [공식]
- Google 대화 설계 가이드: 칩(바로답변) 턴당 최대 8개, 칩당 최대 25자, 훑어보기 쉽게 짧게; 칩을 누르면 그 글자가 사용자 답이 됨. (Actions on Google은 지원 종료된 플랫폼이라 수치는 참고용) — [Google Conversation Design: Chips](https://developers.google.com/assistant/conversation-design/chips?hl=en) [공식]
- Meta Messenger: quick reply 최대 13개, 제목 20자 제한; generic template은 여러 개면 가로 스크롤 캐러셀, 최대 10개 요소(서드파티 문서 일치). — [Meta Quick Replies](https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages/quick-replies) [공식], [Meta Generic Template](https://developers.facebook.com/docs/messenger-platform/reference/templates/generic) [공식]
- 카카오 챗봇(오픈빌더) 가이드: 블록당 연속 말풍선 최대 3개; 카드 말풍선 버튼 최대 3개(정사각형 이미지면 2개, 가로 배열). 바로연결·캐러셀 카드 수 상한은 이번 조사에서 확인 못 함. — [카카오비즈니스 가이드: 답변 설정](https://kakaobusiness.gitbook.io/main/tool/chatbot/main_notions/setup_answer) [공식]
- 벤더 가이드 다수: 바로답변은 5개 이하가 가장 효과적; 버튼이 유일한 선택지가 아님을 알게 할 것; 의미 없는 예/아니요/확인 버튼은 피할 것. — [Genesys](https://help.genesys.cloud/articles/work-with-quick-replies-in-bot-conversations/), [Oracle Digital Assistant](https://docs.oracle.com/en-us/iaas/digital-assistant/doc/conversational-design.html), [SAP AI Quick Reply](https://www.sap.com/design-system/btp/patterns/generative-ai/ai-quick-reply/usage) [커뮤니티/벤더]
- 응답 지연 연구(Gnewuch 외, ECIS 2018): 메시지 복잡도에 맞춘 "동적 지연"이 인간다움·사회적 실재감·만족도를 높임. — [AIS eLibrary ECIS 2018](https://aisel.aisnet.org/ecis2018_rp/113/) [공식]
- 후속 실험(BISE 2022, N=202): 지연 응답은 챗봇 초보자에겐 긍정적, 숙련자에겐 반대 효과. — [BISE vol64 iss6](https://aisel.aisnet.org/bise/vol64/iss6/5) [공식]
- 고객센터 챗봇 연구: 응답 지연이 길면 만족도 하락, 단 타이핑 표시가 있으면 사회적 실재감 덕분에 부정 효과가 완화. — [From Seconds to Sentiments (PDF)](https://scholarworks.bwise.kr/erica/bitstream/2021.sw.erica/125647/1/FromSecondstoSentimentsDifferentialEffectsofChatbotResponseLatencyonCustomerEvaluations.pdf) [공식]
- Baymard: 모바일 목록에서 항목 높이가 화면 절반을 넘으면 거의 모든 사용자가 위치를 잃음; 색상 스와치는 필요 시 항목 안에서 가로 스크롤 목록으로. 탭 영역 최소 7mm×7mm, 간격 2mm. — [Baymard: Mobile Interactive Color Swatches](https://marketing-site-qhzrv66h4-baymard.vercel.app/blog/mobile-interactive-color-swatches) (Baymard 미리보기 도메인) [공식]
- Baymard: 홈페이지 캐러셀이 있는 이커머스 사이트의 46%가 사용성 문제(배너 캐러셀 기준, 상품 카드 줄과는 다른 맥락). — [Baymard: Homepage Carousels](https://baymard.com/blog/external-article-homepage-carousels) [공식]

### Inferences
- 첫 화면 구성 제안: (1) 봇 소개 + 할 수 있는 일 한 줄 → (2) "매장에서 찾은 결과" 카드(색 스와치 원, 색 이름, 피니시: 매트/글로시 등, 톤) → (3) 바로답변 3~4개(예: "이 색 제품 보기", "비슷한 다른 색", "피니시 바꿔 보기", "직원에게 묻기"). 블록당 말풍선 3개 이하는 카카오 기준과도 맞음.
- 추천 상품은 3~5장 캐러셀 + "전체 목록 보기"(목록/필터) 탈출구. NN/g의 "최선을 보고 있나" 불안 → 카드에 추천 이유(색 일치도 등) 표기.
- 타이핑 표시: 즉시 응답보다 짧은 동적 지연(내용 길이 비례) + 타이핑 점이 초보 사용자에게 유리. 단 숙련자 역효과 → 길게 끌지 말 것(정확한 ms 수치는 근거 없음, Gaps 참고).
- 긴 답은 말풍선 2~3개로 나눠 순차 표시(카카오 3개 상한과 일관). 사용자가 위로 스크롤해 읽는 중이면 자동 스크롤하지 말고 "새 메시지" 칩 표시(접근성 가이드 내용과 일치, 4장 참고).

### Gaps
- 타이핑 표시 최적 지속 시간(ms), 스트리밍 vs 청크 표시를 직접 비교한 정량 연구는 찾지 못함.
- 카카오 바로연결 버튼 최대 개수, 캐러셀 카드 최대 장수는 공식 스펙 페이지에서 확인 못 함.
- Baymard의 챗봇 전용 연구는 없음(모바일 목록 상세는 유료).

## 2. 모바일 제약 (엄지 영역, 키보드 겹침, 안전 영역, 16px 입력, 음성 입력, 접근성, 다크 모드)

### Takeaway
입력창 글자 16px 이상, 하단 고정 입력창은 iOS에서 visualViewport로 직접 보정(Android Chrome은 `interactive-widget=resizes-content`), 메시지 목록은 `role="log"`로. 음성 입력(Web Speech API)은 Android Chrome·iOS Safari에서 "부분 지원"이며 iOS 인앱 브라우저·홈 화면 웹앱에선 안 되므로 항상 선택 기능 + 키보드 받아쓰기 안내로 대체해야 한다.

### Cited Findings
- iOS Safari는 입력란 글자 크기가 16px 미만이면 포커스 시 확대; 16px 이상이면 확대 안 됨. `maximum-scale=1`로 막으면 수동 확대까지 막혀 접근성 문제. 확대된 화면은 blur 후 원래대로 안 돌아옴. — [CSS-Tricks (Josh Comeau TIL)](https://css-tricks.com/?p=339455), [Rick Strahl 2023](https://weblog.west-wind.com/posts/2023/Apr/17/Preventing-iOS-Textbox-Auto-Zooming-and-ViewPort-Sizing), [GitLab MR](https://gitlab.com/gitlab-org/gitlab/-/merge_requests/220666) [커뮤니티]
- web.dev: 화면 키보드는 브라우저 UI로 취급되지 않아 기본적으로 vh/dvh 등 뷰포트 단위를 바꾸지 않음; Chrome은 opt-in 가능. — [web.dev: viewport units](https://web.dev/viewport-units/) [공식]
- `interactive-widget=resizes-content`(viewport meta): 키보드가 열리면 레이아웃 뷰포트까지 줄어들어 dvh가 반응. Chrome 108+, Firefox 132+ 지원. — [Bramus, HTMHell 2024](https://htmhell.dev/adventcalendar/2024/4/) [커뮤니티, Chrome DevRel 저자]
- iOS Safari는 `interactive-widget`을 일관되게 따르지 않음(WebKit 버그로 지원 요청 중). — [WebKit Bugzilla 230225](https://bugs.webkit.org/show_bug.cgi?id=230225), [DEV: visualViewport로 키보드 겹침 해결](https://dev.to/franciscomoretti/fix-mobile-keyboard-overlap-with-visualviewport-3a4a) [커뮤니티]
- 우회법: visualViewport의 offsetTop + height로 보이는 하단을 계산해 resize/scroll 때마다 입력창 위치 갱신. iOS 26에서는 키보드를 닫아도 visualViewport.offsetTop이 0으로 안 돌아와 하단 고정 요소가 밀리는 회귀 버그 보고(2025). — [DEV](https://dev.to/franciscomoretti/fix-mobile-keyboard-overlap-with-visualviewport-3a4a), [Apple Developer Forums 800154](https://developer.apple.com/forums/thread/800154), [Apple Developer Forums 800125](https://developer.apple.com/forums/thread/800125) [커뮤니티]
- 홈 화면에 추가한 iOS PWA(standalone)는 키보드 관련 동작이 브라우저와 또 다름. — [DEV: iOS standalone PWA keyboard bug](https://dev.to/cederhook/fixing-the-ios-standalone-pwa-keyboard-bug-that-shrinks-your-viewport-for-good-63d) [커뮤니티]
- VirtualKeyboard API는 Chrome 94에 탑재, 브라우저 간 지원 제한적. — [Mozilla Bugzilla 1007286](https://bugzilla.mozilla.org/show_bug.cgi?id=1007286) [공식]
- 음성 입력(caniuse, 2026-10 기준 데이터): iOS Safari 14.5~27.x "부분 지원", Safari 데스크톱 14.1+ 부분, Chrome Android 부분, 삼성 인터넷 부분, Firefox는 기본 비활성(안드로이드 미지원). W3C 공식 표준 아님. — [caniuse: Speech Recognition](https://caniuse.com/speech-recognition) [공식]
- web-features(Baseline)는 음성 인식을 "제한적 가용성"으로 분류. — [Web Features Explorer](https://web-platform-dx.github.io/web-features-explorer/features/speech-recognition) [공식]
- iOS 제약: `webkitSpeechRecognition` 접두사 필요, Siri 활성화 필요, SafariViewController·홈 화면 웹앱에서 작동 안 함, 다른 WKWebView 앱(=iOS 인앱 브라우저·iOS 크롬 등)에서도 비활성. — [WebKit Bugzilla 239816](https://bugs.webkit.org/show_bug.cgi?id=239816), [caniuse 데이터(w3cub)](https://docs.w3cub.com/browser_support_tables/speech-recognition) [공식/미러]
- iPhone에서 마이크 버튼이 반응 없거나 권한 창이 안 뜨는 사례 보고 → 실제 기기 테스트 권장. — [TechNet Experts](https://www.technetexperts.com/ios-safari-speechrecognition-not-working/amp/) [커뮤니티]
- MDN: `role="log"`는 순서대로 추가되는 라이브 영역(채팅 기록이 대표 예), 기본 `aria-live="polite"`. — [MDN: ARIA log role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_log_role) [공식]
- 디자인 시스템 예: 래퍼에 `role="log"` + `aria-live="polite"` + `aria-atomic="false"`로 새 메시지만 읽힘; 목록에 aria-label. — [Toyota DX Playbook](https://dx-playbook-prev.toyota-europe.com/cds/components/chat-messages-pages/accessibility/), [Telerik Chat Accessibility](https://www.telerik.com/design-system/docs/components/chat/accessibility) [벤더]
- 스트리밍 응답을 log 안에서 계속 고치면 스크린리더가 미완성 문장을 반복해 읽음 → 별도 status 영역에 "답변 작성 중", "답변 완료"만 알리는 패턴. — [azukiazusa: accessible streaming chat UI](https://azukiazusa.dev/en/blog/accessible-streaming-chat-ui) [커뮤니티]
- 안전 영역: `viewport-fit=cover` + `env(safe-area-inset-bottom)`으로 홈 인디케이터 영역 회피. — [MDN: env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env) [공식]
- 다크 모드: `prefers-color-scheme` 미디어 쿼리. — [MDN: prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) [공식]
- 탭 영역: Baymard 최소 7mm×7mm·간격 2mm(1장 참고). Apple HIG는 최소 44×44pt 권장. — [Apple HIG: Layout/Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) [공식]

### Inferences
- 마이크 버튼은 `('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)`일 때만 노출. 카카오톡 등 iOS 인앱 브라우저에서는 사실상 안 보일 것 → "키보드의 마이크 버튼(받아쓰기)을 눌러도 돼요" 안내가 현실적 대안.
- 립 컬러 결과는 색이 핵심이므로 다크 모드에서 스와치 주변에 중립 테두리/배경을 두어 색 왜곡 인식을 줄일 것(근거 연구는 없음, 추론).
- 바로답변·전송 버튼은 화면 하단(엄지 닿는 곳)에, 상단엔 정보만. 엄지 영역 원 연구는 이번에 확인 못 함(Gaps).
- 입력창: `font-size:16px`, `position:fixed; bottom:env(safe-area-inset-bottom)` + iOS visualViewport 보정 + Android `interactive-widget=resizes-content`. iOS 26 offsetTop 버그 대응으로 키보드 닫힘(blur) 시 재계산.

### Gaps
- 엄지 영역(Hoober 등) 원 자료는 이번 조사에서 직접 확인 못 함.
- 한국어 음성 인식(ko-KR) 정확도를 iOS/Android 웹에서 비교한 자료 없음.
- caniuse가 "부분 지원"이라 표시하는 정확한 이유(continuous/interim 결과 등)는 페이지에 명시되지 않음.

## 3. QR→웹 전환 UX (스캔 성공률, 이탈 줄이기, 한국 인앱 브라우저)

### Takeaway
QR 랜딩 이탈에 대한 독립적·정량적 연구는 거의 없다. 실무적으로는 빠른 로드, 첫 화면에 매장 결과가 바로 보이기, 권한 요청 없음이 핵심이며, 한국 사용자는 기본 카메라 외에 카카오톡·네이버 QR 스캐너로 열 가능성이 높아 인앱 브라우저 호환을 반드시 확인해야 한다.

### Cited Findings
- QR 스캔량: QRStuff 자사 플랫폼 기준 동적 스캔 2024년 약 1억 50만 → 2025년 약 8,820만(12.2% 감소), 2018~19년 평균의 2.7배. 전 세계 통계 아님. — [QRStuff Scan Report](https://www.qrstuff.com/scan-report/qr-code-statistics/) [벤더]
- QR 랜딩 이탈률·로드 시간 영향에 대한 독립적 측정은 찾지 못함; 벤더 가이드는 "빠른 로드·모바일 최적화"만 일반적으로 강조. "3초 내 90% 이탈" 주장은 일화. — [Linkbreakers](https://linkbreakers.com/help/article/what-is-the-best-way-to-analyze-qr-code-performance-in-2025), [HackerNoon](https://hackernoon.com/three-things-marketers-misunderstand-about-qr-code-scan-behavior) [커뮤니티]
- 카카오톡 인앱 브라우저에서 외부 브라우저로 넘기는 `kakaotalk://web/openExternal?url=...` 스킴이 개발자 사이에서 널리 쓰임(UA에 "kakaotalk" 포함 시). 공식 문서 근거는 없음; 앱 딥링크용으로 쓰면 인앱에 머무는 문제 보고. — [Kakao DevTalk: Branch 딥링크](https://devtalk.kakao.com/t/branch/151358), [GitHub Gist 예시](https://gist.github.com/hongggyelim/934a94c8c61f3e893347f8be12f259cd) [커뮤니티]
- 사용자 수동 방법: 안드로이드는 메뉴의 "다른 브라우저로 열기", 아이폰은 공유 버튼에서 브라우저 선택. — [익스트림 매뉴얼](https://extrememanual.net/60210) [커뮤니티]
- 카카오톡 인앱 브라우저(2025): 앱 카메라 권한 허용 후에도 웹 getUserMedia가 동작 안 하거나 NotAllowedError(안드로이드) 사례; 카카오 측은 권한이 웹페이지→웹뷰→네이티브 앱 순으로 전달되며 환경에 따라 실패할 수 있다고 설명. — [Kakao DevTalk 150230](https://devtalk.kakao.com/t/deviceid-label/150230), [Kakao DevTalk 150964](https://devtalk.kakao.com/t/getusermedia-notallowederror/150964) [커뮤니티/공식 답변 포함]
- 카카오톡 링크 연결 방식에 따라 UA·쿠키 정책이 다르며, 쿠키 유실 시 localStorage/sessionStorage 우선 사용 제안. — [Kakao DevTalk 140637](https://devtalk.kakao.com/t/agent/140637) [커뮤니티]
- 인앱 브라우저는 모든 키 입력·페이지를 추적할 수 있다는 보안 우려 보도. — [ITWorld Korea](https://www.itworld.co.kr/article/3549387/) [언론]

### Inferences
- 첫 화면은 권한 요청(마이크·카메라·알림) 없이 시작. 음성은 사용자가 마이크를 누를 때만 요청(인앱 브라우저에서 권한 전달 실패 가능성이 큼).
- 페이지 `<title>`과 첫 문장에 매장/브랜드명 + "매장에서 찾은 내 립 컬러"를 넣어 "맞는 곳에 왔다"는 확신 제공.
- QR URL에 결과 ID를 짧은 토큰으로(개인정보 없이) 담아 서버에서 결과 복원 → 인앱 브라우저의 저장소 유실과 무관하게 작동.
- 강제로 외부 브라우저로 튕기지 말고, 인앱에서 기본 기능이 다 되도록 하고 "브라우저로 열기"는 선택 버튼으로.
- 인스타그램·네이버 인앱 브라우저는 Android WebView/iOS WKWebView 기반이므로 iOS에선 음성 인식 불가(2장 WebKit 근거)로 보는 것이 안전.

### Gaps
- QR 스캔 후 랜딩 이탈률, 로드 시간별 이탈의 독립 연구 없음.
- 네이버·인스타그램 인앱 브라우저 개별 이슈(저장소, 권한)에 대한 2025~2026 자료 미확인.
- 한국에서 기본 카메라 vs 카카오톡/네이버 스캐너 사용 비율 데이터 미확인.

## 4. 연속성·재방문 (대화 저장, 나중에 이어보기, 홈 화면 추가, 카카오톡 공유, 로그인 없는 개인정보 보호)

### Takeaway
로그인 없이도 "결과 토큰이 담긴 링크"를 중심으로 하면 재방문(북마크·카카오톡 공유·홈 화면 추가)을 모두 해결할 수 있다. 카카오톡 공유는 Kakao JavaScript SDK `Kakao.Share.sendDefault()`(feed 템플릿)로 가능하며 JavaScript 키와 도메인 등록이 필요하다.

### Cited Findings
- `Kakao.Share.sendDefault()`: 직접 만든 버튼에 사용, `createDefaultButton()`은 SDK 버튼. feed 템플릿 필드: content(title, description, imageUrl, link.mobileWebUrl/webUrl), itemContent, social, buttons. JavaScript 키 필요, 사이트 도메인을 앱 설정의 JavaScript SDK 도메인에 등록해야 함. 공유 모듈명은 SDK 1.43.0에서 변경. uploadImage 이미지는 5MB 이하, 최대 100일 보관 후 삭제. — [Kakao Developers: 카카오톡 공유 JavaScript](http://developers.kakao.com/docs/ko/kakaotalk-share/js-link) [공식]
- 공식 문서에는 카카오 로그인이 필요하다는 언급 없음(공유 자체는 공유하는 사람의 카카오톡에서 친구/채팅방 선택). — [Kakao Developers](http://developers.kakao.com/docs/ko/kakaotalk-share/js-link) [공식]
- 템플릿 종류: Feed, List, Location, Commerce, Text, Calendar. — [Kakao Developers (EN)](https://developers.kakao.com/docs/latest/en/kakaotalk-share/js-link) [공식]
- 알려진 문제(미확정): feed 카드 외부 링크가 눌리지 않거나 PC 카카오톡에서 "모바일에서 확인" 표시; 카드가 이미지로 도착; 하이브리드 앱 웹뷰에서 sendDefault 후 카카오톡 대신 talk-apps 페이지 노출. — [DevTalk 149598](https://devtalk.kakao.com/t/kakao-share-senddefault-weburl-mobileweburl-link/149598), [DevTalk 149528](https://devtalk.kakao.com/t/topic/149528), [DevTalk 151032](https://devtalk.kakao.com/t/javascript-sdk-share-senddefault-talk-apps-kakao-com/151032) [커뮤니티]
- iOS 홈 화면 웹앱에서는 음성 인식이 작동 안 함, 키보드 동작도 다름. — [caniuse 데이터(w3cub)](https://docs.w3cub.com/browser_support_tables/speech-recognition), [DEV](https://dev.to/cederhook/fixing-the-ios-standalone-pwa-keyboard-bug-that-shrinks-your-viewport-for-good-63d) [공식/커뮤니티]
- NN/g: 사용자는 채팅 플랫폼에 민감 정보 공유를 꺼림. — [NN/g](https://www.nngroup.com/articles/chatbots/) [공식]

### Inferences
- "결과 저장" 3단계: (1) 기본: localStorage에 대화 저장(인앱에선 유실 가능), (2) "링크 복사/카카오톡으로 나에게 보내기" — 결과 토큰 URL을 feed 카드로(스와치 이미지 + 추천 상품), (3) 선택: 홈 화면 추가 안내(단 iOS standalone은 음성 불가 → 우선순위 낮음).
- 토큰에는 이름·전화번호·얼굴 사진을 넣지 않고 색 결과·추천 ID만; 만료 기한(예: 30일) 명시 → 로그인 없이도 개인정보 부담 최소화. 웹캠 원본 이미지는 휴대폰으로 넘기지 않는 것이 안전.
- 카카오 공유 버튼은 카카오톡 인앱 브라우저에서 흔히 열릴 것이므로 실제 기기에서 링크 클릭 문제(DevTalk 보고) 반드시 테스트. 실패 대비로 Web Share API(`navigator.share`)·링크 복사 대안 제공(Web Share 지원 상세는 이번에 미확인).

### Gaps
- Kakao 공유 호출 쿼터 수치, 카카오톡 인앱 브라우저 안에서 sendDefault 동작 공식 확인 없음.
- 대화 기록 보존 기간·익명 토큰 방식에 대한 국내 개인정보 가이드는 조사 범위 밖.

## 5. 전환 흐름 (상품 카드 액션: 올리브영에서 보기·비교·저장, 사람/매장 직원 연결 시점)

### Takeaway
카드는 이미지·버튼 모두 눌리게 하고 버튼은 2~3개(예: "올리브영에서 보기", "저장", "비슷한 색")로 제한한다. 봇이 모르거나 같은 답을 반복할 때, 실패를 인정하고 매장 직원 호출 같은 "탈출구"를 제공해야 한다.

### Cited Findings
- NN/g: "실패를 인정하고 탈출구를 제공" 권장(전화번호, 상담원, 다른 채널). 사용자는 틀린 자신감보다 "모르겠다"를 선호, 같은 답 반복에 짜증. — [NN/g](https://www.nngroup.com/articles/chatbots/) [공식]
- NN/g: 복잡한 요구는 제한된 채팅 인터페이스에 맞지 않으므로 봇은 단순 과업에 집중; 사용자는 누락·최선 여부를 의심. — [NN/g](https://www.nngroup.com/articles/chatbots/) [공식]
- 카카오 카드 말풍선 버튼 최대 3개(정사각형 이미지는 2개). Instagram generic template도 요소당 버튼 3개 상한. — [카카오비즈니스 가이드](https://kakaobusiness.gitbook.io/main/tool/chatbot/main_notions/setup_answer) [공식], [Instagram DM limits 블로그](https://singhamandeep.com/?p=1544) [커뮤니티]
- Baymard: 모바일 목록 사용자는 불필요한 상세 페이지 방문을 피하려면 목록에서 충분한 정보가 필요하지만 작은 화면에서 비교가 어려움. — [Baymard: Mobile Product List](https://baymard.com/mcommerce-usability/benchmark/mobile-page-types/product-list) [공식]
- 고령자 대상 웹 챗봇 실험(N=112): 사용성이 도움 정도·재사용 의향과 연관. — [PMC7287711](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7287711/) [공식]

### Inferences
- 카드 구성: 제품 이미지 + 색 스와치 + 제품명·가격 + "매장 결과와 비슷한 정도/이유" + 버튼 2~3개. 비교는 카드 2개 선택 → 나란히 보기(목록형)로, 캐러셀 안에서 비교시키지 않기(Baymard 비교 어려움 근거).
- "올리브영에서 보기"는 외부 링크임을 아이콘으로 표시하고 새 탭; 인앱 브라우저에선 뒤로 가기로 대화로 돌아올 수 있게 대화 상태를 저장해 둘 것.
- 직원 연결 트리거: 연속 2회 이해 실패, 재고·가격·발색 테스트 등 오프라인 질문, 사용자가 "직원" 입력. 문구 예: "이건 매장 직원이 더 정확해요. 태블릿 옆 직원에게 이 화면을 보여 주세요." (화면에 결과 코드 크게 표시)
- 저장: 하트로 저장 → 4장의 공유 링크에 함께 포함.

### Gaps
- 뷰티 챗봇 카드의 CTA별 클릭률/전환율 공개 사례 연구는 찾지 못함.
- 올리브영 상품 딥링크/제휴 링크 정책은 조사하지 않음.
- Meta/카카오 외 KakaoTalk 채널 챗봇의 상담원 전환(상담톡) 세부는 미조사.
