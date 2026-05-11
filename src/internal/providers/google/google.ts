import type { HelixConfig } from '../../../core/types/config.js';
import type { Helix } from '../../../createHelix.js';
import { modelsHandler } from './models/models.js';
import type { GoogleClient } from './google.fetch.js';

type GoogleConfig = Extract<HelixConfig, { provider: 'google' }>;

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export function createGoogleAdapter(config: GoogleConfig): Helix {
  const client: GoogleClient = {
    apiKey: config.apiKey,
    baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
  };

  // TODO
  const FAKE_ERROR = () => {
    throw new Error('Not implemented yet.');
  };

  return {
    responses: {
      create: FAKE_ERROR,
    },
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
