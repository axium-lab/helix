# ADR-0007: Explicit Mappers for OpenAI `responses.create` Adapter

- **Date**: 2026-04-30
- **Status**: Accepted

## Context

ADR-0005 tightened `files.create` by removing the `as Parameters<...>[0]` input cast and the `as unknown as FileObject` output cast, replacing them with explicit narrowing and runtime guards. That change explicitly carved out `responses.create` — see the guard test in `tests/unit/adapter-cast-removal.test.ts` (REQ-FP-6) which today asserts the cast **must remain**.

The current state of `src/internal/providers/openai/openai.responses.ts` carries two unsafe casts:

```ts
return client.responses.create(
  params as Parameters<typeof client.responses.create>[0],   // (1) input bypass
) as unknown as HelixResponse;                                // (2) output bypass
```

Consequences of leaving them in place:

- **(1)** Structural compatibility between `ResponsesCreateParams` (helix) and OpenAI's `ResponseCreateParamsNonStreaming` is asserted by hand, not verified by `tsc`. If helix adds a field OpenAI rejects, no compile-time error.
- **(2)** `HelixResponse` declares 7 fields; OpenAI's `Response` ships 50+. The cast silently leaks the full upstream shape (`error`, `incomplete_details`, `parallel_tool_calls`, `temperature`, `tool_choice`, `tools`, …) to consumers. The public contract is dishonest, and consumers can come to depend on undocumented fields that future providers (Vertex, Anthropic) won't have.

The carve-out was always meant to be temporary — its only published trace is the test guard.

## Decision

- **New module** `src/internal/providers/openai/openai.responses.mappers.ts` exporting two pure functions:
  - `toOpenAIParams(params: ResponsesCreateParams): ResponseCreateParamsNonStreaming` — explicit field-by-field forward.
  - `toHelixResponse(r: OpenAIResponse): HelixResponse` — narrowing mapper.
- **`toHelixResponse` filters output items by `type === "message"`** and `content` parts by `type === "output_text"`. This matches the documented v0 scope already declared in `src/core/types/responses/llm.response.ts` (`OutputItem = OutputMessage`, with a comment pointing to future `helix-tools` / `helix-error-model` for the rest).
- **`openai.responses.ts`** becomes a thin orchestrator with no casts:
  ```ts
  const raw = await client.responses.create(toOpenAIParams(params));
  return toHelixResponse(raw);
  ```
- **Guard test REQ-FP-6 inverts polarity**: from `expect(source).toContain(cast)` → `expect(source).not.toContain(cast)`. The same regression-prevention discipline applied in ADR-0005 to `files.create` now extends to `responses.create`.

## Consequences

- `tsc` validates OpenAI param compatibility field-by-field. A breaking change in OpenAI's SDK fails at compile time inside the mapper, not silently at runtime.
- `HelixResponse` becomes an honest contract: only the 7 declared fields cross the helix boundary. Consumers cannot rely on OpenAI-specific fields.
- The mapper is the **canonical narrowing point** for any future provider (Azure response support, Vertex, Anthropic) — each provider gets its own `to{Provider}Response` and the public type stays uniform.
- Output items that are not `message`/`output_text` (tool calls, reasoning items, refusals) are dropped silently today. This is consistent with the existing v0 scope comment in `llm.response.ts`. When `helix-tools` and `helix-error-model` ship, the mapper grows new branches; the public `OutputItem` union expands accordingly.
- The implicit carve-out from REQ-FP-6 (the internal `helix-files-params-tightening` change) is closed. No published ADR is superseded; only the test guard flips polarity.
- Future providers MUST follow the same pattern: explicit input/output mappers, no `as unknown as` casts in adapter code.

## Implementation note (2026-04-30)

The mappers live at `src/internal/providers/_shared/openai.mapper.ts` — grouped by upstream SDK, not by provider. All three current adapters (OpenAI, Azure, Custom) consume them, since `AzureOpenAI` extends `OpenAI` and `custom` is OpenAI-compatible by contract. When a non-OpenAI provider lands (Vertex, Anthropic), it adds a sibling file under `_shared/` (e.g. `vertex.mapper.ts`) — `_shared/` hosts mappers per upstream SDK, never per provider. The guard test in `tests/unit/adapter-cast-removal.test.ts` iterates over every OpenAI-shape adapter to keep regression coverage uniform.
