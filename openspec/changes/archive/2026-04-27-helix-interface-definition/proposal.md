# Proposal: helix-lib Public Interface Contract

**Change**: `helix-interface-definition`
**Date**: 2026-04-27
**Author**: orchestrator-delegated (sdd-propose)
**Status**: ready for sdd-spec
**Artifact store**: openspec
**Phase**: 1 — interfaces only (no implementations)

---

## 1. Why

`helix-lib` is a greenfield TypeScript library whose mission is to give every Fluxaria project a **single, stable, normalized contract** for talking to multiple LLM providers (OpenAI, OpenAI Azure, OpenAI-compatible custom endpoints, and Google Vertex/Gemini). The first real consumer is `ocr-ai`, which today calls the `openai` SDK directly (`client.responses.create`, `client.files.create`) and would have to be re-written for every new provider it needs to support.

Helix exists so that:

- **One contract** replaces N provider SDKs in consumer code.
- **Responses are normalized** to the OpenAI Responses API shape regardless of provider (PR1, PR5).
- **Errors are normalized** to a single `HelixError` discriminated union (PR6).
- **Lightweight by construction** — no LangChain, no heavy wrappers (PR2).

This change defines the **public surface only** — the TypeScript types, port interfaces, exported method signatures, and error model that consumers will import. No implementations, no HTTP code, no adapter bodies. The deliverable is effectively the `.d.ts` of helix-lib v0.

`ocr-ai` is the **validation case** for the design: the interface must make migrating from raw `openai` SDK calls to helix-lib feel like a thin rename, not a redesign. PR1–PR6 and HX1–HX6 from `openspec/config.yaml` are the formal spec; ocr-ai is the lived-in proof.

### Success Criteria

- Every HX capability (HX1–HX6) has a corresponding public type or method signature.
- Every PR is reflected in a structural constraint of the interface (response shape, error shape, dependency budget).
- A reader of `src/index.ts` can answer: *"How do I send a text request, upload a file, define a custom tool, or read usage tokens?"* without reading any other file.
- The 10 open questions surfaced in exploration are resolved here, with reasoning.

---

## 2. What Changes

This change creates the following **interface-only** artifacts (no runtime code):

- `src/core/ports/provider.port.ts` — `HelixProvider` port interface (HX1, HX3, HX4, HX5, HX6).
- `src/core/ports/file-store.port.ts` — `HelixFileStore` port interface (HX2).
- `src/core/types/request.ts` — `HelixRequest`, `HelixRequestOptions`, content part types, role/message types.
- `src/core/types/response.ts` — `HelixResponse` type alias for the OpenAI Responses API shape (PR1, PR5), output item discriminated union.
- `src/core/types/error.ts` — `HelixError` class declaration, `HelixErrorKind` discriminated union, `HelixProviderKind`.
- `src/core/types/tools.ts` — `NativeTool`, `FunctionTool`, `ToolChoice`, well-known native-tool name allow-list.
- `src/core/types/capabilities.ts` — `ProviderCapabilities` shape returned by `provider.capabilities()`.
- `src/core/client.ts` — `HelixClient` aggregate type composing a provider and an optional file store.
- `src/adapters/openai/factory.ts` — `createOpenAI()` factory **signature only**.
- `src/adapters/azure/factory.ts` — `createAzureOpenAI()` factory **signature only**.
- `src/adapters/custom/factory.ts` — `createOpenAICompatible()` factory **signature only**.
- `src/adapters/vertex/factory.ts` — `createVertex()` factory **signature only**.
- `src/index.ts` — public exports.

All function bodies are placeholders (`throw new Error("not implemented")` or equivalent declarations). The point is the surface, not the behavior.

---

## 3. Scope

### IN scope

