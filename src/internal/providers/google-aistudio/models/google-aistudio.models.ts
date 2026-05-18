import type { Helix } from '../../../../createHelix.js';
import type { ModelInfo } from '../../../../core/types/models.js';
import { HelixObject } from '../../../../core/types/helix-object.js';
import { mapGoogleAiStudioError } from '../google-aistudio.errors.js';
import {
  googleAiStudioFetch,
  type GoogleAiStudioClient,
} from '../google-aistudio.fetch.js';
import type { GeminiModelsResponse } from './google-aistudio.models.types.js';

async function listModels(client: GoogleAiStudioClient): Promise<ModelInfo[]> {
  try {
    const page = await googleAiStudioFetch<GeminiModelsResponse>(
      client,
      'GET',
      `/models`,
    );

    return (page.models ?? []).map((m) => ({
      id: m.name.replace(/^models\//, ''),
      object: HelixObject.Model,
      created: 0,
      display_name: m.displayName,
      owned_by: 'google-aistudio',
    }));
  } catch (err) {
    throw mapGoogleAiStudioError(err);
  }
}

export function modelsHandler(client: GoogleAiStudioClient): Helix['models'] {
  return {
    list: () => listModels(client),
  };
}
