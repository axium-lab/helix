import { GoogleGenAI } from '@google/genai';

import { HelixConfig } from '../../../core/index.js';
import { Helix } from '../../../createHelix.js';
import { sanitizeProviderConfig } from '../_shared/config.helpers.js';
import { filesHandler } from './vertex.files.js';
import { handleModels } from './vertex.models.js';
import { responsesHandler } from './vertex.responses.js';

type VertexConfig = Extract<HelixConfig, { provider: 'vertex' }>;

export function createVertexAdapter(config: VertexConfig): Helix {
  // Cliente Google GEN AI
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
    files: filesHandler(),
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
