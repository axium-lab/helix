# Tasks: helix-providers-phase-2 — Real HTTP for OpenAI, Azure, Custom

## Phase 1: Infrastructure & Tooling Setup

- [x] 1.1 [IMPL] Add `"openai": "^6.0.0"` to `dependencies` and `vitest` + `@mswjs/interceptors` (latest stable) to `devDependencies` in `package.json`. Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:integration": "vitest run --dir tests/integration"`. Run `npm install` to generate `package-lock.json`. Verify no accidental additions to `dependencies`. `Implements: REQ-DEP-001, REQ-DEP-002, REQ-DEP-003, REQ-DEP-004, REQ-DEP-005`

- [x] 1.2 [IMPL] Create `vitest.config.ts` at repo root. Configure: `environment: "node"`, `include: ["src/**/__tests__/**/*.test.ts", "tests/integration/**/*.test.ts"]`, `setupFiles: ["./src/internal/providers/__tests__/_msw.ts"]`. Do NOT alter `tsconfig.json`. `Implements: REQ-TEST-UNIT-001, ADR-P2-6, ADR-P2-8`

- [x] 1.3 [IMPL] Create `src/internal/providers/__tests__/_msw.ts`. Export a `BatchInterceptor` combining `FetchInterceptor` and `ClientRequestInterceptor`. Export `setupInterceptor()` / `teardownInterceptor()` for `beforeAll`/`afterAll` use and a `respondWith(predicate, response)` one-shot helper. `Implements: ADR-P2-7`

- [x] 1.4 [IMPL] Add `external: ["openai"]` to ALL THREE config blocks in `tsup.config.ts` (ESM, CJS, and DTS blocks). Entry stays exactly `["src/index.ts"]` in every block — no change to entry. `Implements: ADR-P2-10, REQ-DEP-005`

- [x] 1.5 [IMPL] Verify `tsc --noEmit` still passes after the dep/config changes (zero errors expected — public surface is unchanged). `Implements: design §6.1`

---

## Phase 2: OpenAI Adapter — TDD (RED → GREEN per method)

- [x] 2.1 [TEST] Create `src/internal/providers/__tests__/openai.test.ts`. Write failing tests for SDK client construction: assert `OpenAI` constructor receives `{ apiKey }` when no `baseUrl`; receives `{ apiKey, baseURL }` when `baseUrl` is set. Import `createOpenAIAdapter` directly (not `createHelix`). `Implements: REQ-OAI-001, REQ-TEST-UNIT-001`

- [x] 2.2 [IMPL] Rewrite the body of `src/internal/providers/openai.ts`: construct `const client = new OpenAI({ apiKey: config.apiKey, ...(config.baseUrl && { baseURL: config.baseUrl }) })` eagerly. Leave all method bodies as `throw new Error("not implemented")` for now. Verify 2.1 tests go green. `Implements: REQ-OAI-001, ADR-P2-2`

- [x] 2.3 [TEST] In `openai.test.ts`, add failing tests for `responses.create`: (a) happy-path — MSW interceptor returns a valid HelixResponse-shaped payload; assert `result.id`, `result.object === "response"`, `result.output`, `result.output_text`, `result.usage`; (b) error passthrough — interceptor returns 401; assert the raw SDK error propagates unchanged. `Implements: REQ-OAI-002, REQ-TEST-UNIT-002`

- [x] 2.4 [IMPL] Implement `responses.create` in `openai.ts`: `return client.responses.create(params as Parameters<typeof client.responses.create>[0]) as unknown as HelixResponse`. No try/catch. Verify 2.3 tests go green. `Implements: REQ-OAI-002, ADR-P2-4, ADR-P2-5`

- [x] 2.5 [TEST] In `openai.test.ts`, add failing tests for `files.create`: happy-path with `purpose` forwarded verbatim; happy-path without `purpose` (SDK default applies, no injection by adapter); assert `result.object === "file"`. `Implements: REQ-OAI-003, REQ-TEST-UNIT-003`

