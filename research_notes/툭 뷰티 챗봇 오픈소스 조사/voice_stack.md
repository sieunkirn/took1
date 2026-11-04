# Open-source Korean voice stack for a voice-only beauty kiosk (as of Nov 2026)

Scope: replacing or keeping browser Web Speech (STT + speechSynthesis) in "took" (Node.js and vanilla JS; voice-only chatbot on an iPad kiosk and in the browser). The notes cover Korean STT, Korean TTS, real-time voice-agent frameworks and VAD/turn detection, and speech-to-speech (omni) models. Research budget was about 20 tool calls, so some items are thinly sourced. Those are flagged.

## Q1. Korean STT: which open models, how accurate, streaming, hot-word biasing, license, in-browser vs local server?

### Takeaway
Two open models look best for Korean on a small local server today. Qwen3-ASR-1.7B (Apache-2.0, streaming through vLLM, free-form context prompt for brand and shade names) and faster-whisper large-v3 / large-v3-turbo (MIT, mature, `initial_prompt` biasing) both reach about 3–5% CER on read Korean (FLEURS). On spontaneous Korean (KsponSpeech) Whisper's error rate roughly doubles or triples. Running in the browser on an iPad (transformers.js with WebGPU) is still experimental on Safari and limited to small models. NVIDIA Canary and Parakeet do not clearly cover Korean.

