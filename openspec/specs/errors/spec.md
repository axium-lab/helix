# Spec: Errors

**Change**: helix-interface-definition
**Domain**: errors
**Status**: main

## Overview

Defines the normalized error model that every helix adapter MUST use. Satisfies PR6 (single `HelixError` discriminated union). Covers the `HelixError` class shape, the `HelixErrorKind` discriminated union, the static `is()` type guard, `retryable` classification, and the mapping from provider-native error signals to `HelixErrorKind`.

---

## Requirements

### REQ-ERR-001: HelixError class shape

**Identifiers**: PR6, Q6
**Priority**: MUST

`HelixError` MUST `extend Error`. It MUST expose the following read-only fields: `kind: HelixErrorKind`, `provider: HelixProviderKind`, `retryable: boolean`, and OPTIONAL `statusCode?: number` and `raw?: unknown`. The constructor MUST accept a `HelixErrorInit` object and populate all fields. `message` MUST be human-readable and actionable (not a raw provider error dump).

#### Scenario: HelixError construction

- **GIVEN** an adapter catches a provider error and constructs `new HelixError({ kind, provider, message, statusCode, raw, retryable })`
- **THEN** the resulting instance MUST have `kind`, `provider`, `retryable` set to the provided values
- **AND** `statusCode` and `raw` MUST be set if provided, or `undefined` if omitted
- **AND** `instanceof HelixError` MUST return `true`
- **AND** `instanceof Error` MUST return `true`

#### Scenario: Stack trace preserved

- **GIVEN** a `HelixError` is thrown from within an adapter
- **THEN** `error.stack` MUST include a stack trace pointing into the adapter source
- **AND** if a `cause` was provided in `HelixErrorInit`, it MUST be accessible via `error.cause`

---

### REQ-ERR-002: HelixError.is() type guard

**Identifiers**: PR6
**Priority**: MUST

`HelixError.is(err)` MUST return `true` if and only if `err` is an instance of `HelixError`. It MUST narrow the type to `HelixError` in TypeScript. It MUST NOT throw for any input, including `null`, `undefined`, non-object values, and plain `Error` instances.

#### Scenario: Type guard on HelixError

- **GIVEN** `err` is a `HelixError` instance
- **WHEN** `HelixError.is(err)` is called
- **THEN** it MUST return `true`
- **AND** TypeScript MUST narrow `err` to `HelixError` in the subsequent scope

#### Scenario: Type guard on non-HelixError

- **GIVEN** `err` is a plain `Error`, a string, `null`, or `undefined`
- **WHEN** `HelixError.is(err)` is called
- **THEN** it MUST return `false`
- **AND** MUST NOT throw

---

### REQ-ERR-003: HelixErrorKind exhaustive union

**Identifiers**: PR6
**Priority**: MUST

`HelixErrorKind` MUST be a string literal union containing exactly: `"InvalidApiKey"`, `"PermissionDenied"`, `"InvalidRequest"`, `"RateLimit"`, `"QuotaExceeded"`, `"ServerError"`, `"ProviderUnavailable"`, `"ContentFiltered"`, `"UnsupportedFeature"`, `"NormalizationError"`, `"Unknown"`. No other values are valid in Phase 1. Callers MUST be able to exhaustively switch on `kind`.

#### Scenario: Exhaustive switch on kind

- **GIVEN** code that exhaustively switches over `HelixErrorKind`
- **THEN** TypeScript MUST NOT produce an error for an unreachable `default` case covering all defined kinds
- **AND** adding a new kind in a future version MUST cause a compile-time break in exhaustive switches (desired behavior for forward compatibility)

---

### REQ-ERR-004: Provider-error-to-kind mapping

**Identifiers**: PR6
**Priority**: MUST

Every adapter MUST translate provider-native error signals to `HelixErrorKind` according to the mapping table below. Errors not matching a specific mapping MUST use `"Unknown"`. The `raw` field MUST preserve the original provider error object for debugging.