- [x] 2.6 [IMPL] Implement `files.create` in `openai.ts`: `return client.files.create(params) as FileObject`. No try/catch. Verify 2.5 green. `Implements: REQ-OAI-003, ADR-P2-4`

- [x] 2.7 [TEST] In `openai.test.ts`, add failing tests for `files.list` (assert returns `FileObject[]`) and `files.delete` (assert resolves with `{ id: "file-abc", deleted: true }`). `Implements: REQ-OAI-004, REQ-TEST-UNIT-003`

- [x] 2.8 [IMPL] Implement `files.list` in `openai.ts`: `const page = await client.files.list(); return page.data as FileObject[]`. Implement `files.delete`: `const res = await client.files.delete(id); return { id: res.id, deleted: true as const }`. No try/catch. Verify 2.7 green. `Implements: REQ-OAI-004, ADR-P2-4`

- [x] 2.9 [TEST] In `openai.test.ts`, add failing tests for `models.list`: happy-path — interceptor returns 2-entry page; assert result is `ModelInfo[]` with `object === "model"` on each item. Add error-propagation test. `Implements: REQ-OAI-005, REQ-TEST-UNIT-004`

- [x] 2.10 [IMPL] Implement `models.list` in `openai.ts`: call `client.models.list()`, map `.data` to `ModelInfo[]` with explicit field mapping (`id`, `object: "model" as const`, `created`, `owned_by`). No try/catch. Verify 2.9 green. `Implements: REQ-OAI-005, ADR-P2-4`

- [x] 2.11 [TEST] In `openai.test.ts`, add failing tests for `test()`: (a) returns `true` when models endpoint succeeds; (b) returns `false` when models endpoint returns 500; (c) never rejects in either case. `Implements: REQ-TEST-UNIT-005`

- [x] 2.12 [IMPL] `test()` in `openai.ts` is ALREADY correct (`try { await this.models.list(); return true } catch { return false }`). Verify the Phase 1 v2 stub body is preserved verbatim and 2.11 tests go green. No code change expected. `Implements: ADR-P2-5`

---

## Phase 3: Custom Adapter — TDD (RED → GREEN per method)

- [x] 3.1 [TEST] Create `src/internal/providers/__tests__/custom.test.ts`. Write failing tests for SDK client construction: assert `OpenAI` constructor receives `{ apiKey, baseURL }` where `baseURL === config.baseUrl`. Import `createCustomAdapter` directly. `Implements: REQ-CUSTOM-001, REQ-TEST-UNIT-001`

- [x] 3.2 [IMPL] Rewrite the body of `src/internal/providers/custom.ts`: construct `const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl })` eagerly. Leave `responses.create` and `models.list` as stubs; preserve existing `files.*` throw bodies VERBATIM (they are already correct per REQ-FILES-005). Verify 3.1 tests go green. `Implements: REQ-CUSTOM-001, ADR-P2-2, ADR-P2-3`

- [x] 3.3 [TEST] In `custom.test.ts`, add failing tests for `responses.create`: happy-path with params forwarded verbatim to custom endpoint; error propagation (403 from custom endpoint). `Implements: REQ-CUSTOM-002, REQ-TEST-UNIT-002`

- [x] 3.4 [IMPL] Implement `responses.create` in `custom.ts`: identical pattern to OpenAI — `return client.responses.create(params ...) as unknown as HelixResponse`. No try/catch. Verify 3.3 green. `Implements: REQ-CUSTOM-002, ADR-P2-4, ADR-P2-5`

- [x] 3.5 [TEST] In `custom.test.ts`, add failing tests for `files.create`, `files.list`, `files.delete`: each MUST throw a plain `Error` with the EXACT messages from REQ-CUSTOM-004. Assert `error instanceof Error` and `error.constructor === Error`. `Implements: REQ-CUSTOM-004, REQ-TEST-UNIT-003`

