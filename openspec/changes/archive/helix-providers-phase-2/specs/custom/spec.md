# Delta for Custom Provider — helix-providers-phase-2

**Change**: helix-providers-phase-2
**Domain**: custom provider implementation
**Status**: draft

## Overview

Governs the real-HTTP implementation inside `src/internal/providers/custom.ts`. The public surface is frozen from Phase 1 v2. This delta adds implementation-level requirements for SDK construction with `baseURL` override, method-to-SDK mapping for `responses.create` and `models.list`, and the preservation of existing `files.*` throw stubs mandated by REQ-FILES-005.

---

## ADDED Requirements

### REQ-CUSTOM-001: SDK client construction with baseURL

The Custom adapter MUST construct the `OpenAI` client using `new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl })`. The `baseURL` field MUST always be set; it is required on `HelixConfig.custom`. No other constructor fields MUST be set by the adapter.

**Acceptance check**: unit test verifies the `OpenAI` constructor receives exactly `{ apiKey, baseURL }` where `baseURL` equals `config.baseUrl`.

#### Scenario: Client construction with baseUrl

- GIVEN `config = { provider: "custom", apiKey: "key-abc", baseUrl: "https://compat.example.com/v1" }`
- WHEN `createCustomAdapter(config)` is called
- THEN the `OpenAI` constructor MUST receive `{ apiKey: "key-abc", baseURL: "https://compat.example.com/v1" }`

---

### REQ-CUSTOM-002: responses.create delegates to SDK

`responses.create(params)` MUST call `client.responses.create(params)` forwarding all `ResponsesCreateParams` fields through unchanged, against the custom endpoint set via `baseURL`. Behavior is identical to REQ-OAI-002 except the endpoint is determined by `config.baseUrl`.

**Acceptance check**: unit test verifies `client.responses.create` called with params verbatim; return value is the SDK response unchanged.

#### Scenario: All params forwarded to custom endpoint

- GIVEN `params = { model: "local-model", input: [...], temperature: 0.3 }` and provider is `custom`
- WHEN `helix.responses.create(params)` is called
- THEN `client.responses.create` MUST receive the identical params — no field added, modified, or removed

---

### REQ-CUSTOM-003: models.list delegates to SDK and normalizes to ModelInfo[]

`models.list()` MUST call `client.models.list()` against the custom endpoint and map each entry to `ModelInfo` shape. Normalization follows the same rules as REQ-OAI-005. The adapter MUST return a plain `ModelInfo[]`.

**Acceptance check**: unit test verifies SDK called and response mapped to `ModelInfo[]`.

#### Scenario: models.list maps to ModelInfo[] from custom endpoint

- GIVEN the custom endpoint returns a models listing
- WHEN `helix.models.list()` is called
- THEN the promise MUST resolve with `ModelInfo[]` where every item has `object === "model"` and a string `id`

#### Scenario: Custom endpoint does not support model listing

- GIVEN the custom endpoint returns an error on the models route
- WHEN `helix.models.list()` is called
- THEN the raw SDK error MUST propagate to the caller — no wrapping (per REQ-MODELS-004)

---

### REQ-CUSTOM-004: files.* MUST preserve existing throw stubs verbatim

`files.create`, `files.list`, and `files.delete` MUST throw a plain `Error` with the message format already implemented in the current stub, satisfying REQ-FILES-005. These stubs MUST NOT be changed. Exact messages:

| Method | Message |
|--------|---------|
| `files.create` | `helix-lib: 'files.create' not supported by provider 'custom'` |
| `files.list` | `helix-lib: 'files.list' not supported by provider 'custom'` |
| `files.delete` | `helix-lib: 'files.delete' not supported by provider 'custom'` |

**Acceptance check**: unit tests for all three methods assert the throws and validate the error message matches the format above.

#### Scenario: files.create throws on custom provider

- GIVEN provider is `custom`
- WHEN `helix.files.create(params)` is called
- THEN the call MUST throw a plain `Error`
- AND `error.message` MUST be `"helix-lib: 'files.create' not supported by provider 'custom'"`

#### Scenario: files.list throws on custom provider

- GIVEN provider is `custom`
- WHEN `helix.files.list()` is called
- THEN the call MUST throw a plain `Error`
- AND `error.message` MUST be `"helix-lib: 'files.list' not supported by provider 'custom'"`

#### Scenario: files.delete throws on custom provider

- GIVEN provider is `custom`
- WHEN `helix.files.delete("file-x")` is called
- THEN the call MUST throw a plain `Error`
- AND `error.message` MUST be `"helix-lib: 'files.delete' not supported by provider 'custom'"`

---

### REQ-CUSTOM-005: errors from responses.create and models.list propagate raw

All SDK errors from `responses.create` and `models.list` MUST propagate to the caller unchanged. The adapter MUST NOT catch, wrap, or rethrow errors from SDK calls (except inside `test()`).

**Acceptance check**: unit test injects a thrown SDK error; verifies the caller receives the same error instance.

#### Scenario: SDK error propagates raw from responses.create

- GIVEN the custom endpoint returns a 403 response
- WHEN `helix.responses.create(params)` is called
- THEN the SDK error MUST reach the caller unchanged

---

**End of spec.**
