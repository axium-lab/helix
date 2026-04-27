# Tasks: helix-interface-definition

**Goal**: Land the public TypeScript interface surface for helix-lib. Implementation, tests, and infra bootstrap are subsequent changes.

**Total tasks**: 22

**Explicitly OUT of scope**: test files, ESLint/Prettier config, adapter implementation bodies (only `not-implemented` stubs), `src/core/normalize/` files, `runToolLoop`, streaming types, `n > 1` support.

---

## Phase 0 — Package bootstrap

- [x] 0.1 **`package.json`** — package metadata for GitHub Packages publishing.
  - `name`: `"@fluxaria/helix-lib"`
  - `version`: `"0.0.1"`
  - `description`: one-line summary referencing helix-lib's purpose
  - `license`: `"UNLICENSED"`
  - `private`: `false` (must be `false` to publish; access is controlled by GitHub Packages auth)
  - `type`: `"module"`
  - `main`: `"./dist/cjs/index.js"`
  - `module`: `"./dist/esm/index.js"`
  - `types`: `"./dist/types/index.d.ts"`
  - `exports`: `{ ".": { "import": "./dist/esm/index.js", "require": "./dist/cjs/index.js", "types": "./dist/types/index.d.ts" } }`
  - `files`: `["dist", "README.md", "LICENSE"]`
  - `repository`: `{ "type": "git", "url": "git+https://github.com/fluxaria/helix-lib.git" }`
  - `publishConfig`: `{ "registry": "https://npm.pkg.github.com", "access": "restricted" }`
  - `scripts`: minimal — `"build": "tsup"`, `"clean": "rm -rf dist"`
  - `devDependencies`: `tsup`, `typescript` (latest stable as of 2026-04 — pin exact versions during apply)
  - `dependencies`: NONE (per ADR-10, `core/` is zero-dependency; SDK installs come in the adapter-implementation change)
  - Tied to: ADR-5, ADR-10. Pattern: `package.json` only.

- [x] 0.2 **`tsconfig.json`** — TypeScript compiler config for the package.
  - `target`: `"ES2022"`
  - `module`: `"NodeNext"`
  - `moduleResolution`: `"NodeNext"`
  - `strict`: `true`
  - `declaration`: `true` (build still emits `.d.ts` via tsup)
  - `outDir`: `"dist"`
  - `rootDir`: `"src"`
  - `lib`: `["ES2022"]`
  - `skipLibCheck`: `true`
  - `esModuleInterop`: `true`
  - `forceConsistentCasingInFileNames`: `true`
  - `include`: `["src/**/*"]`
  - `exclude`: `["dist", "node_modules"]`
  - Tied to: ADR-10 (zero-dependency core), design §3. Pattern: `tsconfig.json` only.

- [x] 0.3 **`tsup.config.ts`** — build configuration emitting dual ESM + CJS + `.d.ts`.
  - `entry`: `["src/index.ts"]`
  - `format`: `["esm", "cjs"]`
  - `dts`: `true`
  - `outDir`: `"dist"`
  - `clean`: `true`
  - `splitting`: `false` (single entry)
  - `target`: `"es2022"`
  - Sub-folders: ESM in `dist/esm`, CJS in `dist/cjs`, types in `dist/types` (use `outExtension` and folder hooks if needed; the apply phase chooses the cleanest layout that matches the `package.json` `exports` field).
  - Tied to: design §3. Pattern: `tsup.config.ts` only.

- [x] 0.4 **`.npmrc.example`** — template for downstream consumers (NOT committed as `.npmrc`).
  - Two lines: `@fluxaria:registry=https://npm.pkg.github.com` and `//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}`
  - This file is for documentation — consumers (e.g. ocr-ai) copy it to `.npmrc` and set `GITHUB_TOKEN` in their env.
  - Tied to: GitHub Packages publishing requirements. Pattern: documentation file.

- [x] 0.5 **`.gitignore`** — exclude build output and node_modules.
  - Lines: `dist/`, `node_modules/`, `*.log`, `.env`, `.env.*`, `coverage/`
  - Pattern: standard `.gitignore` for a TS library.

---

## Phase 1 — Core types

