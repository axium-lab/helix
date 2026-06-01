import { Storage } from '@google-cloud/storage';
import { GoogleGenAI } from '@google/genai';

import { HelixConfig } from '../../../core/index.js';
import { Helix } from '../../../createHelix.js';
import { sanitizeProviderConfig } from '../_shared/config.helpers.js';
import { filesHandler } from './files/vertex.files.js';
import { parseBucketUri } from './files/vertex.gcs.js';
import { handleModels } from './vertex.models.js';
import { responsesHandler } from './responses/vertex.responses.js';

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

  const storage = config.bucketUri
    ? new Storage({ credentials: config.credentials })
    : undefined;

  const gcsLocation = config.bucketUri
    ? parseBucketUri(config.bucketUri)
    : undefined;

  const configClean = sanitizeProviderConfig(config);

  return {
    responses: responsesHandler(client, configClean, storage, gcsLocation),
    files: filesHandler(storage, gcsLocation),
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
