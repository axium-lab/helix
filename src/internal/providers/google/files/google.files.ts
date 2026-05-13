import type { Helix } from '../../../../createHelix.js';
import type {
  FileObject,
  FilesCreateParams,
} from '../../../../core/types/responses/file.response.js';
import type { GoogleClient } from '../google.fetch.js';
import { googleFetch } from '../google.fetch.js';
import { mapGoogleError } from '../google.errors.js';
import { normalizeFileName, toHelixFileObject } from './google.files.mapper.js';
import type {
  GeminiFile,
  GeminiListFilesResponse,
} from './google.files.types.js';
import { googleUpload } from './google.files.upload.js';

async function createFile(
  client: GoogleClient,
  params: FilesCreateParams,
): Promise<FileObject> {
  // Gemini no soporta `purpose` ni `expires_after` (retención fija de 48 hs).
  // Los ignoramos silenciosamente — son hints opcionales del contrato Helix.
  const displayName = params.filename ?? (params.file as File).name;
  const mimeType = params.file.type || 'application/octet-stream';

  try {
    const uploaded = await googleUpload(client, {
      file: params.file,
      displayName,
      mimeType,
      bytes: params.file.size,
    });

    return toHelixFileObject(uploaded);
  } catch (err) {
    throw mapGoogleError(err);
  }
}

export async function fetchGeminiFile(
  client: GoogleClient,
  id: string,
): Promise<GeminiFile> {
  return googleFetch<GeminiFile>(client, 'GET', `/${normalizeFileName(id)}`);
}

async function getFile(client: GoogleClient, id: string): Promise<FileObject> {
  try {
    const raw = await fetchGeminiFile(client, id);
    return toHelixFileObject(raw);
  } catch (err) {
    throw mapGoogleError(err);
  }
}

async function listFiles(client: GoogleClient): Promise<FileObject[]> {
  try {
    const raw = await googleFetch<GeminiListFilesResponse>(
      client,
      'GET',
      '/files',
    );
    return (raw.files ?? []).map(toHelixFileObject);
  } catch (err) {
    throw mapGoogleError(err);
  }
}

async function deleteFile(
  client: GoogleClient,
  id: string,
): Promise<{ id: string; deleted: true }> {
  try {
    await googleFetch<void>(client, 'DELETE', `/${normalizeFileName(id)}`);
    return { id, deleted: true as const };
  } catch (err) {
    throw mapGoogleError(err);
  }
}

export function filesHandler(client: GoogleClient): Helix['files'] {
  return {
    create: (params) => createFile(client, params),
    get: (id) => getFile(client, id),
    list: () => listFiles(client),
    delete: (id) => deleteFile(client, id),
  };
}
