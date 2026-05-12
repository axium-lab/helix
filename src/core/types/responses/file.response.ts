import { type HelixObject } from '../helix-object.js';

export type HelixFilePurpose =
  | 'assistants'
  | 'batch'
  | 'fine-tune'
  | 'vision'
  | 'user_data'
  | 'evals';

// Estado de un archivo,  somos capaces de evitar que un archivo en estado "processing"
// se mande a responses y nos de error, por lo que es necesario incluirlo para evitar errores de tipo.
export type HelixFileStatus = 'processing' | 'ready' | 'failed';

export interface FilesCreateParams {
  file: File | Blob;
  filename?: string;
  purpose?: HelixFilePurpose;
  expires_after?: { seconds: number };
}

export interface FileObject {
  id: string;
  object: typeof HelixObject.File;
  bytes: number;
  filename?: string;
  mime_type?: string;
  created_at: number;
  expires_at?: number;
  status: HelixFileStatus;
  status_details?: string;
  purpose?: HelixFilePurpose;
}
