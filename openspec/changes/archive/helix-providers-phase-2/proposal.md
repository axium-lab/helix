# Proposal: helix-providers-phase-2 — Real HTTP for OpenAI, Azure, and Custom

**Change**: `helix-providers-phase-2`
**Date**: 2026-04-28
**Author**: orchestrator-delegated (sdd-propose)
**Status**: ready for sdd-spec / sdd-design
**Artifact store**: openspec
**Predecessor**: `helix-public-api-redesign` (archived 2026-04-27)
**Successors (planned)**: `helix-vertex-provider`, `helix-error-model`, `helix-tools`, `helix-streaming`, `helix-azure-config-v2`

---

## 1. Intent

### What

Phase 2 turns the four `createHelix` provider stubs into a working library for **three** of the four declared providers — `openai`, `azure`, and `custom`. After this change, every method on the `Helix` interface that is supposed to hit the wire actually does, and a Vitest unit suite proves it for the three in-scope providers.

The fourth provider, `vertex`, is intentionally carved out into a separate successor change (`helix-vertex-provider`). Its adapter file (`src/internal/providers/vertex.ts`) keeps its current "not implemented" stub, byte-for-byte unchanged.

### Why now

- Phase 1 v2 (`helix-public-api-redesign`) shipped the public surface and froze it. The whole point of freezing the surface was to allow Phase 2 to fill implementations without bikeshedding the API.
- `axium-api` is the real consumer and needs `responses.create`, `files.{create,list,delete}`, `models.list`, and `test()` against OpenAI / Azure / OpenAI-compatible endpoints. None of them work today (every method throws `"not implemented"`).
- The Vertex flavor of Phase 2 is fundamentally different work — raw `fetch`, RSA-SHA256 JWT signing with `node:crypto`, Gemini-to-Responses-API normalization with synthesized `id`/`created_at`. Forcing Vertex into the same change inflates scope and risk for zero benefit, since the OpenAI-SDK-using providers ship together cleanly and `axium-api`'s OpenAI/Azure/custom flows can land first.
- Phase 1 v2 explicitly listed `helix-providers-phase-2` as the canonical successor. We are executing that successor now.

### Success looks like

1. `helix.responses.create(...)` round-trips through real HTTP for `openai`, `azure`, and `custom`, returning a `HelixResponse` that satisfies the frozen REQ-RESP-* contract.
2. `helix.files.{create,list,delete}` round-trip through real HTTP for `openai` and `azure`. The "throws on `custom`" stubs (already correct per REQ-FILES-005) are untouched.
3. `helix.models.list()` round-trips through real HTTP for `openai` and `custom`. On `azure` it throws a plain `Error` with a clear, actionable message about the data-plane endpoint being retired and ARM credentials being required.
4. `helix.test()` returns `true` on success / `false` on failure for `openai` and `custom`. On `azure` it always returns `false` (because `models.list()` throws) — documented as a known limitation, not a bug.
5. The Vitest unit suite is green and covers all three in-scope providers via MSW HTTP mocking. PR3 is satisfied for the in-scope set; Vertex coverage is explicitly waived for this change.
6. `tsc --noEmit` reports zero errors. The public surface is bit-identical to what Phase 1 v2 archived — no new exports, no removed exports, no signature drift.

---

## 2. Scope

### IN scope

- Real HTTP implementations inside the three in-scope adapter files:
  - `src/internal/providers/openai.ts`
  - `src/internal/providers/azure.ts`
  - `src/internal/providers/custom.ts`
- Adoption of the `openai` npm SDK as a runtime dependency (`openai@^6.0.0`) for all three in-scope adapters. OpenAI uses `new OpenAI({ apiKey, baseURL? })`. Azure uses `new AzureOpenAI({ apiKey, endpoint, apiVersion })`. Custom uses `new OpenAI({ apiKey, baseURL })`.
- Vitest as the test runner; `@mswjs/interceptors` (or full `msw` package, sdd-design picks) for HTTP mocking. Both as devDependencies.
- A unit test tier covering `openai`, `azure`, and `custom`: request shaping, response normalization, error passthrough, and the "throws on unsupported operation" guarantees that already exist in Phase 1.
- An integration test tier, gated by env vars (`HELIX_OPENAI_API_KEY`, `HELIX_AZURE_*`, etc.), that runs against real endpoints when credentials are present and skips gracefully otherwise. Confidence layer, not the PR3 gate.
- Updated `package.json` (one new runtime dep `openai`, devDeps for Vitest + MSW, a `test` script).
- Per-provider mapping rules implemented to match the frozen REQs:
  - `responses.create` → SDK `responses.create` for all three (Azure passes deployment name as the `model` field per Phase 1 spec).
  - `files.create / list / delete` → SDK `files.*` on `openai` and `azure`. Custom keeps its existing `throw` stubs (REQ-FILES-005 already mandates them).
  - `models.list` → SDK `models.list` on `openai` and `custom`. Azure throws.
  - `test()` → wraps `models.list()` in try/catch, returns boolean. Already implemented as a default at the stub level; remains unchanged in shape.

