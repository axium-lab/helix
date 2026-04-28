# Verify Report: helix-files-params-tightening

**Change**: `helix-files-params-tightening`
**Date**: 2026-04-28
**Mode**: Strict TDD
**Verdict**: PASS WITH NOTES

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 21 |
| Tasks complete | 21 |
| Tasks incomplete | 0 |

All 6 phases and 21 tasks are marked `[x]` in `openspec/changes/helix-files-params-tightening/tasks.md`.

---

## Build & Tests Execution

**Tests**: 82 passed / 0 failed / 2 skipped (exit code 0)

Test file breakdown:
- `tests/unit/adapter-cast-removal.test.ts` — 3 tests, all pass
- `tests/unit/files-types.test.ts` — 7 tests, all pass
- `tests/unit/custom.test.ts` — 11 tests, all pass
- `tests/unit/openai.test.ts` — 13 tests, all pass
- `tests/unit/azure.test.ts` — 10 tests, all pass
- `tests/unit/azure-test-method.test.ts` — 5 tests, all pass
- `tests/unit/azure-models-list.test.ts` — 11 tests, all pass
- `tests/unit/azure-errors.test.ts` — 14 tests, all pass
- `tests/integration/custom.test.ts` — 2 skipped (env-gated, correct)
- `tests/integration/azure.test.ts` — 4 tests, all pass (live run)
- `tests/integration/openai.test.ts` — 4 tests, all pass (live run)

**Build / Type check** (`tsc --noEmit`): PASS (exit 0, zero errors)

Note: `tsconfig.json` has `"include": ["src/**/*"]` — test files are excluded from `tsc --noEmit`. See SUGGESTION-1 below.

**Coverage**: Not configured.

---

## Gate Results

| Gate | Result | Evidence |
|------|--------|----------|
| `npm run test` exit 0 | PASS | 82 passed, 2 skipped, 0 failed |
| `tsc --noEmit` exit 0 | PASS | No output, exit 0 |
| `files.create` parameter cast removed (openai.ts + azure.ts) | PASS | `grep` returns 0 matches |
| `responses.create` cast preserved (openai.ts:20) | PASS | `grep` returns 1 match at line 20 |
| `HelixError` unused in `src/` | PASS | `grep -rn "HelixError" src/` returns 0 |
| `as unknown as FileObject` in `files.create` removed | PASS | Both adapters use `as FileObject` at `files.create` return line |
| `package.json` version is `"0.1.0"` | PASS | Confirmed by file read |
| `CHANGELOG.md` exists at repo root | PASS | File exists, Keep-a-Changelog format, `## [0.1.0]` section present |
| Azure list-models work intact | PASS | `AZURE_DEPLOYMENTS_API_VERSION` appears 3× in azure.ts (line 13 declaration + lines 51 + 78 usage); `AzureFetchError` appears 5× |

---

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-FP-1: `file: File \| Blob` | FP-1-A: File compiles | `files-types.test.ts > FP-1-A: accepts File` | COMPLIANT |
| REQ-FP-1: `file: File \| Blob` | FP-1-B: Blob compiles | `files-types.test.ts > FP-1-B: accepts Blob` | COMPLIANT |
| REQ-FP-1: `file: File \| Blob` | FP-1-C: Uint8Array rejected at compile time | `files-types.test.ts > FP-1-C: rejects Uint8Array` | COMPLIANT (see NOTE-1) |
| REQ-FP-1: `file: File \| Blob` | FP-1-D: ArrayBuffer rejected at compile time | `files-types.test.ts > FP-1-D: rejects ArrayBuffer` | COMPLIANT (see NOTE-1) |
| REQ-FP-2: `purpose` required + `HelixFilePurpose` | FP-2-A: omitting purpose rejected | `files-types.test.ts > FP-2-A: rejects when purpose is omitted` | COMPLIANT (see NOTE-1) |
| REQ-FP-2: `purpose` required + `HelixFilePurpose` | FP-2-B: out-of-union string rejected | `files-types.test.ts > FP-2-B: rejects strings outside union` | COMPLIANT (see NOTE-1) |
| REQ-FP-2: `purpose` required + `HelixFilePurpose` | FP-2-C: all six literals compile | `files-types.test.ts > FP-2-C: HelixFilePurpose mirrors all six values` | COMPLIANT |
| REQ-FP-2: `purpose` required + `HelixFilePurpose` | FP-2-D: `"user_data"` forwards unchanged | `tests/integration/openai.test.ts > files lifecycle` (live run) | COMPLIANT |
| REQ-FP-3: openai.ts cast removed | FP-3-A: no parameter cast in openai.ts | `adapter-cast-removal.test.ts > openai.ts files.create body...` | COMPLIANT |
| REQ-FP-3: openai.ts cast removed | FP-3-B: `tsc --noEmit` passes | tsc gate — exit 0 | COMPLIANT |
| REQ-FP-4: azure.ts cast removed | FP-4-A: no parameter cast in azure.ts | `adapter-cast-removal.test.ts > azure.ts files.create body...` | COMPLIANT |
| REQ-FP-5: `HelixFilePurpose` at package root | FP-5-A: import from root resolves | `files-types.test.ts` imports from `../../src/index.js` — all type tests pass | COMPLIANT |
| REQ-FP-5: `HelixFilePurpose` at package root | FP-5-B: six-value closed union | `files-types.test.ts > FP-2-C + FP-2-B` | COMPLIANT |
| REQ-FP-6: `responses.create` cast unchanged | FP-6-A: byte-identical | `adapter-cast-removal.test.ts > negative-scope guard` + direct grep (1 match at line 20) | COMPLIANT |
| REQ-FP-7: version + CHANGELOG | FP-7-A: version is `"0.1.0"` | `package.json.version` = `"0.1.0"` | COMPLIANT |
| REQ-FP-7: version + CHANGELOG | FP-7-B: `## [0.1.0]` section exists with 2 BREAKING bullets + migration recipe | `CHANGELOG.md` confirmed — 2 BREAKING bullets, `new File([...], ...)` migration snippet present | COMPLIANT |
| REQ-FP-8: test fixtures use `File` | FP-8-A: no Uint8Array/ArrayBuffer as file in tests | No matches in integration tests; unit tests use `File`/`Blob` only | COMPLIANT |
| REQ-FP-8: test fixtures use `File` | FP-8-B: `npm run test` passes | 82 passed / 2 skipped / 0 failed | COMPLIANT |

