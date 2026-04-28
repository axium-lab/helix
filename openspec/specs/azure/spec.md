# Delta for Azure Provider — helix-providers-phase-2

**Change**: helix-providers-phase-2
**Domain**: azure provider implementation
**Status**: draft

## Overview

Governs the real-HTTP implementation inside `src/internal/providers/azure.ts`. The public surface is frozen from Phase 1 v2. This delta adds implementation-level requirements for SDK construction with Azure-specific fields, deployment-name-as-model semantics, the `models.list` throws contract, the resulting `test()` permanently-false behavior, and error passthrough.

Note: REQ-MODELS-003 in the frozen spec declares Azure `models.list` as "OK (custom HTTP) — list Azure deployments". That behavior was scoped under Phase 1's aspirational table. RD-PHASE2-4 (ratified) overrides the _implementation_ for this change: Azure's data-plane deployments endpoint was retired April 2024; ARM requires RBAC credentials not present in `HelixConfig.azure`. Phase 2 therefore implements the throw contract described here. REQ-MODELS-003 will be corrected when `helix-azure-config-v2` ships.

---

## ADDED Requirements

### REQ-AZ-001: SDK client construction

The Azure adapter MUST construct the `AzureOpenAI` client using `new AzureOpenAI({ apiKey: config.apiKey, endpoint: config.endpoint, apiVersion: config.apiVersion })`. No other constructor fields MUST be set by the adapter.

**Acceptance check**: unit test verifies the `AzureOpenAI` constructor receives exactly `{ apiKey, endpoint, apiVersion }`.

#### Scenario: Client construction with all required fields

- GIVEN `config = { provider: "azure", apiKey: "k", endpoint: "https://my.openai.azure.com", apiVersion: "2024-10-01-preview" }`
- WHEN `createAzureAdapter(config)` is called
- THEN `AzureOpenAI` constructor MUST receive exactly `{ apiKey: "k", endpoint: "https://my.openai.azure.com", apiVersion: "2024-10-01-preview" }`

---

### REQ-AZ-002: responses.create treats model field as deployment name

`responses.create(params)` MUST call `client.responses.create(params)` forwarding all `ResponsesCreateParams` fields unchanged. Callers pass the Azure deployment name in `params.model`; the adapter MUST NOT remap or alias this field — the SDK handles the deployment-name convention natively.

**Acceptance check**: unit test verifies `client.responses.create` receives params with `model` set to the deployment name the caller supplied, verbatim.

#### Scenario: Deployment name forwarded as model

- GIVEN `params = { model: "gpt-4o-deployment", input: [...] }`
- WHEN `helix.responses.create(params)` is called on the Azure adapter
- THEN `client.responses.create` MUST receive `model: "gpt-4o-deployment"` unchanged

---

### REQ-AZ-003: files.create, files.list, files.delete delegate to SDK

`files.create(params)`, `files.list()`, and `files.delete(id)` MUST call the corresponding `client.files.*` SDK methods and return their results. Behavior mirrors REQ-OAI-003 and REQ-OAI-004 — params forwarded unchanged, `files.delete` resolves with `{ id, deleted: true }`.

**Acceptance check**: unit test for each operation verifies the correct SDK method is called and the return value satisfies REQ-FILES-002 and REQ-FILES-004.

#### Scenario: files.create on Azure forwards params

- GIVEN `params = { file: new Uint8Array([1, 2]), purpose: "assistants" }` and provider is Azure
- WHEN `helix.files.create(params)` is called
- THEN `client.files.create` MUST receive the same params unchanged

#### Scenario: files.delete on Azure resolves with deleted flag

- GIVEN `id = "file-xyz"` and provider is Azure
- WHEN `helix.files.delete("file-xyz")` is called
- THEN the promise MUST resolve with `{ id: "file-xyz", deleted: true }`

---

### REQ-AZ-004: models.list MUST return a sorted ModelInfo[] or throw a discriminated error

**Supersedes**: Phase 2 REQ-AZ-004 (throw-stub contract). The premise that the Azure data-plane
deployments endpoint was "retired April 2024" was incorrect. The endpoint is live and accepts
`api-key` header auth. Replaced by `helix-azure-list-models` (2026-04-28).

