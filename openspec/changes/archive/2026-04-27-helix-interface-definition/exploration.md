# Exploration: helix-lib Public Interface Contract

**Change**: helix-interface-definition
**Date**: 2026-04-27
**Status**: complete — ready for sdd-propose

---

## 1. Current State

The project is entirely greenfield. Only `openspec/config.yaml` exists. No `package.json`, no `src/`, no tests. The config establishes:

- **Architecture**: Hexagonal / Ports & Adapters
- **Principles**: PR1–PR6 (response normalization, lightweight deps, mandatory tests, phase-1 provider scope, OpenAI Response format, unified error model)
- **Capabilities**: HX1–HX6 (text requests, files CRD, ephemeral files, native tools, custom tools, optional params)
- **Phase 1 providers**: OpenAI, OpenAI Azure, OpenAI custom (self-hosted compatible), Google Vertex (Gemini) — no file operations on Vertex (PR4)

There is no existing code to constrain decisions. Every choice is architectural.

---

## 2. Provider API Comparison (Conceptual)

### 2.1 Text Request

| Capability | OpenAI (`/v1/responses` or `/v1/chat/completions`) | Azure OpenAI | OpenAI Custom (e.g. Ollama, Together.ai) | Google Vertex (Gemini) |
|---|---|---|---|---|
| Endpoint shape | `POST /v1/responses` (new) or `/v1/chat/completions` | Same as OpenAI, base URL is deployment-specific | OpenAI-compatible — same shape as OpenAI | `POST /v1/projects/{proj}/locations/{loc}/publishers/google/models/{model}:generateContent` |
| Auth | `Authorization: Bearer {api_key}` | `api-key` header OR bearer | Provider-specific | Google OAuth2 / service account / ADC |
| Request body | `{ model, input: [{role, content}], ... }` (Responses API) or `{ model, messages: [...], ... }` (Chat) | Same as OpenAI | Same as OpenAI Chat | `{ contents: [{role, parts: [{text}]}], generationConfig, ... }` |
| Response body | OpenAI Response object with `output[].content[].text` | Same as OpenAI | Same as OpenAI | `{ candidates: [{content: {parts: [{text}]}, finishReason}], usageMetadata }` |
| Streaming | SSE via `stream: true` | SSE same as OpenAI | Provider-dependent; most support SSE | SSE with `alt=sse` query param |
| Multi-turn | `previous_response_id` (Responses API) or `messages` array (Chat) | Messages array | Messages array | `contents` array with alternating user/model turns |

**Key delta**: Gemini's `contents[].parts[]` structure is meaningfully different from OpenAI's `messages[].content`. Multi-part messages (text + image) map reasonably, but system prompts in Gemini are a separate `systemInstruction` field — not part of the `contents` array.

### 2.2 File Upload and Management (HX2)

| Capability | OpenAI | Azure OpenAI | OpenAI Custom | Google Vertex |
|---|---|---|---|---|
| Upload | `POST /v1/files` multipart/form-data | Same | Provider-dependent | NOT SUPPORTED in Phase 1 (PR4) |
| List | `GET /v1/files` | Same | Provider-dependent | N/A |
| Delete | `DELETE /v1/files/{file_id}` | Same | Provider-dependent | N/A |
| TTL | Via `expires_after` (Responses API) or manual delete | Same as OpenAI | Provider-dependent | N/A |
| Use in request | `file_id` in message content or Responses API `input` | Same | Provider-dependent | N/A (Phase 1) |

**Key insight**: Azure OpenAI has file support only in newer API versions and primarily for Assistants. For the base completions/responses endpoint, file references via `file_id` in message content is what Helix will use. Custom endpoints vary widely — file support is a "best effort" capability.

### 2.3 Native Tools (HX4)

