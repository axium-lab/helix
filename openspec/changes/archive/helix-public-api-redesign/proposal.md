# Proposal: helix-lib Public API Redesign — SDK-Mirror Surface

**Change**: `helix-public-api-redesign`
**Date**: 2026-04-27
**Author**: orchestrator-delegated (sdd-propose)
**Status**: ready for sdd-spec
**Artifact store**: openspec
**Supersedes**: `helix-interface-definition` (archived 2026-04-27)

---

## 1. Why

The previous change (`helix-interface-definition`) shipped a hexagonal-pure but ergonomically heavy public surface — 38 exported types, four per-provider factories (`createOpenAI`, `createAzureOpenAI`, `createOpenAICompatible`, `createVertex`), a custom `HelixError` class, native + function tool types, capability runtime, ephemeral file content parts, and several reasoning/refusal output variants. It was correct on principles, but it was **not** what a developer reaches for first.

The redesign reframes the public surface around a single, brutally familiar shape: **the `openai` npm SDK**. A developer who knows `new OpenAI({ apiKey })` already knows `createHelix({ provider: "openai", apiKey })`. A developer who knows `client.responses.create(...)` already knows `helix.responses.create(...)`. The first consumer (`axium-api`) has zero LLM code today and will use helix-lib as its only LLM contact point; additional consumers are expected via the GitHub Packages distribution. We optimize for **instant onboarding**, not for any specific consumer's existing code (`ocr-ai` was a reference data point only).

The previous change is archived and immutable. THIS change replaces its public surface end-to-end. The hexagonal layout (`core/` zero-dep, adapters depend on core) is retained. Wire-shape snake_case is retained (ADR-1 inherited). Helix-owned types instead of peer-depending on the `openai` SDK is retained (ADR-10 inherited). Everything else on the public surface is reconsidered.

The error model and the tools surface are deferred to **separate future changes** (`helix-error-model`, `helix-tools`) because both deserve their own analysis pass — error mapping requires per-provider error-code research, and tools need a real consumer to anchor the design.

### Success Criteria

- A developer who knows the `openai` SDK can write a working helix call within 60 seconds of reading `src/index.ts`.
- The full public surface is ~14 exported types — down from 38.
- A single `createHelix(config)` function replaces four per-provider factories.
- `axium-api` integration is a one-line config change away from a working LLM call.
- The hexagonal core is preserved: `core/` still has zero runtime dependencies.

---

## 2. What Changes

The public surface is rewritten. Below is the complete delete/replace/add list.

### DELETED (removed from public surface)

- **Per-provider factories**: `createOpenAI`, `createAzureOpenAI`, `createOpenAICompatible`, `createVertex` — replaced by single `createHelix`.
- **Per-provider configs**: `OpenAIConfig`, `AzureOpenAIConfig`, `OpenAICompatibleConfig`, `VertexConfig` (the latter survives in collapsed form inside `HelixConfig`).
- **Error model**: `HelixError`, `HelixErrorKind`, `HelixErrorInit` — deferred to `helix-error-model`. Provider/SDK errors propagate raw to callers in this change. The lone runtime export from the previous change is GONE; this change is type-only on the public surface.
- **Tools**: `NativeTool`, `NativeToolName`, `FunctionTool`, `ToolChoice` — deferred to `helix-tools`.
- **Reasoning / refusal / function-call outputs**: `ReasoningOutput`, `RefusalPart`, `FunctionCallOutput` — `OutputItem` is reduced to ONLY the `{ type: "message" }` variant.
- **Ephemeral files**: `InputFileEphemeral` — callers explicitly upload + reference + delete via `helix.files.*`.
- **Generation params (deferred)**: `HelixThinking`, `topK`, `topP`, `seed`, `frequencyPenalty`, `presencePenalty`, `stopSequences`, `strict`. `HelixRequestOptions` collapses into an inline object on `ResponsesCreateParams` with only `temperature` and `max_output_tokens`.
- **Capability runtime**: `ProviderCapabilities`, `provider.capabilities()`. Per-provider support is a static documentation matrix in this proposal; it does not exist as a runtime API.
- **Hexagonal port surface**: `HelixProvider`, `HelixFileStore`, `HelixClient`, `UploadInput`, `FileRef`. Replaced by the `Helix` interface and its `responses` / `files` / `models` / `test` namespaces. (Hexagonal layout is preserved internally — these ports collapse into private adapter routers.)

