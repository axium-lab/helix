# Tasks: helix-lib Public API Redesign — SDK-Mirror Surface

**Change**: `helix-public-api-redesign`
**Phase**: 1 — interfaces only (no implementations, no HTTP, no provider SDK imports inside core)
**Acceptance**: each task is complete when `tsc --noEmit` passes with no type errors and no regressions

---

## Phase 1: Delete v1 artifacts

Remove all files from the archived `helix-interface-definition` change that conflict with the new surface. These MUST be deleted before any new file is created to avoid barrel import collisions.

- [x] 1.1 Delete `src/core/types/error.ts` — `HelixError`, `HelixErrorKind`, `HelixErrorInit` deferred to `helix-error-model`. `Implements: client/REQ-CLIENT-006`
- [x] 1.2 Delete `src/core/types/tools.ts` — `NativeTool`, `FunctionTool`, `ToolChoice`, `NativeToolName` deferred to `helix-tools`. `Implements: client/REQ-CLIENT-006`
- [x] 1.3 Delete `src/core/types/capabilities.ts` — `ProviderCapabilities`, capability runtime dropped (RD-9). `Implements: client/REQ-CLIENT-006`
- [x] 1.4 Delete `src/core/ports/provider.port.ts` — `HelixProvider` replaced by `Helix` interface. `Implements: client/REQ-CLIENT-004`
- [x] 1.5 Delete `src/core/ports/file-store.port.ts` — `HelixFileStore`, `UploadInput`, `FileRef` replaced by `helix.files` namespace. `Implements: files/REQ-FILES-001`
- [x] 1.6 Delete `src/core/ports/` directory (now empty after 1.4–1.5).
- [x] 1.7 Delete `src/core/client.ts` — `HelixClient` replaced by `Helix` interface. `Implements: client/REQ-CLIENT-004`
- [x] 1.8 Delete `src/adapters/openai/factory.ts` — per-provider factory removed (RD-2). `Implements: client/REQ-CLIENT-001`
- [x] 1.9 Delete `src/adapters/azure/factory.ts` — same as 1.8. `Implements: client/REQ-CLIENT-001`
- [x] 1.10 Delete `src/adapters/custom/factory.ts` — same as 1.8. `Implements: client/REQ-CLIENT-001`
- [x] 1.11 Delete `src/adapters/vertex/factory.ts` — same as 1.8. `Implements: client/REQ-CLIENT-001`
- [x] 1.12 Delete `src/adapters/` directory tree (now empty after 1.8–1.11).

---

## Phase 2: Core config types

Create `src/core/types/config.ts` with the provider config discriminated union. This is the first dependency of everything else.

- [x] 2.1 Create `src/core/types/config.ts` exporting `HelixProviderKind`, `VertexCredentials` (two-variant union: `{ clientEmail, privateKey }` or `{ keyFile }`), and `HelixConfig` (four-variant discriminated union keyed on `provider`). Zero runtime deps. `Implements: client/REQ-CLIENT-002, client/REQ-CLIENT-003, client/REQ-CLIENT-005`

---

## Phase 3: Core request and response types

Rewrite the two existing type files to the trimmed v2 surface. These depend on `config.ts` only indirectly — they are standalone.

- [x] 3.1 Rewrite `src/core/types/request.ts`: remove `InputFileEphemeral`, `HelixRequestOptions`, `HelixRequest`, tool imports; add `ResponsesCreateParams` (fields: `model`, `input`, `instructions?`, `temperature?`, `max_output_tokens?`, `text?: { format?: HelixResponseFormat }`); keep `HelixRole`, `InputText`, `InputFile`, `InputContentPart`, `InputMessage`, `HelixResponseFormat` unchanged in shape. `Implements: responses/REQ-RESP-002, responses/REQ-RESP-003, responses/REQ-RESP-004`
- [x] 3.2 Rewrite `src/core/types/response.ts`: remove `RefusalPart`, `OutputContentPart`, `FunctionCallOutput`, `ReasoningOutput`; keep `OutputTextPart`, `OutputMessage`, `HelixUsage`, `HelixResponse`; redefine `OutputItem = OutputMessage` (single-variant alias). Add JSDoc to `OutputItem` stating "v0 supports message output only". `Implements: responses/REQ-RESP-005, responses/REQ-RESP-006, responses/REQ-RESP-007`

---

## Phase 4: Core files and models types

Create the two new type files for file CRUD and model listing.

- [x] 4.1 Create `src/core/types/files.ts` exporting `FilesCreateParams` (fields: `file: Uint8Array | ArrayBuffer | Blob`, `purpose?: string`, `expires_after?: { anchor: "created_at"; seconds: number }`) and `FileObject` (fields: `id`, `object: "file"`, `bytes`, `created_at`, `filename?`, `purpose`, `expires_at?`). Zero runtime deps. `Implements: files/REQ-FILES-001, files/REQ-FILES-002`
- [x] 4.2 Create `src/core/types/models.ts` exporting `ModelInfo` (fields: `id`, `object: "model"`, `created`, `owned_by?`). Zero runtime deps. `Implements: models/REQ-MODELS-002`

