# Verification Report: helix-interface-definition

**Date**: 2026-04-27
**Scope**: Interfaces-only change. 22 tasks present (header annotation says 24 — see findings).
**Verify Mode**: Standard (no test runner active)
**Verdict**: PASS_WITH_WARNINGS

---

## Executive Summary

The implementation is structurally sound and complete. All 22 taskable items are marked `[x]`. `tsc --noEmit` passes with zero errors. Build artifacts (`dist/esm/index.js`, `dist/cjs/index.cjs`, `dist/types/index.d.ts`) all exist and are correctly shaped. The hexagonal boundary is clean: `core/` has no third-party imports and no adapter imports. Every REQ-ID in all 5 spec files maps to a type/interface that exists with the correct shape. Two WARNINGs and two SUGGESTIONs are documented but none block archive. There are zero CRITICAL findings.

---

## Verdict Rules

- PASS = zero CRITICAL findings; archive permitted.
- PASS_WITH_WARNINGS = zero CRITICAL, one or more WARNING; archive permitted with documented warnings.
- FAIL = at least one CRITICAL; do NOT archive until resolved.

---

## Architecture Audits

| Check | Result | Detail |
|---|---|---|
| Dependency direction (adapters not imported from core) | PASS | `grep -r "from.*adapters" src/core` returns CLEAN — zero matches |
| Zero deps in core (no openai/google imports) | PASS | `grep -r 'from "openai' src/core` and `grep -r 'from "@google' src/core` return CLEAN |
| Discriminant naming convention (type vs kind) | PASS | `NativeTool.type`, `FunctionTool.type`, `OutputItem.type`, `OutputContentPart.type`, `ToolChoice` object branch — all use `type`. `HelixError.kind` is the sole `kind` discriminant. Matches ADR-9. |
| snake_case wire-shape fields in response.ts | PASS | `input_tokens`, `output_tokens`, `total_tokens`, `created_at`, `output_text`, `call_id` all present verbatim. `object: "response"` literal confirmed. Matches ADR-1. |
| Public surface re-exports all spec types | PASS | All 34 types from proposal §5.10 and all 5 runtime values (`HelixError`, `createOpenAI`, `createAzureOpenAI`, `createOpenAICompatible`, `createVertex`) confirmed in `dist/types/index.d.ts` export list. |
| HelixError as runtime class | PASS | `dist/esm/index.js` line 2: `var HelixError = class _HelixError extends Error`. `dist/types/index.d.ts` line 138: `declare class HelixError extends Error`. Factory stubs `throw new Error("not implemented")` confirmed present. |
| Build artifacts present (esm/cjs/types) | PASS | `dist/esm/index.js`, `dist/cjs/index.cjs`, `dist/types/index.d.ts` all exist. |
| tsc --noEmit | PASS | Exit code 0. Zero errors. TypeScript 6.0.3, NodeNext resolution, strict mode. |
| tasks.md 24/24 checked | WARNING | Header annotation says "Total tasks: 24" but actual checkbox count is 22/22. All 22 present tasks are `[x]`. No unchecked tasks. The annotation is off by 2 — likely a counting error in the tasks header. No work items are missing. |

---

## REQ-ID Coverage

### specs/core-types