- TypeScript types for requests, responses, content parts, tools, errors, capabilities.
- Port interfaces (`HelixProvider`, `HelixFileStore`) — pure contracts, no implementations.
- Exported method signatures for all 4 provider factories.
- `HelixError` class declaration and discriminated `HelixErrorKind` union.
- Public re-exports from `src/index.ts`.
- File and folder layout enforcing Hexagonal boundaries (`core/ports`, `core/types`, `adapters/<provider>`).
- Resolution of all 10 open questions from exploration.

### OUT of scope (explicitly deferred)

- **Adapter implementations** — no HTTP requests, no auth flows, no SDK calls. Bodies are stubs.
- **Response normalization function bodies** — `normalizeResponse(raw, provider)` is a future change; this proposal does not declare it (the type alias `HelixResponse` is enough for the contract).
- **Error normalization function bodies** — same: `normalizeError()` lives in a later change.
- **HTTP / network code** — no `fetch`, no `axios`, no auth libraries.
- **Streaming** (`requestStream`, `AsyncIterable<StreamDelta>`) — deferred to Phase 2.
- **`runToolLoop()` helper** — deferred to Phase 2; HX5 in this change covers only the one-shot tool-call response shape.
- **Tests** — no test scaffolding, no Vitest setup. Handled in a separate change once `package.json` exists.
- **`package.json`, `tsconfig.json`, `tsup.config.ts`, ESLint/Prettier** — handled in a separate "infra bootstrap" change.
- **ocr-ai migration** — happens *after* this change is implemented and adapters land.

---

## 4. Resolved Decisions

The exploration listed 10 open questions. Each is resolved below. Decisions 1, 2 (interfaces-only), 3 (HX capability scope), 4 (`responseFormat`), 6 (sync `request()`), and 7 (no `runToolLoop`) are NON-NEGOTIABLE inputs from the user/orchestrator and appear here as fixed constraints. The remaining (Q2 stateful multi-turn, Q3 factory pattern, Q5 `n>1`, Q6 HelixError shape, Q7 custom config, Q8 Vertex auth, Q9 strict mode, Q10 versioning) are decided **now** with reasoning.