### REPLACED

- `HelixRequest` → **`ResponsesCreateParams`** (mirrors `openai` SDK `responses.create` parameters).
- `HelixResponse` — kept by name; reduced output union (only `{ type: "message" }`); fields shrink accordingly.
- `src/core/index.ts` and `src/index.ts` barrels — fully rewritten.

### ADDED

- **`createHelix(config)`** — single unified factory. `config` is a discriminated union over `provider`.
- **`Helix`** — the client interface returned by `createHelix`. Mirrors SDK namespace shape.
- **`helix.responses.create(params)`** — primary text-generation entry point (HX1).
- **`helix.files.create(params)`** / **`helix.files.list()`** / **`helix.files.delete(id)`** — file CRUD namespace (HX2).
- **`helix.models.list()`** — list available models (HX8, NEW capability).
- **`helix.test()`** — returns `Promise<boolean>` for connectivity/credentials sanity check (HX7, NEW capability). Caller does its own diagnostic on `false`. No throw, no `{ok, error}` wrapper.
- **`HelixConfig`** — discriminated union by `provider`, 4 variants.
- **`HelixProviderKind`** — `"openai" | "azure" | "custom" | "vertex"` (re-introduced from previous change in trimmed form).
- **`VertexCredentials`** — only retained type from previous Vertex auth.
- **`HelixResponseFormat`** — three variants kept (`text`, `json_object`, `json_schema`) for structured output (primary use case).
- **`FilesCreateParams`**, **`FileObject`** — file CRUD types mirroring SDK shape.
- **`ModelInfo`** — model list element type.

---

## 3. Scope

### IN scope

- New public surface: `createHelix`, `Helix`, namespace methods (`responses`, `files`, `models`, `test`).
- New core types under `src/core/types/`: `config.ts`, `request.ts` (rewritten as `ResponsesCreateParams`), `response.ts` (reduced), `files.ts`, `models.ts`.
- New aggregate file `src/createHelix.ts` exporting the factory + `Helix` interface.
- Internal adapter routers under `src/internal/providers/{openai,azure,custom,vertex}.ts` — flat files, NOT public, NOT exported from `src/index.ts`. They replace the previous folder-per-adapter structure with one file per provider since the public surface no longer needs port composition.
- Updated `src/core/index.ts` and `src/index.ts` barrels reflecting the new surface.
- Removal of the previous change's main spec capabilities (`errors`, `tools`, `factories`, `ports`) and replacement with new capabilities for the SDK-mirror surface.
- A documented capability matrix per provider for the leaner surface (proposal §8).
- Hexagonal preservation: `core/` remains zero-dep; adapter code lives behind the `Helix` namespace and never leaks types to consumers.

### OUT of scope (explicitly deferred)

- **Error model**. `HelixError`, `HelixErrorKind`, `HelixErrorInit`, the 11-value error kind union, the per-provider error mapping table — all deferred to a future change `helix-error-model`. In THIS change, provider/SDK errors propagate raw. Operations that a provider does not support (e.g., `helix.files.create` on Vertex) throw a plain `Error` with a clear message like `helix-lib: 'files.create' not supported by provider 'vertex'`. This is **temporary technical debt**.
- **Tools** (HX4, HX5). `NativeTool`, `FunctionTool`, `ToolChoice`, the native tool allow-list, the function-call output variant — deferred to `helix-tools`.
- **Ephemeral inline files** (HX3). Callers upload then reference then delete via `helix.files.*`.
- **Streaming**. `requestStream`, `AsyncIterable<StreamDelta>` — deferred indefinitely until a consumer needs it.
- **Capability runtime**. `provider.capabilities()`, `ProviderCapabilities` type. Capability information is documentation in this proposal, not code. Re-introduce as a runtime API later if a consumer needs it.
- **Multi-candidate generation** (`n > 1`).
- **Extended generation params**. `topP`, `topK`, `stopSequences`, `seed`, `frequencyPenalty`, `presencePenalty`, `thinking`, `strict` — deferred. Add per-consumer-demand only.
- **`runToolLoop`** helper.
- **Reasoning, refusal, function-call output variants** (`ReasoningOutput`, `RefusalPart`, `FunctionCallOutput`) — `OutputItem` is reduced to just `{ type: "message" }` for this change. Re-introduce alongside `helix-tools` and `helix-error-model`.
- **Per-provider extras**: `defaultHeaders`, `organization`, `project`, `apiVersion` for non-Azure providers. Add when a real consumer asks. YAGNI.
- **`ocr-ai` migration**. Happens after this change ships and adapters land. ocr-ai is a validation reference, not a deliverable here.
- **`axium-api` integration**. Same — happens after adapters land.