**Compliance summary**: 18/18 scenarios compliant.

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| `file: File \| Blob` in `src/core/types/files.ts` | IMPLEMENTED | Line 16 confirmed |
| `purpose: HelixFilePurpose` required (no `?`) | IMPLEMENTED | Line 17 confirmed |
| `HelixFilePurpose` declared as 6-value literal union | IMPLEMENTED | Lines 7-13 with SOURCE-OF-TRUTH comment |
| `HelixFilePurpose` re-exported through `src/core/index.ts` | IMPLEMENTED | Line 28 confirmed |
| `HelixFilePurpose` re-exported through `src/index.ts` | IMPLEMENTED | Line 22 confirmed |
| openai.ts `files.create` parameter cast removed + Blob→File guard added | IMPLEMENTED | Lines 26-30 confirmed |
| azure.ts `files.create` parameter cast removed + Blob→File guard added | IMPLEMENTED | Lines 34-38 confirmed |
| Return cast softened: `as FileObject` (not `as unknown as FileObject`) | IMPLEMENTED | Both adapters confirmed |
| `responses.create` cast preserved (ADR-FP-9) | IMPLEMENTED | openai.ts line 20, azure.ts line 28, custom.ts line 19 |
| `package.json` version = `"0.1.0"` | IMPLEMENTED | Confirmed |
| `CHANGELOG.md` at repo root with Keep-a-Changelog format | IMPLEMENTED | Confirmed |
| `custom.ts` untouched (`files.create` still throws) | IMPLEMENTED | Confirmed — throw body byte-identical |
| No new runtime or dev dependency introduced | IMPLEMENTED | `package.json` dep fields unchanged |

---

## Coherence (Design)

| ADR | Followed? | Notes |
|-----|-----------|-------|
| ADR-FP-1: `File \| Blob` not `Uploadable` | YES | Public type confirmed |
| ADR-FP-2: Helix-owned `HelixFilePurpose` (no re-export of `openai`) | YES | Declared in `src/core/types/files.ts`, no openai import in core |
| ADR-FP-3: re-export through both barrels | YES | Both `core/index.ts` and `src/index.ts` confirmed |
| ADR-FP-4: Blob→File guard + parameter cast removed | YES | Guard present in both openai.ts and azure.ts |
| ADR-FP-5: version 0.0.1 → 0.1.0 | YES | Confirmed |
| ADR-FP-6: CHANGELOG.md created with canonical content | YES | Matches canonical content from design |
| ADR-FP-7: return cast softened to `as FileObject` | YES | Both adapters use `as FileObject` for `files.create` |
| ADR-FP-8: test strategy — unit (compile-time + cast-removal grep) | YES | Both new unit test files created and passing |
| ADR-FP-9: `responses.create` body FORBIDDEN to edit | YES | Verified via grep and direct file read |

---

## Apply-Flagged Risks — Evaluated

### Risk 1: `package.json` version reversion by file watcher

**Status**: RESOLVED. `package.json.version` is currently `"0.1.0"`. Confirmed by direct file read.

### Risk 2: `@ts-expect-error` directives not semantically verified by `npm run test`

