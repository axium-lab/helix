import type { HelixConfig } from '../../../core/types/config.js';
import type { Helix } from '../../../createHelix.js';
import { modelsHandler } from './models/google-aistudio.models.js';
import type { GoogleAiStudioClient } from './google-aistudio.fetch.js';
import { responsesHandler } from './responses/google-aistudio.responses.js';

type GoogleConfig = Extract<HelixConfig, { provider: 'google-aistudio' }>;

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export function createGoogleAiStudioAdapter(config: GoogleConfig): Helix {
  const client: GoogleAiStudioClient = {
    apiKey: config.apiKey,
    baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
  };

  // TODO
  const FAKE_ERROR = () => {
    throw new Error('Not implemented yet.');
  };

  return {
    responses: responsesHandler(client),
    files: {
      create: FAKE_ERROR,
      list: FAKE_ERROR,
      delete: FAKE_ERROR,
    },
    models: modelsHandler(client),
    test: () =>
      modelsHandler(client)
        .list()
        .then(() => true)
        .catch(() => false),
  };
}