---

## 4. Resolved Decisions

These are user-resolved decisions encoded as fixed inputs. Do NOT relitigate during sdd-spec or sdd-design.

| # | Decision | Justification (1-line) |
|---|----------|------------------------|
| RD-1 | Public surface mirrors the `openai` SDK shape (namespaces: `responses`, `files`, `models`). | The SDK is the de-facto standard; any developer who knows it can use helix-lib instantly. |
| RD-2 | A single `createHelix(config)` factory replaces the 4 per-provider factories. `HelixConfig` is a discriminated union by `provider`. | One import, one mental model, one entry point. INVERTS ADR-5 from the previous change. |
| RD-3 | `helix.test()` returns `Promise<boolean>`. No `{ok, error}` wrapper, no throw. | Caller runs its own diagnostic on `false`. Keep it simple. |
| RD-4 | Errors propagate raw from provider SDKs in this change. No `HelixError`. | Error model deferred to `helix-error-model` after per-provider error-code analysis. Acknowledged temporary tech debt. |
| RD-5 | Tools (HX4 native + HX5 function) are deferred entirely. No types, no methods. | Deferred to `helix-tools` once a real consumer anchors the design. |
| RD-6 | `OutputItem` is reduced to ONLY `{ type: "message" }`. No reasoning, no refusal, no function-call variants. | Other variants return alongside their owning capability change (errors, tools). |
| RD-7 | `ResponsesCreateParams.options` (or inlined fields, see §5) carries ONLY `temperature` and `max_output_tokens`. `text.format` (structured output) IS included with all 3 variants. | Structured output is the primary LLM-extraction use case; everything else is YAGNI today. |
| RD-8 | Ephemeral inline files (HX3) are dropped. Callers explicitly use `files.create` → reference by `file_id` → `files.delete`. | Reduces surface; the explicit dance is what every SDK does anyway. |
| RD-9 | Capability runtime (`provider.capabilities()`, `ProviderCapabilities`) is dropped. Capability info lives in proposal documentation. | If a consumer needs runtime feature detection, re-introduce later non-breakingly. |
| RD-10 | Per-provider configs require ONLY what each provider strictly needs: OpenAI (`apiKey`, `baseUrl?`), Azure (`apiKey`, `endpoint`, `apiVersion`), Custom (`apiKey`, `baseUrl`), Vertex (`projectId`, `location`, `credentials?`). | YAGNI. `defaultHeaders`, `organization`, `project` etc. join when a real consumer asks. |
| RD-11 | Lean type budget: ~14 public types. The previous change exported 38. Inline literal types where possible. NO type for things with a single use site. | Smaller surface = faster onboarding, easier maintenance. |

### Inherited from previous change (still in force)

- **ADR-1 (kept)** — wire-shape fields use snake_case verbatim (`input_tokens`, `output_tokens`, `total_tokens`, `created_at`, `output_text`, `input_text`, `input_file`, `expires_after`); helix-original fields use camelCase (`apiKey`, `baseUrl`, `projectId`, `apiVersion`).
- **ADR-10 (kept)** — helix-owned types in `core/`. NO peer-dep on the `openai` SDK from `core/`. The internal adapter routers MAY use the SDK; no SDK type leaks to the public surface.
- **Phase 0 bootstrap (kept)** — `package.json`, `tsconfig.json`, `tsup.config.ts`, `.npmrc.example`, `.gitignore` from the previous change are unchanged.
- **Hexagonal layout (kept)** — `core/` is zero-dependency; internal adapters depend on `core/` and never vice versa. Public surface is `src/index.ts` only.

### New ADR replacing previous ADR-5

- **ADR-5 (revised)**: Single unified `createHelix(config)` factory replaces per-provider factories. The discriminated union `HelixConfig` carries provider-specific config inline. The previous ADR-5 ("per-instance factories over global registry") is preserved in spirit — `createHelix` is still per-instance, no global state — but its surface is unified.

---

## 5. Public API Surface (Sketch)

Snippets are illustrative — names, shapes, types are pinned; bodies are intentionally elided. The sdd-spec phase translates each into Given/When/Then scenarios with RFC 2119 keywords.