### Cited Findings
**Benchmarks (not directly comparable across sets):**
- FLEURS ko_kr, first 60 utterances (741 s), CPU only (4 cores), PR dated 2026-10-04. CER by setup:
  - Qwen3-ASR 1.7B: 3.34% (95% CI 1.9–5.1), RTF 0.47.
  - faster-whisper large-v3: 4.08% (CI 2.5–5.9), RTF 0.88.
  - faster-whisper large-v3-turbo: 4.60% (CI 2.9–6.6), RTF 0.36.
  - faster-whisper medium: 4.93%.
  - Qwen3-ASR with VAD-segmented spans: 4.82%.
  - The author notes that differences under about 1 point are noise with this sample size, and that most turbo errors are digits or Latin text, a reference-convention issue that matters for prices and English brand names. A Korean `initial_prompt` did not improve CER on generic speech. — [GitHub PR #740](https://github.com/zkaelxz/U00/pull/740)
- Spontaneous KsponSpeech Eval-Other: one vendor's internal test gives whisper-large-v3 11.13% CER, against 3.91% on English LibriSpeech Other. — [Edge AI and Vision Alliance / ENERZAi, Nov 2025](https://www.edge-ai-vision.com/2025/11/small-models-big-heat-conquering-korean-asr-with-low-bit-whisper/)
- One model card (self-reported) gives raw Whisper large-v3 17.03% CER on KsponSpeech eval_clean (3,000 samples). It also gives 8.68% for a Korean fine-tune of large-v3-turbo, and says commercial systems reach about 5.9–6.2%. — [HF: o0dimplz0o/Whisper-Large-v3-turbo-STT-Zeroth-KO-v2](https://huggingface.co/o0dimplz0o/Whisper-Large-v3-turbo-STT-Zeroth-KO-v2)
- Another community Korean fine-tune of turbo exists. — [HF: ghost613/whisper-large-v3-turbo-korean](https://huggingface.co/ghost613/whisper-large-v3-turbo-korean)
- EMNLP 2025 Findings paper: fine-tuning Whisper-large-v2 on KsponSpeech lowers general CER (10.54% after fine-tuning). Gains on domain-specific (meteorological) queries were limited, which suggests domain vocabulary remains hard even after fine-tuning. — [ACL Anthology 2025.findings-emnlp.561](https://aclanthology.org/2025.findings-emnlp.561.pdf)
- SenseVoice-Small (Korean): 8.92% CER in a FunASR benchmark (184 files, H100; the author calls it practical guidance, not a leaderboard). — [FunASR benchmark page](https://modelscope.github.io/FunASR/ko/benchmark.html)
- A community Korean fine-tune of SenseVoiceSmall reports a baseline CER of 0.096 before fine-tuning. — [HF: plzsay/sensevoice-ko-jerry](https://huggingface.co/plzsay/sensevoice-ko-jerry)

**Qwen3-ASR:**
- Apache-2.0. Korean is among 30 languages plus 22 Chinese dialects.
- One model handles streaming and offline inference. Streaming works only with the vLLM backend, with no batching or timestamps in streaming mode.
- Ships an OpenAI-compatible server (`vllm serve` / `qwen-asr-serve`). About 2B params in BF16, and the examples assume an NVIDIA GPU.
- Tech report: arXiv 2601.21337 (Jan 2026). — [HF: Qwen/Qwen3-ASR-1.7B](https://huggingface.co/Qwen/Qwen3-ASR-1.7B)
- The Transformers model card says users can pass "free-form context (e.g. domain-specific vocabulary, names…)" via the prompt, with hot words in a system message, to bias transcription. — [HF: Qwen3-ASR-0.6B-hf (Transformers port)](https://huggingface.co/ArchiveStudio/Qwen3-ASR-0.6B-hf)
- A Korean note says contextual biasing was a headline feature of the API version (Qwen3-ASR-Flash). It is unclear whether the open weights behave identically. — [tilnote.io](https://tilnote.io/en/pages/697b89b82e41a092b88672ee)

**Moonshine (tiny, on-device):**
- The "Flavors of Moonshine" paper (Sep 2025) releases a Korean model of about 27M parameters (Tiny) under a permissive license.
- Across the language models, average error is 48% lower than Whisper Tiny. The models beat Whisper Small and in most cases match Whisper Medium, and run 5–15x faster than Whisper on-device. — [arXiv 2509.02523](https://arxiv.org/pdf/2509.02523)

**NVIDIA NeMo:**
- The NeMo docs list Parakeet-TDT-0.6B-v3 with 25 languages, and describe Canary ASR as covering 25 EU languages. — [NVIDIA NeMo featured models](https://docs.nvidia.com/nemo/speech/latest/asr/featured_models.html)
- A community "Kanary" Korean Canary 1B pre-release exists, with evaluation listed as "TBD". — [HF mirror: lee1jun/kanary-1b-pre-v0.1](https://huggingface-proxy.pages.dev/lee1jun/kanary-1b-pre-v0.1)
- A community NeMo Korean conformer-transducer model also exists. — [HF: eesungkim/stt_kr_conformer_transducer_large](https://huggingface.co/eesungkim/stt_kr_conformer_transducer_large)

**In-browser (transformers.js / WebGPU):**
- transformers.js runs Whisper with `device: 'webgpu'` and falls back to WASM.
- Real-time use needs audio chunking in a Web Worker, and guides recommend tiny or base models for real-time.
- Safari support is reported inconsistently: "Safari/iOS 16.4+ (experimental)" in one project, WASM fallback in others. — [LogRocket: real-time voice agent in the browser](https://blog.logrocket.com/how-to-build-a-real-time-voice-ai-agent-in-the-browser); [DEV: Whisper WebGPU tutorial](https://dev.to/proflead/real-time-audio-to-text-in-your-browser-whisper-webgpu-tutorial-j6d); [GitHub: Yonet/WhisperGPUExample](https://github.com/Yonet/WhisperGPUExample)

**Web Speech on Safari/iOS (current baseline):**
- Developers report sessions stopping on their own, "buffer clogging", and failed first attempts. Suggested workarounds are push-to-talk, `continuous: false` with auto-restart (brief gap on restart), and warming up the mic first. — [lilting.ch iOS Web Speech tips](https://lilting.ch/en/articles/ios-webspeech-api-tips)
- A Safari bug report: recognition keeps listening after `stop()` and `onend` fire (iOS 16.1.1). — [Stack Overflow archive](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/75498609/safari-webkitspeechrecognition-continuous-bug)
- The web-features explorer lists Safari and iOS Safari as not supported for SpeechRecognition, which conflicts with older demos claiming iOS 14.5+ works. — [web-features explorer](https://web-platform-dx.github.io/web-features-explorer/features/speech-recognition); [addpipe demo](https://addpipe.com/web-speech-api-demo/)
- Web Speech on Safari routes audio to Apple's servers; this was not verified in this search (see Gaps).

### Inferences
- **Domain words** (글로시, 코랄, brand names, Korean price numerals): these are where server ASR plus a prompt and context helps most. Pass the brand and shade lexicon as Qwen3-ASR context, or as a Whisper `initial_prompt`/hotwords string. Keep the existing phonetic correction layer as a post-processor, because Whisper-family errors concentrate on digits and Latin text.
- **Noisy store:** server ASR with a VAD front end (Silero) plus a close-talk or directional mic matters more than the model choice. Every benchmark above is on clean or read audio. Spontaneous speech raised Whisper CER to about 11–17%.
- **Hardware:** Qwen3-ASR-1.7B streaming needs an NVIDIA GPU (vLLM); an 8–12 GB consumer card is likely enough for a 2B BF16 model (inferred, not measured). faster-whisper large-v3-turbo can run on CPU (RTF 0.36 on 4 cores in the PR), but latency per utterance will be high-ish. A small GPU or Apple Silicon box (whisper.cpp) is preferable.
- **On-iPad Korean STT:** Moonshine Korean (27M) is the most plausible fully on-device option. Accuracy will trail large-v3 and Qwen3-ASR.

### Gaps
- No same-test-set Korean comparison covering Qwen3-ASR, Whisper, SenseVoice, Moonshine-ko and NeMo on spontaneous or noisy speech. The FLEURS PR is a small, read-speech sample.
- I did not verify:
  - whisper.cpp or distil-whisper Korean numbers. Distil-Whisper models are mostly English-only, which is my prior and was not sourced.
  - Kyutai STT Korean support.
  - Korean sovereign-AI ASR releases beyond HyperCLOVA X Omni.
- I did not measure:
  - Korean hot-word biasing effectiveness for Qwen3-ASR open weights.
  - The Moonshine Korean CER figure itself.
- Whether Safari Web Speech is on-device or server-based for ko-KR in iOS 26 (privacy implication).

## Q2. Korean TTS: quality, latency, license?

### Takeaway
For commercial Korean TTS on a local server, Fun-CosyVoice 3.0 (Apache-2.0, Korean, about 150 ms streaming, needs an NVIDIA GPU) is the strongest open option found. MeloTTS (MIT, Korean, CPU real-time) is the lightweight safe choice. Supertonic runs in the browser and supports Korean, but its weights are OpenRAIL-M and its project status is uncertain. XTTS-v2, F5-TTS and Fish Speech/OpenAudio weights are non-commercial.

### Cited Findings
- **Fun-CosyVoice 3.0** (`Fun-CosyVoice3-0.5B-2512`, Dec 2025): Apache-2.0, 9 languages including Korean, latency as low as 150 ms with bi-streaming (text in, audio out). 0.5B params; the Docker examples assume an NVIDIA GPU. vLLM and TensorRT-LLM runtimes have been supported since 2025. — [GitHub: FunAudioLLM/CosyVoice](https://github.com/FunAudioLLM/CosyVoice)
- **MeloTTS:** MIT, "free for both commercial and non-commercial use", supports Korean, "fast enough for CPU real-time inference". The last update date was not shown. — [GitHub: myshell-ai/MeloTTS](https://github.com/myshell-ai/MeloTTS)
- **Supertonic 3:**
  - Code is MIT and weights are OpenRAIL-M (use-based restrictions carry over).
  - Supports 31 languages including Korean, running on WebGPU in the browser with WASM fallback via four ONNX models.
  - The official repo now sits under an archive organization ("supertone-oss-archive"), indicating development and support have ended.
  - A third-party mirror claims Supertone planned to dissolve in July 2026 (unverified). — [GitHub: supertone-oss-archive/supertonic wiki](https://github.com/supertone-oss-archive/supertonic/wiki); [HF mirror: supertonic-3](https://huggingface.co/jiangzhuo9357/supertonic-3); [everydev summary](https://www.everydev.ai/tools/supertonic/llms.txt)
- **Non-commercial licenses** (one 2026 guide each): XTTS v2 (Coqui Public Model License), F5-TTS weights (CC-BY-NC), and open Fish Speech (CC-BY-NC-SA-4.0). Fish Audio S2 weights are under a research/non-commercial license, with commercial use requiring a license. — [promptquorum XTTS license](https://www.promptquorum.com/power-local-llm/local-tts-voice-cloning-piper-coqui-xtts); [localaimaster 2026 local TTS](https://localaimaster.com/blog/best-local-tts-models); [openvoxai 2026](https://openvoxai.com/blog/best-tts-models-local-cloud-2026)
- **Kokoro, Chatterbox, Orpheus:** described as Apache or MIT, but Korean support was not confirmed in the sources. — [pinggy 2026 TTS](https://pinggy.io/blog/best_open_source_self_hosted_text_to_speech_models/)
- **Qwen3-TTS:** described as an Apache-2.0 multilingual cloner. Korean support was not confirmed in the sources found. — [edenai 2026](https://www.edenai.co/post/top-free-text-to-speech-tools-apis-and-open-source-models)
- HyperCLOVA X SEED Omni 8B also generates Korean speech (see Q4).

### Inferences
- The kiosk reads short answers (product name, shade, price), so a fixed single brand voice is better than voice cloning.
- CosyVoice 3 gives the best naturalness and streaming on a GPU server. MeloTTS on CPU is a cheap fallback.
- Browser `speechSynthesis` on iPad is free, on-device and low latency. It is reasonable to keep it until a server pipeline exists anyway.
- Brand names in Latin script and price numerals need text normalization before TTS (for example 39,000원 → "삼만 구천 원"). The existing Korean number-word logic can be reused in reverse.

### Gaps
- No objective Korean MOS or CER-of-TTS comparison across CosyVoice 3, MeloTTS and Supertonic was found.
- Current XTTS project status (Coqui company shutdown, community fork) was not sourced in this pass.
- Zonos, Kokoro and Naver/Kakao open TTS: Korean support and licenses were not verified.

## Q3. Real-time voice-agent frameworks, VAD and turn detection: can they wrap took's own tool-calling LLM layer?

### Takeaway
Pipecat (BSD-2, Python, JS/iOS client SDKs, pluggable STT/LLM/TTS, Silero VAD plus the Smart Turn model) is the best fit for wrapping a custom LLM and tool layer. LiveKit Agents is stronger if WebRTC rooms are wanted. Its multilingual turn detector supports Korean, but the model ships under the LiveKit Model License, not OSI. Silero VAD (MIT, under 1 ms per 30 ms chunk on CPU) is the standard VAD in both. Both frameworks are Python-centric; the Node app would talk to them over WebRTC or WebSocket.

### Cited Findings
- **Pipecat:**
  - BSD-2-Clause, Python 3.11+.
  - Client SDKs for JavaScript, React, React Native, Swift (iOS), Kotlin and others.
  - Transports: Daily, LiveKit and SmallWebRTC (WebRTC), FastAPI WebSocket, and a WebSocket server.
  - STT includes Whisper, and Silero VAD is built in. Guides cover custom service integrations. — [GitHub: pipecat-ai/pipecat](https://github.com/pipecat-ai/pipecat)
- **Pipecat Smart Turn:** BSD-2-Clause. One source calls v3.2 audio-native across 23 languages; others describe it differently, so the details are inconsistent. — [forasoft 2026 comparison](https://www.forasoft.com/blog/article/pipecat-vs-livekit-agents); [Luke Oliff comparison](https://lukeocodes.dev/pipecat-vs-livekit-agents-comparison)
- **LiveKit multilingual turn detector:**
  - Supports Korean (13 languages listed).
  - Needs about 400 MB of RAM and about 25 ms per inference.
  - The model is under the LiveKit Model License; the plugin code is Apache-2.0. — [PyPI livekit-plugins-turn-detector](https://pypi.org/project/livekit-plugins-turn-detector/1.4.1/)
  - Newer versions point to a unified audio end-of-turn model (`livekit.agents.inference.TurnDetector`) in place of the deprecated text plugin. — [PyPI 1.8.10](https://pypi.org/project/livekit-plugins-turn-detector/1.8.10/)
- **Positioning (vendor-adjacent sources):** LiveKit fits WebRTC rooms, video and SIP; Pipecat fits explicit, customizable pipelines. — [evalgent 2026](https://www.evalgent.com/blog/pipecat-vs-livekit); [thinnest.ai 2026](https://www.thinnest.ai/blog/open-source-voice-ai-frameworks)
- **TEN Framework:** has its own VAD and end-of-turn model, with agents defined as JSON graphs (an older source). — [Medium comparison](https://medium.com/@ggarciabernardo/realtime-ai-agents-frameworks-bb466ccb2a09)
- **Silero VAD:**
  - MIT license; one badge says CC BY-NC 4.0, an inconsistency to double-check.
  - Processes one 30+ ms chunk in under 1 ms on a single CPU thread, at 8 or 16 kHz.
  - Trained on 6000+ languages, with an ONNX version.
  - Browser VAD via ONNX Runtime Web is a community project. — [GitHub: snakers4/silero-vad](https://github.com/snakers4/silero-vad)

### Inferences
- **Architecture options:**
  - **Option A, minimal:** keep the browser UI and stream mic audio over WebSocket to a Node or Python ASR service (Silero VAD, then Qwen3-ASR or faster-whisper with the brand lexicon as context). Then run the existing correction layer and LLM/tool layer, return text, and play TTS (CosyVoice or MeloTTS stream, or keep `speechSynthesis`).
  - **Option B, full agent:** Pipecat server (SmallWebRTC transport, Silero VAD plus Smart Turn, custom LLM service wrapping took's tool-calling backend over HTTP) with the Pipecat JS client in the kiosk page. This adds barge-in and interruption handling.
- In a voice-only kiosk, barge-in matters mainly to stop TTS when the customer speaks. Echo from the kiosk speaker into its own mic is the main risk in-store. WebRTC echo cancellation (via `getUserMedia` constraints or a WebRTC transport) helps.

### Gaps
- No primary-source documentation fetched for Pipecat function calling, LiveKit Agents' Node.js SDK maturity, or TEN 2026 status.
- Whether Smart Turn supports Korean was not confirmed.
- Barge-in behavior was not checked in docs.

## Q4. Speech-to-speech / omni models with Korean: viable yet?

### Takeaway
Two open omni models support Korean speech in and out: Qwen3-Omni (Apache-2.0) and Naver's HyperCLOVA X SEED Omni 8B (custom license permitting commercial use). Both are heavy (multi-GPU class). End-to-end speech-to-speech also makes the brand and shade vocabulary, price accuracy and tool calling harder to control than a cascaded STT → LLM → TTS pipeline. Not recommended for this kiosk yet.

### Cited Findings
- **Qwen3-Omni:**
  - Instruct, Thinking and Captioner variants under Apache 2.0.
  - Speech input in 19 languages and speech output in 10, both including Korean.
  - Real-time text or speech output, with a reported theoretical 234 ms cold-start first-packet latency. — [arXiv 2509.17765 (Qwen3-Omni tech report)](https://arxiv.org/html/2509.17765v1)
- **HyperCLOVAX-SEED-Omni-8B:**
  - A unified text, vision and speech auto-regressive model with audio output; about 16 GB to download.
  - Listed hardware is 4x A100 80 GB (requirements), while a component table shows about 48 GB of VRAM across 3 GPUs. Parameter count is shown as 11B, against "8B" in the name.
  - Benchmarks include KsponSpeech and FLEURS (numbers in an image).
  - Under a custom "HyperCLOVA X SEED 8B Omni Model License Agreement". — [HF: naver-hyperclovax/HyperCLOVAX-SEED-Omni-8B](https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Omni-8B)
  - The paper says it is open-weight under a custom license that permits commercial use. — [ResearchGate: HyperCLOVA X 8B Omni](https://www.researchgate.net/publication/399478217_HyperCLOVA_X_8B_Omni)
  - Press coverage calls it Korea's first native omni-modal foundation model. — [koreabizdaily](https://www.koreabizdaily.com/en-us/articles/855159)
- Korean speech-LM benchmarks (KVoiceBench, KOpenAudioBench, KMMAU) appeared in 2026. — [arXiv 2605.27984](https://arxiv.org/pdf/2605.27984)

### Inferences
- HyperCLOVA X Omni's ASR component, or Qwen3-Omni, could be evaluated later as an ASR-only or Korean-quality reference.
- For a kiosk that must return exact product names and prices through tools, the cascaded pipeline remains safer and cheaper.

### Gaps
- Moshi and Kyutai Korean support was not found (likely English/French-focused, unverified).
- HyperCLOVA X Omni's Korean CER, TTS scores and exact commercial-use conditions (e.g., user caps) were not extracted.
- Qwen3-Omni GPU requirements were not checked.

## Overall recommendation (inference, for the report writer)
1. **Now:** keep Web Speech but harden it for iPad: push-to-talk, `continuous:false` with auto-restart, mic warm-up, and the existing scoring and correction. Keep `speechSynthesis`.
2. **When Safari reliability, noise or privacy becomes a blocker, or for a dedicated kiosk deployment:** move STT to a local server: Silero VAD, then Qwen3-ASR-1.7B (or faster-whisper large-v3 / turbo) with the brand and shade lexicon as context or prompt, then the existing correction layer. Hardware: one NVIDIA GPU box for Qwen3-ASR streaming; CPU or Apple Silicon is possible with faster-whisper or whisper.cpp at higher latency.
3. **Optional:** server TTS with CosyVoice 3 (GPU) or MeloTTS (CPU) for a consistent brand voice.
4. **Optional:** Pipecat as the orchestration layer if barge-in and smart turn-taking are wanted; wrap took's tool-calling LLM as a custom LLM service.
5. **Before choosing:** build a small in-store test set (about 100 recorded kiosk utterances with brand, shade and price words) and compare candidates on CER and domain-term accuracy.
