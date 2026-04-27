# Spec: Tools

**Change**: helix-interface-definition
**Domain**: tools
**Status**: main

## Overview

Defines the tool-related types that callers use to pass tool definitions to `HelixProvider.request()`. Covers `NativeTool` and the `NativeToolName` allow-list (HX4), `FunctionTool` shape (HX5), the `ToolChoice` discriminated union, and the provider × tool support contract as encoded in the capability matrix (proposal §6). Also specifies the Vertex `args: object` → `arguments: string` normalization obligation (PR1).

---

## Requirements

### REQ-TOOL-001: NativeTool shape and NativeToolName allow-list

**Identifiers**: HX4
**Priority**: MUST

`NativeTool` MUST be an interface with `type: "native"`, `name: NativeToolName`, and an OPTIONAL `config?: Record<string, unknown>` for provider-passthrough configuration. `NativeToolName` MUST be a string literal union of exactly: `"web_search"`, `"file_search"`, `"code_interpreter"`, `"google_search"`. No other values are valid in Phase 1. Type-checking MUST reject unknown names at compile time.

#### Scenario: Known native tool passes type check

- **GIVEN** a `NativeTool` is constructed with `name: "web_search"`
- **THEN** TypeScript MUST compile without error

#### Scenario: Unknown native tool name rejected at compile time

- **GIVEN** a `NativeTool` is constructed with `name: "dalle_image_gen"` (not in allow-list)
- **THEN** TypeScript MUST produce a compile-time type error

#### Scenario: config passthrough

- **GIVEN** a `NativeTool` includes `config: { maxResults: 5 }`
- **WHEN** the adapter maps the tool to the provider
- **THEN** the adapter MUST forward the `config` object to the provider's native tool configuration field

---

### REQ-TOOL-002: Native tool provider support — UnsupportedFeature paths

**Identifiers**: HX4
**Priority**: MUST

Each adapter MUST enforce the native tool support matrix. When a caller requests a native tool that the provider does not support, the adapter MUST apply `strict` semantics per REQ-CT-005.

| NativeToolName | OpenAI | Azure | Custom | Vertex |
|---|---|---|---|---|
| `web_search` | MUST honor | UnsupportedFeature (always) | UnsupportedFeature (always) | UnsupportedFeature (always) |
| `google_search` | UnsupportedFeature (always) | UnsupportedFeature (always) | UnsupportedFeature (always) | MUST honor (MAP to `googleSearch` grounding) |
| `file_search` | MUST honor | MUST honor | UnsupportedFeature (always) | UnsupportedFeature (always) |
| `code_interpreter` | MUST honor | MUST honor | UnsupportedFeature (always) | UnsupportedFeature (always) |

Note: `web_search` on Azure and `google_search` on non-Vertex providers MUST ALWAYS throw `UnsupportedFeature` regardless of `strict` flag — the capability simply does not exist.

#### Scenario: web_search on OpenAI succeeds

- **GIVEN** the provider is OpenAI and `tools` includes `{ type: "native", name: "web_search" }`
- **WHEN** the adapter maps the request
- **THEN** the adapter MUST include the web_search tool in the upstream request payload

#### Scenario: web_search on Azure throws unconditionally

- **GIVEN** the provider is Azure and `tools` includes `{ type: "native", name: "web_search" }`
- **WHEN** the adapter evaluates the request
- **THEN** it MUST throw `HelixError` with `kind: "UnsupportedFeature"` and `provider: "azure"` regardless of `strict` setting

#### Scenario: google_search on Vertex maps to grounding

- **GIVEN** the provider is Vertex and `tools` includes `{ type: "native", name: "google_search" }`
- **WHEN** the adapter maps the request
- **THEN** the adapter MUST activate Vertex `googleSearch` grounding in the upstream call

#### Scenario: google_search on OpenAI throws unconditionally

- **GIVEN** the provider is OpenAI and `tools` includes `{ type: "native", name: "google_search" }`
- **WHEN** the adapter evaluates the request
- **THEN** it MUST throw `HelixError` with `kind: "UnsupportedFeature"` regardless of `strict` setting

---

### REQ-TOOL-003: FunctionTool shape

**Identifiers**: HX5
**Priority**: MUST

`FunctionTool` MUST be an interface with `type: "function"` and a nested `function` object containing: `name: string` (REQUIRED), `description?: string`, `parameters: object` (JSON Schema), and `strict?: boolean`. The `strict` field on `FunctionTool.function` is the schema-level strict flag (maps to provider-native schema validation strictness) — it is DISTINCT from `HelixRequestOptions.strict`.

