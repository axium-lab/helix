# Tasks: helix-files-params-tightening — Honest contract for `files.create`

## Phase 1: Public Type Surface — RED → GREEN

- [x] 1.1 [TEST] Create `tests/unit/files-types.test.ts`. Write failing assertions using `// @ts-expect-error` for: `Uint8Array` rejected as `file` (FP-1-C), `ArrayBuffer` rejected as `file` (FP-1-D), `purpose` omitted (FP-2-A), out-of-union string for `purpose` (FP-2-B). Add positive assertions (no `@ts-expect-error`) for `File` accepted (FP-1-A), `Blob` accepted (FP-1-B), all six `HelixFilePurpose` values compile (FP-2-C). `Implements: REQ-FP-1, REQ-FP-2, ADR-FP-8`

- [x] 1.2 [VERIFY-RED] Run `npm run test tests/unit/files-types.test.ts`. Confirm `@ts-expect-error` directives on REJECTED inputs currently error because no type error exists yet — tests FAIL. `Implements: ADR-FP-8 (strict TDD RED gate)`

- [x] 1.3 [IMPL] Edit `src/core/types/files.ts`: add `export type HelixFilePurpose = "assistants" | "batch" | "fine-tune" | "vision" | "user_data" | "evals"`. Narrow `FilesCreateParams.file` from `Uint8Array | ArrayBuffer | Blob` to `File | Blob`. Change `purpose?: string` to `purpose: HelixFilePurpose` (REQUIRED, no `?`). Add SOURCE-OF-TRUTH comment above `HelixFilePurpose`. `Implements: REQ-FP-1, REQ-FP-2, ADR-FP-2`

- [x] 1.4 [IMPL] Edit `src/core/index.ts`: add `HelixFilePurpose` to the existing `export type { FilesCreateParams, FileObject } from "./types/files.js"` line. `Implements: REQ-FP-5, ADR-FP-3`

- [x] 1.5 [IMPL] Edit `src/index.ts`: add `HelixFilePurpose` to the existing root `export type { ... } from "./core/index.js"` block. `Implements: REQ-FP-5, ADR-FP-3`

- [x] 1.6 [VERIFY-GREEN] Run `npm run test tests/unit/files-types.test.ts`. All assertions PASS — `@ts-expect-error` directives resolve correctly, positive type assertions compile. `Implements: REQ-FP-1, REQ-FP-2, REQ-FP-5`

---

## Phase 2: OpenAI Adapter — Cast Removal (RED → GREEN)

- [x] 2.1 [TEST] Create `tests/unit/adapter-cast-removal.test.ts`. Write failing test: read `src/internal/providers/openai.ts` as a string; assert it does NOT contain the substring `"as Parameters<typeof client.files.create>[0]"`. `Implements: REQ-FP-3, ADR-FP-8 §B`

- [x] 2.2 [VERIFY-RED] Run `npm run test tests/unit/adapter-cast-removal.test.ts`. Confirm test FAILS (cast still present in source). `Implements: ADR-FP-8 (strict TDD RED gate)`

- [x] 2.3 [IMPL] Edit `src/internal/providers/openai.ts` `files.create` body ONLY: add the one-line `instanceof File` guard (wrap bare `Blob` into `new File([params.file], "blob", { type: params.file.type || "application/octet-stream" })`); replace `client.files.create(params as Parameters<typeof client.files.create>[0]) as unknown as FileObject` with `(await client.files.create({ ...params, file })) as FileObject`; DO NOT touch lines 18-22 (the `responses.create` body — ADR-FP-9 FORBIDDEN). `Implements: REQ-FP-3, ADR-FP-4, ADR-FP-7, ADR-FP-9`

- [x] 2.4 [VERIFY-GREEN] Run `npm run test tests/unit/adapter-cast-removal.test.ts` (OpenAI assertion). Confirm PASS. `Implements: REQ-FP-3`

---

## Phase 3: Azure Adapter — Cast Removal (RED → GREEN)

