import { AzureOpenAI } from 'openai';
import type { HelixConfig } from '../../../core/types/config.js';
import type { Helix } from '../../../createHelix.js';

import { handleResponse } from './azure.response.js';
import { handleModels } from './azure.models.js';
import { handleFiles } from './azure.files.js';
import { sanitizeProviderConfig } from '../_shared/config.helpers.js';

type AzureConfig = Extract<HelixConfig, { provider: 'azure' }>;

export function createAzureAdapter(config: AzureConfig): Helix {
  const client = new AzureOpenAI({
    apiKey: config.apiKey,
    endpoint: config.baseUrl,
    apiVersion: config.apiVersion,
  });

  const models = handleModels(config);

  const configClean = sanitizeProviderConfig(config);
  
  return {
    responses: handleResponse(client, configClean),
    files: handleFiles(client),
    models,
    test: {
      async connection() {
        try {
          await models.list();
          return true;
        } catch {
          return false;
        }
      },
    },
  };
}