| Tool | OpenAI | Azure OpenAI | OpenAI Custom | Google Vertex |
|---|---|---|---|---|
| Web search | `web_search_preview` built-in tool (Responses API) | NOT available (as of 2026) | NOT available | `googleSearch` grounding (separate API param) |
| Code interpreter | `code_interpreter` (Assistants only) | Same (Assistants only) | N/A | N/A |
| File search | `file_search` (Assistants/Responses) | Same | N/A | N/A |
| Image generation | Not a tool in requests | N/A | N/A | `imagegeneration` models separate |

**Key insight**: Native tools are deeply provider-specific. OpenAI web search is part of the Responses API tool array. Vertex googleSearch is a generation config flag, not a tool object. These cannot be unified behind a single type — they must be provider-dispatched.

### 2.4 Custom Tools / Function Calling (HX5)

| Aspect | OpenAI | Azure OpenAI | OpenAI Custom | Google Vertex |
|---|---|---|---|---|
| Tool definition shape | `{ type: "function", function: { name, description, parameters: JSONSchema } }` | Identical | Identical (OpenAI-compatible) | `{ functionDeclarations: [{ name, description, parameters: JSONSchema }] }` |
| Tool call in response | `output[].type === "function_call"` with `id`, `name`, `arguments` (JSON string) | Same format | Same format | `candidates[].content.parts[].functionCall` with `name`, `args` (object, not string) |
| Tool result submission | New request with `previous_response_id` + `input: [{type: "function_call_output", call_id, output}]` | Messages array with `role: "tool"` | Messages array with `role: "tool"` | New request with `contents` appending `role: "function"` part with `response` |
| Parallel calls | Yes (multiple function_call outputs) | Yes | Provider-dependent | Yes |
| Forced call | `tool_choice: { type: "function", function: { name } }` | Same | Same | `toolConfig.functionCallingConfig.mode: "ANY"` with `allowedFunctionNames` |

**Key insight**: The tool definition schema (JSON Schema) is compatible across providers. The divergence is in how tool results are fed back — OpenAI Responses API uses `call_id` references; Vertex appends `functionResponse` parts to `contents`. The re-execute loop is non-trivial to abstract cleanly.

### 2.5 Optional Parameters (HX6)

| Parameter | OpenAI | Azure OpenAI | OpenAI Custom | Google Vertex |
|---|---|---|---|---|
| Temperature | `temperature` (0–2) | Same | Same (0–2 typical) | `generationConfig.temperature` (0–2) |
| Max output tokens | `max_output_tokens` | Same | `max_tokens` (Chat API) | `generationConfig.maxOutputTokens` |
| Top-p | `top_p` | Same | Same | `generationConfig.topP` |
| Top-k | Not supported | Not supported | Provider-dependent | `generationConfig.topK` |
| Stop sequences | `stop` | Same | Same | `generationConfig.stopSequences` |
| Thinking / reasoning | `reasoning_effort: "low"|"medium"|"high"` (o-series) | Same (if model supports) | Provider-dependent | `thinkingConfig.thinkingBudget` (Gemini 2.0 Flash Thinking) |
| Seed | `seed` | Same | Provider-dependent | Not supported |
| Frequency penalty | `frequency_penalty` | Same | Provider-dependent | Not supported |
| Presence penalty | `presence_penalty` | Same | Provider-dependent | Not supported |

**Key insight**: Temperature and top-p are the common denominator. Thinking mode is fundamentally different between OpenAI (`reasoning_effort` string enum) and Vertex (`thinkingBudget` integer). Unsupported params should trigger a logged warning, not a hard error — unless `strict` mode is requested.

---

## 3. Contract Shape Options by HX Capability

### HX1 — Text Request

**Option A: Single `request()` function**
```typescript
const response = await provider.request({
  messages: [{ role: "user", content: "Hello" }],
  model: "gpt-4o",
  options: { temperature: 0.7 }
});
// Returns: OpenAI Response object (PR1)
```