**Status**: CONFIRMED as a real structural gap.

Evidence: `tsconfig.json` has `"include": ["src/**/*"]` and explicitly excludes `tests/`. `npx tsc --noEmit` operates only on `src/`. Vitest uses Vite's esbuild transform (not `tsc`) on test files — esbuild strips type annotations without semantic checking. The `@ts-expect-error` directives in `tests/unit/files-types.test.ts` are NOT checked by `npm run test` for type errors. They pass at runtime (the Vitest test is green) because the runtime assertions (`expect(params).toBeDefined()`) succeed regardless of the type annotation.

Practical implication: if someone widens `FilesCreateParams.file` back to include `Uint8Array`, the `@ts-expect-error` directives would remain in place but would no longer be asserting actual type errors — the tests would still pass at runtime without catching the regression.

Manually verified: running `npx tsc --noEmit --ignoreConfig --strict --esModuleInterop --target ES2022 --module NodeNext --moduleResolution NodeNext tests/unit/files-types.test.ts` exits 0, confirming the types ARE correct and the `@ts-expect-error` directives are correctly placed today.

This risk is documented as SUGGESTION-1 below.

### Risk 3: `tests/unit/azure-files-create-untouched.test.ts` was deleted

**Status**: CORRECT deletion, requires archive-phase note.

Evidence: `ls tests/unit/azure-files-create-untouched.test.ts` confirms file does NOT exist. This was the `helix-azure-list-models` SDD's parallel-lock test — it asserted that the `files.create` parameter cast WAS present in `azure.ts`. After this SDD removes the cast, the test would fail, so it was deleted.

The deletion is correct: the protective lock has served its purpose (the cast is gone). The new `tests/unit/adapter-cast-removal.test.ts` provides superior, permanent coverage in the other direction (asserting absence).

Archive-phase note: the deletion MUST be called out in the `helix-files-params-tightening` archive report for audit trail continuity with the `helix-azure-list-models` archive.

---

## Issues Found

### CRITICAL

None.

### WARNING

None.

### SUGGESTION

**SUGGESTION-1**: `@ts-expect-error` type-gate not covered by CI.

`tsconfig.json` excludes `tests/` from `tsc --noEmit`. Vitest with esbuild does not run semantic type-checking. The compile-time regression guards in `tests/unit/files-types.test.ts` would silently stop catching regressions if the types were widened. Options (in order of preference):

1. Add a `"typecheck"` script to `package.json` using `vitest typecheck` (Vitest's type-checking mode, which does invoke tsc on test files): `"typecheck": "vitest typecheck tests/unit/files-types.test.ts"`. This is the idiomatic Vitest solution.
2. Expand `tsconfig.json` `"include"` to add `"tests/**/*"` and rely on the existing `tsc --noEmit` gate.
3. Add a separate `tsconfig.test.json` that extends the main one and includes `tests/**/*`, then add `"typecheck": "tsc --noEmit -p tsconfig.test.json"` script.

Any of these would make the type assertions CI-enforced rather than documentation-only.

**SUGGESTION-2**: `HelixFilePurpose` drift monitoring not automated.

Per ADR-FP-2, `HelixFilePurpose` is a Helix-owned literal union that mirrors `openai`'s `FilePurpose`. The source-of-truth comment in `src/core/types/files.ts` is the only mechanism today. A test that imports `FilePurpose` from `openai/resources/files.d.ts` and asserts structural equivalence to `HelixFilePurpose` would catch SDK drift automatically. This is a low-priority addition; the manual comment is sufficient for v0.1.0.

---

## Deviations

1. **`tests/unit/azure-files-create-untouched.test.ts` deleted**: Correct deletion — the `helix-azure-list-models` SDD's protective lock was superseded. Must be noted in archive report for audit continuity.
2. **`as unknown as FileObject` retained in `files.list()`**: Both adapters still use `as unknown as FileObject[]` in the `files.list()` method. This is NOT a deviation — `files.list` was explicitly out of scope for this SDD. The return-cast softening (ADR-FP-7) applies only to `files.create`. Confirmed correct.

---

## Verdict

**PASS WITH NOTES**

All 21 tasks complete. All 18 spec scenarios compliant. All 9 gates pass. The implementation correctly narrows `FilesCreateParams`, removes the parameter cast, adds the Blob→File guard, softens the return cast, exports `HelixFilePurpose`, bumps the version, and ships a standards-compliant CHANGELOG. The `helix-azure-list-models` work (`AZURE_DEPLOYMENTS_API_VERSION`, `AzureFetchError`) is intact. No CRITICAL or WARNING issues. Two SUGGESTIONS for improving the type-gate coverage in CI. One deviation (file deletion) that must be noted in the archive report.

Ready for `sdd-archive`.
