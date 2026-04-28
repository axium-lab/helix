# Delta Spec: helix-files-params-tightening

**Change**: `helix-files-params-tightening`
**Date**: 2026-04-28
**Status**: ready for sdd-tasks
**Predecessor**: `helix-providers-phase-2` (archived 2026-04-28)
**Amends**: `openspec/specs/files/spec.md` — specifically REQ-FILES-001 (params shape) and the scenario that constructs `Uint8Array` inputs.

> **Breaking from Phase 1 v2 (v0.0.1 → v0.1.0)**
> The Phase 1 v2 frozen surface is intentionally amended here under the pre-1.0 SemVer carve-out.
> Version bumps from `0.0.1` to `0.1.0`. See CHANGELOG.md for consumer migration steps.
> Future frozen-spec edits MUST follow the same pattern: version bump + CHANGELOG entry + this callout.

---

## Scope

This delta spec covers WHAT must be true after the change is applied. It does not prescribe implementation.

**In scope**: `FilesCreateParams` type shape; `HelixFilePurpose` type definition and export; adapter cast removal for `files.create` in OpenAI and Azure adapters; version bump; CHANGELOG entry; test fixture migration.

**Out of scope**: `responses.create` cast (all adapters — see REQ-FP-6); `FileObject` response shape; `expires_after` field; all other public types; provider behavior beyond cast removal; `custom.ts` body (remains a `throw`); `vertex.ts`.

---

## Requirements

### REQ-FP-1: `FilesCreateParams.file` MUST be typed as `File | Blob`

**Amends**: REQ-FILES-001 (field `file`, `Uint8Array | ArrayBuffer | Blob`)
**Priority**: MUST

After this change, the `file` field in `FilesCreateParams` MUST accept exactly `File | Blob`. `Uint8Array` and `ArrayBuffer` MUST be rejected at compile time by TypeScript's type checker (no cast allowed at the call-site in the adapter). The type definition in `src/core/types/files.ts` MUST read `file: File | Blob`.

No runtime conversion of `Uint8Array` or `ArrayBuffer` to `File` is introduced anywhere (no boundary mapper — see RD-FILES-TIGHTEN-1 in the proposal).

#### Scenario FP-1-A: File input compiles and forwards cleanly

- **GIVEN** a consumer constructs `params = { file: new File([content], "doc.pdf", { type: "application/pdf" }), purpose: "user_data" }`
- **WHEN** the consumer calls `helix.files.create(params)` (TypeScript compiled, `tsc --noEmit`)
- **THEN** TypeScript MUST NOT emit a type error for the `file` field
- **AND** the adapter MUST forward `params` to the underlying SDK `client.files.create` without any parameter-side cast

#### Scenario FP-1-B: Blob input compiles and forwards cleanly

- **GIVEN** a consumer constructs `params = { file: new Blob([content], { type: "text/plain" }), purpose: "assistants" }`
- **WHEN** the consumer calls `helix.files.create(params)` (TypeScript compiled)
- **THEN** TypeScript MUST NOT emit a type error for the `file` field

#### Scenario FP-1-C: Uint8Array input is rejected at compile time

- **GIVEN** a consumer constructs `params = { file: new Uint8Array([1, 2, 3]), purpose: "user_data" }`
- **WHEN** the TypeScript compiler processes the call
- **THEN** TypeScript MUST emit a type error indicating `Uint8Array` is not assignable to `File | Blob`
- **AND** no `as` cast in the call site or adapter may suppress this error for `file`

#### Scenario FP-1-D: ArrayBuffer input is rejected at compile time

- **GIVEN** a consumer constructs `params = { file: new ArrayBuffer(16), purpose: "user_data" }`
- **WHEN** the TypeScript compiler processes the call
- **THEN** TypeScript MUST emit a type error indicating `ArrayBuffer` is not assignable to `File | Blob`

---

### REQ-FP-2: `FilesCreateParams.purpose` MUST be required and typed as `HelixFilePurpose`