### 5.1 Provider config (RD-2, RD-10)

```ts
// src/core/types/config.ts

export type HelixProviderKind = "openai" | "azure" | "custom" | "vertex";

export type VertexCredentials =
  | { clientEmail: string; privateKey: string }
  | { keyFile: string };

export type HelixConfig =
  | { provider: "openai"; apiKey: string; baseUrl?: string }
  | { provider: "azure"; apiKey: string; endpoint: string; apiVersion: string }
  | { provider: "custom"; apiKey: string; baseUrl: string }
  | { provider: "vertex"; projectId: string; location: string; credentials?: VertexCredentials };
```

### 5.2 Helix client interface (RD-1, RD-3)

```ts
// src/createHelix.ts

export interface Helix {
  responses: {
    create(params: ResponsesCreateParams): Promise<HelixResponse>;
  };
  files: {
    create(params: FilesCreateParams): Promise<FileObject>;
    list(): Promise<FileObject[]>;
    delete(id: string): Promise<{ id: string; deleted: true }>;
  };
  models: {
    list(): Promise<ModelInfo[]>;
  };
  test(): Promise<boolean>;
}

export declare function createHelix(config: HelixConfig): Helix;
```

### 5.3 Responses params and response (RD-6, RD-7)

```ts
// src/core/types/request.ts

export type HelixRole = "user" | "assistant" | "system" | "developer";

export interface InputText {
  type: "input_text";
  text: string;
}

export interface InputFile {
  type: "input_file";
  file_id: string;
}

export type InputContentPart = InputText | InputFile;

export interface InputMessage {
  role: HelixRole;
  content: InputContentPart[];
}

export type HelixResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; name: string; schema: object; strict?: boolean };

export interface ResponsesCreateParams {
  model: string;
  input: InputMessage[];
  instructions?: string;
  temperature?: number;
  max_output_tokens?: number;
  text?: { format?: HelixResponseFormat };
}
```

```ts
// src/core/types/response.ts

export interface OutputTextPart {
  type: "output_text";
  text: string;
}

export interface OutputMessage {
  type: "message";
  id: string;
  role: "assistant";
  content: OutputTextPart[];
  status?: "in_progress" | "completed" | "incomplete";
}

export type OutputItem = OutputMessage;

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
  output_text: string;
  usage: HelixUsage;
}
```

### 5.4 Files (HX2)

```ts
// src/core/types/files.ts

export interface FilesCreateParams {
  file: Uint8Array | ArrayBuffer | Blob;
  purpose?: string;
  expires_after?: { anchor: "created_at"; seconds: number };
}

export interface FileObject {
  id: string;
  object: "file";
  bytes: number;
  created_at: number;
  filename?: string;
  purpose: string;
  expires_at?: number;
}
```

### 5.5 Models (HX8)

```ts
// src/core/types/models.ts

export interface ModelInfo {
  id: string;
  object: "model";
  created: number;
  owned_by?: string;
}
```

### 5.6 Public exports

```ts
// src/index.ts
export { createHelix } from "./createHelix";
export type {
  Helix,
  HelixConfig,
  HelixProviderKind,
  VertexCredentials,
  ResponsesCreateParams,
  HelixResponse,
  HelixUsage,
  HelixResponseFormat,
  HelixRole,
  InputMessage,
  InputContentPart,
  InputText,
  InputFile,
  OutputItem,
  OutputMessage,
  OutputTextPart,
  FilesCreateParams,
  FileObject,
  ModelInfo,
} from "./core";
```

Total exported types: ~14 (counted: `Helix`, `HelixConfig`, `HelixProviderKind`, `VertexCredentials`, `ResponsesCreateParams`, `HelixResponse`, `HelixUsage`, `HelixResponseFormat`, `HelixRole`, `InputMessage`, `InputContentPart`, `OutputItem`, `FilesCreateParams`, `FileObject`, `ModelInfo`). `InputText`, `InputFile`, `OutputMessage`, `OutputTextPart` are convenience re-exports for callers that want to type-narrow against union variants — they are part of the public surface but counted within their parent unions.

---

## 6. Migration Note for Previous Change's Main Specs

The archived change `helix-interface-definition` shipped the following live specs under `openspec/specs/`. Each is reclassified by THIS change:

