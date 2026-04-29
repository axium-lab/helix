import OpenAI from "openai";
import type { HelixConfig } from "../../core/types/config.js";
import type { Helix } from "../../createHelix.js";
import type { HelixResponse } from "../../core/types/response.js";
import type { FileObject } from "../../core/types/files.js";
import type { ModelInfo } from "../../core/types/models.js";

type OpenAIConfig = Extract<HelixConfig, { provider: "openai" }>;

export function createOpenAIAdapter(config: OpenAIConfig): Helix {
  const client = new OpenAI({
    apiKey: config.apiKey,
    ...(config.baseUrl && { baseURL: config.baseUrl }),
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
        const file =
          params.file instanceof File
            ? params.file
            : new File([params.file], "blob", { type: params.file.type || "application/octet-stream" });
        return (await client.files.create({ ...params, file })) as FileObject;
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
      async list() {
        const page = await client.models.list();
        return page.data.map((m) => ({
          id: m.id,
          object: "model" as const,
          created: m.created,
          owned_by: m.owned_by, //owned_by: "openai" |"system" | "<Axium-org-id>"
        })) as ModelInfo[];
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