### OUT of scope (explicitly deferred)

- **Vertex provider implementation.** `src/internal/providers/vertex.ts` keeps its existing stub. The full Vertex work (raw `fetch`, JWT signing with `node:crypto`, Gemini normalization with synthesized fields, ADC fallback) lives in successor `helix-vertex-provider`. Its scope is captured in engram (`helix-lib/future-changes/helix-vertex-provider`).
- **`HelixError` structured error model.** Errors propagate raw from the `openai` SDK (which throws `APIError` subclasses with `status`, `code`, `message`, etc.). The frozen specs explicitly mandate raw passthrough: REQ-RESP-009, REQ-FILES-006, REQ-MODELS-004. `HelixError` is its own change, `helix-error-model`.
- **Reasoning-model field auto-omission.** Some OpenAI models reject `temperature` (o-series, gpt-5-mini, gpt-5-nano). Phase 2 does NOT auto-detect or auto-strip fields based on model name. The lib stays a thin pass-through. If the caller sends an incompatible field, the provider's error propagates as-is (REQ-RESP-009).
- **Streaming.** Future `helix-streaming`.
- **Tools / function calling.** Future `helix-tools`.
- **Pagination** for `files.list` / `models.list`.
- **Azure `models.list()` working end-to-end.** Blocked until `helix-azure-config-v2` adds `deploymentName` (or another mechanism) to the Azure config variant. Phase 2 throws with a helpful message and accepts `test()` returning `false` on Azure as the temporary trade-off.
- **Public surface changes of any kind.** No new exports, no signature drift, no spec edits. The `openspec/specs/{client,responses,files,models,test}/spec.md` files are read-only references in this change.
- **`InputFile` (file-by-reference) handling for Vertex.** Belongs in `helix-vertex-provider`. (For OpenAI/Azure, `InputFile` flows through the SDK natively as part of the Responses API request shape — no special handling required here.)

### Deliberately untouched files

- `src/internal/providers/vertex.ts` — keep current "not implemented" / "not supported" throws verbatim.
- `src/index.ts`, `src/createHelix.ts`, `src/core/types/*.ts`, `src/core/index.ts` — public surface, frozen.
- `openspec/specs/**` — frozen Phase 1 v2 contract.
- `tsconfig.json` — no compiler-option drift required.

---

## 3. Decisions ratified

These are user-ratified during exploration and treated as fixed inputs by sdd-spec, sdd-design, and sdd-apply. Do NOT relitigate.

### RD-PHASE2-1 — Transport: `openai` npm SDK for all three in-scope providers

**Decision.** Use `openai@^6.0.0` as the sole runtime HTTP transport for `openai`, `azure`, and `custom` adapters. The package exports both `OpenAI` and `AzureOpenAI` classes, has zero runtime dependencies of its own (uses native `fetch` from Node ≥18; we require Node ≥22 per `engines.node`), and provides full TypeScript types for both Responses API and Files API.

- OpenAI adapter: `new OpenAI({ apiKey, baseURL? })`
- Azure adapter: `new AzureOpenAI({ apiKey, endpoint, apiVersion })`
- Custom adapter: `new OpenAI({ apiKey, baseURL })`

Net runtime dependency count: **+1** (`openai`).

**Reasoning citation.** Exploration §A. PR2 ("lightest possible dep") is satisfied — the SDK is zero-runtime-dep and replaces what would otherwise be a bespoke HTTP client we maintain ourselves. PR1/PR5 (output normalization to OpenAI Response format) is satisfied trivially because the SDK already returns OpenAI-shape objects, so the adapter forwards them with at most surface trimming.

