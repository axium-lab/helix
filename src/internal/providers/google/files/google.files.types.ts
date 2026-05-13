// Wire-level types para la Files API nativa de Gemini.
// Docu: https://ai.google.dev/api/files

export type GeminiFileState =
  | 'STATE_UNSPECIFIED'
  | 'PROCESSING'
  | 'ACTIVE'
  | 'FAILED';

export interface GeminiFileError {
  code?: number;
  message?: string;
  details?: unknown[];
}

export interface GeminiFile {
  // Identificador con prefijo: "files/abc123"
  name: string;
  displayName?: string;
  mimeType: string;
  // Gemini devuelve sizeBytes como string (int64 serializado)
  sizeBytes: string;
  createTime: string;
  updateTime?: string;
  expirationTime?: string;
  sha256Hash?: string;
  uri: string;
  state: GeminiFileState;
  error?: GeminiFileError;
}

export interface GeminiListFilesResponse {
  files?: GeminiFile[];
  nextPageToken?: string;
}

// Cuando Gemini empaqueta el archivo dentro de un wrapper "file" (algunas
// rutas como la respuesta del upload lo hacen).
export interface GeminiFileWrapper {
  file: GeminiFile;
}