| Pros | Cons | Effort |
|------|------|--------|
| Minimal surface area | Does not distinguish stateless vs stateful calls | Low |
| Aligns with PR5 (OpenAI Response format is the Responses API format) | Streaming requires a variant or option flag | Low |
| Easy to mock in tests | | |

**Option B: `chat()` + `respond()` split**
```typescript
const r1 = await provider.chat([{ role: "user", content: "Hello" }]);
const r2 = await provider.respond("Follow up", { previousResponseId: r1.id });
```

| Pros | Cons | Effort |
|------|------|--------|
| Explicit about stateful vs stateless | Two functions = two sets of tests and adapters | Medium |
| Maps naturally to OpenAI Responses API semantics | Vertex has no stateful respond equivalent | Medium |
| Cleaner ergonomics for multi-turn | Confusing which to use when | |

**Option C: Builder / fluent pattern**
```typescript
const response = await provider
  .messages([{ role: "user", content: "Hello" }])
  .model("gpt-4o")
  .temperature(0.7)
  .execute();
```

| Pros | Cons | Effort |
|------|------|--------|
| Very ergonomic | Non-standard, unfamiliar pattern for LLM libs | High |
| Chainable options | Much harder to type correctly | High |
| | More to test, less portable | |

**Recommendation leaning**: Option A. Single `request()` with a well-typed options object. Streaming exposed as `requestStream()` or via an `stream: true` option returning an async iterator.

---

### HX2 — Files

**Option A: Synchronous upload returning file reference**
```typescript
const fileRef = await fileStore.upload(buffer, { mimeType: "application/pdf", ttl: 3600 });
```

| Pros | Cons | Effort |
|------|------|--------|
| Simple, predictable | Large files may time out | Low |
| Familiar pattern | No progress tracking | Low |

**Option B: Async with polling**
```typescript
const job = await fileStore.uploadAsync(buffer, { mimeType: "application/pdf" });
const fileRef = await job.wait();
```

| Pros | Cons | Effort |
|------|------|--------|
| Handles large files | More complex implementation | High |
| Progress observable | Over-engineering for Phase 1 | |

**Option C: Upload + explicit readiness check**
```typescript
const fileRef = await fileStore.upload(buffer, { mimeType: "application/pdf" });
await fileStore.waitForReady(fileRef.id);
```

| Pros | Cons | Effort |
|------|------|--------|
| Explicit about async processing | Caller must remember to check | Medium |
| More correct for providers with processing delay | Awkward ergonomics | |

**Recommendation leaning**: Option A for Phase 1 (no Vertex files anyway). TTL expressed as seconds integer.

---

### HX3 — Request + Files (Ephemeral)

**Option A: Ephemeral flag on message content**
```typescript
await provider.request({
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "Summarize this" },
      { type: "file", data: buffer, mimeType: "application/pdf", ephemeral: true }
    ]
  }]
});
```

| Pros | Cons | Effort |
|------|------|--------|
| Inline — no explicit pre-upload step | Adapter must handle ephemeral upload transparently | Medium |
| Clean caller ergonomics | Adapter logic is more complex | |

**Option B: Composition — upload then reference**
```typescript
const ref = await fileStore.upload(buffer, { ephemeral: true, ttl: 0 });
await provider.request({
  messages: [{ role: "user", content: [{ type: "file_ref", id: ref.id }, { type: "text", text: "Summarize" }] }]
});
```

| Pros | Cons | Effort |
|------|------|--------|
| Explicit — caller controls upload lifecycle | Two-step for what feels like one operation | Low |
| Reuse uploaded file across requests | TTL=0 semantics unclear | |

**Option C: Dedicated `requestWithFiles()` method**
```typescript
await provider.requestWithFiles({
  messages: [...],
  files: [{ data: buffer, mimeType: "application/pdf", ephemeral: true }]
});
```

| Pros | Cons | Effort |
|------|------|--------|
| Clearly scoped capability | Duplicates request surface | Medium |
| Easy to stub in tests | Harder to compose with other options | |

