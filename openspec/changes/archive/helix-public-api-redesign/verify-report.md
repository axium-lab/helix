# Verify Report: helix-lib Public API Redesign — SDK-Mirror Surface

**Change**: `helix-public-api-redesign`
**Phase**: 1 — interfaces only
**Verify date**: 2026-04-28
**Mode**: Standard (Strict TDD: FALSE — no test runner installed; acceptance is type-level only)
**Verdict**: PASS WITH NOTES

---

## Summary

`tsc --noEmit` exits 0 with zero errors. All 27 tasks are marked complete and match the code state. All 5 spec domains are structurally satisfied. Four deviations flagged by apply are adjudicated below — two ACCEPTED, two ACCEPTED (with notes). No CRITICAL findings. Two WARNINGS, zero SUGGESTIONS.

---

## Build Verification

**Command**: `tsc --noEmit`
**Exit code**: 0
**Errors**: none
**tsconfig.json `lib`**: `["ES2022", "DOM"]` — the `"DOM"` addition is the subject of Deviation 1 below.

---

## Task Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 27 |
| Tasks complete `[x]` | 27 |
| Tasks incomplete `[ ]` | 0 |

All phases (1–9) are fully checked. Code state matches every task:
- Phase 1: `src/adapters/`, `src/core/ports/`, `src/core/client.ts`, `src/core/types/error.ts`, `tools.ts`, `capabilities.ts` — all deleted, confirmed absent.
- Phases 2–5: `config.ts`, `request.ts`, `response.ts`, `files.ts`, `models.ts`, `core/index.ts` — all present and match task specs.
- Phase 6: `createHelix.ts` — present with `Helix` interface and `createHelix` function (see Deviation 2).
- Phase 7: `internal/providers/{openai,azure,custom,vertex}.ts` — all present with correct structure.
- Phase 8: `src/index.ts` — exports exactly the 18 specified symbols (16 base + 2 convenience re-exports `InputText`, `InputFile`). Zero forbidden symbols found.
- Phase 9: `tsc` passes; forbidden-symbol audit clean; `internal` not referenced in `src/index.ts`.

---

## Deviation Rulings

### Deviation 1 — `"DOM"` added to `tsconfig.json lib`

**Deviation**: Apply added `"DOM"` to the `lib` array in `tsconfig.json` because `Blob` is not in ES2022. `tsconfig.json` now reads `"lib": ["ES2022", "DOM"]`.

**Analysis**:

The `Blob` type is used in `FilesCreateParams.file: Uint8Array | ArrayBuffer | Blob` (spec REQ-FILES-001, proposal §5.4). `Blob` is a web platform type available as a global only when either `"DOM"` or `"ES2022"` has it — but ES2022 does NOT include `Blob` as a TypeScript built-in. Historically `Blob` entered the TypeScript lib as part of `DOM`; it is also available as `node:buffer`'s `Blob` starting in Node 18+, but that requires an explicit import.

**Concerns evaluated**:

1. **Ambient type leak**: `"DOM"` includes `window`, `fetch`, `document`, `navigator`, and hundreds of browser globals. These become visible in all `.ts` files in the project. For a library targeting Node.js backends, this creates a false sense of browser-API availability — a developer could accidentally use `window.setTimeout` or `fetch()` without an import, and TypeScript would not object. This is a real (though mild) risk for a pure-Node library.

2. **Tighter alternatives**:
   - Use `Uint8Array | ArrayBuffer` only (drop `Blob`) — simplest, but reduces ergonomics for callers passing browser `Blob` objects, which are common in full-stack use cases.
   - Import `Blob` from `"node:buffer"` in `files.ts` — narrows scope to the Node.js `Blob` only. Requires `"lib": ["ES2022"]` + Node.js types (`@types/node`). Since `@types/node` is not listed as a devDependency, this path was blocked.
   - Use `"lib": ["ES2022", "DOM.Iterable"]` — does not include `Blob`; still not sufficient.
   - Add `"lib": ["ES2022"]` + a `/// <reference lib="dom" />` in `files.ts` only — narrows the leak to one file but is unusual and fragile.

3. **Proposal/design alignment**: The proposal explicitly lists `Uint8Array | ArrayBuffer | Blob` as the type for `FilesCreateParams.file` (§5.4, §5.5). The design §3.3 states "zero runtime, zero third-party dependencies" for `core/types/`. PR2 says "prefer lightest dependency"; neither PR2 nor ADR-10 addresses tsconfig lib arrays. Design §6 does NOT mandate a specific lib configuration — Phase 0 bootstrap is listed as inherited but its tsconfig details are not pinned in the design or specs.

4. **Practical impact of `"DOM"` in this project**: this library currently has NO test files, no browser entry point, and no bundler that would tree-shake based on lib. The risk is tooling ergonomics for future contributors, not a runtime bug.