| # | Question | Decision | Justification |
|---|----------|----------|---------------|
| 1 | OpenAI Responses API vs Chat Completions | **Responses API ONLY** (`/v1/responses`). All 4 providers map to/from this shape. | NON-NEGOTIABLE. ocr-ai already uses Responses API. Aligns with PR5 and the future of OpenAI's API surface. Custom endpoints that don't speak Responses are excluded; Azure must use a Responses-supporting deployment. |
| 2 | Stateful multi-turn on Vertex | **Stateless messages-array model is the contract.** `HelixRequest.input` is always the full conversation. `previous_response_id` is exposed as an OPTIONAL `previousResponseId` option that adapters MAY use when supported (OpenAI Responses) and MUST ignore otherwise (Vertex, Azure with non-Responses deployments). | Portability wins over per-provider state efficiency. Callers always have a deterministic mental model: pass the full input. State is an optimization, not a semantic. Avoids synthesizing fake IDs in Vertex. |
| 3 | Provider factory vs global singleton | **Instance-based factory functions** — `createOpenAI({ apiKey, ... })` returns a `HelixProvider`. No global registry, no `Helix.use(...)`. | Hexagonal-friendly: explicit dependency, easy to mock, supports multiple instances side-by-side (e.g., one OpenAI key for prod, one for sandbox). Aligns with how the `openai` SDK itself works — migration ergonomics. |
| 4 | Streaming in Phase 1 | **Deferred to Phase 2.** `request()` returns `Promise<HelixResponse>`. No `requestStream()` declared. | NON-NEGOTIABLE. ocr-ai does not stream. Streaming abstraction across SSE shapes (OpenAI delta events vs Gemini full-candidate snapshots) is a non-trivial design, not worth the surface bloat for Phase 1. |
| 5 | `n > 1` (multiple candidates) | **Force `n = 1` in Phase 1.** No `n` / `candidateCount` field in `HelixRequestOptions`. | Multi-candidate adds combinatorial complexity to normalization (especially Vertex `candidates[]` → OpenAI `output[]` mapping), zero current consumers. Add later as a non-breaking option. |
| 6 | HelixError as class vs plain object | **Class** that `extends Error`, with `kind` discriminant, `provider`, `statusCode?`, `raw?`, `retryable: boolean`, and a static `is(err): err is HelixError` type guard. | `instanceof HelixError` checks work; stack traces preserved; type-narrowing on `kind` works because the class is a discriminated union via the literal `kind` field. Best of both worlds. |
| 7 | Custom endpoint configuration | **`baseUrl` + `apiKey` only** in Phase 1. NO model-name aliasing, NO header injection beyond `Authorization`. Optional `headers?: Record<string, string>` escape hatch for unusual auth schemes (e.g., Together.ai custom headers) but it is opt-in and undocumented as the primary path. | Aliasing tables are a footgun and grow unbounded. If a consumer needs to call a custom endpoint with model `"llama3.1:8b"`, they pass that string as `model` directly. Helix does not "translate" model names. |
| 8 | Google ADC vs explicit service account | **Both, with ADC preferred.** `createVertex({ projectId, location })` uses ADC by default. An optional `credentials?: { clientEmail, privateKey } \| { keyFile: string }` field lets callers provide an explicit service account. | ADC covers local dev (gcloud) and GCP-hosted runtimes (Cloud Run, GKE) for free. Explicit service account covers CI runners and cross-cloud deployments. Two paths, both first-class, ADC is the easy default. |
| 9 | `UnsupportedFeature` strictness | **Configurable via `strict?: boolean` in `HelixRequestOptions` (default: `false`).** Default behavior: silently drop the unsupported param and continue. With `strict: true`: throw `HelixError` of kind `UnsupportedFeature` immediately, before any network call. | Default favors portability — a request authored for OpenAI mostly Just Works on Vertex even if `frequencyPenalty` is silently dropped. Strict mode favors correctness — production code that depends on a param being honored can opt in. |
| 10 | API versioning / provider drift | **Pin per-adapter at construction time.** `createAzureOpenAI({ apiVersion: "2024-10-01-preview" })` is required. `createVertex({ apiVersion?: "v1" })` is optional with sane default. OpenAI and custom endpoints do not version explicitly (OpenAI manages it server-side; custom is whatever the endpoint serves). | Provider drift is real; pinning is the only safe answer. Required where the provider has known breaking versions (Azure), optional with default elsewhere. Helix itself versions via semver on the package — breaking interface changes bump major. |

### Additional fixed inputs (from User-Resolved Decisions, restated for completeness)

- **Phase 1 = INTERFACES ONLY.** No bodies. The deliverable is the `.d.ts` surface.
- **HX1, HX2, HX3, HX4, HX5, HX6 are ALL in scope** for this change at the interface level. Vertex + files (HX2/HX3) is the one capability matrix gap — see §6.
- **Structured Output is `responseFormat` inside `HelixRequestOptions`** — three variants (`text`, `json_object`, `json_schema`). It lives inside HX6, not as a new HX number.

---

## 5. Public API Surface (Sketch)

> Snippets are illustrative — they fix names, shapes, and types but not implementations. Bodies are intentionally elided. The sdd-spec phase will translate each into Given/When/Then scenarios with RFC 2119 keywords.

### 5.1 Roles, content parts, and request input (HX1, HX3)

Field naming intentionally mirrors the `openai` SDK Responses API so ocr-ai migration is a rename, not a redesign.

