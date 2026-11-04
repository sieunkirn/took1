# Beauty-domain AI precedents, open-source assets, and hallucination guardrails / eval tooling for "took" (as of Nov 2026)

Scope note: research was done on 2026-11-04 with a budget of about 20 web tool calls. Most commercial claims come from company press releases or trade press. They are self-reported and not independently verified.

## A1. Commercial precedents (Olive Young, Amorepacific, L'Oréal, Perfect Corp/YouCam, Kakao/Naver, others): what they do with LLM + try-on + personal color, and the lessons

### Takeaway
By 2026 every major player has an LLM "beauty assistant", but the shipped features are skin-type diagnosis, product description, inventory and recommendation over the company's own catalog. Personal color appears mostly as a separate diagnosis module, not inside the chat. Olive Young's July 2026 in-store AI avatar kiosk (8 languages, product info, inventory, skin-type recommendations) is the closest precedent to took's iPad kiosk. Distribution is moving into ChatGPT-hosted apps (Kakao Tools with Olive Young, the Amore Mall ChatGPT app, Maybelline try-on in ChatGPT).

### Cited Findings
**Olive Young (CJ Olive Young)**
- Olive Young announced two in-store AI services on July 8, 2026. The first is an "AI Shopping Assistant" kiosk where shoppers talk to an AI avatar and shop without staff help. The second is an AI interpretation service for real-time chats between customers and staff. — [CJ Newsroom](https://newsroom.cj.net/olive-young-ai-in-store-services/)
- The kiosk supports 8 languages and gives product descriptions, inventory checks, answers about payment methods and VAT refunds, and personalized suggestions based on skin type and preferences. Interpretation supports 38 languages. A dashboard shows store teams customer dwell time and frequent questions. — [CJ Newsroom](https://newsroom.cj.net/olive-young-ai-in-store-services/)
- The underlying LLM is not named. The kiosk is deployed first in multi-floor stores with many foreign shoppers, with a nationwide scale-up planned. — [CJ Newsroom](https://newsroom.cj.net/olive-young-ai-in-store-services/); [Korea Times](https://www.koreatimes.co.kr/business/companies/20260708/cj-olive-young-rolls-out-ai-kiosks-to-help-foreign-shoppers-navigate-stores); [Seoul Economic Daily](https://en.sedaily.com/finance/2026/07/08/olive-young-rolls-out-ai-shopping-assistant-for-foreign)
- ESTsoft co-launched an AI shopping assistant with CJ Olive Young (possible tech vendor for the avatar). — [ESTsoft](https://estsoft.ai/en/all/estsoft-launches-ai-shopping-assistant-with-cj-olive-young) (title only, not read in full)
- Olive Young plans to apply an LLM to more than 47 million consumer reviews to improve recommendation accuracy. Users type queries like "웜톤에 어울리는 틴트 추천해줘" on the Olive Young app. — [Hankyung, 2026-03-02](https://www.hankyung.com/article/2026030238111)
- Olive Young acquired the AI recommendation startup RocketView in 2022 to build its own recommendation engine. — [Asiae](https://www.asiae.co.kr/en/article/2022030121354717661) (headline only)

**Kakao / ChatGPT-hosted commerce**
- On 2026-03-24 Kakao revamped "Kakao Tools" inside "ChatGPT for Kakao", adding partners such as Olive Young, Musinsa and Hyundai Department Store. A user can ask, for example, for a sunscreen for dry skin and get Olive Young suggestions. The current features are mainly recommendations and links out to partner apps. In-chat purchase is planned. — [Asiae](https://www.asiae.co.kr/en/article/2026032409535180189)

**Amorepacific**
- "아모레챗" launched in May 2025 as a customer-service chatbot on Amore Mall. Skin diagnosis and cosmetics recommendation were added in February 2026. The company reports 100k cumulative users and quarterly usage up about 10%. The plan is to evolve it into an "AI 뷰티 전문가" that mirrors offline counselors. — [Hankyung](https://www.hankyung.com/article/2026030238111); [Ajunews 2025-05-23](https://www.ajunews.com/view/20250523093118139)
- At AWS Summit Seoul (May 2026), Amorepacific showed a "뷰티 컨시어지" built on Amazon Bedrock AgentCore. It covered AI skin diagnosis, skin-tone diagnosis, scalp/hair diagnosis and **personal color diagnosis**. — [Cosinkorea](https://www.cosinkorea.com/mobile/article.html?no=57514); [CNC News](https://www.cncnews.co.kr/mobile/article.html?no=10968) (search-snippet level)
- "Wanna-Beauty AI" (CES 2025 Innovation Award) is a voice-chatbot-based solution that uses generative AI to find a suitable makeup look and give a virtual try-on. It is the closest precedent to took's voice chatbot + lip try-on. — [Amorepacific newsroom 2025-01-06](https://www.apgroup.com/int/ko/news/2025-01-06-1.html) (search-snippet level)
- Amorepacific opened an Amore Mall app in ChatGPT, described as a first in Korean beauty. — [CNC News](https://www.cncnews.co.kr/mobile/article.html?no=10793); [ddaily 2026-03-19](https://www.ddaily.co.kr/page/view/2026031915250427898) (snippet level)

**L'Oréal Beauty Genius / ModiFace**
- Beauty Genius is L'Oréal Paris's AI beauty assistant. It does skin and skin-tone diagnostics and inclusive virtual try-on, and is built on generative AI + AR. — [Chain Drug Review](https://chaindrugreview.com/meet-beauty-genius-the-first-ai-beauty-assistant-from-loreal-paris); [Mass Market Retailers](https://massmarketretailers.com/loreal-paris-launches-ai-beauty-assistant-beauty-genius/)
- L'Oréal says it recommends from a closed catalog of 750+ L'Oréal Paris skincare, makeup and hair-color products. The try-on was trained on 6,000+ images and tested by makeup artists on 10,000+ products across 50 countries. — [L'Oréal Paris USA](https://www.lorealparisusa.com/beautygenius)
- Beauty Genius is offered in the US on brand and retailer sites and in stores via QR code. A L'Oréal executive says beauty diagnostics are increasingly handled by conversational gen-AI platforms. — [Formes de Luxe](https://www.formesdeluxe.com/article/beatrice-dautzenberg-l-oreal-beauty-diagnostics-are-increasingly-handled-by-conversational-gen-ai-platforms.65493)
- At VivaTech 2026, L'Oréal and OpenAI announced Maybelline virtual try-on (ModiFace-powered) inside ChatGPT. — [eWeek](https://www.eweek.com/fr/news/chatgpt-maybelline-try-on-emea-france/)
- Beauty Genius has a public FAQ page, useful for learning how it discloses AI limits. — [L'Oréal FAQ](https://www.lorealparisusa.com/beauty-genius-faqs) (not read)

**Perfect Corp / YouCam**
- The YouCam AI Beauty Agent launched in the YouCam Makeup app in November 2025. It recommends based on facial features, skin tone, occasion and preferences. — [Barchart/BusinessWire](https://www.barchart.com/story/news/36021918/perfect-corp-launches-youcam-ai-beauty-agent-in-youcam-makeup-app-to-lead-the-next-generation-of-conversational-ai-in-beauty-skincare-and-fashion)
- At CES 2026 Perfect Corp pitched "a single selfie + real-time dialogue" for skin analysis and product/routine recommendations. It contrasted this explicitly with rule-based chatbots and offered developer APIs for brands. — [BusinessWire 2025-12-19](https://www.businesswire.com/news/home/20251219606970/en/Perfect-Corp.-Unveils-Next-Generation-AI-Beauty-Agent-and-API-Innovations-Transforming-Beauty-Skincare-and-Retail-at-CES-2026)
- Company figure: more than 650k messages exchanged with the AI agent in 2025, and monthly users almost doubled in 10 months. — [BusinessWire 2025-12-22](https://www.businesswire.com/news/home/20251222886169/en/) (self-reported)

### Inferences
- Everyone recommends from a **closed catalog** (L'Oréal: 750+ own products; Olive Young: own inventory). This supports took's rule that the LLM never names a product outside the 285-item DB.
- The Olive Young kiosk and the took kiosk overlap a lot (avatar/voice, product info, skin-type recommendations). took's differentiators are CIEDE2000 lip-color matching and live lip try-on, which the Olive Young kiosk is not reported to have.
- Precedents keep personal color / skin-tone diagnosis as a **separate tool or diagnosis step** whose result feeds the recommender (Amorepacific Beauty Concierge modules, Beauty Genius diagnostics). That fits a tool-calling design: `diagnose_tone()` → `recommend_lips(tone)`.
- Olive Young's dashboard of "frequent questions" shows the value of logging kiosk utterances. That doubles as a source for a regression test set (see B3).

### Gaps
- Sephora (Virtual Artist, any 2025-26 LLM assistant) and Naver shopping AI agent: not researched within budget.
- No precedent states its hallucination-control method publicly (e.g., whether Beauty Genius validates product IDs). No public accuracy or error-rate data was found for any of these assistants.
- The YouCam agent page (perfectcorp.com/business/news/youcam-ai-beauty-agent) could not be fetched (returned only the title).

## A2. Open-source assets: personal color, skin tone/undertone, lip segmentation / makeup transfer, cosmetics datasets, and their licenses

### Takeaway
Reusable OSS for personal color is thin and mostly hobby-grade. ShowMeTheColor is the best-known Korean repo (dlib + k-means + Lab b*/HSV S, 4 seasons, self-reported 50–90% per season) but shows no license. The strongest makeup-transfer models (EleGANt, and PSGAN which it builds on) are **non-commercial** (CC BY-NC-SA 4.0). took's existing MediaPipe + CIEDE2000 approach is legally cleaner than adopting any of these.

### Cited Findings
- **ShowMeTheColor** (starbucksdolcelatte): Korean personal-color diagnosis. It uses dlib 68 landmarks for cheeks, eyes and brows and k-means dominant colors, converted to Lab/HSV. Lab b* decides warm/cool; HSV S then picks spring/autumn or summer/winter, and the result is the minimum weighted distance to reference colors. Self-reported accuracy is about 70% spring, 90% autumn, 50% summer/winter, and 70–100% for warm/cool. No license is shown on the page. — [GitHub](https://github.com/starbucksdolcelatte/ShowMeTheColor)
- **True Hue**: MIT-licensed Claude Code plugin for seasonal color analysis. It needs 5 calibrated photos, checks 4 dimensions, and asks for a reshoot when photo quality is poor. — [True Hue](https://bankielewicz.github.io/TrueHue/)
- **personal-color-test** is a hosted model on Replicate. Its code license is unknown. — [Replicate](https://replicate.com/abhijit-sai/personal-color-test/versions)
- **EleGANt** (ECCV 2022, makeup transfer, locally editable): **CC BY-NC-SA 4.0**, so commercial use is not allowed. Part of its code is built on PSGAN and aster.Pytorch. — [GitHub](https://github.com/Chenyu-Yang-2000/EleGANt)
- **Stable-Makeup** (2024): diffusion-based real-world makeup transfer with a detail-preserving makeup encoder. The code is at github.com/Xiaojiu-z/Stable-Makeup; the code license was not confirmed. — [arXiv 2403.07764](https://arxiv.org/abs/2403.07764v2)
- **Kanana Safeguard** (Kakao) is listed under B2. It is the Korean OSS asset most relevant to a Korean chatbot.
- Korean skin datasets: a Korean-face skin-condition dataset was built with high-resolution images and expert or instrument labels, for example moisture measured with PRIMOS Lite. The paper notes that Korean-specific skin data is scarce. — [KoreaScience paper](https://koreascience.kr/article/CFKO202333854982594.pdf)
- Korea Kolmar is building an AI skin-diagnosis platform (industry, not open data). — [Bizwatch 2026-06-30](https://news.bizwatch.co.kr/article/consumer/2026/06/30/0041)

### Inferences
- For a commercial product, avoid the NC-licensed makeup-transfer models. took's own MediaPipe lip mask + color blend needs no GAN.
- Personal color can be added as a deterministic tool, as ShowMeTheColor does with Lab b* plus saturation. It reuses took's existing Lab/CIEDE2000 code, so a model download is not required. Accuracy is weak for summer/winter and lighting-sensitive, so the UI should present the result as a "suggestion", not a diagnosis.

### Gaps
- Not verified in this session, though worth checking before use: MediaPipe Face Landmarker (believed Apache-2.0), the face-parsing.PyTorch / BiSeNet repos, CelebAMask-HQ (believed non-commercial), the BeautyGAN / MT makeup dataset terms, the Google Monk Skin Tone scale and MST-E dataset (the skintone.google page returned only a title), and AI Hub (aihub.or.kr) skin/cosmetics datasets and their use terms. Check each repo's LICENSE file directly.
- No open Korean cosmetics product DB with shade colors was found.

## A3. Research on LLM-based cosmetic recommendation / conversational recommenders with grounding

### Takeaway
No arXiv paper was found that combines cosmetics, catalog grounding and hallucination control. The general CRS literature agrees that prompt-only LLM recommenders invent items. It recommends retrieval or catalog anchoring, which is exactly took's "tool returns product_ids from DB" design.

### Cited Findings
- **Belle**: an LLM-based conversational recommender for beauty products using fine-tuned GPT-4o. It reports Distinct@1 rising from 0.7089 to 0.9081 after fine-tuning. Its gains come from fine-tuning, not grounding. — [Telkom University repository](https://openlibrary.telkomuniversity.ac.id/pustaka/files/231553/abstract/belle-large-language-model-based-conversational-recommender-systems-for-beauty-products-dalam-bentuk-pengganti-sidang-artikel-jurnal.pdf)
- A 2025 survey on generative recommendation says prompt-only approaches lack anchoring to the real item catalog and can produce fabricated recommendations. Retrieval or knowledge-graph methods help but add latency and maintenance cost. — [arXiv 2510.27157](https://arxiv.org/pdf/2510.27157)
- RAR (April 2026) adds a retriever stage plus RL from LLM feedback. It reports that anchoring the model in factual item metadata reduces hallucination. — [alphaXiv 2604.04457](https://www.alphaxiv.org/abs/2604.04457)
- Google's 2023 LLM-CRS paper notes that hallucination is hard to solve and that a full catalog is too large to memorize, which motivates retrieval-based grounding. — [arXiv 2305.07961](https://ar5iv.labs.arxiv.org/html/2305.07961)
- ReFICR (RecSys) is a retrieval-capable LLM for conversational recommendation that grounds recommendations in the real item space. — [RecSys session listing](https://recsys.acm.org/?p=19047)

### Inferences
- With only 285 products, took does not need vector retrieval. Deterministic tools (CIEDE2000 match, filters by brand/price/finish) are the retriever, and the LLM only chooses tools and writes Korean phrasing.

### Gaps
- No Korean-language cosmetics CRS paper or benchmark was found.

## B1. Guardrail patterns: schema-validated structured output, constrained tool use, refusal/fallback, kiosk prompt injection

### Takeaway
The most reliable pattern for a 285-product DB:
- The LLM outputs only tool calls and a structured reply that holds `product_ids`.
- The server checks every ID against the DB (enum or lookup).
- Every product fact (name, brand, price, shade, color) is rendered from the DB by a template, never from LLM text.

Any validation failure falls back to the existing rule engine. OWASP LLM01 (prompt injection) and LLM06 (excessive agency) are the governing risk categories; on a kiosk you mitigate them by giving the LLM only read-only tools and no secrets.

### Cited Findings
- OWASP Top 10 for LLM Apps 2025 ranks Prompt Injection as LLM01, both direct (jailbreak) and indirect (via external content). The 2025 edition adds multimodal injection. — [Invicti](https://invicti.com/blog/web-security/owasp-top-10-risks-llm-security-2025); [Promptfoo OWASP page](https://promptfoo.dev/docs/red-team/owasp-llm-top-10/)
- LLM06 Excessive Agency has three root causes: excessive functionality, permissions and autonomy. It was expanded because of agentic architectures. — [Aembit](https://aembit.io/blog/owasp-top-10-llm-risks-explained/); [Indusface](https://www.indusface.com/learning/owasp-top-10-llm/)
- One source claims an OWASP 2026 edition was released on 2026-08-04. It is unconfirmed. — [Aembit](https://aembit.io/blog/owasp-top-10-llm-risks-explained/) (single mention)
- Promptfoo has an `is-valid-function-call` / `is-valid-openai-tools-call` assertion that checks tool calls against their JSON schema, and `is-json` with schema validation. These can be used as regression checks for the same schema the server enforces. — [Promptfoo assertions docs](https://www.promptfoo.dev/docs/configuration/expected-outputs/)

### Inferences (design recommendations for took)
1. **Tool surface = existing functions only**, all read-only, for example `recommend_by_color(lab|hex, n)`, `search_products(brand?, finish?, price_max?)`, `get_product(id)`, `barcode_lookup(code)`, `start_tryon(product_id)`. This avoids LLM06.
2. **Schema with an ID allow-list**: the final reply is `{intent, product_ids: string[], say_ko: string}`. The server rejects any ID not in the DB. With 285 items, an enum of IDs in the JSON schema is feasible, but a server-side check is required regardless of the provider's "strict" mode.
3. **Facts from DB only**: `say_ko` must not contain prices, shade names or brand names. Either use a regex/NER check against product-name and price patterns, or use placeholder slots like `{{p1.name}}` that the server fills. The spoken TTS text is assembled server-side.
4. **Fallback ladder**: LLM timeout, schema failure, unknown ID, or a safety classifier flag → route to the current deterministic rule engine. The kiosk then always answers.
5. **Kiosk prompt injection**: voice input is untrusted. Keep no secrets or PII in the prompt, give no write tools, cap turns and tokens, reset the session on idle, and optionally screen input with a Korean classifier (B2). The only realistic harm is off-topic or abusive speech, plus made-up product claims, and points 2–3 neutralize the latter.
6. **Off-domain refusal**: classify intent first (rule engine or LLM). For non-beauty, medical/skin-disease or price-negotiation intents, use fixed Korean template refusals.

### Gaps
- OpenAI's Structured Outputs announcement page returned 403, so exact provider guarantees (strict mode, enum limits) are not cited here. Check the current OpenAI and Anthropic tool-use docs (the claude-api reference in this environment covers Claude).

## B2. Tools: NeMo Guardrails, Guardrails AI, Llama Guard / safety classifiers, Promptfoo, Ragas, DeepEval, LangSmith / Langfuse — license, JS support, 2026 status

### Takeaway
For a Node.js app, the practical stack is:
- **Promptfoo** (MIT, Node-native; acquired by OpenAI in March 2026) for regression and red-team evals.
- **Langfuse** (MIT core, JS/TS SDK; acquired by ClickHouse in January 2026, still OSS and self-hostable) for tracing.
- Optionally **Kanana Safeguard** (Apache-2.0, Korean) as an input/output safety classifier.

NeMo Guardrails and Guardrails AI are Python-first (Guardrails AI's JS package is a thin 0.1.x bridge that needs Python). Llama Guard 4 does not officially cover Korean. Ragas has no official TS version, and DeepEval's TS port is unconfirmed.

### Cited Findings
**Promptfoo**
- OpenAI announced the acquisition of Promptfoo in March 2026 (one source says 2026-03-09). The core CLI remains MIT. Sources disagree on long-term OSS commitments and the deal price. — [Emelia](https://emelia.io/hub/promptfoo-test-securite-ia); [AppSecSanta](https://appsecsanta.com/promptfoo); [dsebastien](https://www.dsebastien.net/promptfoo/)
- Assertions include `is-json` (+ schema), `javascript` custom checks, `llm-rubric`, `g-eval`, `contains`/`icontains-any`, `is-valid-function-call`, `tool-call-f1`, and `trajectory:tool-used` / `tool-args-match` / `tool-sequence`. Multiple providers in one config are tracked side by side, and `select-best` compares outputs. — [Promptfoo docs](https://www.promptfoo.dev/docs/configuration/expected-outputs/)
- Promptfoo ships an OWASP LLM Top 10 red-team preset. — [Promptfoo](https://promptfoo.dev/docs/red-team/owasp-llm-top-10/)

**Langfuse**
- ClickHouse acquired Langfuse (January 2026). Langfuse stays "100% open-source under its existing MIT license for core features", is self-hostable, and Langfuse Cloud continues. — [ClickHouse blog](https://clickhouse.com/blog/clickhouse-acquires-langfuse-open-source-llm-observability); [Langfuse press](https://langfuse.com/press)
- Langfuse open-sourced all product features under MIT in June 2024. — [Langfuse press](https://www.langfuse.com/press)

**NeMo Guardrails (NVIDIA)**
- Apache-2.0. It supports Colang 1.0 (default) and 2.0, and needs Python 3.10–3.13. No JS SDK was found, so it would have to run as a separate Python service. — [AppSecSanta](https://appsecsanta.com/nemo-guardrails); [arXiv 2310.10501](https://ar5iv.labs.arxiv.org/html/2310.10501)

**Guardrails AI**
- The core is Apache-2.0 and Python-first; Hub validators install via CLI and each validator may have its own license. — [GitHub](https://github.com/guardrails-ai/guardrails); [PyPI](https://pypi.org/project/guardrails-ai)
- The npm package `@guardrails-ai/core` is v0.1.1, Apache-2.0, with "limited support". It uses an IO bridge, so Python is also needed. It had about 11 weekly downloads at listing time. — [npm](https://www.npmjs.com/package/@guardrails-ai/core)

**Safety classifiers**
- **Kanana Safeguard** (Kakao, 2025-05-27) has three models under Apache-2.0: `kanana-safeguard-8b` (harmful content), `kanana-safeguard-siren-8b` (legal-sensitive requests: PII, IP) and `kanana-safeguard-prompt-2.1b` (adversarial prompt / injection detection). Kakao claims better F1 than global models on Korean safety (self-reported). — [Kakao](https://www.kakaocorp.com/page/detail/11568?lang=ENG); [Mozilla any-guardrail docs](https://docs.mozilla.ai/any-guardrail/api-reference/index/content-safety/kanana-safeguard); [FN News](https://en.fnnews.com/news/202505271818169596)
- **Llama Guard 4** (12B, pruned from Llama 4 Scout) is under the Llama Community License (not OSI; MAU threshold; AUP). Korean is not among Llama 4's 12 supported languages, and one paper marks it as lacking CJK coverage. — [OpenRouter](https://openrouter.ai/ko-KR/meta-llama/llama-guard-4-12b); [CultureGuard arXiv 2508.01710](https://arxiv.org/html/2508.01710v4); [DEV](https://dev.to/beanstechbr/llama-guard-is-not-a-guardrail-4l2c)
- PolyGuard covers 17 languages including Korean. A Korean WildGuard fine-tune exists (`iknow-lab/llama-3.2-3B-wildguard-ko-2410`). — [PolyGuard arXiv 2504.04377](https://arxiv.org/pdf/2504.04377); [HF](https://huggingface.co/iknow-lab/llama-3.2-3B-wildguard-ko-2410)

**Ragas / DeepEval**
- DeepEval (Confident AI) is Apache-2.0 and Python. The team announced TypeScript plans with a "by July 1st" target, but delivery is unconfirmed. — [GitHub issue #2734](https://github.com/confident-ai/deepeval/issues/2734); [eCorpIT comparison](https://ecorpit.com/rag-evaluation-tools-ragas-deepeval-braintrust-giskard-2026/)
- Ragas is Apache-2.0 and Python; there is no official TS version. Genkit's TS evaluators are ported from Ragas (Apache-2.0). One 2026 comparison calls Ragas "dormant", and another listing shows a January 2026 push, so the two sources conflict. — [npm @genkit-ai/evaluator](https://npmjs.com/package/@genkit-ai/evaluator); [eCorpIT](https://ecorpit.com/rag-evaluation-tools-ragas-deepeval-braintrust-giskard-2026/); [ecosyste.ms](https://summary.ecosyste.ms/projects/368188)

### Inferences
- RAG-faithfulness metrics (Ragas, DeepEval) matter less for took. Grounding is enforced structurally (ID allow-list + DB-rendered facts), so deterministic JS assertions in Promptfoo cover most needs.
- Kanana Safeguard 8B models need a GPU server. The 2.1B prompt-attack model is the lighter option. Korean text without a classifier can also be screened by a cheap LLM moderation call. This is optional for a kiosk with read-only tools.

### Gaps
- LangSmith (LangChain) license, pricing and JS status were not researched. LangSmith is a commercial SaaS with a JS SDK; this is background knowledge, not verified in this session.
- OpenAI Evals status in 2026 was not verified.
- Current Promptfoo version and post-acquisition roadmap were not confirmed from the official repo.

## B3. How to build a Korean regression test set comparing the rule engine with the LLM layer

### Takeaway
Use Promptfoo with two custom providers (the existing rule engine as a JS function, and the new LLM layer) over the same YAML/CSV of Korean utterances. Assert both with deterministic JavaScript checks: IDs exist in the DB, the expected intent and tool are used, no invented facts, and refusals on off-domain input. Then add `llm-rubric` only for the naturalness of the Korean phrasing.

### Cited Findings
- Promptfoo tracks metrics separately per provider in one config and supports `javascript` custom assertions, `is-json` schema validation, tool-call schema validation, `tool-call-f1`, trajectory checks (tool used, args match, sequence), `icontains-any`, and `llm-rubric` / `g-eval`. — [Promptfoo docs](https://www.promptfoo.dev/docs/configuration/expected-outputs/)
- Olive Young's kiosk logs frequent questions to a store dashboard. This kind of real-utterance logging is a natural seed source for test cases. — [CJ Newsroom](https://newsroom.cj.net/olive-young-ai-in-store-services/)
- Promptfoo's OWASP red-team preset can generate adversarial cases such as injection and excessive agency. — [Promptfoo](https://promptfoo.dev/docs/red-team/owasp-llm-top-10/)

### Inferences (proposed procedure)
1. **Seed the cases** with 150–300 Korean utterances tagged by intent, drawn from three sources: (a) the rule engine's existing trigger phrases, (b) paraphrases of each one (spoken style, honorific/banmal, STT errors like "틴트"→"틴트으", brand nicknames), and (c) logged kiosk utterances once consented.
2. **Categories**: color recommendation ("웜톤 코랄 추천"), product lookup by brand/name, barcode follow-ups, try-on commands ("이거 발라줘"), comparisons, price questions, out-of-catalog products (must say not available, never invent), off-domain (weather, medical: must refuse), injection ("이전 지시 무시하고…"), and empty or noisy STT.
3. **Gold labels per case**: expected intent, expected tool and arguments (or an acceptable set), and expected product ID set or constraint (e.g., "all results have ΔE00 ≤ X from target"). Also `must_not` facts.
4. **Deterministic assertions (JS)**: every returned ID ∈ DB; no price/brand string in `say_ko` that is absent from the referenced DB rows; tool sequence correct; latency budget met for kiosk voice.
5. **Soft assertions**: `llm-rubric` in Korean for politeness and naturalness. Keep these separate from the pass/fail gates.
6. **Run both providers** in one Promptfoo config and trace the LLM runs in Langfuse. Gate releases on "LLM ≥ rule engine on gold-intent accuracy and 0 hallucinated IDs/facts".

### Gaps
- No published Korean beauty-chatbot benchmark was found to borrow from. The test set must be built in-house.