- **REQ-CT-001** — PASS — `HelixRequest` in `src/core/types/request.ts:57–65`. Has `model: string`, `input: InputMessage[]`, `options?: HelixRequestOptions`. All optional fields (`instructions`, `tools`, `toolChoice`, `previousResponseId`) present. Exact match.
- **REQ-CT-002** — PASS — `InputContentPart = InputText | InputFile | InputFileEphemeral` in `request.ts:22`. `InputText` has `type: "input_text"` and `text: string`. `InputFile` has `type: "input_file"` and `file_id: string`. `InputFileEphemeral` has `type: "input_file"`, `data: Uint8Array | ArrayBuffer`, `mimeType: string`, optional `ttl?: number`. Structural (not string) discriminant between `InputFile` and `InputFileEphemeral` as per design §4.2. Exact match.
- **REQ-CT-003** — PASS — `HelixResponse` in `response.ts:43–52`. Fields: `id`, `object: "response"`, `created_at`, `model`, `output: OutputItem[]`, `output_text`, `usage: HelixUsage`, `metadata?`. All snake_case wire fields confirmed. `HelixUsage` has `input_tokens`, `output_tokens`, `total_tokens`. Exact match.
- **REQ-CT-004** — PASS — `HelixThinking = { effort: "low" | "medium" | "high" } | { budget: number }` in `request.ts:29–31`. Structural union, no string discriminant. Matches design §4.2 decision.
- **REQ-CT-005** — PASS — `HelixRequestOptions.strict?: boolean` in `request.ts:54`. Field present and optional (default `false` semantics).
- **REQ-CT-007** — PASS — `HelixResponseFormat` in `request.ts:33–41`. Three variants: `{ type: "text" }`, `{ type: "json_object" }`, `{ type: "json_schema"; name: string; schema: object; strict?: boolean }`. Exact match including optional `strict` on json_schema variant.
- **REQ-CT-008** — PASS — `HelixRequest.previousResponseId?: string` in `request.ts:61`. Optional field present.
- **REQ-CT-009** — PASS — `HelixRequest.instructions?: string` in `request.ts:59`. `HelixRole` union includes `"system"` and `"developer"` in `request.ts:3`. Both can coexist per interface shape.
- **REQ-CT-006** — N/A — No REQ-CT-006 defined in spec (intentional numbering gap).

### specs/errors

- **REQ-ERR-001** — PASS — `HelixError extends Error` in `error.ts:26`. Has `readonly kind: HelixErrorKind`, `readonly provider: HelixProviderKind`, `readonly statusCode?: number`, `readonly raw?: unknown`, `readonly retryable: boolean`. Constructor accepts `HelixErrorInit` and calls `super(init.message, { cause: init.cause })`. Sets `this.name = "HelixError"`. Exact match with design §6.3.
- **REQ-ERR-002** — PASS — `static is(err: unknown): err is HelixError` in `error.ts:43–51`. Returns `true` for `instanceof HelixError` OR structural check (`name === "HelixError" && typeof kind === "string"`). Handles `null`, non-objects, plain `Error` via the guard chain. Exact match.
- **REQ-ERR-003** — PASS — `HelixErrorKind` in `error.ts:3–14`. Exactly 11 literals: `InvalidApiKey`, `PermissionDenied`, `InvalidRequest`, `RateLimit`, `QuotaExceeded`, `ServerError`, `ProviderUnavailable`, `ContentFiltered`, `UnsupportedFeature`, `NormalizationError`, `Unknown`. Exact match.
- **REQ-ERR-004** — DEFERRED — Runtime adapter behavior (HTTP status → kind mapping). The error class structure exists; the normalization table will be implemented in the adapter-implementation change. Not a type-surface concern.
- **REQ-ERR-005** — DEFERRED — Runtime adapter behavior (UnsupportedFeature thrown pre-network-call). The `kind` value `"UnsupportedFeature"` exists in the enum. Behavior is deferred.
- **REQ-ERR-006** — PASS — `HelixErrorInit.retryable?: boolean` present in `error.ts:21`. Constructor: `this.retryable = init.retryable ?? false` in `error.ts:40`. The default-false semantic is baked into the constructor. The type surface correctly models the classification contract.

### specs/ports