- [x] 3.6 [IMPL] The `files.*` stubs in `custom.ts` already have the exact correct messages from Phase 1 v2. Confirm they match REQ-CUSTOM-004 byte-for-byte; no change. Verify 3.5 tests go green. `Implements: REQ-CUSTOM-004, ADR-P2-5`

- [x] 3.7 [TEST] In `custom.test.ts`, add failing tests for `models.list`: happy-path — interceptor returns models from custom base URL; `ModelInfo[]` shape. Add error-propagation test. `Implements: REQ-CUSTOM-003, REQ-TEST-UNIT-004`

- [x] 3.8 [IMPL] Implement `models.list` in `custom.ts`: identical map pattern to OpenAI. No try/catch. Verify 3.7 green. `Implements: REQ-CUSTOM-003, ADR-P2-4`

- [x] 3.9 [TEST] In `custom.test.ts`, add failing tests for `test()`: returns `true` on success, `false` on failure, never rejects. `Implements: REQ-TEST-UNIT-005`

- [x] 3.10 [IMPL] `test()` in `custom.ts` is ALREADY correct from Phase 1 v2. Confirm and verify 3.9 green. No code change expected. `Implements: ADR-P2-5`

---

## Phase 4: Azure Adapter — TDD (RED → GREEN per method)

- [x] 4.1 [TEST] Create `src/internal/providers/__tests__/azure.test.ts`. Write failing tests for SDK client construction: assert `AzureOpenAI` constructor receives exactly `{ apiKey, endpoint, apiVersion }`. Import `createAzureAdapter` directly. `Implements: REQ-AZ-001, REQ-TEST-UNIT-001`

- [x] 4.2 [IMPL] Rewrite the body of `src/internal/providers/azure.ts`: import `{ AzureOpenAI }` from `"openai"`. Construct `const client = new AzureOpenAI({ apiKey: config.apiKey, endpoint: config.endpoint, apiVersion: config.apiVersion })` eagerly. Leave method bodies as stubs for now. Verify 4.1 tests go green. `Implements: REQ-AZ-001, ADR-P2-2`

- [x] 4.3 [TEST] In `azure.test.ts`, add failing tests for `responses.create`: happy-path with deployment name in `model` field forwarded unchanged; error propagation (401). `Implements: REQ-AZ-002, REQ-TEST-UNIT-002`

- [x] 4.4 [IMPL] Implement `responses.create` in `azure.ts`: same cast pattern as OpenAI. `model` field is the caller-supplied deployment name — no remapping. No try/catch. Verify 4.3 green. `Implements: REQ-AZ-002, ADR-P2-4, ADR-P2-5`

- [x] 4.5 [TEST] In `azure.test.ts`, add failing tests for `files.create` (params forwarded), `files.list` (returns `FileObject[]`), and `files.delete` (resolves with `{ id, deleted: true }`). `Implements: REQ-AZ-003, REQ-TEST-UNIT-003`

- [x] 4.6 [IMPL] Implement `files.create`, `files.list`, `files.delete` in `azure.ts` — same SDK delegation and shape adjustment as OpenAI. No try/catch. Verify 4.5 green. `Implements: REQ-AZ-003, ADR-P2-4`

- [x] 4.7 [TEST] In `azure.test.ts`, add failing tests for `models.list`: assert it throws a plain `Error`; assert `error.message` equals EXACTLY: `"helix-lib: 'models.list' not supported by provider 'azure' — Azure data-plane deployment listing was retired April 2024; ARM management plane requires credentials not present in HelixConfig.azure"`; assert `error.constructor === Error` (not a subclass); assert no HTTP request is initiated. `Implements: REQ-AZ-004, REQ-TEST-UNIT-004`

- [x] 4.8 [IMPL] Implement `models.list` in `azure.ts` as a synchronous `throw new Error("helix-lib: 'models.list' not supported by provider 'azure' — Azure data-plane deployment listing was retired April 2024; ARM management plane requires credentials not present in HelixConfig.azure")`. Copy the message byte-for-byte from REQ-AZ-004. No SDK call, no async work. Verify 4.7 green. `Implements: REQ-AZ-004, ADR-P2-5`