```ts
// src/core/types/request.ts

export type HelixRole = "user" | "assistant" | "system" | "developer";

export interface InputText {
  type: "input_text";
  text: string;
}

export interface InputFile {
  type: "input_file";
  /** Reference to a previously-uploaded file (HX2). */
  file_id: string;
}

export interface InputFileEphemeral {
  type: "input_file";
  /** Inline ephemeral upload — adapter handles upload+attach transparently (HX3). */
  data: Uint8Array | ArrayBuffer;
  mimeType: string;
  /** Optional TTL in seconds; 0 means delete-after-request. */
  ttl?: number;
}

export type InputContentPart = InputText | InputFile | InputFileEphemeral;

export interface InputMessage {
  role: HelixRole;
  content: InputContentPart[];
}

export interface HelixRequest {
  /** Provider model identifier (e.g. "gpt-4o", "gemini-2.0-flash"). */
  model: string;
  /** System-level instruction; maps to OpenAI `instructions` and Vertex `systemInstruction`. */
  instructions?: string;
  /** Conversation input as message array. Stateless contract (see Resolved Decision Q2). */
  input: InputMessage[];
  /** OPTIONAL response chaining; honored only by providers that support it. */
  previousResponseId?: string;
  /** Tool definitions — see tools.ts. */
  tools?: ReadonlyArray<NativeTool | FunctionTool>;
  /** Tool selection strategy. */
  toolChoice?: ToolChoice;
  /** Generation options (HX6). */
  options?: HelixRequestOptions;
}
```

### 5.2 Optional generation parameters (HX6, includes structured output)

```ts
// src/core/types/request.ts (continued)

export type HelixThinking =
  | { effort: "low" | "medium" | "high" }   // OpenAI o-series
  | { budget: number };                       // Vertex thinking budget (tokens)

export type HelixResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | {
      type: "json_schema";
      name: string;
      schema: object;
      strict?: boolean;
    };

export interface HelixRequestOptions {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  thinking?: HelixThinking;
  /** Structured output — primary ocr-ai usage pattern. */
  responseFormat?: HelixResponseFormat;
  seed?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  /** When true, throw UnsupportedFeature instead of silently dropping unsupported options. */
  strict?: boolean;
}
```

### 5.3 Tools (HX4 native, HX5 custom)

```ts
// src/core/types/tools.ts

/** Allow-list of helix-known native tool names. Adapters map or throw UnsupportedFeature. */
export type NativeToolName =
  | "web_search"
  | "file_search"
  | "code_interpreter"
  | "google_search";

export interface NativeTool {
  type: "native";
  name: NativeToolName;
  /** Provider-passthrough config; opaque to helix. */
  config?: Record<string, unknown>;
}

export interface FunctionTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    /** JSON Schema describing the function parameters. */
    parameters: object;
    strict?: boolean;
  };
}

export type ToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "function"; name: string };
```

### 5.4 Response (PR1, PR5) — OpenAI Responses API shape

```ts
// src/core/types/response.ts

export interface OutputTextPart { type: "output_text"; text: string; }
export interface RefusalPart    { type: "refusal"; refusal: string; }
export type OutputContentPart   = OutputTextPart | RefusalPart;

export interface OutputMessage {
  type: "message";
  id: string;
  role: "assistant";
  content: OutputContentPart[];
  status?: "in_progress" | "completed" | "incomplete";
}

export interface FunctionCallOutput {
  type: "function_call";
  id: string;
  call_id: string;
  name: string;
  /** JSON-string arguments — Vertex object args MUST be serialized by the adapter (PR1). */
  arguments: string;
}

export interface ReasoningOutput {
  type: "reasoning";
  id: string;
  summary: Array<{ type: "summary_text"; text: string }>;
}

export type OutputItem = OutputMessage | FunctionCallOutput | ReasoningOutput;

export interface HelixUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface HelixResponse {
  id: string;
  object: "response";
  created_at: number;
  model: string;
  output: OutputItem[];
  /** Convenience: concatenation of all `output_text` parts in `output`. */
  output_text: string;
  usage: HelixUsage;
  /** Provider-extension bag — never relied on by helix core. */
  metadata?: Record<string, unknown>;
}
```

