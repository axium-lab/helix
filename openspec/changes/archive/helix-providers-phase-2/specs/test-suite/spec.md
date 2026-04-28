# Delta for Test Suite — helix-providers-phase-2

**Change**: helix-providers-phase-2
**Domain**: unit and integration test coverage
**Status**: draft

## Overview

Governs the test coverage required for this change. Satisfies PR3 ("tests with openai, azure, custom") for the three in-scope providers. Vertex coverage is explicitly waived for this change and will be delivered by `helix-vertex-provider`. Uses Vitest as the test runner and MSW (via `@mswjs/interceptors` or full `msw` package — design phase picks) for HTTP mocking in the unit tier.

---

## ADDED Requirements

### REQ-TEST-UNIT-001: Unit test file per in-scope provider

A unit test file MUST exist for each in-scope provider: `openai`, `azure`, `custom`. Each file MUST import the adapter factory directly (not `createHelix`) and test every public method on the `Helix` interface for that provider.

**Acceptance check**: three test files exist; `vitest run` passes without any env vars set.

#### Scenario: Unit suite runs without credentials

- GIVEN no `HELIX_OPENAI_API_KEY` or any other credential env var is set
- WHEN `vitest run` executes the unit test suite
- THEN all unit tests MUST pass — no skips, no credential-dependent failures

---

### REQ-TEST-UNIT-002: responses.create unit coverage per provider

Each provider's unit test file MUST include tests for `responses.create` covering:
- (a) happy-path: params forwarded verbatim, `HelixResponse` shape returned
- (b) raw error passthrough: SDK throws, error propagates unchanged

**Acceptance check**: tests named "responses.create — forwards params" and "responses.create — propagates error" (or equivalent) exist per provider; all pass.

#### Scenario: Happy-path responses.create test for openai

- GIVEN the MSW interceptor returns a valid `HelixResponse`-shaped payload
- WHEN the unit test calls `helix.responses.create({ model: "gpt-4o", input: [...] })`
- THEN the test MUST assert the resolved value has `id`, `object === "response"`, `output`, `output_text`, and `usage`

#### Scenario: Error passthrough test for responses.create

- GIVEN the SDK mock throws (or the interceptor returns 401)
- WHEN the unit test calls `responses.create`
- THEN the test MUST assert the error is not wrapped — the thrown/rejected value is the raw SDK error

---

### REQ-TEST-UNIT-003: files.* unit coverage

Each unit test for `openai` and `azure` MUST cover `files.create`, `files.list`, and `files.delete`. Each unit test for `custom` MUST cover all three file methods asserting they throw with the exact messages from REQ-CUSTOM-004.

**Acceptance check**: tests exist for all six file-method/provider combinations (openai×3, azure×3, custom×3).

#### Scenario: files.create happy path for OpenAI

- GIVEN the MSW interceptor returns a valid `FileObject`-shaped payload
- WHEN `helix.files.create({ file: new Uint8Array([1, 2, 3]) })` is called
- THEN the test MUST assert `result.object === "file"` and `result.id` is a non-empty string

#### Scenario: files.* throw tests for Custom

- GIVEN the custom adapter is instantiated
- WHEN each of `files.create`, `files.list`, `files.delete` is called in separate tests
- THEN each MUST throw a plain `Error` with the exact message from REQ-CUSTOM-004

---

### REQ-TEST-UNIT-004: models.list unit coverage

Each in-scope provider's unit test MUST cover `models.list`. For `openai` and `custom`: happy path returns `ModelInfo[]`; raw error propagates. For `azure`: the call MUST throw with the exact message from REQ-AZ-004; no HTTP call is made.

**Acceptance check**: tests exist for `models.list` for all three providers; Azure test asserts exact message string.

#### Scenario: models.list happy path for OpenAI

- GIVEN the MSW interceptor returns a models list payload with two entries
- WHEN `helix.models.list()` is called
- THEN the test MUST assert a two-element array where each item has `object === "model"`

#### Scenario: models.list throws for Azure with exact message

- GIVEN the Azure adapter is instantiated
- WHEN `helix.models.list()` is called
- THEN the test MUST assert `error.message` equals exactly: `"helix-lib: 'models.list' not supported by provider 'azure' — Azure data-plane deployment listing was retired April 2024; ARM management plane requires credentials not present in HelixConfig.azure"`

---

### REQ-TEST-UNIT-005: test() unit coverage per provider

Each provider's unit test MUST cover `test()` for at minimum:
- (a) returns `true` when the underlying operation succeeds (openai, custom)
- (b) returns `false` when the underlying operation fails (openai, custom, azure)
- (c) never rejects under any circumstance

For Azure, only case (b) needs a test since `models.list` always throws.

**Acceptance check**: `test()` tests exist per provider; all pass; no test asserts `test()` rejects.

#### Scenario: test() returns true when models.list succeeds (OpenAI)

- GIVEN the MSW interceptor allows the models list call through
- WHEN `helix.test()` is called on the OpenAI adapter
- THEN the promise MUST resolve with `true` and MUST NOT reject

#### Scenario: test() returns false when models.list fails (OpenAI)

- GIVEN the MSW interceptor returns a 500 for the models endpoint
- WHEN `helix.test()` is called on the OpenAI adapter
- THEN the promise MUST resolve with `false` and MUST NOT reject

#### Scenario: test() always returns false on Azure

- GIVEN the Azure adapter is instantiated
- WHEN `helix.test()` is called
- THEN the promise MUST resolve with `false` — no interceptor needed

---

### REQ-TEST-UNIT-006: Vertex provider MUST NOT be tested in this change

Unit tests for the `vertex` provider are explicitly out of scope for `helix-providers-phase-2`. Vertex coverage is deferred to `helix-vertex-provider`. The vertex adapter file (`src/internal/providers/vertex.ts`) MUST NOT have a test file added by this change.

**Acceptance check**: no `vertex.test.ts` file exists after this change is applied.

#### Scenario: No vertex test file exists

- GIVEN the change is fully applied
- WHEN the test directory is listed
- THEN no file matching `vertex.test.ts` or `vertex.spec.ts` MUST exist

---

### REQ-TEST-INTG-001: Integration test tier exists and is env-gated

An integration test file (or directory) MUST exist. All integration tests MUST skip gracefully when the required env vars are absent. Integration tests MUST NOT be included in the default `vitest run` command — they MUST require an explicit script (e.g., `vitest run --dir tests/integration` or equivalent configured in `package.json`).

**Acceptance check**: integration tests exist; running `vitest run` (unit only) passes with no env vars; running the integration script with missing vars shows skips, not failures.

#### Scenario: Integration tests skip when env vars absent

- GIVEN `HELIX_OPENAI_API_KEY` is not set
- WHEN the integration test script is run
- THEN all OpenAI integration tests MUST be skipped — not failed
- AND the exit code MUST be 0

#### Scenario: Integration tests run when env vars present

- GIVEN `HELIX_OPENAI_API_KEY` is a valid OpenAI key
- WHEN the integration test script is run
- THEN the OpenAI integration suite MUST execute against real endpoints and pass

---

**End of spec.**