- [x] 3.1 [TEST] In `tests/unit/adapter-cast-removal.test.ts`, add failing test: read `src/internal/providers/azure.ts` as a string; assert it does NOT contain `"as Parameters<typeof client.files.create>[0]"`. `Implements: REQ-FP-4, ADR-FP-8 §B`

- [x] 3.2 [VERIFY-RED] Run `npm run test tests/unit/adapter-cast-removal.test.ts`. Confirm the new Azure assertion FAILS (cast still present). `Implements: ADR-FP-8 (strict TDD RED gate)`

- [x] 3.3 [IMPL] Edit `src/internal/providers/azure.ts` `files.create` body ONLY: apply the IDENTICAL Blob→File guard and cast changes as task 2.3. DO NOT touch lines 19-23 (the `responses.create` body — ADR-FP-9 FORBIDDEN). `Implements: REQ-FP-4, ADR-FP-4, ADR-FP-7, ADR-FP-9`

- [x] 3.4 [VERIFY-GREEN] Run `npm run test tests/unit/adapter-cast-removal.test.ts`. Both OpenAI and Azure assertions PASS. `Implements: REQ-FP-3, REQ-FP-4`

---

## Phase 4: Negative-Scope Guard (responses.create cast must stay)

- [x] 4.1 [TEST] In `tests/unit/adapter-cast-removal.test.ts`, add a POSITIVE assertion: read `src/internal/providers/openai.ts` as a string; assert it DOES contain `"as Parameters<typeof client.responses.create>[0]"`. This locks the responses.create carve-out. `Implements: REQ-FP-6, ADR-FP-9`

- [x] 4.2 [VERIFY-GREEN] Run `npm run test tests/unit/adapter-cast-removal.test.ts`. All assertions pass — cast is absent for `files.create` and PRESENT for `responses.create`. `Implements: REQ-FP-6`

---

## Phase 5: Versioning and CHANGELOG

- [x] 5.1 [IMPL] Edit `package.json`: change `"version"` from `"0.0.1"` to `"0.1.0"`. Touch ONLY the `version` key — all other fields stay byte-identical. `Implements: REQ-FP-7, ADR-FP-5`

- [x] 5.2 [IMPL] Create `CHANGELOG.md` at repo root with Keep-a-Changelog 1.1.0 format per the canonical content in `design.md` ADR-FP-6: header, pre-1.0 SemVer note, `## [0.1.0] — 2026-04-28` section with `### Changed (BREAKING)` bullets for `file` narrowing and `purpose` required, the two migration code snippets (Uint8Array→File and Buffer→Blob escape hatch), and `### Added` for `HelixFilePurpose`. Check `git tag --list "v0.0.1"`: if tag exists use compare URL form, else use single-tag release URL. `Implements: REQ-FP-7, ADR-FP-6`

- [x] 5.3 [IMPL] Edit `openspec/specs/files/spec.md`: update REQ-FILES-001 table rows for `file` (from `Uint8Array | ArrayBuffer | Blob` to `File | Blob`) and `purpose` (from optional `string` to required `HelixFilePurpose`). Add the "Breaking from Phase 1 v2 (v0.0.1 → v0.1.0)" callout per the amendment table in `specs/delta-spec.md`. `Implements: REQ-FP-1, REQ-FP-2 (spec amendment)`

---

## Phase 6: Full Verification Gates

- [x] 6.1 [VERIFY] Run `npm run test`. All unit tests PASS, all integration tests SKIP cleanly if env vars absent. Exit code MUST be 0. `Implements: REQ-FP-8, ADR-FP-8`

- [x] 6.2 [VERIFY] Run `npx tsc --noEmit`. Must exit with code 0 — zero type errors across all `src/` files. `Implements: REQ-FP-3 scenario FP-3-B, design §6.1`

- [x] 6.3 [VERIFY] Confirm `src/internal/providers/custom.ts` `files.create` body is UNCHANGED (still throws, body byte-identical to pre-change state). Confirm `vertex.ts` is untouched. `Implements: proposal §5 (untouched files), REQ-FP-6`
