import type { HelixConfig, HelixProviderKind } from './core/index.js';
import type { ResponsesCreateParams } from './core/types/request.js';
import type { HelixResponse } from './core/types/responses/llm.response.js';
import type {
  FilesCreateParams,
  FileObject,
} from './core/types/responses/file.response.js';
import type { ModelInfo } from './core/types/models.js';
import type { HelixError } from './core/errors/helix-error.js';

import { createOpenAIAdapter } from './internal/providers/openai/openai.js';
import { createAzureAdapter } from './internal/providers/azure/azure.js';
import { createGoogleAiStudioAdapter } from './internal/providers/google-aistudio/google-aistudio.js';
import { mapOpenAIError } from './internal/providers/openai/openai.errors.js';
import { mapAzureError } from './internal/providers/azure/azure.errors.js';
import { mapGoogleAiStudioError } from './internal/providers/google-aistudio/google-aistudio.errors.js';
import { wrapError } from './internal/providers/_shared/wrap-error.js';

export interface Helix {
  responses: {
    create(params: ResponsesCreateParams): Promise<HelixResponse>;
  };
  files: {
    create(params: FilesCreateParams): Promise<FileObject>;
    get(id: string): Promise<FileObject>;
    list(): Promise<FileObject[]>;
    delete(id: string): Promise<{ id: string; deleted: true }>;
  };
  models: {
    list(): Promise<ModelInfo[]>;
  };
  test: {
    connection(): Promise<boolean>;
  };
}

const errorMappers = {
  openai: mapOpenAIError,
  azure: mapAzureError,
  'google-aistudio': mapGoogleAiStudioError,
} as const satisfies Record<HelixProviderKind, (err: unknown) => HelixError>;

export function createHelix(config: HelixConfig): Helix {
  const mapError = errorMappers[config.provider];

  try {
    const adapter = buildAdapter(config);
    return {
      responses: wrapError(adapter.responses, mapError),
      files: wrapError(adapter.files, mapError),
      models: wrapError(adapter.models, mapError),
      test: wrapError(adapter.test, mapError),
    };
  } catch (err) {
    throw mapError(err);
  }
}

function buildAdapter(config: HelixConfig): Helix {
  switch (config.provider) {
    case 'openai':
      return createOpenAIAdapter(config);
    case 'azure':
      return createAzureAdapter(config);
    case 'google-aistudio':
      return createGoogleAiStudioAdapter(config);
  }
}
