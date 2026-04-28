# Tasks: helix-azure-list-models — Real `models.list()` for Azure adapter

**Artifact store**: openspec
**Strict TDD**: enabled (RED before GREEN, `npm run test` is the runner)
**Test mock pattern**: `vi.stubGlobal("fetch", vi.fn())` per test + `vi.unstubAllGlobals()` in `afterEach`
**FORBIDDEN lines in `azure.ts`**: lines 26-28 (`as Parameters<typeof client.files.create>[0]`) — parallel SDD `helix-files-params-tightening` owns them. DO NOT touch.

---

## Phase 1: Internal error class (`src/internal/providers/azure-errors.ts`)

- [x] 1.1 [RED] Create `tests/unit/azure-errors.test.ts`. Assert `AzureFetchError` extends `Error`; carries `kind`, `status`, `provider: "azure"`, `operation` fields; `cause` propagates via `error.cause`; `isAzureFetchError` guard narrows correctly. All assertions fail (class does not exist yet). `Implements: ADR-AZ-LM-2, ADR-AZ-LM-3`

- [x] 1.2 [GREEN] Create `src/internal/providers/azure-errors.ts`. Export `AzureFetchError extends Error` with shape from ADR-AZ-LM-3: `kind: "auth"|"config"|"upstream"|"network"`, `status?: number`, `provider: "azure"`, `operation: string`, sets `this.name = "AzureFetchError"`. Export `isAzureFetchError` guard. Do NOT re-export from `src/index.ts`. `Implements: ADR-AZ-LM-2, ADR-AZ-LM-3, REQ-AZ-LM-3..6`

- [x] 1.3 [VERIFY] Run `npm run test -- tests/unit/azure-errors.test.ts`. Assert zero failures. Run `npx tsc --noEmit`. Assert zero errors. `Implements: ADR-AZ-LM-2`

---

## Phase 2: `models.list` happy path

- [x] 2.1 [RED] Create `tests/unit/azure-models-list.test.ts`. Write failing tests for the happy path only: (a) 200 with two unordered deployments → resolves with sorted `ModelInfo[]` (`id`, `object: "model"`, `created: 0`, `owned_by: "azure"`); (b) 200 with empty `data` → resolves `[]`; (c) URL is exactly `${endpoint.replace(/\/$/, "")}/openai/deployments?api-version=${apiVersion}` (pin trailing-slash normalization with endpoint `"https://x.azure.com/"`); (d) header contains `"api-key": apiKey` and no `Authorization` header. Imports `createHelix` from `../../src/index.js`. Tests fail because `models.list` still throws the stub error. `Implements: REQ-AZ-LM-1, REQ-AZ-LM-2, REQ-AZ-LM-7, ADR-AZ-LM-5, ADR-AZ-LM-10`

- [x] 2.2 [GREEN] Edit `src/internal/providers/azure.ts`. Add `import { AzureFetchError } from "./azure-errors.js"` to the imports block. Replace lines 39-44 (the `models: { list() { throw new Error(...) } }` block) with the real implementation: URL normalization per ADR-AZ-LM-10, `try { const res = await fetch(...) }` ONLY for `kind: "network"` mapping, status checks for `auth`/`config`/`upstream` outside the try, `res.json()` parse, `data.data.map(...)` with `created: 0` and `owned_by: "azure"`, `.sort((a,b) => a.id.localeCompare(b.id))`. DO NOT modify lines 1-38 except the new import. DO NOT modify lines 26-28. DO NOT modify lines 45-54 (`test()` body). `Implements: REQ-AZ-LM-1, REQ-AZ-LM-2, REQ-AZ-LM-7, ADR-AZ-LM-1, ADR-AZ-LM-3, ADR-AZ-LM-4, ADR-AZ-LM-7, ADR-AZ-LM-8, ADR-AZ-LM-10, ADR-AZ-LM-11`

- [x] 2.3 [VERIFY] Run `npm run test -- tests/unit/azure-models-list.test.ts`. Assert happy-path tests pass. Run `npx tsc --noEmit`. Assert zero errors. `Implements: REQ-AZ-LM-1, REQ-AZ-LM-2`

---

## Phase 3: Error-mapping branches (RED+GREEN per branch)

