# 실제 뷰티 상담·대화형 커머스 챗봇의 첫인사·온보딩 사례 (조사일 2026-11-09)

조사 방법: 웹 검색 약 20회와 일부 원문 열람. 원문을 열어 본 것은 Ulta AI 안내 페이지와 한국경제 2026-03-02 기사 두 건이고, 나머지는 검색 결과 요약과 스니펫에 의존했다. 그래서 "원문 미확인"이라고 적은 항목은 보고서에 쓰기 전에 다시 확인해야 한다. 앞선 오픈소스·프레임워크 조사(`툭 뷰티 챗봇 오픈소스 조사/`)와 겹치는 내용은 넣지 않았다.

## Q1. 주요 브랜드 챗봇은 대화를 어떻게 여는가 (실제 첫 메시지 문구와 구조)

### Takeaway
공개 자료에서 첫 메시지 문구가 실제로 확인되는 사례는 많지 않다. 확인된 것은 Sephora Kik(2016)와 Ulta AI(2026) 정도다. 공통 구조는 세 단계다. ① 친구 같은 자기소개("beauty bestie"), ② 무엇을 도와줄 수 있는지 한 줄, ③ 곧바로 짧은 질문(퀴즈나 피부 고민)으로 들어가기. 국내 브랜드(올리브영, 아모레, LG생활건강)는 첫 문구를 공개한 기사를 찾지 못했다.