### 5.5 Provider port (HX1, HX3, HX4, HX5, HX6)

```ts
// src/core/ports/provider.port.ts

export interface ProviderCapabilities {
  provider: HelixProviderKind;
  files: boolean;                     // false for Vertex in Phase 1
  nativeTools: ReadonlyArray<NativeToolName>;
  thinking: boolean;
  structuredOutput: boolean;
  streaming: false;                   // Phase 2
}

export interface HelixProvider {
  /** Single-shot text request (HX1). Returns OpenAI Responses-shaped object (PR1). */
  request(req: HelixRequest): Promise<HelixResponse>;

  /** Static capability descriptor — drives feature detection and strict-mode checks. */
  capabilities(): ProviderCapabilities;
}
```

### 5.6 File store port (HX2)

```ts
// src/core/ports/file-store.port.ts

export interface UploadInput {
  data: Uint8Array | ArrayBuffer;
  mimeType: string;
  filename?: string;
  /** TTL in seconds. Omitted = provider default. 0 = delete-after-first-use semantics where supported. */
  ttl?: number;
  /** OpenAI Files API `purpose` — "user_data" (OpenAI) or "assistants" (Azure). Default chosen by adapter. */
  purpose?: string;
}

export interface FileRef {
  id: string;
  bytes: number;
  mimeType: string;
  filename?: string;
  createdAt: number;
  expiresAt?: number;
}

export interface HelixFileStore {
  upload(input: UploadInput): Promise<FileRef>;
  list(opts?: { limit?: number }): Promise<FileRef[]>;
  delete(fileId: string): Promise<{ id: string; deleted: true }>;
}
```

### 5.7 Aggregate client

```ts
// src/core/client.ts

export interface HelixClient {
  provider: HelixProvider;
  /** Optional — absent for Vertex in Phase 1 (PR4). */
  files?: HelixFileStore;
}
```

### 5.8 Errors (PR6)

```ts
// src/core/types/error.ts

export type HelixProviderKind = "openai" | "azure" | "custom" | "vertex";

export type HelixErrorKind =
  | "InvalidApiKey"
  | "PermissionDenied"
  | "InvalidRequest"
  | "RateLimit"
  | "QuotaExceeded"
  | "ServerError"
  | "ProviderUnavailable"
  | "ContentFiltered"
  | "UnsupportedFeature"
  | "NormalizationError"
  | "Unknown";

export interface HelixErrorInit {
  kind: HelixErrorKind;
  provider: HelixProviderKind;
  message: string;
  statusCode?: number;
  raw?: unknown;
  retryable?: boolean;
  cause?: unknown;
}

export declare class HelixError extends Error {
  readonly kind: HelixErrorKind;
  readonly provider: HelixProviderKind;
  readonly statusCode?: number;
  readonly raw?: unknown;
  readonly retryable: boolean;

  constructor(init: HelixErrorInit);

  static is(err: unknown): err is HelixError;
}
```

### 5.9 Provider factory signatures

```ts
// src/adapters/openai/factory.ts
export interface OpenAIConfig {
  apiKey: string;
  baseUrl?: string;
  organization?: string;
  project?: string;
  defaultHeaders?: Record<string, string>;
}
export declare function createOpenAI(config: OpenAIConfig): HelixClient;

// src/adapters/azure/factory.ts
export interface AzureOpenAIConfig {
  apiKey: string;
  endpoint: string;
  /** REQUIRED — Azure breaks across versions (see Q10). */
  apiVersion: string;
  // Note: deployment name comes from HelixRequest.model at call time (REQ-FAC-007)
}
export declare function createAzureOpenAI(config: AzureOpenAIConfig): HelixClient;

// src/adapters/custom/factory.ts
export interface OpenAICompatibleConfig {
  apiKey: string;
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
}
/** No HelixFileStore — custom endpoints have no portable files contract (PR4). */
export declare function createOpenAICompatible(config: OpenAICompatibleConfig): HelixClient;

// src/adapters/vertex/factory.ts
export type VertexCredentials =
  | { clientEmail: string; privateKey: string }
  | { keyFile: string };

export interface VertexConfig {
  projectId: string;
  location: string;
  /** Default: ADC. Provide for explicit service-account auth. */
  credentials?: VertexCredentials;
  apiVersion?: string;
}
/** No HelixFileStore — Vertex files unsupported in Phase 1 (PR4). */
export declare function createVertex(config: VertexConfig): HelixClient;
```

