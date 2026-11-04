# RAG / Product-Search Stack for a Korean Cosmetics Chatbot ("took", Node.js ESM, Nov 2026)

## Q1. At 285 items, do we need vector RAG, or is structured filtering + LLM query-to-filter extraction enough? When does hybrid pay off?

### Takeaway
At 285 products the whole catalog's metadata fits in an LLM context, so the strongest first step is LLM query-to-filter extraction ("self-query") that turns free-form Korean into the existing attribute filter + CIEDE2000 re-rank, with the LLM only allowed to cite returned product IDs. Dense/hybrid retrieval starts to pay off once free-text fields (reviews, ingredients, long descriptions) dominate and the doc count reaches thousands. Korean RAG vendors and benchmarks generally favor hybrid (BM25 + dense) at that scale.

### Cited Findings
- LangChain.js `SelfQueryRetriever` uses an LLM to write a structured query (semantic query + metadata filter) from natural language and applies it to a vector store. `attributeInfo` describes the filterable fields, and translators (FunctionalTranslator for in-memory, QdrantTranslator, ChromaTranslator) map it to store filter syntax. Requires the `peggy` peer dependency — [LangChain.js self-query docs](https://js.langchain.com/docs/how_to/self_query); [in-memory self-query](https://docs.langchain.com/oss/javascript/integrations/retrievers/self_query/memory)
- Allganize's Korean RAG leaderboard covers 5 domains (finance, public, medical, legal, commerce). Allganize's own Alli pipeline uses hybrid search, and LLM-judge metrics are used (with some error rate) — [Allganize RAG-Evaluation-Dataset-KO](https://huggingface.co/datasets/allganize/RAG-Evaluation-Dataset-KO/blob/main/README.md?code=true); [Allganize blog on retriever optimization](https://www.allganize.ai/en/blog/retriever-optimization-strategies-for-successful-rag)
- Korean lexical matching fails without morphological analysis: surface forms like "검색했다" / "검색은" must reduce to "검색". BM25 is strongest on exact matches such as SKUs, and the common RAG pattern is a BM25 candidate list, then a reranker or dense hybrid — [RAG Core Study: Sparse Retrieval & BM25 (blog, 2026-05)](https://maju-tech.blogspot.com/2026/05/rag-core-study-1126-sparse-retrieval.html)
- Hybrid fusion: Qdrant docs say RRF sidesteps the scale mismatch between dense and BM25 scores by ignoring magnitude, while DBSF normalizes each score distribution — [Qdrant hybrid search docs](https://qdrant.tech/documentation/search-tuning/hybrid-search/)
- Orama hybrid mode merges min-max normalized BM25 scores with cosine similarity using configurable weights — [Orama (GitHub mirror README)](https://github.com/0ahz/orama); [openapps.pro listing](https://openapps.pro/apps/orama)

### Inferences
- For "건조한 입술에 좋은 촉촉한 거": an LLM maps it to `finish ∈ {glossy, water, moist…}` plus intent "hydrating". For "여름 휴가 때 바를 만한 거": it maps to finish/long-wear/color_family (coral, orange) and a color target that CIEDE2000 re-ranks. These are attribute intents, not semantic-recall problems, so at 285 items a deterministic filter driven by an LLM-extracted JSON filter (with the field enum supplied in the prompt) is more controllable and auditable than vector search. Grounding: pass only the filtered candidate rows (≤20–30) to the answer LLM and require it to cite product IDs.
- An even simpler option at 285 items is "catalog in context": compress each product to about 30–50 tokens (285 × 40 ≈ 11k tokens), let the LLM pick IDs, then validate them against the DB. This works but costs more per query and is harder to test than filter extraction.
- Add a dense/hybrid layer when one of these holds: (a) descriptions or reviews carry the signal ("각질 부각 안 됨", "컵에 안 묻음") that attributes don't capture; (b) docs reach the low thousands (e.g., reviews); (c) users use vocabulary not covered by the attribute enum. The recommended ordering: LLM filter extraction → hard attribute filter → hybrid (BM25 + dense, RRF) over text fields → color-distance and/or cross-encoder re-rank → LLM answer over the top-k only.

### Gaps
- No published benchmark was found that compares self-query/filter extraction against vector RAG on small (~300-item) product catalogs. The scale thresholds above are engineering judgment, not sourced numbers.

## Q2. Frameworks: Haystack, LlamaIndex (Python/TS), LangChain retrievers — status, license, fit for JS

### Takeaway
LlamaIndex.TS is deprecated and archived (2026), so it should not be adopted. Haystack is Python-only (Apache-2.0). LangChain.js is the only maintained JS framework of the three with ready-made self-query and hybrid integrations. For a 285-item, single-retriever app, a framework is optional: plain code (Orama/LanceDB + transformers.js + an LLM SDK) is simpler.

### Cited Findings
- The LlamaIndexTS README says the project "is deprecated and no longer maintained". The repo was archived on Apr 30, 2026 — [GitHub run-llama/LlamaIndexTS](https://github.com/run-llama/LlamaIndexTS). A third-party review dates the deprecation to March 11, 2026, with the last release on Dec 2, 2025 — [promptquorum review](https://www.promptquorum.com/zh/power-local-llm/llamaindex-rag-framework-review). @llamaindex/* npm packages are marked deprecated — [developersdigest blog](https://www.developersdigest.tech/blog/llamaindex-workflows-agents-whats-new-2026); [depscope @llamaindex/anthropic](https://mcp.depscope.dev/pkg/npm/@llamaindex/anthropic). The Python LlamaIndex continues (llama-index-workflows 2.26.0, Oct 11, 2026, per a secondary blog) — [developersdigest](https://www.developersdigest.tech/blog/llamaindex-workflows-agents-whats-new-2026)
- Haystack (deepset) is Apache-2.0 and supports BM25, embedding, and hybrid retrieval in one pipeline — [promptquorum Haystack review](https://www.promptquorum.com/power-local-llm/haystack-deepset-rag-framework-review); [futureagi](https://futureagi.com/blog/what-is-haystack-2026/). Its current version conflicts across secondary sources: one says v3.1 (2026-08-24), another says v2.30.2 (June 2026) — [promptquorum](https://www.promptquorum.com/power-local-llm/haystack-deepset-rag-framework-review); [modern-datatools](https://www.modern-datatools.com/tools/haystack)
- LangChain.js provides SelfQueryRetriever with Qdrant/Chroma/in-memory translators — [LangChain.js self-query](https://js.langchain.com/docs/how_to/self_query); [Qdrant self-query integration](https://js.langchain.com/docs/integrations/retrievers/self_query/qdrant); [Chroma self-query](https://js.langchain.com/docs/integrations/retrievers/self_query/chroma)

### Inferences
- In a JS codebase, Haystack would require a separate Python service. That is only worthwhile if the Python-only Korean tooling (kiwipiepy, sentence-transformers rerankers, AutoRAG) is needed anyway.
- The self-query pattern is small to implement by hand: a JSON-schema "tool call" to the LLM that returns `{finish:[], color_family:[], price_max, color_hint, semantic_query}`. Implementing it directly avoids LangChain's dependency surface.

### Gaps
- No official deepset source was fetched for Haystack's current version number. License and LangChain.js release cadence were not verified from primary repos in this pass.

## Q3. Vector stores: pgvector, Qdrant, Chroma, LanceDB, sqlite-vec, Orama — license, JS client, hybrid + filtering, in-process vs server

### Takeaway
For took's scale and Node-only stack, the in-process choices fit best. Orama (Apache-2.0, pure JS, BM25 + vector + hybrid + filters in one search call) is the lightest. LanceDB (`@lancedb/lancedb`, embedded, FTS + vector + RRF reranker in TS) is the most capable embedded option. Qdrant (server) is the upgrade path when the corpus reaches tens of thousands and needs sparse+dense fusion. pgvector makes sense only if Postgres is already in use. sqlite-vec is still pre-1.0.

### Cited Findings
- **Orama**: Apache-2.0. Search `mode` is 'fulltext' | 'vector' | 'hybrid'. Vector fields have a fixed size, the default similarity threshold is 0.8, and number/enum schema types plus search filters are supported. Advertises "stemming and tokenization in 30 languages". Has a data-persistence plugin and `@orama/plugin-embeddings` (TensorFlow.js, 512-dim) — [GitHub oramasearch/orama](https://github.com/oramasearch/orama). Full-text uses BM25 and hybrid fuses min-max normalized scores — [openapps.pro](https://openapps.pro/apps/orama)
- **LanceDB**: hybrid search fuses FTS and vector results through a reranker, RRFReranker by default. The TS API is `table.createIndex("text", { config: lancedb.Index.fts() })`, `.fullTextSearch()`, `.nearestTo()`, `.rerank()`. Custom rerankers in TS currently support hybrid only — [LanceDB hybrid search docs](https://lancedb.com/docs/search/hybrid-search). The FTS index supports an ngram base tokenizer (overlapping character spans) — [LanceDB FTS index docs](https://docs.lancedb.com/indexing/fts-index); [features](https://docs.lancedb.com/features). Use `@lancedb/lancedb`, since the older `vectordb` package is deprecated (third-party tutorial) — [noqta tutorial 2026](https://www.noqta.tn/en/tutorials/lancedb-typescript-embedded-vector-search-nextjs-2026)
- **Qdrant**: hybrid search uses dense and sparse prefetches plus fusion (RRF or DBSF). BM25 sparse vectors use `modifier: "idf"` so IDF is computed server-side — [Qdrant hybrid search](https://qdrant.tech/documentation/search-tuning/hybrid-search/); [Cloud Inference hybrid tutorial](https://qdrant.tech/documentation/tutorials-basics/cloud-inference-hybrid-search/index.md). The Universal Query API arrived in 1.10, with TS examples using `@qdrant/js-client-rest` and `fusion: 'rrf'` — [Qdrant 1.10 blog](https://qdrant.tech/blog/qdrant-1.10.x/index.md)
- **pgvector**: 0.8.0 (tagged Oct 30, 2024) added iterative index scans (`hnsw.iterative_scan`, e.g. `relaxed_order`; `ivfflat.iterative_scan`). This fixes over-filtering, where filters applied after an HNSW scan return too few rows (example: a 10% selective filter with ef_search=40 yields about 4 rows). It also improved planner choice between ANN and B-tree indexes — [PostgreSQL.org announcement](https://www.postgresql.org/about/news/pgvector-0.8.0-released-2952/); [Nile blog](https://www.thenile.dev/blog/pgvector-080)
- **sqlite-vec**: pre-v1 ("expect breaking changes"). The npm package's latest is 0.1.9 (2026-03-31), with a 0.1.10 alpha. The README describes metadata, auxiliary, and partition-key columns — [GitHub asg017/sqlite-vec](https://github.com/asg017/sqlite-vec); [ecosyste.ms npm data](https://packages.ecosyste.ms/api/v1/registries/npmjs.org/packages/sqlite-vec)
- **Elasticsearch/OpenSearch + Nori**: Nori is the official Lucene Korean morphological analyzer, based on mecab-ko-dic. It must be installed on every node, and its chain is nori_tokenizer, nori_part_of_speech, nori_readingform, lowercase. Supports decompound_mode and user_dictionary — [Elastic Nori docs](https://docs-v3-preview.elastic.dev/elastic/docs-builder/docs/3944/reference/elasticsearch/plugins/analysis-nori-analyzer); [Elastic blog](https://www.elastic.co/blog/nori-the-official-elasticsearch-plugin-for-korean-language-analysis)

### Inferences
- Korean BM25 in Orama or LanceDB: neither is documented as having a Korean morphological tokenizer. Pre-tokenize with Kiwi (kiwi-nlp WASM) into a space-joined "morph" field and index that field, or use LanceDB's ngram tokenizer (character bigrams work reasonably well for Korean). Qdrant sparse BM25 likewise needs pre-tokenized input from the client.
- Chroma was not researched in depth this pass. It is client/server from JS, so it offers little over Orama/LanceDB here.

### Gaps
- Could not confirm from Orama docs whether Korean is among its 30 languages, or the custom-tokenizer API (the docs page fetch returned only navigation).
- Chroma license, JS client status, and hybrid support were not verified. Qdrant, LanceDB, and Orama licenses beyond Orama's Apache-2.0 were not verified from LICENSE files in this pass (from prior knowledge: Qdrant Apache-2.0, LanceDB Apache-2.0, pgvector PostgreSQL License — unverified).

## Q4. Korean embedding models and rerankers — benchmarks, license, size, local (ONNX / transformers.js)

### Takeaway
On MTEB(kor, v2) Retrieval, the 2026 Korean leader is nlpai-lab **KURE-v2** (Apache-2.0, 154M, ColBERT-style late interaction, nDCG@10 avg 0.816), ahead of Qwen3-Embedding-8B (0.783), KURE-v1 (0.762), and bge-m3 (0.751). The most practical choice for Node is still a single-vector bge-m3-family model (KURE-v1 / dragonkue BGE-m3-ko, MIT/Apache), because an ONNX bge-m3 runs in transformers.js today, while late-interaction KURE-v2 needs multi-vector storage. Reranker: dragonkue/bge-reranker-v2-m3-ko (Apache-2.0).

### Cited Findings
- **KURE-v1** (nlpai-lab, Korea Univ.): fine-tuned from BAAI/bge-m3, MIT license, 0.6B params, 1024-dim, 8192 max length. On the card's Korean retrieval averages, Recall@1 is 0.5264 vs bge-m3 0.5178, multilingual-e5-large 0.5005, jina-embeddings-v3 0.4829, and OpenAI text-embedding-3-large 0.4488. NDCG@10 is 0.6947 vs bge-m3 0.6872. Self-reported results, and some card headers appear mislabeled — [HF nlpai-lab/KURE-v1](https://huggingface.co/nlpai-lab/KURE-v1)
- **KURE-v2**: base skt/A.X-Encoder-base, Apache-2.0, 154M params, late-interaction (128-dim per token), 8192 max length, citation year 2026. MTEB(kor, v2) Retrieval nDCG@10 averages over 9 tasks (AutoRAG, PubHealthQA, Ko-StrategyQA, LawIRKo, SQuAD-KorV1, Belebele ko-ko, MrTidy, MLDR, MIRACL):

  | Model | Avg | Note |
  |---|---|---|
  | KURE-v2 | 0.8160 | |
  | yjoonjang/colbert-ko-en-v2 | 0.8063 | |
  | sionic-ai/comsat-embed-ko-8b-preview | 0.7927 | |
  | Qwen3-Embedding-8B | 0.7826 | |
  | Qwen3-Embedding-4B | 0.7737 | |
  | dragonkue/snowflake-arctic-embed-l-v2.0-ko | 0.7653 | 568M |
  | telepix/PIXIE-Rune-v1.5 | 0.7618 | |
  | KURE-v1 | 0.7616 | |
  | dragonkue/BGE-m3-ko | 0.7547 | |
  | BAAI/bge-m3 | 0.7509 | |
  | nlpai-lab/KoE5 | 0.7337 | |

  Ko-StrategyQA: KURE-v2 0.8070, Qwen3-8B 0.8363, bge-m3 0.7941. Late-interaction rows were measured with mteb 2.18.16 (PLAID). Single-vector rows come from the official MTEB results repo — [HF nlpai-lab/KURE-v2](https://huggingface.co/nlpai-lab/KURE-v2)
- Benchmark conflict: KURE-v1's own card shows it beating bge-m3, but in a different task set (the KURE-v2 card) bge-m3 wins on MrTidy and MIRACL. Margins between bge-m3-family models are small (0.75–0.76) — [KURE-v1 card](https://huggingface.co/nlpai-lab/KURE-v1); [KURE-v2 card](https://huggingface.co/nlpai-lab/KURE-v2)
- **AutoRAG Korean embedding benchmark** (Marker-Inc-Korea, finance domain), F1@1 as quoted in a reranker card: KoE5 0.7018, Upstage Embedding 0.6579, bge-m3 0.6578, OpenAI text-embedding-3-small 0.5439 — [GitHub AutoRAG-example-korean-embedding-benchmark](https://github.com/Marker-Inc-Korea/AutoRAG-example-korean-embedding-benchmark); [dragonkue/bge-reranker-v2-m3-ko card](https://huggingface.co/dragonkue/bge-reranker-v2-m3-ko/blob/main/README.md)
- **Qwen3-Embedding-0.6B**: Apache-2.0, 0.6B, up to 1024-dim (MRL 32–1024), 32K context, MTEB Multilingual mean (task) 64.33. Instruction-aware: queries need a one-sentence task instruction (preferably in English), which gives +1–5%. No ONNX/transformers.js mention on the card — [HF Qwen/Qwen3-Embedding-0.6B](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B)
- **Local in JS**: Xenova/bge-m3 provides ONNX weights for Transformers.js (`@huggingface/transformers`, card updated for v3.4), using a `feature-extraction` pipeline with CLS pooling + normalize. Variants: fp32 (~2.27 GB external data), fp16 (~1.13 GB), quantized (~570 MB) — [HF Xenova/bge-m3](https://huggingface.co/Xenova/bge-m3/blob/main/README.md?code=true); [onnx folder](https://huggingface.co/Xenova/bge-m3/tree/main/onnx); [v3.4 update PR](https://huggingface.co/Xenova/bge-m3/discussions/6)
- **Rerankers**: dragonkue/bge-reranker-v2-m3-ko is Apache-2.0, based on BAAI/bge-reranker-v2-m3, and Korean-optimized. Self-reported results on the AutoRAG finance benchmark: one table shows F1 0.4825 / recall 0.9649 vs base 0.4781 / 0.9561, and another shows 0.9123 vs Dongjin-kr/ko-reranker 0.8509 (top-k labels unclear) — [HF dragonkue/bge-reranker-v2-m3-ko](https://huggingface.co/dragonkue/bge-reranker-v2-m3-ko/blob/main/README.md). Another Korean reranker exists, sigridjineth/ko-reranker-v1.1 — [HF](https://huggingface.co/sigridjineth/ko-reranker-v1.1)

### Inferences
- Because KURE-v1 / BGE-m3-ko share bge-m3's architecture, they can likely be exported to ONNX the same way Xenova did for bge-m3 (via optimum). This is unverified; check the 7 quantized derivatives listed on the KURE-v1 card.
- For a 285–10k doc corpus, embedding is a one-time offline job (precompute vectors into JSON). Only the query embedding runs at request time, so even a ~570 MB quantized model on a server is fine. Using a hosted embedding API is also viable, since deployment is out of scope.
- Cosmetics queries are short, colloquial, and attribute-heavy, so domain fit matters more than leaderboard deltas of about 0.01. Build a 50–100 query Korean eval set from real user questions (AutoRAG can automate the comparison) before choosing.

### Gaps
- No beauty/e-commerce-specific Korean retrieval benchmark was found. Upstage's current embedding model results and the newest jina embeddings were not found in the 2026 KURE-v2 table.
- ONNX / transformers.js availability of KURE-v1, KURE-v2, Qwen3-Embedding-0.6B, and bge-reranker-v2-m3-ko was not confirmed.

## Q5. Korean tokenization for BM25 (mecab-ko, Kiwi, Nori) in JS/Python

### Takeaway
Kiwi is the best fit. It is now Apache-2.0 (versions ≤0.23.2 were LGPL), accurate (~87% web / ~94% written text), has built-in typo correction, and has an official WASM/TypeScript binding published to npm as `kiwi-nlp`. It can pre-tokenize text for Orama/LanceDB/Qdrant BM25 directly in Node. Nori (mecab-ko-dic) is the choice only with Elasticsearch/OpenSearch.

### Cited Findings
- Kiwi license is Apache-2.0, with models under the same license. Versions 0.23.2 and earlier were LGPL. Bindings: Python (kiwipiepy), Java, C#, WASM/JS (bindings/wasm), C API, R, Go, Rust, Flutter, Android. Accuracy is about 87% on web text and 94% on written text, with roughly 1.9 ms/line in the sample evaluator. Typo correction has been available since 0.13.0 (eval score 0.853→0.892 with `--typo 6`) — [GitHub bab2min/Kiwi](https://github.com/bab2min/Kiwi)
- The WASM binding's npm package is `kiwi-nlp`: `KiwiBuilder.create(wasmPath)`, `builder.build({ modelFiles })`, then `kiwi.analyze(text, Match.allWithNormalizing)` returns tokens with str/tag/position. API docs are at bab2min.github.io/Kiwi/kiwi-nlp/ — [Kiwi bindings/wasm](https://github.com/bab2min/Kiwi/tree/main/bindings/wasm)
- Older kiwipiepy PyPI listings show LGPL v3 — [PyPI kiwipiepy 0.6.0](https://pypi.org/project/kiwipiepy/0.6.0). The Flutter plugin's default model is about 95 MiB uncompressed — [pub.dev flutter_kiwi_nlp](https://pub.dev/documentation/flutter_kiwi_nlp/latest/)
- Nori is based on mecab-ko-dic and supports user_dictionary and decompound_mode — [Elastic Nori docs](https://docs-v3-preview.elastic.dev/elastic/docs-builder/docs/3944/reference/elasticsearch/plugins/analysis-nori-analyzer)

### Inferences
- Recommended BM25 field: Kiwi nouns, verb/adjective stems, and roots (NNG/NNP/VV/VA/XR) joined by spaces, plus a user dictionary for brand and product terms (롬앤, 페리페라, 쥬시래스팅, 틴트, 립밤). For 285 items, a simple synonym table (촉촉→수분/글로시/물광, 건조→각질) applied at query time may help more than a tokenizer swap.
- The mecab-ko JS bindings were not researched. Kiwi's official WASM binding makes them unnecessary.

### Gaps
- The `kiwi-nlp` npm version number, model download size for Node, and cold-start time were not verified.
- No benchmark comparing Kiwi vs Nori vs char-ngram BM25 on Korean product search was found.
