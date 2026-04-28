# Archive Report: helix-azure-list-models

**Change**: `helix-azure-list-models`
**Date Archived**: 2026-04-28
**Predecessor**: `helix-providers-phase-2` (archived 2026-04-28)
**Status**: ARCHIVED — PASS WITH NOTES

---

## Executive Summary

`helix-azure-list-models` replaces the synchronous throw stub in the Azure adapter's `models.list()` with a real native-`fetch` implementation against the Azure data-plane deployments endpoint, correcting a false premise in Phase 2 that the endpoint had been retired. The change introduces `AzureFetchError` (an internal discriminated error class), four error-kind mappings (auth/config/upstream/network), and closes Phase 2's documented limitation that Azure `test()` permanently returned `false`. All 25 tasks completed, 73/75 tests pass (2 skip — custom provider env-gated), `tsc --noEmit` exits clean, and all 6 gates are green. One mid-flight scope expansion (ADR-AZ-LM-12: hardcoded `AZURE_DEPLOYMENTS_API_VERSION = "2023-03-15-preview"`) was required after integration testing revealed that newer api-versions return HTTP 404 on the deployments listing endpoint — this was empirically confirmed via ocr-ai sibling project and live Azure integration tests.

---

## What Was Delivered

### Implementation files

| File | Action | Description |
|------|--------|-------------|
| `src/internal/providers/azure-errors.ts` | CREATED | `AzureFetchError extends Error` class with `kind`, `status`, `provider: "azure"`, `operation` fields + `isAzureFetchError` guard. NOT exported from `src/index.ts`. |
| `src/internal/providers/azure.ts` | MODIFIED | Added `AZURE_DEPLOYMENTS_API_VERSION = "2023-03-15-preview"` constant (lines 9-13); added `AzureFetchError` import; replaced `models.list` throw stub (lines 39-44) with real `fetch`-based implementation. Lines 26-28 (parallel SDD) and lines 45-52 (`test()`) preserved byte-for-byte. |
| `tests/integration/azure.test.ts` | MODIFIED | Removed `AZURE_MODELS_LIST_ERROR_MSG` constant + obsolete throw assertion. Added `models.list returns sorted ModelInfo[]` test block. Flipped `test() resolves false` to `test() resolves true`. |

### Test files added

| File | Tests | Purpose |
|------|-------|---------|
| `tests/unit/azure-errors.test.ts` | 14 | AzureFetchError shape, instanceof, guard |
| `tests/unit/azure-models-list.test.ts` | 11 | All REQ-AZ-LM-1..9 scenarios |
| `tests/unit/azure-files-create-untouched.test.ts` | 1 | Regression lock: files.create cast still present |
| `tests/unit/azure-test-method.test.ts` | 5 | test() true/false/no-reject |
| `tests/unit/azure.test.ts` | 10 | Amended (pre-SDD file) — throw-based tests replaced with fetch-mocked equivalents |

---

## Traceability Matrix

| REQ | Scenario | Test file | Result |
|-----|----------|-----------|--------|
| REQ-AZ-LM-1 | Trailing slash normalized | `tests/unit/azure-models-list.test.ts` | PASS |
| REQ-AZ-LM-1 | No trailing slash | `tests/unit/azure-models-list.test.ts` | PASS |
| REQ-AZ-LM-1 | api-key header, no Authorization | `tests/unit/azure-models-list.test.ts` | PASS |
| REQ-AZ-LM-2 | Happy path: sorted ModelInfo[] | `tests/unit/azure-models-list.test.ts` | PASS |
| REQ-AZ-LM-2 | Empty data array → [] | `tests/unit/azure-models-list.test.ts` | PASS |
| REQ-AZ-LM-2 | created: 0 sentinel | `tests/unit/azure-models-list.test.ts` | PASS |
| REQ-AZ-LM-2 | undefined data.data → [] | `tests/unit/azure-models-list.test.ts` | PASS |
| REQ-AZ-LM-3 | 401 → kind:auth | `tests/unit/azure-models-list.test.ts` | PASS |
| REQ-AZ-LM-4 | 404 → kind:config | `tests/unit/azure-models-list.test.ts` | PASS |
| REQ-AZ-LM-5 | 500 → kind:upstream | `tests/unit/azure-models-list.test.ts` | PASS |
| REQ-AZ-LM-5 | 429 → kind:upstream | `tests/unit/azure-models-list.test.ts` | PASS |
| REQ-AZ-LM-6 | fetch rejection → kind:network + cause | `tests/unit/azure-models-list.test.ts` | PASS |
| REQ-AZ-LM-7 | No filter — all deployments returned | `tests/unit/azure-models-list.test.ts` | PASS |
| REQ-AZ-LM-8 | package.json unchanged | gate 8.4 | PASS |
| REQ-AZ-LM-9 | files.create cast still present | `tests/unit/azure-files-create-untouched.test.ts` | PASS |
| REQ-AZ-004 (REPLACED) | models.list resolves on success | `tests/unit/azure.test.ts` | PASS |
| REQ-AZ-004 (REPLACED) | discriminated error on failure | `tests/unit/azure-models-list.test.ts` | PASS |
| REQ-AZ-005 (REPLACED) | test() true on success | `tests/unit/azure-test-method.test.ts` | PASS |
| REQ-AZ-005 (REPLACED) | test() false on auth error | `tests/unit/azure-test-method.test.ts` | PASS |
| REQ-AZ-005 (REPLACED) | test() false on network error | `tests/unit/azure-test-method.test.ts` | PASS |
| REQ-AZ-005 (REPLACED) | test() never rejects | `tests/unit/azure-test-method.test.ts` | PASS |