**Ruling**: **ACCEPT** — with a WARNING (see Issues section).

Rationale: `Blob` is in the public spec (REQ-FILES-001) and in the proposal type sketch (§5.4). Removing it would be a spec-level regression. `"DOM"` is the standard approach to unlocking `Blob` as a global in TypeScript when `@types/node` is absent. The deviation is consistent with spec intent. However, a future `helix-dom-isolation` or `helix-tsconfig` housekeeping task should evaluate switching to `"lib": ["ES2022"]` + explicit `import { Blob } from "node:buffer"` (or dropping `Blob` if consumers are Node-only), and adding `@types/node` to devDependencies.

---

### Deviation 2 — `createHelix.ts` uses a real function body, not `declare function`

**Deviation**: Task 6.1 said "declare function createHelix(config: HelixConfig): Helix". The applied implementation is a real function with `switch (config.provider) { case "openai": return createOpenAIAdapter(config); ... }`.

**Analysis**:

Design §7 Diagram A shows the sequence: `App → createHelix → Public → switch on config.provider → Internal adapter → Helix`. This sequence REQUIRES a runtime dispatch — the factory must actually invoke an adapter constructor and return a populated `Helix` object. A bare `declare function createHelix(config: HelixConfig): Helix` is a type-only ambient declaration: it compiles but has no body, and at runtime the identifier is `undefined`. Calling `createHelix({ provider: "openai", apiKey: "x" })` on a declared-only function throws `TypeError: createHelix is not a function`.

The design §1 states the deliverable is "interfaces only — TypeScript type/interface declarations, a single `createHelix(config)` factory signature, internal adapter module signatures, and barrels — with zero runtime logic BEYOND what the factory contract requires (the factory IS a runtime export, but adapter bodies are stubs in this change)." The parenthetical explicitly acknowledges that the factory must have a runtime body.

The task wording ("declare function") was imprecise relative to the design intent. The design's sequence diagrams require `createHelix` to return a usable `Helix` object that throws on individual method calls — which is exactly what the stub adapters deliver (every method body throws "not implemented" for openai/azure; file methods throw the spec-mandated message for custom/vertex). This is the correct interpretation of "interfaces-only phase with stubs."

**Ruling**: **ACCEPT** — task wording was imprecise. The implementation is correct per design.

---

### Deviation 3 — `Promise<never>` on file-stub methods in custom/vertex

**Deviation**: The `files.create`, `files.list`, and `files.delete` methods on the custom and vertex stubs carry explicit return type annotations `Promise<never>` while throwing synchronously.

**Analysis**:

The `Helix` interface declares:
```ts
files: {
  create(params: FilesCreateParams): Promise<FileObject>;
  list(): Promise<FileObject[]>;
  delete(id: string): Promise<{ id: string; deleted: true }>;
};
```

`Promise<never>` is structurally assignable to `Promise<FileObject>`, `Promise<FileObject[]>`, and `Promise<{ id: string; deleted: true }>` because `never` is the bottom type — it is assignable to every type. TypeScript accepts `Promise<never>` wherever `Promise<T>` is expected, for any `T`. This is standard idiomatic TypeScript for "this function always throws or never returns normally." The annotation is precise and honest: these methods never produce a value, only throw.

The runtime behavior is: the function body executes `throw new Error(...)` synchronously before any promise is constructed. This is observable from callers as a synchronous exception — NOT a rejected promise. Spec REQ-FILES-005 says "MUST throw a plain `Error`" with the correct message, which is exactly what happens. The spec does not say "MUST return a rejected promise" — it says "MUST throw", so synchronous throw is compliant.

`tsc --noEmit` passes with zero errors, confirming TypeScript accepts this as satisfying the `Helix` interface. The pattern is idiomatic and correct.

**Ruling**: **ACCEPT** — structurally sound and spec-compliant. Synchronous throw satisfies "MUST throw a plain Error" per REQ-FILES-005.

---

### Deviation 4 — `test()` returns `false` at runtime because `models.list()` throws "not implemented"

**Deviation**: In all four provider stubs, `test()` calls `this.models.list()` which synchronously throws `new Error("not implemented")`. The `try/catch` in `test()` catches it and returns `false`. So at runtime today, `test()` always returns `false` for all providers.

**Analysis**:

Spec REQ-TEST-001 states:
- "MUST return `true` when the provider is reachable and credentials are valid"
- "MUST return `false` when any failure occurs"

Spec REQ-TEST-002 (Note): "adapters SHOULD implement `test()` by calling `models.list()` internally and returning `true` if it resolves, `false` if it throws or rejects. This is the expected implementation pattern; the spec only constrains the observable behavior."

