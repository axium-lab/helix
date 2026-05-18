import {
  HelixResponse,
  ResponsesCreateParams,
} from '../../../../core/index.js';
import { Helix } from '../../../../createHelix.js';
import {
  GoogleAiStudioClient,
  googleAiStudioFetch,
} from '../google-aistudio.fetch.js';
import { mapGoogleError } from '../google-aistudio.errors.js';
import type { GeminiGenerateContentResponse } from './google-aistudio.responses.types.js';
import {
  toGoogleBody,
  toHelixResponse,
} from './google-aistudio.responses.mapper.js';

async function createResponse(
  client: GoogleAiStudioClient,
  params: ResponsesCreateParams,
  provider: 'google-aistudio',
): Promise<HelixResponse> {
  try {
    const body = await toGoogleBody(client, params);

    const raw = await googleAiStudioFetch<GeminiGenerateContentResponse>(
      client,
      'POST',
      `/models/${encodeURIComponent(params.model)}:generateContent`,
      body,
    );

    return toHelixResponse(raw, provider);
  } catch (err) {
    throw mapGoogleError(err);
  }
}

export function responsesHandler(
  client: GoogleAiStudioClient,
  provider: 'google-aistudio',
): Helix['responses'] {
  return {
    create: (params) => createResponse(client, params, provider),
  };
}
