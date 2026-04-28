# Changelog

All notable changes to `@fluxaria/helix-lib` are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
with pre-1.0 conventions: minor bumps signal BREAKING changes; patch bumps are safe.

## [0.1.0] — 2026-04-28

### Changed (BREAKING)

- **`FilesCreateParams.file` narrows from `Uint8Array | ArrayBuffer | Blob` to `File | Blob`.**
  The previous type was a runtime trap: the OpenAI SDK accepts `Uploadable = File | Response | FsReadStream | BunFile`, which does NOT include `Uint8Array` or `ArrayBuffer`. Calls passing those types compiled but crashed at runtime inside the SDK.

  Migration:

  ```ts
  // Before (compiled, crashed at runtime)
  const buf: Uint8Array = await readFile("./doc.pdf");
  await helix.files.create({ file: buf, purpose: "user_data" });

  // After (recommended — File with name + type)
  const buf: Uint8Array = await readFile("./doc.pdf");
  const file = new File([buf], "doc.pdf", { type: "application/pdf" });
  await helix.files.create({ file, purpose: "user_data" });

  // After (escape hatch for very large files — stream via Response → Blob)
  import { createReadStream } from "node:fs";
  import { Readable } from "node:stream";
  const stream = createReadStream("./big.bin");
  const file = new File(
    [await new Response(Readable.toWeb(stream)).blob()],
    "big.bin",
    { type: "application/octet-stream" },
  );
  await helix.files.create({ file, purpose: "user_data" });
  ```

- **`FilesCreateParams.purpose` becomes REQUIRED and narrows from `string` to `HelixFilePurpose`.**
  The OpenAI server returns 400 when `purpose` is omitted. Marking it optional with a wide `string` type allowed callers to compile a call that the server rejects. The new type is a closed literal union mirroring OpenAI's `FilePurpose` exactly.

  ```ts
  // Before
  await helix.files.create({ file }); // compiled, server returned 400
  await helix.files.create({ file, purpose: "anything" }); // compiled, server may 400

  // After
  await helix.files.create({ file, purpose: "user_data" }); // OK
  // purpose must be one of: "assistants" | "batch" | "fine-tune" | "vision" | "user_data" | "evals"
  ```

### Added

- **New exported type `HelixFilePurpose`.**
  ```ts
  import type { HelixFilePurpose } from "@fluxaria/helix-lib";
  ```
  Mirrors `openai`'s `FilePurpose` literal union exactly: `"assistants" | "batch" | "fine-tune" | "vision" | "user_data" | "evals"`.

  **SOURCE OF TRUTH**: `node_modules/openai/resources/files.d.ts` `FilePurpose`. When upgrading the `openai` dependency, audit this union for drift. Helix must ship a patch release that mirrors any new value.

### Removed (internal)

- Removed the `as Parameters<typeof client.files.create>[0]` cast from `src/internal/providers/openai.ts` and `src/internal/providers/azure.ts`. This is a code-quality improvement enabled by the surface tightening above; not a separately-observable contract change. A one-line `Blob`→`File` guard inside each adapter handles the `Blob` branch (which the SDK's `Uploadable` does not accept directly).

[0.1.0]: https://github.com/fluxaria/helix-lib/releases/tag/v0.1.0
