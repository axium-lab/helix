import type OpenAI from "openai";
import type { Helix } from "../../../createHelix.js";
import type { HelixResponse } from "../../../core/types/responses/llm.response.js";
import type { HelixProviderKind } from "../../../core/types/config.js";
import type { ResponsesCreateParams } from "../../../core/types/request.js";
import { toHelixResponse, toOpenAIParams } from "../_shared/openai.mapper.js";
import { mapOpenAIError } from "./openai.errors.js";

async function createResponse(
  client: OpenAI,
  provider: HelixProviderKind,
  params: ResponsesCreateParams,
): Promise<HelixResponse> {
  try {
    const raw = await client.responses.create(toOpenAIParams(params));
    return toHelixResponse(raw, provider);
  } catch (err) {
    throw mapOpenAIError(err);
  }
}

export function responsesHandler(client: OpenAI, provider: HelixProviderKind): Helix["responses"] {
  return {
    create: (params) => createResponse(client, provider, params),
  };
}
