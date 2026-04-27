# Spec: Core Types

**Change**: helix-interface-definition
**Domain**: core-types
**Status**: main

## Overview

Defines the canonical request and response shapes that every adapter MUST accept and produce. Satisfies HX1 (text request), HX3 (file content parts), HX6 (generation options including structured output), PR1 (OpenAI Responses API output shape), and PR5 (normalized response contract). Also governs `HelixThinking`, the three `responseFormat` variants, and the semantics of `previousResponseId`.

---

## Requirements

### REQ-CT-001: HelixRequest shape

**Identifiers**: HX1, HX3
**Priority**: MUST

`HelixRequest` MUST expose `model` (string), `input` (non-empty array of `InputMessage`), and `options?` (`HelixRequestOptions`). `instructions?`, `tools?`, `toolChoice?`, and `previousResponseId?` are OPTIONAL fields on the same interface. No other fields at the top level are normative in Phase 1.

#### Scenario: Minimal text request

- **GIVEN** a caller constructs a `HelixRequest` with `model` and a single user `InputMessage` containing one `InputText` part
- **WHEN** the request is passed to `HelixProvider.request()`
- **THEN** the provider MUST accept it without error
- **AND** the response MUST conform to `HelixResponse`

#### Scenario: Request with all optional fields

- **GIVEN** a caller populates `instructions`, `tools`, `toolChoice`, `previousResponseId`, and `options`
- **WHEN** the request is passed to `HelixProvider.request()`
- **THEN** the provider MUST NOT reject the request solely because optional fields are present
- **AND** unsupported optional fields MUST be handled per the `strict` semantics (REQ-CT-005)

---

### REQ-CT-002: InputContentPart discriminated union

**Identifiers**: HX1, HX3
**Priority**: MUST

`InputContentPart` MUST be a discriminated union of exactly three members keyed on the `type` field: `"input_text"` (`InputText`), and `"input_file"` in two forms — `InputFile` (file-by-reference, carrying `file_id`) and `InputFileEphemeral` (inline bytes, carrying `data` + `mimeType`).

#### Scenario: Text part

- **GIVEN** an `InputMessage` whose `content` array contains an `InputText` part
- **WHEN** an adapter processes the message
- **THEN** it MUST read `part.text` as the text payload
- **AND** MUST NOT treat it as a file

#### Scenario: File-by-reference part

- **GIVEN** an `InputMessage` whose `content` contains an `InputFile` with a valid `file_id`
- **WHEN** an adapter processes the message
- **THEN** the adapter MUST attach the referenced file to the upstream request
- **AND** MUST NOT attempt to re-upload the file

#### Scenario: Ephemeral file part

- **GIVEN** an `InputMessage` whose `content` contains an `InputFileEphemeral` with `data` and `mimeType`
- **WHEN** an adapter processes the message
- **THEN** the adapter MUST upload the bytes before dispatching the request (per HX3)
- **AND** if `ttl` is `0`, the adapter MUST delete the uploaded file after the request completes

---

### REQ-CT-003: HelixResponse shape

**Identifiers**: PR1, PR5
**Priority**: MUST

Every `HelixProvider.request()` invocation MUST resolve to a `HelixResponse` that contains: `id` (string), `object: "response"`, `created_at` (Unix epoch number), `model` (string), `output` (array of `OutputItem`), `output_text` (string), and `usage` (`HelixUsage`). `metadata?` is OPTIONAL.

#### Scenario: Successful text response

- **GIVEN** the provider returns a response with at least one `OutputMessage` containing an `OutputTextPart`
- **THEN** `output_text` MUST equal the concatenation of all `output_text` parts across all `OutputMessage` items in `output`
- **AND** `usage.total_tokens` MUST equal `usage.input_tokens + usage.output_tokens`

#### Scenario: Response with function call output

- **GIVEN** the provider returns a `FunctionCallOutput` item in `output`
- **THEN** `output_text` MUST contain only the text from `OutputTextPart` items — function call items MUST NOT contribute to `output_text`
- **AND** `output_text` MAY be an empty string if no text parts exist

#### Scenario: Response with refusal

- **GIVEN** the provider returns a `RefusalPart` inside an `OutputMessage`
- **THEN** `output_text` MUST NOT include the refusal text
- **AND** the `RefusalPart` MUST be present in `output[].content` for the caller to inspect

---

### REQ-CT-004: HelixThinking discriminated union

**Identifiers**: HX6
**Priority**: MUST

`HelixThinking` MUST be a discriminated union: `{ effort: "low" | "medium" | "high" }` for OpenAI o-series, and `{ budget: number }` for Vertex thinking budget (token count). Callers MUST pass the variant that matches their target provider. Adapters encountering the wrong variant MUST apply `strict` semantics (REQ-CT-005).

#### Scenario: Effort-based thinking on OpenAI

- **GIVEN** `options.thinking` is `{ effort: "medium" }` and the provider is OpenAI (o-series model)
- **WHEN** the adapter maps the request
- **THEN** it MUST forward the effort hint to the upstream API
- **AND** the response MUST include a `ReasoningOutput` item in `output` when the model produces reasoning

#### Scenario: Budget-based thinking on Vertex

- **GIVEN** `options.thinking` is `{ budget: 2048 }` and the provider is Vertex
- **WHEN** the adapter maps the request
- **THEN** it MUST set the thinking-budget parameter in the upstream Vertex call

#### Scenario: Mismatched thinking variant (strict off)

- **GIVEN** `options.thinking` is `{ effort: "high" }` and the provider is Vertex (not o-series)
- **AND** `options.strict` is `false` or absent
- **WHEN** the adapter processes the request
- **THEN** the adapter MUST silently DROP the `thinking` option and continue