| Spec | Status under this change | Reasoning |
|------|--------------------------|-----------|
| `openspec/specs/core-types/spec.md` | **HEAVILY REDUCED** | Many requirements (tool types, error types, ephemeral file, capabilities, thinking, multi-output variants) are removed. The kept REQs (input message shape, `output_text` derivation rule, snake_case wire-shape compliance, `HelixResponse` shape) require restructuring around the new namespace surface. sdd-spec authors a delta. |
| `openspec/specs/factories/spec.md` | **REPLACED** entirely | Per-provider factories are gone. Replaced by a new capability spec for `createHelix` and the `Helix` interface. |
| `openspec/specs/ports/spec.md` | **REPLACED** | `HelixProvider` / `HelixFileStore` ports are no longer public. Replaced by capability specs for the namespace methods (`responses`, `files`, `models`, `test`). |
| `openspec/specs/errors/spec.md` | **OBSOLETE** | `HelixError` is removed. The archive phase of THIS change should mark this spec for removal. The future `helix-error-model` change will write a replacement from scratch. |
| `openspec/specs/tools/spec.md` | **OBSOLETE** | Tools are deferred. The archive phase of THIS change should mark this spec for removal. The future `helix-tools` change will write a replacement from scratch. |

`sdd-spec` for THIS change will produce delta specs covering the new domains (likely: `client`, `responses`, `files`, `models`, `test`) and removal markers for `errors` and `tools`.

---

## 7. Capabilities

> Contract between this proposal and the sdd-spec phase. New capabilities each become `openspec/specs/<name>/spec.md`.

### New Capabilities

- `client`: the `createHelix(config)` factory and the `Helix` interface contract — config validation, namespace composition, lifetime.
- `responses`: `helix.responses.create(params)` — input/output shape, `text.format` structured output behavior, `temperature` and `max_output_tokens` handling, per-provider mapping rules.
- `files`: `helix.files.create / list / delete` — params, `FileObject` shape, per-provider availability (OpenAI/Azure supported; Custom/Vertex throw).
- `models`: `helix.models.list()` — `ModelInfo` shape, per-provider mapping (OpenAI/Azure/Custom HTTP; Vertex MAP).
- `test`: `helix.test()` returns `Promise<boolean>` — uses `models.list` under the hood; returns `false` on any failure (no throw).

### Modified Capabilities

- `core-types`: existing spec is heavily reduced — removal of tools, error, ephemeral file, capabilities, thinking, reasoning/refusal/function-call output variants; restructuring of message/content/output around the trimmed surface.

### Removed Capabilities (specs marked obsolete; archive phase removes them)

- `errors`: superseded by the future `helix-error-model` change.
- `tools`: superseded by the future `helix-tools` change.
- `factories`: replaced by `client`.
- `ports`: replaced by `client` + `responses` + `files` + `models` + `test`.

---

## 8. Provider Capability Matrix

Simplified for the leaner surface. `OK` = adapter MUST honor; `MAP` = adapter translates between provider shape and helix shape; `❌ throw` = adapter throws a plain `Error` with message `helix-lib: '<operation>' not supported by provider '<kind>'`.

| Feature | OpenAI | Azure | Custom | Vertex |
|---------|--------|-------|--------|--------|
| `responses.create` | OK | OK | OK | MAP |
| `files.create` | OK | OK | ❌ throw | ❌ throw |
| `files.list` | OK | OK | ❌ throw | ❌ throw |
| `files.delete` | OK | OK | ❌ throw | ❌ throw |
| `models.list` | OK | OK (custom HTTP) | OK (typically) | MAP |
| `test` | OK (uses `models.list`) | OK | OK | OK |
| `text.format: text` | OK | OK | OK | MAP |
| `text.format: json_object` | OK | OK | provider-dependent | MAP |
| `text.format: json_schema` | OK | OK | provider-dependent | MAP |
| `temperature` | OK | OK | OK | MAP |
| `max_output_tokens` | OK | OK | OK | MAP |

When the future `helix-error-model` change lands, the `❌ throw` cells will be replaced with structured `HelixError` of kind `UnsupportedFeature`. Until then, the raw `Error` is the contract.

For `text.format: json_object` and `json_schema` on Custom: spec phase will pin behavior — the adapter MUST throw a plain `Error` if the custom endpoint reports it doesn't understand the parameter, OR silently drop. RD-9 implies dropping by default. Spec authors decide.

---

## 9. Affected Modules

All paths under `src/`. Greenfield except for the previous change's stub interface files which are removed before the new ones land.

