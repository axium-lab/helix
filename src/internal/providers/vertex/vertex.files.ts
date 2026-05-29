import { HelixError } from '../../../core/index.js';
import type {
  FileObject,
  FilesCreateParams,
} from '../../../core/types/responses/file.response.js';
import type { Helix } from '../../../createHelix.js';

async function createFile(params: FilesCreateParams): Promise<FileObject> {
  throw new HelixError({
    category: 'unknown',
    provider: 'vertex',
    message: `helix-lib: create file is not implemented for Vertex AI provider.`,
  });
}

async function getFile(id: string): Promise<FileObject> {
  throw new HelixError({
    category: 'unknown',
    provider: 'vertex',
    message: `helix-lib: get file is not implemented for Vertex AI provider.`,
  });
}

async function listFiles(): Promise<FileObject[]> {
  throw new HelixError({
    category: 'unknown',
    provider: 'vertex',
    message: `helix-lib: list files is not implemented for Vertex AI provider.`,
  });
}

async function deleteFile(id: string): Promise<{ id: string; deleted: true }> {
  throw new HelixError({
    category: 'unknown',
    provider: 'vertex',
    message: `helix-lib: delete file is not implemented for Vertex AI provider.`,
  });
}

export function filesHandler(): Helix['files'] {
  return {
    create: (params) => createFile(params),
    get: (id) => getFile(id),
    list: () => listFiles(),
    delete: (id) => deleteFile(id),
  };
}
