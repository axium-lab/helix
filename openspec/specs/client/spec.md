# Spec: Client

**Change**: helix-public-api-redesign
**Domain**: client
**Status**: stable (archived 2026-04-28)

## Overview

Defines the `createHelix(config)` factory contract, the `HelixConfig` discriminated union (4 provider variants), `HelixProviderKind`, the `Helix` interface namespace shape, and `VertexCredentials`. Satisfies RD-1, RD-2, RD-10, ADR-5 (revised), and ADR-10. In v0 of this change, errors propagate raw from the provider/SDK; structured `HelixError` is deferred to `helix-error-model`.

---

## Requirements

### REQ-CLIENT-001: Single unified factory

**Identifiers**: RD-2, ADR-5 (revised)
**Priority**: MUST

`createHelix(config: HelixConfig): Helix` MUST be the sole public factory exported from `src/index.ts`. The four per-provider factories (`createOpenAI`, `createAzureOpenAI`, `createOpenAICompatible`, `createVertex`) MUST NOT appear on the public surface.

#### Scenario: Minimal OpenAI config

- **GIVEN** a caller imports `createHelix` from `helix-lib`
- **WHEN** they call `createHelix({ provider: "openai", apiKey: "sk-..." })`
- **THEN** the call MUST typecheck without additional type annotations
- **AND** the return value MUST satisfy the `Helix` interface

#### Scenario: Unknown provider discriminant rejected

- **GIVEN** a caller passes `{ provider: "unknown", apiKey: "x" }` to `createHelix`
- **WHEN** TypeScript checks the call
- **THEN** the compiler MUST report a type error — `"unknown"` is not assignable to `HelixProviderKind`

---

### REQ-CLIENT-002: HelixConfig discriminated union

**Identifiers**: RD-2, RD-10
**Priority**: MUST

`HelixConfig` MUST be a discriminated union keyed on the literal field `provider`, with exactly four variants:

| Variant | Required fields | Optional fields |
|---------|-----------------|-----------------|
| `"openai"` | `apiKey: string` | `baseUrl?: string` |
| `"azure"` | `apiKey: string`, `endpoint: string`, `apiVersion: string` | — |
| `"custom"` | `apiKey: string`, `baseUrl: string` | — |
| `"vertex"` | `projectId: string`, `location: string` | `credentials?: VertexCredentials` |

No other top-level fields are normative. YAGNI fields (`defaultHeaders`, `organization`, `project`) MUST NOT appear.

#### Scenario: Azure config requires all three fields

- **GIVEN** a caller passes `{ provider: "azure", apiKey: "k" }` omitting `endpoint` and `apiVersion`
- **WHEN** TypeScript checks the call
- **THEN** the compiler MUST report a type error for the missing required fields

#### Scenario: Vertex config without credentials

- **GIVEN** a caller passes `{ provider: "vertex", projectId: "p", location: "us-central1" }`
- **WHEN** the call is evaluated
- **THEN** it MUST typecheck — `credentials` is optional
- **AND** `createHelix` MUST return a valid `Helix` instance

---

### REQ-CLIENT-003: HelixProviderKind string union

**Identifiers**: RD-2
**Priority**: MUST

`HelixProviderKind` MUST be the string union `"openai" | "azure" | "custom" | "vertex"`. It MUST be exported from `src/index.ts` as a type. It MUST equal the union of all `provider` discriminant values in `HelixConfig`.

#### Scenario: Type assignability

- **GIVEN** a variable typed as `HelixProviderKind`
- **WHEN** assigned `"openai"`, `"azure"`, `"custom"`, or `"vertex"`
- **THEN** each assignment MUST typecheck without error

---

### REQ-CLIENT-004: Helix interface namespace shape

**Identifiers**: RD-1, RD-3
**Priority**: MUST

The `Helix` interface MUST expose exactly four namespaces/methods at the top level:

| Member | Type |
|--------|------|
| `responses.create(params: ResponsesCreateParams)` | `Promise<HelixResponse>` |
| `files.create(params: FilesCreateParams)` | `Promise<FileObject>` |
| `files.list()` | `Promise<FileObject[]>` |
| `files.delete(id: string)` | `Promise<{ id: string; deleted: true }>` |
| `models.list()` | `Promise<ModelInfo[]>` |
| `test()` | `Promise<boolean>` |

No additional public members MUST appear on the `Helix` interface in this change. `src/internal/` contents MUST NOT be exported from `src/index.ts`.

#### Scenario: Full namespace usage typechecks

- **GIVEN** a value `helix` of type `Helix`
- **WHEN** a caller references `helix.responses`, `helix.files`, `helix.models`, and `helix.test`
- **THEN** all four MUST typecheck per the table above without any cast

#### Scenario: Internal types not accessible

- **GIVEN** a consumer imports from `"helix-lib"`
- **WHEN** they attempt to reference anything from `src/internal/`
- **THEN** no such export MUST exist on the public surface

---

### REQ-CLIENT-005: VertexCredentials discriminated union

**Identifiers**: RD-10, ADR-10
**Priority**: MUST

`VertexCredentials` MUST be a discriminated union of exactly two variants:
- `{ clientEmail: string; privateKey: string }` — inline service-account credentials
- `{ keyFile: string }` — path to a service-account JSON key file

It MUST be exported from `src/index.ts`. It MUST NOT import from the `@google-cloud/vertexai` SDK (ADR-10).

#### Scenario: Inline credentials

- **GIVEN** `credentials: { clientEmail: "sa@proj.iam.gserviceaccount.com", privateKey: "-----BEGIN..." }`
- **WHEN** passed inside a `HelixConfig` with `provider: "vertex"`
- **THEN** the assignment MUST typecheck as `VertexCredentials`

#### Scenario: Key-file credentials

- **GIVEN** `credentials: { keyFile: "/secrets/sa.json" }`
- **WHEN** passed inside a `HelixConfig` with `provider: "vertex"`
- **THEN** the assignment MUST typecheck
- **AND** the factory MUST accept it without error

---

### REQ-CLIENT-006: No HelixError, no capability runtime

**Identifiers**: RD-4, RD-9
**Priority**: MUST

In v0 of this change, errors propagate raw from the provider/SDK. `HelixError`, `HelixErrorKind`, and `HelixErrorInit` MUST NOT appear on the public surface. `ProviderCapabilities` and any `capabilities()` method MUST NOT exist on the `Helix` interface.

#### Scenario: Error raw propagation from factory

- **GIVEN** `createHelix` is called with a syntactically valid but logically incorrect config (e.g., wrong `apiKey` format caught at runtime)
- **WHEN** a subsequent `helix.responses.create(...)` call fails due to auth
- **THEN** the raw error from the provider SDK MUST propagate to the caller — no wrapping in `HelixError`

---

**End of spec.**
