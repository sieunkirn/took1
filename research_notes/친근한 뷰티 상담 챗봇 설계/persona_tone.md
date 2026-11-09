# 챗봇 페르소나·말투 설계 (한/영 립 컬러 상담 챗봇 "툭/took")

> 범위: QR로 매장 태블릿에서 휴대폰으로 넘어온 고객이 쓰는 립 컬러 상담 챗봇의 페르소나·보이스톤 근거와 실무 지침.
> 조사일 2026-11-09. 검색 결과 요약과 초록 위주로 확인했으며, 원문 전체를 읽지 못한 경우 그렇게 표시함.

## 1. 연구가 말하는 챗봇 성격: 따뜻함 vs 유능함, 의인화, 이름·아바타, 자기노출, 유머가 신뢰·만족·구매에 미치는 영향

### Takeaway
따뜻함과 유능함은 둘 다 신뢰를 거쳐 만족·구매로 이어지지만, 구매 의향에는 유능함 쪽 근거가 더 일관적이다. 의인화는 기대치를 부풀리는 양날의 칼로, 문제를 못 풀거나 고객이 화났을 때 역효과가 크다. 립 컬러 상담처럼 즐거움 위주(hedonic)이고 가벼운 상황에서는 적당한 따뜻함 신호(이모지·가벼운 자기노출)가 이득이 될 가능성이 높다.

