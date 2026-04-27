# Spec: Factories

**Change**: helix-interface-definition
**Domain**: factories
**Status**: main

## Overview

Defines the four provider factory function signatures and their configuration shapes. Covers `createOpenAI()`, `createAzureOpenAI()`, `createOpenAICompatible()`, and `createVertex()`, along with `OpenAIConfig`, `AzureOpenAIConfig`, `OpenAICompatibleConfig`, `VertexConfig`, and `VertexCredentials`. Governs the required vs optional fields per provider, `apiVersion` pinning (Q10), and Vertex ADC vs explicit credentials (Q8). Satisfies PR4 (Phase 1 provider compatibility) and the instance-based factory pattern (Q3).

---

## Requirements

### REQ-FAC-001: createOpenAI() signature and config

**Identifiers**: PR4, Q3
**Priority**: MUST

`createOpenAI(config: OpenAIConfig): HelixClient` MUST be the exported function. `OpenAIConfig` MUST require `apiKey: string`. `baseUrl?`, `organization?`, `project?`, and `defaultHeaders?` are OPTIONAL. The returned `HelixClient` MUST have `provider` set and `files` set (not `undefined`).

#### Scenario: Minimal config

- **GIVEN** `createOpenAI({ apiKey: "sk-..." })` is called
- **THEN** it MUST return a `HelixClient` without throwing
- **AND** `client.files` MUST be a `HelixFileStore` instance
- **AND** `client.provider.capabilities().provider` MUST be `"openai"`

#### Scenario: Config without apiKey fails at type level

- **GIVEN** `createOpenAI({})` is called (no `apiKey`)
- **THEN** TypeScript MUST produce a compile-time error (required field missing)

#### Scenario: Custom baseUrl accepted

- **GIVEN** `createOpenAI({ apiKey: "sk-...", baseUrl: "https://my-proxy.example.com" })`
- **THEN** the factory MUST return a valid `HelixClient` without throwing
- **AND** subsequent `request()` calls MUST route to the provided `baseUrl`

---

### REQ-FAC-002: createAzureOpenAI() signature and config

**Identifiers**: PR4, Q3, Q10
**Priority**: MUST

`createAzureOpenAI(config: AzureOpenAIConfig): HelixClient` MUST be the exported function. `AzureOpenAIConfig` MUST require `apiKey: string`, `endpoint: string`, and `apiVersion: string`. `defaultHeaders?` is OPTIONAL. There is NO `deployment` field in `AzureOpenAIConfig` — callers pass the deployment name as `HelixRequest.model` (see REQ-FAC-007). The returned `HelixClient` MUST have `files` set. `apiVersion` MUST be a non-empty string — the factory MUST throw a `HelixError` with `kind: "InvalidRequest"` at construction time if `apiVersion` is empty or absent at runtime (guard against misconfiguration).

#### Scenario: Valid Azure config

- **GIVEN** `createAzureOpenAI({ apiKey: "...", endpoint: "https://my.openai.azure.com", apiVersion: "2024-10-01-preview" })`
- **THEN** it MUST return a `HelixClient` without throwing
- **AND** `client.provider.capabilities().provider` MUST be `"azure"`

#### Scenario: Missing apiVersion is a compile-time error

- **GIVEN** `createAzureOpenAI({ apiKey: "...", endpoint: "..." })` (missing `apiVersion`)
- **THEN** TypeScript MUST produce a compile-time error

#### Scenario: Empty apiVersion throws at runtime

- **GIVEN** `createAzureOpenAI({ apiKey: "...", endpoint: "...", apiVersion: "" })`
- **WHEN** the factory executes
- **THEN** it MUST throw `HelixError` with `kind: "InvalidRequest"` and a message indicating `apiVersion` is required

---

### REQ-FAC-003: createOpenAICompatible() signature and config

**Identifiers**: PR4, Q3, Q7
**Priority**: MUST

`createOpenAICompatible(config: OpenAICompatibleConfig): HelixClient` MUST be the exported function. `OpenAICompatibleConfig` MUST require `apiKey: string` and `baseUrl: string`. `defaultHeaders?` is OPTIONAL. The returned `HelixClient` MUST have `files: undefined` (no `HelixFileStore`). No model-name aliasing is provided — callers pass model identifiers directly.

#### Scenario: Valid custom config

- **GIVEN** `createOpenAICompatible({ apiKey: "...", baseUrl: "https://api.together.xyz/v1" })`
- **THEN** it MUST return a `HelixClient` without throwing
- **AND** `client.files` MUST be `undefined`
- **AND** `client.provider.capabilities().provider` MUST be `"custom"`

#### Scenario: Missing baseUrl is a compile-time error

- **GIVEN** `createOpenAICompatible({ apiKey: "..." })` (missing `baseUrl`)
- **THEN** TypeScript MUST produce a compile-time error

#### Scenario: defaultHeaders forwarded

- **GIVEN** `createOpenAICompatible({ apiKey: "...", baseUrl: "...", defaultHeaders: { "X-Custom-Auth": "token" } })`
- **WHEN** a request is dispatched
- **THEN** the adapter MUST include `X-Custom-Auth: token` in every upstream HTTP request

---

### REQ-FAC-004: createVertex() signature and config

**Identifiers**: PR4, Q3, Q8, Q10
**Priority**: MUST

`createVertex(config: VertexConfig): HelixClient` MUST be the exported function. `VertexConfig` MUST require `projectId: string` and `location: string`. `credentials?: VertexCredentials`, `apiVersion?: string` are OPTIONAL. When `credentials` is absent, the adapter MUST use Application Default Credentials (ADC). The returned `HelixClient` MUST have `files: undefined`. `apiVersion` SHOULD default to `"v1"` when omitted.