**Amends**: REQ-FILES-001 (field `purpose`, was `OPTIONAL string`)
**Priority**: MUST

After this change, `purpose` in `FilesCreateParams` MUST be a REQUIRED field typed as the literal union `HelixFilePurpose`. The field MUST NOT be optional (`?`). The type definition MUST be:

```ts
export type HelixFilePurpose =
  | "assistants"
  | "batch"
  | "fine-tune"
  | "vision"
  | "user_data"
  | "evals";

export interface FilesCreateParams {
  file: File | Blob;
  purpose: HelixFilePurpose;        // required; no `?`
  expires_after?: { anchor: "created_at"; seconds: number };
}
```

The six values in `HelixFilePurpose` MUST mirror the OpenAI SDK's `FilePurpose` type exactly. No additional values, no widening to `string` (see RD-FILES-TIGHTEN-2).

#### Scenario FP-2-A: Omitting purpose is rejected at compile time

- **GIVEN** a consumer constructs `params = { file: new File([content], "doc.pdf") }` (no `purpose`)
- **WHEN** the TypeScript compiler processes the call
- **THEN** TypeScript MUST emit a type error indicating `purpose` is required but missing

#### Scenario FP-2-B: A string outside the union is rejected at compile time

- **GIVEN** a consumer constructs `params = { file: someFile, purpose: "unknown-purpose" }`
- **WHEN** the TypeScript compiler processes the call
- **THEN** TypeScript MUST emit a type error indicating `"unknown-purpose"` is not assignable to `HelixFilePurpose`

#### Scenario FP-2-C: Each valid literal compiles

- **GIVEN** a consumer passes `purpose` as one of `"assistants"`, `"batch"`, `"fine-tune"`, `"vision"`, `"user_data"`, or `"evals"`
- **WHEN** the TypeScript compiler processes the call
- **THEN** TypeScript MUST NOT emit a type error for any of the six values
- **AND** the adapter MUST forward the `purpose` value to the SDK without conversion

#### Scenario FP-2-D: `"user_data"` literal forwards to adapter unchanged

- **GIVEN** `params = { file: new File([content], "data.txt"), purpose: "user_data" }`
- **WHEN** `helix.files.create(params)` is called on the OpenAI provider
- **THEN** the underlying `client.files.create` MUST receive `purpose: "user_data"` verbatim — no defaulting, no mapping

---

### REQ-FP-3: OpenAI adapter MUST forward `params` to `client.files.create` without a parameter-side cast

**Priority**: MUST

In `src/internal/providers/openai.ts`, the `files.create` method body MUST NOT contain the expression `params as Parameters<typeof client.files.create>[0]`. The forwarding call MUST be structurally clean: `client.files.create(params)` (no parameter cast). A return cast `as unknown as FileObject` MAY remain if TypeScript requires it for the return type — this is a return-shape concern and is in scope for sdd-design's OQ3 audit but does not block this requirement.

#### Scenario FP-3-A: No parameter cast in openai.ts source

- **GIVEN** the source file `src/internal/providers/openai.ts` at the commit that completes this change
- **WHEN** a reviewer reads the `files.create` method body
- **THEN** the string `as Parameters<typeof client.files.create>[0]` MUST NOT appear anywhere in that body

#### Scenario FP-3-B: TypeScript strict-mode compile passes after edit

- **GIVEN** `tsconfig.json` has `strict: true` (or equivalent strictness flags)
- **WHEN** `tsc --noEmit` is executed against the full `src/` tree
- **THEN** the compiler MUST exit with code 0 — zero type errors in any file

---

### REQ-FP-4: Azure adapter MUST follow the same pattern as REQ-FP-3

**Priority**: MUST

In `src/internal/providers/azure.ts`, the `files.create` method body MUST NOT contain the expression `as Parameters<typeof client.files.create>[0]`. If the azure adapter currently has this cast (which the proposal confirms at line 27), it MUST be removed exactly as specified in REQ-FP-3. If — for any reason — the cast does not exist in the azure adapter at apply time, this requirement is trivially satisfied.

