import { AzureOpenAI } from 'openai';
import type { HelixConfig } from '../../../core/types/config.js';
import type { Helix } from '../../../createHelix.js';

import { handleResponse } from './azure.response.js';
import { handleModels } from './azure.models.js';
import { handleFiles } from './azure.files.js';

type AzureConfig = Extract<HelixConfig, { provider: 'azure' }>;

export function createAzureAdapter(config: AzureConfig): Helix {
  const client = new AzureOpenAI({
    apiKey: config.apiKey,
    endpoint: config.baseUrl,
    apiVersion: config.apiVersion,
  });

  const models = handleModels(config);

  return {
    responses: handleResponse(client, config.provider),
    files: handleFiles(client),
    models,
    async test() {
      try {
        await models.list();
        return true;
      } catch {
        return false;
      }
    },
  };
}
