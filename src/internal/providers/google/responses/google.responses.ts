import {
  HelixResponse,
  ResponsesCreateParams,
} from '../../../../core/index.js';
import { Helix } from '../../../../createHelix.js';
import { GoogleClient, googleFetch } from '../google.fetch.js';
import { mapGoogleError } from '../google.errors.js';
import type { GeminiGenerateContentResponse } from './google.responses.types.js';
import { toGoogleBody, toHelixResponse } from './google.responses.mapper.js';

async function createResponse(
  client: GoogleClient,
  params: ResponsesCreateParams,
  provider: 'google',
): Promise<HelixResponse> {
  try {
    const body = await toGoogleBody(client, params);

    const raw = await googleFetch<GeminiGenerateContentResponse>(
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
  client: GoogleClient,
  provider: 'google',
): Helix['responses'] {
  return {
    create: (params) => createResponse(client, params, provider),
  };
}
