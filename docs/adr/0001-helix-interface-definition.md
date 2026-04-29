# ADR-0001: Hexagonal Interface Contract for helix-lib v0

- **Date**: 2026-04-27
- **Status**: Superseded by ADR-0002

## Context

helix-lib was a greenfield library with no public surface. The goal was a single normalized TypeScript contract covering OpenAI, Azure, Custom, and Vertex providers. Before writing any HTTP code, the type-system boundary had to be locked so adapters could be built independently.

## Decision

Established a full hexagonal (Ports & Adapters) public surface — types-only, no runtime beyond `HelixError`:

- **Core ports**: `HelixProvider` (request + capabilities) and `HelixFileStore` (upload/list/delete), both in `src/core/ports/`.
- **Four per-provider factories**: `createOpenAI`, `createAzureOpenAI`, `createOpenAICompatible`, `createVertex` — each returning a fresh `HelixClient` aggregate.
- **`HelixError`**: runtime class extending `Error` with `kind` discriminant (11-value union) and static `is()` type guard.
- **`NativeToolName`**: string-literal union (compile-time allow-list).
- **Discriminant convention**: `type` for content/output wire shapes; `kind` for errors only.
- **Zero third-party deps in `src/core/`** — enforced structurally (no imports from adapters or npm).
- Build: dual ESM + CJS + `.d.ts` via tsup, TypeScript strict mode.

## Consequences

- All adapter authors must satisfy `HelixProvider` and `HelixFileStore` — deviation fails type-check.
- `HelixErrorKind` is exhaustive; adding a new kind is a breaking change at all call sites.
- Streaming, tools enforcement, and error-status mapping deferred to future changes.
- This entire surface was replaced in ADR-0002; these interfaces never shipped to consumers.
