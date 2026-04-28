# Delta for Dependencies — helix-providers-phase-2

**Change**: helix-providers-phase-2
**Domain**: package dependencies and version pins
**Status**: draft

## Overview

Governs `package.json` additions required by this change. Exactly one runtime dependency is added (`openai`). Test-infrastructure devDependencies (Vitest, MSW) are added. No existing dependencies are removed or modified. Satisfies RD-PHASE2-1 (transport choice), RD-PHASE2-5 (test runner), and RD-PHASE2-7 (SDK version pin).

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

### REQ-DEP-003: MSW interceptors package added as a devDependency

Either `"@mswjs/interceptors"` or `"msw"` (design phase picks; see Open Items) MUST be added to `"devDependencies"` at the latest stable version at time of apply. If `"msw"` is chosen, no server-side worker initialization is required for Node unit tests — only the Node interceptors are used.

**Acceptance check**: one of the two packages appears under `"devDependencies"`.

#### Scenario: MSW package present in devDependencies

- GIVEN the change is fully applied
- WHEN `package.json` is read
- THEN either `"@mswjs/interceptors"` or `"msw"` MUST appear under `"devDependencies"`
- AND it MUST NOT appear under `"dependencies"` or `"peerDependencies"`

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
- AND `"devDependencies"` MUST contain new entries for test infrastructure only

---

## Open Items

### REQ-DEP-OI-001: tsup external/bundle policy for openai (sdd-design decides)

The proposal defers to sdd-design whether `openai` should be listed in tsup's `external` array (consumers install it themselves from transitive resolution) or bundled into the CJS/ESM outputs. Standard library practice is `external`, but axium-api's single-install preference may argue for bundling. sdd-design MUST pin this before sdd-tasks.

### REQ-DEP-OI-002: Exact MSW package choice (sdd-design decides)

`@mswjs/interceptors` is lighter (Node-only fetch interception); `msw` is the full package (includes browser service worker). For a Node-only test suite, `@mswjs/interceptors` is sufficient. sdd-design picks and the chosen package is what sdd-apply installs.

### REQ-DEP-OI-003: Exact version pins for vitest and MSW at apply time

REQ-DEP-002 and REQ-DEP-003 say "latest stable at time of apply." sdd-tasks or sdd-apply MUST run `npm view <pkg> version` to resolve the concrete version and record it in the tasks artifact before touching `package.json`.

---

**End of spec.**