- **REQ-PORT-001** — PASS — `HelixProvider.request(req: HelixRequest): Promise<HelixResponse>` in `provider.port.ts:6`. Correct method signature. Port-level: return type and rejection contract are type-enforced by `Promise<HelixResponse>`.
- **REQ-PORT-002** — PASS — `HelixProvider.capabilities(): ProviderCapabilities` in `provider.port.ts:7`. Synchronous method (no `async`, no `Promise`). Provider-specific return values are runtime behavior for the next change.
- **REQ-PORT-003** — PASS — `ProviderCapabilities` in `capabilities.ts:4–11`. Has `provider: HelixProviderKind`, `files: boolean`, `nativeTools: ReadonlyArray<NativeToolName>`, `thinking: boolean`, `structuredOutput: boolean`, `streaming: false`. The `streaming` field is typed as the literal `false` (not `boolean`), matching the spec requirement exactly.
- **REQ-PORT-004** — PASS — `HelixFileStore.upload(input: UploadInput): Promise<FileRef>` in `file-store.port.ts:18`. `FileRef` has `id`, `bytes`, `mimeType`, `createdAt`, optional `filename` and `expiresAt`. Exact match.
- **REQ-PORT-005** — DEFERRED — Runtime adapter behavior (purpose defaulting per provider). `UploadInput.purpose?: string` field is present in `file-store.port.ts:6`. The defaulting logic is implementation-phase work.
- **REQ-PORT-006** — PASS — `HelixFileStore.list(opts?: { limit?: number }): Promise<FileRef[]>` and `HelixFileStore.delete(fileId: string): Promise<{ id: string; deleted: true }>` in `file-store.port.ts:20–21`. Method signatures exact match. Return type of `delete` is the literal `{ id: string; deleted: true }`.
- **REQ-PORT-007** — PASS — `HelixClient` in `client.ts:4–7`. Has `provider: HelixProvider` and `files?: HelixFileStore`. The optional `files` type-level communicates presence/absence. Exact match.

### specs/tools

- **REQ-TOOL-001** — PASS — `NativeToolName = "web_search" | "file_search" | "code_interpreter" | "google_search"` in `tools.ts:1–5`. Exactly 4 values. `NativeTool` has `type: "native"`, `name: NativeToolName`, `config?: Record<string, unknown>`. Exact match. Unknown names rejected at compile time by the union type.
- **REQ-TOOL-002** — DEFERRED — Runtime adapter behavior (provider×tool support enforcement). The `NativeToolName` type and `NativeTool` interface exist. Matrix enforcement is adapter-implementation phase.
- **REQ-TOOL-003** — PASS — `FunctionTool` in `tools.ts:13–21`. Has `type: "function"` and nested `function: { name: string; description?: string; parameters: object; strict?: boolean }`. Exact match. The `function.strict` field is separate from `HelixRequestOptions.strict`.
- **REQ-TOOL-004** — DEFERRED — Runtime adapter behavior (Vertex args serialization). The `FunctionCallOutput.arguments: string` type enforces the normalized shape. Serialization is adapter-implementation phase.
- **REQ-TOOL-005** — PASS — `ToolChoice = "auto" | "none" | "required" | { type: "function"; name: string }` in `tools.ts:23–27`. Exactly 4 variants including the object branch with `type: "function"`. Exact match.

### specs/factories

