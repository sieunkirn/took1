# JS/TS LLM Agent & Orchestration Frameworks for upgrading the "took" rule-based Korean beauty chatbot (as of 2026-11-04)

Method note: version / license / dependency-count / weekly-download figures were pulled directly from the npm registry API (`https://registry.npmjs.org/<pkg>/latest`, `https://registry.npmjs.org/<pkg>` time field, `https://api.npmjs.org/downloads/point/last-week/<pkg>`) on 2026-11-04. "deps" = number of direct `dependencies` in the latest package.json (a rough proxy for weight, not install size). Download counts include transitive installs (e.g. `@anthropic-ai/sdk` and `openai` are pulled in by many other tools), so they measure ecosystem reach, not direct adoption.

## Q1. Current version, maintenance, license, tool calling / structured output, memory, model switching, streaming, weight, pain points

### Takeaway
All major candidates are actively maintained (most published a release within the last 2 weeks). Vercel AI SDK (now v7) and LangChain.js v1 / LangGraph.js are the most mature provider-agnostic options; Mastra is the most "batteries-included" TS-native framework (built on AI SDK) but much heavier; OpenAI Agents JS is still 0.x; LlamaIndex.TS has stalled; Claude Agent SDK is a Claude-Code-harness wrapper (wrong tool for a product chatbot) while the plain Anthropic SDK tool runner is a thin single-provider option.

### Cited Findings

**npm snapshot (2026-11-04)**

| Package | Latest | Published | License | Direct deps | Weekly downloads |
|---|---|---|---|---|---|
| `ai` (Vercel AI SDK) | 7.0.162 | 2026-11-03 | Apache-2.0 | 3 (peer: zod) | ~43.1M |
| `langchain` | 1.6.1 | 2026-11-03 | MIT | 4 (peer: @langchain/core) | ~4.0M |
| `@langchain/core` | 1.3.4 | 2026-11-03 | MIT | 7 | ~8.2M |
| `@langchain/langgraph` | 1.6.0 | 2026-10-30 | MIT | 4 | ~4.8M |
| `@mastra/core` | 1.82.0 | 2026-11-04 | Apache-2.0 | 30 | ~3.0M |
| `llamaindex` | 0.12.1 | 2025-12-02 | MIT | 8 | ~164K |
| `@llamaindex/workflow` | 1.1.25 | 2026-03-09 | (none in package.json) | 1 | ~125K |
| `@openai/agents` | 0.21.0 | 2026-10-20 | MIT | 4 (peer: zod) | ~2.5M |
| `@openai/agents-extensions` | 0.21.0 | — | MIT | peer: `ai ^6 \|\| ^7`, zod ^4 | — |
| `@anthropic-ai/sdk` | 1.4.0 | 2026-11-02 | Apache-2.0 | 3 (peer: zod) | ~64.0M |
| `@anthropic-ai/claude-agent-sdk` | 0.3.318 | 2026-11-03 | "SEE LICENSE IN README.md" | 0 (peer: @anthropic-ai/sdk, @modelcontextprotocol/sdk, zod) | ~17.7M |
| `openai` | 7.49.0 | 2026-11-03 | Apache-2.0 | 0 | ~55.4M |
| `genkit` (Google) | 1.44.0 | 2026-11-03 | Apache-2.0 | 3 (`@genkit-ai/core` has 20) | ~248K |
| `@voltagent/core` | 2.11.0 | 2026-09-28 | MIT | 44 (peer: ai, zod) | ~50K |
| `@ai-sdk/openai-compatible` | 3.0.84 | 2026-11-03 | Apache-2.0 | 2 | ~11.8M |
| `ollama-ai-provider-v2` (community) | 4.1.0 | 2026-10-22 | Apache-2.0 | 2 (peer: ai, zod) | ~1.2M |
| `zod` | 4.6.7 | 2026-10-12 | MIT | 0 | ~447M |