#### Scenario: Function tool definition accepted

- **GIVEN** a `FunctionTool` with a valid `name`, `parameters` schema, and no `description`
- **WHEN** the request is dispatched
- **THEN** the adapter MUST forward the tool definition to the provider
- **AND** the response MUST include a `FunctionCallOutput` item in `output` when the model decides to call it

#### Scenario: function.strict forwarded when provider supports it

- **GIVEN** `FunctionTool.function.strict` is `true` and the provider is OpenAI
- **WHEN** the adapter maps the tool
- **THEN** it MUST forward `strict: true` to the OpenAI function definition

---

### REQ-TOOL-004: FunctionCallOutput arguments normalization

**Identifiers**: HX5, PR1
**Priority**: MUST

`FunctionCallOutput.arguments` MUST always be a JSON string. Adapters receiving a structured object from the provider (e.g., Vertex `args: object`) MUST serialize it via `JSON.stringify` before returning the `HelixResponse`. This is a normalization obligation at the adapter boundary.

#### Scenario: Vertex args object serialized to JSON string

- **GIVEN** the Vertex provider returns a function call with `args: { query: "hello" }` (an object)
- **WHEN** the adapter normalizes the response
- **THEN** `FunctionCallOutput.arguments` MUST be `'{"query":"hello"}'` (a JSON string)
- **AND** MUST NOT be the raw object

#### Scenario: OpenAI arguments already a string — passthrough

- **GIVEN** the OpenAI provider returns `arguments: '{"query":"hello"}'` (already a string)
- **WHEN** the adapter normalizes the response
- **THEN** `FunctionCallOutput.arguments` MUST be that same string without re-serialization

#### Scenario: Normalization failure captured

- **GIVEN** the provider returns a function call with `args` that cannot be serialized (circular reference or non-JSON value)
- **WHEN** the adapter attempts `JSON.stringify`
- **THEN** the adapter MUST catch the error and throw `HelixError` with `kind: "NormalizationError"`

---

### REQ-TOOL-005: ToolChoice discriminated union

**Identifiers**: HX5
**Priority**: MUST

`ToolChoice` MUST accept exactly: `"auto"` (model decides), `"none"` (no tool calls), `"required"` (at least one tool call required), or `{ type: "function"; name: string }` (force a specific function). Adapters MUST map each variant to the provider-native tool-choice mechanism, or apply `strict` semantics if a variant is unsupported by the provider.

#### Scenario: auto tool choice

- **GIVEN** `toolChoice: "auto"` and the provider supports tool calls
- **WHEN** the adapter maps the request
- **THEN** it MUST forward a provider-native "auto" tool choice setting

#### Scenario: Specific function forced

- **GIVEN** `toolChoice: { type: "function", name: "myFn" }` and `tools` contains a `FunctionTool` named `"myFn"`
- **WHEN** the adapter maps the request
- **THEN** it MUST forward a provider-native "force function" instruction targeting `"myFn"`

#### Scenario: required choice on unsupported provider (strict on)

- **GIVEN** `toolChoice: "required"` and the provider does not support forced tool invocation
- **AND** `options.strict` is `true`
- **WHEN** the adapter evaluates the request
- **THEN** it MUST throw `HelixError` with `kind: "UnsupportedFeature"`

---

## Type Surface (informative)

See proposal §5.3 for the full TypeScript declarations of `NativeTool`, `NativeToolName`, `FunctionTool`, `ToolChoice`, and `FunctionCallOutput`.

---

## Open Items

1. **`NativeToolName` extensibility**: The allow-list will need to grow as providers add capabilities. Adding a new string literal is a non-breaking change for callers using `"auto"` tool choice but a BREAKING change for callers with exhaustive switches on `NativeToolName`. The design phase SHOULD recommend a JSDoc warning on the type.
2. **FunctionTool strict on Vertex**: Vertex's function calling does not have a schema-strict flag equivalent to OpenAI's. REQ-TOOL-003 does not mandate `strict` be honored on Vertex — it defaults to DROP behavior. Confirm in design.
3. **ToolChoice "required" support matrix**: Not all providers support "required" (force at least one call). The capability matrix in proposal §6 does not enumerate this. Design SHOULD document per-provider support and whether "required" falls under `DROP/STRICT` semantics.
