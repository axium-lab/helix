# Proposal: helix-azure-list-models — Real `models.list()` for Azure adapter

**Change**: `helix-azure-list-models`
**Date**: 2026-04-28
**Author**: orchestrator-delegated (sdd-propose)
**Status**: ready for sdd-spec / sdd-design
**Artifact store**: openspec
**Predecessor**: `helix-providers-phase-2` (archived 2026-04-28)
**Parallel SDD (line-disjoint)**: `helix-files-params-tightening`
**Successors (planned)**: `helix-vertex-provider`, `helix-error-model`, `helix-azure-config-v2`

---

## 1. Intent

### What

Replace the synchronous `throw` stub at `src/internal/providers/azure.ts:39-44` with a real `models.list()` implementation. The new implementation MUST hit the Azure data-plane deployments endpoint (`/openai/deployments?api-version={apiVersion}`) using native `fetch`, normalize the response to `ModelInfo[]`, and surface failures as a structured, discriminated error object (kind: `auth` | `config` | `upstream` | `network`). The fix is local to `azure.ts`; the public `Helix.models.list` signature, all other adapter files, and every other Azure method (`responses.create`, `files.*`, `test()`) are untouched.

### Why now

- **Phase 2's justification was wrong.** `helix-providers-phase-2` carved out Azure's `models.list()` with a documented message claiming "Azure data-plane deployment listing was retired April 2024; ARM management plane requires credentials not present in `HelixConfig.azure`." That justification is **incorrect**. The endpoint that was retired is a different one (the Cognitive Services management endpoint). The data-plane `/openai/deployments?api-version={apiVersion}` endpoint with `api-key` header is **alive and works today**. Confirmed by working code in `axium-api`'s `TestConnectionService` (the consumer of helix-lib), which queries it daily in production.
- **The gap is blocking the consumer.** `axium-api` cannot use `helix.models.list()` for Azure today — every call throws. axium-api currently bypasses helix-lib for Azure deployment listing, defeating the whole point of the unified provider abstraction.
- **The fix is small.** No new dependency, no new public type, no signature change. Just replace a 6-line `throw` with a ~30-line `fetch`-based body.
- **Parallel SDD coordination.** A separate SDD `helix-files-params-tightening` is in flight and touches lines 26-28 of the same file (the `as Parameters<typeof client.files.create>[0]` cast in `azure.files.create`). The two changes are line-disjoint and order-independent — explicit independence note in §6.

### Success looks like

1. `helix.models.list()` on the Azure adapter resolves with a sorted `ModelInfo[]` whose entries map one-to-one to the deployments returned by `${endpoint}/openai/deployments?api-version={apiVersion}`.
2. Failure modes return a **structured discriminated error** (kind: `auth` | `config` | `upstream` | `network`) — not a raw `Error` with a free-form message — so callers can branch on `err.kind` without string-matching.
3. No HTTP request is initiated outside the documented endpoint. No new runtime dependency. No new public export from `src/index.ts`.
4. `helix.test()` on Azure now resolves with `true` when credentials are valid (Phase 2 limitation R1 is closed by this change).
5. Unit tests cover all four error branches plus the happy path. Integration test (env-gated) hits the real endpoint and asserts the sorted `ModelInfo[]` shape.
6. `tsc --noEmit` reports zero errors. `vitest run` is green.

---

## 2. Background

Phase 2 (`helix-providers-phase-2`) explicitly ratified RD-PHASE2-4: Azure `models.list()` throws a documented `Error`, and `test()` permanently returns `false` on Azure. The reasoning cited was: "data-plane deployments endpoint retired April 2024; ARM management plane requires RBAC credentials." That reasoning was inherited from a stale assumption and was **not verified** against the current Azure documentation or against axium-api's production behavior.

Working axium-api code (consumer-side reference, **not to be copied verbatim** because the contract differs):

```ts
const base = params.baseUrl!.replace(/\/$/, '');
const res = await fetch(
  `${base}/openai/deployments?api-version=${AZURE_DEPLOYMENTS_API_VERSION}`,
  { headers: { 'api-key': params.apiKey } },
);
if (res.status === 401) return { ok: false, reason: 'auth' };
if (res.status === 404) return { ok: false, reason: 'api-version' };
if (!res.ok) return { ok: false, reason: 'upstream', status: res.status };
const data = await res.json();
return data.data
  .filter((d) => !NON_TEXT_MODEL_PREFIXES.some(p => d.id.startsWith(p)))
  .map((d) => ({ id: d.id, owned_by: 'azure' }))
  .sort((a, b) => a.id.localeCompare(b.id));
```

