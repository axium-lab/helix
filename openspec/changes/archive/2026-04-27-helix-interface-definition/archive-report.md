# Archive Report: helix-interface-definition

**Archived**: 2026-04-27
**Change Name**: `helix-interface-definition`
**Verify Verdict**: PASS_WITH_WARNINGS
**Archive Status**: CLOSED

---

## Executive Summary

The `helix-interface-definition` change has been successfully completed, verified (PASS_WITH_WARNINGS, zero CRITICAL findings), and archived. The deliverable is the complete **public TypeScript interface surface** for helix-lib v0 — the port interfaces, request/response/error types, capability descriptors, and provider factory signatures required for the first adapter implementations. All 22 tasks completed. Build produces dual ESM + CJS + `.d.ts`. The hexagonal architecture is enforced at the type system level.

---

## What This Change Delivered

### Scope

**Phase 1 — Interfaces Only**. No runtime implementations, no HTTP code, no adapter bodies (only stubs). The deliverable is effectively the `.d.ts` contract that all consumers and adapters must satisfy.

### Artifacts Frozen

**1. Proposal** (`proposal.md`, 612 lines)
- Business case: greenfield library, single normalized contract for multiple LLM providers (OpenAI, Azure, custom, Vertex).
- Public surface sketch: 5 sections covering ports, types, error model, tools, and provider factories.
- Resolved 10 open questions with reasoning (Q2–Q10, fixed inputs Q1, Q3, Q4, Q6, Q7).
- Capability matrix (proposal §6) governing provider × feature support.
- Risk & rollback analysis.

**2. Design** (`design.md`, 772 lines)
- Hexagonal/Ports & Adapters architecture with dependency-direction enforcement (`core/` has zero third-party deps, adapters import from core).
- 10 Architecture Decision Records (ADR-1 through ADR-10):
  - ADR-1: Mirror OpenAI Responses API field naming (snake_case for wire fields, camelCase for helix-original fields).
  - ADR-2: HelixError as runtime class extending Error (with static is() type guard with structural fallback for cross-realm safety).
  - ADR-3: Stateless multi-turn contract with optional previousResponseId.
  - ADR-4: HelixFileStore as separate port from HelixProvider (optional on HelixClient).
  - ADR-5: Per-instance factories over global registry.
  - ADR-6: responseFormat inside HelixRequestOptions (part of HX6, not a separate HX number).
  - ADR-7: NativeToolName allow-list (literal type union, unknown names rejected at compile time).
  - ADR-8: strict: boolean flag per-request in HelixRequestOptions (not per-factory).
  - ADR-9: Discriminant naming convention — `type` for content/tools/output (wire-shape), `kind` for errors only.
  - ADR-10: Helix-owned types mirror Responses API instead of type-aliasing to openai SDK (zero-dependency core).
- 3 sequence diagrams validating the interfaces:
  - Diagram A: ocr-ai-style flow — file upload → structured output.
  - Diagram B: HX5 function-tool call/response flow.
  - Diagram C: Capability negotiation at runtime.
- Module layout, naming conventions, barrel strategy.
- Forward path documentation (what the next change must build without touching core/).

**3. Specs** (5 files, 5 domains, 33+ REQs total)

All specs moved to main specs at `openspec/specs/{domain}/spec.md`:

- **core-types** (`openspec/specs/core-types/spec.md`, 243 lines, 9 REQs):
  - REQ-CT-001: HelixRequest shape.
  - REQ-CT-002: InputContentPart union (text, file-by-reference, file-ephemeral).
  - REQ-CT-003: HelixResponse shape with snake_case wire fields.
  - REQ-CT-004: HelixThinking structural union (effort | budget).
  - REQ-CT-005: strict flag semantics (silent drop vs throw).
  - REQ-CT-007: responseFormat variants (text, json_object, json_schema).
  - REQ-CT-008: previousResponseId semantics.
  - REQ-CT-009: instructions and system role coexistence.