| Path | Action | Purpose |
|------|--------|---------|
| `src/adapters/openai/factory.ts` | DELETE | Replaced by internal router. |
| `src/adapters/azure/factory.ts` | DELETE | Replaced by internal router. |
| `src/adapters/custom/factory.ts` | DELETE | Replaced by internal router. |
| `src/adapters/vertex/factory.ts` | DELETE | Replaced by internal router. |
| `src/adapters/` | DELETE (whole tree) | Folder-per-adapter is overkill given the trimmed public surface. Replaced by flat internal files. |
| `src/core/types/error.ts` | DELETE | `HelixError` deferred to `helix-error-model`. |
| `src/core/types/tools.ts` | DELETE | Tools deferred to `helix-tools`. |
| `src/core/types/capabilities.ts` | DELETE | Capability runtime dropped (RD-9). |
| `src/core/ports/provider.port.ts` | DELETE | Replaced by `Helix` interface. |
| `src/core/ports/file-store.port.ts` | DELETE | Replaced by `helix.files` namespace methods. |
| `src/core/ports/` | DELETE (whole folder) | No public ports in the new surface. |
| `src/core/client.ts` | DELETE | `HelixClient` aggregate replaced by `Helix` interface in `src/createHelix.ts`. |
| `src/core/types/request.ts` | REPLACE | Trimmed to `ResponsesCreateParams`, `InputMessage`, `InputContentPart`, `HelixRole`, `HelixResponseFormat`, `InputText`, `InputFile`. |
| `src/core/types/response.ts` | REPLACE | Trimmed: `HelixResponse`, `HelixUsage`, `OutputItem` (only `OutputMessage`), `OutputTextPart`. |
| `src/core/index.ts` | REPLACE | Barrel reflecting new types only. |
| `src/index.ts` | REPLACE | Public exports reflecting new surface. |
| `src/core/types/config.ts` | ADD | `HelixConfig` discriminated union, `HelixProviderKind`, `VertexCredentials`. |
| `src/core/types/files.ts` | ADD | `FilesCreateParams`, `FileObject`. |
| `src/core/types/models.ts` | ADD | `ModelInfo`. |
| `src/createHelix.ts` | ADD | `Helix` interface + `createHelix(config)` factory signature (body delegates to internal routers). |
| `src/internal/providers/openai.ts` | ADD | Internal OpenAI adapter router (NOT exported from `src/index.ts`). |
| `src/internal/providers/azure.ts` | ADD | Internal Azure adapter router (NOT exported). |
| `src/internal/providers/custom.ts` | ADD | Internal Custom adapter router (NOT exported). |
| `src/internal/providers/vertex.ts` | ADD | Internal Vertex adapter router (NOT exported). |

The `src/internal/` boundary is a hard rule: nothing under `src/internal/` is exported from `src/index.ts`. Consumers cannot import from there.

---

## 10. Risks and Mitigations

| # | Risk | Likelihood | Mitigation |
|---|------|------------|------------|
| 1 | Discriminated union DX — TypeScript narrowing on `provider` field requires consumers to pass `as const` literals or explicit union members, possibly tripping autocomplete. | Med | Spec phase pins example invocations. The discriminant is the field name (`provider`), so TypeScript narrows on string literals automatically. Document the pattern in the README of a future infra-bootstrap change. |
| 2 | Vertex `responses.create` MAP complexity — Gemini `candidates[].content.parts[]` → OpenAI Responses `output[].message.content[].output_text` normalization is non-trivial, and stays the same risk as before. | High | Spec phase enumerates the MAP rules as testable scenarios. Vertex output is reduced by RD-6 to message-only, which simplifies (no function-call, no reasoning) but does not eliminate the MAP. Implementation phase ships per-mapping unit tests. |
| 3 | Errors raw passthrough is temporary technical debt. Consumers will write provider-specific catch handlers that break when `helix-error-model` ships. | High | This change emits a clear deprecation signal: every README example that touches errors says "errors are raw in v0; structured errors arrive in `helix-error-model`." Flagged loudly in the proposal Migration Note (§6) so consumers do not build on a moving target. |
| 4 | Scope creep — someone will want streaming, tools, reasoning output, or `topP` "while we're at it." | Med | Be firm: this change ships ONLY what is in §3 IN-scope. Anything else is a separate change with its own proposal. Defer politely. |
| 5 | `helix.test()` returning `boolean` swallows diagnostic info — caller cannot tell if it failed because of network, auth, missing model, etc. | Low | Documented as deliberate (RD-3). Caller reruns with logging on `false`, or upgrades to a future structured-error variant when `helix-error-model` ships. |
| 6 | Deleting per-provider folder structure (`src/adapters/<provider>/`) and replacing with `src/internal/providers/<provider>.ts` flat files might surprise contributors who expect folder-per-adapter. | Low | Documented in the §9 Affected Modules table. The folder structure can return non-breakingly if a provider grows internal complexity (e.g., adapter splits into `provider.ts`, `normalize.ts`, `client.ts`). |
| 7 | `OutputItem` reduced to only `{ type: "message" }` may surprise developers expecting the full Responses API output union. Function-call and refusal paths fail silently or with confusing errors. | Med | Documented at the type-doc level: `OutputItem` JSDoc explicitly states "v0 supports message output only; tool/refusal/reasoning return in `helix-tools` and `helix-error-model`." Spec phase pins the assertion. |

