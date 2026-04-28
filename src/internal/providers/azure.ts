import { AzureOpenAI } from "openai";
import type { HelixConfig } from "../../core/types/config.js";
import type { Helix } from "../../createHelix.js";
import type { HelixResponse } from "../../core/types/response.js";
import type { FileObject } from "../../core/types/files.js";
import type { ModelInfo } from "../../core/types/models.js";

type AzureConfig = Extract<HelixConfig, { provider: "azure" }>;

export function createAzureAdapter(config: AzureConfig): Helix {
  const client = new AzureOpenAI({
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    apiVersion: config.apiVersion,
  });

  return {
    responses: {
      async create(params) {
        return client.responses.create(
          params as Parameters<typeof client.responses.create>[0],
        ) as unknown as HelixResponse;
      },
    },
    files: {
      async create(params) {
        return client.files.create(params as Parameters<typeof client.files.create>[0]) as unknown as FileObject;
      },
      async list() {
        const page = await client.files.list();
        return page.data as unknown as FileObject[];
      },
      async delete(id) {
        const res = await client.files.delete(id);
        return { id: res.id, deleted: true as const };
      },
    },
    models: {
      list(): Promise<ModelInfo[]> {
        throw new Error(
          "helix-lib: 'models.list' not supported by provider 'azure' — Azure data-plane deployment listing was retired April 2024; ARM management plane requires credentials not present in HelixConfig.azure",
        );
      },
    },
    async test() {
      try {
        await this.models.list();
        return true;
      } catch {
        return false;
      }
    },
  };
}