#### Scenario: ADC-based config (minimal)

- **GIVEN** `createVertex({ projectId: "my-gcp-project", location: "us-central1" })`
- **THEN** it MUST return a `HelixClient` without throwing
- **AND** `client.files` MUST be `undefined`
- **AND** `client.provider.capabilities().provider` MUST be `"vertex"`

#### Scenario: Explicit service account credentials

- **GIVEN** `createVertex({ projectId: "...", location: "...", credentials: { clientEmail: "sa@...", privateKey: "-----BEGIN..." } })`
- **THEN** the factory MUST return a valid `HelixClient`
- **AND** the adapter MUST use the provided credentials, NOT ADC

#### Scenario: keyFile credential path

- **GIVEN** `createVertex({ projectId: "...", location: "...", credentials: { keyFile: "/path/to/key.json" } })`
- **THEN** the factory MUST return a valid `HelixClient`
- **AND** the adapter MUST load credentials from the specified file path

#### Scenario: ADC unavailable surfaces as HelixError

- **GIVEN** ADC is not configured in the runtime environment (no `GOOGLE_APPLICATION_CREDENTIALS`, no gcloud login, not on GCP)
- **AND** `credentials` is absent from `VertexConfig`
- **WHEN** `provider.request()` is first called
- **THEN** the adapter MUST reject with `HelixError` with `kind: "InvalidApiKey"` and a message indicating ADC is not configured

---

### REQ-FAC-005: Factory returns HelixClient (instance-based, no global state)

**Identifiers**: Q3
**Priority**: MUST

Each factory call MUST return a FRESH `HelixClient` instance. Multiple calls with different configs MUST return independent clients. No global registry, singleton pattern, or `Helix.use()` mechanism is defined. Two clients configured with different API keys MUST operate independently without cross-contamination.

#### Scenario: Two independent OpenAI clients

- **GIVEN** `const a = createOpenAI({ apiKey: "key-a" })` and `const b = createOpenAI({ apiKey: "key-b" })`
- **THEN** `a` and `b` MUST be distinct object instances
- **AND** requests via `a.provider` MUST use `key-a`, requests via `b.provider` MUST use `key-b`

#### Scenario: No global state between clients

- **GIVEN** client `a` is garbage-collected
- **THEN** client `b` MUST continue operating normally

---

### REQ-FAC-007: Azure deployment name via HelixRequest.model

**Identifiers**: PR4, Q3
**Priority**: MUST

For the Azure adapter, `HelixRequest.model` MUST be interpreted as the **Azure deployment name**. The `openai` SDK's `AzureOpenAI` class constructed without a `deployment` parameter uses the `model` field of each individual request as the deployment name — the Azure adapter MUST follow this convention. For all other providers (OpenAI, custom, Vertex), `HelixRequest.model` is the model identifier passed directly to the upstream API.

#### Scenario: Azure deployment name from request.model

- **GIVEN** `createAzureOpenAI({ apiKey: "...", endpoint: "https://my.openai.azure.com", apiVersion: "2024-10-01-preview" })`
- **AND** `provider.request({ model: "my-gpt4o-deployment", input: [...] })` is called
- **THEN** the adapter MUST route the request to the `my-gpt4o-deployment` deployment
- **AND** MUST NOT require a separate `deployment` field in the factory config

---

### REQ-FAC-006: strict flag availability at request time

**Identifiers**: Q9
**Priority**: MUST

The `strict` flag is part of `HelixRequestOptions`, not the factory config. Callers set `strict: true` on individual requests, not at construction time. Factory config shapes MUST NOT include a `strict` field.

#### Scenario: strict on individual request

- **GIVEN** a `HelixClient` created with `createOpenAI({ apiKey: "..." })`
- **WHEN** `client.provider.request({ ..., options: { strict: true, topK: 5 } })` is called
- **THEN** the adapter MUST throw `HelixError` with `kind: "UnsupportedFeature"` (topK unsupported on OpenAI, strict is true)

---

## Type Surface (informative)

See proposal §5.9 for the full TypeScript declarations of `OpenAIConfig`, `AzureOpenAIConfig`, `OpenAICompatibleConfig`, `VertexConfig`, `VertexCredentials`, and all four factory function signatures.

---

## Open Items

1. **Azure deployment name convention**: `AzureOpenAIConfig` has no `deployment` field — callers always pass the deployment name as `HelixRequest.model` (REQ-FAC-007). This matches the `openai` SDK's `AzureOpenAI` behavior. The apply phase MUST confirm the SDK is constructed without a `deployment` parameter.
2. **`VertexConfig.apiVersion` default**: REQ-FAC-004 says SHOULD default to `"v1"`. The apply phase MUST pin the actual string constant and document what happens if Google releases a `v2` API.
3. **Vertex ADC error timing**: REQ-FAC-004 says the error surfaces at first `request()` call. If ADC can be validated eagerly at factory construction, a faster-fail UX is possible. This is a design-phase decision — the spec is agnostic about when validation happens as long as the `HelixError` is eventually thrown with the correct kind.
4. **`createOpenAICompatible()` and file uploads**: The `HelixClient` returned has no `files`. If a caller builds an `InputFileEphemeral` part and the adapter cannot upload, the adapter MUST throw `HelixError` with `kind: "UnsupportedFeature"`. Confirm in design that this is the correct path (vs rejecting at request-evaluation time).
