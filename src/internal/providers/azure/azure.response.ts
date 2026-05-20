import { AzureOpenAI } from 'openai';
import { Helix } from '../../../createHelix.js';
import { toHelixResponse, toOpenAIParams } from '../_shared/openai.mapper.js';
import { mapAzureError } from './azure.errors.js';
import type { HelixConfigClean } from '../../../core/types/config.js';

export function handleResponse(
  client: AzureOpenAI,
  config: HelixConfigClean,
): Helix['responses'] {
  return {
    create: async (params) => {
      try {
        const raw = await client.responses.create(toOpenAIParams(params));
        return toHelixResponse(raw, config);
      } catch (err) {
        throw mapAzureError(err);
      }
    },
  };
}
