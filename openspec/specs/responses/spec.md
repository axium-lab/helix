# Spec: Responses

**Change**: helix-public-api-redesign
**Domain**: responses
**Status**: stable (archived 2026-04-28)

## Overview

Defines `helix.responses.create(params)`, `ResponsesCreateParams`, `HelixResponse`, input message and content part shapes, `HelixResponseFormat` (3 variants), `OutputItem` (single `OutputMessage` variant), `OutputTextPart`, and `HelixUsage`. Covers the per-provider behavior table for all option fields. Satisfies HX1, RD-1, RD-6, RD-7, PR1, PR5. In v0 of this change, errors propagate raw from the provider/SDK; structured `HelixError` is deferred to `helix-error-model`.

---

## Requirements

### REQ-RESP-001: responses.create signature

**Identifiers**: HX1, RD-1
**Priority**: MUST

`helix.responses.create(params: ResponsesCreateParams): Promise<HelixResponse>` MUST be the sole text-generation entry point. It MUST accept the full `ResponsesCreateParams` shape and resolve with `HelixResponse`. No streaming variant exists in this change.

#### Scenario: Minimal invocation typechecks

- **GIVEN** `params = { model: "gpt-4o", input: [{ role: "user", content: [{ type: "input_text", text: "hello" }] }] }`
- **WHEN** passed to `helix.responses.create(params)`
- **THEN** the call MUST typecheck with no additional fields required
- **AND** the return type MUST be `Promise<HelixResponse>`

#### Scenario: All optional fields accepted

- **GIVEN** `params` includes `instructions`, `temperature`, `max_output_tokens`, and `text.format`
- **WHEN** passed to `helix.responses.create(params)`
- **THEN** the call MUST typecheck — all optional fields MUST be accepted by the type

---

### REQ-RESP-002: ResponsesCreateParams shape

**Identifiers**: HX1, RD-7
**Priority**: MUST

`ResponsesCreateParams` MUST expose exactly:

| Field | Type | Required |
|-------|------|----------|
| `model` | `string` | MUST |
| `input` | `InputMessage[]` | MUST |
| `instructions` | `string` | OPTIONAL |
| `temperature` | `number` | OPTIONAL |
| `max_output_tokens` | `number` | OPTIONAL |
| `text` | `{ format?: HelixResponseFormat }` | OPTIONAL |

Fields `topP`, `topK`, `seed`, `frequencyPenalty`, `presencePenalty`, `stopSequences`, `strict`, and `tools` MUST NOT appear on `ResponsesCreateParams` in this change.

#### Scenario: Extra params rejected by type

- **GIVEN** a caller passes `{ model: "m", input: [], topP: 0.9 }` to `responses.create`
- **WHEN** TypeScript checks the call
- **THEN** the compiler MUST report an error — `topP` is not a valid field

---

### REQ-RESP-003: InputMessage and InputContentPart shapes

**Identifiers**: HX1, RD-8
**Priority**: MUST

`InputMessage` MUST carry `role: HelixRole` and `content: InputContentPart[]`. `HelixRole` MUST be `"user" | "assistant" | "system" | "developer"`. `InputContentPart` MUST be a discriminated union of exactly two variants keyed on `type`:
- `InputText`: `{ type: "input_text"; text: string }`
- `InputFile`: `{ type: "input_file"; file_id: string }`

`InputFileEphemeral` MUST NOT exist (RD-8 — ephemeral inline files removed).

#### Scenario: Text-only message

- **GIVEN** `content: [{ type: "input_text", text: "What is 2+2?" }]`
- **WHEN** the adapter processes the message
- **THEN** it MUST read `part.text` as the text payload and MUST NOT treat it as a file reference

#### Scenario: File-by-reference part

- **GIVEN** `content: [{ type: "input_file", file_id: "file-abc123" }]`
- **WHEN** the adapter processes the message
- **THEN** the adapter MUST attach the referenced file to the upstream request
- **AND** MUST NOT attempt to re-upload the file

#### Scenario: Ephemeral part is a type error

- **GIVEN** a caller constructs `{ type: "input_file_ephemeral", data: ..., mimeType: "..." }`
- **WHEN** TypeScript checks the assignment to `InputContentPart`
- **THEN** the compiler MUST report a type error — the variant does not exist

---

### REQ-RESP-004: HelixResponseFormat variants

**Identifiers**: HX6 (subset), RD-7
**Priority**: MUST

`HelixResponseFormat` MUST be a discriminated union keyed on `type` with exactly three variants:

| Variant | Extra fields |
|---------|--------------|
| `{ type: "text" }` | none |
| `{ type: "json_object" }` | none |
| `{ type: "json_schema"; name: string; schema: object; strict?: boolean }` | see columns |

#### Scenario: json_schema on OpenAI/Azure

- **GIVEN** `text.format = { type: "json_schema", name: "Extraction", schema: { ... } }` and provider is OpenAI or Azure
- **WHEN** the adapter maps the request
- **THEN** the adapter MUST forward the schema to the provider's native structured output field
- **AND** `output_text` in the response MUST be valid JSON when the model honors the schema

#### Scenario: json_object on Vertex (MAP)

