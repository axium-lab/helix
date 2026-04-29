import type OpenAI from "openai";
import type { Helix } from "../../../createHelix.js";
import type { HelixResponse } from "../../../core/types/responses/llm.response.js";
import type { ResponsesCreateParams } from "../../../core/types/request.js";

async function createResponse(client: OpenAI, params: ResponsesCreateParams): Promise<HelixResponse> {
  return client.responses.create(
    params as Parameters<typeof client.responses.create>[0],
  ) as unknown as HelixResponse;
}

export function responsesHandler(client: OpenAI): Helix["responses"] {
  return {
    create: (params) => createResponse(client, params),
  };
}
