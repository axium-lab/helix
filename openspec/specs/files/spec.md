# Spec: Files

**Change**: helix-public-api-redesign
**Domain**: files
**Status**: stable (archived 2026-04-28)

## Overview

Defines `helix.files.create`, `helix.files.list`, and `helix.files.delete` contracts, the `FilesCreateParams` and `FileObject` shapes, and the per-provider support matrix. OpenAI and Azure MUST support all three operations. Custom and Vertex adapters MUST throw a plain `Error` for all file operations (temporary until `helix-error-model`). Satisfies HX2, RD-8, proposal §8. In v0 of this change, errors propagate raw from the provider/SDK; structured `HelixError` is deferred to `helix-error-model`.

---

## Requirements

### REQ-FILES-001: files.create signature and params

**Identifiers**: HX2, RD-8
**Priority**: MUST

`helix.files.create(params: FilesCreateParams): Promise<FileObject>` MUST be the sole file upload entry point. `FilesCreateParams` MUST expose:

| Field | Type | Required |
|-------|------|----------|
| `file` | `Uint8Array \| ArrayBuffer \| Blob` | MUST |
| `purpose` | `string` | OPTIONAL |
| `expires_after` | `{ anchor: "created_at"; seconds: number }` | OPTIONAL |

Field names MUST use snake_case (ADR-1). No ephemeral inline content parts exist (RD-8).

#### Scenario: Upload with minimal params

- **GIVEN** `params = { file: new Uint8Array([...]) }` and provider is OpenAI
- **WHEN** `helix.files.create(params)` is called
- **THEN** the promise MUST resolve with a `FileObject`
- **AND** `FileObject.id` MUST be a non-empty string usable as `file_id` in `InputFile`

#### Scenario: Upload with expiry

- **GIVEN** `params = { file: blob, purpose: "assistants", expires_after: { anchor: "created_at", seconds: 3600 } }`
- **WHEN** `helix.files.create(params)` is called on OpenAI or Azure
- **THEN** the promise MUST resolve with a `FileObject` whose `expires_at` reflects the requested expiry

---

### REQ-FILES-002: FileObject shape

**Identifiers**: HX2, ADR-1
**Priority**: MUST

`FileObject` MUST expose:

| Field | Type | Required |
|-------|------|----------|
| `id` | `string` | MUST |
| `object` | `"file"` (literal) | MUST |
| `bytes` | `number` | MUST |
| `created_at` | `number` (Unix epoch) | MUST |
| `filename` | `string` | OPTIONAL |
| `purpose` | `string` | MUST |
| `expires_at` | `number` (Unix epoch) | OPTIONAL |

Field names MUST use snake_case (ADR-1). No additional normative fields exist in this change.

#### Scenario: FileObject shape conformance

- **GIVEN** a successful `files.create` call on OpenAI
- **WHEN** the response is resolved
- **THEN** the object MUST have `object === "file"`, a non-empty `id`, a numeric `bytes`, a numeric `created_at`, and a `purpose` string

---

### REQ-FILES-003: files.list signature

**Identifiers**: HX2
**Priority**: MUST

`helix.files.list(): Promise<FileObject[]>` MUST return all files visible to the configured credentials. The array MAY be empty. No pagination parameters exist in this change.

#### Scenario: List returns array

- **GIVEN** provider is OpenAI and at least one file has been uploaded
- **WHEN** `helix.files.list()` is called
- **THEN** the promise MUST resolve with an array containing at least one `FileObject`

#### Scenario: List returns empty array when no files

- **GIVEN** provider is Azure and no files have been uploaded
- **WHEN** `helix.files.list()` is called
- **THEN** the promise MUST resolve with `[]` — not `null` or `undefined`

---

### REQ-FILES-004: files.delete signature

**Identifiers**: HX2
**Priority**: MUST

`helix.files.delete(id: string): Promise<{ id: string; deleted: true }>` MUST delete the file identified by `id` and resolve with `{ id, deleted: true }`. If the file does not exist or deletion fails, the raw provider error MUST propagate.

#### Scenario: Successful deletion

- **GIVEN** a file with `id: "file-abc"` exists and provider is OpenAI
- **WHEN** `helix.files.delete("file-abc")` is called
- **THEN** the promise MUST resolve with `{ id: "file-abc", deleted: true }`

#### Scenario: Non-existent file deletion

- **GIVEN** `id: "file-does-not-exist"` and provider is Azure
- **WHEN** `helix.files.delete("file-does-not-exist")` is called
- **THEN** the raw provider error MUST propagate — no `HelixError` wrapping in v0

---

### REQ-FILES-005: Per-provider support matrix

**Identifiers**: HX2, proposal §8
**Priority**: MUST

| Operation | OpenAI | Azure | Custom | Vertex |
|-----------|--------|-------|--------|--------|
| `files.create` | MUST support | MUST support | MUST throw | MUST throw |
| `files.list` | MUST support | MUST support | MUST throw | MUST throw |
| `files.delete` | MUST support | MUST support | MUST throw | MUST throw |

For Custom and Vertex providers, all three file operations MUST throw a plain `Error` with message: `helix-lib: '<operation>' not supported by provider '<kind>'`. This is temporary — when `helix-error-model` ships, these throws will become structured `HelixError` of kind `UnsupportedFeature`.

#### Scenario: files.create on Custom provider throws

- **GIVEN** provider is `custom` and `baseUrl` is configured
- **WHEN** `helix.files.create(params)` is called
- **THEN** the call MUST throw a plain `Error`
- **AND** the error message MUST contain `"helix-lib"` and `"files.create"` and `"custom"`

#### Scenario: files.list on Vertex provider throws

- **GIVEN** provider is `vertex`
- **WHEN** `helix.files.list()` is called
- **THEN** the call MUST throw a plain `Error`
- **AND** the error message MUST contain `"helix-lib"` and `"files.list"` and `"vertex"`

#### Scenario: files.delete on Vertex provider throws

- **GIVEN** provider is `vertex`
- **WHEN** `helix.files.delete("file-x")` is called
- **THEN** the call MUST throw a plain `Error` with a message identifying `"files.delete"` and `"vertex"`

---

### REQ-FILES-006: Raw error passthrough for supported providers

**Identifiers**: RD-4
**Priority**: MUST

In v0 of this change, errors propagate raw from the provider/SDK; structured `HelixError` is deferred to `helix-error-model`. For OpenAI and Azure, when a file operation fails (network, auth, quota, etc.), the raw SDK error MUST propagate to the caller without wrapping.

#### Scenario: Auth failure on files.list

- **GIVEN** provider is OpenAI and the `apiKey` is invalid
- **WHEN** `helix.files.list()` is called
- **THEN** the promise MUST reject with the raw OpenAI SDK error

---

**End of spec.**