### 5.10 Public exports

```ts
// src/index.ts
export type {
  HelixProvider,
  HelixFileStore,
  HelixClient,
  HelixRequest,
  HelixRequestOptions,
  HelixResponseFormat,
  HelixThinking,
  HelixResponse,
  HelixUsage,
  OutputItem,
  OutputMessage,
  OutputContentPart,
  FunctionCallOutput,
  ReasoningOutput,
  InputMessage,
  InputContentPart,
  InputText,
  InputFile,
  InputFileEphemeral,
  HelixRole,
  NativeTool,
  NativeToolName,
  FunctionTool,
  ToolChoice,
  ProviderCapabilities,
  HelixProviderKind,
  HelixErrorKind,
  HelixErrorInit,
  UploadInput,
  FileRef,
  OpenAIConfig,
  AzureOpenAIConfig,
  OpenAICompatibleConfig,
  VertexConfig,
  VertexCredentials,
} from "./core/index";

export { HelixError } from "./core/types/error";
export { createOpenAI } from "./adapters/openai/factory";
export { createAzureOpenAI } from "./adapters/azure/factory";
export { createOpenAICompatible } from "./adapters/custom/factory";
export { createVertex } from "./adapters/vertex/factory";
```

---

## 6. Provider Capability Matrix

Required adapter support per HX feature. `OK` = adapter MUST honor; `MAP` = adapter translates between provider shape and helix shape; `DROP/STRICT` = silent drop by default, `UnsupportedFeature` thrown when `strict: true`; `❌` = `UnsupportedFeature` always (capability not exposed).

| Feature | OpenAI | Azure | Custom (OpenAI-compatible) | Vertex |
|---|---|---|---|---|
| HX1 — text request via `request()` | OK | OK | OK | MAP |
| HX2 — files (upload/list/delete) | OK | OK | ❌ (no `HelixFileStore`) | ❌ (no `HelixFileStore`) |
| HX3 — ephemeral inline files | OK | OK | ❌ | ❌ |
| HX4 — `web_search` native tool | OK | ❌ STRICT | ❌ STRICT | MAP → `google_search` only when explicitly requested as `google_search` |
| HX4 — `google_search` native tool | ❌ STRICT | ❌ STRICT | ❌ STRICT | OK (MAP to `googleSearch` grounding) |
| HX4 — `file_search` / `code_interpreter` | OK (Assistants/Responses) | OK (Assistants) | ❌ STRICT | ❌ STRICT |
| HX5 — function tools (one-shot) | OK | OK | OK (when endpoint supports it) | MAP (`functionDeclarations`; serialize `args` object → JSON string in response per PR1) |
| HX6 — `temperature`, `topP`, `maxOutputTokens`, `stopSequences` | OK | OK | OK | MAP |
| HX6 — `topK` | DROP/STRICT | DROP/STRICT | DROP/STRICT | OK |
| HX6 — `seed`, `frequencyPenalty`, `presencePenalty` | OK | OK | DROP/STRICT (provider-dependent) | DROP/STRICT |
| HX6 — `thinking` | MAP `effort` (o-series) | MAP `effort` (when deployment supports) | DROP/STRICT | MAP `budget` |
| HX6 — `responseFormat: text` | OK | OK | OK | MAP (no-op) |
| HX6 — `responseFormat: json_object` | OK | OK | OK (provider-dependent — DROP/STRICT if not) | MAP (`responseMimeType: "application/json"`) |
| HX6 — `responseFormat: json_schema` | OK | OK | DROP/STRICT (provider-dependent) | MAP (`responseSchema`) |
| `previousResponseId` | OK | OK (Responses-supporting deployments only) | DROP/STRICT | DROP (always — stateless) |
| Streaming | ❌ Phase 2 | ❌ Phase 2 | ❌ Phase 2 | ❌ Phase 2 |