`models.list()` MUST issue an HTTP GET request to the Azure data-plane deployments endpoint and
resolve with a `ModelInfo[]` on success, or throw an internal discriminated error on failure.
The throw-stub behavior from Phase 2 is removed. See REQ-AZ-LM-1 through REQ-AZ-LM-7 for the
full behavioral contract.

**Acceptance check**: unit test asserts `models.list()` resolves with a sorted `ModelInfo[]` on a
mocked 200 response; error-branch tests assert the correct discriminated error kind.

#### Scenario: models.list resolves with sorted ModelInfo[] on success

- GIVEN a valid Azure config and fetch returns HTTP 200 with deployment data
- WHEN `helix.models.list()` is called
- THEN the promise MUST resolve with a `ModelInfo[]` sorted ascending by `id`
- AND no plain `Error` with the "retired" message MUST be thrown

#### Scenario: models.list throws discriminated error on HTTP failure

- GIVEN a valid Azure config and fetch returns a non-OK HTTP response
- WHEN `helix.models.list()` is called
- THEN the call MUST throw (or reject) with an internal discriminated error having a `kind` field
- AND `kind` MUST be one of `"auth" | "config" | "upstream" | "network"`

---

### REQ-AZ-005: test() resolves true on valid credentials, false on any failure

**Supersedes**: Phase 2 REQ-AZ-005 (permanently-false contract). Phase 2's limitation that
`test()` permanently returned `false` is closed by `helix-azure-list-models` (2026-04-28).

`test()` reflects the outcome of `models.list()`. Because `models.list()` now makes a real HTTP
call, `test()` resolves `true` when the call succeeds and resolves `false` when it throws for any
reason (including any error kind). `test()` MUST NOT propagate or reject.

**Acceptance check**: unit test mocks `models.list()` to resolve/throw and asserts `test()` returns
the corresponding boolean.

#### Scenario: test() resolves true when models.list succeeds

- GIVEN provider is Azure and `models.list()` resolves with a valid `ModelInfo[]`
- WHEN `helix.test()` is called
- THEN the promise MUST resolve with `true`
- AND the promise MUST NOT reject

#### Scenario: test() resolves false when models.list throws (auth error)

- GIVEN provider is Azure and `models.list()` throws an internal error with `kind: "auth"`
- WHEN `helix.test()` is called
- THEN the promise MUST resolve with `false`
- AND the promise MUST NOT reject

#### Scenario: test() resolves false when models.list throws (network error)

- GIVEN provider is Azure and `models.list()` throws an internal error with `kind: "network"`
- WHEN `helix.test()` is called
- THEN the promise MUST resolve with `false`
- AND the promise MUST NOT reject

---

### REQ-AZ-006: errors from files and responses operations propagate raw

All SDK errors from `files.*` and `responses.create` MUST propagate to the caller unchanged. The adapter MUST NOT catch, wrap, or rethrow.

**Acceptance check**: unit test injects a thrown SDK error; verifies the caller receives the same error instance.

#### Scenario: SDK error from responses.create propagates raw

- GIVEN the Azure SDK throws a status-401 error during `responses.create`
- WHEN `helix.responses.create(params)` is called
- THEN the error MUST reach the caller unchanged — no wrapping

---

## Azure models.list — Behavioral Requirements (helix-azure-list-models, 2026-04-28)

The following requirements were added by the `helix-azure-list-models` change. They define the
full HTTP behavioral contract for `models.list()` on the Azure adapter.

---

### REQ-AZ-LM-1: Endpoint construction and authentication header

`models.list()` MUST issue an HTTP GET request to:
```
${endpoint.replace(/\/$/, "")}/openai/deployments?api-version=${AZURE_DEPLOYMENTS_API_VERSION}
```
where `AZURE_DEPLOYMENTS_API_VERSION` is an internal module-private constant pinned to
`"2023-03-15-preview"` (see ADR-AZ-LM-12). Note: the URL deliberately does **not** use
`config.apiVersion` — newer api-versions return HTTP 404 on this endpoint. The request MUST use
header `api-key: ${apiKey}`. The `Authorization: Bearer` header MUST NOT be used — Azure
data-plane convention requires `api-key`.

