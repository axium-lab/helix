import type {
  Response as OpenAIResponse,
  ResponseCreateParamsNonStreaming,
  ResponseInput,
  ResponseOutputMessage,
  ResponseOutputText,
} from "openai/resources/responses/responses";

import type { HelixResponse } from "../../../core/types/responses/llm.response.js";
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

export function toHelixResponse(r: OpenAIResponse): HelixResponse {
  return {
    id: r.id,
    object: HelixObject.Response,
    created_at: r.created_at,
    model: String(r.model),
    output: r.output
      .filter((item): item is ResponseOutputMessage => item.type === "message")
      .map((m) => ({
        type: "message",
        id: m.id,
        role: m.role,
        content: m.content
          .filter((c): c is ResponseOutputText => c.type === "output_text")
          .map((c) => ({ type: "output_text", text: c.text })),
        status: m.status,
      })),
    output_text: r.output_text,
    usage: {
      input_tokens: r.usage?.input_tokens ?? 0,
      output_tokens: r.usage?.output_tokens ?? 0,
      total_tokens: r.usage?.total_tokens ?? 0,
    },
  };
}