The `capabilities()` method on each `HelixProvider` returns this matrix at runtime so callers can feature-detect without strings.

---

## 7. Affected Modules

All paths are new — the project is greenfield.

| Path | Purpose |
|---|---|
| `src/core/ports/provider.port.ts` | `HelixProvider` port — request + capabilities. |
| `src/core/ports/file-store.port.ts` | `HelixFileStore` port — upload/list/delete. |
| `src/core/types/request.ts` | `HelixRequest`, `HelixRequestOptions`, input message and content part types. |
| `src/core/types/response.ts` | `HelixResponse`, output item discriminated union, `HelixUsage`. |
| `src/core/types/error.ts` | `HelixError` class, `HelixErrorKind`, `HelixProviderKind`. |
| `src/core/types/tools.ts` | `NativeTool`, `FunctionTool`, `ToolChoice`, `NativeToolName` allow-list. |
| `src/core/types/capabilities.ts` | `ProviderCapabilities`. |
| `src/core/client.ts` | `HelixClient` aggregate (provider + optional file store). |
| `src/core/index.ts` | Barrel re-exporting all core types and ports. |
| `src/adapters/openai/factory.ts` | `createOpenAI()` signature; `OpenAIConfig`. |
| `src/adapters/azure/factory.ts` | `createAzureOpenAI()` signature; `AzureOpenAIConfig`. |
| `src/adapters/custom/factory.ts` | `createOpenAICompatible()` signature; `OpenAICompatibleConfig`. |
| `src/adapters/vertex/factory.ts` | `createVertex()` signature; `VertexConfig`, `VertexCredentials`. |
| `src/index.ts` | Public exports. |

No `src/adapters/<provider>/client.ts`, `src/core/normalize/*`, or `src/tools/run-tool-loop.ts` in this change — those are deferred.

---

## 8. Risks and Mitigations

Pulled from exploration §10, plus risks introduced by the resolved decisions.