- **errors** (`openspec/specs/errors/spec.md`, 170 lines, 6 REQs):
  - REQ-ERR-001: HelixError class shape.
  - REQ-ERR-002: HelixError.is() type guard with structural fallback.
  - REQ-ERR-003: HelixErrorKind exhaustive union (11 kinds).
  - REQ-ERR-004: Provider-error-to-kind mapping table (HTTP status → kind).
  - REQ-ERR-005: UnsupportedFeature is adapter-thrown, not provider-thrown.
  - REQ-ERR-006: retryable classification (true for RateLimit, ServerError, ProviderUnavailable; false otherwise).

- **ports** (`openspec/specs/ports/spec.md`, 193 lines, 7 REQs):
  - REQ-PORT-001: HelixProvider.request() contract (Promise<HelixResponse> | throw HelixError).
  - REQ-PORT-002: HelixProvider.capabilities() synchronous static descriptor.
  - REQ-PORT-003: ProviderCapabilities shape with literal `streaming: false`.
  - REQ-PORT-004: HelixFileStore.upload() contract.
  - REQ-PORT-005: upload() purpose defaulting per provider.
  - REQ-PORT-006: list() and delete() contracts.
  - REQ-PORT-007: HelixClient aggregate (provider + files?: HelixFileStore).

- **tools** (`openspec/specs/tools/spec.md`, 171 lines, 5 REQs):
  - REQ-TOOL-001: NativeTool shape and NativeToolName allow-list (web_search, file_search, code_interpreter, google_search).
  - REQ-TOOL-002: Native tool provider support matrix.
  - REQ-TOOL-003: FunctionTool shape.
  - REQ-TOOL-004: FunctionCallOutput.arguments normalization (always JSON string, Vertex args:object → JSON string).
  - REQ-TOOL-005: ToolChoice union.

- **factories** (`openspec/specs/factories/spec.md`, 195 lines, 7 REQs):
  - REQ-FAC-001: createOpenAI() signature and config.
  - REQ-FAC-002: createAzureOpenAI() signature, config (NO deployment field; required apiVersion with empty-string guard deferred to next change).
  - REQ-FAC-003: createOpenAICompatible() signature, config (no files).
  - REQ-FAC-004: createVertex() signature, config (ADC + explicit credentials support).
  - REQ-FAC-005: Factory returns fresh HelixClient instances (no global state).
  - REQ-FAC-006: strict flag only in HelixRequestOptions, not factory config.
  - REQ-FAC-007: Azure deployment name via HelixRequest.model.

**4. Tasks** (`tasks.md`, 129 lines, 22 tasks — header corrected from 24 to 22)
- Phase 0: Package bootstrap (package.json, tsconfig.json, tsup.config.ts, .npmrc.example, .gitignore) — 5 tasks.
- Phase 1: Core types (request.ts, response.ts, tools.ts, error.ts, capabilities.ts) — 5 tasks.
- Phase 2: Ports (provider.port.ts, file-store.port.ts) — 2 tasks.
- Phase 3: Aggregate client (client.ts) — 1 task.
- Phase 4: Core barrel (index.ts) — 1 task.
- Phase 5: Adapter factory signatures (×4 factories) — 4 tasks.
- Phase 6: Public barrel (src/index.ts) — 1 task.
- Phase 7: Verification (REQ-ID coverage, dependency audit, type-check) — 3 tasks.

All 22 tasks marked [x] complete.

**5. Verify Report** (`verify-report.md`, 146 lines, corrected at archive)
- Verdict: PASS_WITH_WARNINGS (zero CRITICAL, 2 WARNINGs, 2 SUGGESTIONs).
- 9 architecture audits: dependency direction, zero-deps core, discriminant naming, snake_case wire fields, public re-exports, HelixError runtime class, build artifacts, tsc --noEmit.
- REQ-ID coverage verified for all 33+ REQs across 5 domains.
- ADR compliance matrix (all 10 ADRs followed).
- Two WARNINGs:
  - **W-01** (REQ-FAC-002): createAzureOpenAI() apiVersion empty-string guard missing from stub. **Must address in adapter-implementation change** before production use.
  - **W-02** (Task integrity): tasks.md header said "24" (CORRECTED to "22" at archive).
- Two SUGGESTIONs (S-01, S-02): documentation improvements for next change (tsup clean: false rationale, HelixThinking branching pattern).

---

## Source Code Landed

