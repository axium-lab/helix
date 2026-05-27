import { GoogleGenAI } from '@google/genai';
import { HelixObject, ModelInfo } from '../../../core/index.js';
import { Helix } from '../../../createHelix.js';
import { mapVertexError } from './vertex.errors.js';

async function list(client: GoogleGenAI): Promise<ModelInfo[]> {
  try {
    const models = await client.models.list();

    const items: ModelInfo[] = [];
    for await (const m of models) {
      const rawName = m.name ?? '';
      const id = rawName.replace(/^publishers\/google\/models\//, '');
      items.push({
        id,
        object: HelixObject.Model,
        created: 0,
        display_name: m.displayName,
        owned_by: 'vertex',
      });
    }
    return items;
  } catch (err) {
    throw mapVertexError(err);
  }
}

export function handleModels(client: GoogleGenAI): Helix['models'] {
  return {
    list: () => list(client),
  };
}