---

## Phase 5: Core barrel

Rewrite `src/core/index.ts` to re-export only the new type surface. No runtime exports from this barrel.

- [x] 5.1 Rewrite `src/core/index.ts`: export from `./types/config.js`, `./types/request.js`, `./types/response.js`, `./types/files.js`, `./types/models.js`. Remove all references to deleted files (`error`, `tools`, `capabilities`, `ports/*`, `client`). `Implements: client/REQ-CLIENT-001, client/REQ-CLIENT-002, client/REQ-CLIENT-003`

---

## Phase 6: Helix interface and createHelix factory signature

Create `src/createHelix.ts` with the `Helix` interface and the `declare function createHelix` signature. No body implementation is required in this phase — stubs only.

- [x] 6.1 Create `src/createHelix.ts` exporting the `Helix` interface (namespaces `responses`, `files`, `models`, method `test`) and `declare function createHelix(config: HelixConfig): Helix`. The `Helix` interface shape MUST match exactly: `responses.create`, `files.create`, `files.list`, `files.delete`, `models.list`, `test()`. `Implements: client/REQ-CLIENT-001, client/REQ-CLIENT-004, responses/REQ-RESP-001, files/REQ-FILES-003, files/REQ-FILES-004, models/REQ-MODELS-001, test/REQ-TEST-001, test/REQ-TEST-002`

---

## Phase 7: Internal adapter stub modules

Create the four internal adapter files under `src/internal/providers/`. These are NOT exported from `src/index.ts`. In this interfaces-only phase, each file contains a stub that satisfies the type contract without any HTTP or SDK code.

- [x] 7.1 Create `src/internal/providers/openai.ts` — stub exporting a factory function (or internal helper) that returns an object satisfying the `Helix` namespace shape for the OpenAI provider. No actual SDK calls. `Implements: client/REQ-CLIENT-001 (routing path), files/REQ-FILES-005 (OpenAI: MUST support)`
- [x] 7.2 Create `src/internal/providers/azure.ts` — same structure as 7.1 for Azure. `Implements: client/REQ-CLIENT-001, files/REQ-FILES-005 (Azure: MUST support)`
- [x] 7.3 Create `src/internal/providers/custom.ts` — stub for the `custom` provider; file operations throw `new Error("helix-lib: 'files.create' not supported by provider 'custom'")` etc. at the stub level to encode the spec contract. `Implements: files/REQ-FILES-005 (Custom: MUST throw), client/REQ-CLIENT-001`
- [x] 7.4 Create `src/internal/providers/vertex.ts` — stub for Vertex; file operations throw with the correct message shape (e.g., `"helix-lib: 'files.list' not supported by provider 'vertex'"`). `Implements: files/REQ-FILES-005 (Vertex: MUST throw), client/REQ-CLIENT-001`

---

## Phase 8: Public barrel

Rewrite `src/index.ts` to expose exactly the ~14 public types and the `createHelix` runtime function. Nothing from `src/internal/` appears here.

- [x] 8.1 Rewrite `src/index.ts`: export `{ createHelix }` from `./createHelix.js`; `export type { Helix, HelixConfig, HelixProviderKind, VertexCredentials, ResponsesCreateParams, HelixResponse, HelixUsage, HelixResponseFormat, HelixRole, InputMessage, InputContentPart, InputText, InputFile, OutputItem, OutputMessage, OutputTextPart, FilesCreateParams, FileObject, ModelInfo }` from `./core/index.js`. Remove all references to v1 adapters and v1 types. `Implements: client/REQ-CLIENT-001, client/REQ-CLIENT-002, client/REQ-CLIENT-003, client/REQ-CLIENT-004, client/REQ-CLIENT-005, client/REQ-CLIENT-006`

---

## Phase 9: Type-check verification

Validate the complete surface via `tsc --noEmit`. This is the acceptance gate for an interfaces-only change (no test runner is installed).

- [x] 9.1 Run `tsc --noEmit` and confirm zero errors. If errors exist, fix in the relevant phase file before marking done.
- [x] 9.2 Confirm `src/index.ts` exports EXACTLY the types listed in Phase 8 — no more, no less. Verify no `HelixError`, `NativeTool`, `FunctionTool`, `ToolChoice`, `ProviderCapabilities`, `InputFileEphemeral`, `RefusalPart`, `ReasoningOutput`, `FunctionCallOutput`, `createOpenAI`, `createAzureOpenAI`, `createOpenAICompatible`, `createVertex` remain. `Implements: proposal §13 success criteria`
- [x] 9.3 Confirm `src/internal/` files are NOT referenced by `src/index.ts` — audit with `grep -r "internal" src/index.ts`. `Implements: client/REQ-CLIENT-004 (internal types not accessible), design §6.3`
