import {
  HelixResponse,
  ResponsesCreateParams,
} from '../../../../core/index.js';
import { Helix } from '../../../../createHelix.js';
import {
  GoogleAiStudioClient,
  googleAiStudioFetch,
} from '../google-aistudio.fetch.js';
import { mapGoogleAiStudioError } from '../google-aistudio.errors.js';
import type { GeminiGenerateContentResponse } from './google-aistudio.responses.types.js';
import type { HelixConfigClean } from '../../../../core/types/config.js';

import {
  toGoogleBody,
  toHelixResponse,
} from './google-aistudio.responses.mapper.js';

async function createResponse(
  client: GoogleAiStudioClient,
  config: HelixConfigClean,
  params: ResponsesCreateParams,
): Promise<HelixResponse> {
  try {
    const body = await toGoogleBody(client, params);

    const raw = await googleAiStudioFetch<GeminiGenerateContentResponse>(
      client,
      'POST',
      `/models/${encodeURIComponent(params.model)}:generateContent`,
      body,
    );

    return toHelixResponse(raw, config);
  } catch (err) {
    throw mapGoogleAiStudioError(err);
  }
}

export function responsesHandler(
  client: GoogleAiStudioClient,
  config: HelixConfigClean,
): Helix['responses'] {
  return {
    create: (params) => createResponse(client, config, params),
  };
}