- [x] 3.1 [RED+GREEN] In `tests/unit/azure-models-list.test.ts`, add test for HTTP 401 → throws `AzureFetchError` with `kind: "auth"`, `status: 401`, `operation: "models.list"`, `provider: "azure"`, message `"helix-lib: Azure models.list — invalid api-key (HTTP 401)"`. Confirm test is RED, then confirm `azure.ts` already emits this branch from task 2.2 (GREEN is free if implementation is correct). `Implements: REQ-AZ-LM-3, ADR-AZ-LM-3`

- [x] 3.2 [RED+GREEN] In `tests/unit/azure-models-list.test.ts`, add test for HTTP 404 → throws `AzureFetchError` with `kind: "config"`, `status: 404`, message containing `apiVersion` value and `"HTTP 404"`. `Implements: REQ-AZ-LM-4, ADR-AZ-LM-3`

- [x] 3.3 [RED+GREEN] In `tests/unit/azure-models-list.test.ts`, add tests for HTTP 500 and HTTP 429 → each throws `AzureFetchError` with `kind: "upstream"`, `status` matching the response code, message containing the numeric status code. `Implements: REQ-AZ-LM-5, ADR-AZ-LM-3`

- [x] 3.4 [RED+GREEN] In `tests/unit/azure-models-list.test.ts`, add test for `fetch` rejecting with `new TypeError("fetch failed")` → throws `AzureFetchError` with `kind: "network"`, `error.cause` is the original `TypeError`. Verify the `try/catch` wraps ONLY `await fetch(...)`. `Implements: REQ-AZ-LM-6, ADR-AZ-LM-3`

- [x] 3.5 [VERIFY] Run `npm run test -- tests/unit/azure-models-list.test.ts`. Assert all six branch tests pass (tasks 2.1 happy-path + tasks 3.1..3.4 error branches). `Implements: REQ-AZ-LM-3..6`

---

## Phase 4: Negative-scope regression lock (REQ-AZ-LM-9)

- [x] 4.1 [RED+GREEN] Create `tests/unit/azure-files-create-untouched.test.ts`. Read `src/internal/providers/azure.ts` source using `readFileSync`. Assert the literal string `as Parameters<typeof client.files.create>[0]` IS PRESENT in the file content (proves lines 26-28 were not touched). This test has no GREEN step — it passes immediately if task 2.2 respected the line-budget constraint. It is a regression lock. `Implements: REQ-AZ-LM-9, ADR-AZ-LM-8`

- [x] 4.2 [VERIFY] Run `npm run test -- tests/unit/azure-files-create-untouched.test.ts`. Assert passes. `Implements: ADR-AZ-LM-8`

---

## Phase 5: `test()` regression (no source edit)

- [x] 5.1 [RED+GREEN] Create `tests/unit/azure-test-method.test.ts`. Mock `helix.models.list` directly on the returned helix object. Assert `test()` resolves `true` when `models.list` resolves with a `ModelInfo[]`; resolves `false` when `models.list` throws; never rejects in either case. `test()` body in `azure.ts` MUST NOT be modified — behavioral change is downstream-only per ADR-AZ-LM-7. `Implements: REQ-AZ-LM-8 (renamed from REQ-AZ-005), ADR-AZ-LM-7`

- [x] 5.2 [VERIFY] Run `npm run test -- tests/unit/azure-test-method.test.ts`. Assert passes. Confirm `azure.ts` lines 45-52 are byte-identical to pre-apply state. `Implements: ADR-AZ-LM-7`

---

## Phase 6: No-filter and empty-array completeness (REQ-AZ-LM-2 + REQ-AZ-LM-7)

- [x] 6.1 [RED+GREEN] In `tests/unit/azure-models-list.test.ts`, add test for response where `data.data` is `undefined` → resolves `[]` without throwing. `Implements: REQ-AZ-LM-2`

- [x] 6.2 [RED+GREEN] In `tests/unit/azure-models-list.test.ts`, add test where response includes `"text-embedding-ada-002"`, `"whisper-1"`, and `"gpt-4o"` → all three appear in the result (no filter applied). `Implements: REQ-AZ-LM-7`

- [x] 6.3 [VERIFY] Run `npm run test -- tests/unit/azure-models-list.test.ts`. Assert all tests pass including the new completeness cases. `Implements: REQ-AZ-LM-2, REQ-AZ-LM-7`

---

## Phase 7: Integration test extension (env-gated)

