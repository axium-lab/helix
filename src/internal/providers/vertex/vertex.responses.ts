import { GoogleGenAI } from '@google/genai';

import type { HelixConfigClean } from '../../../core/types/config.js';
import type { ResponsesCreateParams } from '../../../core/types/request.js';
import type { HelixResponse } from '../../../core/types/responses/llm.response.js';
import type { Helix } from '../../../createHelix.js';

import { mapVertexError } from './vertex.errors.js';
import {
  toGenerateContentParams,
  toHelixResponse,
} from './vertex.responses.mapper.js';

async function createResponse(
  client: GoogleGenAI,
  config: HelixConfigClean,
  params: ResponsesCreateParams,
): Promise<HelixResponse> {
  try {
    const vertexSDKParams = toGenerateContentParams(params);

    // Para generacion de streaming, se deberia usar client.models.generateContentStream()
    const raw = await client.models.generateContent(vertexSDKParams);
    return toHelixResponse(raw, config);
  } catch (err) {
    throw mapVertexError(err);
  }
}

export function responsesHandler(
  client: GoogleGenAI,
  config: HelixConfigClean,
): Helix['responses'] {
  return {
    create: (params) => createResponse(client, config, params),
  };
}
