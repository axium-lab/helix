import type { HelixConfig } from "./core/index.js";
import type { ResponsesCreateParams } from "./core/types/request.js";
import type { HelixResponse } from "./core/types/responses/llm.response.js";
import type { FilesCreateParams, FileObject } from "./core/types/responses/file.response.js";
import type { ModelInfo } from "./core/types/models.js";

import { createOpenAIAdapter } from "./internal/providers/openai/openai.js";
import { createAzureAdapter } from "./internal/providers/azure/azure.js";
import { createCustomAdapter } from "./internal/providers/custom/custom.js";
import { createGoogleAdapter } from "./internal/providers/google/google.js";

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
  test(): Promise<boolean>;
}

export function createHelix(config: HelixConfig): Helix {
  switch (config.provider) {
    case "openai":
      return createOpenAIAdapter(config);
    case "azure":
      return createAzureAdapter(config);
    case "custom":
      return createCustomAdapter(config);
    case "google":
      return createGoogleAdapter(config);
  }
}
