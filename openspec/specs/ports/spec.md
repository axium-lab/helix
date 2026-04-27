# Spec: Ports

**Change**: helix-interface-definition
**Domain**: ports
**Status**: main

## Overview

Defines the Hexagonal port interfaces that bound the core domain from provider-specific implementations. Covers `HelixProvider` (HX1, HX3, HX4, HX5, HX6), `HelixFileStore` (HX2), `HelixClient` (aggregate), and the `ProviderCapabilities` contract that drives runtime feature detection. Satisfies PR1 (normalized output), PR4 (Phase 1 compatibility), and PR6 (error normalization obligation on the adapter side of each port).

---

## Requirements

### REQ-PORT-001: HelixProvider.request() contract

**Identifiers**: HX1, PR1
**Priority**: MUST

`HelixProvider` MUST expose a `request(req: HelixRequest): Promise<HelixResponse>` method. The returned promise MUST resolve to a `HelixResponse` that conforms to REQ-CT-003. It MUST reject with a `HelixError` (never a raw provider error) when any error occurs. No other return type is valid in Phase 1.

#### Scenario: Successful request

- **GIVEN** a valid `HelixRequest` is passed to a configured `HelixProvider`
- **WHEN** `provider.request(req)` is awaited
- **THEN** the promise MUST resolve to a `HelixResponse` with `object: "response"` and a non-empty `output` array

#### Scenario: Provider error propagation

- **GIVEN** the upstream provider returns an error (e.g., HTTP 401)
- **WHEN** `provider.request(req)` is awaited
- **THEN** the promise MUST reject with a `HelixError` (never a raw SDK error or plain `Error`)
- **AND** `HelixError.is(err)` MUST return `true` for the rejected value

---

### REQ-PORT-002: HelixProvider.capabilities() contract

**Identifiers**: HX1, HX2, HX4, HX5, HX6, PR4
**Priority**: MUST

`HelixProvider` MUST expose a `capabilities(): ProviderCapabilities` method that returns a synchronous, static descriptor. The descriptor MUST accurately reflect the provider's supported features as defined in the capability matrix (proposal §6). This method MUST NOT make any network calls.

#### Scenario: OpenAI capabilities

- **GIVEN** a `HelixProvider` created via `createOpenAI()`
- **WHEN** `provider.capabilities()` is called
- **THEN** the result MUST have `provider: "openai"`, `files: true`, `nativeTools` including `"web_search"`, `"file_search"`, `"code_interpreter"`, `thinking: true`, `structuredOutput: true`, `streaming: false`

#### Scenario: Vertex capabilities

- **GIVEN** a `HelixProvider` created via `createVertex()`
- **WHEN** `provider.capabilities()` is called
- **THEN** the result MUST have `provider: "vertex"`, `files: false`, `nativeTools` including only `"google_search"`, `thinking: true`, `structuredOutput: true`, `streaming: false`

#### Scenario: Custom endpoint capabilities

- **GIVEN** a `HelixProvider` created via `createOpenAICompatible()`
- **WHEN** `provider.capabilities()` is called
- **THEN** the result MUST have `provider: "custom"`, `files: false`, `nativeTools: []`, `thinking: false`, `structuredOutput: false`, `streaming: false`

#### Scenario: Azure capabilities

- **GIVEN** a `HelixProvider` created via `createAzureOpenAI()`
- **WHEN** `provider.capabilities()` is called
- **THEN** the result MUST have `provider: "azure"`, `files: true`, `nativeTools` including `"file_search"`, `"code_interpreter"` (NOT `"web_search"`, NOT `"google_search"`), `thinking: true`, `structuredOutput: true`, `streaming: false`

---

### REQ-PORT-003: ProviderCapabilities shape

**Identifiers**: HX1, HX4, HX6, PR4
**Priority**: MUST

`ProviderCapabilities` MUST expose: `provider: HelixProviderKind`, `files: boolean`, `nativeTools: ReadonlyArray<NativeToolName>`, `thinking: boolean`, `structuredOutput: boolean`, `streaming: false`. `streaming` MUST be the literal type `false` in Phase 1 (not `boolean`).

#### Scenario: Capability used for feature detection

- **GIVEN** a caller retrieves `provider.capabilities()`
- **WHEN** inspecting `capabilities.files`
- **THEN** a `true` value MUST guarantee that `HelixClient.files` is a `HelixFileStore` instance (not `undefined`)
- **AND** a `false` value MUST mean `HelixClient.files` is `undefined`

---

### REQ-PORT-004: HelixFileStore.upload() contract

**Identifiers**: HX2
**Priority**: MUST

`HelixFileStore` MUST expose `upload(input: UploadInput): Promise<FileRef>`. The returned `FileRef` MUST include `id` (string), `bytes` (number), `mimeType` (string), `createdAt` (Unix epoch), and OPTIONAL `filename?` and `expiresAt?`. The `id` MUST be usable in subsequent `InputFile` content parts.

