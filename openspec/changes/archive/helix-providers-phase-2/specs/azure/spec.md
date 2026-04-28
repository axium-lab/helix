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

### REQ-AZ-004: models.list MUST throw with exact message format

`models.list()` MUST throw a plain `Error` (not a subclass, not a `HelixError`) with the following exact message:

```
helix-lib: 'models.list' not supported by provider 'azure' — Azure data-plane deployment listing was retired April 2024; ARM management plane requires credentials not present in HelixConfig.azure
```

The adapter MUST NOT attempt any HTTP call before throwing.

**Acceptance check**: unit test asserts `models.list()` throws, the error is an instance of `Error` (not a subclass), and `error.message` equals the string above exactly.

#### Scenario: models.list throws without making any HTTP call

- GIVEN provider is Azure (any valid config)
- WHEN `helix.models.list()` is called
- THEN the call MUST throw synchronously or reject with a plain `Error`
- AND `error.message` MUST equal `"helix-lib: 'models.list' not supported by provider 'azure' — Azure data-plane deployment listing was retired April 2024; ARM management plane requires credentials not present in HelixConfig.azure"`
- AND no HTTP request MUST be initiated

#### Scenario: Thrown error is a plain Error instance

- GIVEN `models.list()` throws on Azure
- WHEN the catch block inspects the error
- THEN `error instanceof Error` MUST be `true`
- AND `error.constructor` MUST be `Error` (not a subclass)

---

### REQ-AZ-005: test() permanently returns false on Azure (Phase 2)

Because `test()` is implemented as `try { await models.list(); return true } catch { return false }` (per REQ-TEST-002), and `models.list()` always throws on Azure, `test()` MUST always resolve with `false` for the Azure provider in this change. This is a documented known limitation, not a defect.

**Acceptance check**: unit test calls `helix.test()` on the Azure adapter; asserts it resolves with `false` without rejecting.

#### Scenario: test() resolves false on Azure

- GIVEN provider is Azure (any valid config)
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

**End of spec.**
