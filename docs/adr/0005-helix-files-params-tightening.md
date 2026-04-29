# ADR-0005: FilesCreateParams Narrowed to File | Blob with Required Purpose

- **Date**: 2026-04-28
- **Status**: Accepted (shipped)

## Context

Phase 2 (ADR-0003) exposed `FilesCreateParams.file` as `Uint8Array | ArrayBuffer | Blob`, which the OpenAI SDK does not accept at the wire level without a cast. `purpose` was optional `string`, allowing any value. Both were honesty gaps: types that compile but fail at runtime or misrepresent the contract.

## Decision

- **`FilesCreateParams.file`** narrowed from `Uint8Array | ArrayBuffer | Blob` to `File | Blob`.
- **`FilesCreateParams.purpose`** changed from optional `string` to required `HelixFilePurpose` — a 6-value closed literal union mirroring OpenAI's `FilePurpose` exactly (with a SOURCE-OF-TRUTH comment in source).
- **`HelixFilePurpose`** added to the public barrel (`src/index.ts`) as a first-class exported type.
- **Blob→File runtime guard** added in both OpenAI and Azure adapters' `files.create` blocks: `instanceof File` check, else `new File([params.file], "blob", { type: params.file.type })`. The `as Parameters<...>[0]` cast removed.
- **Package version bumped to `0.1.0`** (pre-1.0 BREAKING minor); `CHANGELOG.md` added with migration recipes.

## Consequences

- Passing `Uint8Array` or `ArrayBuffer` to `files.create` is now a compile-time error — no silent runtime failures.
- Any `purpose` value not in `HelixFilePurpose` is rejected at compile time.
- When `openai` SDK ships new `FilePurpose` values, `HelixFilePurpose` must be updated; the SOURCE-OF-TRUTH comment in `src/core/types/files.ts` is the gate reminder. Per ADR-FP-2, any `dependencies.openai` bump triggers a `FilePurpose` audit.
- `files.list` return cast (`as unknown as FileObject[]`) was explicitly left in scope for a future change.