helix-lib differs from axium-api in two ways that matter:

- **Contract**: helix-lib returns `Promise<ModelInfo[]>` and `throws` on failure (per `Helix.models.list` signature). axium-api uses an `{ ok, reason }` envelope shape internal to its `TestConnectionService`. We do NOT adopt that envelope.
- **Filtering**: axium-api filters non-text model prefixes for its UI. helix-lib is provider-agnostic — consumers filter, the lib does not. We pass through every deployment unchanged.

This change therefore **corrects** Phase 2's RD-PHASE2-4 (override the throw stub) and **closes** Phase 2's risk R1 (Azure `test()` permanently false).

---

## 3. Scope

### IN scope

1. **Replace lines 39-44 of `src/internal/providers/azure.ts`** — the entire `models: { list() { throw ... } }` block — with a real implementation.
2. **Use native `fetch`** (no new library, per PR2). The `openai` SDK does not expose `client.deployments.list()`; the data-plane deployments endpoint is Azure-specific and not part of the OpenAI Responses API surface.
3. **Endpoint construction**: `${config.endpoint.replace(/\/$/, "")}/openai/deployments?api-version=${config.apiVersion}`. Trailing-slash normalization on `endpoint` is mandatory because `HelixConfig.azure.endpoint` is a free-form URL and consumers may or may not include a trailing slash.
4. **Headers**: `{ "api-key": config.apiKey }`. Azure data-plane convention. The `Authorization: Bearer` header used by OpenAI is **not** what Azure data-plane accepts.
5. **Discriminated error mapping** for failure modes. The shape is:
   - `401 Unauthorized` → `kind: "auth"` with a message naming the provider and operation
   - `404 Not Found` → `kind: "config"` with a message about `apiVersion` being deprecated or malformed
   - any other non-OK HTTP status → `kind: "upstream"` with the status code and operation in the message
   - thrown / rejected `fetch` (network failure, DNS, TLS, abort) → `kind: "network"` with the original error preserved as `cause`