### RD-PHASE2-2 — Error handling: raw passthrough; `HelixError` stays deferred

**Decision.** Phase 2 does NOT introduce error normalization. Every error from the `openai` SDK propagates verbatim to the caller. Every error from `vertex` (still stubbed) continues to throw `Error("not implemented")`. The "unsupported operation" plain-Error throws in `custom.ts` and `vertex.ts` stay as Phase 1 left them.

`HelixError` is a separate change (`helix-error-model`) with its own per-provider error-code analysis pass.

**Reasoning citation.** Frozen specs REQ-RESP-009, REQ-FILES-006, REQ-MODELS-004 ALL mandate raw error propagation in v0. Folding `HelixError` into Phase 2 violates the frozen contract and inflates scope. Exploration §E. The CLAUDE.md project-standards block carries an explicit "PR6 deferred" exception that says exactly this.

### RD-PHASE2-3 — Reasoning-model fields: pass-through, no auto-omission

**Decision.** The lib does NOT inspect `params.model` to decide whether to strip or substitute fields like `temperature`. Whatever the caller sends, the adapter forwards. If a specific model rejects a field, the provider's error propagates unchanged.

**Reasoning citation.** Exploration §G open-question 2 and §H. The lib is a thin pass-through. Per-model quirk handling is the consumer's responsibility (`axium-api` will own this). Folding it in violates RD-7 from Phase 1 (only `temperature` and `max_output_tokens` are accepted as generation params; surface stays minimal) and creates a moving target as new models ship.

### RD-PHASE2-4 — Azure `models.list()` throws; `test()` is permanently `false` on Azure in this change

**Decision.** The Azure adapter's `models.list()` throws a plain `Error` with a message along the lines of:

> `helix-lib: 'models.list' on provider 'azure' requires ARM credentials (data-plane deployments endpoint retired April 2024). HelixConfig.azure currently carries only apiKey — see future change 'helix-azure-config-v2' for full deployment listing support.`

Because `test()` is implemented as `try { await models.list(); return true } catch { return false }`, `test()` on Azure returns `false` for as long as Azure's `models.list()` throws. This is documented as a known limitation, not a defect. Consumers who need true health-checks for Azure can call `responses.create` directly with a known-good deployment in their own try/catch until `helix-azure-config-v2` lands.

**Reasoning citation.** Exploration §C and the table at §H. The data-plane `/openai/deployments?api-version=...` endpoint was retired in April 2024 by Azure. The only current API is the ARM management plane (`management.azure.com/subscriptions/...`) which requires Azure RBAC credentials, NOT the API key. `HelixConfig.azure` carries only `apiKey` — therefore ARM is unreachable. Adding `deploymentName` (or service-principal auth) to the Azure variant is a public-surface change and must go through its own SDD cycle.

### RD-PHASE2-5 — Test runner: Vitest + MSW; two-tier strategy; Vertex coverage waived

**Decision.** Install Vitest and MSW (`@mswjs/interceptors` at minimum, full `msw` package if sdd-design prefers) as devDependencies. Two test tiers:

1. **Unit tier (always runs in CI).** MSW intercepts `fetch` at module level; covers request shaping, response normalization, raw error propagation, and the "throws on unsupported" branches. One spec file per in-scope provider plus a shared spec for cross-cutting behavior (e.g., the `Helix` factory dispatch).
2. **Integration tier (gated by env vars).** Skips gracefully when creds absent. Runs against real endpoints when `HELIX_OPENAI_API_KEY`, `HELIX_AZURE_API_KEY` + `HELIX_AZURE_ENDPOINT` + `HELIX_AZURE_API_VERSION`, etc. are present. Local-dev / scheduled-CI confidence layer.

PR3 ("tests with all four providers") is satisfied for this change by the unit tier covering the three in-scope providers. Vertex coverage is **explicitly waived** for `helix-providers-phase-2` and will be delivered by `helix-vertex-provider`. CLAUDE.md project-standards block reflects this waiver verbatim.

**Reasoning citation.** Exploration §F. Vitest wins on native ESM (`"type": "module"`), TS-first DX, and dev-time-only footprint (PR2 only constrains runtime deps). MSW wins on Node-22-native-fetch interception (`nock` does not handle native fetch).

### RD-PHASE2-6 — `FilesCreateParams.purpose`: pass through unchanged

