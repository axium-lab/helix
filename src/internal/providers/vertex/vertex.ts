import { GoogleGenAI } from '@google/genai';
import { HelixConfig } from '../../../core/index.js';
import { Helix } from '../../../createHelix.js';
import { handleModels } from './vertex.models.js';
import { responsesHandler } from './vertex.responses.js';
import { sanitizeProviderConfig } from '../_shared/config.helpers.js';

type VertexConfig = Extract<HelixConfig, { provider: 'vertex' }>;

export function createVertexAdapter(config: VertexConfig): Helix {
  const client = new GoogleGenAI({
    vertexai: true,
    project: config.projectId,
    location: config.location,
    googleAuthOptions: {
      credentials: config.credentials,
    },
  });

  const configClean = sanitizeProviderConfig(config);

  return {
    responses: responsesHandler(client, configClean),
    files: {
      create: async () => {
        throw new Error('Vertex provider is not yet supported');
      },
      get: async () => {
        throw new Error('Vertex provider is not yet supported');
      },
      list: async () => {
        throw new Error('Vertex provider is not yet supported');
      },
      delete: async () => {
        throw new Error('Vertex provider is not yet supported');
      },
    },
    models: {
      list: handleModels(client).list,
    },
    test: {
      connection: () =>
        client.models
          .list()
          .then(() => true)
          .catch(() => false),
    },
  };
}
