import { Storage } from '@google-cloud/storage';
import { GoogleGenAI } from '@google/genai';

import type { HelixConfigClean } from '../../../../core/types/config.js';
import type {
  InputContentPart,
  ResponsesCreateParams,
} from '../../../../core/types/request.js';
import type { HelixResponse } from '../../../../core/types/responses/llm.response.js';
import type { Helix } from '../../../../createHelix.js';
import type { GcsLocation } from './../files/vertex.gcs.js';
import { parseGsUri } from './../files/vertex.gcs.js';

import { mapVertexError } from './../vertex.errors.js';
import {
  toGenerateContentParams,
  toHelixResponse,
} from './vertex.responses.mapper.js';

async function fetchFileMimeTypes(
  storage: Storage,
  location: GcsLocation,
  params: ResponsesCreateParams,
): Promise<Map<string, string>> {
  const fileIds = new Set<string>();
  for (const msg of params.input) {
    for (const part of msg.content as InputContentPart[]) {
      if (part.type === 'input_file' && part.file_id) {
        fileIds.add(part.file_id);
      }
    }
  }

  if (fileIds.size === 0) return new Map();

  const entries = await Promise.all(
    [...fileIds].map(async (id) => {
      // A gs:// URI is self-describing (bucket + object); a bare id is treated
      // as an object in the configured bucket.
      const { bucket, object } = id.startsWith('gs://')
        ? parseGsUri(id)
        : { bucket: location.bucket, object: id };
      const [meta] = await storage.bucket(bucket).file(object).getMetadata();
      return [
        id,
        (meta.contentType as string) ?? 'application/octet-stream',
      ] as const;
    }),
  );

  return new Map(entries);
}

async function createResponse(
  client: GoogleGenAI,
  config: HelixConfigClean,
  params: ResponsesCreateParams,
  storage?: Storage,
  gcsLocation?: GcsLocation,
): Promise<HelixResponse> {
  try {
    const mimeMap =
      storage && gcsLocation
        ? await fetchFileMimeTypes(storage, gcsLocation, params)
        : new Map<string, string>();

    const vertexSDKParams = toGenerateContentParams(params, mimeMap);
    const raw = await client.models.generateContent(vertexSDKParams);
    return toHelixResponse(raw, config);
  } catch (err) {
    throw mapVertexError(err);
  }
}

export function responsesHandler(
  client: GoogleGenAI,
  config: HelixConfigClean,
  storage?: Storage,
  gcsLocation?: GcsLocation,
): Helix['responses'] {
  return {
    create: (params) =>
      createResponse(client, config, params, storage, gcsLocation),
  };
}