- **GIVEN** `text.format = { type: "json_object" }` and provider is Vertex
- **WHEN** the adapter maps the request
- **THEN** the adapter MUST translate to `responseMimeType: "application/json"` in the upstream Gemini call

#### Scenario: json_schema on Custom provider (drop)

- **GIVEN** `text.format = { type: "json_schema", ... }` and provider is `custom`
- **WHEN** the adapter maps the request
- **THEN** the adapter SHOULD silently drop `text.format` and continue — raw error from endpoint propagates if the endpoint rejects the parameter

---

### REQ-RESP-005: HelixResponse shape

**Identifiers**: PR1, PR5, RD-6
**Priority**: MUST

Every `responses.create()` invocation MUST resolve to a `HelixResponse` that MUST contain:

| Field | Type |
|-------|------|
| `id` | `string` |
| `object` | `"response"` (literal) |
| `created_at` | `number` (Unix epoch) |
| `model` | `string` |
| `output` | `OutputItem[]` |
| `output_text` | `string` |
| `usage` | `HelixUsage` |

`output_text` MUST equal the concatenation of all `text` values from `OutputTextPart` items across all `OutputMessage` items in `output`. If no `OutputTextPart` items exist, `output_text` MUST be an empty string. Fields use snake_case (ADR-1).

#### Scenario: Successful text response

- **GIVEN** the provider returns a response with one `OutputMessage` containing two `OutputTextPart` items with `text: "Hello "` and `text: "world"`
- **THEN** `output_text` MUST equal `"Hello world"`
- **AND** `usage.total_tokens` MUST equal `usage.input_tokens + usage.output_tokens`

#### Scenario: Empty output

- **GIVEN** the provider returns an `OutputMessage` with an empty `content` array
- **THEN** `output_text` MUST be `""` — an empty string, not `null` or `undefined`

---

### REQ-RESP-006: OutputItem reduced to OutputMessage only

**Identifiers**: RD-6
**Priority**: MUST

`OutputItem` MUST be a type alias for `OutputMessage` only. `ReasoningOutput`, `RefusalPart`, and `FunctionCallOutput` variants MUST NOT appear on `OutputItem` in this change. `OutputMessage` MUST carry:

| Field | Type |
|-------|------|
| `type` | `"message"` (literal) |
| `id` | `string` |
| `role` | `"assistant"` (literal) |
| `content` | `OutputTextPart[]` |
| `status` | `"in_progress" \| "completed" \| "incomplete"` (optional) |

#### Scenario: Only message output expected

- **GIVEN** the provider returns function-call or refusal data in its raw response
- **WHEN** the adapter normalizes to `HelixResponse`
- **THEN** `output` MUST contain only `OutputMessage` items — other variants MUST be omitted or normalized
- **AND** `output_text` MUST reflect only text parts

---

### REQ-RESP-007: HelixUsage shape

**Identifiers**: PR5, ADR-1
**Priority**: MUST

`HelixUsage` MUST expose `input_tokens: number`, `output_tokens: number`, and `total_tokens: number`. Field names MUST use snake_case (ADR-1). `total_tokens` MUST equal `input_tokens + output_tokens`.

#### Scenario: Token sum invariant

- **GIVEN** a response where the provider reports `input_tokens: 20` and `output_tokens: 80`
- **THEN** `usage.total_tokens` MUST be `100`

---

### REQ-RESP-008: Per-provider behavior for temperature and max_output_tokens

**Identifiers**: RD-7, proposal §8
**Priority**: MUST

| Field | OpenAI | Azure | Custom | Vertex |
|-------|--------|-------|--------|--------|
| `temperature` | OK — pass through | OK | OK | MAP to Vertex param |
| `max_output_tokens` | OK | OK | OK | MAP to Vertex param |

For Vertex, the adapter MUST translate `temperature` and `max_output_tokens` to the equivalent Vertex/Gemini generation config parameters. The mapping is an implementation concern but MUST result in equivalent behavior.

#### Scenario: temperature on Vertex (MAP)

- **GIVEN** `params.temperature = 0.7` and provider is Vertex
- **WHEN** the adapter dispatches the request
- **THEN** the upstream Gemini call MUST include the equivalent temperature parameter
- **AND** `HelixResponse` MUST be returned in normalized shape regardless of provider

#### Scenario: instructions field mapping

- **GIVEN** `params.instructions = "You are a helpful assistant."` and provider is OpenAI
- **WHEN** the adapter maps the request
- **THEN** `instructions` MUST be forwarded to the provider's system instruction field

---

### REQ-RESP-009: Raw error passthrough

**Identifiers**: RD-4
**Priority**: MUST

In v0 of this change, errors propagate raw from the provider/SDK; structured `HelixError` is deferred to `helix-error-model`. If `responses.create()` fails (network error, auth error, model not found, etc.), the raw error from the provider SDK MUST propagate to the caller without wrapping.

#### Scenario: Auth failure propagates raw

- **GIVEN** provider is OpenAI and `apiKey` is invalid
- **WHEN** `responses.create(params)` is called
- **THEN** the promise MUST reject with the raw OpenAI SDK error — no `HelixError` wrapper

---

**End of spec.**
