import { randomUUID } from 'node:crypto';
import type {
  FileMetadata,
  File as GcsFile,
  Storage,
} from '@google-cloud/storage';

import { HelixError } from '../../../core/index.js';
import { HelixObject } from '../../../core/types/helix-object.js';
import type {
  FileObject,
  FilesCreateParams,
} from '../../../core/types/responses/file.response.js';
import type { Helix } from '../../../createHelix.js';

import { mapVertexError } from './vertex.errors.js';

export interface GcsLocation {
  bucket: string;
  prefix: string;
}

export function parseGsUri(id: string): {
  bucket: string;
  objectName: string;
} {
  if (!id.startsWith('gs://')) {
    throw new HelixError({
      category: 'invalid_request',
      provider: 'vertex',
      message: `helix-lib: invalid file id "${id}" — must be a "gs://" URI.`,
    });
  }
  const rest = id.slice('gs://'.length);
  const slash = rest.indexOf('/');
  if (slash === -1 || slash === rest.length - 1) {
    throw new HelixError({
      category: 'invalid_request',
      provider: 'vertex',
      message: `helix-lib: invalid file id "${id}" — missing object name.`,
    });
  }
  return { bucket: rest.slice(0, slash), objectName: rest.slice(slash + 1) };
}

async function createFile(
  storage: Storage,
  loc: GcsLocation,
  params: FilesCreateParams,
): Promise<FileObject> {
  const displayName =
    params.filename ?? (params.file as File).name ?? undefined;

  const mimeType = params.file.type || 'application/octet-stream';

  const objectName = `${loc.prefix}${randomUUID()}`;

  const uri = `gs://${loc.bucket}/${objectName}`;

  try {
    const buffer = Buffer.from(await params.file.arrayBuffer());
    const gcsFile = storage.bucket(loc.bucket).file(objectName);
    await gcsFile.save(buffer, {
      contentType: mimeType,
      metadata: displayName ? { metadata: { displayName } } : undefined,
      resumable: buffer.length > 5 * 1024 * 1024,
    });

    return {
      id: uri,
      object: HelixObject.File,
      bytes: buffer.length,
      filename: displayName,
      mime_type: mimeType,
      created_at: Math.floor(Date.now() / 1000),
      status: 'ready',
      purpose: params.purpose,
      uri,
    };
  } catch (err) {
    throw mapVertexError(err);
  }
}

async function getFile(storage: Storage, id: string): Promise<FileObject> {
  const { bucket, objectName } = parseGsUri(id);
  try {
    const gcsFile = storage.bucket(bucket).file(objectName);
    const [metadata] = await gcsFile.getMetadata();
    return fromGcsMetadata(gcsFile, metadata);
  } catch (err) {
    throw mapVertexError(err);
  }
}

async function listFiles(
  storage: Storage,
  loc: GcsLocation,
): Promise<FileObject[]> {
  try {
    const [files] = await storage
      .bucket(loc.bucket)
      .getFiles({ prefix: loc.prefix });
    return files.map((f) => fromGcsMetadata(f, f.metadata));
  } catch (err) {
    throw mapVertexError(err);
  }
}

async function deleteFile(
  storage: Storage,
  id: string,
): Promise<{ id: string; deleted: true }> {
  const { bucket, objectName } = parseGsUri(id);
  try {
    await storage.bucket(bucket).file(objectName).delete();
    return { id, deleted: true as const };
  } catch (err) {
    throw mapVertexError(err);
  }
}

function fromGcsMetadata(gcsFile: GcsFile, metadata: FileMetadata): FileObject {
  const uri = `gs://${gcsFile.bucket.name}/${gcsFile.name}`;
  const createdAtIso = metadata.timeCreated;
  const created_at = createdAtIso
    ? Math.floor(new Date(createdAtIso).getTime() / 1000)
    : Math.floor(Date.now() / 1000);
  const displayNameRaw = metadata.metadata?.displayName;
  const filename =
    typeof displayNameRaw === 'string' ? displayNameRaw : undefined;
  return {
    id: uri,
    object: HelixObject.File,
    bytes: Number(metadata.size ?? 0),
    filename,
    mime_type: metadata.contentType ?? 'application/octet-stream',
    created_at,
    status: 'ready',
    uri,
  };
}

export function filesHandler(
  storage: Storage | null,
  loc: GcsLocation | null,
): Helix['files'] {
  // TODO: Descomentar cuando tengamos el storage funcionando si lo hacemos mediante bucket
  // if (!storage || !loc) {
  //   throw new HelixError({
  //     category: 'invalid_request',
  //     provider: 'vertex',
  //     message: `helix-lib: Files API is not configured — missing "bucketUri" in config.`,
  //   });
  // }

  // TODO: quitar ! cuando tengamos el storage funcionando
  return {
    create: (params) => createFile(storage!, loc!, params),
    get: (id) => getFile(storage!, id),
    list: () => listFiles(storage!, loc!),
    delete: (id) => deleteFile(storage!, id),
  };
}
