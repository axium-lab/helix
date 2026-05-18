import { AzureOpenAI } from 'openai';
import { Helix } from '../../../createHelix.js';
import { toHelixResponse, toOpenAIParams } from '../_shared/openai.mapper.js';
import { mapAzureError } from './azure.errors.js';

export function handleResponse(
  client: AzureOpenAI,
  provider: 'azure',
): Helix['responses'] {
  return {
    create: async (params) => {
      try {
        const raw = await client.responses.create(toOpenAIParams(params));
        return toHelixResponse(raw, provider);
      } catch (err) {
        throw mapAzureError(err);
      }
    },
  };
}