- [x] 4.9 [TEST] In `azure.test.ts`, add failing test for `test()`: assert it resolves with `false` and never rejects (because `models.list` always throws). `Implements: REQ-AZ-005, REQ-TEST-UNIT-005`

- [x] 4.10 [IMPL] `test()` in `azure.ts` is ALREADY correct from Phase 1 v2 (`try { await this.models.list(); return true } catch { return false }`). Confirm body matches and verify 4.9 green. No code change expected. `Implements: REQ-AZ-005, ADR-P2-5`

---

## Phase 5: Integration Test Scaffolding

- [x] 5.1 [IMPL] Create `tests/integration/openai.test.ts`. Gate the entire `describe` block with `describe.skipIf(!process.env.HELIX_OPENAI_API_KEY)`. Add smoke tests for `responses.create` (asserts `result.object === "response"`) and `test()` (asserts resolves `true`). `Implements: REQ-TEST-INTG-001, ADR-P2-8`

- [x] 5.2 [IMPL] Create `tests/integration/azure.test.ts`. Gate with `describe.skipIf(!hasAzure)` where `hasAzure` checks `HELIX_AZURE_API_KEY`, `HELIX_AZURE_ENDPOINT`, `HELIX_AZURE_API_VERSION`, and `HELIX_AZURE_DEPLOYMENT`. Add smoke test for `responses.create`. Assert `models.list()` throws with the ARM message; assert `test()` resolves `false`. `Implements: REQ-TEST-INTG-001, ADR-P2-8`

- [x] 5.3 [IMPL] Create `tests/integration/custom.test.ts`. Gate with `describe.skipIf(!hasCustom)` where `hasCustom` checks `HELIX_CUSTOM_API_KEY` and `HELIX_CUSTOM_BASE_URL`. Add smoke tests for `responses.create` and `models.list`. `Implements: REQ-TEST-INTG-001, ADR-P2-8`

---

## Phase 6: Build & Publication Verification

- [x] 6.1 [IMPL] Run `npm run build` (tsup). Confirm `dist/esm/`, `dist/cjs/`, and `dist/types/` are produced. Confirm `openai` appears as an external import (NOT bundled) in `dist/esm/index.js` and `dist/cjs/index.cjs` by inspecting for an `import ... from "openai"` / `require("openai")` reference rather than inlined SDK source. `Implements: ADR-P2-10, REQ-DEP-001`

- [x] 6.2 [IMPL] Verify no test files leaked into `dist/`: run `find dist/ -name '*.test.*'` and assert empty output. `Implements: ADR-P2-6, design D-R2`

- [x] 6.3 [IMPL] Confirm `src/internal/providers/vertex.ts` is byte-identical to its Phase 1 v2 archived state by running `git diff src/internal/providers/vertex.ts` — expect zero diff. `Implements: ADR-P2-3, proposal §6`

---

## Phase 7: Final Acceptance

- [x] 7.1 [IMPL] Run `tsc --noEmit`. Assert zero errors. `Implements: design §6.1`

- [x] 7.2 [IMPL] Run `npm test` (unit suite). Assert all tests pass with zero failures. Assert no test depends on env vars (no skips in unit suite). `Implements: REQ-TEST-UNIT-001`

- [x] 7.3 [IMPL] Run the integration suite (`npm run test:integration`) without env vars. Assert all tests are SKIPPED (exit code 0, no failures). `Implements: REQ-TEST-INTG-001`

- [x] 7.4 [IMPL] Inspect final `package.json` diff: confirm exactly one new entry under `"dependencies"` (`openai`) and only test-infrastructure entries under `"devDependencies"`. Confirm `package-lock.json` exists and is committed. `Implements: REQ-DEP-004, REQ-DEP-005`
