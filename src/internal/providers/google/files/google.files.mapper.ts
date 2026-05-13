import type {
  FileObject,
  HelixFileStatus,
} from '../../../../core/types/responses/file.response.js';
import { HelixObject } from '../../../../core/types/helix-object.js';
import type { GeminiFile, GeminiFileState } from './google.files.types.js';

export function toHelixFileObject(f: GeminiFile): FileObject {
  const out: FileObject = {
    id: f.name,
    object: HelixObject.File,
    filename: f.displayName,
    bytes: Number(f.sizeBytes),
    mime_type: f.mimeType,
    created_at: toUnixSeconds(f.createTime),
    status: toHelixFileStatus(f.state),
    uri: f.uri,
  };

  if (f.displayName) out.filename = f.displayName;
  if (f.expirationTime) out.expires_at = toUnixSeconds(f.expirationTime);
  if (f.state === 'FAILED' && f.error?.message) {
    out.status_details = f.error.message;
  }
  return out;
}

function toHelixFileStatus(state: GeminiFileState): HelixFileStatus {
  switch (state) {
    case 'ACTIVE':
      return 'ready';
    case 'FAILED':
      return 'failed';
    case 'PROCESSING':
    case 'STATE_UNSPECIFIED':
      return 'processing';
  }
}
// Parse to Helix created_at and expires_at from ISO 8601 to unix seconds.
function toUnixSeconds(iso: string): number {
  return Math.floor(Date.parse(iso) / 1000);
}

// Normaliza el id que recibe el adapter: si viene sin prefijo "files/", lo agrega.
// Defensivo porque Gemini exige siempre el name completo en los endpoints.
export function normalizeFileName(id: string): string {
  return id.startsWith('files/') ? id : `files/${id}`;
}