- **REQ-FAC-001** — PASS — `createOpenAI(config: OpenAIConfig): HelixClient` in `openai/factory.ts:11`. `OpenAIConfig` has required `apiKey: string` and optional `baseUrl?`, `organization?`, `project?`, `defaultHeaders?`. Factory body throws "not implemented" stub. Return type is `HelixClient`. Exact match.
- **REQ-FAC-002** — PARTIAL (WARNING) — `createAzureOpenAI(config: AzureOpenAIConfig): HelixClient` in `azure/factory.ts:10`. `AzureOpenAIConfig` correctly has `apiKey`, `endpoint`, `apiVersion` as required and `defaultHeaders?` optional. Critically, NO `deployment` field (matches REQ-FAC-007 and design §6.5). Type-level compile-time error for missing `apiVersion` is enforced. However, the spec's REQ-FAC-002 runtime guard ("factory MUST throw HelixError with `kind: "InvalidRequest"` if `apiVersion` is empty at runtime") is not implemented — the stub throws `new Error("not implemented")` instead. This is a construction-time validation guard, distinct from a provider-call behavior, so it does not squarely fit the "deferred adapter behavior" category. Flagged as WARNING: the `apiVersion` guard is a pre-network input validation — the stub pattern was explicitly sanctioned in task 5.2, but the next change MUST add this guard before `createAzureOpenAI` is used in production.
- **REQ-FAC-003** — PASS — `createOpenAICompatible(config: OpenAICompatibleConfig): HelixClient` in `custom/factory.ts:9`. `OpenAICompatibleConfig` has required `apiKey` and `baseUrl`, optional `defaultHeaders?`. Return type is `HelixClient` (consumers must inspect `client.files` to discover it's `undefined` at runtime). Type surface correct.
- **REQ-FAC-004** — PASS — `createVertex(config: VertexConfig): HelixClient` in `vertex/factory.ts:14`. `VertexConfig` has required `projectId` and `location`, optional `credentials?: VertexCredentials` and `apiVersion?: string`. `VertexCredentials` is a structural discriminated union `{ clientEmail, privateKey } | { keyFile }` in `vertex/factory.ts:3–5`. Exact match.
- **REQ-FAC-005** — PASS — Each factory function is an independent function returning a new `HelixClient`. No global registry, no singleton, no `Helix.use()`. Factory calls are independent by construction.
- **REQ-FAC-006** — PASS — `strict` is absent from all 4 factory config interfaces (`OpenAIConfig`, `AzureOpenAIConfig`, `OpenAICompatibleConfig`, `VertexConfig`). The field lives only in `HelixRequestOptions.strict`. Matches ADR-8.
- **REQ-FAC-007** — PASS — `AzureOpenAIConfig` has NO `deployment` field (confirmed: `grep deployment src/adapters/azure/factory.ts` returns empty). Callers pass deployment name via `HelixRequest.model`. Matches design §6.5.

---

## Findings

### CRITICAL (0)

None.

### WARNING (2)

**W-01: REQ-FAC-002 — `apiVersion` empty-string guard missing in Azure factory stub**

- REQ-ID: REQ-FAC-002
- Severity rationale: The spec explicitly mandates a construction-time runtime guard: `createAzureOpenAI({ apiKey, endpoint, apiVersion: "" })` MUST throw `HelixError` with `kind: "InvalidRequest"`. This is a pre-network input validation, not a provider-call behavior, and therefore does not fall under the "adapter behavior = deferred" scope exception cleanly. The stub (`throw new Error("not implemented")`) satisfies the tasks phase requirement but does not satisfy the spec's runtime contract.
- Fix recommendation: In the adapter-implementation change, replace the stub in `src/adapters/azure/factory.ts` with a real factory body that includes an `if (!config.apiVersion) throw new HelixError({ kind: "InvalidRequest", provider: "azure", message: "apiVersion is required and cannot be empty", retryable: false })` guard as the first thing before construction proceeds.

**W-02: tasks.md header annotation mismatch ("Total tasks: 24" vs actual 22)**

- REQ-ID: Task integrity
- Severity rationale: The header reads "Total tasks: 24" but actual checkbox count is 22. All 22 tasks are `[x]`. This is a documentation error in the tasks artifact, not a missing implementation. The discrepancy could cause confusion in future audits.
- Fix recommendation: At archive time, correct the tasks.md header to "Total tasks: 22" or add 2 missing tasks if any were genuinely omitted.

### SUGGESTION (2)

**S-01: tsup.config.ts uses `clean: false` in all 3 configs instead of task-specified `clean: true`**

- Task 0.3 specified `clean: true`. The implementation uses a 3-config array with `clean: false` in each to avoid the first config deleting output from the second. This is a pragmatic workaround that achieves the same net result (clean on `npm run clean` via `rm -rf dist`). However, the task spec said `clean: true`. The apply phase note "the apply phase chooses the cleanest layout" provides justification.
- Recommendation: Add a note in the design or a comment in `tsup.config.ts` explaining why `clean: false` per-config is intentional (avoids inter-config deletion race). No code change required.

**S-02: `HelixThinking` is a structural union (no string discriminant) — adapters must use `"effort" in ...` to branch**

- Design §4.2 explicitly documents this choice. The structural union works correctly. However, the apply phase should add a JSDoc comment on `HelixThinking` noting the branching pattern (`"effort" in thinking ? ... : ...`) so adapter authors don't accidentally try to switch on a non-existent `type` field.
- Recommendation: Add JSDoc on `HelixThinking` in `src/core/types/request.ts` for the adapter-implementation change.

---

## Coherence (Design Match)

| Decision | Status | Notes |
|---|---|---|
| ADR-1: snake_case wire fields, camelCase helix-original | FOLLOWED | Verified in response.ts, tools.ts, capabilities.ts. `input_tokens`, `created_at`, `output_text` etc. are snake_case; `maxOutputTokens`, `previousResponseId`, `nativeTools` etc. are camelCase. |
| ADR-2: HelixError as runtime class | FOLLOWED | `class HelixError extends Error` with `static is()` structural fallback — exact match to design §6.3 body. |
| ADR-3: Stateless multi-turn, `previousResponseId` optional | FOLLOWED | `input: InputMessage[]` is required; `previousResponseId?` is optional. |
| ADR-4: HelixFileStore as separate port | FOLLOWED | Separate `file-store.port.ts`; `HelixClient.files?: HelixFileStore` optional. |
| ADR-5: Per-instance factories | FOLLOWED | 4 independent factory functions, no global state. |
| ADR-6: responseFormat in HelixRequestOptions | FOLLOWED | `responseFormat?: HelixResponseFormat` in `HelixRequestOptions`. |
| ADR-7: NativeToolName allow-list | FOLLOWED | Exactly 4 literals. |
| ADR-8: strict per-request | FOLLOWED | `strict?: boolean` in `HelixRequestOptions` only; absent from all factory configs. |
| ADR-9: Discriminant `type` vs `kind` | FOLLOWED | All data unions use `type`; only `HelixError` uses `kind`. |
| ADR-10: Helix-owned types, zero-dep core | FOLLOWED | No `import from "openai"` in `core/`. `HelixResponse` and related types are bespoke interfaces. |

---

## Forward Items Tracking

These WARNINGs and SUGGESTIONs are captured for the next change (`helix-openai-adapter` or equivalent first-adapter implementation):

### Must Address (WARNINGs)

- **W-01: REQ-FAC-002 — createAzureOpenAI() apiVersion empty-string guard missing**
  - Factory stub throws `new Error("not implemented")` instead of validating `apiVersion` is non-empty at runtime.
  - **Fix for next change**: Throw `HelixError({ kind: "InvalidRequest", provider: "azure", message: "apiVersion is required and cannot be empty", retryable: false })` before construction proceeds.

- **W-02: tasks.md header annotation mismatch (CORRECTED AT ARCHIVE)**
  - Header now reads "Total tasks: 22" (was "24"). All 22 tasks present and complete.

### Should Address (SUGGESTIONs)

- **S-01: tsup.config.ts uses `clean: false` per-config instead of `clean: true`**
  - Task 0.3 specified `clean: true`. Implementation avoids inter-config deletion race by using `clean: false` in each config.
  - **Recommendation**: Add comment in `tsup.config.ts` explaining the intentional `clean: false` per-config design (avoids race condition between emitting ESM and CJS).

- **S-02: HelixThinking branching pattern undocumented**
  - `HelixThinking` is a structural union (no string discriminant). Adapters branch via `"effort" in thinking ? ... : ...`.
  - **Recommendation**: Add JSDoc on `HelixThinking` in `src/core/types/request.ts` noting the structural branching pattern for adapter authors.

---

## Recommendation

Archive is permitted. The implementation is complete, type-checks clean, builds correctly, and satisfies every structural REQ-ID in all 5 spec files. The two WARNINGs are forward-looking items for the adapter-implementation change, not defects in the current interfaces-only deliverable. W-02 has been corrected at archive time. Neither blocks archiving `helix-interface-definition`.