**Recommendation leaning**: Option A (ephemeral flag inline) — single `request()` remains the sole entry point. Adapters transparently handle upload.

---

### HX4 — Native Tools

**Option A: Allow-list per provider with feature detection**
```typescript
await provider.request({
  messages: [...],
  tools: [{ type: "native", name: "web_search" }]
});
// Adapter checks if "web_search" is supported; throws UnsupportedFeature if not
```

| Pros | Cons | Effort |
|------|------|--------|
| Single tools array — uniform ergonomics | Provider-specific tool names leak into caller code | Low |
| Feature detection enables graceful degradation | Allow-list needs maintenance | Medium |

**Option B: Provider-specific native tool namespacing**
```typescript
await openaiProvider.request({ messages: [...], nativeTools: { webSearch: true } });
await vertexProvider.request({ messages: [...], nativeTools: { googleSearch: true } });
```

| Pros | Cons | Effort |
|------|------|--------|
| Accurate — no false abstraction | Breaks the unified port interface | Low |
| No allow-list needed | Callers must know which provider they're using | |
| Type-safe per provider | Defeats the purpose of helix-lib | |

**Option C: Capability flags on provider instance**
```typescript
const cap = provider.capabilities();
await provider.request({ messages: [...], tools: [{ type: "native", name: cap.nativeTools[0] }] });
```

| Pros | Cons | Effort |
|------|------|--------|
| Programmatic discovery | Verbose ergonomics | Medium |
| No hard-coded strings | Still provider-specific names | |

**Recommendation leaning**: Option A — allow-list. Helix defines a set of well-known native tool names (`"web_search"`, `"file_search"`, `"code_interpreter"`, `"google_search"`). Adapters map or reject. `UnsupportedFeature` HelixError is thrown when a provider doesn't support it.

---

### HX5 — Custom Tools (Function Calling)

**Option A: Tool definitions + manual re-execute loop (caller-controlled)**
```typescript
const response = await provider.request({
  messages: [...],
  tools: [{ type: "function", function: { name: "get_weather", description: "...", parameters: schema } }]
});
if (response.output.some(o => o.type === "function_call")) {
  // caller executes tool, re-submits
}
```

| Pros | Cons | Effort |
|------|------|--------|
| Maximum control for caller | Boilerplate loop in every consuming app | Low |
| Easy to implement in adapters | Error handling in loop falls to caller | |
| Mirrors OpenAI's own SDK pattern | | |

**Option B: Automatic re-execute loop (library-controlled)**
```typescript
const response = await provider.requestWithTools({
  messages: [...],
  tools: [...toolDefinitions],
  execute: async (toolName, args) => myToolExecutors[toolName](args)
});
```

| Pros | Cons | Effort |
|------|------|--------|
| Ergonomic for simple cases | Harder to control loop termination | High |
| Hides complexity | Infinite loop risk without max_rounds guard | |
| | Harder to test | |
| | execute() is opaque — hard to reason about state | |

**Option C: Hybrid — single-turn in core, loop utility as optional export**
```typescript
// Core: one-shot (Option A behavior)
const response = await provider.request({ messages, tools });

// Optional utility (separate export):
import { runToolLoop } from "helix-lib/tools";
const finalResponse = await runToolLoop(provider, messages, tools, executors);
```

| Pros | Cons | Effort |
|------|------|--------|
| Core stays simple and testable | Two APIs to learn | Medium |
| Loop utility can have its own tests | Additional export surface | |
| Caller has both options | | |

**Recommendation leaning**: Option C. Core `request()` is one-shot (Option A). A `runToolLoop()` utility is exported separately — it can use the same port interface internally. This respects the hexagonal boundary.

---

### HX6 — Optional Parameters

