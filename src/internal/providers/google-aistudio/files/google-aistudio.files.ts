import type { Helix } from '../../../../createHelix.js';
import type {
  FileObject,
  FilesCreateParams,
} from '../../../../core/types/responses/file.response.js';

import {
  normalizeFileName,
  toHelixFileObject,
} from './google-aistudio.files.mapper.js';
import type {
  GeminiFile,
  GeminiListFilesResponse,
} from './google-aistudio.files.types.js';
import { googleUpload } from './google-aistudio.files.upload.js';
import {
  GoogleAiStudioClient,
  googleAiStudioFetch,
} from '../google-aistudio.fetch.js';
import { mapGoogleAiStudioError } from '../google-aistudio.errors.js';

async function createFile(
  client: GoogleAiStudioClient,
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
    throw mapGoogleAiStudioError(err);
  }
}

export async function fetchGeminiFile(
  client: GoogleAiStudioClient,
  id: string,
): Promise<GeminiFile> {
  return googleAiStudioFetch<GeminiFile>(
    client,
    'GET',
    `/${normalizeFileName(id)}`,
  );
}

async function getFile(
  client: GoogleAiStudioClient,
  id: string,
): Promise<FileObject> {
  try {
    const raw = await fetchGeminiFile(client, id);
    return toHelixFileObject(raw);
  } catch (err) {
    throw mapGoogleAiStudioError(err);
  }
}

async function listFiles(client: GoogleAiStudioClient): Promise<FileObject[]> {
  try {
    const raw = await googleAiStudioFetch<GeminiListFilesResponse>(
      client,
      'GET',
      '/files',
    );
    return (raw.files ?? []).map(toHelixFileObject);
  } catch (err) {
    throw mapGoogleAiStudioError(err);
  }
}

async function deleteFile(
  client: GoogleAiStudioClient,
  id: string,
): Promise<{ id: string; deleted: true }> {
  try {
    await googleAiStudioFetch<void>(
      client,
      'DELETE',
      `/${normalizeFileName(id)}`,
    );
    return { id, deleted: true as const };
  } catch (err) {
    throw mapGoogleAiStudioError(err);
  }
}

export function filesHandler(client: GoogleAiStudioClient): Helix['files'] {
  return {
    create: (params) => createFile(client, params),
    get: (id) => getFile(client, id),
    list: () => listFiles(client),
    delete: (id) => deleteFile(client, id),
  };
}
