# Spec: Test

**Change**: helix-public-api-redesign
**Domain**: test
**Status**: stable (archived 2026-04-28)

## Overview

Defines `helix.test(): Promise<boolean>` as a connectivity and credential sanity-check entry point. Returns `true` on success, `false` on any failure. Never throws, never rejects. All error detail is swallowed — the caller is responsible for its own diagnostics on `false`. Satisfies HX7, RD-3. In v0 of this change, errors propagate raw from the provider/SDK for all other operations; `helix.test()` is the sole operation that deliberately swallows errors and returns `false` instead.

---

## Requirements

### REQ-TEST-001: test() signature and return contract

**Identifiers**: HX7, RD-3
**Priority**: MUST

`helix.test(): Promise<boolean>` MUST always resolve — it MUST NOT reject under any circumstance. It MUST return `true` when the provider is reachable and credentials are valid. It MUST return `false` when any failure occurs (network error, auth error, timeout, or any thrown exception from the underlying operation). No error detail MUST be surfaced to the caller through this method.

#### Scenario: Successful connectivity check

- **GIVEN** provider is OpenAI with valid `apiKey` and reachable network
- **WHEN** `helix.test()` is called
- **THEN** the promise MUST resolve with `true`
- **AND** the promise MUST NOT reject

#### Scenario: Invalid credentials return false

- **GIVEN** provider is OpenAI with an invalid `apiKey`
- **WHEN** `helix.test()` is called
- **THEN** the promise MUST resolve with `false`
- **AND** the promise MUST NOT reject — the error MUST be swallowed internally

#### Scenario: Network unreachable returns false

- **GIVEN** the provider endpoint is unreachable (network offline or wrong `baseUrl`)
- **WHEN** `helix.test()` is called
- **THEN** the promise MUST resolve with `false` — not reject, not throw

---

### REQ-TEST-002: Error swallowing is mandatory

**Identifiers**: HX7, RD-3
**Priority**: MUST

The `test()` implementation MUST catch all errors from the internal operation it performs and return `false`. It MUST NOT re-throw. It MUST NOT wrap in `HelixError`. It MUST NOT return a structured result like `{ ok: false, error: ... }`. The return type is `Promise<boolean>` — no union, no wrapper.

> Note: adapters SHOULD implement `test()` by calling `models.list()` internally and returning `true` if it resolves, `false` if it throws or rejects. This is the expected implementation pattern; the spec only constrains the observable behavior.

#### Scenario: Any internal exception maps to false

- **GIVEN** the internal operation (e.g., `models.list()`) throws or rejects for any reason
- **WHEN** `helix.test()` is called
- **THEN** the promise MUST resolve with `false`
- **AND** the error MUST be swallowed — not propagated, not logged by the library

#### Scenario: Return type is exactly Promise<boolean>

- **GIVEN** a value `helix` of type `Helix`
- **WHEN** `helix.test()` is called
- **THEN** the return type MUST be `Promise<boolean>` — no `Promise<{ok: boolean}>`, no `Promise<boolean | Error>`

---

### REQ-TEST-003: test() works for all four providers

**Identifiers**: HX7, proposal §8
**Priority**: MUST

`helix.test()` MUST be implemented for all four providers: `openai`, `azure`, `custom`, and `vertex`. For each provider, the operation MUST return `true` on success and `false` on any failure.

| Provider | Expected behavior |
|----------|-------------------|
| OpenAI | OK — returns `true` if `models.list()` succeeds, `false` otherwise |
| Azure | OK — returns `true` if `models.list()` succeeds, `false` otherwise |
| Custom | OK — returns `true` if `models.list()` succeeds, `false` otherwise |
| Vertex | OK — returns `true` if `models.list()` succeeds, `false` otherwise |

#### Scenario: test() on Azure returns false for bad endpoint

- **GIVEN** provider is `azure` and `endpoint` points to an unreachable host
- **WHEN** `helix.test()` is called
- **THEN** the promise MUST resolve with `false` — not reject

#### Scenario: test() on Vertex with valid credentials returns true

- **GIVEN** provider is `vertex` with valid `projectId`, `location`, and `credentials`
- **WHEN** `helix.test()` is called
- **THEN** the promise MUST resolve with `true` when the Vertex endpoint is reachable

---

### REQ-TEST-004: Diagnostic responsibility belongs to the caller

**Identifiers**: HX7, RD-3
**Priority**: MUST

`helix.test()` MUST NOT log error details, expose error objects in the return value, or emit events. The caller receives only `true` or `false` and is fully responsible for diagnosing the cause of a `false` return.

#### Scenario: Caller re-runs with logging after false

- **GIVEN** `helix.test()` returns `false`
- **WHEN** the caller wants to diagnose the issue
- **THEN** the caller MUST use other means (e.g., calling `helix.models.list()` directly and catching the error)
- **AND** `helix.test()` MUST provide no additional diagnostic information through its interface

---

**End of spec.**