6. **Response normalization**: parse `await res.json()`, take `data.data` (an array of deployment objects), and map each to `{ id: d.id, object: "model" as const, created: 0, owned_by: "azure" }`. The Azure deployments response does NOT include a `created` epoch field; `0` is the documented filler value. `owned_by` is hard-coded to `"azure"` because deployments are tenant-owned by definition (no per-deployment owner field).
7. **Sort by `id` ascending** using `localeCompare`. Deterministic ordering for tests, matches axium-api convention.
8. **No filtering.** Helix-lib stays provider-agnostic — every deployment in `data.data` MUST appear in the returned `ModelInfo[]`. Consumers (including axium-api) filter for their own UI needs.
9. **Update the existing integration test** (`tests/integration/azure.test.ts`) to remove the obsolete "models.list throws" assertion, replace it with a "models.list returns sorted ModelInfo[]" env-gated assertion, and update the "test() resolves false" assertion to "test() resolves true" (now that `models.list` works, Phase 2's R1 closes).
10. **Add a unit test** (`tests/unit/azure-models-list.test.ts` or whatever the design phase chooses for layout) that mocks `fetch` and asserts: happy-path mapping + sort, 401 → `auth`, 404 → `config`, 500 → `upstream`, network throw → `network`.

### OUT of scope (explicitly deferred)

- **Vertex `models.list`.** Vertex auth is fundamentally different (Google ADC / service-account JWT signing with `node:crypto`). Lives in successor `helix-vertex-provider`. Untouched here.
- **Cast removal in `azure.files.create`** (lines 26-28 of `azure.ts`). Owned by parallel SDD `helix-files-params-tightening`. Lines 26-28 of `azure.ts` MUST NOT be touched in this change. See §6 independence note.
- **Any change to OpenAI or custom adapters.** `src/internal/providers/openai.ts` and `src/internal/providers/custom.ts` already implement `models.list()` correctly via `client.models.list()`. They are read-only references in this change.
- **Public surface changes.** No new exports from `src/index.ts`. No change to the `Helix.models.list` signature. No new public type for the discriminated error (see open question OQ1 below — internal type vs. public type is the central design decision).
- **Generalized `HelixError` adoption.** Phase 2 explicitly deferred PR6 to successor `helix-error-model`. This change does **not** introduce a project-wide error model; it introduces error mapping **scoped to this single method's failure surface** as a stepping stone. `helix-error-model` will later subsume / refactor whatever shape is chosen here.
- **Pagination.** Azure deployments responses are typically small (<100 entries per subscription) and the data-plane endpoint returns them in a single page. If Azure ever paginates this endpoint, a follow-up SDD will handle it.
- **Deployment metadata beyond `ModelInfo`.** Azure's deployments response carries fields like `model`, `provisioning_state`, `sku`, `properties.deployment_id`. We do NOT surface these. The `ModelInfo` shape is frozen (`{ id, object, created, owned_by? }`) and we conform to it.
- **Adding new spec documents.** This change AMENDS `openspec/specs/azure/spec.md` (REQ-AZ-004 and REQ-AZ-005 must be updated). The update vehicle is a delta spec under `openspec/changes/helix-azure-list-models/specs/azure/spec.md`, not an edit to the frozen main spec.

### Deliberately untouched files

- `src/internal/providers/openai.ts` — already correct.
- `src/internal/providers/custom.ts` — already correct.
- `src/internal/providers/vertex.ts` — owned by `helix-vertex-provider`.
- `src/internal/providers/azure.ts` lines 1-38 and 45-54 — only lines 39-44 change.
- `src/createHelix.ts`, `src/index.ts`, `src/core/**` — public surface, frozen.
- `package.json` — no dep changes (native `fetch`).

---

## 4. Approach

### High-level

```
helix.models.list()  on  azure adapter
        │
        ▼
fetch(${endpoint.replace(/\/$/, "")}/openai/deployments?api-version=${apiVersion},
      { headers: { "api-key": apiKey } })
        │
        ├── network throw  ──►  throw { kind: "network", message, cause }
        ▼
   res.status
        ├── 401  ──►  throw { kind: "auth",     message }
        ├── 404  ──►  throw { kind: "config",   message }
        ├── !ok  ──►  throw { kind: "upstream", message, status }
        ▼
   res.json() → { data: [{ id, ... }, ...] }
        │
        ▼
   data.map(d => ({ id: d.id, object: "model", created: 0, owned_by: "azure" }))
        │
        ▼
   .sort((a, b) => a.id.localeCompare(b.id))
        │
        ▼
   Promise<ModelInfo[]>
```

### Rationale per scope item

- **PR2 — native `fetch`, no library.** The `openai` SDK does not model Azure deployments; importing a separate `@azure/arm-cognitiveservices` package is a heavyweight ARM SDK we don't need. Native `fetch` is one statement. Node 22 has it built in.
- **PR6 — discriminated error.** A free-form `Error` message forces consumers to string-match (`err.message.includes("api-version")`) which is fragile. A `kind` discriminator lets callers `switch (err.kind)` cleanly. This is a stepping stone to `helix-error-model`'s full `HelixError` union — design phase will decide whether to (a) introduce a small internal type local to `azure.ts`, (b) introduce an internal shared type at `src/internal/errors.ts` for future adapters to reuse, or (c) inline-anonymous-throw a minimal object literal. See OQ1.
- **No filter — provider-agnostic.** Consumer-side filtering is a UI concern. The library exposes the raw deployment list and lets consumers decide. axium-api keeps its `NON_TEXT_MODEL_PREFIXES` filter on its side.
- **`created: 0`.** The Azure deployments response does not include a Unix epoch creation timestamp. `ModelInfo.created` is required (`number`) and not optional, so we use `0` as a documented sentinel rather than make `created` optional in the public type (which would be a breaking change to `ModelInfo`).
- **`owned_by: "azure"` constant.** Azure deployments are tenant-owned. There is no per-deployment owner. Consumers seeing `owned_by === "azure"` know it's an Azure deployment without inspecting other context.
- **Sort by `id`.** Deterministic for tests. axium-api precedent. Alphabetic by deployment name is the natural UI order.

### Error model: scope and tradeoff

The discriminated error shape (`{ kind: "auth" | "config" | "upstream" | "network", message: string, cause?: unknown, status?: number }`) is **scoped to this method's failure surface**. It is NOT a public export, NOT a project-wide error type, NOT named `HelixError`. The eventual `helix-error-model` change will introduce the full project-wide `HelixError` union and migrate this method's error to that shape. The naming we pick here MUST NOT collide with the future `HelixError` name.

Working name proposed for design phase: `AzureModelsListError` (purely internal). Final name and location chosen at sdd-design.

### Test strategy

- **Unit tier** — mock `fetch` (Vitest's `vi.spyOn(globalThis, "fetch")`); five scenarios:
  1. Happy path: 200 + `{ data: [{ id: "gpt-4o" }, { id: "gpt-35-turbo" }] }` → returns `[{ id: "gpt-35-turbo", ... }, { id: "gpt-4o", ... }]` sorted.
  2. 401 → throws with `kind: "auth"`.
  3. 404 → throws with `kind: "config"`.
  4. 500 → throws with `kind: "upstream"`, `status: 500`.
  5. `fetch` rejects (network) → throws with `kind: "network"`, `cause` set.
- **Integration tier** — env-gated by `HELIX_AZURE_API_KEY` + `HELIX_AZURE_ENDPOINT` + `HELIX_AZURE_API_VERSION`. Asserts `models.list()` returns `ModelInfo[]`, length > 0, sorted, every entry has `owned_by === "azure"`. Replaces the obsolete "throws ARM message" assertion.
- **`test()` integration** — flips from "resolves false" to "resolves true" once `models.list` works.

---

## 5. Affected areas

### Files this change MODIFIES

| Path | Action | What changes |
|------|--------|--------------|
| `src/internal/providers/azure.ts` | EDIT lines 39-44 only | Replace the `throw` stub with the `fetch`-based implementation per §4. Lines 1-38 and 45-54 are untouched. |
| `tests/integration/azure.test.ts` | EDIT | Remove the "models.list throws" assertion. Add "models.list returns sorted ModelInfo[]". Flip "test() resolves false" → "test() resolves true". Remove the `AZURE_MODELS_LIST_ERROR_MSG` constant. |

### Files this change ADDS

| Path | Purpose |
|------|---------|
| `tests/unit/azure-models-list.test.ts` (path subject to sdd-design) | Five-scenario unit suite mocking `fetch`. |
| `openspec/changes/helix-azure-list-models/specs/azure/spec.md` | Delta spec amending REQ-AZ-004 (was: throws; now: returns) and REQ-AZ-005 (was: test() false; now: test() true). New REQs for error mapping, endpoint shape, sort order. |
| Possibly `src/internal/errors.ts` (subject to OQ1) | Internal error type — only if design picks option (b). |

### Files this change DOES NOT TOUCH

| Path | Why untouched |
|------|---------------|
| `src/internal/providers/openai.ts` | Already implements `models.list` correctly. |
| `src/internal/providers/custom.ts` | Already implements `models.list` correctly. |
| `src/internal/providers/vertex.ts` | Owned by `helix-vertex-provider`. |
| `src/internal/providers/azure.ts` lines 1-38 and 45-54 | Only the throw block changes. The `AzureOpenAI` client construction, `responses.create`, `files.*`, and `test()` are untouched. |
| `src/internal/providers/azure.ts` lines 26-28 | Owned by parallel SDD `helix-files-params-tightening`. |
| `src/createHelix.ts`, `src/index.ts`, `src/core/index.ts`, `src/core/types/*.ts` | Public surface, frozen. |
| `openspec/specs/azure/spec.md` | Frozen main spec — amended via delta, not edited directly. |
| `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts` | No dep changes, no build changes, no test runner changes. |

---

## 6. Independence from `helix-files-params-tightening`

The parallel SDD `helix-files-params-tightening` operates on **lines 26-28** of `src/internal/providers/azure.ts` (the `as Parameters<typeof client.files.create>[0]` cast in `files.create`). This SDD operates on **lines 39-44** of the same file (the `models.list` throw stub).

- **Line-disjoint**: zero overlap. The two diffs cannot conflict at the line level.
- **Order-independent**: applying `helix-files-params-tightening` first then this change produces the same final file as applying this change first then `helix-files-params-tightening`. Verified by reading the file: lines 26-28 and lines 39-44 are inside two different namespace blocks (`files: { ... }` vs. `models: { ... }`) of the same returned object literal.
- **Test independence**: `helix-files-params-tightening` adds tests for `files.create` parameter typing. This change adds tests for `models.list` HTTP behavior. Test files are disjoint.
- **CI guard**: each change's verify phase will grep its own diff to assert it did not accidentally touch the other change's lines. A `git diff` filter such as `grep -E "^\+.*(deployments|api-key|files\.create)"` distinguishes them cleanly.

Either change MAY be applied first. No coordination beyond this independence statement is required.

---

## 7. Decisions ratified

These are user-ratified during exploration (orchestrator-context observation #98) and are fixed inputs for sdd-spec / sdd-design / sdd-apply. Do NOT relitigate.

### RD-AZ-LM-1 — Endpoint and headers

`${endpoint.replace(/\/$/, "")}/openai/deployments?api-version=${apiVersion}` with header `{ "api-key": apiKey }`. No `Authorization: Bearer`. No alternate endpoint. No ARM management plane.

### RD-AZ-LM-2 — Native `fetch` only

No new library. `openai` SDK does not model deployments. Native `fetch` is the right transport.

### RD-AZ-LM-3 — Discriminated error shape

Failures throw an object with a `kind` discriminator (`"auth" | "config" | "upstream" | "network"`), not a plain `Error`. Internal scope only — not exported from `src/index.ts`. Final naming and location chosen at sdd-design (OQ1). The four kinds are fixed.

### RD-AZ-LM-4 — No filtering, provider-agnostic

Every deployment in `data.data` appears in the returned `ModelInfo[]`. Consumers filter.

### RD-AZ-LM-5 — `created: 0`, `owned_by: "azure"` constants

Azure deployments lack a creation epoch and a per-deployment owner. We fill `created: 0` and hard-code `owned_by: "azure"` rather than break `ModelInfo` shape.

### RD-AZ-LM-6 — Sort ascending by `id` via `localeCompare`

Deterministic, alphabetic, matches axium-api precedent.

### RD-AZ-LM-7 — Phase 2's RD-PHASE2-4 is overridden, R1 closes

The Phase 2 throw contract for Azure `models.list` is replaced. Phase 2's documented limitation that `test()` permanently returns `false` on Azure is closed by this change.

---

## 8. Risks

| # | Risk | Mitigation in this change |
|---|------|---------------------------|
| R1 | **Azure data-plane `/openai/deployments` is itself eventually deprecated.** Microsoft has a history of churning Azure OpenAI APIs. If this endpoint is retired in some future `api-version`, callers will see `404` (mapped to `kind: "config"`), and we'll need a follow-up SDD. | Document the endpoint and `api-version` dependency in the spec. The 404→`config` mapping already gives consumers a clean signal. Successor `helix-azure-config-v2` may add ARM as an alternate transport if data-plane truly dies. |
| R2 | **`api-version` drift across Azure tenants.** Customers on older `api-version` values (e.g., `2023-05-15`) may see different response shapes. | The endpoint contract has been stable since at least `2023-12-01-preview`. The integration test runs against the configured `apiVersion` so consumers verify their own tenant. Unit test pins a current `api-version` for shape assertions. |
| R3 | **Deployment-vs-model semantic mismatch.** A `ModelInfo.id` returned here is the deployment NAME (consumer-chosen), not the underlying model NAME (e.g., `gpt-4o`). Some consumers may expect model names. | Document explicitly in the spec: "On Azure, `ModelInfo.id` is the deployment name; the underlying base model is not surfaced." This matches Azure's `responses.create` convention (deployment name is the `model` field). |
| R4 | **Parallel SDD coordination.** `helix-files-params-tightening` touches the same file. | §6 independence note. Verify-phase grep tests in both SDDs guard against accidental cross-edits. |
| R5 | **`HelixError` future migration.** When `helix-error-model` lands, the discriminated shape introduced here will be migrated / refactored / wrapped. Consumers writing catch blocks against the kind-shape today take on a small migration tax. | Document in the change README and in the JSDoc on the throwing method. Keep the kind names (`auth | config | upstream | network`) aligned with what `helix-error-model` is likely to converge on so the migration is a rename/move, not a redesign. |
| R6 | **`fetch` global polyfill on older Node.** Helix's `engines.node` is `≥22`; native `fetch` is built in. If anyone runs on Node 18, no polyfill is shipped. | Acceptable — `engines.node ≥22` is documented and `package.json` enforces it on install. |
| R7 | **Empty deployment list.** A tenant with zero deployments returns `{ data: [] }` and we return `[]`. Some consumers may treat `[]` as an error. | Returning `[]` is correct semantics — the request succeeded, the tenant has no deployments. Document explicitly. Test asserts `[]` is a valid happy-path return. |

---

## 9. Open questions for sdd-spec / sdd-design

- **OQ1.** Where does the discriminated error type live? Three options:
  - (a) Inline anonymous object literal thrown at each call site — minimal surface, most local, slightly more code duplication inside `azure.ts`.
  - (b) Named type in a new file `src/internal/errors.ts` — internal but reusable for future adapters; sets a precedent that `helix-error-model` will inherit cleanly.
  - (c) Named type local to `azure.ts` — middle ground, no new file, but type isn't shared.
  - sdd-design picks. The proposal does not pin this.
- **OQ2.** Exact unit-test file path: `tests/unit/azure-models-list.test.ts`, `tests/unit/providers/azure-models-list.test.ts`, or co-located under `src/internal/providers/__tests__/azure-models-list.test.ts`? sdd-design picks.
- **OQ3.** Error message wording for each kind. The proposal pins the kinds; the strings are sdd-design's call. Suggested templates:
  - `auth`: `"helix-lib: Azure models.list — invalid api-key (HTTP 401)"`
  - `config`: `"helix-lib: Azure models.list — apiVersion '${apiVersion}' rejected by endpoint (HTTP 404). Verify api-version is current."`
  - `upstream`: `"helix-lib: Azure models.list — upstream error (HTTP ${status})"`
  - `network`: `"helix-lib: Azure models.list — network error (see cause)"`
- **OQ4.** Should the discriminated error carry `provider: "azure"` and `operation: "models.list"` fields? This would help when `helix-error-model` lands (consumers can branch on provider + operation + kind generically). sdd-design picks.
- **OQ5.** Spec delta location: `openspec/changes/helix-azure-list-models/specs/azure/spec.md` (delta amending main spec) is the proposed convention. sdd-spec confirms or relocates.

---

## 10. Dependencies

**None new.** Native `fetch` is built into Node ≥22 (already required by `package.json`). No npm package added. No npm package removed.

---

## 11. Successor changes touched

| Successor | Effect of this change |
|-----------|----------------------|
| `helix-vertex-provider` | Unaffected. Vertex `models.list` is its own concern. |
| `helix-error-model` | This change introduces an internal discriminated error shape with kind names (`auth | config | upstream | network`) intended to align with the eventual `HelixError` union. `helix-error-model` will subsume / migrate this internal type. |
| `helix-azure-config-v2` | Phase 2's R1 (Azure `test()` permanently false) closes here. `helix-azure-config-v2` is no longer required to fix that gap. It remains relevant for adding `deploymentName` and / or service-principal auth to `HelixConfig.azure`, which are separate concerns. |
| `helix-files-params-tightening` | Parallel, line-disjoint, order-independent (see §6). |

---

## 12. Next phase

`sdd-spec` and `sdd-design` MAY run in parallel.

- **sdd-spec** — produces a delta spec at `openspec/changes/helix-azure-list-models/specs/azure/spec.md` that:
  - REPLACES REQ-AZ-004 with the new contract (returns sorted `ModelInfo[]`, throws discriminated error on failure).
  - REPLACES REQ-AZ-005 with the new contract (`test()` returns `true` on valid creds, `false` on failure).
  - ADDS new REQs for: endpoint shape (`/openai/deployments?api-version=...`), header shape (`api-key`), sort order, error-kind mapping (one scenario per kind), `created: 0` / `owned_by: "azure"` constants, no-filter rule.
  - All scenarios are Given/When/Then with RFC 2119 keywords.
- **sdd-design** — pins the implementation-level details deferred above:
  - OQ1: error-type location and naming.
  - OQ2: unit-test file path.
  - OQ3: exact error message strings.
  - OQ4: error-shape extra fields (`provider`, `operation`).
  - Sequence diagram for the `fetch` happy path and each error branch.

---

**End of proposal.**