**Decision.** Whatever value the caller passes in `params.purpose`, the adapter forwards it byte-identical to the SDK call. The lib does NOT default the field, does NOT translate per provider, does NOT enforce a vocabulary. If `purpose` is absent, the SDK's own default applies.

**Reasoning citation.** Exploration §C. OpenAI and Azure accept different conventional values (`"user_data"` vs `"assistants"` are common). Picking one and translating creates a hidden coupling between caller and lib. Frozen REQ-FILES-001 already declares `purpose` optional and shape-only; pass-through is the contract that shape implies.

### RD-PHASE2-7 — OpenAI SDK version pin: `openai@^6.0.0`

**Decision.** Add `"openai": "^6.0.0"` to `package.json` `dependencies`. The Responses API surface (`client.responses.*`) and the `AzureOpenAI` class are stable in v6.

**Reasoning citation.** Exploration §A and open-question 8. v5 still uses Chat Completions as the primary path; the Responses API stabilized in v6. We pin to caret on the major because the SDK follows semver for breaking type changes.

---

## 4. Approach summary

### High-level

Each in-scope adapter file (`openai.ts`, `azure.ts`, `custom.ts`) keeps its existing `createXxxAdapter(config): Helix` signature exactly as it is today — the change is purely in the function body. The body constructs an SDK client lazily (or eagerly; sdd-design picks) from the `config` and wires each `Helix` namespace method to the SDK's equivalent.

The frozen `Helix` interface composition stays as a plain object literal returned from `createXxxAdapter`. No class hierarchy. No DI container. No port re-introduction.

```
HelixConfig (frozen)
   │
   ▼
createHelix(config)  ── (frozen dispatch in src/createHelix.ts) ──┐
                                                                  │
                                                                  ▼
                                              ┌──────────────────────────────────┐
                                              │ src/internal/providers/<kind>.ts │
                                              │  (THIS CHANGE TOUCHES ONLY 3/4)  │
                                              ├──────────────────────────────────┤
                                              │ openai.ts: new OpenAI({apiKey})  │
                                              │ azure.ts:  new AzureOpenAI({...})│
                                              │ custom.ts: new OpenAI({baseURL}) │
                                              │ vertex.ts: STUB UNCHANGED        │
                                              └──────────────────────────────────┘
                                                                  │
                                                                  ▼
                                                            openai SDK
                                                            (one runtime dep)
```

### Error model

- Adapters do NOT wrap, do NOT re-throw with new types, do NOT log.
- The `test()` method is the **sole exception** to raw passthrough — it MUST swallow internally and return `false` per REQ-TEST-002. This already works correctly via the `try { await this.models.list(); return true } catch { return false }` pattern in every stub. Phase 2 keeps that pattern.
- Custom adapter's `files.{create,list,delete}` keep their existing `throw new Error("helix-lib: 'files.<op>' not supported by provider 'custom'")` stubs — REQ-FILES-005 mandates them and Phase 1 already implements them.

### Test strategy

- `vitest.config.ts` (or inline in `package.json`) added at repo root.
- `src/internal/providers/__tests__/openai.test.ts`, `.../azure.test.ts`, `.../custom.test.ts` — unit specs.
- `tests/integration/*.test.ts` (or equivalent path; sdd-design decides exact layout) — integration specs gated by env vars, marked `describe.skipIf(!process.env.HELIX_OPENAI_API_KEY)` or equivalent.
- Coverage targets: every public REQ scenario from the frozen specs that is exercisable for an in-scope provider.

### Files purpose

Pass `params.purpose` straight to `client.files.create({ ..., purpose })` for the SDK-using providers. No defaulting, no translation.

### `package.json` deltas