### Cited Findings
- **따뜻함·유능함 → 신뢰 → 구매**: 챗봇의 따뜻함과 유능함 모두 챗봇 신뢰와 '챗봇 과부하'에 유의한 영향을 주고, 이것이 서비스 평가를 거쳐 실제 구매에 영향. 현장 실험 n=212, 시나리오 실험 n=124, n=232 (Li, Gan & Zheng, *Information Systems Frontiers*) — [Springer PDF](https://springerlink.bibliotecabuap.elogim.com/content/pdf/10.1007/s10796-023-10438-x.pdf)
- **유능함이 구매의향에 더 직접적**: 고객은 '유능함' 의사소통 특성을 가진 챗봇에 더 끌리고 이것이 구매의향을 높임. 따뜻함은 고객과 챗봇의 대화 특성이 서로 비슷할 때만 매력도를 높임 (Tan et al., *JAIS* 2025, 혼합연구) — [AIS eLibrary](https://aisel.aisnet.org/jais/vol26/iss3/4)
- **인간다움·상호작용성 → 따뜻함·유능함 → 추천 신뢰 → 충동구매** (대만 금융 서비스, n=388, S-O-R 모형) — [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9355322)
- **고객 성향에 따라 다름**: 현재 지향 고객은 따뜻한 대화를, 미래 지향 고객은 유능한 대화를 선호하며, 각각 브랜드 태도와 구매의향을 높임 (Roy & Naidoo 2021, 2차 리뷰 요약) — [Swansea Cronfa](https://cronfa.swan.ac.uk/Record/cronfa64041/Details)
- **의인화의 역효과 (화난 고객)**: 화난 고객은 사람 같은 챗봇에게 만족도·기업 평가·구매의향을 더 낮게 줌. 화나지 않은 고객에게는 이런 불이익이 없음. 원인은 의인화가 높여 놓은 사전 기대가 깨지는 것. 실제 통신사 채팅 약 35,000건 + 실험 4개 (Crolic et al., *Journal of Marketing* 86(1), 2022) — [Oxford ORA](https://ora.ox.ac.uk/objects/uuid:73d46bba-35d1-465c-be00-aa6f4f4ccb84); [AMA 보도자료](https://www.ama.org/press-releases/press-release-from-the-journal-of-marketing-when-humanlike-chatbots-miss-the-mark-in-customer-service-interactions/)
  - 문제가 실제로 해결되면 의인화 여부와 관계없이 평가 차이가 없었고, 대화 전에 기대치를 낮추면 불이익이 사라짐 — [AMA](https://www.ama.org/2021/10/20/when-humanlike-chatbots-miss-the-mark-in-customer-service-interactions/)
- **NN/g의 반(反)의인화 입장 (2026-01-09, Caleb Sponheim)**: 의인화는 AI가 못 지키는 기대를 만들고, 과업에서 주의를 흩뜨리고, 프라이버시·정서적 위험을 키운다고 주장. 빈말 인사, 칭찬, 관심 표현 같은 꾸민 따뜻함을 줄이고, 사람 같은 이름·페르소나와 1인칭 사용을 피하라고 권고. 예외는 동반자·창작 파트너·튜터처럼 관계 자체가 목적인 제품 — [NN/g "Humanizing AI Is a Trap"](https://www.nngroup.com/articles/humanizing-ai/)
  - 같은 글에서 더 따뜻하게 튜닝된 모델이 오류를 더 많이 낸다는 연구, AI에 감정을 부여하는 사용자는 조언을 덜 받아들인다는 연구를 인용 (원 연구 서지는 확인 못 함) — [NN/g](https://www.nngroup.com/articles/humanizing-ai/)
- **자기노출의 상호성**: 자기 이야기를 하는 소셜 챗봇은 사용자의 더 깊은 자기노출을 끌어냈고, 그 효과가 연구 기간 내내 유지됨. 친밀감과 즐거움도 높아짐. 자기노출 기능이 없는 대화 스타일은 이 효과를 내지 못함 (Lee, Yamashita, Huang & Fu, CHI 2020) — [AMiner 초록](https://www.aminer.org/pub/5ea2c2ea9fced0a24b1ddc58/i-hear-you-i-feel-you-encouraging-deep-self-disclosure-through-a); [dblp](https://dblp.uni-trier.de/rec/conf/chi/LeeYHF20.html)
- **한국 연구: 오류 상황의 자기노출·감정표현**: 금융 챗봇 대화 오류 상황에서 의인화 챗봇의 자기노출과 감정표현이 신뢰, 곤혹도, 서비스 회복 만족, 지속 사용의도에 각각 주효과가 있었고, 신뢰와 곤혹도에서는 상호작용 효과가 나타남 (김환주·김지연·최준호, JCCT 8(3), 2022) — [KoreaScience](https://koreascience.kr/article/JAKO202221737415251.page)
- **사람이라고 믿게 하면 자기노출이 늘어남**: 사용자가 챗봇을 사람이라고 믿으면 개인정보를 더 많이 털어놓고 정서적 지지를 더 높게 평가. 저자들은 속임수에 대해 경고했고, 사람이 아님을 알 때도 사회적 프레이밍 효과가 있었음 (Warren-Smith et al., 2025) — [PsyPost](https://www.psypost.org/study-finds-users-disclose-more-to-ai-chatbots-introduced-as-human/)
- **사람 vs 챗봇에 대한 자기노출**: n=286 실험에서 자기노출의 친밀도는 차이가 없었고, 챗봇에는 평가받는 두려움이 적었지만 신뢰는 사람 쪽이 높았음 (*Interacting with Computers*, 2024) — [Tilburg](https://research.tilburguniversity.edu/en/publications/digital-confessions-the-willingness-to-disclose-intimate-informat/)
- **유머**: 유머(언어적 의인화 단서)가 사회적 실재감·신뢰·자기노출에 미치는 영향을 본 AMCIS 2025 연구가 있으나 초록만 확인되어 결과는 알 수 없음 — [AIS eLibrary](https://aisel.aisnet.org/amcis2025/sig_hci/sig_hci/18)
- **말투만 달라도 능력 평가가 달라짐**: 모든 챗봇의 능력이 같았는데도 사용자는 자기가 선호한 성격의 챗봇에만 유능함과 정직함을 부여 (arXiv 2026 프리프린트, 동료심사 전) — [arXiv](https://arxiv.org/html/2602.17850v1)

### Inferences
- 툭은 립 컬러 추천이라는 즐거움 위주의 가볍고 화날 일이 적은 상황이라 Crolic 연구의 '분노' 위험은 낮다. 다만 "추천이 마음에 안 듦", "인식 실패" 같은 순간에는 사람 흉내 없이 바로 대안을 주는 편이 안전하다.
- 구매로 이어지려면 핵심은 유능함 신호(왜 이 색인지 근거 한 줄, 정확한 제품명·색상명)이다. 따뜻함은 말투와 이모지 정도로 얹는 것이 근거와 맞는다.
- 자기노출은 "저는 웜톤 코랄을 자주 추천해요"처럼 가볍고 정보성 있는 수준이 적당하다. 감정을 꾸며 내는 자기노출("저도 너무 설레요!")은 NN/g이 말하는 가짜 공감 위험이 있다.
- "툭"이라는 이름은 사람 이름이 아닌 의성어 브랜드명이라, NN/g의 "사람 같은 이름 피하기" 권고와 충돌하지 않으면서 친근함을 준다.

### Gaps
- 뷰티·화장품 챗봇에 한정한 따뜻함/유능함 실험 근거는 찾지 못함 (대부분 금융·통신·일반 리테일).
- 챗봇 유머의 구체적 효과 크기는 원문을 확인하지 못함.
- 아바타(캐릭터 이미지) vs 텍스트만의 비교, 불쾌한 골짜기 관련 최신 소비자 챗봇 연구는 이번 조사에서 확보하지 못함.

## 2. 한국어 특화: 존댓말/반말, 이모지, 호칭, 국내 브랜드 톤 가이드, 이루다 교훈

### Takeaway
한국어 서비스 챗봇은 해요체 존댓말이 기본값이라는 근거가 우세하다(반말은 사용자가 원할 때만). 이모지는 따뜻함과 만족을 높이지만 실패나 사과 상황에서는 효과가 사라진다. 국내 UX 라이팅 가이드(토스·SKT)의 공통점은 쉬운 일상어, 군더더기 제거, 공감이다. 이루다 사례의 교훈은 말투보다 데이터·개인정보·편향 관리 쪽에 있다.

### Cited Findings
- **존댓말 vs 반말**: AI가 반말로 바꾸자고 요청하는 4가지 방식(존댓말/반말 × 질문형/평서형)을 비교. 국문 결론은 AI가 서비스 제공자이므로 고객을 대하는 존댓말이 긍정적이라고 해석. 그러나 영문 초록은 반말 + 사용자에게 먼저 묻는 방식이 가장 긍정적이었다고 적어 두 초록이 서로 다른 방향으로 읽힘. 성별 차이도 보고됨 (장순규·서정호, 『디자인학연구』 36(4), 2023; 미리보기 초록만 확인, 표본 크기 미확인) — [해피캠퍼스 미리보기](https://www.happycampus.com/paper-doc/31559334)
  - 공통 결론: 반말 전환은 AI가 일방적으로 하지 말고 사용자에게 **묻고** 하는 편이 낫다.
- 커뮤니티에서는 ChatGPT가 반말로 답하는 데 대한 불만 사례가 보고됨 (개인 게시글이라 체계적 근거는 아님) — [다모앙](https://damoang.net/free/3216109)
- **사용 목적별 챗봇 나이·성별·성격·말투 선호**를 설문으로 설계한 국내 연구 (2018) — [KoreaScience](https://koreascience.kr/article/JAKO201817240823202.pdf)
- **이모티콘 효과 (한국)**: 온라인 금융 상담에서 이모티콘을 쓰면 채팅 상담 서비스 사용의도가 높아지고, 이 효과는 상담원 유형(사람 vs 챗봇)과 주관적 금융지식에 따라 조절됨 (강영선·최보름, 『지식경영연구』 20(4), 2019) — [KoreaScience](https://koreascience.kr/article/JAKO201909255111820.pdf)
- **이모지 → 따뜻함 → 만족 (해외)**: 챗봇의 이모지는 따뜻함 인식을 높이고 이를 거쳐 만족도를 높였지만 유능함에는 일관된 효과가 없었음. 즐거움 위주 용도와 미리 짜인(규칙 기반) 봇에서 효과가 더 컸음 (BI Norway, 실험 3개) — [BI Open](https://biopen.bi.no/bi-xmlui/handle/11250/3147620?show=full)
- 상호작용형 이모지 사용이 따뜻함과 유능함을 함께 높이고, 다른 사회적 단서와 결합하면 지속 사용의도 효과가 강해짐 (*IJHCI* 2024) — [T&F](https://informahealthcare.com/doi/full/10.1080/10447318.2024.2352928)
- **실패 상황에서는 효과 없음**: 맥락에 맞는 이모지는 일반 고객지원에서 만족을 높였지만 서비스 실패 뒤에는 그렇지 않았음 (Marketing Trends Congress 2025) — [PDF](https://archives.marketing-trends-congress.com/2025/pages/PDF/108.pdf)
- **상충 근거**: 사람 직원의 이모티콘은 더 따뜻하지만 덜 유능하게 보였고 (Li et al., *JCR* 2019), Glikson et al.(2018)은 따뜻함 효과가 없고 유능함만 떨어졌다고 보고 — [HKBU](https://scholars.hkbu.edu.hk/en/publications/service-with-emoticons-how-customers-interpret-employee-use-of-em-2/); [요약 PDF](https://articlearchives.co/index.php/JMDC/article/download/7569/7497)
- AI 고객센터에서 따뜻함과 유능함이 모두 이모지와 만족 사이를 매개하며, 사용자의 관계 규범 성향에 따라 효과가 달라짐 (Jilin Univ.) — [magtech](https://manu68.magtech.com.cn/Jwk_glxb/EN/abstract/abstract12780.shtml)
- **토스 라이팅**: 보이스톤 통일이 목적. 대표 원칙은 '잡초 뽑기'(기능 없는 단어 제거). 금융 용어 대신 일상적인 문장을 씀 (예: 송금 화면의 "어디로 돈을 보낼까요?"). 원칙을 외우기보다 피드백을 주고받으며 기대치를 맞춘다고 함 — [토스피드 UX 라이터 인터뷰](https://toss.im/tossfeed/article/uxwriter-interview); [요즘IT](https://yozm.wishket.com/magazine/detail/1262)
  - 토스가 해요체를 명시한 공식 규칙 문서는 이번 검색에서 찾지 못함 (토스 화면은 실제로 해요체를 쓰지만 공식 출처로 확인하지는 못함).
- **SK텔레콤 UX 라이팅 가이드**: 고객 기준 4원칙(쉬움, 도움이 됨, 신뢰, 공감)을 세우고 고객 감정 지도와 **이모지 가이드**를 함께 만듦 — [SKT 뉴스룸](https://news.sktelecom.com/231666)
- **배민**: 주문 접수 푸시 문구를 "사장님이 조리 중" 같은 사람 냄새 나는 표현으로 바꿨다는 블로그 관찰이 있음 (공식 가이드 아님) — [위픽레터](https://letter.wepick.kr/post/3985)
- **이루다 (스캐터랩, 2020-12-22 출시, 21일 만에 중단)**: 개인정보위가 2021-04-28 과징금·과태료 총 1억 330만 원 부과(AI 기업 첫 개인정보 제재). 14세 미만 아동 정보를 법정대리인 동의 없이 수집, 민감정보 별도 동의 없음 등. '신규 서비스 개발'이라는 포괄 동의로는 챗봇 학습 동의로 보기 어렵다는 판단. 혐오·차별 발언은 알고리즘 편향 문제로 따로 논의됨 — [ZDNet](https://zdnet.co.kr/view/?no=20210428153808); [법률신문](https://www.lawtimes.co.kr/news/articleViewAmp.html?idxno=170076); [CIO](https://www.cio.com/article/3523119/)
- **AI 기본법 (2026-01-22 시행)**: 사업자는 이용자에게 AI와 상호작용하고 있다는 사실을 알리고 생성물에 표시해야 함. 위반 시 시정명령 후 3,000만 원 이하 과태료, 1년 이상 계도기간 운영 중. 한 뉴스레터는 개정 법·시행령의 시행일을 2026-07-21로 적어 날짜가 엇갈림 — [뉴시스](https://mobile.newsis.com/view/NISX20260121_0003485509); [신김 뉴스레터](https://shinkim.com/kor/media/newsletter/3114)

### Inferences
- 툭 기본 말투: **해요체 존댓말** ("이 색이 잘 어울려요", "어떤 느낌을 원하세요?"). 합쇼체("~습니다")는 매장 안내처럼 딱딱해지니 오류·법적 고지 같은 일부 문장에만 쓴다. 반말은 쓰지 않거나, 쓴다면 사용자 선택일 때만.
- 호칭: 이름을 모르는 QR 진입 고객이므로 "고객님"을 남발하기보다 주어를 생략하는 한국어 특성을 살린다 ("찾는 색이 있으세요?"). 나이·성별 추정 표현("언니", "어머님", "여성분께")은 쓰지 않는다. (이 항목은 일반 UX 라이팅 관행에서 추론한 것이며, 직접 실험 근거는 찾지 못함.)
- 이모지: 인사·추천 결과에서 메시지당 0~1개, 색 관련 이모지(💄 등) 위주. 오류·사과·인식 실패 메시지에는 넣지 않는다 (실패 상황 무효과 근거).
- 국내 가이드의 공통점: 일상어, 한 문장에 한 정보, 군더더기 삭제. 립 용어(MLBB, 웜/쿨톤, 매트/글로시)는 짧은 풀이를 함께 준다.
- 이루다 교훈을 툭에 적용하면: 대화 로그를 학습·분석에 쓴다면 별도 동의, 얼굴(웹캠) 이미지 같은 민감 정보는 최소 수집, 금지어·편향 필터를 둔다. 또 AI 기본법에 따라 첫 화면에서 AI임을 알린다.

### Gaps
- 카카오·배민·네이버 클로바의 공식 보이스톤/챗봇 이모지 가이드 원문은 찾지 못함.
- 해요체 vs 합쇼체를 챗봇에서 직접 비교한 실험 연구는 찾지 못함.
- "○○님" 이름 호칭의 효과를 실험한 한국 연구는 찾지 못함.
- 장순규·서정호(2023)의 표본 크기와 국문/영문 결론 차이의 원인은 원문 확인이 필요함.

## 3. 해외 대기업 대화 디자인 가이드: 인사, 오류/폴백, 공감, 모바일에서의 간결함

### Takeaway
Google 대화 디자인의 핵심은 그라이스 협력 원리(진실·적정량·관련성·명료성), 한 번에 질문 하나, 쉬운 일상어, 오류 응답은 맥락별로 하되 단계적으로 도움을 늘리고, 연속 실패에는 상한을 두고 다른 길을 안내하는 것이다. Microsoft의 책임 있는 봇 가이드라인은 투명성(봇임을 알림)을 신뢰의 바탕으로 둔다.

### Cited Findings
- **Google: 페르소나·협력 원리**: 사용자는 대화형 인터페이스를 사람처럼 대하므로 페르소나는 협조적이고 정보를 주며 대화를 이어 갈 만큼 구체적이어야 함. 그라이스 4원칙(Quality 진실, Quantity 적정량, Relevance 관련성, Manner 명료). 사용자가 묻지 않은 정보까지 말하면 자연스럽게 받아 줄 것. 요청을 못 들어줄 때는 대안을 제시 — [Google Conversation Design: Learn about conversation](https://developers.google.com/assistant/conversation-design/learn-about-conversation)
- **Google: 간결함·말투·턴 교대**: 현재 결정에 필요한 만큼만 짧게. 'invalid', 'transaction' 같은 기술 용어 대신 일상어. 자주 나오는 문구는 표현을 바꿔 기계적으로 들리지 않게. 질문으로 턴을 넘기고, 한 번에 질문 하나만 — [Google](https://developers.google.com/assistant/conversation-design/learn-about-conversation)
- **Google: 오류(No match) 처리**: 첫 재질문은 짧게, 두 번째 재질문에는 선택지·예시·시각 정보 같은 추가 도움. 연속 No Input/No Match는 3회를 넘기지 않도록. 끝낼 때는 다른 해결 방법을 알려 주며 정중히 종료. 오류 처리는 턴마다 맥락에 맞게(일반적인 폴백 하나로 때우지 않기) — [Google Conversation Design: Errors](https://developers.google.cn/assistant/conversation-design/errors); [Medium: 3 strikes](https://medium.com/google-developers/handling-actions-no-match-errors-in-dialogflow-three-strikes-and-you-re-out-25cfd7f58c7f)
  - 참고: 이 페이지들은 종료된 Actions on Google/Dialogflow 시절 가이드라서 원칙으로만 참고할 것.
- **Microsoft "Responsible bots: 10 guidelines" (2018-11)**: 봇이 대표하는 조직에 대한 신뢰를 지키는 책임 있는 봇 설계를 위한 지침(강제 규칙이 아닌 가이드라인). 투명성·신뢰성을 다룸 — [Microsoft Research](https://www.microsoft.com/research/publication/responsible-bots/); [PDF](https://microsoft.com:443/en-us/research/uploads/prod/2018/11/Bot_Guidelines_Nov_2018.pdf)
  - "봇임을 알리라"는 조항의 정확한 문구는 원문 PDF에서 직접 확인하지 못함.

### Inferences
- 모바일 첫 메시지(인사): 1) 툭이 AI 립 컬러 도우미라는 소개, 2) 할 수 있는 일 한 줄, 3) 첫 질문 하나 + 빠른 답 버튼. 3줄 안쪽.
- 추천 답변 구조: 결론(색 이름) → 이유 한 줄 → 다음 행동 버튼(발라보기/다른 톤). 그라이스의 '적정량' 원칙과 같은 방향.
- 폴백: 1차는 짧은 재질문("어떤 느낌인지 한 번만 더 알려 주세요"), 2차는 버튼 예시 제시, 3차는 매장 직원/태블릿으로 안내. 사과는 짧게 한 번만.
- 같은 인사·확인 문구는 2~3개 변형을 돌려 기계적인 느낌을 줄인다 (규칙 기반 템플릿에서도 가능).

### Gaps
- Amazon Alexa, Intercom, Shopify의 공식 톤 가이드 원문은 이번 조사에서 확보하지 못함 (도구 호출 한도).
- 모바일 채팅 메시지의 '최적 길이'를 수치로 제시한 동료심사 연구는 찾지 못함.

## 4. 규칙 기반 템플릿과 LLM 출력 사이의 페르소나 일관성, 영어판 톤 맞추기

### Takeaway
페르소나가 대화 도중 바뀌면 고장 난 것처럼 느껴진다는 점은 업계 공통 인식이지만, 규칙+LLM 혼합 구조에서의 일관성을 직접 실험한 동료심사 연구는 찾지 못했다. 실무적으로는 톤 규칙을 하나의 문서(보이스 차트)로 만들어 템플릿 작성과 LLM 시스템 프롬프트에 똑같이 쓰는 방법이 합리적이다.

### Cited Findings
- 대화 도중 바뀌는 페르소나는 고장 난 것처럼 읽힌다는 대화형 UI 참고 자료 (Google 공식 아님, 서드파티) — [conversational-ui.md](https://cdn.jsdelivr.net/npm/@hegemonart/get-design-done@1.60.4/reference/conversational-ui.md)
- 토스는 라이팅 원칙의 목적을 '보이스톤 통일'로 두고 피드백 반복으로 맞춰 감 — [토스피드](https://toss.im/tossfeed/article/uxwriter-interview)
- NN/g는 LLM 쪽 시스템 프롬프트로 아첨(sycophancy)을 줄이고, 평가 기준에서 참여도보다 정확성을 우선하라고 권고 — [NN/g](https://www.nngroup.com/articles/humanizing-ai/)
- 모든 챗봇 능력이 같아도 사용자는 선호하는 성격의 봇만 유능·정직하다고 평가 → 말투 차이만으로도 신뢰 평가가 흔들림 (arXiv 프리프린트) — [arXiv](https://arxiv.org/html/2602.17850v1)
- 이모지 따뜻함 효과는 미리 짜인(규칙 기반) 봇에서 더 컸음 — [BI Open](https://biopen.bi.no/bi-xmlui/handle/11250/3147620?show=full)

### Inferences
- 보이스 차트 예시 (템플릿과 LLM 프롬프트에 공통 적용):
  - KO: 해요체, 한 메시지 2~3문장, 이모지 최대 1개(실패 메시지 0개), 감탄사는 "오", "좋아요" 정도, "~것 같아요" 남발 금지, 칭찬은 근거와 함께("코랄이 피부 톤을 밝혀 줘요"), 사람인 척 금지("저도 발라 봤는데" 같은 표현 금지).
  - EN: 2인칭 "you" 중심, 축약형(you'll, it's)으로 캐주얼하지만 공손하게, 느낌표 최대 1개, 한국어 해요체의 공손함 수준에 맞춰 "Hey girl", "babe" 같은 친밀 호칭 금지. 한국어 직역보다 같은 정보 구조(결론→이유→버튼)를 맞추는 쪽이 중요.
- LLM 출력은 후처리로 길이·이모지 개수·금지어(반말 어미, 성별·나이 호칭)를 검사하고, 어기면 템플릿으로 대체하는 가드가 일관성 유지에 실용적이다.
- 규칙 기반 답변과 LLM 답변의 문장 끝 패턴(예: "~해요", "~어떠세요?")을 같은 목록에서 고르게 하면 전환 지점이 티 나지 않는다.

### Gaps
- 규칙 기반과 생성형 응답이 섞인 챗봇에서 사용자가 톤 차이를 알아채는지, 그것이 신뢰에 영향을 주는지 다룬 연구는 찾지 못함.
- 한·영 이중언어 챗봇의 톤 대응(존댓말 ↔ 영어 공손성)을 직접 다룬 연구는 찾지 못함.

## 5. 함정: 지나친 귀여움, 가짜 공감, 긴 답변, 사람인 척, 봇임을 밝히는 문제

### Takeaway
봇임을 밝히면 구매가 줄 수 있다는 강한 현장 증거(Luo et al. 2019)가 있지만, 한국은 2026년부터 AI 기본법으로 AI 고지가 의무이고, 사람인 척하다 기대가 깨지는 쪽(Crolic 2022)의 위험이 더 크다. 해결책은 숨기기가 아니라 처음에 밝히되 유능함으로 기대를 채우는 것이다. 가짜 공감과 과한 귀여움은 신뢰를 깎는다는 실무 경고가 많다.

### Cited Findings
- **봇 공개의 비용**: 고객 6,200명 이상 현장 실험에서 대화 전에 챗봇임을 밝히면 구매율이 79.7% 넘게 떨어짐. 공개된 봇은 덜 알고 덜 공감한다고 여겨져 고객이 퉁명스러워지고 덜 삼. 공개하지 않으면 숙련 직원만큼, 미숙한 직원보다 약 4배 잘 팔았음. 공개 시점을 늦추거나 고객에게 AI 경험이 있으면 부정 효과가 줄어듦 (Luo, Tong, Fang & Qu, *Marketing Science* 38(6), 2019) — [EconPapers](https://econpapers.repec.org/RePEc:inm:ormksc:v:38:y:2019:i:6:p:937-947); [EconBiz](https://econbiz.de/Record/machines-versus-humans-the-impact-of-ai-chatbot-disclosure-on-customer-purchases-luo-xueming/10013219739)
  - 주의: 2019년 중국 금융 서비스 아웃바운드 판매 전화 맥락이며, 생성형 AI가 흔해진 지금은 'AI 경험' 조절 효과 때문에 불이익이 줄었을 수 있음 (추론).
- **사람인 척의 위험**: 사람이라고 믿으면 자기노출이 늘지만 저자들이 기만을 경고 — [PsyPost](https://www.psypost.org/study-finds-users-disclose-more-to-ai-chatbots-introduced-as-human/); NN/g는 메타 AI 챗봇이 실제 사람을 만날 수 있다고 믿게 만든 사고(2025-03)를 위험 사례로 인용하는 글이 있음 (서드파티 재게시, 원 보도 미확인) — [재게시 글](https://wordpress-hr2d6.wasmer.app/?p=825)
- **법적 고지 의무**: 한국 AI 기본법은 AI와 상호작용 중임을 이용자에게 알리도록 함 — [뉴시스](https://mobile.newsis.com/view/NISX20260121_0003485509)
- **가짜 공감·빈말**: NN/g는 꾸민 따뜻함(칭찬, 관심 표현, 빈말 인사)을 줄이고 짧고 중립적인 안내를 권고. 더 따뜻한 모델이 오류를 더 낸다는 연구를 인용 — [NN/g](https://www.nngroup.com/articles/humanizing-ai/)
- **기대치 관리**: 의인화가 기대를 부풀리고, 대화 전에 기대치를 낮추면 불이익이 사라짐 — [Oxford ORA](https://ora.ox.ac.uk/objects/uuid:73d46bba-35d1-465c-be00-aa6f4f4ccb84)
- **간결함**: 추가 정보와 반복은 단기 기억 부담을 키우므로 필요한 것만 짧게 — [Google](https://developers.google.com/assistant/conversation-design/learn-about-conversation)
- **이모지의 유능함 감소 가능성**: 일부 연구는 이모티콘이 유능함 평가를 떨어뜨린다고 보고 — [HKBU](https://scholars.hkbu.edu.hk/en/publications/service-with-emoticons-how-customers-interpret-employee-use-of-em-2/)

### Inferences
- 첫 메시지 예: "안녕하세요, 립 컬러를 골라 드리는 AI 도우미 툭이에요. 원하는 분위기를 알려 주시면 어울리는 색을 추천해 드릴게요." → AI 고지와 할 수 있는 일을 함께 말해 기대치를 맞춘다 (Crolic의 기대치 낮추기 + AI 기본법).
- 영어: "Hi, I'm took, an AI lip-color helper. Tell me the vibe you want and I'll suggest shades."
- 피할 표현: 과한 애교체("~했쪄요", "뿌잉"), 연속 이모지·물결표 남발, 꾸민 감정("너무너무 설레요!!"), 사람 경험 사칭("저도 이 색 매일 발라요"), 근거 없는 칭찬("어떤 색이든 다 어울리실 거예요"), 4문장 넘는 답변.
- 공감은 "그런 색 찾기 어렵죠" 수준의 짧은 인정 한 마디 + 바로 해결책. 실패 메시지는 이모지 없이 사과 한 번 + 대안 버튼.

### Gaps
- '지나치게 귀여운 말투'가 신뢰·구매에 미치는 효과를 한국어로 직접 실험한 연구는 찾지 못함 (위 피할 표현 목록은 근거 연구들에서 추론한 실무 권고).
- 생성형 AI 보급 이후(2023~) 봇 공개 효과를 재검증한 대규모 현장 실험은 이번 조사에서 확보하지 못함.