| Provider signal | HelixErrorKind | retryable |
|---|---|---|
| HTTP 401 / auth failure | `InvalidApiKey` | false |
| HTTP 403 | `PermissionDenied` | false |
| HTTP 400 / validation error | `InvalidRequest` | false |
| HTTP 429 (rate limit) | `RateLimit` | true |
| HTTP 429 (quota exceeded, provider-disambiguated) | `QuotaExceeded` | false |
| HTTP 500 | `ServerError` | true |
| HTTP 502 / 503 / 504 | `ProviderUnavailable` | true |
| Content policy / safety filter trigger | `ContentFiltered` | false |
| Adapter detects unsupported feature | `UnsupportedFeature` | false |
| Response normalization failure | `NormalizationError` | false |
| Anything else | `Unknown` | false |

#### Scenario: 401 maps to InvalidApiKey

- **GIVEN** the provider returns an HTTP 401 response
- **WHEN** the adapter normalizes the error
- **THEN** the resulting `HelixError` MUST have `kind: "InvalidApiKey"`, `retryable: false`, and `statusCode: 401`
- **AND** `raw` MUST contain the original response payload

#### Scenario: 503 maps to ProviderUnavailable (retryable)

- **GIVEN** the provider returns an HTTP 503 response
- **WHEN** the adapter normalizes the error
- **THEN** the resulting `HelixError` MUST have `kind: "ProviderUnavailable"`, `retryable: true`, and `statusCode: 503`

#### Scenario: Unknown error preserved

- **GIVEN** the provider throws a network error (e.g., DNS failure) that does not have an HTTP status code
- **WHEN** the adapter normalizes the error
- **THEN** `kind` MUST be `"Unknown"`, `retryable` MUST be `false`, and `raw` MUST contain the original error

---

### REQ-ERR-005: UnsupportedFeature is adapter-thrown, not provider-thrown

**Identifiers**: PR6, Q9
**Priority**: MUST

`"UnsupportedFeature"` MUST be thrown by the adapter itself — before any network call — when `strict: true` and the caller requested an unsupported option. It MUST NOT be used to wrap a provider-returned 400 that happens to mention an unsupported feature. That case MUST use `"InvalidRequest"`.

#### Scenario: strict mode triggers UnsupportedFeature

- **GIVEN** `options.strict` is `true` and the caller sets `options.topK` on an OpenAI provider
- **WHEN** the adapter evaluates the request options
- **THEN** it MUST throw `HelixError` with `kind: "UnsupportedFeature"` and `statusCode` MUST be `undefined` (no HTTP call was made)
- **AND** `provider` MUST reflect the adapter's provider kind

#### Scenario: Provider 400 is InvalidRequest, not UnsupportedFeature

- **GIVEN** the caller sends a request that the provider rejects with HTTP 400 citing an unrecognized parameter
- **WHEN** the adapter handles the error
- **THEN** `kind` MUST be `"InvalidRequest"`, NOT `"UnsupportedFeature"`

---

### REQ-ERR-006: retryable classification

**Identifiers**: PR6
**Priority**: MUST

`retryable: true` MUST be set for `RateLimit`, `ServerError`, and `ProviderUnavailable` kinds. All other kinds MUST default to `retryable: false`. The `HelixErrorInit` constructor argument MAY override `retryable` for provider-specific edge cases, but the default MUST follow the table in REQ-ERR-004.

#### Scenario: RateLimit is retryable by default

- **GIVEN** the provider returns HTTP 429 and the kind resolves to `RateLimit`
- **THEN** `retryable` MUST be `true`

#### Scenario: QuotaExceeded is not retryable

- **GIVEN** the provider returns HTTP 429 disambiguated as quota-exceeded
- **THEN** `kind` MUST be `"QuotaExceeded"` and `retryable` MUST be `false`

---

## Type Surface (informative)

See proposal §5.8 for the full TypeScript declarations of `HelixError`, `HelixErrorKind`, `HelixProviderKind`, and `HelixErrorInit`.

---

## Open Items

1. **Retry classification for HTTP 429 disambiguation**: RateLimit vs QuotaExceeded requires provider-specific parsing of the response body (e.g., OpenAI `error.code: "insufficient_quota"`). The design phase MUST document the per-adapter disambiguation logic.
2. **HelixError as runtime export**: Because `HelixError.is()` must work at runtime, `error.ts` MUST ship runtime code (not just a `declare class`). This is the one runtime concession in the interfaces-only change. The design phase MUST confirm the file will be compiled and bundled.
3. **Vertex auth errors**: `InvalidApiKey` vs `PermissionDenied` disambiguation for Vertex depends on the error code returned by the Google auth library. The apply phase MUST document which Vertex error codes map to which kind.