---

## 11. Rollback Plan

The previous change `helix-interface-definition` is archived (immutable). Rollback for THIS change is:

1. Delete `openspec/changes/helix-public-api-redesign/`.
2. Revert any source files created or modified under §9.
3. The archived v1 surface (`createOpenAI`, `createAzureOpenAI`, etc.) is the rollback target — it lives in `openspec/changes/archive/2026-04-27-helix-interface-definition/` for reference.

Because no consumer (axium-api, ocr-ai, others) is yet on helix-lib, rollback has zero migration cost. There is no production blast radius.

If after sdd-spec or sdd-design we conclude the SDK-mirror approach is wrong, we delete this change folder and start a fresh `/sdd-new` cycle. The archived v1 remains untouched.

---

## 12. Dependencies

- **None external.** The internal adapter routers (`src/internal/providers/*.ts`) MAY use the `openai` SDK and/or `@google-cloud/vertexai` at implementation time; this is out of scope for the proposal but flagged for sdd-design. `core/` remains zero-dep regardless (ADR-10 inherited).
- **No upstream change required.** This change supersedes `helix-interface-definition`; both are pre-implementation, so there is no live downstream consumer to coordinate with.

---

## 13. Success Criteria

- [ ] `src/index.ts` exports exactly the ~14 public types and the `createHelix` function — no more, no less.
- [ ] `createHelix({ provider: "openai", apiKey })` typechecks and returns a `Helix`.
- [ ] All four `HelixConfig` variants discriminate cleanly on `provider`.
- [ ] `helix.responses.create({ model, input })` typechecks with minimal params (no `instructions`, no `temperature`, no `text`).
- [ ] `helix.test()` typechecks and returns `Promise<boolean>`.
- [ ] `helix.files.{create,list,delete}` typecheck for all signatures.
- [ ] `helix.models.list()` typechecks and returns `Promise<ModelInfo[]>`.
- [ ] No public export references `HelixError`, `NativeTool`, `FunctionTool`, `ToolChoice`, `ProviderCapabilities`, `HelixThinking`, `InputFileEphemeral`, `RefusalPart`, `ReasoningOutput`, or `FunctionCallOutput`.
- [ ] `core/` has zero runtime dependencies (`package.json` `dependencies` empty for core paths).
- [ ] The five new capabilities (`client`, `responses`, `files`, `models`, `test`) each have a delta or new spec under `openspec/specs/`.
- [ ] The two obsolete specs (`errors`, `tools`) are marked for removal at archive.

---

## 14. Next Phase

`sdd-spec` and `sdd-design` may run in parallel.

- **sdd-spec** translates each new capability (`client`, `responses`, `files`, `models`, `test`) into Given/When/Then scenarios with RFC 2119 keywords. Targets per-provider mapping, structured-output behavior across `text.format` variants, and the `❌ throw` semantics for unsupported operations. Also writes the `core-types` delta and the removal markers for `errors` and `tools`.
- **sdd-design** documents architectural decisions: the new ADR-5 (unified `createHelix` factory), the discriminated-union DX choice, the `src/internal/providers/*.ts` flat-file convention, the namespace composition pattern (`responses`, `files`, `models`, `test` as plain object literals on the `Helix` instance), the raw-error passthrough as deliberate temporary tech debt, and any sequence diagrams worth capturing for the leaner surface (likely just one happy-path responses.create flow).

---

**End of proposal.**
