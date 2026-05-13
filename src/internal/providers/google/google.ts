import type { HelixConfig } from '../../../core/types/config.js';
import type { Helix } from '../../../createHelix.js';
import { modelsHandler } from './models/models.js';
import type { GoogleClient } from './google.fetch.js';
import { responsesHandler } from './responses/google.responses.js';
import { filesHandler } from './files/google.files.js';

type GoogleConfig = Extract<HelixConfig, { provider: 'google' }>;

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export function createGoogleAdapter(config: GoogleConfig): Helix {
  const client: GoogleClient = {
    apiKey: config.apiKey,
    baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
  };

  return {
    responses: responsesHandler(client),
    files: filesHandler(client),
    models: modelsHandler(client),
    test: () =>
      modelsHandler(client)
        .list()
        .then(() => true)
        .catch(() => false),
  };
}