| # | Risk | Mitigation |
|---|------|------------|
| 1 | **Vertex normalization complexity** — Gemini `candidates[].content.parts[]`, safety ratings, grounding metadata have no OpenAI equivalents. | Sdd-spec must enumerate the mapping rules as testable scenarios. Since this change is interface-only, the risk surfaces in the *next* change (normalization). Capture the mapping rules now in design. |
| 2 | **Responses-API-only stance excludes legacy Azure deployments and many custom endpoints.** | Documented as a hard requirement (Resolved Decision 1). `createAzureOpenAI` requires `apiVersion`; deployments not on Responses API will fail at request time with `InvalidRequest`. Explicit. |
| 3 | **Stateless contract loses server-side state efficiency on OpenAI.** | `previousResponseId` option is exposed as an opt-in optimization for adapters that support it. Default is stateless and portable. |
| 4 | **Vertex auth (ADC vs service account) is non-trivial in CI/local.** | Two paths supported (Resolved Decision 8). Errors during auth must surface as `InvalidApiKey` or `PermissionDenied` with actionable `message`. Captured as a spec scenario. |
| 5 | **Function-call argument shape mismatch** — Gemini `args: object` vs OpenAI `arguments: string`. | `FunctionCallOutput.arguments` is typed `string` (PR1). Spec MUST require Vertex adapter to `JSON.stringify(args)`. Tested via spec scenarios. |
| 6 | **Custom endpoint variability** — "OpenAI-compatible" is a spectrum. | `createOpenAICompatible()` returns a `HelixClient` with NO `files`. Capabilities matrix marks most HX features `DROP/STRICT`. Strict mode lets consumers detect unsupported features. |
| 7 | **`thinking` shape is a forced unification** — `effort` enum (OpenAI) vs `budget` integer (Vertex) are conceptually different. | Modeled as a discriminated union (`{ effort } | { budget }`), not a forced average. Caller picks the variant their target model accepts. Adapter ignores the wrong variant via DROP/STRICT. |
| 8 | **Allow-list of native tool names ages over time** — new providers add new tools. | `NativeToolName` is a TypeScript string-literal union that we extend in a minor version bump. Unknown names fail at type-check, which is the desired behavior. |
| 9 | **`previousResponseId` semantics ambiguous** when caller passes it AND a full `input` array. | Spec MUST define: full `input` is authoritative; `previousResponseId` is a hint to providers that support state. Documented in spec scenarios. |
| 10 | **`HelixError` class in interfaces-only change requires runtime declaration** — `declare class` only ships types, not runtime. | The `error.ts` file declares the class inline (small, runtime-included) rather than `declare class`. This is the one runtime concession in this change because `HelixError.is(err)` must work at runtime. Captured in design. |
| 11 | **Structured output `json_schema` strict mode mismatch** — OpenAI `strict` (schema-level) vs JSON Schema strictness. | `HelixResponseFormat.json_schema.strict` maps to provider-native strict where supported, drops elsewhere per Resolved Decision 9. |

---

## 9. Rollback Plan

This change is greenfield — there is no consumer in production using helix-lib yet. ocr-ai will migrate **after** this change is implemented and adapters land in subsequent changes.

**Rollback** = delete `openspec/changes/helix-interface-definition/` and any `src/` files that have been created under it. There is nothing to revert in any external consumer.

If after sdd-spec or sdd-design we discover the contract is wrong, we delete the change folder and start a fresh `/sdd-new` cycle. There is zero migration cost during Phase 1.

---

## 10. Next Phase

`sdd-spec` will translate every interface, type, and resolved decision into Given/When/Then scenarios with RFC 2119 keywords (MUST, SHALL, SHOULD, MAY), tied to PR1–PR6 and HX1–HX6 identifiers.

Specifically, sdd-spec must produce scenarios for:

- HX1 happy path on each provider — request shape in, `HelixResponse` shape out.
- HX2 upload/list/delete — including `purpose` defaulting per provider, TTL handling, and Vertex's absence of `files`.
- HX3 ephemeral file inline — adapter MUST upload, attach, and (when `ttl: 0`) clean up.
- HX4 native tool dispatch — allow-list mapping per provider; `UnsupportedFeature` paths.
- HX5 one-shot function tool — input shape, `FunctionCallOutput` in response, Vertex `args`-object → JSON-string normalization.
- HX6 every option — including the three `responseFormat` variants and `strict` mode behavior.
- PR6 error normalization — every status / kind in the matrix.
- Capability matrix — `provider.capabilities()` MUST match §6 exactly.

`sdd-design` may run in parallel and will document the architectural decisions (port composition, `HelixClient` aggregate, factory pattern, error class as runtime export) and any sequence diagrams for ephemeral file handling.

---

## 11. Open Items for sdd-spec to Resolve

These are not blockers for sdd-spec to start but should be tightened during spec authoring:

- Exact retry-classification table per status code per provider (which 5xx are `retryable: true`?).
- Exact `purpose` defaulting rule for `HelixFileStore.upload` per adapter (`"user_data"` for OpenAI, `"assistants"` for Azure — is this enforced or overridable?).
- `output_text` derivation rule when `output[]` contains refusals or function calls — concatenate text parts only? Empty string? Spec must pin.
- Whether `instructions` and `input[].role: "system"` may coexist or are mutually exclusive.