The spec constrains the *observable behavior*, not the internal mechanics. In this interfaces-only phase, the adapters are stubs — no real HTTP calls exist. `models.list()` throwing "not implemented" is a stub placeholder for a future real implementation. The `test()` stub correctly returns `false` when `models.list()` throws for ANY reason — including "not implemented". This is consistent with the spec contract: the spec says "false on any failure" and "not implemented" is a failure condition.

Critically: the spec does NOT say "MUST reach the provider network". It says "MUST return `true` when reachable" and "MUST return `false` when any failure occurs". In Phase 1 (interfaces-only), the stubs are never expected to reach a real provider — they are type-correct scaffolding for future implementation phases. The `test()` behavior is therefore correct for this phase.

The concern about "dishonesty" would apply if this were a shipped implementation, but since the entire implementation is a stub (Phase 1 = interfaces only), returning `false` is the correct observable result of an unimplemented `models.list()`.

**Ruling**: **ACCEPT** — stub behavior is consistent with spec intent for an interfaces-only phase. When real adapter implementations land (Phase 2 of the roadmap), `models.list()` will call the provider, and `test()` will return `true` on success. This is noted in the WARNING section for the implementation phase.

---

## REQ-ID Coverage Matrix

This change is interfaces-only (type-level). Compliance is verified structurally (type definitions, symbol presence, error messages) since no test runner is installed.

| REQ-ID | Requirement | Evidence | Status |
|--------|-------------|----------|--------|
| REQ-CLIENT-001 | Single factory `createHelix`, no per-provider factories | `createHelix` exported; no `createOpenAI` etc. in `src/index.ts` | COMPLIANT |
| REQ-CLIENT-002 | `HelixConfig` 4-variant discriminated union on `provider` | `src/core/types/config.ts` exact match | COMPLIANT |
| REQ-CLIENT-003 | `HelixProviderKind = "openai" \| "azure" \| "custom" \| "vertex"` | Line 1 of `config.ts`; exported from `src/index.ts` | COMPLIANT |
| REQ-CLIENT-004 | `Helix` interface: `responses`, `files`, `models`, `test` — no `internal` on public surface | `createHelix.ts` matches exactly; `grep "internal" src/index.ts` = no results | COMPLIANT |
| REQ-CLIENT-005 | `VertexCredentials` two-variant union; no SDK import | `config.ts` lines 3–5; no provider SDK imports in core | COMPLIANT |
| REQ-CLIENT-006 | No `HelixError`, `ProviderCapabilities`, capability runtime | Forbidden-symbol audit on `src/index.ts` clean | COMPLIANT |
| REQ-FILES-001 | `files.create(params: FilesCreateParams): Promise<FileObject>` | `Helix` interface in `createHelix.ts`; `FilesCreateParams` in `files.ts` | COMPLIANT |
| REQ-FILES-002 | `FileObject` shape (7 fields, snake_case) | `files.ts` exact match to spec table | COMPLIANT |
| REQ-FILES-003 | `files.list(): Promise<FileObject[]>` | `Helix` interface | COMPLIANT |
| REQ-FILES-004 | `files.delete(id: string): Promise<{ id: string; deleted: true }>` | `Helix` interface | COMPLIANT |
| REQ-FILES-005 | custom/vertex throw `Error` with exact message format | Messages verified in custom.ts and vertex.ts; exact match to spec | COMPLIANT |
| REQ-FILES-006 | Raw error passthrough for openai/azure | openai.ts/azure.ts do not wrap errors (throw "not implemented" = plain Error) | COMPLIANT (stub) |
| REQ-MODELS-001 | `models.list(): Promise<ModelInfo[]>` | `Helix` interface | COMPLIANT |
| REQ-MODELS-002 | `ModelInfo` shape (4 fields) | `models.ts` exact match | COMPLIANT |
| REQ-MODELS-003 | Per-provider behavior matrix | Stubs present; Azure/Vertex normalization documented for Phase 2 | COMPLIANT (stub) |
| REQ-MODELS-004 | Raw error passthrough for models | All stubs throw plain `Error` | COMPLIANT (stub) |
| REQ-RESP-001 | `responses.create(params): Promise<HelixResponse>` | `Helix` interface | COMPLIANT |
| REQ-RESP-002 | `ResponsesCreateParams` exact 6-field shape; no `topP` etc. | `request.ts` exact match; forbidden fields absent | COMPLIANT |
| REQ-RESP-003 | `InputMessage`, `InputContentPart` union (2 variants); no `InputFileEphemeral` | `request.ts`; `InputFileEphemeral` absent | COMPLIANT |
| REQ-RESP-004 | `HelixResponseFormat` 3-variant union | `request.ts` exact match | COMPLIANT |
| REQ-RESP-005 | `HelixResponse` shape (7 fields); `output_text` derivation rule | `response.ts` exact match; JSDoc documents derivation rule | COMPLIANT |
| REQ-RESP-006 | `OutputItem = OutputMessage` only; no reasoning/refusal/function-call | `type OutputItem = OutputMessage` in response.ts; JSDoc on OutputItem | COMPLIANT |
| REQ-RESP-007 | `HelixUsage` shape (3 fields, snake_case) | `response.ts` exact match | COMPLIANT |
| REQ-RESP-008 | Per-provider temperature/max_output_tokens mapping | Documented in design §6.2; stubs present for Phase 2 | COMPLIANT (stub) |
| REQ-RESP-009 | Raw error passthrough for responses | Stubs throw plain `Error("not implemented")` | COMPLIANT (stub) |
| REQ-TEST-001 | `test(): Promise<boolean>`; resolves true on success, false on failure | `Helix` interface; all 4 stubs implement try/catch returning true/false | COMPLIANT |
| REQ-TEST-002 | Errors swallowed; return type exactly `Promise<boolean>` | All stubs catch and return false; interface return type is `Promise<boolean>` | COMPLIANT |
| REQ-TEST-003 | `test()` on all 4 providers | All 4 adapter stubs implement `test()` | COMPLIANT |
| REQ-TEST-004 | No logging, no error exposure | Stubs return only `true`/`false` | COMPLIANT |