### Cited Findings
**Sephora — Kik 봇 (2016, 옛 사례)**
- 2016년 4월 뷰티 리테일러로는 처음 Kik에 들어갔다 — [Cosmetics Business](https://cosmeticsbusiness.com/sephora-becomes-first-beauty-retailer-to-join-chatbot-app-kik-117206), [Global Cosmetics News](https://www.globalcosmeticsnews.com/sephora-drives-chat-driven-commerce-with-kik-debut/)
- 첫인사 구조는 짧은 환영과 함께 "채팅으로 메이크업 팁과 리뷰를 받을 수 있다"고 소개하는 것이었다. 이어서 메이크업 스타일을 알기 위한 짧은 퀴즈를 할지 묻는다. 보도에 인용된 문구는 "Do you want to take a short quiz so I can get to know your makeup style?"(원문이 15단어를 조금 넘어 그대로 옮김, 2차 인용) — [AITopics(Retailers experiment with chatbots)](https://aitopics.org/doc/news:470B3367), [PYMNTS](https://pymnts.com/trends/cosmetics-retail)
- 콘텐츠로는 튜토리얼, 하우투 영상, 평점과 리뷰를 제공했다 — [Digiday](https://digiday.com/brands/see-kik-sephora-bets-messaging-apps-e-commerce/)
- 사용자 평: "가장 기본적인 말에도 조금 헷갈려 했다" — [Yahoo(I Love Sephora, But I Love This Beauty Robot More)](https://www.yahoo.com/news/love-sephora-love-beauty-robot-190056485.html)

**Ulta Beauty — Ulta AI (2026-04 출시, Gemini 기반)**
- 자기소개 문구는 "Meet your new beauty bestie"이고, 스스로를 "AI-powered shopping assistant"라고 부른다. 목표로 내건 말투는 "a conversation with a friend who knows your beauty routine"이다 — [Ulta AI 안내 페이지](https://www.ulta.com/guestservices/ways-to-shop/ai-chat)
- 할 수 있는 일로 피부 타입·헤어 목표·고민을 말하면 추천, 제품 비교, 성분 설명, 루틴 구성, 선물 추천을 내세운다. 페이지에 고정 스타터 프롬프트는 없다 — [Ulta AI 안내 페이지](https://www.ulta.com/guestservices/ways-to-shop/ai-chat)
- 고지 사항: 부정확할 수 있으니 확인할 것, 의료 조언이 아님, 대화가 기록될 수 있으니 민감정보는 넣지 말 것. 주문·반품·리워드 조회는 할 수 없다고 미리 밝힌다(한계를 먼저 알려 기대치를 맞춤) — [Ulta AI 안내 페이지](https://www.ulta.com/guestservices/ways-to-shop/ai-chat)
- Gemini Enterprise for CX 기반이고 로열티 회원 4,600만 명의 데이터를 활용한다. 웹에서 먼저 열고 앱은 뒤이어 확대한다 — [Google Cloud Press Corner 2026-04-22](https://www.googlecloudpresscorner.com/2026-04-22-Ulta-Beauty-and-Google-Introduce-Gemini-Enabled-Shopping-Experiences-That-Streamline-Beauty-Discovery-and-Purchase), [PYMNTS](https://www.pymnts.com/?p=3674881)

**L'Oréal Paris — Beauty Genius (2024 가을 미국 출시)**
- 웹사이트에서 쓰거나 매장에서 QR을 찍어 들어올 수 있다. 미국에서 먼저 열고 영국·프랑스로 넓힐 계획이었다(검색 요약 기준) — [Chain Drug Review](https://chaindrugreview.com/meet-beauty-genius-the-first-ai-beauty-assistant-from-loreal-paris), [L'Oréal 기사](https://www.loreal.com/en/articles/science-and-technology/loreal-paris-beauty-genius/)
- 대화 설계 원칙은 "가능한 한 자연스럽게, 그래서 어시스턴트가 질문을 많이 던진다"는 것이다(L'Oréal 뷰티테크 디렉터 Béatrice Dautzenberg 인터뷰) — [Formes de Luxe](https://www.formesdeluxe.com/article/beatrice-dautzenberg-global-director-of-beauty-tech-services-l-oreal-the-group-is-at-an-inflexion-point-when-it-comes-to-beauty-tech.64465)
- 기능은 진단, 루틴 추천, Q&A이고 750개 이상 제품에서 추천한다. 대화가 "private and secure"하다는 것과 부정확할 수 있다는 고지를 함께 둔다 — [L'Oréal Paris USA](https://www.lorealparisusa.com/beautygenius), [L'Oréal 기사](https://www.loreal.com/en/articles/science-and-technology/loreal-paris-beauty-genius/)
- WhatsApp 채널을 2025-07에 발표했고, 2026년부터 운영 중이라는 표기가 있다. 사이트 문구는 WhatsApp에서 "ask me anything"이다 — [YPulse 2025-07-09](https://www.ypulse.com/newsfeed/2025/07/09/loreals-new-partnership-with-whatsapp-will-let-users-text-their-ai-tool/), [MBS Group](https://www.thembsgroup.co.uk/external/loreal-paris-to-launch-ai-powered-beauty-genius-on-whatsapp-in-2026/)
- 첫 메시지 실제 문구는 찾지 못했다(Gaps 참고).

**Sephora — ChatGPT 앱 (2026-03-24 미국 파일럿)**
- ChatGPT 안에서 뷰티 질문을 하면 Sephora 카탈로그와 "beauty knowledge"를 바탕으로 큐레이션 추천을 준다. Beauty Insider 계정을 연결하면 프로필·구매이력을 반영한다. 결제는 Sephora 사이트로 넘어간다 — [Sephora Newsroom](https://newsroom.sephora.com/sephora-app-in-chatgpt-brings-a-new-personalized-beauty-experience/), [Retail Dive](https://retaildive.com/news/sephora-chatgpt-app-launch/815751/), [Chain Store Age](https://chainstoreage.com/sephora-pilots-app-within-chatgpt)
- 셀카 기반 피부 진단 기능은 한 매체만 언급했다(미확인) — [Personal Care Insights](https://www.personalcareinsights.com/news/sephora-chatgpt-beauty-app.html)

**Estée Lauder — Voice-Enabled Makeup Assistant (2023-01, 영국)**
- 시각장애인용 음성 앱이다. 카메라로 립·아이섀도·파운데이션이 고르게 발렸는지 판단해 음성으로 알려준다(대화형 커머스라기보다 음성 코칭) — [ELC 보도자료](https://www.elcompanies.com/en/news-and-media/newsroom/press-releases/2023/11-01-2023), [Voicebot.ai](https://voicebot.ai/2023/01/19/estee-lauder-debuts-voice-enabled-makeup-assistant-app/)

**아모레퍼시픽 — 아모레챗(AMORE CHAT)**
- 2025-05-23 아모레몰에 고객 상담용 생성형 AI 챗봇으로 열었다 — [아주경제](https://www.ajunews.com/view/20250523093118139), [아모레퍼시픽 뉴스](https://www.apgroup.com/int/ko/news/2025-05-23-1.html)
- 2026-02에 피부 진단과 화장품 추천을 더했다. 누적 이용자 10만 명이고 분기 이용률은 증가 중이다. 앞으로 "오프라인 카운슬러 수준"의 AI 뷰티 전문가로 키울 계획이다 — [한국경제 2026-03-02 "웜톤에 어울리는 틴트 추천해줘"](https://www.hankyung.com/article/2026030238111)
- 국내 기업 최초로 ChatGPT 안에 '아모레몰' 앱을 냈다 — [코스모닝](https://www.cosmorning.com/mobile/article.html?no=52362), [CNC뉴스](https://www.cncnews.co.kr/mobile/article.html?no=10793)
- 첫인사 문구와 말투를 다룬 기사는 찾지 못했다.

**CJ올리브영**
- 2026년 말 앱에 AI '대화형 검색'을 넣을 계획이다. "건성인데 추천해줘"로 시작해 후속 질문을 이어가면 추천을 다시 정렬하고 좁혀 준다. 리뷰 4,700만 건 이상을 LLM과 결합한다 — [한국경제 2026-03-02](https://www.hankyung.com/article/2026030238111)
- 2026-07: 외국인 비중이 높은 매장에 'AI 쇼핑 어시스턴트' 키오스크를 두었다. AI 아바타와 실시간 대화하고, 피부 특성 기반 추천을 8개 국어로 한다. 직원 상담용 AI 통역은 38개 언어(매체에 따라 42개) — [코스모닝](https://www.cosmorning.com/mobile/article.html?no=53110), [아이뉴스24](https://www.inews24.com/view/1992202), [서플](https://supple.kr/news/cmrbg19aq000m471pyvea45ff)

**LG생활건강**
- 뷰티 상담 챗봇 관련 자료는 찾지 못했다. AI 피부 진단 패치로 CES 2026 혁신상을 받았다(6만 명 데이터) — [머니투데이 2026-01-05](https://www.mt.co.kr/living/2026/01/05/2026010511095014315)

### Inferences
- 2024~2026 생성형 뷰티 봇은 '전문가'보다 '친구'를 앞세워 자기소개를 하는 쪽으로 기울었다(Ulta "beauty bestie", L'Oréal의 "beauty expert와의 자연스러운 대화"). 툭의 첫인사도 "AI 상담원"보다 친구 같은 1인칭 자기소개가 업계 흐름에 맞는다.
- 2016 Sephora Kik의 "환영 → 할 수 있는 일 → 짧은 퀴즈 제안" 3단 구조는 지금 봐도 유효한 뼈대다. 툭은 매장에서 이미 퀴즈(조색) 결과를 갖고 오므로 퀴즈 단계를 "방금 만든 색 확인"으로 바꿔 넣을 수 있다.
- 업계 표준 고지(부정확할 수 있음, 민감정보 금지, 못 하는 일)는 첫 화면이나 첫 메시지 아래 작은 글씨로 두는 방식이 일반적이다. 첫 말풍선 본문에 넣지는 않는다(Ulta 사례에서 추정).

### Gaps
- Beauty Genius, 아모레챗, 올리브영 AI 어시스턴트, Sephora ChatGPT 앱의 실제 첫 메시지 문구는 공개 자료에서 찾지 못했다. 직접 써 보고 캡처해야 확인된다.
- 카카오톡 브랜드 챗봇의 웰컴 블록 문구 사례는 이번 검색으로 찾지 못했다. 오픈빌더가 말풍선과 바로연결(퀵리플라이) 버튼을 지원한다는 사실만 확인했다 — [카카오 보도자료](https://www.kakaocorp.com/page/detail/8476)
- 네이버 톡톡 뷰티 브랜드 챗봇 사례는 조사하지 못했다.

## Q2. 온보딩 패턴: 인사 + 자기소개 + 할 수 있는 일 + 퀵리플라이, 맥락 이어받기, 매장→폰 핸드오프

### Takeaway
매장에서 폰으로 넘기는 대표 공개 사례는 L'Oréal Beauty Genius(매장 QR → 웹 대화)다. 다만 매장에서 만든 결과를 그대로 이어받아 대화를 여는 사례는 공개 자료에서 찾지 못했다. Sephora Color IQ는 매장 스캔 결과를 프로필에 저장해 앱에서 다시 보게 하지만, 사용자 불편이 보고돼 있다. 툭의 "조색 결과를 들고 폰 챗봇으로 넘어가 이어 말하기"는 공개 사례 중에서 드문 축에 속한다.

### Cited Findings
- **매장 QR → 웹 챗봇**: Beauty Genius는 매장에서 QR을 찍어 들어갈 수 있게 설계했다 — [Chain Drug Review](https://chaindrugreview.com/meet-beauty-genius-the-first-ai-beauty-assistant-from-loreal-paris)
- **매장 측정값 → 앱 프로필**: Sephora Color IQ는 매장 스캔 번호가 프로필 'Beauty Traits'에 저장돼야 앱에서 보인다. 예전 색으로 되돌릴 수 없고 앱에서 수정이 잘 안 된다는 불만이 커뮤니티에 있다(커뮤니티 답변, 공식 문서 아님) — [Sephora Community](https://community.sephora.com/t5/Customer-Support/Color-IQ-updates-within-the-app/m-p/4045852), [Sephora Community](https://community.sephora.com/t5/Insiders/How-can-I-find-my-IQ-number/m-p/2882152)
- **계정 연결 → 개인화 대화**: Sephora ChatGPT 앱은 Beauty Insider 연결 시 선호와 구매이력을 반영한다 — [Sephora Newsroom](https://newsroom.sephora.com/sephora-app-in-chatgpt-brings-a-new-personalized-beauty-experience/)
- **국내 맞춤 립 매장(비교 대상)**: 헤라 센슈얼 립 커스텀 매치(2024-12, 아모레성수)는 3가지 제형, 142색, 5가지 향으로 약 2천여 조합을 낸다. 예약제이고 전문가 1:1 상담 → 피부톤 측정 → 현장 제조 순서다. 2026-05 아모레용산에는 '셀프 컬러 진단' 콘텐츠를 더했다. QR·모바일 연동은 확인하지 못했다 — [아모레퍼시픽 뉴스 2024-12-06](https://www.apgroup.com/int/ko/news/2024-12-06-1.html), [디지털데일리 2026-05-07](https://www.ddaily.co.kr/page/view/2026050713545520379), [한국경제](https://www.hankyung.com/article/202605071375i)
- 아모레성수 입구에서는 웹 체크인으로 체험 교환권을 모바일로 받는다(립 조색과는 별개) — [데일리안](https://www.dailian.co.kr/news/view/1672806/)
- 아모레퍼시픽은 맞춤 립 제조 시스템 '컬러 테일러'로 CES 2021 혁신상을 받았다(옛 사례) — [아모레퍼시픽 R&D 뉴스](https://www.apgroup.com/int/ko/about-us/research-innovation/rni/rnd-news/2020-12-17.html)
- **웰컴 메시지 일반 원칙(벤더 가이드, 연구 아님)**:
  - 짧게 쓴다. 3~4문단이나 로봇 같은 말투는 이탈을 부른다 — [ProProfs Chat](https://www.proprofschat.com/blog/chatbot-welcome-messages-best-practices)
  - 무엇을 도울 수 있는지 분명히 말한다 — [LiveChatAI](https://livechatai.com/blog/ai-bot-welcome-message-examples)
  - 퀵리플라이와 버튼을 주제 메뉴로 쓴다. 답이 너무 빨리 뜨면 읽지 못하므로 간격을 둔다 — [Chatbot.com](https://www.chatbot.com/academy/chatbot-designer-free-course/welcome-messages)
  - AI와 대화 중임을 밝힌다 — [Ada docs](https://docs.ada.cx/docs/automation/greetings/best-practices)
  - NN/g 같은 연구기관의 인사말 연구는 이번 검색에서 나오지 않았다.

### Inferences
- 툭의 첫 메시지는 업계 3단 구조(인사·자기소개 → 할 수 있는 일 → 퀵리플라이)에 "맥락 확인" 한 단계를 앞에 붙이는 형태가 자연스럽다. 예: "방금 만든 색(hex 칩, 매트, 진하기 중간) 잘 받아왔어요" → "웜 가을 톤에 맞춰 3개 골라 뒀어요" → [추천 보기] [색 다시 조정] [발색 팁]. 퀴즈를 다시 시키지 않는 것이 이어받기의 핵심 가치다(Color IQ 불만 사례에서 추정).
- QR 핸드오프 뒤 첫 화면에서 매장 결과가 바로 보이지 않으면 "다시 처음부터"라는 인상을 주기 쉽다. 결과 칩(색 견본)을 첫 말풍선에 시각적으로 띄우는 편이 안전하다(추론).
- 한국 매장(헤라)은 사람 카운슬러 중심이고 셀프 진단은 2026년에야 들어갔다. 툭은 "매장 셀프 조색 + 폰 대화 이어가기"를 차별점으로 내세울 수 있다(추론).

### Gaps
- 영수증·SMS로 매장 결과를 폰 챗봇에 넘긴 리테일 사례의 구체 데이터는 찾지 못했다.
- Beauty Genius가 매장 QR로 들어온 사용자에게 다른 첫인사를 주는지는 확인하지 못했다.

## Q3. 공개된 성과 지표와 실패 사례

### Takeaway
성과 수치는 대부분 회사 발표이고 기준선이 빠져 있다. Beauty Genius 대화 수(50만 → 120만), 아모레챗 누적 10만 명이 대표 수치다. 실패 쪽 핵심 교훈은 2017년 Messenger 봇 붐이 꺼진 일이다. 할 수 없는 일까지 '대화'로 떠안으려 한 봇이 실패했다.

### Cited Findings
- Beauty Genius: 2025-07 WhatsApp 발표 때 약 50만 건 대화, 이후 L'Oréal 페이지에 미국 120만 건 이상(회사 주장) — [YPulse](https://www.ypulse.com/newsfeed/2025/07/09/loreals-new-partnership-with-whatsapp-will-let-users-text-their-ai-tool/), [L'Oréal 기사](https://www.loreal.com/en/articles/science-and-technology/loreal-paris-beauty-genius/). "첫 두 달 5만 건"이라는 보도도 검색 요약에 나왔지만 원문을 확인하지 못했다.
- 아모레챗: 누적 10만 명, 분기 이용률 증가 — [한국경제](https://www.hankyung.com/article/2026030238111)
- Ulta AI: 초기 전환율이 올랐다는 보도는 있으나 구체 수치가 담긴 원문은 열지 못했다. 회사는 확대에 신중한 입장이다 — [Pulse(요약 기사)](https://www.pulse.bot/ecommerce/news/ulta-beauty-shares-early-ai-assistant-results-as-ecommerce-growth-outpaces-sales-in-physical-stores-e4e513ab-0cbe-4cb6-a6f1-1f561b8f3325/)
- Sephora Reservation Assistant(Messenger, 옛 사례): "예약 전환율 11% 높음"이라는 수치는 벤더 블로그의 2차 정리여서 신뢰도가 낮다. Sephora 원 발표는 확인하지 못했다 — [messengerbot.app](https://messengerbot.app/15-chatbot-examples-from-real-businesses-that-drove-millions-in-revenue-2026-case-studies/)
- **실패**: 2017년 Facebook Messenger 봇이 요청의 약 70%를 처리하지 못했다는 보도가 나왔고(The Information 인용, 공식 수치 아님), Facebook은 "더 좁은 범위"로 방향을 틀었다 — [Motley Fool](https://www.fool.com/investing/2017/02/28/facebook-incs-chatbots-hit-a-70-failure-rate.aspx), [MediaPost](https://www.mediapost.com/publications/article/295718)
- Everlane은 Messenger 봇을 접고 이메일로 돌아갔다. 한 에이전시 임원은 유틸리티를 넘어 '수다형 봇'이 되려 한 것이 문제라고 짚었다 — [Digiday](https://digiday.com/marketing/brand-bot-backlash-begun/)
- Sephora Kik 봇은 기본 표현도 잘 못 알아들었다는 리뷰가 있다(2016) — [Yahoo](https://www.yahoo.com/news/love-sephora-love-beauty-robot-190056485.html)

### Inferences
- 친근함은 할 일이 분명할 때 효과가 난다. 툭은 "조색 결과 설명·추천 3개·색 조정"이라는 좁은 범위를 첫인사에서 밝히고, 범위 밖 질문에는 정중하게 되돌리는 쪽이 2017년 실패를 피하는 길이다.
- 국내 사례에서도 '10만 명' 같은 누적 수치만 공개된다. 툭이 자체 지표(QR 스캔 → 첫 응답률, 퀵리플라이 클릭률, 추천 제품 탭률)를 정해 두면 비교 근거가 생긴다(추론).

### Gaps
- 첫인사 문구를 바꿔 A/B 테스트한 공개 결과(뷰티 분야)는 찾지 못했다.
- 국내 뷰티 챗봇 종료 사례나 불만 기사는 찾지 못했다.

## Q4. 2024~2026 생성형 AI 뷰티 어시스턴트는 말투를 어떻게 정하는가

### Takeaway
글로벌 3사(L'Oréal, Ulta, Sephora)는 모두 "친구 또는 전문가와의 자연스러운 대화"를 내걸고, 질문을 많이 던져 개인화한다. 동시에 부정확할 수 있음, 의료 조언 아님, 개인정보 주의를 꼭 고지한다. 채널은 자사 웹·앱에서 WhatsApp과 ChatGPT 같은 외부 대화 플랫폼으로 넓어지는 중이고, 국내도 아모레몰 ChatGPT 앱, 올리브영 대화형 검색으로 같은 흐름을 탄다.

### Cited Findings
- Ulta: "beauty bestie", "친구 같은 대화"를 목표로 하고, 못 하는 일과 면책을 분명히 적는다 — [Ulta](https://www.ulta.com/guestservices/ways-to-shop/ai-chat)
- L'Oréal: 자연스러운 대화를 위해 질문을 많이 던진다. 부정확할 수 있다는 고지를 둔다 — [Formes de Luxe](https://www.formesdeluxe.com/article/beatrice-dautzenberg-global-director-of-beauty-tech-services-l-oreal-the-group-is-at-an-inflexion-point-when-it-comes-to-beauty-tech.64465), [L'Oréal Paris USA](https://www.lorealparisusa.com/beautygenius)
- Sephora: 원할 때 어디서나 조언받게 하겠다며 ChatGPT로 확장했다 — [Sephora Newsroom](https://newsroom.sephora.com/sephora-app-in-chatgpt-brings-a-new-personalized-beauty-experience/)
- Ulta도 ChatGPT 앱에서 뷰티 목표를 말하면 맞춤 번들을 추천한다(출시일 미확인) — [Personal Care Insights](https://www.personalcareinsights.com/news/ulta-beauty-chatgpt-plugin.html)
- 국내: 아모레퍼시픽이 국내 최초로 ChatGPT 앱을 냈고, 올리브영은 리뷰 기반 대화형 검색을 준비 중이다. 한국경제 기사 제목의 예시 질의는 "웜톤에 어울리는 틴트 추천해줘"이다(톤 기반 립 추천이 대표 질문으로 꼽힘) — [한국경제](https://www.hankyung.com/article/2026030238111), [코스모닝](https://www.cosmorning.com/mobile/article.html?no=52362)
- 국내 AI 기본법에 따라 AI 콘텐츠 표시 의무를 다룬 화장품 업계 기사도 있다(세부 미확인) — [CNC뉴스](https://cncnews.co.kr/news/article.html?no=9820)

### Inferences
- 한국 사용자가 실제로 던지는 대표 질문이 "웜톤 + 틴트 추천"형이라는 점은 툭의 입력(퍼스널 시즌 + 립 결과)과 정확히 맞는다. 첫 퀵리플라이로 "내 톤에 맞는 이유" 설명을 두면 수요와 맞을 가능성이 높다(추론).
- 친근한 말투(해요체, 1인칭, 짧은 문장)와 함께 "AI라서 실제 발색은 다를 수 있어요" 같은 한 줄 고지를 두는 것이 업계 관행과 국내 AI 기본법 흐름에 모두 맞는다(추론, 법적 해석은 별도 확인 필요).

### Gaps
- 국내 브랜드 봇의 말투 가이드(해요체/반말, 이모지 사용 여부) 공개 자료는 찾지 못했다.
- Beauty Genius, Ulta AI의 페르소나 이름과 이모지 정책은 확인하지 못했다.