#### Scenario FP-4-A: No parameter cast in azure.ts source

- **GIVEN** the source file `src/internal/providers/azure.ts` at the commit that completes this change
- **WHEN** a reviewer reads the `files.create` method body
- **THEN** the string `as Parameters<typeof client.files.create>[0]` MUST NOT appear anywhere in that body

---

### REQ-FP-5: `HelixFilePurpose` MUST be exported from the public package root

**Priority**: MUST

The type `HelixFilePurpose` MUST be importable by a consumer using the package's public entry point — i.e., `import type { HelixFilePurpose } from "@fluxaria/helix-lib"` MUST resolve without error. The exact re-export chain location (whether `src/index.ts` directly or via `src/core/index.ts`) is left to sdd-design (OQ1), but the observable outcome MUST hold: the consumer import resolves.

#### Scenario FP-5-A: Import from package root resolves

- **GIVEN** a consumer file containing `import type { HelixFilePurpose } from "@fluxaria/helix-lib"`
- **WHEN** the TypeScript compiler processes that import
- **THEN** TypeScript MUST resolve `HelixFilePurpose` to the six-value literal union without error

#### Scenario FP-5-B: Exported type is the six-value closed union

- **GIVEN** the resolved `HelixFilePurpose` type
- **WHEN** a consumer checks assignability
- **THEN** all six values (`"assistants"`, `"batch"`, `"fine-tune"`, `"vision"`, `"user_data"`, `"evals"`) MUST be assignable to `HelixFilePurpose`
- **AND** any seventh value MUST NOT be assignable

---

### REQ-FP-6: `responses.create` cast is OUT OF SCOPE — MUST remain unchanged

**Priority**: MUST NOT change (negative scope)

The expression `params as Parameters<typeof client.responses.create>[0]` at `src/internal/providers/openai.ts` line 20, and its equivalent in `azure.ts` and `custom.ts`, MUST NOT be modified as part of this change. This cast hides a benign structural mismatch with no runtime crash risk and is deferred to a future SDD (`helix-responses-cast-cleanup`).

#### Scenario FP-6-A: responses.create cast is byte-identical after apply

- **GIVEN** the source files `src/internal/providers/openai.ts`, `azure.ts`, and `custom.ts` after apply
- **WHEN** a diff is taken against their pre-change state for the `responses.create` method body
- **THEN** the `responses.create` body in each file MUST be byte-identical to the pre-change state

---

### REQ-FP-7: Version bump and CHANGELOG entry

**Priority**: MUST

`package.json` version MUST be bumped from `0.0.1` to `0.1.0`. `CHANGELOG.md` at repo root MUST contain a `## [0.1.0]` section with at minimum:

1. A **BREAKING** bullet documenting the `file` field narrowing from `Uint8Array | ArrayBuffer | Blob` to `File | Blob`.
2. A **BREAKING** bullet documenting that `purpose` is now required and narrowed to `HelixFilePurpose`.
3. A migration recipe for consumers using `Uint8Array` inputs (wrap with `new File([bytes], "filename", { type: "mime/type" })`).
4. A migration recipe for consumers omitting `purpose` (must now provide an explicit value from the six-value union).

No new runtime dependency and no new devDependency may be introduced by this change.

#### Scenario FP-7-A: package.json version is 0.1.0

- **GIVEN** the `package.json` file at the commit that completes this change
- **WHEN** `package.json.version` is read
- **THEN** it MUST equal `"0.1.0"`

#### Scenario FP-7-B: CHANGELOG.md has a [0.1.0] section

- **GIVEN** the `CHANGELOG.md` file at the repo root
- **WHEN** its contents are read
- **THEN** a section headed `## [0.1.0]` MUST exist
- **AND** it MUST contain at least two BREAKING bullet points covering `file` and `purpose`
- **AND** it MUST contain the migration snippet `new File([...], "filename", { type: "..." })`

