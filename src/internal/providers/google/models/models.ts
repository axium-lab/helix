import type { Helix } from '../../../../createHelix.js';
import type { ModelInfo } from '../../../../core/types/models.js';
import { HelixObject } from '../../../../core/types/helix-object.js';
import { mapGoogleError } from '../google.errors.js';
import { googleFetch, type GoogleClient } from '../google.fetch.js';
import type { GeminiModelsResponse } from './models.types.js';

async function listModels(client: GoogleClient): Promise<ModelInfo[]> {
  try {
    const page = await googleFetch<GeminiModelsResponse>(
      client,
      'GET',
      `/models`,
    );

    return (page.models ?? []).map((m) => ({
      id: m.name.replace(/^models\//, ''),
      object: HelixObject.Model,
      created: 0,
      display_name: m.displayName,
      owned_by: 'google',
    }));
  } catch (err) {
    throw mapGoogleError(err);
  }
}

export function modelsHandler(client: GoogleClient): Helix['models'] {
  return {
    list: () => listModels(client),
  };
}