**Option A: Unified flat options object with per-provider translation**
```typescript
interface HelixRequestOptions {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;              // ignored/warned on OpenAI
  stopSequences?: string[];
  thinking?: { budget?: number; effort?: "low" | "medium" | "high" };
  seed?: number;              // ignored/warned on Vertex
  frequencyPenalty?: number;  // ignored/warned on Vertex
  presencePenalty?: number;   // ignored/warned on Vertex
}
```

| Pros | Cons | Effort |
|------|------|--------|
| Single interface for all callers | Some params silently ignored | Medium |
| Provider adapters handle translation | Unified `thinking` shape is a forced abstraction | |
| Easy to document which params work where | | |

**Option B: Strict mode — throw on unsupported param**
Same as Option A, but `strict: true` in options throws `UnsupportedFeature` instead of warning.

| Pros | Cons | Effort |
|------|------|--------|
| No silent failures | Breaking for callers switching providers | Low (on top of A) |
| Deterministic behavior | Adds `strict` param to every call | |

**Option C: Per-provider typed options via generics**
```typescript
provider.request<OpenAIOptions>({ ..., options: { reasoning_effort: "high" } });
provider.request<VertexOptions>({ ..., options: { thinkingBudget: 8000 } });
```

| Pros | Cons | Effort |
|------|------|--------|
| Fully type-safe per provider | Defeats unified interface goal | High |
| No translation layer | Callers must parameterize on provider type | |

**Recommendation leaning**: Option A + optional `strict` flag (Option B extension).

---

## 4. Response Normalization (PR1, PR5)

The canonical output format is the **OpenAI Responses API response object**:

```typescript
interface OpenAIResponse {
  id: string;
  object: "response";
  created_at: number;
  model: string;
  output: OutputItem[];
  usage: { input_tokens: number; output_tokens: number; total_tokens: number };
}
type OutputItem =
  | { type: "message"; role: "assistant"; content: ContentPart[] }
  | { type: "function_call"; id: string; name: string; arguments: string }
  | { type: "reasoning"; id: string; summary: SummaryPart[] };
```

### Vertex → OpenAI Normalization Challenges

| Gemini Field | OpenAI Equivalent | Issue |
|---|---|---|
| `candidates[0].content.parts[].text` | `output[0].content[0].text` | Straightforward if single candidate |
| `candidates[].finishReason` | `output[].status` or response-level `incomplete_details` | Mapping enum values |
| `usageMetadata.promptTokenCount` | `usage.input_tokens` | Rename only |
| `usageMetadata.candidatesTokenCount` | `usage.output_tokens` | Rename only |
| `candidates[0].content.parts[].functionCall` | `output[].type === "function_call"` | `args` is object, OpenAI expects JSON string — must serialize |
| `candidates[0].safetyRatings` | No equivalent | Drop or put in `metadata` extension field |
| `candidates[0].groundingMetadata` (web search) | No equivalent | Drop or put in `metadata` extension field |
| `modelVersion` | `model` | Rename |
| Multiple candidates (`n > 1`) | `output[]` has one message per candidate | Decide — support `n > 1` or force `n = 1`? |
| `thinkingParts` (Gemini 2.0 Flash Thinking) | `output[].type === "reasoning"` | Map if present |
| `systemInstruction` (not in response) | N/A | Not in response — input only |

**Edge cases**:
- Gemini can return empty parts or empty candidates on safety blocks — must map to a `HelixError` of kind `ContentFiltered`, not an empty response.
- OpenAI Response ID is used for `previous_response_id` in multi-turn. Vertex has no equivalent — helix-lib must synthesize an ID and manage state differently for stateful multi-turn with Vertex.
- Streaming deltas differ significantly: OpenAI sends `response.output_item.delta` events; Gemini sends full partial candidate objects.

**Recommendation**: A dedicated `normalizeResponse(raw: unknown, provider: ProviderKind): OpenAIResponse` pure function in the core layer, tested exhaustively per provider (PR3).

---

## 5. Error Model (PR6)

### Proposed Discriminated Union