#### Scenario: Successful upload

- **GIVEN** a `HelixFileStore` instance and an `UploadInput` with valid `data` and `mimeType`
- **WHEN** `fileStore.upload(input)` is awaited
- **THEN** it MUST resolve to a `FileRef` with a non-empty `id`
- **AND** the returned `id` MUST be accepted by the same provider in a subsequent `InputFile` content part

#### Scenario: Upload failure

- **GIVEN** the provider rejects the upload (e.g., unsupported MIME type, quota exceeded)
- **WHEN** `fileStore.upload(input)` is awaited
- **THEN** the promise MUST reject with a `HelixError`

---

### REQ-PORT-005: HelixFileStore.upload() purpose defaulting

**Identifiers**: HX2, PR4
**Priority**: MUST

When `UploadInput.purpose` is not provided, each adapter MUST apply its own default: OpenAI MUST default to `"user_data"`, Azure MUST default to `"assistants"`. Callers MAY override the default by providing an explicit `purpose` string. The adapter MUST pass the resolved `purpose` to the upstream Files API.

#### Scenario: OpenAI default purpose

- **GIVEN** `UploadInput` omits `purpose` and the provider is OpenAI
- **WHEN** the adapter calls the upstream Files API
- **THEN** it MUST send `purpose: "user_data"`

#### Scenario: Azure default purpose

- **GIVEN** `UploadInput` omits `purpose` and the provider is Azure
- **WHEN** the adapter calls the upstream Files API
- **THEN** it MUST send `purpose: "assistants"`

#### Scenario: Explicit purpose overrides default

- **GIVEN** `UploadInput.purpose` is `"fine-tune"`
- **WHEN** the adapter calls the upstream Files API
- **THEN** it MUST send `purpose: "fine-tune"` regardless of provider

---

### REQ-PORT-006: HelixFileStore.list() and delete() contracts

**Identifiers**: HX2
**Priority**: MUST

`HelixFileStore` MUST expose `list(opts?: { limit?: number }): Promise<FileRef[]>` and `delete(fileId: string): Promise<{ id: string; deleted: true }>`. Both MUST reject with `HelixError` on failure. `list` MUST return an empty array (not throw) when no files exist.

#### Scenario: List with no files

- **GIVEN** no files have been uploaded
- **WHEN** `fileStore.list()` is called
- **THEN** it MUST resolve to an empty array `[]`

#### Scenario: Delete existing file

- **GIVEN** a file with a known `id` exists
- **WHEN** `fileStore.delete(id)` is called
- **THEN** it MUST resolve to `{ id, deleted: true }`

#### Scenario: Delete non-existent file

- **GIVEN** `fileId` does not correspond to any uploaded file
- **WHEN** `fileStore.delete(fileId)` is called
- **THEN** the promise MUST reject with a `HelixError` with `kind: "InvalidRequest"`

---

### REQ-PORT-007: HelixClient aggregate contract

**Identifiers**: HX1, HX2, PR4
**Priority**: MUST

`HelixClient` MUST expose `provider: HelixProvider` and `files?: HelixFileStore`. `files` MUST be `undefined` for `createVertex()` and `createOpenAICompatible()` in Phase 1. `files` MUST be a `HelixFileStore` instance for `createOpenAI()` and `createAzureOpenAI()`. This MUST be consistent with `provider.capabilities().files`.

#### Scenario: OpenAI client has files

- **GIVEN** a `HelixClient` returned by `createOpenAI()`
- **THEN** `client.files` MUST be a `HelixFileStore` instance
- **AND** `client.provider.capabilities().files` MUST be `true`

#### Scenario: Vertex client has no files

- **GIVEN** a `HelixClient` returned by `createVertex()`
- **THEN** `client.files` MUST be `undefined`
- **AND** `client.provider.capabilities().files` MUST be `false`

---

## Type Surface (informative)

See proposal §5.5, §5.6, and §5.7 for the TypeScript declarations of `HelixProvider`, `HelixFileStore`, `ProviderCapabilities`, and `HelixClient`.

---

## Open Items

1. **`ProviderCapabilities.nativeTools` for custom endpoints**: The capability matrix marks all native tools as `DROP/STRICT` for custom endpoints. The spec (REQ-PORT-002) returns `nativeTools: []` for custom. This means callers using `strict: true` with any native tool on a custom provider will throw at the adapter level before `capabilities()` is consulted. Confirm this is the intended UX in design.
2. **Azure `nativeTools` list completeness**: The capability matrix shows Azure supports `file_search` and `code_interpreter` but NOT `web_search`. If Azure gains `web_search` support in a future API version, the capability descriptor needs a version-conditional update. Flag for the design phase.
3. **`HelixFileStore` TTL support**: `UploadInput.ttl` semantics differ per provider. OpenAI does not natively support TTL on uploaded files — the adapter would need to implement TTL-based cleanup externally. This is a design-phase concern; spec only mandates the interface shape.