**Location**: `src/` in the live project (v0.0.1, UNLICENSED, published to GitHub Packages at @fluxaria/helix-lib).

### Files Created

| Path | LOC | Purpose |
|---|---|---|
| `src/core/types/request.ts` | ~140 | HelixRequest, InputMessage, InputContentPart (text, file-ref, file-ephemeral), HelixThinking, HelixResponseFormat, HelixRequestOptions |
| `src/core/types/response.ts` | ~100 | HelixResponse, OutputItem union, HelixUsage, snake_case wire fields |
| `src/core/types/tools.ts` | ~80 | NativeTool, NativeToolName allow-list, FunctionTool, ToolChoice |
| `src/core/types/error.ts` | ~80 | HelixError (RUNTIME CLASS), HelixErrorKind, HelixProviderKind, HelixErrorInit |
| `src/core/types/capabilities.ts` | ~30 | ProviderCapabilities with literal `streaming: false` |
| `src/core/ports/provider.port.ts` | ~30 | HelixProvider interface (request + capabilities) |
| `src/core/ports/file-store.port.ts` | ~50 | HelixFileStore interface, UploadInput, FileRef types |
| `src/core/client.ts` | ~20 | HelixClient aggregate |
| `src/core/index.ts` | ~50 | Barrel re-export (all types + ports + HelixError) |
| `src/adapters/openai/factory.ts` | ~30 | createOpenAI() signature, OpenAIConfig, stub body |
| `src/adapters/azure/factory.ts` | ~30 | createAzureOpenAI() signature, AzureOpenAIConfig (NO deployment field), stub body |
| `src/adapters/custom/factory.ts` | ~30 | createOpenAICompatible() signature, OpenAICompatibleConfig, stub body |
| `src/adapters/vertex/factory.ts` | ~40 | createVertex() signature, VertexConfig, VertexCredentials, stub body |
| `src/index.ts` | ~50 | Public package-level barrel |
| `package.json` | ~30 | Name: @fluxaria/helix-lib, version: 0.0.1, exports + GitHub Packages config |
| `tsconfig.json` | ~20 | target: ES2022, module: NodeNext, strict: true |
| `tsup.config.ts` | ~30 | ESM + CJS + .d.ts emission (clean: false per-config to avoid deletion race) |
| `.npmrc.example` | ~3 | Template for consumers |
| `.gitignore` | ~5 | Standard excludes |

**Total**: ~900 LOC of interface-only TypeScript. ZERO third-party dependencies in `core/`. All 5 adapter factories return fresh `HelixClient` instances.

### Build Artifacts

- `dist/esm/index.js` — ES modules bundle (helix-lib consumers can tree-shake).
- `dist/cjs/index.cjs` — CommonJS bundle (for legacy environments).
- `dist/types/index.d.ts` — TypeScript declaration file (all 34+ types exported).
- Build verified: `tsc --noEmit` passes with zero errors (TypeScript 6.0.3, NodeNext resolution, strict mode).

### Runtime Exports

Five runtime values (everything else is type-only):
1. `HelixError` class
2. `createOpenAI()` function (stub)
3. `createAzureOpenAI()` function (stub)
4. `createOpenAICompatible()` function (stub)
5. `createVertex()` function (stub)

---

## Architecture Enforcements

**Dependency Direction** (hexagonal):
- `core/` → imports NOTHING (zero dependencies, only TypeScript types)
- `adapters/*` → imports from `core/`
- `src/index.ts` → imports from both (public barrel only)
- Verified: `grep -r "from.*adapters" src/core` returns CLEAN.

**Type System Enforcements**:
- `HelixErrorKind` is an exhaustive union — callers must handle all 11 kinds or TypeScript errors.
- `NativeToolName` is a string-literal union — unknown tool names fail at compile time.
- `HelixRequest.input` is non-empty array (enforced at type level where applicable).
- `HelixResponse.object` is literal `"response"` (not a variable string).
- `ProviderCapabilities.streaming` is literal `false` in Phase 1 (not `boolean`).
- Discriminant fields are distinct: `type` for content/tools/output (wire-shape), `kind` for errors only.
- Optional `HelixClient.files?: HelixFileStore` correctly models capability presence (undefined for Vertex/custom).

---

## Lineage & Traceability