**Compliance summary**: 29/29 REQs structurally satisfied. Behavioral validation pending real adapter implementation (Phase 2).

---

## Coherence — Design Match

| Design Decision | Followed? | Notes |
|----------------|-----------|-------|
| ADR-5 (rev): single `createHelix` factory | YES | Implemented with switch dispatch |
| ADR-10: `core/` zero dep | YES | `package.json` has no `dependencies`; core files have no imports |
| ADR-11: namespace shape mirrors SDK | YES | `helix.responses.create`, `helix.files.*`, `helix.models.list` |
| ADR-12: internal adapters, not public | YES | `internal/` not referenced in `src/index.ts` |
| ADR-13: raw error passthrough | YES | Stubs throw plain `Error` |
| ADR-14: `OutputItem = OutputMessage` only | YES | Single-variant alias with JSDoc |
| ADR-15: `test()` returns `Promise<boolean>` | YES | All stubs implement |
| ADR-16: `files.list()` returns flat array | YES | `Promise<FileObject[]>` |
| ADR-17: `files.delete()` returns `{ id, deleted: true }` | YES | Literal `deleted: true` in interface |
| Design §3.1: file tree layout | YES | All files in correct locations |
| Design §4.4: ~14 counted public exports | YES | 16 base + 2 convenience = 18 symbols (within range per proposal §5.6) |
| Design §6.3: `internal/` boundary (3 layers) | YES (1/3 enforced) | Barrel discipline: enforced. `package.json` exports: enforced. Declaration emit: deferred to build phase |

---

## Issues Found

### CRITICAL
None.

### WARNING

**W-1 — `"DOM"` in tsconfig.json leaks browser ambient types (Deviation 1)**

Adding `"DOM"` to `lib` makes `window`, `document`, `fetch`, `navigator`, and all browser globals silently available in TypeScript across the entire `src/` tree. For a library targeting Node.js backends, this can mask accidental use of browser APIs. Future action: add `@types/node` as a devDependency and switch `FilesCreateParams.file` to use `import type { Blob } from "node:buffer"` in `files.ts`, then remove `"DOM"` from `lib`. This is a housekeeping task for the next cycle, not a blocker for archive.

**W-2 — Stub `models.list()` throws "not implemented" on ALL providers, including openai/azure**

In the current stub state, `helix.models.list()` on openai and azure throws `new Error("not implemented")`. This also means `helix.test()` always returns `false` for all providers today. This is expected for Phase 1 (interfaces only), but the implementation phase MUST replace these stubs with real HTTP calls. The openai and azure stubs must NOT ship to consumers in this state. Archive is safe because this is pre-release (v0.0.1, no live consumers), but the implementation phase should be the next change after archive.

### SUGGESTION
None.

---

## Verdict

**PASS WITH NOTES**

`tsc --noEmit` exits 0. All 27 tasks are complete and match code state. All 29 spec REQs are structurally satisfied. The four flagged deviations are all ACCEPTED — two are correct interpretations of design intent, one is idiomatic TypeScript, and one is expected stub behavior for an interfaces-only phase. Two WARNINGS are logged for the implementation phase: (1) `"DOM"` in tsconfig.json should be replaced with a tighter approach when real adapters land; (2) stub `models.list()` must be replaced with real HTTP calls before consumers can use the library. No CRITICAL findings block archive.

**Recommendation**: proceed to `sdd-archive`.

---

*Verification mode: Standard (no test runner). Type-level acceptance only.*