**Acceptance check**: unit test verifies `fetch` is called with the correct URL (including
trailing-slash normalization and the hardcoded api-version) and exactly the `api-key` header.

#### Scenario: Trailing slash on endpoint is normalized

- GIVEN `config.endpoint = "https://my.openai.azure.com/"` (and `config.apiVersion` is irrelevant for this URL — see ADR-AZ-LM-12)
- WHEN `helix.models.list()` is called
- THEN `fetch` MUST be called with URL `"https://my.openai.azure.com/openai/deployments?api-version=2023-03-15-preview"`

#### Scenario: No trailing slash on endpoint is preserved

- GIVEN `config.endpoint = "https://my.openai.azure.com"`
- WHEN `helix.models.list()` is called
- THEN `fetch` MUST be called with URL `"https://my.openai.azure.com/openai/deployments?api-version=2023-03-15-preview"`

#### Scenario: api-key header is used, not Authorization

- GIVEN a valid Azure config
- WHEN `helix.models.list()` is called
- THEN the `fetch` request headers MUST contain `"api-key": config.apiKey`
- AND the headers MUST NOT contain an `Authorization` key

---

### REQ-AZ-LM-2: Successful response normalized to sorted ModelInfo[]

On HTTP 200, `models.list()` MUST resolve with a `ModelInfo[]` where:
- each entry maps one deployment from `response.data` (the `data` array inside the JSON body)
- `id` is the deployment's `id` field
- `object` is `"model"` (constant)
- `created` is `0` (sentinel — Azure deployments have no epoch field)
- `owned_by` is `"azure"` (constant — deployments are tenant-owned, no per-deployment owner)
- the array is sorted ascending by `id` using `localeCompare`

**Acceptance check**: unit test provides a 200 response with an unordered `data` array and asserts
the resolved value is sorted with the correct field values.

#### Scenario: Happy path — deployments mapped and sorted

- GIVEN fetch returns HTTP 200 with body `{ "data": [{ "id": "gpt-4o" }, { "id": "gpt-35-turbo" }] }`
- WHEN `helix.models.list()` is called
- THEN the promise MUST resolve with `[{ id: "gpt-35-turbo", object: "model", created: 0, owned_by: "azure" }, { id: "gpt-4o", object: "model", created: 0, owned_by: "azure" }]`

#### Scenario: Empty data array returns empty list

- GIVEN fetch returns HTTP 200 with body `{ "data": [] }`
- WHEN `helix.models.list()` is called
- THEN the promise MUST resolve with `[]`

#### Scenario: Deployments without created field use sentinel 0

- GIVEN fetch returns HTTP 200 with a deployment object that has no `created` property
- WHEN `helix.models.list()` is called
- THEN each resulting `ModelInfo` entry MUST have `created === 0`

---

### REQ-AZ-LM-3: HTTP 401 maps to internal error with kind "auth"

On HTTP 401, `models.list()` MUST throw an internal discriminated error with `kind: "auth"` and a
message that identifies Azure deployment listing as the failing operation.

The error shape is **internal only** — NOT exported from `src/index.ts`, NOT named `HelixError`.
The `kind` field is the stable discriminator.

**Acceptance check**: unit test provides a 401 response and asserts the thrown error has
`kind === "auth"`.

#### Scenario: 401 throws error with kind "auth"

- GIVEN fetch returns HTTP 401
- WHEN `helix.models.list()` is called
- THEN the call MUST throw (or reject) with an error object where `kind === "auth"`

---

### REQ-AZ-LM-4: HTTP 404 maps to internal error with kind "config"

On HTTP 404, `models.list()` MUST throw an internal discriminated error with `kind: "config"` and
a message referencing `AZURE_DEPLOYMENTS_API_VERSION` as the likely cause (the hardcoded listing
api-version may have been retired by Microsoft).

