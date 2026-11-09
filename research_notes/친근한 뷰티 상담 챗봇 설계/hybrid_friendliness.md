# 규칙+LLM 하이브리드 챗봇을 친근하고 정확하게 만드는 법 (took, 2026-11-09 조사)

조사 전 확인한 현재 구조:
- `server.js` 는 `/api/chat` 에서 `hybridAnswer`(src/lib/llm/agent.js)를 부른다. 규칙(`answer()`)이 먼저 답하고, 규칙 답이 `unsure`(src/lib/chat.js:693)일 때만 LLM 이 대신 답한다.
- LLM 은 도구(search_products, get_product)만 부를 수 있다. 마지막 답은 `{intent, product_ids, say}` JSON 이다. `validateFinal` 은 다음을 검사한다.
  - id 가 허용 목록에 있는지
  - say 에 `\d원` 가격이나 브랜드명이 없는지
  - `{{n}}` 자리표시가 범위 안인지
- 실패하면 한 번 다시 묻고, 그래도 안 되면 규칙 답으로 돌아간다.
- 이전 조사(`툭 뷰티 챗봇 오픈소스 조사/`)에서 다룬 내용은 반복하지 않는다. 프레임워크, 오픈 LLM, OWASP LLM01/06, ID 허용 목록, Promptfoo 같은 평가 도구가 그렇다. 아래는 그 위에 새로 더하는 내용만 담았다.

## 1. 규칙·템플릿 봇의 응답 다양화 (템플릿 풀, 슬롯, 무작위성, 잡담, 공감 오프너)

### Takeaway
반복 자체가 나쁜 것은 아니다. 연구들은 지루하게 똑같은 반복은 나쁘지만, 구조의 반복은 오히려 자연스럽게 느껴질 수 있다고 본다. 그래서 정보 부분(제품·가격 문장)은 고정 템플릿으로 두고, 앞뒤 감싸는 말(인사, 맞장구, 마무리 질문)만 풀에서 고르는 방식이 정확성과 친근함을 같이 잡기 좋다. 토스 UX 라이팅 원칙(간결·친근·공감·말하기 쉬움)이 한국어 말투 기준으로 쓸 만하다.

