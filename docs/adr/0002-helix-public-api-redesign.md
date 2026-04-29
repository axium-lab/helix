# ADR-0002: SDK-Mirror Public API — Single Factory and Namespaced Interface

- **Date**: 2026-04-28
- **Status**: Accepted (shipped)

## Context

ADR-0001's four per-provider factories and 38 exported types were over-engineered for the library's actual consumers. The OpenAI SDK's namespace shape (`client.responses`, `client.files`, `client.models`) was already familiar to the target audience. A single factory with a discriminated config union would be simpler and more idiomatic.

## Decision

Replaced the entire v1 public surface with:

- **`createHelix(config: HelixConfig): Helix`** — single factory replacing `createOpenAI`, `createAzureOpenAI`, `createOpenAICompatible`, `createVertex`.
- **`HelixConfig`**: discriminated union on `provider: "openai" | "azure" | "custom" | "vertex"` — each variant carries provider-specific fields.
- **`Helix` interface**: four namespaces — `responses.create`, `files.{create,list,delete}`, `models.list`, `test`.
- Exported types reduced from 38 to ~14; internal adapters moved to `src/internal/providers/` (not exported).
- `HelixError`, `NativeTool`, `FunctionTool`, and `ProviderCapabilities` removed from the public surface (deferred to future changes).
- `tsconfig.json`: `lib: ["ES2022"]`, `types: ["node"]`, `engines.node: ">=22"` — no DOM ambient globals.

## Consequences

- Consumers write one `createHelix({provider, ...})` call regardless of backend — no per-provider import.
- Error handling is raw SDK passthrough until `helix-error-model` ships; callers catch `openai` SDK error types directly.
- `HelixError` and tools surface must be reintroduced in future changes — not casual additions.
- Internal adapter structure (`src/internal/`) is free to change without breaking semver.