- [x] 1.1 **`src/core/types/request.ts`** — exports `HelixRole`, `InputText`, `InputFile`, `InputFileEphemeral`, `InputContentPart`, `InputMessage`, `HelixThinking`, `HelixResponseFormat`, `HelixRequestOptions`, `HelixRequest`. Tied to: REQ-CT-001, REQ-CT-002, REQ-CT-004, REQ-CT-005, REQ-CT-007, REQ-CT-008, REQ-CT-009, ADR-1, ADR-3, ADR-6, ADR-8, ADR-9. Pattern: helix-defined interfaces and discriminated unions by `type`; camelCase for helix-original fields, snake_case for wire-shape fields. NO function bodies.

- [x] 1.2 **`src/core/types/response.ts`** — exports `HelixResponse`, `HelixUsage`, `OutputMessage`, `OutputTextPart`, `RefusalPart`, `OutputContentPart`, `FunctionCallOutput`, `ReasoningOutput`, `OutputItem`. Per ADR-10, these are HELIX-OWNED interfaces — NOT type aliases. Field naming MUST mirror Responses API wire shape with snake_case where applicable (`id`, `object: "response"`, `created_at`, `model`, `output`, `output_text?`, `usage.input_tokens`, `usage.output_tokens`, `usage.total_tokens`). `OutputItem` is a discriminated union by `type` (`"message" | "function_call" | "reasoning"`). NO `import` from `openai/...`. NO function bodies. Tied to: REQ-CT-003, REQ-TOOL-004, ADR-1, ADR-9, ADR-10. Pattern: helix-owned interfaces and discriminated union by `type`.

- [x] 1.3 **`src/core/types/tools.ts`** — exports `NativeToolName`, `NativeTool`, `FunctionTool`, `ToolChoice`. Tied to: REQ-TOOL-001, REQ-TOOL-003, REQ-TOOL-005, ADR-7, ADR-9. Pattern: string-literal union for `NativeToolName`; interfaces with `type` discriminant for `NativeTool` / `FunctionTool`; string-or-object union for `ToolChoice`. NO function bodies.

- [x] 1.4 **`src/core/types/error.ts`** — exports `HelixProviderKind`, `HelixErrorKind`, `HelixErrorInit`, `HelixError`. `HelixError` MUST be a RUNTIME class (not `declare class`) that `extends Error` with `readonly kind`, `readonly provider`, `readonly statusCode?`, `readonly raw?`, `readonly retryable`, a constructor accepting `HelixErrorInit`, and a `static is(err: unknown): err is HelixError` guard with structural fallback (see design §6.3 for the exact body). This is the ONE runtime export in this change. Tied to: REQ-ERR-001, REQ-ERR-002, REQ-ERR-003, REQ-ERR-006, ADR-2, ADR-9. Pattern: runtime class extending `Error`; discriminant field is `kind` (not `type`).

- [x] 1.5 **`src/core/types/capabilities.ts`** — exports `ProviderCapabilities`. Field `streaming` MUST be typed as the literal `false` (not `boolean`). `nativeTools` MUST be `ReadonlyArray<NativeToolName>`. Tied to: REQ-PORT-002, REQ-PORT-003, ADR-7. Pattern: plain interface with literal type for `streaming`. Imports `NativeToolName` from `./tools` and `HelixProviderKind` from `./error`. NO function bodies.

---

## Phase 2 — Ports

- [x] 2.1 **`src/core/ports/provider.port.ts`** — exports `HelixProvider`. Methods: `request(req: HelixRequest): Promise<HelixResponse>` and `capabilities(): ProviderCapabilities`. Tied to: REQ-PORT-001, REQ-PORT-002, REQ-PORT-003, ADR-4. Pattern: interface with method signatures only; imports from `../types/*`. NO implementation.

- [x] 2.2 **`src/core/ports/file-store.port.ts`** — exports `UploadInput`, `FileRef`, `HelixFileStore`. `HelixFileStore` methods: `upload(input: UploadInput): Promise<FileRef>`, `list(opts?: { limit?: number }): Promise<FileRef[]>`, `delete(fileId: string): Promise<{ id: string; deleted: true }>`. Tied to: REQ-PORT-004, REQ-PORT-005, REQ-PORT-006, ADR-4. Pattern: interface with method signatures; `UploadInput` and `FileRef` are helix-original plain interfaces (camelCase). NO implementation.

---

## Phase 3 — Aggregate client

- [x] 3.1 **`src/core/client.ts`** — exports `HelixClient` as an interface with `provider: HelixProvider` and `files?: HelixFileStore`. Tied to: REQ-PORT-007, ADR-4, ADR-5. Pattern: plain interface composing the two ports. Imports from `./ports/provider.port` and `./ports/file-store.port`. NO function bodies.

---

## Phase 4 — Core barrel