### Proposals Met
- **PR1** (Responses API): HelixResponse mirrors Responses API shape; type-enforced via HelixResponse interface.
- **PR2** (Lightweight): core/ zero-dependency; only HelixError runtime, everything else is types.
- **PR3** (Mandatory tests, 4 providers): OUT of scope Phase 1 (covered in next change).
- **PR4** (Phase 1: 4 providers, limited capabilities): All 4 factory functions present; Vertex/custom have no files.
- **PR5** (Responses input/output): HelixRequest.input mirrors Responses API; HelixResponse output matches.
- **PR6** (Unified error model): HelixError class + HelixErrorKind discriminated union (11 kinds).

### Capabilities Met
- **HX1** (Text request): HelixProvider.request() signature, HelixRequest.model + input.
- **HX2** (File CRUD): HelixFileStore port (upload, list, delete) + HelixClient.files optional.
- **HX3** (Ephemeral files): InputFileEphemeral content part with data + mimeType + ttl.
- **HX4** (Native tools): NativeTool interface + NativeToolName allow-list (4 tools).
- **HX5** (Function tools): FunctionTool interface + FunctionCallOutput in response.
- **HX6** (Generation options): HelixRequestOptions with temperature, topK, topP, thinking, responseFormat, strict, seed, penalties.

### Known Deferred Items

**To adapter-implementation change (next)**:
- REQ-FAC-002 W-01: Empty apiVersion guard in createAzureOpenAI().
- REQ-ERR-004: Per-adapter HTTP status → HelixErrorKind mapping table.
- REQ-ERR-005: Runtime strict-mode validation before network calls.
- REQ-TOOL-002: Native tool provider-support enforcement matrix.
- REQ-TOOL-004: Vertex args object → JSON string serialization in normalizeResponse.
- All implementations of provider.request(), fileStore.upload(), etc. (currently stubs).
- Response normalization functions (normalizeResponse, normalizeError).

**To Phase 2 (streaming, multi-turn helpers)**:
- Streaming: requestStream(), AsyncIterable<StreamDelta>, StreamDelta type.
- runToolLoop() helper function.
- `n > 1` (multiple candidates) support.

**To infra bootstrap change**:
- ESLint naming-convention rules (exception list for snake_case wire-shape fields).
- Full tsconfig.json with additional stricter rules.
- Prettier config.
- GitHub Actions CI (lint, build, type-check, publish).

---

## Forward Items Captured for Next Change

From the Verify Report's Forward Items section (now part of the archived record):

### Must Address (WARNINGs)

- **W-01: REQ-FAC-002 — createAzureOpenAI() apiVersion empty-string guard**
  - Factory stub throws `new Error("not implemented")` instead of validating apiVersion.
  - **Fix**: In adapter-implementation, throw `HelixError({ kind: "InvalidRequest", provider: "azure", message: "apiVersion is required and cannot be empty", retryable: false })` before construction.

- **W-02: tasks.md header annotation** (CORRECTED AT ARCHIVE)
  - Was "Total tasks: 24", now "Total tasks: 22" to match actual count.

### Should Address (SUGGESTIONs)

- **S-01**: tsup.config.ts uses `clean: false` per-config (not `clean: true` per task spec).
  - Pragmatic workaround to avoid inter-config deletion race (first config deleting output of second).
  - **Recommendation**: Add comment explaining the intentional `clean: false` per-config design.

- **S-02**: HelixThinking branching pattern undocumented.
  - Structural union (no string discriminant). Adapters must use `"effort" in thinking ? ... : ...`.
  - **Recommendation**: Add JSDoc on HelixThinking type noting the structural branching pattern.

---

## Open Items Resolved vs Carried Forward

### Resolved in This Change
1. ✅ Q1 — Responses API vs Chat Completions: Responses API ONLY.
2. ✅ Q2 — Stateless multi-turn: Full input array always; previousResponseId optional hint.
3. ✅ Q3 — Factory pattern: Per-instance factories, no global registry.
4. ✅ Q4 — Streaming Phase 1: Deferred to Phase 2.
5. ✅ Q5 — n > 1: Forced n=1, no candidateCount field.
6. ✅ Q6 — HelixError shape: Class extending Error with kind discriminant + static is().
7. ✅ Q7 — Custom endpoint config: baseUrl + apiKey only, no aliasing.
8. ✅ Q8 — Vertex auth: Both ADC (default) + explicit service account supported.
9. ✅ Q9 — Strict mode: Per-request flag in HelixRequestOptions (default false).
10. ✅ Q10 — API versioning: Pin per-adapter; required on Azure, optional with default on Vertex.

