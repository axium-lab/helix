# Delta for Dependencies — helix-providers-phase-2

**Change**: helix-providers-phase-2
**Domain**: package dependencies and version pins
**Status**: draft

## Overview

Governs `package.json` additions required by this change. Exactly one runtime dependency is added (`openai`). Test-infrastructure devDependencies (Vitest, @types/node) are added. No MSW package is required — unit tests use `vi.mock("openai")`. No existing dependencies are removed or modified. Satisfies RD-PHASE2-1 (transport choice), RD-PHASE2-5 (test runner), and RD-PHASE2-7 (SDK version pin).

---

## ADDED Requirements

### REQ-DEP-001: openai added as a runtime dependency

`"openai": "^6.0.0"` MUST be added to the `dependencies` field of `package.json` (not `peerDependencies`, not `devDependencies`). No other runtime dependency MUST be added by this change.

**Reasoning**: axium-api (the sole consumer) wants a single `npm install` to pull in the SDK. Declaring it as a `peerDependency` would force axium-api to install it separately and manage version alignment manually. The SDK is zero-runtime-dep itself, so pulling it into the bundle is safe (see Open Items: REQ-DEP-OI-001 for the tsup external/bundle question).

**Acceptance check**: `package.json` has `"openai": "^6.0.0"` under `"dependencies"` and no `openai` entry under `"devDependencies"` or `"peerDependencies"`.

#### Scenario: openai appears in dependencies only

- GIVEN the change is fully applied
- WHEN `package.json` is read
- THEN `"openai"` MUST appear under `"dependencies"` with value `"^6.0.0"`
- AND `"openai"` MUST NOT appear under `"devDependencies"` or `"peerDependencies"`

---

### REQ-DEP-002: vitest added as a devDependency

`"vitest"` at the latest stable version at time of apply MUST be added to `"devDependencies"`. An explicit `"test"` script and at minimum one of `"test:watch"` or `"test:integration"` MUST be added to `package.json` `"scripts"`.

**Acceptance check**: `package.json` has `"vitest"` under `"devDependencies"`; `npm run test` runs `vitest run`.

#### Scenario: test script runs vitest

- GIVEN the change is fully applied
- WHEN `npm run test` is executed
- THEN it MUST invoke `vitest run` (or equivalent vitest invocation)
- AND the command MUST exit 0 when all unit tests pass

---

### REQ-DEP-003: No MSW package — vi.mock("openai") used for unit mocking

Neither `"@mswjs/interceptors"` nor `"msw"` MUST appear in `package.json`. Unit tests mock the `openai` SDK module directly using `vi.mock("openai")`. HTTP-level interception is not needed because the adapters are thin pass-throughs to the SDK; module mocking is more honest and removes a devDependency.

**Acceptance check**: neither `"@mswjs/interceptors"` nor `"msw"` appears in `package.json` under any field.

#### Scenario: No MSW package in any dependency field

- GIVEN the change is fully applied
- WHEN `package.json` is read
- THEN `"@mswjs/interceptors"` and `"msw"` MUST NOT appear under `"dependencies"`, `"devDependencies"`, or `"peerDependencies"`

---

### REQ-DEP-004: package-lock.json committed to hard-pin all versions

`package-lock.json` MUST be committed after this change lands. The file hard-pins the exact installed versions of `openai`, `vitest`, and the MSW package, protecting against upstream semver drift. The lock file MUST be up-to-date with the `package.json` state at the time the change is applied.

**Acceptance check**: `package-lock.json` exists in the repository at the commit introducing this change; `npm ci` succeeds from a clean `node_modules`.

#### Scenario: npm ci succeeds from lock file

- GIVEN a clean environment with `node_modules` deleted
- WHEN `npm ci` is run using the committed `package-lock.json`
- THEN the command MUST complete successfully with zero errors
- AND the resolved `openai` version MUST satisfy `^6.0.0`

---

### REQ-DEP-005: No other runtime dependencies added

Only `openai` is added to `"dependencies"`. This change MUST NOT add `vitest`, `msw`, `@mswjs/interceptors`, or any other package to the runtime dependency surface.

**Acceptance check**: diff of `package.json` shows exactly one new entry under `"dependencies"`.

#### Scenario: Exactly one new runtime dependency

- GIVEN the change is fully applied
- WHEN the diff of `package.json` is inspected
- THEN exactly one package MUST be added to `"dependencies"`: `"openai": "^6.0.0"`
- AND `"devDependencies"` MUST contain new entries for `vitest` and `@types/node` only (no MSW packages)

---

## Open Items

### REQ-DEP-OI-001: tsup external/bundle policy for openai (sdd-design decides)

The proposal defers to sdd-design whether `openai` should be listed in tsup's `external` array (consumers install it themselves from transitive resolution) or bundled into the CJS/ESM outputs. Standard library practice is `external`, but axium-api's single-install preference may argue for bundling. sdd-design MUST pin this before sdd-tasks.

### REQ-DEP-OI-002: RESOLVED — No MSW package (post-archive correction)

`vi.mock("openai")` is used for all unit-level mocking. Neither `@mswjs/interceptors` nor `msw` is installed. Decision made during pre-commit correction after archive.

### REQ-DEP-OI-003: Exact version pins for vitest at apply time

REQ-DEP-002 says "latest stable at time of apply." sdd-tasks or sdd-apply MUST run `npm view vitest version` to resolve the concrete version before touching `package.json`.

---

**End of spec.**
