# ADR-0008: `finish_reason` and `metadata` in `HelixResponse`

- **Date**: 2026-05-05
- **Status**: Accepted

## Context

`HelixResponse` already exposed `status: HelixResponseStatus` to represent the request lifecycle
state (`completed | incomplete | in_progress | failed`). Two gaps remained:

1. **Why did the model stop generating?** `status: "incomplete"` tells you the response is truncated,
   but not whether it was a token limit, a content filter, or a future tool call. Consumers need a
   single, normalized field to branch on — without having to combine `status` + `incomplete_details`.

2. **Access to provider-specific fields.** Helix intentionally narrows `HelixResponse` to a portable
   subset. Power consumers sometimes need fields Helix doesn't normalize (billing, prompt cache keys,
   service tier, etc.). There was no escape hatch.

### Why `incomplete_details` was removed

`HelixIncompleteDetails` (added earlier) duplicated what `finish_reason` expresses more cleanly:

| Before | After |
|---|---|
| `status: "incomplete"` + `incomplete_details: { reason: "max_output_tokens" }` | `finish_reason: "max_tokens"` |
| `status: "incomplete"` + `incomplete_details: { reason: "content_filter" }` | `finish_reason: "content_filter"` |

Keeping both would force consumers to check two fields for the same question. The lib has no
consumers yet, so removing `incomplete_details` is a clean cut with no migration cost.

## `status` vs `finish_reason` — they are NOT the same

| Field | Question it answers | Lifecycle |
|---|---|---|
| `status` | Did the server finish processing the request? | Request |
| `finish_reason` | Why did the model stop generating tokens? | Generation |

`status: "completed"` means the server is done. `finish_reason: "end_turn"` means the model chose
to stop naturally. A completed response will almost always have `finish_reason: "end_turn"`, but
when tools land, a `completed` response could carry `finish_reason: "tool_use"` — the server
finished, but the model paused to invoke a function.

## Provider naming landscape

Helix exclusively uses the **OpenAI Responses API** (not Chat Completions). For context, this is
how each relevant provider exposes the stop signal:

| Provider / API | Field | Values |
|---|---|---|
| OpenAI Responses API *(in use)* | `status` + `incomplete_details.reason` | no single finish_reason field |
| Anthropic Messages *(planned)* | `stop_reason` | `end_turn`, `max_tokens`, `stop_sequence`, `tool_use` |

OpenAI Chat Completions (`choices[].finish_reason`) is **not used** in helix-lib and is listed
here only as historical reference.

Helix normalizes to a single `HelixFinishReason` type using Anthropic-flavored naming because it is
more descriptive and maps cleanly to future Anthropic provider support.

## Decision

### `finish_reason: HelixFinishReason | null`

```ts
type HelixFinishReason =
  | "end_turn"       // model finished naturally
  | "max_tokens"     // cut by output token limit
  | "stop_sequence"  // hit a stop sequence (Anthropic, future)
  | "tool_use"       // model paused to call a tool (future: helix-tools)
  | "content_filter" // blocked by content policy
  | "refusal"        // model refused to answer (future)
  | "error"          // request failed
```

`null` means the response is still `in_progress` (streaming or async, not yet finished).

`stop_sequence` and `refusal` are reserved for future providers (Anthropic, Vertex). They have no
mapping from the OpenAI Responses API today.

**Mapping from OpenAI Responses API:**

| `status` | `incomplete_details.reason` | `finish_reason` |
|---|---|---|
| `completed` | — | `end_turn` |
| `incomplete` | `max_output_tokens` | `max_tokens` |
| `incomplete` | `content_filter` | `content_filter` |
| `incomplete` | anything else | `end_turn` (defensive) |
| `failed` | — | `error` |
| `cancelled` | — | `error` |
| `in_progress` | — | `null` |
| `queued` | — | `null` |

### `metadata: { provider: unknown }`

Passthrough of the raw upstream SDK response object. Consumers who need OpenAI-specific fields
(billing, prompt cache key, service tier, etc.) can cast and access them without Helix being in the
way. Typed as `unknown` rather than `any` — the consumer must assert before use, which is the
correct TypeScript discipline for an opaque payload.

## Consequences

- Consumers check one field (`finish_reason`) instead of two (`status` + `incomplete_details`).
- When `helix-tools` lands, `finish_reason: "tool_use"` slots in with no shape change to `HelixResponse`.
- When Anthropic/Vertex providers land, their mappers populate `stop_sequence` and `refusal` from
  native fields — consumers see uniform values regardless of provider.
- `metadata.provider` gives an escape hatch without polluting the normalized contract.
- Future providers MUST map their native stop/finish signal to `HelixFinishReason`. The mapping
  lives in the provider's `to{Provider}Response` mapper, never in adapter code.