---

### REQ-FP-8: Test fixtures MUST use `File` (not `Uint8Array`/`ArrayBuffer`/bare `Blob`) for `files.create` inputs

**Priority**: MUST

Any test under `tests/unit/`, `tests/integration/`, or `src/internal/providers/__tests__/` that invokes `files.create` or constructs a `FilesCreateParams` object MUST use a `File` (or a `Blob` explicitly accepted by the tightened type) for the `file` field. No test may use `new Uint8Array(...)` or `new ArrayBuffer(...)` as the `file` value. Tests MUST also pass an explicit `purpose` value from the `HelixFilePurpose` union.

#### Scenario FP-8-A: No Uint8Array or ArrayBuffer as file in tests after apply

- **GIVEN** the full test suite source tree after apply
- **WHEN** a reviewer searches for `files.create` call sites in tests
- **THEN** NONE of those call sites MUST use `new Uint8Array` or `new ArrayBuffer` as the `file` value
- **AND** ALL of those call sites MUST include an explicit `purpose` from the six-value union

#### Scenario FP-8-B: Vitest suite passes with tightened types

- **GIVEN** the updated source and test fixtures
- **WHEN** `npm run test` is executed
- **THEN** all tests MUST pass (unit: pass; integration: skip cleanly if env vars absent)

---

## Migration Guide (consumer-facing)

This section is normative for the CHANGELOG.md content and for documentation.

### B1 — Wrapping `Uint8Array` or `ArrayBuffer`

If a caller was passing binary data as `Uint8Array` or `ArrayBuffer`:

```ts
// Before (no longer compiles after 0.1.0)
const buf: Uint8Array = await fs.promises.readFile("./doc.pdf");
await helix.files.create({ file: buf });

// After
const buf: Uint8Array = await fs.promises.readFile("./doc.pdf");
const file = new File([buf], "doc.pdf", { type: "application/pdf" });
await helix.files.create({ file, purpose: "user_data" });
```

`File` is a Web-platform global available natively in Node >= 22 (the minimum `engines.node` this lib requires) and in all modern browsers. No polyfill is needed.

### B2 — Adding an explicit `purpose`

If a caller was omitting `purpose`:

```ts
// Before (no longer compiles after 0.1.0)
await helix.files.create({ file: someFile });

// After — choose the purpose that matches your use case
await helix.files.create({ file: someFile, purpose: "user_data" });
```

Valid values: `"assistants"`, `"batch"`, `"fine-tune"`, `"vision"`, `"user_data"`, `"evals"`.

`purpose` was required by the OpenAI server (returned 400 if omitted); the type now reflects that reality.

### B3 — Importing `HelixFilePurpose` (optional convenience)

```ts
import type { HelixFilePurpose } from "@fluxaria/helix-lib";

function uploadFile(file: File, purpose: HelixFilePurpose) {
  return helix.files.create({ file, purpose });
}
```

---

## REQ-FILES-001 Amendment Summary

The following table replaces the original REQ-FILES-001 field table in `openspec/specs/files/spec.md`. The two changed rows are annotated.

| Field | Type | Required | Change |
|-------|------|----------|--------|
| `file` | `File \| Blob` | MUST | **CHANGED** from `Uint8Array \| ArrayBuffer \| Blob` |
| `purpose` | `HelixFilePurpose` | MUST | **CHANGED** from optional `string` |
| `expires_after` | `{ anchor: "created_at"; seconds: number }` | OPTIONAL | unchanged |

The scenarios in REQ-FILES-001 that construct `Uint8Array` inputs ("Upload with minimal params") MUST be updated to use `File` inputs and include an explicit `purpose`. The "Upload with expiry" scenario already uses a `Blob` and has `purpose: "assistants"` — only the `file` type needs updating to `File`.

---

**End of delta spec.**