- [x] 4.1 **`src/core/index.ts`** — re-exports every type and interface from `core/types/*`, `core/ports/*`, and `core/client.ts`. This barrel is the single import target for adapter modules (`import type { HelixProvider, HelixRequest } from "../../core"`). MUST re-export `HelixError` (runtime value). MUST NOT declare any new types. Tied to: ADR-10 (barrel strategy, design §3.3). Pattern: pure re-export barrel.

---

## Phase 5 — Adapter factory signatures

- [x] 5.1 **`src/adapters/openai/factory.ts`** — exports `OpenAIConfig` (required: `apiKey: string`; optional: `baseUrl?`, `organization?`, `project?`, `defaultHeaders?`) and `createOpenAI(config: OpenAIConfig): HelixClient`. Factory body: `throw new Error("not implemented")`. Tied to: REQ-FAC-001, REQ-FAC-005, REQ-FAC-006, ADR-5. Pattern: config interface + factory function signature with `not-implemented` body.

- [x] 5.2 **`src/adapters/azure/factory.ts`** — exports `AzureOpenAIConfig` (required: `apiKey`, `endpoint`, `apiVersion`; optional: `defaultHeaders?`) and `createAzureOpenAI(config: AzureOpenAIConfig): HelixClient`. NO `deployment` field in `AzureOpenAIConfig` — deployment name comes from `HelixRequest.model` at call time (REQ-FAC-007). Factory body: `throw new Error("not implemented")`. Tied to: REQ-FAC-002, REQ-FAC-005, REQ-FAC-007, ADR-5. Pattern: config interface + factory function signature with `not-implemented` body.

- [x] 5.3 **`src/adapters/custom/factory.ts`** — exports `OpenAICompatibleConfig` (required: `apiKey`, `baseUrl`; optional: `defaultHeaders?`) and `createOpenAICompatible(config: OpenAICompatibleConfig): HelixClient`. No `HelixFileStore` — `client.files` is always `undefined` for this adapter. Factory body: `throw new Error("not implemented")`. Tied to: REQ-FAC-003, REQ-FAC-005, ADR-5. Pattern: config interface + factory function signature with `not-implemented` body.

- [x] 5.4 **`src/adapters/vertex/factory.ts`** — exports `VertexCredentials` (discriminated union: `{ clientEmail, privateKey } | { keyFile }`), `VertexConfig` (required: `projectId`, `location`; optional: `credentials?`, `apiVersion?`), and `createVertex(config: VertexConfig): HelixClient`. No `HelixFileStore`. Factory body: `throw new Error("not implemented")`. Tied to: REQ-FAC-004, REQ-FAC-005, ADR-5. Pattern: credentials discriminated union (structural, not string-tagged); config interface + factory function signature with `not-implemented` body.

---

## Phase 6 — Public barrel

- [x] 6.1 **`src/index.ts`** — public package-level barrel. MUST re-export all named types from `./core` using `export type { ... }` and re-export runtime values (`HelixError`, `createOpenAI`, `createAzureOpenAI`, `createOpenAICompatible`, `createVertex`) as value exports. Consumers MUST import only from `helix-lib` (the package root) — no deep import paths are part of the supported surface. Also re-exports all factory config types (`OpenAIConfig`, `AzureOpenAIConfig`, `OpenAICompatibleConfig`, `VertexConfig`, `VertexCredentials`). Tied to: all REQ-IDs (this is the single public surface consumers see), ADR-5, design §3.3. Pattern: pure re-export barrel; `export type` for types, bare `export` for values.

---

## Phase 7 — Verification

- [x] 7.1 **REQ-ID coverage check** — verified: HelixError covers REQ-ERR-001..003, REQ-ERR-006 (ERR-004/005 are adapter-behavior reqs, not type-surface); factories cover REQ-FAC-001..007; ports cover REQ-PORT-001..007; request/response types cover REQ-CT-001..009; tool types cover REQ-TOOL-001..005. No REQ-ID missing from public surface.

- [x] 7.2 **Dependency-direction audit** — verified: `grep -r "from.*adapters" src/core` returns CLEAN (no results). `src/index.ts` is the only file importing from both layers. `src/core/types/capabilities.ts` imports only from `./tools.js` and `./error.js` (no ports or client). Hexagonal boundary enforced.

- [x] 7.3 **Type-check** — `tsc --noEmit` passed with zero errors. TypeScript 6.0.3, NodeNext module resolution, strict mode. All 14 source files type-check cleanly.