- `dependencies` (new): `"openai": "^6.0.0"`.
- `devDependencies` (new): `"vitest": "^<latest>"`, `"@mswjs/interceptors": "^<latest>"` (or `"msw": "^<latest>"` if full package is preferred at sdd-design).
- `scripts` (new): `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:integration": "vitest run --dir tests/integration"` (exact wording is sdd-design's call).

Exact versions of devDeps will be locked at sdd-design / sdd-tasks time against what `npm view` reports current. The proposal does not pin them here.

---

## 5. Affected areas

### Files this change MODIFIES

| Path | Action | What changes |
|------|--------|--------------|
| `src/internal/providers/openai.ts` | REWRITE BODY | Replace every `throw new Error("not implemented")` with real `openai` SDK calls. Function signature, exports, and `createOpenAIAdapter` name stay identical. |
| `src/internal/providers/azure.ts` | REWRITE BODY | Replace every `throw new Error("not implemented")` with real `AzureOpenAI` SDK calls. `models.list` throws the documented ARM-required error. |
| `src/internal/providers/custom.ts` | REWRITE BODY | Replace `responses.create` and `models.list` `throw`s with real `OpenAI` SDK calls (with `baseURL` override). `files.{create,list,delete}` `throw` stubs stay verbatim — they are correct per REQ-FILES-005. |
| `package.json` | EDIT | Add `openai` runtime dep. Add Vitest + MSW devDeps. Add `test` script(s). |

### Files this change ADDS

| Path | Purpose |
|------|---------|
| `vitest.config.ts` (or inline `vitest` block in `package.json`; sdd-design decides) | Test runner config — Node environment, native ESM, source roots. |
| `src/internal/providers/__tests__/openai.test.ts` | Unit suite for OpenAI adapter (MSW-mocked). Exact path layout is sdd-design's call. |
| `src/internal/providers/__tests__/azure.test.ts` | Unit suite for Azure adapter (MSW-mocked). Includes the "models.list throws" assertion and the "test() returns false" assertion. |
| `src/internal/providers/__tests__/custom.test.ts` | Unit suite for Custom adapter (MSW-mocked). Includes the "files.* throws" assertions. |
| `tests/integration/*.test.ts` | Env-gated integration specs against real endpoints. |

### Files this change DOES NOT TOUCH (read-only references)

| Path | Why untouched |
|------|---------------|
| `src/internal/providers/vertex.ts` | Vertex is carved out into `helix-vertex-provider`. Stub stays verbatim. |
| `src/createHelix.ts` | Frozen public surface — `Helix` interface and `createHelix` dispatch. No change. |
| `src/index.ts` | Frozen public exports. No change. |
| `src/core/index.ts`, `src/core/types/*.ts` | Frozen public types. No change. |
| `openspec/specs/{client,responses,files,models,test}/spec.md` | Frozen Phase 1 v2 contract. Read-only. |
| `tsconfig.json` | No compiler-option change required. |
| `tsup.config.ts` (if present) | Build config unchanged; new dep `openai` is bundled-or-external per existing rules. |

---

## 6. Success criteria

- [ ] `helix.responses.create({ model, input, ... })` round-trips through real HTTP for `openai`, `azure`, and `custom`. Returned object satisfies REQ-RESP-005 (`HelixResponse` shape) and REQ-RESP-007 (`HelixUsage` token sum invariant).
- [ ] `helix.files.create / list / delete` round-trip through real HTTP for `openai` and `azure`. `FileObject` shape satisfies REQ-FILES-002. `delete` resolves with `{ id, deleted: true }` per REQ-FILES-004. Custom adapter's `files.*` `throw`s stay verbatim per REQ-FILES-005.
- [ ] `helix.models.list()` round-trips through real HTTP for `openai` and `custom`, returning `ModelInfo[]` per REQ-MODELS-002. On `azure` it throws a plain `Error` whose message names the provider, the operation, and the ARM-credentials gap.
- [ ] `helix.test()` returns `true` on success and `false` on failure for `openai` and `custom`. On `azure`, returns `false` (because `models.list()` throws). All four behaviors satisfy REQ-TEST-001 ("never rejects").
- [ ] `tsc --noEmit` reports zero errors.
- [ ] Public surface unchanged. `src/index.ts` exports the same set of symbols Phase 1 v2 froze.
- [ ] Vitest unit suite green. Coverage spans:
  - Request-shape mapping for `responses.create` per provider (Azure deployment-as-model, custom baseURL forwarding).
  - Response-shape conformance for `HelixResponse`, `FileObject`, `ModelInfo`.
  - Raw error passthrough on every supported call.
  - `models.list` throws on Azure with the documented message.
  - `files.*` throws on Custom with the existing message format.
  - `test()` returns `false` on Azure and on any thrown internal call; returns `true` when the underlying operation succeeds.
- [ ] Integration suite passes when env vars are present (or skips gracefully when absent).
- [ ] `package.json` adds exactly one runtime dependency (`openai`) and the documented devDeps. No accidental additions.
- [ ] `src/internal/providers/vertex.ts` is byte-identical to its archived Phase 1 v2 state.

---

## 7. Breaking changes

**None.** The public surface (every export from `src/index.ts`) is bit-identical before and after this change.

A consumer who pinned `@fluxaria/helix-lib@0.0.1` and only used the type system would see no change. A consumer who actually called any `Helix` method on `openai`, `azure`, or `custom` previously got `Error("not implemented")` and after this change gets a real response — that is the **point** of Phase 2, not a breaking change.

---

## 8. Migration / consumer impact

### `axium-api` (the real consumer)

After this change ships, `axium-api` can adopt `@fluxaria/helix-lib` end-to-end for **all** of its OpenAI, Azure-OpenAI, and OpenAI-compatible (custom) flows. The integration is:

```ts
const helix = createHelix({ provider: "openai", apiKey: process.env.OPENAI_API_KEY! });
const res = await helix.responses.create({ model: "gpt-4o", input: [...] });
```

For `azure`, axium-api must accept that `helix.test()` returns `false` and `helix.models.list()` throws — these are Phase 2 documented limitations, addressed by `helix-azure-config-v2`. axium-api should call `responses.create` directly with a known deployment name and catch errors locally for health-check use cases until then.

For `vertex`, axium-api **cannot yet adopt** the lib — it must wait for `helix-vertex-provider`. Until then, any Vertex flows in axium-api remain on whatever transport they currently use.

### Error-handling code at the consumer

Because `HelixError` is still deferred, consumers will catch raw `openai` SDK error types (`APIError`, `APIConnectionError`, `RateLimitError`, etc.) on `openai` / `azure` / `custom`. axium-api should write its catch blocks against the SDK's documented error hierarchy and accept that the catch-block surface will tighten when `helix-error-model` ships. This trade-off is explicit and was ratified at Phase 1 v2 archive.

### General consumers

No changes to imports, no signature drift, no behavioral surprise — except that calls which previously threw `Error("not implemented")` now succeed (or fail with a real provider error). This is the intended unblock.

---

## 9. Risks

| # | Risk | Carried from exploration | Mitigation in Phase 2 |
|---|------|--------------------------|-----------------------|
| R1 | Azure `test()` permanently returns `false` for as long as `models.list()` is unreachable. Consumers may build dashboards around `test()` and find Azure looks "always down." | Exploration §C, §H | Document loudly in the change README and in the Azure adapter's source-level JSDoc. Spec phase pins the assertion. Successor `helix-azure-config-v2` will fix the underlying gap. |
| R2 | Heterogeneous error shapes between providers (OpenAI SDK errors on `openai`/`azure`/`custom`; eventually raw `fetch` rejections on `vertex`). Consumers must write a per-provider catch switch until `helix-error-model` lands. | Exploration §E | Documented in §8 above. The CLAUDE.md project-standards block already flags PR6 as deferred. axium-api consumes the trade-off knowingly. |
| R3 | OpenAI SDK v6 Responses API surface evolves. Pinning `^6.0.0` accepts non-breaking changes; a v6 minor that subtly alters response shape could ripple into our normalization. | Exploration §A and risks §3 | Lock the SDK version in `package-lock.json` at apply time, not just `^6.0.0` in `package.json`. Integration tier catches regressions against real endpoints. |
| R4 | Reasoning-model rejection of `temperature` (o-series, gpt-5-mini, gpt-5-nano). Caller-pass-through means caller errors bubble up unchanged. Some users may expect the lib to "just work." | Exploration §G open-question 2 | Pre-decided as RD-PHASE2-3. Document in README and in the Azure/OpenAI adapter JSDoc that the lib does NOT auto-strip fields. Caller owns model quirks. |
| R5 | Files `purpose` value mismatch (caller sends `"user_data"` to Azure when Azure expects `"assistants"`, or vice versa). Pass-through means the provider rejects with a confusing error. | Exploration §C | Pre-decided as RD-PHASE2-6. Document the allowed values per provider in the README and in the `FilesCreateParams.purpose` JSDoc. Caller picks the right value. |
| R6 | Adding `openai` as a runtime dep increases install size and pulls in the SDK's surface area into our bundled output (esm + cjs builds). | Exploration §A transport matrix | The SDK is zero-runtime-dep itself. `tsup` already bundles intelligently — sdd-design will confirm whether `openai` should be a `peerDependency` instead of a hard `dependency` (likely no, since axium-api wants a single install). |
| R7 | Vitest + MSW devDep additions might conflict with the future `helix-vertex-provider` change (which also needs MSW for the OAuth2 token endpoint and Gemini API). | Exploration §F, engram-saved Vertex scope | None needed — MSW handles both fetch and SDK transports. The Vertex change inherits the test infrastructure laid down here. |
| R8 | Custom provider with a baseURL pointing at a non-OpenAI-compatible endpoint will surface confusing SDK errors (the SDK assumes OpenAI Response shape). | Implicit — Phase 1 spec scopes "custom" to OpenAI-compatible. | REQ-RESP / REQ-MODELS already say custom is "OpenAI-compatible." Document in the README that `provider: "custom"` requires an OpenAI-compatible endpoint. Errors propagate raw. |

Items the spec/design phases must adjudicate (open questions for sdd-spec / sdd-design):

- **OQ1.** Is the test-file location `src/internal/providers/__tests__/*.test.ts` (co-located) or `tests/unit/providers/*.test.ts` (centralized)? sdd-design picks; either works. The proposal does not pin it.
- **OQ2.** Should `tsup` mark `openai` as `external` in the build, or bundle it? Standard practice for libraries is `external` (consumer installs it). sdd-design confirms.
- **OQ3.** Exact MSW package: `@mswjs/interceptors` (lower-level, fetch-only) or full `msw` (handlers + interceptors)? sdd-design picks based on test ergonomics.
- **OQ4.** Whether to publish a `tests/fixtures/` directory of canned OpenAI/Azure responses, or build them inline in each spec. sdd-design decides.

---

## 10. Successor changes

Explicit follow-up changes that this proposal commits to NOT delivering and instead defers:

| Successor | Triggers / scope | Status |
|-----------|------------------|--------|
| `helix-vertex-provider` | Replaces the Vertex stub with raw `fetch` + `node:crypto` JWT signing + Gemini-to-Responses normalization + ADC fallback. Adds Vertex unit + integration tests. Inherits the Vitest + MSW infrastructure laid down by this change. Full scope cached in engram (`helix-lib/future-changes/helix-vertex-provider`). | Planned — not yet started. |
| `helix-error-model` | Introduces `HelixError`, `HelixErrorKind`, and per-provider error mapping. Replaces every raw error throw / passthrough across all four adapters. Touches public surface — adds new exports. | Planned — not yet started. |
| `helix-tools` | Introduces `NativeTool`, `FunctionTool`, `ToolChoice`, function-call output variants, and the runtime tool loop. Touches public surface. | Planned — not yet started. |
| `helix-streaming` | Introduces streaming variant of `responses.create` (`AsyncIterable<StreamDelta>` or equivalent). Touches public surface. | Planned — not yet started. |
| `helix-azure-config-v2` | Adds `deploymentName` (and / or service-principal auth) to `HelixConfig.azure`, makes `models.list()` work, and unblocks Azure `test()`. Touches public surface. | Planned — not yet started. |

Each successor gets its own `/sdd-new` cycle. None of them block on each other strictly, except that `helix-error-model` should ideally land before `helix-vertex-provider` to avoid a third raw-error dialect joining the system. That sequencing is a planning concern, not a Phase 2 concern.

---

## 11. Next phase

`sdd-spec` and `sdd-design` MAY run in parallel.

- **sdd-spec** — produces delta specs (or change-scoped specs under `openspec/changes/helix-providers-phase-2/specs/`) that translate the success criteria above into Given/When/Then scenarios with RFC 2119 keywords. Expected domains: `responses` (per-provider request shaping + response normalization assertions), `files` (per-provider availability and OpenAI/Azure round-trip), `models` (Azure-throws assertion + OpenAI/Custom normalization), `test` (boolean contract under each provider's failure mode). Frozen `openspec/specs/**` are read-only references.
- **sdd-design** — pins the implementation-level details that this proposal deferred: test-file layout, exact MSW package, `tsup` external/bundle policy for `openai`, Azure `models.list()` error message wording, integration env-var naming, and any sequence diagrams worth capturing for a single happy-path `responses.create` flow per provider. Also pins the lazy-vs-eager SDK client construction style inside each adapter.

---

**End of proposal.**
