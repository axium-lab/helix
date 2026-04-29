# ADR-0006: Standardized HelixError Across All Providers

- **Date**: 2026-04-29
- **Status**: Accepted (planned — supersedes the error-passthrough provision of ADR-0002)

## Context

ADR-0002 deferred error standardization to keep v1 small, leaving consumers to catch raw `openai` SDK error classes and provider-specific shapes. As helix gained adapters (`openai`, `azure`, `custom`, planned `vertex`), passthrough leaked provider details into consumer code: every consumer had to learn each provider's error format, write per-provider catch logic, and re-classify operationally (retryable vs not, `rate_limit` vs quota). Cross-provider research surfaced structural asymmetries no consumer should discover at runtime — most starkly, Vertex AI returns HTTP 200 for content-policy blocks via `finishReason: "SAFETY"`, making a provider-agnostic catch impossible without library-side normalization.

## Decision

Helix owns the error model. All adapter errors (HTTP, network, body-decoded) are converted to a single `HelixError` class before reaching consumer code:

```typescript
class HelixError extends Error {
  readonly category: HelixErrorCategory;
  readonly provider: "openai" | "azure" | "custom" | "vertex";
  readonly httpStatus?: number;
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly meta?: Record<string, unknown>;
  readonly cause?: unknown;
}
```

`HelixErrorCategory` is a discriminated string union of eleven values: `"auth_error" | "permission_denied" | "not_found" | "rate_limit" | "quota_exceeded" | "content_filter" | "invalid_request" | "server_error" | "timeout" | "connection_error" | "unknown"`.

Three architectural commitments follow:

1. **Vertex adapter performs body-level error synthesis** — HTTP 200 with `finishReason: "SAFETY"` raises `HelixError({category: "content_filter"})`. This is the only path in the library where a successful HTTP response becomes an error.
2. **HTTP 429 requires body inspection** to split `rate_limit` from `quota_exceeded` via `error.code === "insufficient_quota"`. Default to `rate_limit` when `code` is absent.
3. **`meta` carries category-specific context** (Azure `innererror`, OpenRouter `upstream` raw, `filteredAt: "prompt" | "completion"`) instead of expanding the category enum.

## Consequences

- Consumers write one `if (err instanceof HelixError && err.category === "rate_limit")` regardless of provider — ADR-0002's unification goal is finally honored at the error path.
- Each adapter gains a private error-mapping function; adding a new provider requires implementing it — non-optional surface.
- `cause` preserves the original SDK error as an escape hatch — nothing the upstream exposed is lost.
- The eleven categories are an enum-level contract: adding is a minor version bump, removing is a major. Names should not be casually changed.
- `retryable` is a HINT, not a guarantee. Consumers own backoff and limit logic; helix only flags whether retry has any chance of succeeding.
- Cross-provider research backing this decision is persisted in engram at `research/error-taxonomy` for future revisits.
