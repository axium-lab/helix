import type OpenAI from "openai";
import type { Helix } from "../../../createHelix.js";
import type { HelixResponse } from "../../../core/types/responses/llm.response.js";
import type { ResponsesCreateParams } from "../../../core/types/request.js";
import { toHelixResponse, toOpenAIParams } from "../_shared/openai-shape.mappers.js";

async function createResponse(
  client: OpenAI,
  params: ResponsesCreateParams,
): Promise<HelixResponse> {
  const raw = await client.responses.create(toOpenAIParams(params));
  return toHelixResponse(raw);
}

export function responsesHandler(client: OpenAI): Helix["responses"] {
  return {
    create: (params) => createResponse(client, params),
  };
}
