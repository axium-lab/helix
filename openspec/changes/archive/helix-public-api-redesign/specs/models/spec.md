# Spec: Models

**Change**: helix-public-api-redesign
**Domain**: models
**Status**: delta — new capability with no prior spec. Written as full spec. At archive time, lands at `openspec/specs/models/spec.md`.

## Overview

Defines `helix.models.list(): Promise<ModelInfo[]>` and the `ModelInfo` shape. Covers per-provider behavior: OpenAI and Custom use standard HTTP, Azure uses a custom HTTP path for deployments listing, Vertex uses a MAP approach to normalize the Gemini model list. Satisfies HX8, RD-1. In v0 of this change, errors propagate raw from the provider/SDK; structured `HelixError` is deferred to `helix-error-model`.

---

## Requirements

### REQ-MODELS-001: models.list signature and return type

**Identifiers**: HX8, RD-1
**Priority**: MUST

`helix.models.list(): Promise<ModelInfo[]>` MUST be the sole models enumeration entry point. It MUST resolve with an array of `ModelInfo` items. The array MAY be empty. No filtering or pagination parameters exist in this change.

#### Scenario: List returns array of ModelInfo

- **GIVEN** provider is OpenAI with valid credentials
- **WHEN** `helix.models.list()` is called
- **THEN** the promise MUST resolve with an array where every element conforms to `ModelInfo`

#### Scenario: Empty array is valid

- **GIVEN** the provider reports zero available models
- **WHEN** `helix.models.list()` is called
- **THEN** the promise MUST resolve with `[]` — not `null` or `undefined`

---

### REQ-MODELS-002: ModelInfo shape

**Identifiers**: HX8, ADR-1
**Priority**: MUST

`ModelInfo` MUST expose:

| Field | Type | Required |
|-------|------|----------|
| `id` | `string` | MUST |
| `object` | `"model"` (literal) | MUST |
| `created` | `number` (Unix epoch) | MUST |
| `owned_by` | `string` | OPTIONAL |

Field names MUST use snake_case where they are wire-shape fields (ADR-1). No additional normative fields exist in this change.

#### Scenario: ModelInfo shape conformance

- **GIVEN** a resolved `models.list()` response from OpenAI
- **WHEN** the first element is inspected
- **THEN** it MUST have `object === "model"`, a non-empty string `id`, and a numeric `created`

---

### REQ-MODELS-003: Per-provider behavior

**Identifiers**: HX8, proposal §8
**Priority**: MUST

| Provider | Behavior |
|----------|----------|
| OpenAI | OK — use standard OpenAI models endpoint |
| Azure | OK (custom HTTP) — list Azure deployments and normalize to `ModelInfo[]` |
| Custom | OK (typically) — pass through the provider's models endpoint response, normalized to `ModelInfo[]` |
| Vertex | MAP — translate Gemini model list response to `ModelInfo[]` |

Azure adapters MUST NOT use the OpenAI SDK's models list method; they MUST call Azure's deployments API and normalize results to `ModelInfo`. Vertex adapters MUST translate the Gemini model listing response to `ModelInfo` shape.

#### Scenario: Azure deployments normalized to ModelInfo

- **GIVEN** provider is `azure` with valid `endpoint` and `apiVersion`
- **WHEN** `helix.models.list()` is called
- **THEN** the promise MUST resolve with `ModelInfo[]` where each item has `id` set to the Azure deployment name
- **AND** the response MUST conform to `ModelInfo` shape — no Azure-specific fields leak to callers

#### Scenario: Vertex model list mapped to ModelInfo

- **GIVEN** provider is `vertex`
- **WHEN** `helix.models.list()` is called
- **THEN** the adapter MUST translate the Gemini model list response to `ModelInfo[]`
- **AND** each item MUST have a non-empty `id` and `object === "model"`

#### Scenario: Custom provider normalizes to ModelInfo

- **GIVEN** provider is `custom` and the endpoint returns a models list
- **WHEN** `helix.models.list()` is called
- **THEN** the response MUST be normalized to `ModelInfo[]`
- **AND** if the endpoint does not support model listing, the raw error MUST propagate

---

### REQ-MODELS-004: Raw error passthrough

**Identifiers**: RD-4
**Priority**: MUST

In v0 of this change, errors propagate raw from the provider/SDK; structured `HelixError` is deferred to `helix-error-model`. If `models.list()` fails (network, auth, unsupported endpoint), the raw provider error MUST propagate to the caller without wrapping.

#### Scenario: Auth error propagates raw

- **GIVEN** provider is OpenAI and `apiKey` is invalid
- **WHEN** `helix.models.list()` is called
- **THEN** the promise MUST reject with the raw OpenAI SDK error — no `HelixError` wrapper