Source for all rows: [npm registry](https://registry.npmjs.org/ai/latest), [npm downloads API](https://api.npmjs.org/downloads/point/last-week/ai) (same endpoints per package, e.g. [langchain](https://registry.npmjs.org/langchain/latest), [@mastra/core](https://registry.npmjs.org/@mastra%2Fcore/latest), [@openai/agents](https://registry.npmjs.org/@openai%2Fagents/latest), [llamaindex](https://registry.npmjs.org/llamaindex)).

**Major-version release dates (from npm `time` field)** — [npm registry](https://registry.npmjs.org/ai)
- `ai`: 5.0.0 = 2025-07-31, 6.0.0 = 2025-12-22, 7.0.0 = 2026-06-25.
- `@langchain/langgraph`: 1.0.0 = 2025-10-18.
- `@mastra/core`: 1.0.0 = 2026-01-20 (0.x until Nov 2025).
- `@anthropic-ai/sdk`: 1.0.0 = 2026-10-21 (0.x before; ~0.137 just prior).
- `@openai/agents`: still 0.x; 0.14 (2026-07-28) to 0.21 (2026-10-20) — roughly a minor release every 1–3 weeks.
- `llamaindex`: 0.12.0 = 2025-09-16; last publish 0.12.1 on 2025-12-02 (≈11 months without a release as of Nov 2026).

**Vercel AI SDK (`ai`)**
- Combine tools and structured output in one call: pass both `tools` and `output: Output.object({ schema })` to `generateText`/`streamText`; example uses `stopWhen: isStepCount(5)`. Structured-output generation counts as a step, so `stopWhen` must cover tool steps + output step. — [AI SDK docs: Generating structured data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- Validation errors: `NoObjectGeneratedError` (parse/validation failure; exposes `text`, `response`, `usage`, `cause`) and `NoOutputGeneratedError` (final step ended with tool-calls). Also `Output.choice({options})` (throws if model returns something outside the list), `Output.array({element,minItems,maxItems})`, `Output.json()`. — [AI SDK docs](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- `Output.choice` is directly useful for constraining an LLM to a closed set (e.g., enumerated product IDs or intents). — inference from the same doc.
- AI SDK 6 (GA per npm 2025-12-22) introduced `ToolLoopAgent` as a first-class agent abstraction plus tool approval (`needsApproval`) and MCP support; it unified tools + typed output. — [noqta.tn guide (secondary)](https://noqta.tn/en/blog/vercel-ai-sdk-6-typescript-ai-agents-guide-2026); [doolpa.com (secondary)](https://doolpa.com/news/vercel-ai-sdk-6-agents-mcp-devtools-may-4-2026). Note: doolpa dates the v6 release to "May 4, 2026", which conflicts with npm's 6.0.0 publish date of 2025-12-22 — trust npm.
- AI SDK 7 (GA 2026-06-25) breaking changes: Node.js 22+ required (18/20 dropped); all packages ESM-only (no `require()`); `experimental_output` removed → use `output` / `result.output`; tool callback `experimental_context` → `context` with per-tool `contextSchema` and `toolsContext`; `needsApproval` on `tool()` deprecated in favor of a `toolApproval` setting; `experimental_activeTools` → `activeTools`; `ToolCallOptions` → `ToolExecutionOptions`; `generateObject`/`streamObject` take `instructions` instead of `system` and reject system messages in `messages` by default; `ToolLoopAgent` callbacks renamed (`onFinish`→`onEnd`, `onStepFinish`→`onStepEnd`); `usage` now totals all steps; `step.response.messages` holds only that step's messages (use `result.responseMessages` for full history). — [AI SDK 7 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0)
- AI SDK 7 positioned as an agent platform: tool approvals, durable `WorkflowAgent`, sandbox support, harness integration (Codex, Claude Code), redesigned telemetry, `HarnessAgent` API. — [Vercel community weekly 2026-06-29](https://community.vercel.com/t/vercel-weekly-2026-06-29/44602); [Vercel weekly 2026-06-15](https://community.vercel.com/t/vercel-weekly-2026-06-15/43802); [prismix.dev mirror of Vercel post](https://prismix.dev/news/94dec3bcce1a)
- Local models: AI SDK has an official generic `@ai-sdk/openai-compatible` provider (works against any OpenAI-compatible `/v1` endpoint such as vLLM or Ollama) and a widely used community `ollama-ai-provider-v2`. — [npm @ai-sdk/openai-compatible](https://registry.npmjs.org/@ai-sdk%2Fopenai-compatible/latest); [npm ollama-ai-provider-v2](https://registry.npmjs.org/ollama-ai-provider-v2/latest)
- Memory: AI SDK Core has no built-in persistent memory store; conversation state = the `messages` array you pass/keep (`result.responseMessages`). — [AI SDK 7 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0) (memory not mentioned as a feature; inference)
- Pain point: frequent majors (v5 Jul-2025, v6 Dec-2025, v7 Jun-2026) each with renames; one community guide warned of breaking changes even in v6 beta patch releases. — [npm time](https://registry.npmjs.org/ai); [skills.cat ai-sdk-6 notes (secondary)](https://skills.cat/skills/gocallum/nextjs16-agent-skills/ai-sdk-6-skills)

**LangChain.js v1 / LangGraph.js**
- LangChain 1.0 and LangGraph 1.0 reached v1 together (Oct 2025); `createAgent` is the new standard agent API (model + tools loop); legacy features moved to `langchain-classic` / `@langchain/classic`; `langgraph.prebuilt` deprecated (functionality moved to `langchain` agents); LangGraph 1.0 claims full backward compatibility. — [LangChain blog: LangChain & LangGraph 1.0](https://blog.langchain.com/langchain-langgraph-1dot0); [LangGraph v1 blog](https://www.langchain.com/blog/langgraph-v1); [LangGraph v1 release notes](https://docs.langchain.com/oss/python/releases/langgraph-v1/index.html)
- Structured output: `createAgent({ responseFormat })` accepts Zod, Standard Schema or JSON Schema (or array for unions); result in `structuredResponse`. `providerStrategy` uses provider-native structured output (OpenAI, xAI, Gemini, Anthropic); `toolStrategy` works with any tool-calling model. Auto-selection by model profile (LangChain ≥1.1). On schema-validation failure the agent sends the validation error back and the model retries; `handleError` (default true / false / custom function). — [LangChain JS structured output docs](https://docs.langchain.com/oss/javascript/langchain/structured-output)
- Multi-turn state: LangGraph provides checkpointer-based persisted graph state (threads) — the LangGraph design is explicitly a stateful graph runtime. — [LangGraph v1 blog](https://www.langchain.com/blog/langgraph-v1) (details of checkpointer APIs not re-verified this session)
- Weight: `langchain` 4 direct deps + `@langchain/core` 7 + provider packages (e.g. `@langchain/openai`); MIT. — [npm](https://registry.npmjs.org/langchain/latest)

**Mastra (`@mastra/core`)**
- v1 beta announced Nov 2025 (consolidation, "doesn't have new features"); 1.0 stable 2026-01-20 (npm) / Product Hunt launch Jan 21 2026; from the Gatsby team; TS-only. — [Mastra v1 blog](https://mastra.ai/blog/mastrav1); [hunted.space](https://hunted.space/product/mastra/launches/mastra-1-0); [npm](https://registry.npmjs.org/@mastra%2Fcore)
- Extremely fast release cadence: 1.0.0 (Jan 2026) → 1.82.0 (Nov 4 2026). — [npm](https://registry.npmjs.org/@mastra%2Fcore/latest)
- Tools must be defined with `createTool()` (id, description, zod `inputSchema`, `execute`); "plain objects fail to execute". Models are `provider/model-name` strings via Mastra's model router; `agent.generate()` / `agent.stream()` (`textStream`). — [Mastra agents overview](https://mastra.ai/docs/agents/overview)
- Memory (strongest built-in of all candidates): `resource` (user) + `thread` (conversation) IDs, message history (`lastMessages`), working memory (structured persistent user info, e.g. preferences — maps to "personal tone"), semantic recall, Observational Memory (background compression). Requires a storage provider (e.g. `@mastra/libsql` `LibSQLStore`). — [Mastra memory overview](https://mastra.ai/docs/memory/overview)
- Weight: 30 direct deps in `@mastra/core` (heaviest of the core candidates except VoltAgent). Apache-2.0 per npm. — [npm](https://registry.npmjs.org/@mastra%2Fcore/latest)
- Self-reported adoption at 1.0 launch: 300K+ weekly downloads, 19.4K+ GitHub stars, production at Replit and WorkOS (vendor/launch material). — [hunted.space](https://hunted.space/product/mastra/launches/mastra-1-0)

**OpenAI Agents SDK JS (`@openai/agents`)**
- Still 0.x (0.21.0, 2026-10-20), MIT, Node 22+/Deno/Bun, Cloudflare Workers experimental. — [npm](https://registry.npmjs.org/@openai%2Fagents/latest); [GitHub README](https://github.com/openai/openai-agents-js)
- Out of the box works with OpenAI models via Responses API or Chat Completions; other providers via `@openai/agents-extensions` AI SDK adapter (peer: `ai ^6 || ^7`). — [openai-agents-js docs source: ai-sdk.mdx](https://raw.githubusercontent.com/openai/openai-agents-js/main/docs/src/content/docs/extensions/ai-sdk.mdx); [npm agents-extensions](https://registry.npmjs.org/@openai%2Fagents-extensions/latest)
- API surface includes `OpenAIChatCompletionsModel` / `OpenAIResponsesModel`, `ModelProvider` / `setDefaultModelProvider`, structured output types, and output guardrails (`OutputGuardrail`, `OutputGuardrailTripwireTriggered`). — [openai-agents-js models guide (index)](https://openai.github.io/openai-agents-js/guides/models/)
- v0.9.0 added beta Sandbox Agents (`@openai/agents/sandbox`) — scope is drifting toward coding/sandbox agents. — [newreleases.io v0.9.0](https://newreleases.io/project/github/openai/openai-agents-js/release/v0.9.0)
- Older note: a third-party fork README said the SDK didn't work with zod ≥3.25.68 (old; current package peers on zod ^4 via extensions). — [ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Fopenai%2Fopenai-agents-js) — flag as likely outdated.

**Anthropic SDK tool runner vs Claude Agent SDK**
- `@anthropic-ai/sdk` 1.4.0 (1.0 on 2026-10-21). Tool runner `client.beta.messages.toolRunner({...})` runs tools automatically, manages conversation state, provides type safety; tools via `betaZodTool()` (Zod ≥3.25) or `betaTool()` (JSON Schema); optional `max_iterations`; status **beta** on all platforms. For human-in-the-loop/custom logging/conditional execution, docs recommend the manual loop. — [Claude tool runner docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-runner)
- Claude Agent SDK = "a library that runs the Claude Code binary" with built-in file/bash/web tools, hooks, subagents, MCP, permissions, sessions, and loads `.claude/` config; license governed by Anthropic Commercial Terms (not OSS); claude.ai login not allowed for third-party products. — [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- Claude-only (single provider) for both. — [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)

**LlamaIndex.TS**
- `llamaindex` last release 0.12.1 on 2025-12-02; `@llamaindex/workflow` last release 1.1.25 on 2026-03-09; weekly downloads ~125–165K. — [npm llamaindex](https://registry.npmjs.org/llamaindex); [npm @llamaindex/workflow](https://registry.npmjs.org/@llamaindex%2Fworkflow/latest)

**Other notable JS frameworks**
- Google Genkit (`genkit` 1.44.0, Apache-2.0, released 2026-11-03, ~248K/wk). — [npm genkit](https://registry.npmjs.org/genkit/latest)
- VoltAgent (`@voltagent/core` 2.11.0, MIT, built on AI SDK `ai` peer, 44 direct deps, ~50K/wk). — [npm @voltagent/core](https://registry.npmjs.org/@voltagent%2Fcore/latest)

### Inferences
- Maintenance ranking (activity): AI SDK, LangChain/LangGraph, Mastra, Anthropic SDK, OpenAI Agents, Genkit = very active; VoltAgent = active but smaller; LlamaIndex.TS = effectively stagnant for a new project in Nov 2026.
- Weight ranking (lightest→heaviest for our use): direct provider SDK (`openai` / `@anthropic-ai/sdk`) < `ai` core + one provider < OpenAI Agents < LangChain core+langchain+provider < Mastra (+storage adapter) < VoltAgent. Claude Agent SDK is categorically heavy (spawns Claude Code binary) and its built-in file/shell tools are a liability for a kiosk chatbot.
- For a vanilla-JS ESM Node app, AI SDK 7's ESM-only + Node 22 requirement is not a blocker as long as the server runs Node ≥22.

### Gaps
- GitHub star counts / commit counts for Nov 2026 were not fetched (only npm data); Mastra figures are vendor-reported from Jan 2026.
- Did not verify LangGraph.js checkpointer/memory API details or LangChain v1 middleware (e.g., guardrail middleware) in current docs.
- Did not fetch Mastra's structured-output page or confirm its Ollama/OpenAI-compatible model-router syntax; the agents and memory pages do not mention local models.
- Did not obtain OpenAI Agents JS docs body on `outputType` / guardrails (page too large); only API index names confirmed.
- Ollama's own OpenAI-compatibility docs were not fetched this session; local-model claims rest on the existence of the AI SDK provider packages.
- Concrete, sourced "pain point" reports (GitHub issues, postmortems) for LangChain.js / Mastra in 2026 were not collected.

## Q2. Fit for "deterministic fast path first → LLM fallback with tools → structured {text, product_ids, ui_actions} validated against DB"

### Takeaway
The pattern is a router + single tool loop + schema-validated final output — AI SDK 7 (`generateText` with `tools` + `output: Output.object(...)`, plus zod `.refine` against the DB) fits it with the least machinery; LangChain v1 `createAgent` + `responseFormat` is the best alternative if you want built-in validation-retry and graph state later. Mastra fits too and adds memory, at the cost of a much heavier dependency tree.

### Cited Findings
- AI SDK lets the same request execute tools and then return a schema-validated object; failures surface as `NoObjectGeneratedError` / `NoOutputGeneratedError`; `Output.choice` restricts a value to a fixed list. — [AI SDK structured data docs](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- AI SDK 7 per-tool `context` / `contextSchema` / `toolsContext` and `runtimeContext` — a clean way to inject the session's rule-engine state (last result list for "the cheapest of those") into tools. — [AI SDK 7 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0)
- LangChain `createAgent` `responseFormat` auto-retries on schema validation errors by feeding the validation error back to the model (`handleError`). — [LangChain JS structured output](https://docs.langchain.com/oss/javascript/langchain/structured-output)
- Mastra working memory stores structured persistent user info (preferences) and threads keep follow-up context. — [Mastra memory overview](https://mastra.ai/docs/memory/overview)
- Anthropic tool runner loops automatically until no tool use or `max_iterations`; docs steer custom control/approval to the manual loop. — [Claude tool runner docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-runner)
- OpenAI Agents JS offers output guardrails with tripwire exceptions (`OutputGuardrailTripwireTriggered`) — usable as a "product_ids must exist in DB" check. — [openai-agents-js API index](https://openai.github.io/openai-agents-js/guides/models/)

### Inferences
- Hallucination control is mostly framework-independent: (1) LLM never outputs product data freely — only `product_ids` returned by our tools; (2) final zod schema with `.refine(id => db.has(id))` and ideally "id ∈ ids returned by tools in this turn"; (3) server renders product names/prices from DB, never from LLM text; (4) on validation failure, retry once then fall back to the rule engine's answer. Frameworks with built-in validation-retry (LangChain `handleError`) save a few lines; AI SDK needs a manual retry around `NoObjectGeneratedError`.
- Note: a zod refine that checks DB membership runs client-side after generation; with provider-native strict structured output, the JSON Schema sent to the model cannot express "must be in DB" (except via a small enum / `Output.choice`) — with 285 products, an enum of IDs is feasible but costly in tokens; better to validate post-hoc.
- Fast path stays outside any framework: rule engine runs first; only when its confidence/coverage is low does the request go to the LLM layer. None of the frameworks require owning the request router.
- Recommendation: **1st — Vercel AI SDK 7** (`ai` + `@ai-sdk/openai-compatible` or a hosted provider): lightest, provider-agnostic incl. Ollama/vLLM, tools + typed output in one call, Apache-2.0, huge adoption. **2nd — LangChain.js v1 `createAgent`** (or LangGraph if multi-step flows/persisted state are needed): built-in structured-output retry, provider/native strategy auto-selection, MIT. Mastra is a reasonable alternative only if built-in persistent memory/Studio is wanted.

### Gaps
- No public benchmark found comparing hallucination rates across frameworks (expected: it depends on model + validation design, not framework).
- Korean-language-specific tool-calling quality for local models (Ollama/vLLM) was not researched here.

## Q3. Is a framework needed vs calling a model API directly with tool use?

### Takeaway
For one tool loop over ~4 local functions plus one final schema, a framework is optional; the main reasons to adopt a thin one (AI SDK) are provider/local-model switching and typed tool/output plumbing, not orchestration. Heavy frameworks add abstraction that Anthropic's own guidance warns can obscure prompts and hinder debugging.

### Cited Findings
- Anthropic: "We suggest that developers start by using LLM APIs directly: many patterns can be implemented in a few lines of code"; frameworks "often create extra layers of abstraction that can obscure the underlying prompts and responses, making them harder to debug"; "If you do use a framework, ensure you understand the underlying code." (Dec 19, 2024 — older guidance, still widely cited.) — [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- Direct provider SDKs already include a managed tool loop: Anthropic `toolRunner` + `betaZodTool` (beta). — [Claude tool runner](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-runner)
- `openai` SDK v7.49.0 has 0 direct deps, Apache-2.0, peer zod — and is the de-facto client for OpenAI-compatible servers. — [npm openai](https://registry.npmjs.org/openai/latest)
- Framework churn is real: AI SDK shipped three majors in ~11 months (v5 2025-07-31, v6 2025-12-22, v7 2026-06-25) with API renames each time. — [npm ai time](https://registry.npmjs.org/ai); [AI SDK 7 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0)

### Inferences
- Direct API (e.g. `openai` client pointed at OpenAI/vLLM/Ollama `/v1`): ~150–250 lines for loop + zod validation; zero framework churn; but you hand-write tool-schema conversion (`z.toJSONSchema` in zod 4), streaming assembly of tool-call deltas, and per-provider quirks if you switch to Anthropic/Gemini natively.
- AI SDK core: near-direct-API weight (3 deps) but gives provider-agnostic messages, tool/zod plumbing, streaming and typed output for free — the best middle ground for "took".
- Agent frameworks (Mastra, LangGraph, OpenAI Agents, Claude Agent SDK) pay off only with multi-agent handoffs, durable workflows, persistent memory stores, or evals/tracing UIs — none required by the current scope.

### Gaps
- No quantitative (LOC, latency) comparison source found; estimates above are inference.

## Q4. Notable deprecations / breaking changes 2025–2026

### Takeaway
LangChain/LangGraph v1 (Oct 2025) and AI SDK v6 (Dec 2025) → v7 (Jun 2026) are the big ones; Anthropic SDK hit 1.0 (Oct 2026); Mastra 1.0 (Jan 2026); OpenAI Agents JS remains pre-1.0.

### Cited Findings
- LangChain v1: `createAgent` replaces `createReactAgent`; `langgraph.prebuilt` deprecated; legacy chains/retrievers moved to `langchain-classic`; namespace slimmed. — [LangChain blog 1.0](https://blog.langchain.com/langchain-langgraph-1dot0); [LangGraph v1 release notes](https://docs.langchain.com/oss/python/releases/langgraph-v1/index.html); [LangChain 1.0 alpha post](https://www.langchain.com/blog/langchain-langchain-1-0-alpha-releases)
- `OutputFixingParser` now lives in `@langchain/classic`; `.pipe()` chains have no built-in retry. — [LangChain JS structured output](https://docs.langchain.com/oss/javascript/langchain/structured-output)
- AI SDK 6: `ToolLoopAgent`, tool approval, unified tools + structured output; community guides report `generateObject`/`streamObject` being de-emphasized in favor of `generateText`/`streamText` + `Output.object` (sources conflict on "deprecated"). — [noqta.tn](https://noqta.tn/en/blog/vercel-ai-sdk-6-typescript-ai-agents-guide-2026); [skills.cat](https://skills.cat/skills/gocallum/nextjs16-agent-skills/ai-sdk-6-skills). In the v7 migration guide `generateObject`/`streamObject` still exist (now `instructions` instead of `system`) — [AI SDK 7 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0)
- AI SDK 7: Node 22+, ESM-only, `experimental_output`→`output`, `needsApproval`→`toolApproval`, context renames, callback renames, usage semantics change (full list in Q1). — [AI SDK 7 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0)
- Claude Code SDK renamed to Claude Agent SDK (migration guide exists). — [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- Mastra 1.0 consolidated previously experimental 0.x APIs (e.g., `agent.network()`, multi-engine workflows). — [Mastra v1 blog](https://mastra.ai/blog/mastrav1)
- Zod 4 is now the ecosystem baseline (`zod` 4.6.7; `@openai/agents-extensions` peers on zod ^4). — [npm zod](https://registry.npmjs.org/zod/latest); [npm agents-extensions](https://registry.npmjs.org/@openai%2Fagents-extensions/latest)

### Inferences
- Whichever framework is chosen, pin exact versions and isolate it behind a small adapter module (`llm/agent.js`) so the rule engine and tool functions don't import framework types directly — this limits the blast radius of the next major (AI SDK has averaged one major every ~5–6 months).

### Gaps
- Did not read the Anthropic SDK 1.0 changelog for breaking changes vs 0.x.
- Did not read the OpenAI Agents JS changelog for 0.14–0.21 breaking changes.