**Acceptance check**: unit test provides a 404 response and asserts `kind === "config"`.

#### Scenario: 404 throws error with kind "config"

- GIVEN fetch returns HTTP 404
- WHEN `helix.models.list()` is called
- THEN the call MUST throw (or reject) with an error object where `kind === "config"`

---

### REQ-AZ-LM-5: Any other non-OK HTTP status maps to internal error with kind "upstream"

On any non-OK HTTP status that is not 401 or 404, `models.list()` MUST throw an internal
discriminated error with `kind: "upstream"`. The error MUST include the numeric HTTP status code
in its message. This covers 5xx, 429, and any other unexpected codes.

**Acceptance check**: unit test provides 500, 502, 429 responses and asserts `kind === "upstream"`
in each case.

#### Scenario: 500 throws error with kind "upstream"

- GIVEN fetch returns HTTP 500
- WHEN `helix.models.list()` is called
- THEN the call MUST throw (or reject) with `kind === "upstream"`
- AND the error message MUST contain `"500"`

#### Scenario: 429 throws error with kind "upstream"

- GIVEN fetch returns HTTP 429
- WHEN `helix.models.list()` is called
- THEN the call MUST throw (or reject) with `kind === "upstream"`

---

### REQ-AZ-LM-6: Network failure maps to internal error with kind "network"

When `fetch` itself throws (DNS failure, connection refused, TLS error, abort), `models.list()`
MUST throw an internal discriminated error with `kind: "network"`. The `cause` property of the
thrown error MUST reference the original thrown value from `fetch`.

**Acceptance check**: unit test makes `fetch` reject with a `TypeError` and asserts
`kind === "network"` and `cause` is the original `TypeError`.

#### Scenario: fetch rejection throws error with kind "network" and cause

- GIVEN `fetch` rejects with `new TypeError("Failed to fetch")`
- WHEN `helix.models.list()` is called
- THEN the call MUST throw (or reject) with `kind === "network"`
- AND `error.cause` MUST be the original `TypeError`

---

### REQ-AZ-LM-7: No filter applied — all deployments returned

`models.list()` MUST NOT filter any deployment based on deployment name, model type, or any other
criterion. Every entry present in `response.data` MUST appear in the resolved `ModelInfo[]`.
Helix-lib is provider-agnostic; consumers apply their own filters.

**Acceptance check**: unit test provides a 200 response that includes non-chat deployments (e.g.,
embedding, whisper, dall-e names) and asserts all appear in the result.

#### Scenario: Non-chat deployments are not filtered

- GIVEN fetch returns HTTP 200 with `{ "data": [{ "id": "text-embedding-ada-002" }, { "id": "whisper-1" }, { "id": "gpt-4o" }] }`
- WHEN `helix.models.list()` is called
- THEN the resolved array MUST contain entries for `"text-embedding-ada-002"`, `"whisper-1"`, and `"gpt-4o"`

---

### REQ-AZ-LM-8: models.list uses native fetch — no new dependency

`models.list()` MUST use the global `fetch` API (Node ≥22 built-in). NO new package MUST be added
to `dependencies` or `devDependencies` in `package.json`.

**Acceptance check**: `package.json` after apply contains the same `dependencies` set as before.

#### Scenario: No new dependency after apply

- GIVEN `package.json` before this change
- WHEN the change is applied
- THEN `package.json` `dependencies` MUST be identical to the pre-change state

---

### REQ-AZ-LM-9: Lines outside models.list are not modified in this change

Only the `models: { list() { ... } }` block MUST change. The `files.create` cast (owned by
parallel SDD `helix-files-params-tightening`) MUST NOT be modified in this change.

**Acceptance check**: regression lock test reads `src/internal/providers/azure.ts` source and
asserts the `as Parameters<typeof client.files.create>[0]` literal is still present.

#### Scenario: files.create lines are unchanged after apply

- GIVEN the `files.create` method body in `src/internal/providers/azure.ts` before this change
- WHEN the change is applied
- THEN `git diff` MUST NOT show any changed lines in the `files.create` block

---

**End of spec.**
