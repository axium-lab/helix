# Archive Report: helix-lib Public API Redesign (Phase 1)

**Change**: `helix-public-api-redesign`
**Archive Date**: 2026-04-28
**Status**: ARCHIVED — Phase 1 COMPLETE
**Verdict**: PASS WITH NOTES

---

## Executive Summary

Phase 1 of the SDK-mirror public API redesign is complete and archived. The change replaces the entire public surface of helix-lib with a single `createHelix(config)` factory and a `Helix` interface mirroring the OpenAI SDK shape. All 27 tasks are done, `tsc --noEmit` passes cleanly, and all 29 spec requirements are structurally satisfied. This change SUPERSEDES and REPLACES the archived `helix-interface-definition` (v1) change dated 2026-04-27. Two deferred warnings from verify phase are carried forward to Phase 2 (provider implementation).

---

## Deliverables Summary

### Public API Changes

**Single Factory**
- `createHelix(config: HelixConfig): Helix` replaces per-provider factories (`createOpenAI`, `createAzureOpenAI`, `createOpenAICompatible`, `createVertex`)

**Helix Interface Namespaces**
- `helix.responses.create(params): Promise<HelixResponse>` — text generation entry point
- `helix.files.{create, list, delete}()` — file CRUD operations
- `helix.models.list(): Promise<ModelInfo[]>` — model enumeration
- `helix.test(): Promise<boolean>` — connectivity check (returns boolean, never throws)

**Public Type Surface**
- ~14 exported types (down from 38 in v1): `Helix`, `HelixConfig`, `HelixProviderKind`, `VertexCredentials`, `ResponsesCreateParams`, `HelixResponse`, `HelixUsage`, `HelixResponseFormat`, `HelixRole`, `InputMessage`, `InputContentPart`, `OutputItem`, `FilesCreateParams`, `FileObject`, `ModelInfo`
- Plus convenience re-exports: `InputText`, `InputFile`, `OutputMessage`, `OutputTextPart`

**Configuration Union**
- `HelixConfig` discriminated union on `provider`:
  - `"openai"`: `apiKey`, `baseUrl?`
  - `"azure"`: `apiKey`, `endpoint`, `apiVersion`
  - `"custom"`: `apiKey`, `baseUrl`
  - `"vertex"`: `projectId`, `location`, `credentials?` (VertexCredentials union)

---

## Source Code Changes

### Files Created

**Core Type Definitions** (`src/core/types/`)
- `config.ts` — HelixConfig union, HelixProviderKind, VertexCredentials
- `request.ts` — ResponsesCreateParams, InputMessage, InputContentPart, HelixRole, HelixResponseFormat (rewritten)
- `response.ts` — HelixResponse, OutputItem, OutputMessage, OutputTextPart, HelixUsage (rewritten)
- `files.ts` — FilesCreateParams, FileObject
- `models.ts` — ModelInfo

**Public Interface** (`src/`)
- `createHelix.ts` — createHelix factory (stub implementation) and Helix interface
- `core/index.ts` — core barrel (rewritten)
- `index.ts` — public barrel (rewritten)

**Internal Adapters** (`src/internal/providers/` — NOT exported)
- `openai.ts` — internal OpenAI adapter stub
- `azure.ts` — internal Azure adapter stub
- `custom.ts` — internal Custom adapter stub
- `vertex.ts` — internal Vertex adapter stub

### Files Deleted

- `src/core/types/error.ts` — HelixError/HelixErrorKind (deferred to helix-error-model)
- `src/core/types/tools.ts` — NativeTool/FunctionTool (deferred to helix-tools)
- `src/core/types/capabilities.ts` — ProviderCapabilities (capability runtime dropped)
- `src/core/ports/provider.port.ts` — HelixProvider port (replaced by Helix interface)
- `src/core/ports/file-store.port.ts` — HelixFileStore port (replaced by helix.files namespace)
- `src/core/ports/` — directory (now empty)
- `src/core/client.ts` — HelixClient aggregate (replaced by Helix interface)
- `src/adapters/openai/factory.ts` — per-provider factory
- `src/adapters/azure/factory.ts`
- `src/adapters/custom/factory.ts`
- `src/adapters/vertex/factory.ts`
- `src/adapters/` — directory tree (now empty)

### Files Modified

- `tsconfig.json` — `lib: ["ES2022"]` + `types: ["node"]`. `Blob` resolves via `@types/node` (Node 22+ global). DOM lib intentionally NOT included (server-side library).
- `package.json` — added `@types/node ^22.0.0` (devDep) and `engines.node: ">=22"` to declare LTS target.

---

## Main Specs Synchronized

This change constitutes the FULL truth source for helix-lib's public API. The following main specs in `openspec/specs/` have been created or replaced:

### New Specs Created

- `openspec/specs/client/spec.md` — replaces `factories/spec.md` and `ports/spec.md`
- `openspec/specs/responses/spec.md` — delta update to `core-types/spec.md`, standalone spec
- `openspec/specs/files/spec.md` — replaces file-store portion of `ports/spec.md`
- `openspec/specs/models/spec.md` — new capability spec
- `openspec/specs/test/spec.md` — new capability spec

