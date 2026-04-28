# Delta for OpenAI Provider — helix-providers-phase-2

**Change**: helix-providers-phase-2
**Domain**: openai provider implementation
**Status**: draft

## Overview

Governs the real-HTTP implementation inside `src/internal/providers/openai.ts`. The public surface (types, factory signature, `Helix` interface) is frozen from Phase 1 v2. This delta adds implementation-level requirements for transport, SDK construction, method-to-SDK mapping, response normalization, and error propagation.

---

## ADDED Requirements

### REQ-OAI-001: SDK client construction

The OpenAI adapter MUST construct the `openai` SDK client using `new OpenAI({ apiKey: config.apiKey })`. If `config.baseUrl` is present it MUST be passed as `baseURL`. No other constructor fields (organization, project, fetch overrides) MUST be set by the adapter.

**Acceptance check**: unit test verifies the SDK client is called with exactly `{ apiKey }` when `baseUrl` is absent, and `{ apiKey, baseURL }` when `baseUrl` is present.

#### Scenario: Client construction without baseUrl

- GIVEN `config = { provider: "openai", apiKey: "sk-test" }` with no `baseUrl`
- WHEN `createOpenAIAdapter(config)` is called
- THEN the `OpenAI` constructor MUST receive exactly `{ apiKey: "sk-test" }` — `baseURL` MUST NOT be set

#### Scenario: Client construction with baseUrl

- GIVEN `config = { provider: "openai", apiKey: "sk-test", baseUrl: "https://proxy.example.com/v1" }`
- WHEN `createOpenAIAdapter(config)` is called
- THEN the `OpenAI` constructor MUST receive `{ apiKey: "sk-test", baseURL: "https://proxy.example.com/v1" }`

---

### REQ-OAI-002: responses.create delegates to SDK

`responses.create(params)` MUST call `client.responses.create(params)` passing all `ResponsesCreateParams` fields through unchanged. The adapter MUST NOT modify, default, or omit any field before forwarding. The SDK return value MUST be returned directly as `HelixResponse`.

**Acceptance check**: unit test mocks the SDK call, verifies params forwarded verbatim, and verifies the return value is the SDK response unchanged.

#### Scenario: All params forwarded verbatim

- GIVEN `params = { model: "gpt-4o", input: [...], temperature: 0.5, max_output_tokens: 100, instructions: "Be brief.", text: { format: { type: "json_object" } } }`
- WHEN `helix.responses.create(params)` is called
- THEN the underlying `client.responses.create` MUST receive the identical params object — no field added or removed

#### Scenario: SDK response returned as-is

- GIVEN the SDK resolves with a `HelixResponse`-shaped object
- WHEN `responses.create` resolves
- THEN the resolved value MUST be the SDK's return value — no field remapping by the adapter

---

### REQ-OAI-003: files.create delegates to SDK

`files.create(params)` MUST call `client.files.create(params)` forwarding `file`, `purpose`, and `expires_after` unchanged. The adapter MUST NOT set a default for `purpose`. The resolved `FileObject` MUST be the SDK's return value directly.

**Acceptance check**: unit test verifies params forwarded including absent-optional fields, return value is the SDK response.

#### Scenario: files.create with purpose

- GIVEN `params = { file: new Uint8Array([1, 2, 3]), purpose: "assistants" }`
- WHEN `helix.files.create(params)` is called on the OpenAI adapter
- THEN `client.files.create` MUST receive `{ file, purpose: "assistants" }` exactly

#### Scenario: files.create without purpose

- GIVEN `params = { file: someBlob }` with no `purpose`
- WHEN `helix.files.create(params)` is called
- THEN `client.files.create` MUST NOT inject a default `purpose` — the SDK's own default applies

---

### REQ-OAI-004: files.list and files.delete delegate to SDK

`files.list()` MUST call `client.files.list()` and return its result as `FileObject[]`. `files.delete(id)` MUST call `client.files.delete(id)` and return `{ id, deleted: true }`.

**Acceptance check**: unit test for each operation verifies the correct SDK method is called and the return value satisfies the frozen contract.

#### Scenario: files.list returns FileObject array

- GIVEN provider is OpenAI
- WHEN `helix.files.list()` is called
- THEN `client.files.list` MUST be called with no arguments
- AND the resolved value MUST be an array of `FileObject` items

#### Scenario: files.delete resolves with id and deleted flag

- GIVEN `id = "file-abc"`
- WHEN `helix.files.delete("file-abc")` is called
- THEN the promise MUST resolve with `{ id: "file-abc", deleted: true }`

---

### REQ-OAI-005: models.list delegates to SDK and normalizes to ModelInfo[]

`models.list()` MUST call `client.models.list()` and map each entry to `ModelInfo` shape (`id`, `object: "model"`, `created`, optionally `owned_by`). No entries MUST be filtered out. The adapter MUST NOT return a raw SDK page object — it MUST return a plain `ModelInfo[]`.

**Acceptance check**: unit test verifies SDK called, response mapped to `ModelInfo[]` with correct shape.

#### Scenario: models.list maps to ModelInfo[]

- GIVEN the SDK returns a models page with two entries
- WHEN `helix.models.list()` is called
- THEN the promise MUST resolve with a plain array of two `ModelInfo` items, each with `object === "model"` and a string `id`

---

### REQ-OAI-006: errors propagate raw from SDK

All SDK errors (auth failure, rate limit, network error, etc.) from any OpenAI adapter method MUST propagate to the caller unchanged. The adapter MUST NOT catch, wrap, or rethrow errors from SDK calls (except inside `test()`).

**Acceptance check**: unit test injects a thrown `APIError` from the SDK mock; verifies the caller receives the same error instance.

#### Scenario: SDK auth error propagates raw

- GIVEN the SDK throws an `APIError` with status 401
- WHEN any OpenAI adapter method is called
- THEN the error MUST propagate to the caller unchanged — no wrapping in `HelixError` or plain `Error`

---

**End of spec.**
