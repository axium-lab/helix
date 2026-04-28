# Proposal: helix-files-params-tightening — Honest contract for `files.create`

**Change**: `helix-files-params-tightening`
**Date**: 2026-04-28
**Author**: orchestrator-delegated (sdd-propose)
**Status**: ready for sdd-spec / sdd-design
**Predecessor**: `helix-providers-phase-2` (archived 2026-04-28)
**Successors (candidate)**: `helix-responses-cast-cleanup` (only if structural drift is later observed)

---

## 1. Intent

### What

Tighten the `FilesCreateParams` public type so that the Helix surface no longer LIES about what it accepts, and remove the `as Parameters<typeof client.files.create>[0]` cast from every adapter that exists today. Two changes in one stroke:

1. `FilesCreateParams.file: Uint8Array | ArrayBuffer | Blob` becomes `File | Blob` — the shape that the underlying `openai` SDK's `Uploadable` type actually accepts in a Node ≥22 / browser context.
2. `FilesCreateParams.purpose?: string` becomes `purpose: HelixFilePurpose` (REQUIRED), where `HelixFilePurpose` mirrors the SDK's `FilePurpose` literal union exactly: `"assistants" | "batch" | "fine-tune" | "vision" | "user_data" | "evals"`.

With the public surface aligned to reality, the adapter cast becomes a structural pass-through — the body of `files.create` in `openai.ts`, `azure.ts` (and `custom.ts`'s un-throw stubs once they exist) no longer needs `as Parameters<typeof client.files.create>[0]` to compile.

### Why now

Phase 2 (`helix-providers-phase-2`) just shipped real HTTP for OpenAI / Azure / Custom. The instant we put the adapter on a real wire, the Phase 1 v2 surface was caught LYING about three runtime-meaningful things:

- **`Uint8Array` is not `Uploadable`.** The `openai` SDK's `Uploadable` requires a `File`-like (or one of a small set of specific stream types) so that `Uploads.toFile` can read `name` and `type`. A bare `Uint8Array` slips through TypeScript at the public surface, gets `as`-cast through the adapter, and then crashes at runtime inside the SDK with an obscure error that does not point back at Helix. The lib is shipping a TypeScript trap.
- **`ArrayBuffer` is not `Uploadable`.** Same trap, same crash, same misleading error.
- **`Blob` is not `File`.** The SDK accepts `File extends Blob`, not the reverse. A plain `Blob` (no `name`, no `lastModified`) is structurally compatible at the type level via duck typing but fails the SDK's runtime guards. Same trap.
- **`purpose` is REQUIRED upstream.** The OpenAI server returns 400 when `purpose` is omitted. Marking it optional in the Helix surface lets a caller compile a call that is server-guaranteed to fail. The Helix type system was promising a feature the OpenAI server flatly rejects.

The user explicitly evaluated two alternatives and chose tightening the contract:

- **Option A (rejected)** — keep the loose surface, add a boundary mapper that converts `Uint8Array | ArrayBuffer | Blob` to `File` inside the adapter. Rejected because (1) the runtime mapper requires synthesizing `name` / `type` out of nothing for `Uint8Array` / `ArrayBuffer` callers, which leaks an arbitrary policy decision into the lib; (2) the public surface keeps lying about `purpose` being optional even though the server requires it; (3) it costs adapter-side complexity to defend a type that should not have been wrong in the first place.
- **Option C (chosen)** — tighten the public surface to match reality. Rejected boundary conversion in favor of an HONEST CONTRACT: the public type accepts what the wire actually accepts, no translation layer in the middle.

This is a deliberate, narrow, BREAKING change to the Phase 1 v2 frozen surface. SemVer allows it because we are pre-1.0 (`0.0.1`), and the alternative is to ship a v1.0 with a known TypeScript trap.

### Success looks like

1. `FilesCreateParams.file` is typed as `File | Blob`. Anyone who was passing `Uint8Array` or `ArrayBuffer` gets a TypeScript compile error that points them at the migration note.
2. `FilesCreateParams.purpose` is REQUIRED and typed as `HelixFilePurpose`. Anyone omitting it gets a TypeScript compile error.
3. `HelixFilePurpose` is exported from the public root (`src/index.ts` re-export chain) so callers can import it without reaching into `core/types/files`.
4. `src/internal/providers/openai.ts` `files.create` body has NO `as Parameters<typeof client.files.create>[0]` cast. The body is a structural pass-through: `client.files.create(params)`.
5. `src/internal/providers/azure.ts` `files.create` body has NO same cast — structural pass-through.
6. `src/internal/providers/custom.ts` `files.create` body is unchanged — it still throws `"helix-lib: 'files.create' not supported by provider 'custom'"` per REQ-FILES-005. The `_params` parameter (currently `_params`) does not need a body change; only its declared type narrows automatically through the public-type tightening.
7. `package.json.version` bumps to `0.1.0` (minor, breaking pre-1.0).
8. `tsc --noEmit` reports zero errors. Zero `as` / `as unknown as` in the `files.create` body of any adapter.
9. The frozen `openspec/specs/files/spec.md` REQ for `files.create` is updated to reflect the tightened types — this is a deliberate spec edit, not a drift, justified by the breaking-change carve-out for pre-1.0.
10. Vitest unit + integration suites still pass against the tightened types (test fixtures may need to migrate from `Uint8Array` / `Blob`-without-name to `File`).

---

## 2. Scope

### IN scope

- **Public type edit** in `src/core/types/files.ts`:
  - `FilesCreateParams.file: Uint8Array | ArrayBuffer | Blob` → `File | Blob`.
  - `FilesCreateParams.purpose?: string` → `purpose: HelixFilePurpose` (REQUIRED).
  - New exported type alias `HelixFilePurpose = "assistants" | "batch" | "fine-tune" | "vision" | "user_data" | "evals"` — mirrors `openai`'s `FilePurpose` literal union.
- **Public re-export** of `HelixFilePurpose` through whatever the existing public re-export chain is (`src/core/index.ts` and / or `src/index.ts` — sdd-design verifies the exact location). It must be importable from the package root.
- **Adapter cast removal**:
  - `src/internal/providers/openai.ts` line 26: `client.files.create(params as Parameters<typeof client.files.create>[0]) as unknown as FileObject` becomes `(await client.files.create(params)) as unknown as FileObject` (the second `as unknown as FileObject` is left to sdd-design — it may also become unnecessary if Helix's `FileObject` is structurally a subset of the SDK's `FileObject`; if not, the second cast remains because it's a return-shape concern, not a parameter-shape concern). The PARAMETER cast disappears unconditionally.
  - `src/internal/providers/azure.ts` line 27: same edit.
  - `src/internal/providers/custom.ts` `files.create`: stays as `throw` stub. No body change.
- **Spec edit** in `openspec/specs/files/spec.md`:
  - REQ-FILES-001 (or whatever the exact REQ ID is for `FilesCreateParams` shape) updates to match the new type.
  - REQ-FILES-* on `purpose` updates to mark it REQUIRED.
  - The frozen contract gets a "**Breaking from Phase 1 v2**" callout pinning the diff so future SDDs can audit it.
- **Version bump** in `package.json`: `0.0.1` → `0.1.0`.
- **Changelog entry** (location TBD by sdd-design — `CHANGELOG.md` at repo root if it exists, otherwise create one in this change). Must spell out the migration steps for callers verbatim.
- **Test migration**:
  - Any unit test under `src/internal/providers/__tests__/*.test.ts` (currently deleted in working tree) and `tests/integration/*.test.ts` that constructs `FilesCreateParams` with `Uint8Array` / `ArrayBuffer` / bare `Blob` migrates to `new File([...], "filename.ext", { type: "..." })`. The integration tests already need `File` (the SDK demands it) — this just makes the test source match what the wire wants.

### OUT of scope (explicitly deferred)

- **The `responses.create` cast at `src/internal/providers/openai.ts:20`** (and the equivalent line in `azure.ts:20-22`, `custom.ts:18-20`). Same code smell — `params as Parameters<typeof client.responses.create>[0]` — but the structural mismatch there is BENIGN at runtime: Helix's `ResponsesCreateParams` is already a structural subset of the SDK's `ResponseCreateParams`. The cast hides nothing that crashes on the wire. Tightening that surface is a separate SDD if and when it becomes a real problem (`helix-responses-cast-cleanup`).
- **Any change to `FileObject`** (the response shape). Phase 2 already aligned `FileObject` with the SDK's response, and it is a return-shape concern; this change is request-shape only.
- **Any change to `FilesCreateParams.expires_after`**. It is already correctly typed.
- **Any change to other Helix interface methods** (`responses.*`, `models.*`, `test`).
- **Any change to provider behavior** beyond removing the cast from `files.create`. No new validation, no defaulting, no translation.
- **Streaming, tools, error model, pagination, Vertex implementation.** All remain in their respective successor SDDs.
- **`HelixFilePurpose` extensibility.** The literal union mirrors the OpenAI SDK exactly. We do NOT add `"assistants_output"`, `"batch_output"`, or `"fine-tune-results"` from the response-side `FileObject.purpose` union, because those are server-generated values and not valid as request inputs. We do NOT widen to `string` for "future-proofing" — that would resurrect the original trap.
- **Browser bundle / runtime support story.** `File` and `Blob` are universal in Node ≥22 (which this lib already requires per `engines.node`) and in every browser. No polyfill question to settle.

### Deliberately untouched files

- `src/createHelix.ts` — `Helix` interface signatures stay bit-identical at the method level. Only the parameter type that the method already references gets tightened.
- `src/internal/providers/vertex.ts` — Vertex stub, not yet implemented for files. No-op for this change.
- `src/internal/providers/custom.ts` — body of `files.create` stays a `throw`. Only the static type of `_params` narrows through the public-type tightening.
- Other public types (`response.ts`, `models.ts`, `request.ts`, `config.ts`).
- `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts` — no compiler / build / runner config drift.

---

## 3. Decisions ratified

These decisions were taken with the user during exploration (engram observation #92) and are FIXED inputs for sdd-spec, sdd-design, sdd-tasks, and sdd-apply. Do NOT relitigate.

### RD-FILES-TIGHTEN-1 — Tighten the contract; do NOT add a boundary mapper

**Decision.** The public surface narrows to match what the wire actually accepts. No adapter-side conversion of `Uint8Array` / `ArrayBuffer` to `File`. No adapter-side defaulting of `purpose`.

**Reasoning citation.** The user explicitly compared option A (boundary mapper) to option C (tighten surface) and chose C. The public type was lying about what the lib supports — and Helix's value proposition is an HONEST, thin, normalized surface over four providers. Faking richer input support than the wire allows undermines that. The "lightest libraries" PR2 principle also applies at the type-system level: the lightest mapper is no mapper.

### RD-FILES-TIGHTEN-2 — `HelixFilePurpose` is a closed literal union mirroring the OpenAI SDK exactly

**Decision.** `HelixFilePurpose = "assistants" | "batch" | "fine-tune" | "vision" | "user_data" | "evals"`. Six values, exactly. No widening to `string`. No widening to include response-side values like `"assistants_output"`. No additional Helix-only synonyms.

**Reasoning citation.** The OpenAI SDK's `FilePurpose` (in `node_modules/openai/resources/files.d.ts` line 119) is exactly this union. Mirroring it preserves the "Helix is a thin pass-through over the OpenAI SDK" mental model. Widening reintroduces the trap. Narrowing creates a coupling we cannot sustain when OpenAI adds a new purpose. Mirroring is the only stable choice.

### RD-FILES-TIGHTEN-3 — `purpose` becomes REQUIRED, not optional with a default

**Decision.** The Helix surface marks `purpose` REQUIRED. The adapter does NOT default it to `"user_data"` or any other value. Callers MUST specify.

**Reasoning citation.** OpenAI's server returns 400 if `purpose` is omitted. Defaulting it inside the lib means the lib makes a policy choice on behalf of the caller (which intent? assistants? user_data? batch?). Different callers want different defaults. The Helix surface's job is to be CORRECT, not opinionated. Required-and-explicit is the only correct stance.

### RD-FILES-TIGHTEN-4 — Minor version bump (0.0.1 → 0.1.0); pre-1.0 SemVer allows it

**Decision.** Bump `package.json.version` from `0.0.1` to `0.1.0`. Document the break in the changelog. Do NOT bump to `1.0.0` — the broader public surface is not yet stable enough to commit to v1.

**Reasoning citation.** SemVer pre-1.0 allows breaking changes on minor (and even patch) bumps, with the convention that minor signals "watch out, breaking" and patch signals "safe." We pick minor to be EXPLICIT about the break. Phase 1 v2's "frozen surface" promise was always conditional on pre-1.0 SemVer; this is the first time we cash in that conditional, narrowly, with full migration documentation.

### RD-FILES-TIGHTEN-5 — Spec edit, not spec drift

**Decision.** The frozen `openspec/specs/files/spec.md` is EDITED (not bypassed, not delta-overlaid) as part of this change. The edit is justified inline with a "**Breaking from Phase 1 v2**" callout pinning the version bump and the migration story.

**Reasoning citation.** Phase 1 v2's freeze contract said "spec is frozen until a SemVer-justified break." This is that break. Pretending the frozen spec is still authoritative while adapter code says otherwise creates exactly the kind of contract drift Phase 1 v2 was designed to prevent. The honest move is to edit the spec, log the diff, and move on.

### RD-FILES-TIGHTEN-6 — `responses.create` cast is OUT of scope

**Decision.** The `as Parameters<typeof client.responses.create>[0]` cast at `openai.ts:20`, `azure.ts:21-22`, `custom.ts:19-20` stays. Removing it is a separate SDD.

**Reasoning citation.** That cast hides a structural-only mismatch (Helix's request shape is a subset of the SDK's request shape) with no runtime crash on the path. The `files.create` cast hides three real runtime crashes. They are different problems with different urgencies. Bundling them violates "smallest viable change" and inflates the SDD's risk surface. Defer.

---

## 4. Approach summary

### High-level

Three tightly coupled edits: the public type, the adapter bodies, and the spec. All three land together in one apply pass, behind one minor version bump.

```
src/core/types/files.ts      ──── (type tightens) ────▶  HelixFilePurpose exported
        │
        ▼
src/internal/providers/{openai,azure}.ts:
   files.create(params) {
     return client.files.create(params)   ◀── no `as Parameters<...>[0]`
       as unknown as FileObject;          ◀── return cast may stay; sdd-design picks
   }

src/internal/providers/custom.ts:
   files.create(_params) { throw ... }     ◀── unchanged, narrows automatically

openspec/specs/files/spec.md ──── (REQ updates) ─────▶  honest spec
package.json                  ──── 0.0.1 → 0.1.0 ────▶  minor bump
CHANGELOG.md                  ──── new entry ────────▶  caller migration steps
```

### Type-system contract

```ts
// BEFORE (Phase 1 v2)
export interface FilesCreateParams {
  file: Uint8Array | ArrayBuffer | Blob;
  purpose?: string;
  expires_after?: { anchor: "created_at"; seconds: number };
}

// AFTER (this change)
export type HelixFilePurpose =
  | "assistants"
  | "batch"
  | "fine-tune"
  | "vision"
  | "user_data"
  | "evals";

export interface FilesCreateParams {
  file: File | Blob;
  purpose: HelixFilePurpose;
  expires_after?: { anchor: "created_at"; seconds: number };
}
```

### Adapter contract

The diff inside `files.create` for each in-scope adapter is purely subtractive:

```ts
// BEFORE
async create(params) {
  return client.files.create(
    params as Parameters<typeof client.files.create>[0]
  ) as unknown as FileObject;
}

// AFTER
async create(params) {
  return (await client.files.create(params)) as unknown as FileObject;
  //                                ^ no parameter cast
}
```

The return cast `as unknown as FileObject` is left to sdd-design — it may also be removable if the Helix `FileObject` is a structural subset of the SDK's `FileObject`, but that's a separate audit. The `Parameters<...>[0]` PARAMETER cast disappears unconditionally.

### Spec contract

`openspec/specs/files/spec.md` updates:

- The REQ that pins `FilesCreateParams.file` shape narrows to `File | Blob`.
- The REQ that pins `FilesCreateParams.purpose` flips from optional to required and pins the `HelixFilePurpose` literal union.
- A "**Breaking from Phase 1 v2** (v0.0.1 → v0.1.0)" callout is added inline with a one-paragraph rationale and a pointer to this change's `proposal.md`.

### Version + changelog contract

- `package.json.version`: `"0.0.1"` → `"0.1.0"`.
- `CHANGELOG.md` (new file if absent, append if present) gets a `## [0.1.0]` entry containing:
  - **BREAKING:** `FilesCreateParams.file` narrowed from `Uint8Array | ArrayBuffer | Blob` to `File | Blob`. Callers using `Uint8Array` / `ArrayBuffer` MUST wrap in a `File` (`new File([uint8arr], "filename.ext", { type: "..." })`) or a `Blob` with a synthesized name strategy.
  - **BREAKING:** `FilesCreateParams.purpose` is now REQUIRED and typed as `HelixFilePurpose`. Callers omitting `purpose` MUST add it; callers passing arbitrary strings MUST narrow to one of the six allowed values.
  - **BREAKING:** New exported type `HelixFilePurpose`.
  - **Internal:** removed the `as Parameters<typeof client.files.create>[0]` cast in OpenAI and Azure adapters; this is a code-quality improvement enabled by the surface tightening, not a separately-observable contract.

### Test migration contract

Any test fixture (under `src/internal/providers/__tests__/` or `tests/integration/`) that currently constructs a `Uint8Array` / `ArrayBuffer` / bare-`Blob` and passes it as `FilesCreateParams.file` migrates to `new File([...], "fixture.txt", { type: "text/plain" })`. The integration tier already needs `File`-shaped uploads to make a real wire call work — the tightening makes the test source match wire reality.

---

## 5. Affected areas

### Files this change MODIFIES

| Path | Action | What changes |
|------|--------|--------------|
| `src/core/types/files.ts` | EDIT | Tighten `FilesCreateParams.file` to `File | Blob`. Make `purpose` required. Add and export `HelixFilePurpose` literal union. |
| `src/core/index.ts` (or wherever the public re-export chain lives) | EDIT | Re-export `HelixFilePurpose` through the package root. sdd-design pins exact location. |
| `src/internal/providers/openai.ts` | EDIT | Remove `as Parameters<typeof client.files.create>[0]` from `files.create` body. |
| `src/internal/providers/azure.ts` | EDIT | Remove `as Parameters<typeof client.files.create>[0]` from `files.create` body. |
| `openspec/specs/files/spec.md` | EDIT | Update REQ-FILES-* for `file` shape and `purpose` required-ness. Add "Breaking from Phase 1 v2" callout. |
| `package.json` | EDIT | Bump `version` from `0.0.1` to `0.1.0`. |
| `CHANGELOG.md` | EDIT or CREATE | Add `## [0.1.0]` entry with the three BREAKING bullets. |
| Existing files-related test fixtures (under `src/internal/providers/__tests__/` or `tests/integration/`) | EDIT | Migrate `Uint8Array` / `ArrayBuffer` / bare-`Blob` constructions to `File`. Add `purpose` to any call that omits it. |

### Files this change ADDS

| Path | Purpose |
|------|---------|
| `CHANGELOG.md` (only if not already present at repo root) | First public changelog entry for the lib. |

### Files this change DOES NOT TOUCH (read-only references)

| Path | Why untouched |
|------|---------------|
| `src/createHelix.ts` | `Helix.files.create(params: FilesCreateParams)` signature stays bit-identical at the method level. Only the parameter type narrows via its dependency on `FilesCreateParams`. |
| `src/internal/providers/custom.ts` | `files.create` body stays a `throw` (REQ-FILES-005). The parameter type narrows automatically. |
| `src/internal/providers/vertex.ts` | Vertex stub. Not in scope. |
| Other public types (`response.ts`, `models.ts`, `request.ts`, `config.ts`) | No request-shape problem outside of `files`. |
| `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts` | No compiler / build / runner drift. |
| `src/internal/providers/openai.ts` line 20 (responses.create cast) | Out of scope per RD-FILES-TIGHTEN-6. |
| `src/internal/providers/azure.ts` lines 21-22 (responses.create cast) | Out of scope per RD-FILES-TIGHTEN-6. |
| `src/internal/providers/custom.ts` lines 18-20 (responses.create cast) | Out of scope per RD-FILES-TIGHTEN-6. |

---

## 6. Success criteria

- [ ] `FilesCreateParams.file` type is `File | Blob`. `Uint8Array` and `ArrayBuffer` no longer compile.
- [ ] `FilesCreateParams.purpose` is REQUIRED and typed as `HelixFilePurpose`.
- [ ] `HelixFilePurpose` is exported from the package root and importable as `import type { HelixFilePurpose } from "@fluxaria/helix-lib"`.
- [ ] `src/internal/providers/openai.ts` `files.create` body has zero `as Parameters<typeof client.files.create>[0]` occurrences.
- [ ] `src/internal/providers/azure.ts` `files.create` body has zero `as Parameters<typeof client.files.create>[0]` occurrences.
- [ ] `src/internal/providers/custom.ts` `files.create` body is unchanged (still throws the documented message).
- [ ] `openspec/specs/files/spec.md` reflects the tightened types with a "Breaking from Phase 1 v2" callout.
- [ ] `package.json.version` is `0.1.0`.
- [ ] `CHANGELOG.md` contains a `## [0.1.0]` entry with three BREAKING bullets and a migration recipe.
- [ ] `tsc --noEmit` reports zero errors.
- [ ] `npm run test` (Vitest unit + integration where credentials present) is green.
- [ ] No new runtime dependency. No new devDependency.
- [ ] `src/createHelix.ts`, `src/index.ts`, `src/internal/providers/vertex.ts` are byte-identical except for the type-level narrowing that flows through the import graph.

---

## 7. Breaking changes

Three observable breaks for any consumer who imports `FilesCreateParams` or who calls `helix.files.create(...)`:

### B1 — `FilesCreateParams.file` narrows from `Uint8Array | ArrayBuffer | Blob` to `File | Blob`

**Symptom.** TypeScript compile error at the call site if the caller passes `Uint8Array` or `ArrayBuffer`.

**Migration.** Wrap the binary payload in a `File`:

```ts
// Before
const buf: Uint8Array = await readFile("./doc.pdf");
await helix.files.create({ file: buf, purpose: "user_data" });

// After
const buf: Uint8Array = await readFile("./doc.pdf");
const file = new File([buf], "doc.pdf", { type: "application/pdf" });
await helix.files.create({ file, purpose: "user_data" });
```

`File` is a Web-platform global available natively in Node ≥22 (which this lib already requires) and in every browser.

### B2 — `FilesCreateParams.purpose` becomes required and narrows from `string` to `HelixFilePurpose`

**Symptom.** TypeScript compile error if `purpose` is omitted, OR if `purpose` is a string outside the six allowed literals.

**Migration.** Always pass one of: `"assistants" | "batch" | "fine-tune" | "vision" | "user_data" | "evals"`. If you do not know which one to pick, the OpenAI docs at https://platform.openai.com/docs/api-reference/files/create cover the semantics. Common choices:

- `"user_data"` — generic uploads for use with Responses API.
- `"assistants"` — files for the Assistants API.
- `"batch"` — `.jsonl` for the Batch API.
- `"fine-tune"` — `.jsonl` training data.

### B3 — New exported type `HelixFilePurpose`

**Symptom.** Existing callers do not break, but the lib now exports an additional type. Anyone with `import * as Helix from "@fluxaria/helix-lib"` may notice the new symbol.

**Migration.** None required. Callers MAY import `HelixFilePurpose` to type their own `purpose` variables, but the existing `string`-typed callers will fail B2 anyway and migrate naturally.

---

## 8. Versioning

- **Current version**: `0.0.1`.
- **New version**: `0.1.0` (minor bump, per RD-FILES-TIGHTEN-4).
- **Justification**: SemVer pre-1.0 allows breaking changes on minor bumps. Minor (rather than patch) is chosen to signal the break LOUDLY in dependency-update tooling.
- **Changelog**: a `CHANGELOG.md` entry is REQUIRED as part of the apply phase. The entry must include the three BREAKING bullets above plus the migration recipe for each.

---

## 9. Risks

| # | Risk | Mitigation |
|---|------|------------|
| R1 | The real consumer `axium-api` may have file-upload code paths that pass `Uint8Array` directly (e.g., from `fs.readFile`) and will break at compile time the moment they bump to `0.1.0`. | Phase 2 archive note already flagged that axium-api would adopt Helix end-to-end; that adoption has not yet locked in `Uint8Array` paths in production. The migration is one-line per call site (`new File([buf], name, { type })`). The CHANGELOG ships the exact recipe. axium-api owners are downstream of this SDD's planning thread and will see the migration call-out before bumping. |
| R2 | Some callers use `Blob` without a `name` and expect the lib (or the SDK) to synthesize one. After tightening, those calls compile but may fail at the SDK layer because `Blob` (without `name`) is not enough for the SDK's `Uploads.toFile` to derive a multipart filename. | This pre-existed the tightening — `Blob`-without-name was already a runtime-only bug hidden by the loose type. Tightening does not introduce the bug; it just leaves an existing bug visible. The README and CHANGELOG migration recipe steers callers toward `File` (which carries `name`) as the recommended type. `Blob` stays accepted for the cases where it works (e.g., browser File-API outputs that are technically `Blob` but carry name metadata via separate channels). |
| R3 | `HelixFilePurpose` could fall behind the OpenAI SDK's `FilePurpose` if OpenAI adds a new purpose (e.g., a hypothetical `"realtime"`). Helix would force callers to bump Helix to use it. | Acceptable cost. The literal union is the WHOLE point — closed to keep the trap closed. When OpenAI adds a purpose, we ship a patch update that mirrors. The lag is single-digit days at worst given how thin this surface is. |
| R4 | The spec edit (`openspec/specs/files/spec.md`) sets a precedent for editing frozen Phase 1 v2 specs. Future SDDs may be tempted to edit the frozen spec without a SemVer break. | The "Breaking from Phase 1 v2" callout pattern is the contract: spec edits are LEGAL only when accompanied by a version bump and a CHANGELOG migration entry. Future SDDs that want to edit a frozen spec without bumping must be rejected at proposal time. sdd-spec for THIS change pins this convention in the spec text. |
| R5 | `tsc --noEmit` may surface unrelated type errors that were previously masked by the loose `FilesCreateParams.file` type accepting too much. Specifically, any internal Helix code that destructures `params.file` assuming `instanceof Blob` may have been silently coerced; with the narrower type the assumption is now load-bearing. | sdd-apply must run `tsc --noEmit` after the type edit and resolve any cascading errors before claiming the apply complete. None expected based on Phase 2's small adapter surface, but verification is mandatory. |
| R6 | The `as unknown as FileObject` return-cast in adapter `files.create` may also become removable if the Helix `FileObject` is a structural subset of the SDK's `FileObject`. If sdd-design audits and finds it removable, the apply scope grows by one more file. If not removable, scope stays as planned. | sdd-design pins the audit. The proposal scope is "remove the parameter cast unconditionally; remove the return cast if structurally safe." Either outcome is a successful apply. |

Open questions for sdd-spec / sdd-design (not blockers — these get answered DURING the next phases, not held over):

- **OQ1.** Where exactly does `HelixFilePurpose` re-export through? `src/index.ts` directly or via `src/core/index.ts`? sdd-design verifies the existing public re-export chain.
- **OQ2.** Does `CHANGELOG.md` already exist at repo root, or do we create it? sdd-design checks. If it exists, we append; if not, we create with a `## [0.1.0]` entry plus a `## [0.0.1]` retroactive entry summarizing Phase 1 + Phase 2.
- **OQ3.** Does the return cast `as unknown as FileObject` in `files.create` survive the audit? sdd-design pins.

---

## 10. Dependencies

**No new runtime dependencies.** No new devDependencies. The SDK's `FilePurpose` literal union is the source of truth that `HelixFilePurpose` mirrors, but we do NOT re-export the SDK's type — we declare our own identical-by-value alias to keep the public surface independent from SDK type evolution. (If the SDK's union changes, our re-mirror is a deliberate one-line edit, not an automatic propagation.)

---

## 11. Successor work (candidate)

- `helix-responses-cast-cleanup` — only created if the `responses.create` cast at `openai.ts:20` (and equivalents) is later observed to mask a runtime mismatch. Today it is a benign structural cast; tomorrow if a Helix surface field gains a shape that the SDK rejects, that change becomes urgent. Not started.
- Any future `FilePurpose` addition by OpenAI triggers a one-line patch update mirroring the union into `HelixFilePurpose`. Not a planned SDD; just a maintenance reflex.

---

## 12. Next phase

`sdd-spec` and `sdd-design` MAY run in parallel.

- **sdd-spec** — produces the delta to `openspec/specs/files/spec.md` (REQ-level updates for `FilesCreateParams.file` shape and `purpose` required-ness, plus the "Breaking from Phase 1 v2" callout). Also writes Given/When/Then scenarios for the type-tightening assertions that Vitest will check (e.g., "WHEN a caller passes `Uint8Array`, THEN `tsc --noEmit` reports an error" — type-level test, may need `tsd` or a `// @ts-expect-error` pattern, sdd-design's call). Pins the exact REQ IDs that change.
- **sdd-design** — pins the implementation-level details this proposal deferred:
  - Exact location of `HelixFilePurpose` re-export (OQ1).
  - CHANGELOG.md create-or-append (OQ2).
  - Return-cast survival audit (OQ3).
  - Migration recipe wording in CHANGELOG.md.
  - Whether type-level assertions go in a separate file (`tests/types/*.test-d.ts` with `tsd`) or via inline `// @ts-expect-error` markers in existing unit tests.
  - Confirms no `tsup` external/bundle policy change is needed (no new dep means no new bundle question).

---

**End of proposal.**
