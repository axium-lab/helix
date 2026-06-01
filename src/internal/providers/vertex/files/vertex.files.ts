import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';

import { HelixError, HelixObject } from '../../../../core/index.js';
import type {
  FileObject,
  FilesCreateParams,
  HelixFilePurpose,
} from '../../../../core/types/responses/file.response.js';
import type { Helix } from '../../../../createHelix.js';
import { buildGsUri, parseGsUri } from './vertex.gcs.js';
import type { GcsLocation } from './vertex.gcs.js';

const SIZE_RESUMABLE_THRESHOLD = 5 * 1024 * 1024;

type GcsFileMetadata = {
  size?: string | number;
  contentType?: string;
  timeCreated?: string;
  metadata?: Record<string, unknown>;
};

// Single source of truth for GCS metadata -> FileObject mapping.
function toFileObject(
  meta: GcsFileMetadata,
  gsUri: string,
  fallbackName: string,
  purpose?: HelixFilePurpose,
): FileObject {
  return {
    id: gsUri,
    object: HelixObject.File,
    bytes: Number(meta.size),
    filename:
      (meta.metadata?.displayName as string | undefined) ?? fallbackName,
    mime_type: meta.contentType,
    created_at: Math.floor(
      new Date(meta.timeCreated as string).getTime() / 1000,
    ),
    status: 'ready',
    purpose,
    uri: gsUri,
  };
}

async function createFile(
  storage: Storage,
  location: GcsLocation,
  params: FilesCreateParams,
): Promise<FileObject> {
  const { file } = params;
  // `File` carries its own `.name`, but `Blob` doesn't. Prefer the explicit
  // `filename`; fall back to `file.name` only when it's a `File`.
  const displayName =
    params.filename ?? (file instanceof File ? file.name : undefined);

  const extension =
    displayName && displayName.includes('.')
      ? displayName.slice(displayName.lastIndexOf('.'))
      : '';

  const objectName = `${location.prefix}${randomUUID()}${extension}`;

  const mimeType = file.type || 'application/octet-stream';

  const buffer = Buffer.from(await file.arrayBuffer());

  const gcsFile = storage.bucket(location.bucket).file(objectName);

  await gcsFile.save(buffer, {
    metadata: {
      contentType: mimeType,
      metadata: { displayName: displayName ?? objectName },
    },
    resumable: buffer.byteLength > SIZE_RESUMABLE_THRESHOLD,
  });

  const [meta] = await gcsFile.getMetadata();
  const gsUri = buildGsUri(location.bucket, objectName);

  return toFileObject(meta, gsUri, displayName ?? objectName, params.purpose);
}

async function getFile(storage: Storage, id: string): Promise<FileObject> {
  const { bucket, object } = parseGsUri(id);
  const [meta] = await storage.bucket(bucket).file(object).getMetadata();

  return toFileObject(meta, id, object);
}

async function listFiles(
  storage: Storage,
  location: GcsLocation,
): Promise<FileObject[]> {
  const [files] = await storage
    .bucket(location.bucket)
    .getFiles({ prefix: location.prefix || undefined });

  return files.map((f) =>
    toFileObject(f.metadata, buildGsUri(location.bucket, f.name), f.name),
  );
}

async function deleteFile(
  storage: Storage,
  id: string,
): Promise<{ id: string; deleted: true }> {
  const { bucket, object } = parseGsUri(id);
  await storage.bucket(bucket).file(object).delete();
  return { id, deleted: true };
}

function requireBucket(
  storage?: Storage,
  location?: GcsLocation,
): { storage: Storage; location: GcsLocation } {
  if (!storage || !location) {
    throw new HelixError({
      category: 'invalid_request',
      provider: 'vertex',
      message:
        'helix-lib: files.* requires bucketUri to be set in HelixConfig.vertex',
    });
  }
  return { storage, location };
}

export function filesHandler(
  maybeStorage?: Storage,
  maybeLocation?: GcsLocation,
): Helix['files'] {
  return {
    create: (params) => {
      const { storage, location } = requireBucket(maybeStorage, maybeLocation);
      return createFile(storage, location, params);
    },
    get: (id) => {
      const { storage } = requireBucket(maybeStorage, maybeLocation);
      return getFile(storage, id);
    },
    list: () => {
      const { storage, location } = requireBucket(maybeStorage, maybeLocation);
      return listFiles(storage, location);
    },
    delete: (id) => {
      const { storage } = requireBucket(maybeStorage, maybeLocation);
      return deleteFile(storage, id);
    },
  };
}
