import OpenAI from "openai";
import type { HelixConfig } from "../../../core/types/config.js";
import type { Helix } from "../../../createHelix.js";
import type { ModelInfo } from "../../../core/types/models.js";
import { HelixObject } from "../../../core/types/helix-object.js";
import { toHelixResponse, toOpenAIParams } from "../_shared/openai-shape.mappers.js";

type CustomConfig = Extract<HelixConfig, { provider: "custom" }>;

export function createCustomAdapter(config: CustomConfig): Helix {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  return {
    responses: {
      async create(params) {
        const raw = await client.responses.create(toOpenAIParams(params));
        return toHelixResponse(raw);
      },
    },
    files: {
      create(_params): Promise<never> {
        throw new Error("helix-lib: 'files.create' not supported by provider 'custom'");
      },
      list(): Promise<never> {
        throw new Error("helix-lib: 'files.list' not supported by provider 'custom'");
      },
      delete(_id): Promise<never> {
        throw new Error("helix-lib: 'files.delete' not supported by provider 'custom'");
      },
    },
    models: {
      async list() {
        const page = await client.models.list();
        return page.data.map((m) => ({
          id: m.id,
          object: HelixObject.Model,
          type: undefined,
          created: m.created,
          tools: [], // Custom provider doesn't support tools, so we return an empty array
          owned_by: m.owned_by,
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