### Specs Marked for Removal

- `openspec/specs/errors/spec.md` — REMOVED (deferred to helix-error-model)
- `openspec/specs/tools/spec.md` — REMOVED (deferred to helix-tools)
- `openspec/specs/factories/spec.md` — REMOVED (replaced by client/spec.md)
- `openspec/specs/ports/spec.md` — REMOVED (replaced by client + files/spec.md)
- `openspec/specs/core-types/spec.md` — REMOVED (core concepts absorbed into client + responses/spec.md)

### Spec Status

**29 Requirements Satisfied**:
- REQ-CLIENT-001 through REQ-CLIENT-006 (6 reqs) — client factory, config union, Helix interface, VertexCredentials
- REQ-RESP-001 through REQ-RESP-009 (9 reqs) — responses.create, params shape, input/output formats, per-provider mapping
- REQ-FILES-001 through REQ-FILES-006 (6 reqs) — files CRUD, params/object shapes, per-provider support matrix
- REQ-MODELS-001 through REQ-MODELS-004 (4 reqs) — models.list, ModelInfo shape, per-provider behavior
- REQ-TEST-001 through REQ-TEST-004 (4 reqs) — test() contract, error swallowing, provider coverage, caller responsibility

---

## Verification Verdict

**PASS WITH NOTES**

| Check | Result |
|-------|--------|
| `tsc --noEmit` | ✅ 0 errors, clean |
| Task Completeness | ✅ 27/27 tasks complete |
| Spec Coverage | ✅ 29/29 REQs satisfied (structurally) |
| Type Exports | ✅ ~14 public types, no forbidden symbols |
| Internal Boundary | ✅ `src/internal/` not exported |
| Deviations Adjudicated | ✅ 4 deviations: 2 ACCEPTED, 2 ACCEPTED (with notes) |

### Deviation Rulings (Summary)

**Deviation 1: `"DOM"` in tsconfig.json** → **OBSOLETED (resolved in-flight before commit)**
- Original apply added `"DOM"` to `lib` to unlock `Blob` (REQ-FILES-001)
- Discussion during archive flagged the leakage of browser ambient globals as wrong for a server-side library
- Final state replaces it cleanly: `lib: ["ES2022"]`, `types: ["node"]`, `@types/node ^22.0.0` as devDep, `engines.node: ">=22"`
- `Blob` now resolves from `@types/node` (Node 22+ global), no DOM ambient leakage
- `tsc --noEmit` re-verified: 0 errors
- See resolution under Warning W-1 below (kept for historical traceability)

**Deviation 2: `createHelix.ts` uses real function body** → **ACCEPT**
- Task wording said "declare function" but design intent requires runtime dispatch
- Current implementation (switch on provider, call adapter constructor) is correct per §7 sequence diagrams
- Adapter bodies are stubs ("not implemented" throws) per interfaces-only phase

**Deviation 3: `Promise<never>` on custom/vertex file stubs** → **ACCEPT**
- Idiomatic TypeScript for "always throws, never returns normally"
- Structurally assignable to `Promise<FileObject>` etc. (never is bottom type)
- Spec-compliant: REQ-FILES-005 says "MUST throw a plain Error" — synchronous throw satisfies

**Deviation 4: `test()` returns `false` due to stub `models.list() throws` → **ACCEPT**
- Spec REQ-TEST-001 says "return false when any failure occurs"
- Stub throwing "not implemented" IS a failure
- In interfaces-only phase, this is correct observable behavior
- Phase 2 (real implementations) will replace stubs with actual HTTP calls

---

## Open Items (Phase 2 Follow-ups)

### Warning W-1: `"DOM"` in tsconfig.json Library Array

**Status**: ✅ RESOLVED IN-FLIGHT (before commit)
**Impact**: was Mild (library-internal, not runtime)
**Resolution applied**:
1. ✅ Added `@types/node ^22.0.0` to devDependencies
2. ✅ Removed `"DOM"` from `tsconfig.json` `lib` array
3. ✅ Added `"types": ["node"]` to make ambient typing explicit (prevents accidental auto-import of unrelated `@types/*`)
4. ✅ Added `engines.node: ">=22"` to declare LTS target
5. ✅ `Blob` resolves from `@types/node` (Node 22+ global) — no DOM ambient leakage, server-side semantics preserved
6. ✅ `tsc --noEmit` re-verified: 0 errors after the change

### Warning W-2: Stub `models.list()` Throws on ALL Providers

**Status**: Expected for Phase 1, must be replaced in Phase 2
**Impact**: High (blocks real usage)
**Requires**: Phase 2 implementation change to replace stubs with real HTTP calls
**Scope**: Implement provider-specific HTTP:
- OpenAI: use SDK or raw fetch to `/v1/models` endpoint
- Azure: custom HTTP to list deployments, normalize to ModelInfo
- Custom: pass through the provider's `/models` endpoint
- Vertex: call Gemini model listing API, normalize to ModelInfo

