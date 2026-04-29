# ADR-0003: Real HTTP Implementations via openai SDK (OpenAI, Azure, Custom)

- **Date**: 2026-04-28
- **Status**: Accepted (shipped)

## Context

After ADR-0002, all four internal adapters were stubs throwing "not implemented". Consumers needed real HTTP calls for OpenAI, Azure, and Custom providers. Vertex was deferred due to its distinct auth model (Google ADC / JWT signing).

## Decision

Implemented `openai`, `azure`, and `custom` adapters using the `openai@^6.0.0` SDK as the sole HTTP layer:

- **Eager SDK construction** in each adapter constructor (no lazy init).
- **openai + custom**: delegate `responses.create`, `files.*`, and `models.list` directly to SDK methods.
- **azure**: same delegation except `models.list` — that remained a throw stub (ARM endpoint complexity deferred to ADR-0004).
- **`openai` marked `external` in tsup** — not bundled into dist; consumers must install it separately.
- **Test strategy**: `vi.mock("openai")` module-level mocking (not MSW HTTP interception) — tests the adapter forwarding, not the network.
- Tests live in `tests/unit/` (not `src/`); integration tests are env-gated and skip cleanly when credentials absent.
- **Vertex** adapter: byte-identical to Phase 1 stub — no changes, no tests added.

## Consequences

- `openai` is a runtime `dependency` (not devDep); consumers inherit its version contract.
- Errors still propagate raw — callers catch SDK-specific error types until `helix-error-model`.
- Azure `test()` returns `false` permanently in this phase (models.list throws); fixed in ADR-0004.
- `vi.mock` approach means tests assert adapter forwarding logic, not HTTP correctness — integration tests are the HTTP gate.
