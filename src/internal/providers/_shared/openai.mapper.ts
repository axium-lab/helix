import type {
  Response as OpenAIResponse,
  ResponseCreateParamsNonStreaming,
  ResponseError,
  ResponseInput,
  ResponseOutputMessage,
  ResponseStatus,
  ResponseUsage,
} from "openai/resources/responses/responses";

import type { HelixProviderKind } from "../../../core/types/config.js";
import type {
  HelixFinishReason,
  OutputContentPart,
  HelixResponse,
  HelixResponseStatus,
  HelixUsage,
} from "../../../core/types/responses/llm.response.js";
import type { ResponsesCreateParams } from "../../../core/types/request.js";
import { HelixObject } from "../../../core/types/helix-object.js";

/**
 * Mappers shared by every provider whose upstream SDK speaks the OpenAI wire
 * format (today: OpenAI, Azure OpenAI, Custom OpenAI-compatible). Per ADR-0007.
 *
 * When a provider with a different shape lands (Vertex, Anthropic), it gets
 * its own `to{Provider}Params` / `to{Provider}Response` siblings here — the
 * `_shared` folder hosts mappers grouped by upstream SDK, not by provider.
 */

export function toOpenAIParams(
  params: ResponsesCreateParams,
): ResponseCreateParamsNonStreaming {
  return {
    model: params.model,
    input: params.input as ResponseInput,
    instructions: params.instructions,
    temperature: params.temperature,
    max_output_tokens: params.max_output_tokens,
    text: params.text
      ? {
        format: params.text.format
          ? params.text.format.type === "json_schema"
            ? {
              type: "json_schema",
              name: params.text.format.name,
              schema: params.text.format.schema as Record<string, unknown>,
              strict: params.text.format.strict,
            }
            : { type: params.text.format.type }
          : undefined,
      }
      : undefined,
    stream: false,
  };
}

export function toHelixResponse(r: OpenAIResponse, provider: HelixProviderKind): HelixResponse {
  const messages = r.output.filter((item): item is ResponseOutputMessage => item.type === "message");
  const hasRefusal = messages.some((m) => m.content.some((c) => c.type === "refusal"));

  return {
    id: r.id,
    object: HelixObject.Response,
    created_at: r.created_at,
    completed_at: r.completed_at ?? null,
    status: toHelixStatus(r.status),
    finish_reason: toHelixFinishReason(r.status, r.incomplete_details?.reason, hasRefusal),
    error: toHelixError(r.error),
    model: String(r.model),
    output: messages.map((m) => ({
      type: "message",
      id: m.id,
      role: m.role,
      content: m.content.flatMap((c): OutputContentPart[] => {
        if (c.type === "output_text") return [{ type: "output_text", text: c.text }];
        if (c.type === "refusal") return [{ type: "refusal", refusal: c.refusal }];
        return [];
      }),
      status: m.status,
    })),
    output_text: r.output_text,
    usage: toHelixUsage(r.usage),
    metadata: { [provider]: r },
  };
}

function toHelixStatus(status: ResponseStatus | undefined): HelixResponseStatus {
  switch (status) {
    case "completed":
    case "incomplete":
    case "in_progress":
    case "failed":
      return status;
    case "cancelled":
      return "failed";
    case "queued":
      return "in_progress";
    case undefined:
      return "completed";
  }
}

function toHelixFinishReason(
  status: ResponseStatus | undefined,
  incompleteReason: string | undefined,
  hasRefusal: boolean,
): HelixFinishReason | null {
  if (status === "in_progress" || status === "queued") return null;
  if (status === "failed" || status === "cancelled") return "error";
  if (hasRefusal) return "refusal";
  if (status === "incomplete") {
    if (incompleteReason === "max_output_tokens") return "max_tokens";
    if (incompleteReason === "content_filter") return "content_filter";
    return "end_turn";
  }
  return "end_turn";
}

function toHelixError(error: ResponseError | null): unknown | null {
  return error ?? null;
}

function toHelixUsage(usage: ResponseUsage | undefined): HelixUsage {
  if (!usage) {
    return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
  }
  const out: HelixUsage = {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    total_tokens: usage.total_tokens,
  };
  if (usage.input_tokens_details?.cached_tokens !== undefined) {
    out.input_tokens_details = {
      cached_tokens: usage.input_tokens_details.cached_tokens,
    };
  }
  if (usage.output_tokens_details?.reasoning_tokens !== undefined) {
    out.output_tokens_details = {
      reasoning_tokens: usage.output_tokens_details.reasoning_tokens,
    };
  }
  return out;
}
