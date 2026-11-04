# Open-source conversational AI / chatbot platforms (as of 2026-11-04) and fit for "took" (Korean voice-only, DB-grounded beauty bot)

Method note: repo status (archived flag, last push, latest release, SPDX license) was pulled live from the GitHub REST API on 2026-11-04 (`https://api.github.com/repos/<owner>/<repo>` and `/releases/latest`). Those values are cited as the repo URL. Where a source could not be found, it is listed under Gaps rather than asserted.

## Q1. Current platforms: license, self-hosting, maintenance, ownership changes

### Takeaway
Of the visual "platform" products, the landscape shifted sharply in 2025-2026. Flowise (acquired by Workday in Aug 2025) was **archived and reached end of life in Aug 2026**. Rasa Open Source is in **maintenance mode**: its last OSS release was Jan 2025, and the actively developed CALM product (Rasa Pro) is source-available with a conversation cap on the free tier. Botpress's self-hostable v12 is effectively frozen and the current product is cloud. Dify, Langflow (MIT, now IBM-owned via DataStax), Typebot (FSL) and Open WebUI (custom license with a branding clause) are active, but only Langflow is a plain permissive OSI license.

### Cited Findings

**Rasa**
- The GitHub README says "Rasa Open Source is currently in maintenance mode" and points to Hello Rasa / CALM as the future. The license is Apache-2.0 — [RasaHQ/rasa](https://github.com/RasaHQ/rasa)
- The latest OSS release is 3.6.21 (published 2025-01-14). The repo is not archived and was last pushed 2026-07-24 — [GitHub API: RasaHQ/rasa](https://github.com/RasaHQ/rasa)
- The Rasa Pro Developer Edition (which includes CALM) is free and can run in production up to 1000 conversations/month (100/month for internal employee agents) — [Rasa Pro licensing docs](https://rasa.com/docs/rasa-pro/installation/python/licensing/); [Developer edition](https://rasa.com/docs/rasa-pro/developer-edition)
- Rasa's forum says the Developer Edition was introduced so CALM would reach more people "without cannibalizing our business." A later post says only one license now exists (the separate "extended" license is gone) — [Forum: Announcing the Rasa Developer Edition](https://forum.rasa.com/t/announcing-the-rasa-developer-edition/61009); [Forum: free Extended License](https://forum.rasa.com/t/announcing-the-free-extended-license-for-the-developer-edition/62959)
- The rasa-pro PyPI page says a paid license is required for larger-scale production use, while "all code is visible" — [PyPI rasa-pro](https://pypi.org/project/rasa-pro/3.12.0.dev12/)
- A third-party source (Voiceflow, a competitor, updated Jul 2026) says the Developer Edition replaces the old "Rasa Open Source" framing — [Voiceflow article](https://www.voiceflow.com/articles/rasa-chatbot) (secondary and competitor-authored; treat with caution)

**Botpress**
- v12 (the self-hostable on-prem product) is dual-licensed AGPLv3 / Botpress Proprietary. The README redirects users to Botpress Cloud and moves v12 docs to v12.botpress.com — [botpress/v12](https://github.com/botpress/v12)
- The last v12 release is v12.31.10 (2025-04-10), which is also the last push. The repo is not formally archived but shows no activity since then — [GitHub API: botpress/v12](https://github.com/botpress/v12)
- The current `botpress/botpress` repo is MIT. It contains integrations, a CLI, a client and an SDK that deploy to "your workspace" on Botpress Cloud. No self-hosted runtime is described — [botpress/botpress](https://github.com/botpress/botpress)

**Dify (LangGenius)**
- The license is Apache 2.0 with extra conditions. Running a multi-tenant environment (one tenant = one workspace) needs written authorization. The frontend logo/copyright must not be removed. Commercial use as a "backend-as-a-service" is explicitly allowed — [Dify LICENSE](https://www.Github.com/langgenius/dify/blob/main/LICENSE); [Dify docs: Open Source License](https://docs.dify.ai/policies/open-source)
- The wording of the multi-tenant clause differs slightly between the docs page ("multi-tenant SaaS similar to Dify's service") and the LICENSE ("any multi-tenant environment") — [Dify docs](https://docs.dify.ai/policies/open-source) vs [LICENSE](https://www.Github.com/langgenius/dify/blob/main/LICENSE)
- It is very active: latest release 1.18.0 (2026-10-23), pushed 2026-11-04, about 160k stars. The GitHub SPDX field reads NOASSERTION because the license is modified — [GitHub API: langgenius/dify](https://github.com/langgenius/dify)

**Flowise**
- Workday acquired Flowise on 2025-08-14 — [Workday press release (Nasdaq)](https://www.nasdaq.com/press-release/workday-acquires-flowise-bringing-powerful-ai-agent-builder-capabilities-workday); [Flowise blog](https://blog.flowiseai.com/workday-flowise)
- **The project has been archived.** The README now reads "Flowise has been archived. Refer to Future of Flowise." The GitHub API shows archived=true. The last release is flowise@3.1.4 (2026-07-29) — [FlowiseAI/Flowise](https://github.com/FlowiseAI/Flowise)
- Timeline: code freeze on 2026-07-29, public archive on 2026-08-13 (npm and Docker images marked deprecated), end of life on 2026-08-31. The stated reason is that developers increasingly rely on coding agents, and the rigid low-code workflow approach "quickly hits the limit" on complexity. The code stays Apache 2.0, and the team encourages forks — [Future of Flowise discussion #6727](https://github.com/FlowiseAI/Flowise/discussions/6727)

**Langflow**
- DataStax acquired Langflow (from Logspace) in April 2024 — [Langflow blog: big news](https://blog.langflow.org/big-news-for-langflow)
- IBM announced it would acquire DataStax in Feb 2025, with plans to pair Langflow with watsonx — [Techzine](https://www.techzine.eu/news/data-management/129066/ibm-strengthens-ai-portfolio-with-acquisition-of-datastax); [Verdantix](https://www.verdantix.com/insights/blogs/ibm-acquires-datastax-as-enterprise-data-moves-within-reach-of-ai-everything)
- The license is MIT. It is very active: latest v1.13.0 (2026-10-22), pushed 2026-11-04, about 156k stars — [GitHub API: langflow-ai/langflow](https://github.com/langflow-ai/langflow)

**Typebot**
- The LICENSE file is FSL-1.1-Apache-2.0 (Functional Source License, which converts to Apache 2.0 later). It is "Fair Source," not OSI open source. The README badge still says AGPLv3, which is inconsistent with the file — [typebot LICENSE (raw)](https://raw.githubusercontent.com/baptisteArno/typebot.io/main/LICENSE); [baptisteArno/typebot.io](https://github.com/baptisteArno/typebot.io)
- It is active (latest v3.19.1, 2026-10-20). The README lists "Easy-to-use APIs" and executing bots over HTTP — [GitHub API / repo](https://github.com/baptisteArno/typebot.io)

**Open WebUI / LibreChat (chat-UI style)**
- The Open WebUI License is BSD-3-style plus clause 4. Altering or removing "Open WebUI" branding is prohibited unless the deployment has 50 or fewer end users per rolling 30 days, written permission was given, or an enterprise license is held. A CLA is required — [Open WebUI LICENSE (raw)](https://raw.githubusercontent.com/open-webui/open-webui/main/LICENSE)
- Open WebUI is active: v0.13.0 released 2026-11-03 — [GitHub API: open-webui/open-webui](https://github.com/open-webui/open-webui)
- ClickHouse reportedly acquired LibreChat in Nov 2025, and LibreChat stays MIT — [TrueFoundry blog](https://www.truefoundry.com/blog/librechat-vs-open-webui) (vendor blog, secondary). The GitHub repo now redirects from danny-avila/LibreChat to LibreChat-AI/LibreChat — [github.com/LibreChat-AI/LibreChat](https://github.com/LibreChat-AI/LibreChat)

**Tock (other notable OSS platform, still alive)**
- Apache-2.0, actively released: tock-26.9.1 (2026-11-02), pushed 2026-11-03. It has a `tock-gen-ai` module and React/Vue web kits — [GitHub API: theopenconversationkit/tock](https://github.com/theopenconversationkit/tock); [Tock site](https://theopenconversationkit.github.io/tock/en); [tock-gen-ai artifacts](https://nexus.web.cern.ch/nexus/content/repositories/public/ai/tock/tock-gen-ai)

### Inferences
- The Flowise shutdown is direct evidence of the risk of building on a vendor-owned low-code platform. The maintainers' own reason (coding agents, plus low-code hitting a complexity ceiling) matches took's situation: custom UI, a strict grounding rule, and a vanilla-JS codebase.
- Rasa's free CALM tier caps production conversations at 1000/month. A busy in-store kiosk could exceed that. The OSS 3.6 line gets only maintenance.
- Licensing friction by platform: Typebot (FSL) and Open WebUI (branding clause) have real friction for a branded kiosk product. Dify's terms are acceptable for a single-tenant backend use. Langflow (MIT) and Tock (Apache) are the cleanest.

### Gaps
- Exact IBM–DataStax close date: only one secondary review gives 2025-05-28. Not verified against IBM or DataStax.
- The LibreChat–ClickHouse acquisition is confirmed only by a vendor blog. No primary ClickHouse press release was fetched.
- Typebot's self-hosting conditions under FSL (the docs "license requirements" page) were not fetched.

## Q2. Fit with took: rule+LLM hybrid, custom HTTP tools, headless/API-only with own front end and voice pipeline, Korean

### Takeaway
None of these platforms provides anything took cannot already do in code, and most add a Python/Docker server and a second "source of truth" for flows. Rasa CALM is conceptually the closest fit (deterministic business-logic "flows" plus an LLM for understanding), but its Python stack and conversation cap are poor matches. Dify or Langflow could serve as headless LLM backends. For took, a code-level approach (the existing JS rule engine plus an LLM used only for intent/slot extraction or phrasing, plus tool-calling into the 285-product JSON) fits better.

### Cited Findings
- Rasa's own positioning: CALM is the forward path, and OSS is maintenance-only. CALM ships with Rasa Pro (Developer Edition) — [RasaHQ/rasa README](https://github.com/RasaHQ/rasa); [Rasa developer edition](https://rasa.com/docs/rasa-pro/developer-edition)
- Dify's license explicitly contemplates "backend-as-a-service" use for other applications, so headless use behind a custom front end is permitted. Logo restrictions apply only to the frontend — [Dify docs: Open Source License](https://docs.dify.ai/policies/open-source)
- Typebot advertises APIs and running bots over HTTP requests — [typebot.io repo](https://github.com/baptisteArno/typebot.io)
- Botpress's current development surface is an SDK/CLI that deploys bots and integrations to Botpress Cloud workspaces. No self-hosted runtime is described — [botpress/botpress](https://github.com/botpress/botpress)
- Flowise is no longer an option for new projects (EOL 2026-08-31) — [Future of Flowise](https://github.com/FlowiseAI/Flowise/discussions/6727)
- Tock offers web front-end kits (tock-react-kit, tock-vue-kit) and a gen-AI module — [pkgstats tock-react-kit](https://pkgstats.com/pkg:tock-react-kit); [tock-gen-ai](https://nexus.web.cern.ch/nexus/content/repositories/public/ai/tock/tock-gen-ai)

### Inferences
- **Grounding rule ("never invent products").** Every LLM-centric platform (Dify, Langflow, Typebot's AI blocks) defaults to LLM-generated text. Enforcing "only products from the JSON" still needs custom code: tool-call results rendered as cards from DB IDs, and an LLM that never authors product names. The platform does not solve this; took's code would.
- **Voice-only plus custom UI** (compare box, product cards, TTS, kiosk). All the platforms ship their own chat widget, which took would discard. That leaves only the backend, where the value over a direct LLM API call plus took's own Node router is small.
- **Multimodal lip/face color.** Took computes color client-side or in its own code. No platform adds value here beyond passing the color as a variable/tool argument.
- **Korean.** With LLM-backed platforms, Korean quality depends on the chosen LLM, not the platform. Classic NLU-based stacks (Rasa OSS 3.x, Tock's classic NLU) would need Korean tokenization and training data (inference; no specific source fetched).
- **Recommendation.** Do not adopt a platform. Keep the deterministic JS engine as the authority (product lookup, color matching, compare logic). Optionally add an LLM layer for (a) Korean intent/slot extraction from STT text into the existing intents, and (b) natural phrasing of answers built only from retrieved DB rows, with strict validation that every product mentioned exists in the JSON. If a framework is wanted, prefer a code-level library (in JS) over a visual platform. Dify or Langflow are acceptable only as an optional headless LLM sidecar for experimentation, and Langflow's MIT license is the least restrictive.

### Gaps
- No source was fetched on Korean-specific evaluations of Dify, Langflow, Rasa CALM or Typebot.
- Dify's Service API and Langflow's REST API docs were not fetched in this pass. Headless capability is inferred from the license wording and general product positioning.
- No source was fetched on Rasa CALM's Korean support or its LLM-provider requirements.

## Q3. Status of old platforms from the Korean blog list

### Takeaway
Most of the classic list is dead or frozen. MS Bot Framework SDK, Botkit, LUIS and QnA Maker are archived or retired. Wit.ai's conversation features were sunset in 2017-2018. Claudia Bot Builder, Bottender and BotMan have had no release in 4-9 years. Only ChatterBot, Tock and (marginally) DeepPavlov are alive, and among them only Tock is a full platform with recent releases.

### Cited Findings
- **Microsoft Bot Framework SDK.** The GitHub repo is archived (archived=true); the last tagged release is 4.14.0 (2021-07-13) — [GitHub API: microsoft/botframework-sdk](https://github.com/microsoft/botframework-sdk). Microsoft docs say the SDK and Emulator are archived and no longer maintained, support tickets stop being serviced as of 2025-12-31, and the replacement is the Microsoft 365 Agents SDK (C#/JS/Python) — [Bot Framework SDK overview (docs.azure.cn)](https://docs.azure.cn/en-us/bot-service/bot-service-overview)
- **LUIS.** Microsoft announced in Sept 2022 that LUIS would retire on 2025-10-01, later extended to 2025-10-31 — [Microsoft Q&A retirement announcement](https://learn.microsoft.com/en-us/answers/questions/1031241/retirement-announcement-language-understanding-(lu?page=0); [M365 message AZ492962](https://mc.merill.net/message/AZ492962). A June 2025 Microsoft post says LUIS is fully deprecated on 2026-03-31, after which inference requests return errors. The migration target is CLU in Azure AI Language — [Microsoft Tech Community](https://techcommunity.microsoft.com/blog/azure-ai-services-blog/-/4424921); [LUIS→CLU migration](https://docs.azure.cn/en-us/ai-services/language-service/reference/migrate)
- **QnA Maker.** Retired (the replacement is custom question answering in Azure AI Language). See Gaps: no primary source for the exact date was fetched in this pass.
- **Botkit.** howdyai/botkit is archived (read-only, archived by the owner around Sept 2024). The last release is v4.15.0 (2022-03-23) and the last push 2024-07-01 — [GitHub API: howdyai/botkit](https://github.com/howdyai/botkit); [Botkit readme](https://github.com/howdyai/botkit/blob/main/readme.md?plain=1)
- **Bottender (Yoctol).** Not archived, but the last release is v1.5.5 (2021-11-10) and the last push 2024-04-10. MIT — [GitHub API: yoctol/bottender](https://github.com/yoctol/bottender)
- **Claudia Bot Builder.** The last release is v2.15.0 (2017-03-07) and the last push 2022-04-07. MIT — [GitHub API: claudiajs/claudia-bot-builder](https://github.com/claudiajs/claudia-bot-builder)
- **Wit.ai.** Bot Engine / "stories" were sunset (merge deprecated 2017-07-27), and the conversation API shut down on 2018-01-01. The official Node client lives under a "DEPRECATED-node-wit" archive name. NLU-only use may still exist — [Wit.ai Medium: sunsetting Bot Engine](https://medium.com/wit-ai/launching-built-in-nlp-for-messenger-and-sunsetting-bot-engine-beta-46e9038869a5); [TechCrunch](https://techcrunch.com/?p=1520174); [witty README](https://github.com/monorkin/witty); [DEPRECATED-node-wit](https://uithub.com/facebookarchive/DEPRECATED-node-wit)
- **ChatterBot.** Alive: release 1.2.15 (2026-08-25), pushed 2026-11-01. BSD-3-Clause. It is a simple retrieval/ML Python library, not a platform — [GitHub API: gunthercox/ChatterBot](https://github.com/gunthercox/ChatterBot)
- **DeepPavlov.** The last release is 1.7.0 (2024-08-12) and the last push 2025-08-06. Apache-2.0. Not archived, but releases have slowed or stalled — [GitHub API: deeppavlov/DeepPavlov](https://github.com/deeppavlov/DeepPavlov)
- **BotMan (PHP).** The last tagged release is 2.6.1 (2020-09-11), though the repo had a push on 2026-04-03. MIT — [GitHub API: botman/botman](https://github.com/botman/botman)
- **Tock.** Active: tock-26.9.1 (2026-11-02). Apache-2.0 — [GitHub API: theopenconversationkit/tock](https://github.com/theopenconversationkit/tock)
- **OpenDialog.** The GitHub path opendialogai/opendialog returns 404 via the API. A third-party directory says no public open-source repo is available — [creati.ai listing](https://creati.ai/de/ai-tools/opendialog-ai/) (unverified secondary)

### Inferences
- For a Node.js project, every JS option on the old list (Botkit, Bottender, Claudia, MS Bot Framework JS) is dead or frozen. There is no maintained classic JS bot framework among them.
- Microsoft's successor (M365 Agents SDK) targets Teams/M365 channels and Azure. It is a poor fit for a standalone web kiosk (inference from the positioning in the docs).

### Gaps
- **QnA Maker:** retirement widely reported as 2025-03-31, but no primary Microsoft page was fetched to confirm it.
- **Juji:** no source found. It is believed to be a commercial (non-OSS) cognitive-AI chatbot SaaS (juji.io); status unverified.
- **Golem:** no source found. The name is ambiguous (a Python chatbot framework vs. the unrelated Golem Network). GitHub API calls were rate-limited before this could be checked.
- **Wit.ai today (2026):** whether the NLU API itself is still operating was not confirmed.
- **OpenDialog:** whether any open-source repo exists under another org name was not confirmed.