```typescript
type HelixErrorKind =
  | "InvalidApiKey"          // 401
  | "PermissionDenied"       // 403 (Azure policy, Vertex IAM)
  | "InvalidRequest"         // 400 — bad input (bad model name, bad params)
  | "RateLimit"              // 429 — too many requests
  | "QuotaExceeded"          // 429 with quota body or 403 quota
  | "ServerError"            // 500/502/503
  | "ProviderUnavailable"    // Network failure, DNS, timeout
  | "ContentFiltered"        // Safety block / content policy
  | "UnsupportedFeature"     // Caller requested a feature this provider doesn't support
  | "NormalizationError"     // Unexpected response shape from provider (helix internal)
  | "Unknown";               // Fallback

interface HelixError extends Error {
  kind: HelixErrorKind;
  provider: "openai" | "azure" | "custom" | "vertex";
  statusCode?: number;
  raw?: unknown;
  retryable: boolean; // true for RateLimit, ServerError, ProviderUnavailable
}
```

### Provider Error → HelixError Mapping

| Provider Error | HelixErrorKind |
|---|---|
| OpenAI 401 | `InvalidApiKey` |
| OpenAI 400 | `InvalidRequest` |
| OpenAI 429 | `RateLimit` (check body for quota vs rate) |
| OpenAI 500/502/503 | `ServerError` |
| OpenAI network error | `ProviderUnavailable` |
| OpenAI content filter | `ContentFiltered` |
| Azure 401/403 (IAM) | `InvalidApiKey` / `PermissionDenied` |
| Azure 400 (deployment not found) | `InvalidRequest` |
| Vertex 401/403 (IAM/ADC) | `InvalidApiKey` / `PermissionDenied` |
| Vertex `RESOURCE_EXHAUSTED` | `QuotaExceeded` |
| Vertex `INVALID_ARGUMENT` | `InvalidRequest` |
| Vertex `UNAVAILABLE` | `ProviderUnavailable` |
| Vertex safety block | `ContentFiltered` |
| Unexpected response shape | `NormalizationError` |

**Key design question**: should `HelixError` extend `Error` (class) or be a plain object? Extending `Error` preserves stack traces and `instanceof` checks — preferred.

---

## 6. Library Packaging

### Module Format

**Recommendation**: Dual ESM + CJS via conditional exports — built with `tsup` (zero-config, single devDependency, aligns with PR2).

```json
{
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js",
      "types": "./dist/types/index.d.ts"
    }
  }
}
```

### Entry Point Structure

**Recommendation**: Single entry `helix-lib` for Phase 1. Document the intended sub-path split (`helix-lib/files`, `helix-lib/tools`) so it's not architecturally foreclosed.

---

## 7. Open Questions for sdd-propose

1. **OpenAI Responses API vs Chat Completions API**: target Responses API as primary, or Chat Completions for broader compatibility (Azure older deployments, all custom endpoints)?
2. **Stateful multi-turn on Vertex**: synthesize stateful IDs internally, or expose multi-turn purely as messages-array (stateless)?
3. **Provider factory vs global singleton**: `createOpenAI({ apiKey })` per call site (instance-based) or registered globally and routed by name?
4. **Streaming contract**: support `stream: true` returning `AsyncIterable<StreamDelta>` in Phase 1, or defer to Phase 2?
5. **`n > 1` (multiple candidates)**: expose Gemini `candidateCount > 1` / OpenAI `n > 1`, or force `n=1`?
6. **HelixError as class vs plain object**: class with `instanceof` checks, or plain discriminated union?
7. **Custom endpoint configuration**: just `baseUrl` + `apiKey`, or also model name aliasing (e.g., `"gpt-4o"` → `"llama3.1:8b"` for Ollama)?
8. **Google ADC vs explicit service account**: support both, or ADC only?
9. **`UnsupportedFeature` strictness**: silent warning, noop, or thrown error? Configurable per-provider via `strict: boolean`?
10. **Versioning and provider API drift**: pin to specific API versions (e.g., `api-version: 2024-10-01` for Azure)? How to handle deprecation without breaking callers?

