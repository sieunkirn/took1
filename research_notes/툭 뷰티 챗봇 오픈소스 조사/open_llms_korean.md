# Open-weight LLMs for a Korean tool-calling beauty chatbot (as of Nov 2026)

Scope: open models that can understand free-form Korean, call took's search/recommend tools, and answer in friendly Korean. Researched 2026-11-04. Many search hits were unofficial Hugging Face mirror domains; where possible, facts below come from the official huggingface.co / ollama.com pages, and mirror-only claims are flagged.

## Which models are strong in Korean AND reliable at tool calling?

### Takeaway
For a kiosk-sized deployment, the realistic open candidates are **Qwen3.5 (9B / 27B / 35B-A3B)**, **Gemma 4 (12B / 26B-A4B / 31B)** and **Kakao Kanana-2-30B-A3B**. All three have documented tool calling and run on one GPU or a Mac. LG EXAONE 4.0 (32B / 1.2B) is very good at Korean and tool use, but its license is non-commercial. The Korean sovereign-AI flagships (K-EXAONE 236B, Solar Open 100B, A.X K1 519B, and the 2nd-round A.X K2 / K-EXAONE 2.0 / Solar 2) are datacenter-scale MoEs. They are far too large for a kiosk and are only relevant through hosted APIs.

### Cited Findings
**Korean-made models**
- EXAONE 4.0 comes in 32B and 1.2B sizes, supports tool calling through tool schemas, and is served on vLLM with `--enable-auto-tool-choice --tool-call-parser hermes --reasoning-parser deepseek_r1` (vLLM 0.10.0 or later) — [HF: EXAONE-4.0-1.2B](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-1.2B)
- EXAONE 4.0 scores, non-reasoning mode: 1.2B gets KMMLU-Redux 40.4 and BFCL-v3 55.7; 32B gets KMMLU-Redux 64.8, KMMLU-Pro 60.0 and BFCL-v3 65.2. In reasoning mode, 32B gets Tau-Bench Retail 62.8 and 1.2B gets 28.1 — [HF: EXAONE-4.0-1.2B](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-1.2B)
- A mirrored card lists EXAONE 4.0 32B at BFCL-v3 63.9 (reasoning) vs Qwen3 32B at 70.3 — [EXAONE 4.0 tech report arXiv 2507.11407](https://arxiv.org/abs/2507.11407) (comparison figure seen on a mirror; verify in the paper)
- K-EXAONE is a 236B-total / 23B-active MoE with 256K context. Its scores: KoBALT 61.8, CLIcK 83.9, KMMLU-Pro 67.3, τ2-Bench Retail 78.6 / Airline 60.4 / Telecom 73.5. It accepts OpenAI-format tool schemas and uses vLLM's `hermes` parser — [HF: K-EXAONE-236B-A23B](https://huggingface.co/LGAI-EXAONE/K-EXAONE-236B-A23B)
- Kanana-2-30b-a3b-instruct (30B total / 3B active, Dec 2025) scores KMMLU 67.32 and HAE-RAE 75.57, plus BFCL-v3 Live 74.30 and Multi-Turn 35.38. vLLM serving uses `--enable-auto-tool-choice --tool-call-parser hermes` — [HF: kanana-2-30b-a3b-instruct](https://huggingface.co/kakaocorp/kanana-2-30b-a3b-instruct)
- Kakao says Kanana-2 has more than 3x better multi-turn tool calling than Kanana-1.5-32.5b and is on a par with Qwen3-30B-A3B — [Kakao press release](https://www.kakaocorp.com/page/detail/11918?lang=ENG); [Korea Times](https://www.koreatimes.co.kr/amp/business/tech-science/20251219/kakao-open-sources-kanana-2-model-optimized-for-agentic-ai)
- Kanana 1.5 shipped in 8B and 2.1B sizes (base and instruct) under Apache 2.0, with improved function calling — [HF: kanana-1.5-8b-instruct-2505](https://huggingface.co/kakaocorp/kanana-1.5-8b-instruct-2505); [Asia Economy](https://www.asiae.co.kr/en/article/2025052309565209385)
- HyperCLOVA X SEED Think 32B is an open-weight reasoning model from NAVER — [arXiv 2601.03286](https://arxiv.org/pdf/2601.03286). HyperCLOVA X SEED 8B Omni is an omnimodal 8B model released together with a 32B model that Naver describes as having stronger tool use — [arXiv 2601.01792](https://arxiv.org/abs/2601.01792); [Asia Economy](https://www.asiae.co.kr/en/article/2025123016085673315). A mirrored model card shows an OpenAI-client tool-call example for Omni-8B, but this was not verified on the official huggingface.co page — [mirror](https://hugface-5b9.pages.dev/naver-hyperclovax/HyperCLOVAX-SEED-Omni-8B)
- Solar Open 100B is a 102.6B-total / 12B-active MoE. Its scores: KMMLU 73.0, HAE-RAE v1.1 73.3, Ko-IFEval 87.5, Ko Arena Hard v2 79.9, Tau² Retail 59.3. On the same card, gpt-oss-120b (high) beats it on Ko-IFEval (93.2). vLLM serving uses a `solar_open` tool parser and Upstage's vLLM fork — [HF: Solar-Open-100B](https://huggingface.co/upstage/Solar-Open-100B)
- SKT A.X K1 is a 519B-total / 33B-active MoE with KMMLU 80.2, CLIcK 84.9 and IFEval-ko 81.0. Its card does not document tool calling, and vLLM/SGLang support exists only in forks — [HF: skt/A.X-K1](https://huggingface.co/skt/A.X-K1)

**Sovereign AI project (독자 AI 파운데이션 모델)**
- 1st round (2026-01-15): LG AI Research, SKT and Upstage advanced. Naver Cloud and NC AI were dropped; Naver was dropped on the originality criterion — [korea.kr](https://www.korea.kr/briefing/policyBriefingView.do?newsId=156740468); [Platum](https://platum.kr/archives/279684)
- Motif Technologies was added in February 2026 — [korea.kr](https://www.korea.kr/briefing/policyBriefingView.do?newsId=156745273)
- 2nd round (2026-08-18): SKT, Upstage and LG advanced, and Motif was eliminated. Scores: SKT 70.6, Upstage 69.9, LG 69.0, Motif 65.8 — [korea.kr](https://www.korea.kr/briefing/policyBriefingView.do?newsId=156774781); [Newsis](https://www.newsis.com/view/NISX20260818_0003752341); [Nate/news 0827](https://m.news.nate.com/view/20260827n36572)
- 2nd-round models: SKT A.X K2 (688B total / ~33B active, 260K context), LG K-EXAONE 2.0 (749B MoE), Upstage Solar 2 (~102B), Motif 3 (314B / 13B active). The article does not say whether weights are on Hugging Face — [Nate/news 0806](https://m.news.nate.com/view/20260806n26557)

**Global models**
- Qwen3.5 open sizes: 0.8B, 2B, 4B, 9B, 27B dense, 35B-A3B, 122B-A10B and 397B-A17B. Instruct models from 4B up support tool use, and the vLLM parser is `qwen3_coder` (secondary sources) — [codersera guide](https://codersera.com/blog/qwen-3-5-complete-guide-2026/); [orcarouter](https://www.orcarouter.ai/blog/qwen-3-5)
- Ollama tags qwen3.5 with tools, thinking and vision. Tags: 4b (3.3–4.0 GB), 9b (6.6–7.6 GB), 27b (17–20 GB), 35b (22 GB), 122b (81 GB), plus MLX builds — [Ollama: qwen3.5](https://ollama.com/library/qwen3.5)
- Gemma 4 was released 2026-04-02 with native function calling. Sizes: E2B, E4B, 12B, 26B MoE, 31B dense — [Google on X](https://x.com/Google/status/2039736229600612767?lang=en); [Wikipedia](https://en.wikipedia.org/wiki/Gemma_(language_model)); [Ollama: gemma4](https://ollama.com/library/gemma4)

### Inferences
- For took's narrow job (Korean NLU, then a search/recommend call, then a short Korean answer), a 9B–35B model with BFCL-v3 Live in the ~70s should be enough. Kanana-2 30B-A3B (3B active) is a strong fit: Korean-native, fast like an MoE, and it reports BFCL numbers.
- Qwen3.5-35B-A3B and Gemma 4 26B-A4B are the best-licensed alternatives in the same speed class. Their Korean tool-calling quality was not measured in any source found here, so a small in-house Korean tool-call eval (e.g., 50–100 real kiosk utterances) is needed before choosing.
- 1–4B models (EXAONE 4.0 1.2B: BFCL 55.7, Qwen3.5 4B, Gemma 4 E4B) are probably too unreliable for multi-turn tool use. The "never invent products" requirement should be enforced by the app (only render products returned by the tools), not trusted to the model.

### Gaps
- No Korean-specific function-calling results (FunctionChat-Bench, Ko-BFCL) or current (2026) Horangi / Open Ko-LLM leaderboard standings were found. The Horangi leaderboard exists — [W&B Horangi](https://wandb.ai/wandb-korea/korean-llm-leaderboard/reports/Horangi-LLM-Leaderboard-Evaluating-Korean-Language-Proficiency--Vmlldzo2OTg0MDU2) — but 2026 results were not retrieved.
- Llama 4, Mistral, DeepSeek and gpt-oss were not researched in depth (no primary sources fetched). gpt-oss-120b appears only as a comparison row on the Solar Open card above.
- Official Qwen3.5 and Gemma 4 Korean benchmark numbers (KMMLU etc.) were not retrieved.
- It is unknown whether A.X K2, K-EXAONE 2.0 and Solar 2 weights are public.

## Licenses: which allow unrestricted commercial use?

### Takeaway
Licenses with no restrictions: **Qwen3.5 (Apache 2.0), Gemma 4 (Apache 2.0), Kanana 1.5 (Apache 2.0), SKT A.X K1 (listed apache-2.0)**. Commercial use is allowed but with conditions under **Kanana-2 (Kanana License)** and **HyperCLOVA X SEED** (both require "Powered by …" attribution, have a 10M MAU cap, and impose naming rules on derivatives; Kanana also restricts reselling the model in on-prem or on-device products). **EXAONE 4.0** is non-commercial. K-EXAONE and Solar Open use custom licenses whose terms were not verified.

### Cited Findings
- EXAONE 4.0 uses the "EXAONE AI Model License Agreement 1.2 - NC". The update removed LG's claim to output ownership and extended permitted use from research to education; it is still NC — [HF: EXAONE-4.0-1.2B](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-1.2B). A commercial path exists through FriendliAI's hosted endpoint, which is "licensed under commercial purposes" — [EXAONE 4.0.1 card mirror](https://huggingface-proxy.pages.dev/LGAI-EXAONE/EXAONE-4.0.1-32B)
- K-EXAONE uses the "K-EXAONE AI Model License Agreement"; its terms were not summarized on the card — [HF](https://huggingface.co/LGAI-EXAONE/K-EXAONE-236B-A23B)
- HyperCLOVA X SEED 32B Think license terms:
  - A separate NAVER license is needed above 10M MAU (affiliates count) or for products that compete with NAVER.
  - "Powered by HyperCLOVA X" must be shown prominently, and a Notice file must be included.
  - Derivative or trained models must have names that begin with "HyperCLOVA X".
  - NAVER claims no rights to outputs.

  — [HF LICENSE](https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Think-32B/blob/main/LICENSE). Naver describes SEED as "commercial open-source" — [CLOVA tech blog](https://clova.ai/en/tech-blog/sowing-the-seeds-in-the-ai-ecosystem-introducing-hyperclova-x-seed-a-commercial-open-source-ai)
- Kanana License (Kanana-2) terms:
  - You may use it to build and run your own services.
  - A separate license is needed to offer the model to third parties via API or cloud, to resell it in SI, on-prem or on-device products, or above 10M MAU.
  - "Powered by Kanana" must be displayed.
  - Derivative models must carry the "Kanana" name prefix.

  — [HF LICENSE](https://huggingface.co/kakaocorp/kanana-2-30b-a3b-instruct/blob/main/LICENSE)
- Kanana 1.5 is Apache 2.0 — [HF](https://huggingface.co/kakaocorp/kanana-1.5-8b-instruct-2505)
- Solar Open 100B: weights are under the "Upstage Solar License" and code under Apache 2.0. Some mirrors name it "Solar-Apache License 2.0", which is a conflict to resolve — [HF](https://huggingface.co/upstage/Solar-Open-100B)
- A.X K1 is listed as apache-2.0 — [HF](https://huggingface.co/skt/A.X-K1)
- Gemma 4 is Apache 2.0, a change from earlier Gemma's custom terms — [Google on X](https://x.com/Google/status/2039736229600612767?lang=en)
- Every Qwen3.5 open size is Apache 2.0 (secondary source, checked Sept 2026). Some later Qwen 3.6/3.8 releases have different licenses — [vdf.ai](https://vdf.ai/blog/qwen-on-premises-enterprise-deployment/); [codersera](https://codersera.com/blog/qwen-3-5-complete-guide-2026/)

### Inferences
- A took kiosk is a self-run service, which Kanana-2 permits. But if took sells kiosks with the model embedded ("on-device products"), that may trigger Kanana's commercial-license clause. Qwen3.5 and Gemma 4 avoid this question entirely.
- Avoid EXAONE 4.0 for anything commercial unless it is accessed through a licensed host.

### Gaps
- Full text of the K-EXAONE, Upstage Solar, Llama 4 community and HyperCLOVA X SEED Omni-8B licenses was not reviewed.
- Gemma 4 and Qwen3.5 licenses were not confirmed on their official HF LICENSE files; Ollama's pages do not state them.

## Local serving and hardware (Ollama, llama.cpp, vLLM, LM Studio)

### Takeaway
Ollama has first-party, tool-tagged builds of Qwen3.5 and Gemma 4, including MLX builds for Apple Silicon, and exposes an OpenAI-compatible API. That makes a Mac mini kiosk with a 9B–35B 4-bit model feasible. Korean models (EXAONE, Kanana-2, HyperCLOVA) are vLLM-first, using the `hermes` parser, so on a Mac you depend on community GGUF/MLX ports. The sovereign MoEs need 4–8 datacenter GPUs or more.

### Cited Findings
- Ollama download sizes:
  - qwen3.5: 9b 6.6–7.6 GB, 27b 17–20 GB, 35b 22 GB; MLX variants exist — [Ollama](https://ollama.com/library/qwen3.5)
  - gemma4: e4b 6.6–9.5 GB, 12b 7.7–8.0 GB, 26b MoE 16–19 GB, 31b 19–20 GB; MLX variants exist — [Ollama](https://ollama.com/library/gemma4)
- Ollama supports the OpenAI SDK, so OpenAI-style tool-calling code can run locally against Gemma 4 — [dev.to guide](https://dev.to/apilover/how-to-run-gemma-4-locally-with-ollama-a-complete-guide-487b)
- vLLM tool-calling flags per model:
  - EXAONE 4.0: `hermes` (vLLM 0.10.0+) — [HF](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-1.2B)
  - Kanana-2: `hermes`; SGLang `qwen` — [HF](https://huggingface.co/kakaocorp/kanana-2-30b-a3b-instruct)
  - K-EXAONE: `hermes` (vLLM 0.14.0+, llama.cpp b7737+) — [HF](https://huggingface.co/LGAI-EXAONE/K-EXAONE-236B-A23B)
  - Qwen3.5: `qwen3_coder` — [orcarouter](https://www.orcarouter.ai/blog/qwen-3-5)
- The EXAONE 4.0 card points to community quantizations for llama.cpp, Ollama and LM Studio, but has no official instructions for them — [HF](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-1.2B)
- Hardware for the large Korean MoEs:
  - K-EXAONE: full 256K context with tensor parallelism on 4x H200 — [HF](https://huggingface.co/LGAI-EXAONE/K-EXAONE-236B-A23B)
  - Solar Open: at least 4x A100 80GB; 8-GPU examples given — [HF](https://huggingface.co/upstage/Solar-Open-100B)
  - A.X K1: SGLang example uses 4 nodes at TP 32 — [HF](https://huggingface.co/skt/A.X-K1)
  - Qwen3.5-397B: about 236 GB at Int4, 4x H200 in FP8 — [vdf.ai](https://vdf.ai/blog/qwen-on-premises-enterprise-deployment/)
- Hosted alternatives: K-EXAONE is on FriendliAI serverless — [Friendli blog](https://friendli.ai/blog/k-exaone-on-serverless). HyperCLOVA X SEED Think 32B is listed with API providers on Artificial Analysis — [Artificial Analysis](https://artificialanalysis.ai/zh/models/hyperclova-x-seed-think-32b/providers). Ollama offers `gemma4:cloud` — [Ollama](https://ollama.com/library/gemma4)

### Inferences
- **Kiosk shortlist and hardware:**
  1. **Qwen3.5-35B-A3B or 27B**, through Ollama or MLX. A Mac mini with 32 GB or more of unified memory, or a single 24 GB GPU, fits a 4-bit build (17–22 GB).
  2. **Gemma 4 26B-A4B or 12B**, through Ollama. Same class of hardware; the 12B fits on 16 GB machines.
  3. **Kanana-2-30B-A3B-instruct**, through vLLM on a single 24–48 GB GPU (4-bit/8-bit), or a community GGUF. It has the best Korean nuance, but check the license clauses.
- The 3B–4B active-parameter MoEs give fast responses on modest hardware, which matters for a voice-only chatbot where latency adds to STT/TTS time.
- Expose a single OpenAI-compatible endpoint (Ollama or vLLM) so models can be A/B tested without changing took's tool-calling code. Hosted APIs (frontier closed models, FriendliAI K-EXAONE) remain the quality benchmark to compare the local candidates against.

### Gaps
- No measured tokens/sec on a Mac mini for these models was found. Hardware fit is inferred from Ollama download sizes.
- Whether Ollama's tool-call parsing works for community EXAONE, Kanana-2 or HyperCLOVA GGUFs was not verified.
- Hosted-API pricing and Korean quality for closed models (GPT, Claude, Gemini, HyperCLOVA X API) were not researched here.
