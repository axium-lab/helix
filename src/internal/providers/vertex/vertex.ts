import { Storage } from '@google-cloud/storage';
import { GoogleGenAI } from '@google/genai';

import { HelixConfig } from '../../../core/index.js';
import { HelixError } from '../../../core/errors/helix-error.js';
import { Helix } from '../../../createHelix.js';
import { sanitizeProviderConfig } from '../_shared/config.helpers.js';
import { filesHandler, type GcsLocation } from './vertex.files.js';
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

  // Storage para manejo de archivos (si bucketUri está presente)
  let storage: Storage | null = null;
  let loc: GcsLocation | null = null;

  if (config.bucketUri) {
    storage = new Storage({
      projectId: config.projectId,
      credentials: {
        client_email: config.credentials.client_email,
        private_key: config.credentials.private_key,
      },
    });
  }

  const configClean = sanitizeProviderConfig(config);

  return {
    responses: responsesHandler(client, configClean),
    files: filesHandler(storage, loc),
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