### Cited Findings
- 반복의 효과에 대한 연구 결과는 엇갈린다.
  - 합성 대화에서 구조적 반복이 있으면 더 자연스럽다고 평가받았다. 저자들은 "반복 회피"가 단순한 휴리스틱일 뿐이라고 지적한다 (Park et al., 2025, IJHCI). — [SKKU ScholarX](https://scholarx.skku.edu/item/f9e5b148-2ca1-4504-b7ca-be709a1303ad)
  - 반대로 단조로운 반복 발화는 사용자를 빨리 지루하게 할 수 있고, 너무 복잡한 변형은 인지 부담을 늘린다 (ROMAN 2022). — [Unpaywall/ACM](https://unpaywall.org/10.1145%2F3527188.3561937)
- LLM 기반 스트레스 상담 챗봇 연구에서 일부 참가자는 봇이 "대본을 따르는 것 같다"고 느꼈다. 같은 꼬리 질문이 반복되자 짜증을 낸 참가자도 있었다. — [arXiv 2601.00570](https://arxiv.org/pdf/2601.00570)
- 고객센터 실험(ECIS 2018)에서는 응답을 동적으로 지연하자 인간다움 인식과 만족도가 올라갔다. 다만 빠른 응답이 기대되는 상황에서는 역효과가 날 수 있다. — [AIS eLibrary](https://aisel.aisnet.org/ecis2018_rp/113/)
- 토스 UX 라이팅은 핵심 가치 5개(Clear, Concise, Casual, Respect, Emotional)와 원칙 8개로 이뤄져 있다(2022-11-15). 키오스크 음성 답변과 특히 관련된 원칙은 다음과 같다.
  - Easy to speak: 소리 내 읽어도 자연스러운가. 한자어, 문어체, 긴 문장을 경계한다.
  - Remove empty sentences: 의미 없는 반복 문장을 뺀다.
  - Suggest over force: 강요하지 말고 제안한다.
  - Find hidden emotion: 정보만이 아니라 감정을 헤아린다.
  - 출처: [toss.tech 8 writing principles](https://toss.tech/article/8-writing-principles-of-toss)
- 토스는 문장 규칙을 담은 내부 도구 '보이스톤 메이커'로 문체를 통일한다. — [바이라인네트워크](https://byline.network/2022/06/08-88)
- Rasa 는 템플릿 다양화를 LLM 에게 맡길 때도 응답마다 켜고 끄게 한다(`rephrase: True`, 기본은 꺼짐). 소규모 모델로 실험한 결과, 재작성은 잡담처럼 필요한 경우로 한정하라고 권한다. 과잉 설명과 환각을 줄이기 위해서다. — [Rasa docs](https://www.rasa.com/docs/reference/primitives/contextual-response-rephraser.md); [Rasa blog 2025-01-22](https://rasa.com/blog/contextual-rephrasing-with-small-llms)

### Inferences (took 적용안)
- **응답을 3단으로 조립한다.** `[오프너] + [사실 문장(고정 템플릿, DB 값 슬롯)] + [마무리 제안]`.
  - 오프너와 마무리만 풀(각 4~8개)에서 고른다.
  - 사실 문장은 하나로 두거나, 조사(`josa()`)만 맞춘 2~3개 변형으로 둔다.
- **무작위를 일관되게 쓴다.**
  - 같은 세션에서 직전 1~2턴에 쓴 변형은 빼고 고른다(최근 사용 목록).
  - 시드는 세션 id + 턴 번호로 정해 결정적으로 만든다. 그러면 테스트 재현과 Vercel 정적판·서버판의 동작이 같아진다.
- **사용자 말을 되받는다(acknowledgement).** 규칙 엔진이 이미 뽑은 슬롯(색 계열, 제형, 가격대, 톤)을 오프너에 넣는다. 예: "촉촉한 코랄 쪽으로 찾아볼게요." LLM 없이도 "내 말을 들었다"는 느낌을 준다.
- **공감 오프너는 상황 태그가 있을 때만 쓴다.**
  - 사용자가 "입술이 너무 건조해요", "어두워 보여서 고민" 같은 고민 태그를 말했을 때만 "건조하면 신경 쓰이죠" 같은 짧은 공감을 붙인다.
  - 매번 붙이면 대본처럼 느껴진다(위 arXiv 2601.00570).
- **잡담은 의도 하나로 받는다.** 인사, 감사, 칭찬, "너 누구야", 기분 표현을 작은 템플릿 집합으로 받고, 바로 다음 행동 제안으로 되돌린다. 예: "고마워요! 다른 색도 볼까요?"
- **QR 핸드오프 첫 인사는 템플릿으로 만든다.** 매장 측정 결과가 있으면 그 값을 슬롯으로 쓴다. 예: "반가워요! 매장에서 고른 {색이름} {제형}이랑 비슷한 걸 더 찾아드릴까요?" 첫 턴은 LLM 없이 즉시 보여 준다(지연 0).
- 음성(TTS)으로 읽을 문장은 짧게(1~2문장) 쓰고, 해요체로 통일하고, 숫자 읽기 형식을 고정한다. 토스의 Easy to speak 원칙과 같은 방향이다.

### Gaps
- 한국어 챗봇에서 템플릿 변형 개수와 만족도의 관계를 직접 잰 연구는 찾지 못했다.
- 토스, 카카오, 네이버가 상담 챗봇 말투를 어떻게 설계하는지 다룬 공식 기술 블로그 글은 검색되지 않았다(토스는 일반 UX 라이팅 자료만 있다).

## 2. LLM 을 "리라이터/스타일리스트"로만 쓰기 (근거 기반 생성, 스키마, 검증, 비용·지연)

### Takeaway
업계 표준은 "사실은 구조화해서 넣고, 말투만 LLM 이 바꾸고, 출력은 검증하는" 3단 구조다. Intercom Fin 과 Rasa 둘 다 이렇게 한다. took 은 이미 `{{n}}` 자리표시와 서버 측 이름·가격 채우기를 쓰고 있어서, 규칙 답 위에 "말투 다듬기 모드"를 얹기 쉽다. Claude 의 strict tool use / JSON outputs, Chrome Prompt API 의 `responseConstraint` 는 형식만 보장한다. 내용 검증은 여전히 서버가 해야 한다.

### Cited Findings
- **Rasa Contextual Response Rephraser**
  - 프롬프트(Jinja2)에 들어가는 변수는 `history`, `current_input`, `suggested_response` 세 개다.
  - 기본 temperature 는 0.3 이다. 2.0 이면 봇이 감당 못 할 방향으로 흐를 수 있다고 경고한다.
  - 기본적으로 슬롯 값은 프롬프트에 넣지 않는다.
  - 알려진 한계: 의미가 바뀔 수 있다("Meaning Alteration"), 목록 같은 구조가 깨질 수 있다, 사용자 메시지가 프롬프트에 들어가 프롬프트 인젝션 위험이 있다.
  - 출처: [Rasa docs](https://www.rasa.com/docs/reference/primitives/contextual-response-rephraser.md)
- **Rasa 소형 모델 실험(2025-01)**
  - Llama 3B/8B/13B 와 Gemma 9B 는 취소, 맥락 전환, 정정 같은 대화에서 GPT-3 기준선과 비슷했다.
  - 다만 사실이 많은 긴 대화에서는 덧붙여 설명하는 경향이 있었다.
  - 평가는 deepeval GEval Correctness 로 했다. 0은 사실이 다름, 1은 사실이 같음이다.
  - 응답이 매번 달라지는 게 정상이라 일반 E2E 테스트는 맞지 않는다고 했다.
  - 출처: [Rasa blog](https://rasa.com/blog/contextual-rephrasing-with-small-llms)
- **Intercom Fin AI Engine (벤더 설명이라 독립 검증은 없음)** — [Intercom help](https://www.intercom.com/help/en/articles/9929230-the-fin-ai-engine); [Fin glossary](https://fin.ai/glossary/multi-stage-validation)
  - ① 질의 정제: 답하면 안 되는 질문을 거르고, 질문을 검색하기 좋게 다시 쓴다.
  - ② RAG 로 생성한다.
  - ③ 검증: 답이 지식 출처에 근거하는지 확인한다. 기준에 못 미치면 "답할 수 없다"고 안내하고 사람에게 넘긴다.
  - 커뮤니티에는 2025~26년에 길고 틀린 답을 했다는 사용자 보고가 있다. 원인은 확인되지 않았다. — [Intercom Community](https://community.intercom.com/deploy-fin-96/fin-suddenly-hallucinates-and-no-longer-responds-correctly-13286)
- **Claude 구조화 출력** — [Claude docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
  - JSON outputs(`output_config.format`)는 텍스트 응답을 스키마에 묶는다.
  - strict tool use(`strict: true`)는 문법 제약 샘플링으로 도구 인자가 input_schema 에 맞도록 보장한다.
  - 문서마다 베타 헤더(`structured-outputs-2025-11-13`)나 파라미터 이름(`output_format`)이 다르게 나온다. 구현할 때 현행 문서를 다시 확인해야 한다. — [AWS 블로그](https://aws.amazon.com/blogs/machine-learning/structured-outputs-for-anthropic-claude-models-on-amazon-bedrock/)
- **Claude 가격(2026-11 공식 가격표, 100K 토큰 이하 프롬프트)**
  - Claude Haiku 5.5: 입력 $0.10/MTok, 출력 $0.50/MTok, 캐시 적중 $0.01/MTok.
  - Claude Haiku 4.5: 입력 $1, 출력 $5.
  - 출처: [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)

### Inferences (took 설계안)
- **"말투 다듬기(rewrite) 모드"를 추가한다.** 지금의 "규칙이 못 알아들을 때 LLM이 답하기(fallback)"와 별도 경로로 둔다.
  - 입력은 규칙 엔진 결과를 구조화한 사실이다. 예: `{intent, slots:{color,finish,price_max,tone}, products:[{slot:1, why:["코랄","촉촉"]}], base_say}`. 제품명과 가격은 넣지 않는다. 넣더라도 `{{1}}`, `{{price1}}` 같은 토큰으로만 넣는다.
  - 출력은 `{say, suggestions[]}` JSON 이다. 스키마로 강제한다.
  - 검증은 기존 `validateFinal` 에 다음을 더한다.
    - (a) 입력에 있던 자리표시 집합이 출력에도 그대로 있는지(빠뜨림·추가 금지)
    - (b) 숫자, 금액, 퍼센트가 하나도 없는지
    - (c) 금지어 사전(의학 표현, 섹션 4)에 걸리지 않는지
    - (d) 길이 상한
  - 실패하면 재시도하지 않고 바로 템플릿 답을 쓴다. 다듬기 모드는 꾸미기일 뿐이므로 지연만 늘리는 재시도는 이득이 없다.
- **스트리밍 대신 "템플릿 먼저, 다듬은 답으로 교체"를 쓰지 않는다.** 음성으로 읽기 시작한 뒤 문장을 바꾸면 어색하다.
  - 대신 지연 예산을 둔다(예: 700ms~1s). 그 안에 오면 다듬은 답을, 아니면 템플릿 답을 읽는다.
  - 화면 텍스트는 바로 템플릿을 보여 줘도 된다.
- **다듬기 대상을 줄인다(Rasa 교훈).** 추천 결과 첫 소개, 잡담, 막연한 불만 응답처럼 감정이 실린 턴만 다듬는다. 단순 정보(가격·제형 확인)는 템플릿으로 답한다.
- **비용 감각(추정).** 한 번 호출에 입력 약 800토큰, 출력 약 80토큰이면 Haiku 5.5 기준 약 $0.00012 다(0.0008×0.10 + 0.00008×0.50 달러). 시스템 프롬프트를 캐시하면 더 싸다. 비용보다 지연이 제약이다.
- temperature 는 낮게(0.3 안팎) 둔다. 다양성은 temperature 대신 1번의 템플릿 풀과 "직전 표현 피하기" 지시로 얻는다.

### Gaps
- Claude Haiku 5.5 나 한국어 소형 모델의 실제 첫 토큰 지연(한국에서 호출할 때)은 측정 자료를 찾지 못했다. 직접 재야 한다.
- Shopify Sidekick 과 Klarna 의 리라이터 구조에 대한 1차 자료는 이번에 확인하지 못했다(시간 관계상 조회하지 않음).

## 3. 맥락 기억(매장 결과 이어받기)과 추천 답장(suggested replies)

### Takeaway
매장 결과는 대화 기록이 아니라 구조화된 "세션 상태"로 넘겨야 한다. LLM 프롬프트에도 요약 문장이 아니라 필드로 넣어야 한다(Rasa 기본값은 슬롯을 빼는데, took 은 반대로 넣는 게 맞다). 추천 답장은 다음 두 종류로 나눠 규칙으로 만들고, LLM 은 문구만 다듬게 하는 편이 안전하다.
- 확장(Expansion): 다른 쪽으로 넓혀 보기
- 후속(Follow-up): 방금 답에 대한 다음 단계

### Cited Findings
- Rasa 리라이터는 기본으로 대화 요약을 쓴다. 요약에 LLM 호출이 하나 더 든다. 최근 몇 턴(기본 5턴) 기록으로 바꿀 수 있고, 슬롯 값은 넣지 않는다. — [Rasa docs](https://www.rasa.com/docs/reference/primitives/contextual-response-rephraser.md)
- 기업용 AI 어시스턴트 연구(arXiv 2412.10933)는 제안 질문을 Expansion 과 Follow-Up 두 유형으로 정의한다. 사용자 질문 중 확장형이 약 30%, 후속형이 약 11% 였다. — [arXiv 2412.10933](https://arxiv.org/pdf/2412.10933)
- 대화형 정보검색 서베이에 따르면 유용한 후속 질문 제안은 사용자를 더 오래 머물게 하고 선호를 파악하는 데 도움이 된다. Alexa Prize 우승 시스템 Sounding Board 를 예로 든다. — [arXiv 2201.05176](https://arxiv.org/pdf/2201.05176)
- Microsoft(Rosset et al., WWW 2020)는 "유용한 질문 제안" 벤치마크를 만들었다. BERT 랭킹 방식과 GPT-2 생성 방식을 비교했다. — [Microsoft Research](https://www.microsoft.com/en-us/research/?p=630582)
- 커머스 벤더(Alhena)는 후속 칩으로 질의가 20% 늘었다고 주장한다. 출처를 확인할 수 없어 참고만 한다. — [Alhena blog](https://alhena.ai/blog/ai-follow-up-chips-ecommerce-conversion/)

### Inferences (took 설계안)
- **세션 상태 스키마(예시).** QR 토큰으로 서버나 URL 해시에서 복원한다. 개인정보는 넣지 않는다.

  ```
  { origin:'store', measured:{hex, colorName, finish, intensity, toneSeason},
    recommended:[productId...], shown:[productId...], lastIntent, slots:{...},
    turn, usedVariants:[...] }
  ```

  이미 있는 `context.shown`, `tone`, `selectedHex`, `baseProductId` 를 확장한 형태다.
- **지시어 해결은 규칙으로 한다.** "그거", "두 번째 거", "아까 그 색" 같은 말은 `shown` 과 `recommended` 순서로 풀고, LLM 에 넘기기 전에 id 로 바꾼다.
- **추천 답장은 2~4개를 상태 기반 규칙으로 만든다.** 기존 `resultSuggestions` 를 확장한다.
  - 후속: "더 저렴한 거", "매트 말고 촉촉한 거", "이거 발라 보기(가상 착용)"
  - 확장: "내 톤에 맞는 다른 색", "비슷한 브랜드"
  - 이미 적용한 조건은 빼서 같은 제안이 반복되지 않게 한다.
  - LLM 다듬기 모드에서도 제안은 미리 정한 "의도 id" 목록 중에서만 고르게 한다. 버튼을 누르면 규칙 엔진이 확실히 알아듣는 문장이 가야 하기 때문이다.
- Vercel 정적판은 같은 상태를 브라우저 메모리에 둔다. 규칙과 제안 생성 코드를 공유하면 두 판의 동작 차이가 줄어든다.

### Gaps
- 뷰티 커머스에서 추천 칩의 전환 효과를 다룬 독립 연구는 찾지 못했다.

## 4. 뷰티 도메인 가드레일 (의학 표현, 알레르기·피부질환, 개인정보, 인젝션, 주제 이탈) — 친근한 거절

### Takeaway
이전 조사가 OWASP 와 ID 검증을 다뤘으므로, 여기서는 한국 법규 기준의 "말하면 안 되는 표현"을 더한다. 식약처는 질병의 진단·치료·예방이나 의학적 효능을 표방하는 화장품 광고를 금지한다. 2025년 단속 83건 중 53건이 의약품 오인 표현이었다. 챗봇이 말하는 "이 립밤이 각질/염증에 좋아요" 같은 말도 같은 위험이 있으므로 출력 금지어 검사가 필요하다.

### Cited Findings
- 식약처 가이드라인은 표현을 금지, 효능 입증 조건부, 허용 세 가지로 나눈다.
  - 아토피, 여드름 등 질병 예방·치료 표현과 "부작용이 전혀 없다" 같은 안전성 과장은 금지다.
  - "피부 노화 완화", "여드름 피부 사용에 적합" 등은 인체적용시험 같은 근거가 있어야 쓸 수 있다.
  - 출처: [korea.kr 2011-06-24 정책뉴스](https://www.korea.kr/news/policyNewsView.do?newsId=148714097) (원 가이드라인은 이후 개정됐다)
- 2025-08 식약처 발표: 적발 83건 중 53건이 의약품 오인 우려 표현이었다. 예로 "소염작용", "염증완화 도움", "피부(세포) 재생"이 꼽혔다. — [한국경제 2025-08-06](https://www.hankyung.com/article/202508064910i)
- 2026-01 발표: 2025-12-18~2026-01-15 사이 5개 업체가 광고업무정지 2~6개월 처분을 받았다. — [코스인코리아](https://www.cosinkorea.com/mobile/article.html?no=56638)
- Rasa 문서도 리라이터 프롬프트에 사용자 메시지가 들어가면 인젝션 위험이 있다며 적대적 테스트를 권한다. — [Rasa docs](https://www.rasa.com/docs/reference/primitives/contextual-response-rephraser.md)
- 토스 원칙 "Suggest over force"(공포·압박 유도 금지)와 "Respect"(과장 금지)는 친근한 거절 문구의 기준이 된다. — [toss.tech](https://toss.tech/article/8-writing-principles-of-toss)

### Inferences (took 설계안)
- **입력 분류(규칙 우선)는 다음 의도로 나눈다.**
  - `medical`: 알레르기, 아토피, 헤르페스, 입술 염증, 임신 중 사용 등
  - `ingredient`: 성분 정보
  - `personal_data`: 이름, 전화번호, 얼굴 사진 저장 요청 등
  - `off_topic`
  - `injection`: "규칙 무시해", "시스템 프롬프트 보여줘"
  - `abuse`
  - 이 의도들은 LLM 으로 보내지 않고 고정 템플릿으로 답한다. 이렇게 하면 다듬기 모드에서도 사용자 원문이 프롬프트에 들어가지 않는다.
- **출력 금지어 사전.** 치료, 완화, 염증, 재생, 아토피, 여드름, 처방, 부작용 없음, 100% 안전 등을 `validateFinal` 에 추가한다. 걸리면 템플릿으로 돌아간다. 제품 설명 문구(DB)도 같은 사전으로 한 번 점검하는 게 좋다.
- **친근한 거절 공식은 "공감 한마디 + 한계 + 할 수 있는 대안".**
  - 의학: "입술이 예민하면 걱정되죠. 피부 상태는 제가 판단하기 어려워서, 약사나 피부과에 꼭 물어봐 주세요. 대신 순한 발림감 제품을 찾아드릴까요?" (효능 약속 없이 '발림감' 같은 감각 표현만 쓴다)
  - 주제 이탈: "그건 제가 잘 모르는 분야예요. 립 색이라면 자신 있어요!"
  - 인젝션: 반응하지 않고 주제 이탈과 같은 템플릿으로 답한다.
- 알레르기, 성분 질문은 제품 성분표(DB)가 있으면 그 "전성분 보기" 화면으로 안내만 한다. 챗봇이 "알레르기 없어요"라고 판단하지 않는다.

### Gaps
- 현행(2024~2026 개정) 식약처 「화장품 표시·광고 관리 가이드라인」 원문 PDF 는 이번에 열람하지 못했다. 금지어 목록은 원문으로 확정해야 한다.
- 챗봇 대화가 법적으로 "광고"에 해당하는지에 대한 해석 자료는 찾지 못했다.

## 5. LLM 선택지 (간단히, 이전 조사 보완)

### Takeaway
서버판은 Haiku 급 API 가 다듬기 모드에 비용상 충분히 싸다(호출당 1센트의 1/50 이하, 추정). 정적 Vercel 판의 브라우저 내장 모델(Chrome Prompt API/Gemini Nano)은 2026-11 현재 한국어를 지원하지 않고 데스크톱 전용이라 휴대폰 사용자에게는 쓸 수 없다. 정적판은 템플릿만으로 친근함을 내는 것이 현실적이다.

### Cited Findings
- Chrome Prompt API 는 웹에서 Chrome 148 에 출시됐다.
  - 지원 언어는 en, ja, es, de, fr 뿐이고, 다른 언어는 "개발 중"이다.
  - 데스크톱 전용이며 Android, iOS 는 지원하지 않는다.
  - 요구 사양: 저장 공간 22GB 이상, VRAM 4GB 초과 또는 RAM 16GB.
  - `responseConstraint` 로 JSON Schema 를 지정할 수 있다.
  - 출처: [Chrome for Developers](https://developer.chrome.com/docs/ai/prompt-api)
- Claude Haiku 5.5 가격은 입력 $0.10/MTok, 출력 $0.50/MTok 다(100K 이하 프롬프트). — [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Rasa 는 리라이팅 용도로 13B 이하 오픈 모델을 쓰면 지연과 비용을 줄일 수 있다고 본다(전용 추론 엔드포인트 기준, 수치는 차트로만 제공). — [Rasa blog](https://rasa.com/blog/contextual-rephrasing-with-small-llms)

### Inferences
- 키오스크(노트북+Chrome)는 데스크톱이다. 하지만 Prompt API 가 한국어를 지원하지 않으므로 지금은 쓸 수 없다. 한국어 지원이 추가되면 오프라인 다듬기 후보가 된다.
- 휴대폰 정적판에서 WebLLM 같은 브라우저 소형 모델은 다운로드 크기와 발열 부담이 크다. 템플릿 풀과 결정적 무작위가 더 낫다(이전 조사의 open_llms_korean.md 참고).

### Gaps
- Chrome "Enabled multilingual" 플래그가 한국어를 실제로 지원하는지는 확인하지 못했다.

## 6. 친근함·자연스러움 평가 (사람 평가 기준표, LLM 심판, A/B)

### Takeaway
사람 평가와 LLM 심판을 함께 쓴다. 기준은 세부 항목으로 쪼갠 예/아니오 체크로 만든다. LLM 심판은 "자연스러움"을 후하게 주는 경향이 있으니 사람 평가로 보정해야 한다. 정확성(사실 보존)은 친근함과 별도 지표로 자동 측정한다(GEval Correctness 류 또는 took 처럼 자리표시·숫자 일치 검사).

### Cited Findings
- 의료 분야 LLM 심판 서베이는 공감, 언어 자연스러움, 진정성, 정서 적합성을 흔한 소통 기준으로 꼽는다. — [arXiv 2605.25273](https://arxiv.org/pdf/2605.25273)
- 치료 대화 연구(StoryMI)에서 LLM 심판은 자연스러움에 일관되게 높은 점수를 줬다. 사람 전문가는 더 낮고 편차 큰 점수를 줬다. — [arXiv 2605.27393](https://arxiv.org/pdf/2605.27393)
- HEART 벤치마크는 쌍대 비교에서 사람과 LLM 심판이 약 80% 일치했다고 보고한다. 이는 사람끼리의 일치도 수준이다. — [arXiv 2601.19922](https://arxiv.org/html/2601.19922v1)
- FACET 는 "표현 자연스러움", "공감적 이해"를 포함한 5개 차원을 쓴다. 심판 모델은 보정(calibration) 절차로 골랐다. — [arXiv 2605.24686](https://arxiv.org/pdf/2605.24686)
- 기준을 명령형 예/아니오 체크로 쪼갠 뒤 점수 구간에 대응시키는 설계도 있다. — [arXiv 2510.20743](https://arxiv.org/pdf/2510.20743)
- LLM 심판에 연령 같은 편향이 있을 수 있다는 보고가 있다(GPT 심판에서 관찰되고 Claude 심판에서는 관찰되지 않음). — [arXiv 2511.00924](https://arxiv.org/pdf/2511.00924)
- Rasa 는 다듬기 결과를 GEval Correctness(0~1)로 사실 보존 측면에서 채점하고, 지연은 별도로 측정했다. — [Rasa blog](https://rasa.com/blog/contextual-rephrasing-with-small-llms)

### Inferences (took 평가안)
- **체크리스트(턴 단위, 예/아니오).**
  1. 사용자가 말한 조건(색, 제형, 가격)을 되받았나
  2. 해요체로 일관되고 문어체나 한자어가 과하지 않나(소리 내 읽기)
  3. 1~2문장 안에 핵심이 있나
  4. 다음 행동 제안이 있나
  5. 직전 턴과 같은 오프너를 쓰지 않았나
  6. 과장이나 의학 표현이 없나
  7. 제품명, 가격, 개수가 DB 와 일치하나(자동)
- **사람 평가.** 매장 시연 참가자 10~20명에게 템플릿판, 다듬기판, 정적판 대화를 들려준다. "친근함", "믿음직함", "다시 쓰고 싶음"을 5점 척도로 받고, 쌍대 선호도 묻는다. 그 결과로 LLM 심판(다른 모델 계열)의 일치도를 먼저 확인한 뒤 회귀 테스트에 쓴다.
- **A/B.** 서버판에서 세션 단위로 다듬기 모드 on/off 를 나눈다. 비교 지표는 다음과 같다.
  - 대화 길이(턴 수)
  - 추천 답장 클릭률
  - 가상 착용 시작률
  - "못 알아들었어요" 비율
  - 이탈 시점
  - 지연 p95
  - 검증 실패로 템플릿에 돌아간 비율
- 응답이 매번 달라지므로 문자열 일치 테스트 대신 다음을 쓴다(Rasa 교훈).
  - 구조 검사: 자리표시 집합, 숫자 없음, 금지어 없음
  - 의미 보존 점수

### Gaps
- 한국어 뷰티 상담 대화로 사람 평가와 LLM 심판의 일치도를 잰 공개 자료는 찾지 못했다.
- 다듬기 모드가 전환에 미친 영향을 공개한 A/B 사례(Intercom, Shopify 등)도 찾지 못했다.