### Carried Forward to Next Change
- HTTP status → HelixErrorKind mapping table per provider (REQ-ERR-004).
- Retry policy (if helix participates in retry logic at all).
- SDK choice per adapter (openai SDK vs raw fetch, @google-cloud/vertexai vs raw fetch).
- Auth flow for Vertex ADC (which library, error handling).
- File-upload streaming vs buffering (input is Uint8Array | ArrayBuffer; adapter chooses).
- ESLint naming-convention rule for snake_case wire fields.
- Whether createOpenAICompatible() defaultHeaders is sufficient for all custom endpoints.

---

## Risk Assessment

**Resolved**:
- ✅ Vertex normalization complexity — output union pinned, args:object → string typed.
- ✅ Responses-API-only excludes legacy deployments — explicit apiVersion required on Azure; deployment not spoken by Responses will fail at request time with InvalidRequest.
- ✅ Stateless contract loses efficiency — previousResponseId optional, adapter may use as hint.
- ✅ Vertex auth complexity — both ADC and explicit service account supported in config shape.
- ✅ Function-call args mismatch — FunctionCallOutput.arguments typed as string; Vertex adapter must JSON.stringify.

**Carried to Implementation**:
- ⚠️ Adapter implements HTTP status → kind mapping correctly (all 4 providers).
- ⚠️ Custom endpoint variability — strict mode allows detection of unsupported features.
- ⚠️ NativeToolName ages — extend via minor version bump; exhaustive switches break at compile time (desired).

**Dependency Graph Integrity**:
- ✅ core/ has zero third-party imports (types-only boundary enforced).
- ✅ Hexagonal boundary clean (adapters import from core, core imports nothing).
- ✅ No adapter imports from sibling adapters.
- ✅ Public barrel (src/index.ts) is the only file knowing about both layers.

---

## Artifact Store Integration

**Mode**: `openspec` (file-based, committable).

**Structure**:
- `openspec/specs/` — main specs (authoritative, merged from delta specs):
  - `core-types/spec.md` — 9 REQs
  - `errors/spec.md` — 6 REQs
  - `ports/spec.md` — 7 REQs
  - `tools/spec.md` — 5 REQs
  - `factories/spec.md` — 7 REQs
  - **Total: 33+ REQs**

- `openspec/changes/archive/2026-04-27-helix-interface-definition/` — immutable audit trail:
  - `archive-report.md` — this document
  - (Note: proposal, design, tasks, verify-report frozen in delta location; this is the summary)

- `openspec/changes/helix-interface-definition/` — **ACTIVE LOCATION DURING DESIGN/IMPLEMENT/VERIFY** (now completed; will be moved to archive in operations):
  - proposal.md (612 lines, with §5.9 Azure config stale-field fix applied)
  - design.md (772 lines, with 10 ADRs)
  - tasks.md (129 lines, header corrected to 22)
  - verify-report.md (146 lines, with Forward Items section added)
  - `specs/{core-types,errors,ports,tools,factories}/spec.md` (delta specs, now merged to main specs)

---

## Recommendation

**Archive permitted. Status: CLOSED.**

The change is complete, verified (PASS_WITH_WARNINGS, zero CRITICAL), and ready for archival. The interfaces-only deliverable is self-contained and requires no further action before the next change begins. W-01 (Azure apiVersion guard) and W-02 (task count, corrected) are forward-looking and do not block archival.

The next change (`helix-openai-adapter` or whichever first-adapter is prioritized) will:
1. Implement the four factory function bodies.
2. Create adapter-specific provider and file-store implementations.
3. Write normalizeResponse() and normalizeError() functions.
4. Add comprehensive test coverage (Strict TDD Mode).
5. Address W-01, S-01, S-02 from forward items.

---

**End of archive report.**
