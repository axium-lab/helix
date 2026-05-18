import {
  HelixProviderKind,
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
import {
  toGoogleBody,
  toHelixResponse,
} from './google-aistudio.responses.mapper.js';

async function createResponse(
  client: GoogleAiStudioClient,
  provider: HelixProviderKind,
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

    return toHelixResponse(raw, provider);
  } catch (err) {
    throw mapGoogleAiStudioError(err);
  }
}

export function responsesHandler(
  client: GoogleAiStudioClient,
  provider: HelixProviderKind,
): Helix['responses'] {
  return {
    create: (params) => createResponse(client, provider, params),
  };
}