#### Scenario: Mismatched thinking variant (strict on)

- **GIVEN** `options.thinking` is `{ effort: "high" }` and the provider is Vertex
- **AND** `options.strict` is `true`
- **WHEN** the adapter processes the request
- **THEN** the adapter MUST throw a `HelixError` with `kind: "UnsupportedFeature"` before making any network call

---

### REQ-CT-005: strict flag semantics

**Identifiers**: HX6, Q9
**Priority**: MUST

`HelixRequestOptions.strict` (default: `false`) governs adapter behavior when an option is not supported by the target provider. With `strict: false`, the adapter MUST silently drop the unsupported option and continue. With `strict: true`, the adapter MUST throw a `HelixError` of `kind: "UnsupportedFeature"` immediately, before any network call is made.

#### Scenario: Unsupported topK silently dropped (strict off)

- **GIVEN** `options.topK` is set and the provider is OpenAI
- **AND** `options.strict` is absent
- **WHEN** the adapter builds the upstream request
- **THEN** it MUST omit `topK` from the upstream payload
- **AND** MUST NOT throw any error

#### Scenario: Unsupported option throws (strict on)

- **GIVEN** `options.topK` is set and the provider is OpenAI
- **AND** `options.strict` is `true`
- **WHEN** the adapter attempts to map the request
- **THEN** it MUST throw `HelixError` with `kind: "UnsupportedFeature"` and `provider: "openai"`
- **AND** no network call MUST be made

---

### REQ-CT-007: responseFormat variants

**Identifiers**: HX6
**Priority**: MUST

`HelixRequestOptions.responseFormat` MUST accept exactly three variants: `{ type: "text" }`, `{ type: "json_object" }`, and `{ type: "json_schema"; name: string; schema: object; strict?: boolean }`. Adapters MUST map each variant to the provider-native structured output mechanism or apply `strict` semantics if the provider does not support it.

#### Scenario: json_schema on supported provider

- **GIVEN** `options.responseFormat` is `{ type: "json_schema", name: "MySchema", schema: { ... } }`
- **AND** the provider is OpenAI or Azure (Responses API deployment)
- **WHEN** the adapter maps the request
- **THEN** the adapter MUST forward the schema to the provider's native structured output field
- **AND** the response `output_text` MUST be valid JSON conforming to the schema when the model honors it

#### Scenario: json_object on Vertex

- **GIVEN** `options.responseFormat` is `{ type: "json_object" }`
- **AND** the provider is Vertex
- **WHEN** the adapter maps the request
- **THEN** the adapter MUST set `responseMimeType: "application/json"` in the upstream call

#### Scenario: json_schema on custom endpoint (strict off)

- **GIVEN** `options.responseFormat` is `{ type: "json_schema", ... }`
- **AND** the provider is `custom` and the endpoint does not advertise schema support
- **AND** `options.strict` is `false`
- **WHEN** the adapter maps the request
- **THEN** the adapter MUST drop the `responseFormat` option and continue without error

---

### REQ-CT-008: previousResponseId semantics

**Identifiers**: Q2
**Priority**: MUST

`previousResponseId` is an OPTIONAL hint. Adapters that support stateful response chaining (OpenAI, Azure Responses-capable deployments) MAY use it to chain responses. All other adapters MUST silently ignore it. The `input` array is ALWAYS the authoritative conversation context.

#### Scenario: Both input and previousResponseId provided

- **GIVEN** `HelixRequest.input` contains a full conversation array
- **AND** `HelixRequest.previousResponseId` is also set
- **WHEN** the request is dispatched
- **THEN** `input` MUST be treated as the authoritative conversation
- **AND** the adapter MAY additionally pass `previousResponseId` as a chaining hint if the provider supports it

#### Scenario: previousResponseId on Vertex

- **GIVEN** `HelixRequest.previousResponseId` is set and the provider is Vertex
- **WHEN** the adapter maps the request
- **THEN** the adapter MUST silently ignore `previousResponseId` (DROP, always — no strict exception)
- **AND** the full `input` array MUST be forwarded as the conversation context

---

### REQ-CT-009: instructions and system role coexistence

**Identifiers**: HX1
**Priority**: MUST

`HelixRequest.instructions` and `InputMessage` items with `role: "system"` or `role: "developer"` MAY coexist in the same request. Adapters MUST map `instructions` to the provider-native system instruction field (e.g., OpenAI `instructions`, Vertex `systemInstruction`). If both are present, the adapter MUST include both without silently discarding either.

#### Scenario: Only instructions provided

- **GIVEN** `HelixRequest.instructions` is a non-empty string and `input` contains only `user` messages
- **WHEN** the adapter maps the request
- **THEN** `instructions` MUST be forwarded to the provider's system-level instruction field

#### Scenario: Instructions and system message both provided

- **GIVEN** `HelixRequest.instructions` is set and `input` contains a message with `role: "system"`
- **WHEN** the adapter maps the request
- **THEN** both MUST be forwarded; the adapter MUST NOT discard either

---

## Type Surface (informative)

See proposal §5.1, §5.2, and §5.4 for the full TypeScript surface of `HelixRequest`, `HelixRequestOptions`, `InputContentPart`, `HelixThinking`, `HelixResponseFormat`, `HelixResponse`, and `HelixUsage`.

---

## Open Items

1. **`output_text` when output contains only function calls**: REQ-CT-003 specifies empty string, but callers may be surprised. Recommend documenting this clearly in JSDoc on the field. No spec change needed — already captured.
2. **`instructions` + `role: "system"` precedence**: REQ-CT-009 says both MUST be forwarded, but OpenAI's Responses API may treat them differently. The adapter design phase MUST clarify the ordering/precedence rule.