All four providers' `test()` will then return `true` on success (currently return `false` due to "not implemented" stub).

---

## Architecture Snapshot

### Hexagonal Layout Preserved

- **`src/core/`** — zero-dependency, type-only layer defines all public contracts
- **`src/internal/providers/`** — hidden adapters, not exported, free to change internally
- **`src/createHelix.ts` + `src/index.ts`** — public seam, routes via config.provider discriminant

### Public Surface Reduction

| Aspect | v1 (helix-interface-definition) | v2 (this change) | Delta |
|--------|---------|---------|-------|
| Exported types | 38 | ~14 | -26 types |
| Factory functions | 4 | 1 | -3 factories |
| Namespaces on Helix | N/A (ports were public) | 4 (responses, files, models, test) | +4 namespaces |
| Error handling | HelixError class | raw passthrough | deferred |
| Tools surface | NativeTool, FunctionTool | none | deferred |

### Deferred Work (Future Changes)

1. **`helix-error-model`** — reintroduce HelixError, per-provider error mapping, wrap adapter calls
2. **`helix-tools`** — reintroduce NativeTool, FunctionTool, expand OutputItem union with function_call variant
3. **`helix-streaming`** — add `helix.responses.stream(params): AsyncIterable<StreamDelta>`
4. **`helix-providers-phase-2`** (suggested name) — implement real HTTP calls in all four adapter modules; replace stubs; implement Azure deployments API; implement Vertex/Gemini normalization; resolves W-2

---

## Compliance Matrix

| Area | Status | Notes |
|------|--------|-------|
| API surface | ✅ Spec-compliant | 29/29 REQs satisfied |
| Type safety | ✅ Clean | `tsc --noEmit` passes |
| Task completion | ✅ 100% | All 27 tasks marked complete |
| Internal boundary | ✅ Enforced | 3 layers: barrel, `package.json` exports, declaration emit |
| Hexagonal layout | ✅ Preserved | `core/` zero-dep, adapters internal |
| Implementation readiness | ⚠️ Phase 1 only | All stubs; Phase 2 required for real usage |

---

## Successor Phase Recommendation

**Next Change**: `helix-providers-phase-2` (or similar name)

**Scope**: Implement real HTTP adapters replacing all stubs
- Replace OpenAI stub with OpenAI SDK calls
- Replace Azure stub with Azure SDK calls + custom deployments API normalization
- Replace Custom stub with configurable fetch + error passthrough
- Replace Vertex stub with @google-cloud/vertexai SDK + Gemini model normalization
- Implement real `models.list()` for all providers (fixes W-2)
- Add unit tests per provider (Strict TDD if test runner is installed by then)

**Expected Outcomes**:
- `helix.test()` returns `true` on valid credentials
- `helix.responses.create()` makes real LLM calls
- `helix.files.create()`, `list()`, `delete()` on OpenAI/Azure work end-to-end
- `helix.models.list()` returns real provider models
- First real consumer (axium-api) can integrate with a one-line config change

---

## Traceability

### Artifacts Closed

- **Proposal**: `sdd/helix-public-api-redesign/proposal` → design decisions pinned, scope locked
- **Design**: `sdd/helix-public-api-redesign/design` → architecture, ADRs, sequence diagrams finalized
- **Specs** (5 delta/new): `sdd/helix-public-api-redesign/specs/{client,responses,files,models,test}`
- **Tasks**: `sdd/helix-public-api-redesign/tasks` → 27 tasks, all `[x]` complete
- **Apply Progress**: `sdd/helix-public-api-redesign/apply-progress` → all phases 1–9 recorded
- **Verify Report**: `sdd/helix-public-api-redesign/verify-report` → verdict PASS WITH NOTES

### Observation IDs (Engram)

Persisted to engram topic keys:
- `sdd/helix-public-api-redesign/proposal`
- `sdd/helix-public-api-redesign/design`
- `sdd/helix-public-api-redesign/spec` (aggregated 5 domain specs)
- `sdd/helix-public-api-redesign/tasks`
- `sdd/helix-public-api-redesign/apply-progress`
- `sdd/helix-public-api-redesign/verify-report`
- `sdd/helix-public-api-redesign/archive-report` (this file)

---

## Post-Archive Actions

**No commits to execute** — user controls git operations. The following states exist on disk:

1. **Change archived**: `openspec/changes/helix-public-api-redesign/` → `openspec/changes/archive/helix-public-api-redesign/`
2. **Main specs written**: Five delta/new spec files in `openspec/specs/{client,responses,files,models,test}/spec.md`
3. **Source code on disk**: `src/` fully restructured with new public API
4. **Archive report**: This file at `openspec/changes/archive/helix-public-api-redesign/archive-report.md`

**User should**:
```bash
cd /Users/pedrolosas/workspace/fluxaria/helix-lib
git add openspec/specs/ openspec/changes/archive/ src/
git commit -m "docs(sdd): archive helix-public-api-redesign change; establish Phase 1 SDK-mirror public API"
git push origin main  # or submit PR
```

---

**End of archive report.**