---

## 8. Affected Areas (Greenfield)

| Path (to be created) | Purpose |
|---|---|
| `src/core/ports/provider.port.ts` | `HelixProvider` interface — HX1, HX3, HX4, HX5, HX6 |
| `src/core/ports/file-store.port.ts` | `HelixFileStore` interface — HX2 |
| `src/core/types/request.ts` | `HelixRequest`, `HelixRequestOptions`, message content types |
| `src/core/types/response.ts` | Re-export or type-alias for OpenAI Response format |
| `src/core/types/error.ts` | `HelixError`, `HelixErrorKind` |
| `src/core/types/tools.ts` | Tool definition types (function, native) |
| `src/adapters/openai/` | OpenAI adapter implementing `HelixProvider` |
| `src/adapters/azure/` | Azure adapter |
| `src/adapters/custom/` | Custom/compatible adapter |
| `src/adapters/vertex/` | Vertex adapter |
| `src/core/normalize/response.ts` | `normalizeResponse()` pure function |
| `src/core/normalize/error.ts` | `normalizeError()` pure function |
| `src/index.ts` | Public exports |
| `src/tools/run-tool-loop.ts` | Optional `runToolLoop()` utility |

---

## 9. Recommendation Summary

| Decision | Recommended Direction |
|---|---|
| HX1 contract | Single `request()` on `HelixProvider` port; `requestStream()` deferred to Phase 2 |
| HX2 contract | Synchronous `upload()` / `list()` / `delete()` on `HelixFileStore` port; TTL in seconds |
| HX3 ephemeral | Inline `ephemeral: true` on file content parts; adapter handles upload transparently |
| HX4 native tools | Allow-list of helix-known names; adapter maps or throws `UnsupportedFeature` |
| HX5 custom tools | One-shot in `request()`; `runToolLoop()` utility as optional export |
| HX6 params | Unified `HelixRequestOptions`; translate what maps; warn+skip unsupported; `strict` flag |
| Response normalization | `normalizeResponse(raw, provider)` pure function per adapter |
| Error model | `HelixError extends Error` class with `kind` discriminant and `retryable` boolean |
| Packaging | Dual ESM+CJS via `tsup`; single entry point for Phase 1 |
| Provider instantiation | Factory functions (`createOpenAI()`, `createVertex()`, etc.) returning `HelixProvider` |

---

## 10. Risks

1. **Vertex response normalization complexity**: Gemini's `candidates[].content.parts[]`, safety ratings, and grounding metadata have no OpenAI equivalents. Most failure-prone code in the library — extensive unit tests required (PR3).
2. **OpenAI Responses API vs Chat API divergence**: targeting Responses API as primary forces Azure and most custom endpoints down a separate internal path. Port abstraction must hide this.
3. **Stateful multi-turn portability**: `previous_response_id` is OpenAI Responses-only; messages-array (stateless) model is safe but loses server-side state efficiency.
4. **Vertex auth complexity**: Google ADC setup is non-trivial in CI / local dev. Errors must surface clear, actionable messages.
5. **Function call arguments type mismatch**: Gemini returns `functionCall.args` as parsed object; OpenAI returns `arguments` as JSON string. Silent source of bugs if not tested.
6. **Custom endpoint variability**: "OpenAI-compatible" endpoints vary widely. `UnsupportedFeature` error path heavily exercised here.
7. **Thinking mode unification**: `reasoning_effort` (qualitative enum) vs `thinkingBudget` (token integer) — fundamentally different abstractions; unified `thinking` shape will always feel like a forced fit.

---

## Ready for Proposal

Yes. Exploration surfaced clear options with tradeoffs for all 6 HX capabilities, identified the major normalization challenges, outlined the file structure. The 10 open questions above must be answered by sdd-propose before moving to sdd-spec.