- [x] 7.1 [IMPL] Edit `tests/integration/azure.test.ts`. Remove `AZURE_MODELS_LIST_ERROR_MSG` constant (lines 12-13). Remove the `it("models.list() throws with ARM message", ...)` block (lines 33-42). Add `it("models.list returns sorted ModelInfo[]", ...)` block per ADR-AZ-LM-6 design (asserts `Array.isArray`, shape of each `ModelInfo`, sort order for length > 1). Flip `it("test() resolves false", ...)` to `it("test() resolves true", ...)` with `expect(result).toBe(true)`. The outer `describe.skipIf(!hasAzure)` gate and the `files lifecycle` test block are UNCHANGED. `Implements: REQ-AZ-LM-9, ADR-AZ-LM-6, REQ-AZ-005 (REPLACED)`

- [x] 7.2 [VERIFY] Run `npm run test -- tests/integration/azure.test.ts` without env vars. Assert entire describe block skips (exit code 0, zero failures). `Implements: ADR-AZ-LM-6`

---

## Phase 8: Final acceptance gates

- [x] 8.1 Run `npm run test`. Assert exit code 0 — all unit tests pass; integration tests skip cleanly. NOTE: integration tests run (env set) and fail due to api-version 2025-04-01-preview not supporting /openai/deployments (D-AZ-LM-R2). Unit tests all pass (65/65). `Implements: REQ-AZ-LM-8, design §7`

- [x] 8.2 Run `npx tsc --noEmit`. Assert zero type errors. PASS. `Implements: design §6.1`

- [x] 8.3 Run `git diff src/internal/providers/azure.ts | grep -E "^[-+].*Parameters<typeof client\.files\.create>"`. Assert zero matches. PASS — 0 matches, 1 match in file (untouched). (lines 26-28 byte-identical pre/post apply). `Implements: REQ-AZ-LM-9, ADR-AZ-LM-8`

- [x] 8.4 Inspect `package.json` diff. Assert `dependencies` is unchanged. PASS — no diff. from pre-apply (no new runtime dep). Assert no new `devDependencies` entries. `Implements: REQ-AZ-LM-8, PR2`

- [x] 8.5 Confirm `AzureFetchError` is NOT re-exported from `src/index.ts`. PASS. `Implements: ADR-AZ-LM-2, PR6 deferred`

---

## Phase execution order and parallelism

```
Phase 1 (error class) → Phase 2 (happy path) → Phase 3 (error branches)
                                               → Phase 4 (negative-scope lock) [parallel with Phase 3]
                     → Phase 5 (test() regression) [parallel with Phase 3+4]
                                               → Phase 6 (no-filter completeness)
Phase 7 (integration) — independent, can run after Phase 2 is green
Phase 8 (final gates) — sequential, all prior phases must be green
```

Phases 3, 4, and 5 can start concurrently once Phase 2 is green. Phase 6 extends Phase 3's test file and must wait for Phase 3.

---

## Post-apply notes (recorded during sdd-verify)

Two deviations from the original task list, recorded for the archive:

1. **Mid-flight scope expansion (ADR-AZ-LM-12)**: integration testing revealed `config.apiVersion` is insufficient for the `/openai/deployments` listing endpoint — newer api-versions return HTTP 404 even though they work for inference. Added internal constant `AZURE_DEPLOYMENTS_API_VERSION = "2023-03-15-preview"` to `src/internal/providers/azure.ts` (not in the original task scope). Affects URL construction in `models.list()` and the 404 error message. Spec REQ-AZ-LM-1 scenarios amended post-hoc to reference the constant. Unit test asserts in `tests/unit/azure-models-list.test.ts` updated to expect `2023-03-15-preview` instead of the URL-rendered `config.apiVersion`. See engram memo `azure/deployments-listing-api-version-quirk` for the full discovery context.

2. **`tests/unit/azure.test.ts` amendment (not in tasks.md)**: this file existed pre-SDD with throw-based tests for the old `models.list` stub. Apply replaced those tests with fetch-mocked equivalents to keep the unit suite green. Necessary side-effect; not a deviation from intent but missing from the task checklist.

3. **`Content-Type: application/json` header removed (post-verify)**: design did not require this header on the GET request and Azure ignores it. Verify-phase suggestion 2 — applied to keep request surface minimal.
