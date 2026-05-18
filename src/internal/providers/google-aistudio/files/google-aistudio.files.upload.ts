import { GoogleAiStudioClient } from '../google-aistudio.fetch.js';
import {
  mapGoogleAiStudioHttpError,
  mapGoogleAiStudioNetworkError,
} from '../google-aistudio.errors.js';
import type {
  GeminiFile,
  GeminiFileWrapper,
} from './google-aistudio.files.types.js';

// Docu para subir archivos de Gemini:
// https://ai.google.dev/api/files?hl=es-419
const UPLOAD_PATH = '/upload/v1beta/files';

export interface GoogleUploadParams {
  file: File | Blob;
  displayName?: string;
  mimeType: string;
  bytes: number;
}

export async function googleUpload(
  client: GoogleAiStudioClient,
  params: GoogleUploadParams,
): Promise<GeminiFile> {
  // Mandamos los metadatos (nombre, tamaño, mime type), Google te devuelve una URL temporal
  // a esa URL temporal le haces un POST con el archivo, y te devuelve el objeto GeminiFile creado.
  const uploadUrl = await startResumableUpload(client, params);

  // luego subimos el archivo a la URL temporal, y obtenemos el GeminiFile creado.
  return finalizeUpload(uploadUrl, params);
}

async function startResumableUpload(
  client: GoogleAiStudioClient,
  params: GoogleUploadParams,
): Promise<string> {
  const origin = new URL(client.baseUrl).origin;

  const url = `${origin}${UPLOAD_PATH}`;

  const body = params.displayName
    ? { file: { display_name: params.displayName } }
    : { file: {} };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': client.apiKey,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(params.bytes),
        'X-Goog-Upload-Header-Content-Type': params.mimeType,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw mapGoogleAiStudioNetworkError(err);
  }

  if (!res.ok) {
    throw mapGoogleAiStudioHttpError(res, await readErrorBody(res));
  }

  const uploadUrl = res.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error(
      'helix-lib: google files.create — missing X-Goog-Upload-URL header in resumable start response',
    );
  }
  return uploadUrl;
}

async function finalizeUpload(
  uploadUrl: string,
  params: GoogleUploadParams,
): Promise<GeminiFile> {
  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': String(params.bytes),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: params.file,
    });
  } catch (err) {
    throw mapGoogleAiStudioNetworkError(err);
  }

  if (!res.ok) {
    throw mapGoogleAiStudioHttpError(res, await readErrorBody(res));
  }

  const wrapper = (await res.json()) as GeminiFileWrapper;
  return wrapper.file;
}

async function readErrorBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '');
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