**Compliance**: 21/21 scenarios (100%).

---

## Deviations from Plan

Three documented deviations, all accepted:

### Deviation 1 — Mid-flight scope expansion: `AZURE_DEPLOYMENTS_API_VERSION` constant (WARNING → resolved)

The original design used `config.apiVersion` for the deployments listing URL. During integration testing, newer api-versions (including `2025-04-01-preview`) returned HTTP 404 for the `/openai/deployments` endpoint. Cross-referencing ocr-ai sibling project confirmed the pattern: `2023-03-15-preview` is the version that works for listing, regardless of the version used for inference (responses, files). Resolution: added internal constant `AZURE_DEPLOYMENTS_API_VERSION = "2023-03-15-preview"` at the top of `azure.ts`. This is a vendor quirk that helix abstracts — consumers need not know about it.

Design was amended post-hoc with ADR-AZ-LM-12 (included in this archive's `design.md`). Spec REQ-AZ-LM-1 references the constant. Unit tests assert `2023-03-15-preview` in the URL. See engram discovery memo `azure/deployments-listing-api-version-quirk` (obs. #106) for full context.

### Deviation 2 — `tests/unit/azure.test.ts` amended (SUGGESTION → accepted)

This file existed pre-SDD with throw-based tests for the old `models.list` stub. Apply replaced them with fetch-mocked equivalents to keep the suite green. Not in tasks.md Phase 7 but necessary for correctness.

### Deviation 3 — 404 error message wording improved (SUGGESTION → accepted)

Design §9 pinned: `"helix-lib: Azure models.list — apiVersion '${apiVersion}' rejected…"`. Implementation uses `"helix-lib: Azure models.list — deployments listing apiVersion '${AZURE_DEPLOYMENTS_API_VERSION}' rejected… may have been retired by Microsoft."` The new wording correctly references the hardcoded constant and explains the retirement scenario. Tests use `toContain` rather than exact-match.

---

## Gate Results

| Gate | Result | Evidence |
|------|--------|----------|
| `npm run test` | PASS | 73 passed, 2 skipped (custom env-gated), 0 failed |
| `npx tsc --noEmit` | PASS | Zero errors |
| `parallel_sdd_lock` (grep `Parameters<typeof client.files.create>[0]`) | PASS | Exactly 1 match at line 34 — unchanged |
| `helix_error_not_used` (grep `HelixError` in azure.ts + azure-errors.ts) | PASS | Zero matches |
| `error_class_not_exported` (grep `AzureFetchError` in src/index.ts) | PASS | Zero matches |
| `no_new_deps` (package.json diff) | PASS | `dependencies` unchanged |
| Integration azure (4/4) | PASS | All 4 tests passed with live Azure tenant |

---

## Main Spec Sync Applied

The following changes were made to `openspec/specs/azure/spec.md` during archive:

| Action | REQ | Description |
|--------|-----|-------------|
| REPLACED | REQ-AZ-004 | Old throw-stub contract removed; new real-HTTP contract with REQ-AZ-LM-1..7 cross-reference |
| REPLACED | REQ-AZ-005 | Old permanently-false contract removed; new live-connectivity contract |
| APPENDED | REQ-AZ-LM-1 | Endpoint construction + `AZURE_DEPLOYMENTS_API_VERSION` constant + api-key header |
| APPENDED | REQ-AZ-LM-2 | Successful response normalized to sorted ModelInfo[] |
| APPENDED | REQ-AZ-LM-3 | HTTP 401 → kind:auth |
| APPENDED | REQ-AZ-LM-4 | HTTP 404 → kind:config |
| APPENDED | REQ-AZ-LM-5 | Other non-OK → kind:upstream |
| APPENDED | REQ-AZ-LM-6 | fetch rejection → kind:network |
| APPENDED | REQ-AZ-LM-7 | No filter — all deployments returned |
| APPENDED | REQ-AZ-LM-8 | Native fetch only — no new dep |
| APPENDED | REQ-AZ-LM-9 | Lines outside models.list unchanged (parallel SDD guard) |

---

## Risk Register — Final Status

| Risk | ID | Materialized? | Current Status |
|------|----|--------------|----------------|
| Azure data-plane endpoint deprecated | D-AZ-LM-R1 | No | Theoretical. 404→config mapping gives clean signal if it happens. |
| api-version drift across tenants | D-AZ-LM-R2 | YES (triggered ADR-AZ-LM-12) | Resolved: `AZURE_DEPLOYMENTS_API_VERSION` hardcodes the working value, decoupling from `config.apiVersion`. |
| Parallel SDD line conflict | D-AZ-LM-R3 | No | Verify-phase grep confirmed 0 changes to lines 26-28. Regression lock test passes. |
| `created: 0` rendering as 1970 in UIs | D-AZ-LM-R4 | No — but theoretical | Documented in spec. Consumers must branch on `created === 0`. |
| Network test flakiness | D-AZ-LM-R5 | No | Integration tests skipped cleanly when env absent; passed with live Azure tenant. |
| try/catch deviation from ADR-P2-5 | D-AZ-LM-R6 | Accepted — not a defect | ADR-AZ-LM-3 documents the narrow exception with full justification. |
| helix-error-model migration tax | D-AZ-LM-R7 | No — future concern | AzureFetchError discriminators (kind/provider/operation) align with what helix-error-model will need. Migration is rename + import path. |

---

## Engram Observation IDs

All SDD phase artifacts are persisted in engram (project: helix):

| Phase | Topic Key | Observation ID |
|-------|-----------|----------------|
| Proposal | `sdd/helix-azure-list-models/proposal` | #99 |
| Spec | `sdd/helix-azure-list-models/spec` | #100 |
| Design | `sdd/helix-azure-list-models/design` | #101 |
| Tasks | `sdd/helix-azure-list-models/tasks` | #102 |
| Apply progress | `sdd/helix-azure-list-models/apply-progress` | #104 |
| Discovery (ADR-AZ-LM-12) | `azure/deployments-listing-api-version-quirk` | #106 |
| Verify report | `sdd/helix-azure-list-models/verify-report` | #107 |
| Archive report | `sdd/helix-azure-list-models/archive-report` | (this document) |

---

## Forward References

### helix-error-model (TODO)

`AzureFetchError` at `src/internal/providers/azure-errors.ts` is intended as the migration target for the future public `HelixError` discriminated union. The class carries `kind`, `provider`, and `operation` fields that align with the expected helix-error-model discriminators. Migration path:

1. `helix-error-model` introduces `HelixError extends Error` with `{ kind, provider, operation, status?, cause? }`.
2. Replace `new AzureFetchError(...)` in `azure.ts` with `new HelixError({ provider: "azure", operation: "models.list", kind, ... })`.
3. Keep `AzureFetchError` as a deprecated re-export for one minor version, then remove.
4. Update unit tests to assert `instanceof HelixError` instead of `instanceof AzureFetchError`.

### helix-vertex-provider (TODO)

Vertex `models.list` is untouched by this change. Vertex auth requires Google ADC / service-account JWT signing, which is a separate concern. May create a sibling `vertex-errors.ts` using the same pattern, or wait for `helix-error-model` to provide a shared base.

### helix-files-params-tightening (in flight)

Parallel SDD. Line-disjoint, order-independent. Lines 26-28 of `azure.ts` preserved byte-for-byte. Either SDD can apply first. No coordination required beyond the existing independence statement.

### helix-azure-config-v2 (lower priority)

Phase 2's R1 (Azure `test()` permanently false) is closed by this change. `helix-azure-config-v2` remains relevant for `deploymentName`-in-config and service-principal auth, but is no longer critical for basic connectivity testing.

---

## Archive Contents

This folder (`openspec/changes/archive/helix-azure-list-models/`) contains:

- `proposal.md` — Change proposal; ratified decisions RD-AZ-LM-1..7; scope, background, risks, open questions
- `design.md` — Implementation architecture; 12 ADRs (ADR-AZ-LM-1..12 including post-hoc ADR-AZ-LM-12); sequence diagrams; error message strings
- `tasks.md` — 25 tasks across 8 phases; all complete; post-apply notes documenting 3 deviations
- `verify-report.md` — PASS WITH NOTES; 21/21 scenarios; 73/75 tests; 6 gates green; 1 WARNING (resolved) + 4 SUGGESTIONs
- `specs/azure/spec.md` — Delta spec; REPLACED REQ-AZ-004 + REQ-AZ-005; ADDED REQ-AZ-LM-1..9
- `archive-report.md` — This file

The delta specs are retained here for historical traceability. The synced copies are the live references in `openspec/specs/azure/spec.md`.

---

## SDD Cycle Complete

Change `helix-azure-list-models` has been fully planned (proposal → spec → design → tasks), implemented (sdd-apply: 25/25 tasks, one mid-flight scope expansion), verified (sdd-verify: PASS WITH NOTES, zero CRITICAL), and now archived. Azure `models.list()` is a real HTTP implementation. Phase 2's R1 (Azure `test()` permanently false) is closed.

Next: commit and deploy. No further SDD work required for this change.
