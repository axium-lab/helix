import OpenAI from "openai";
import type { HelixConfig } from "../../../core/types/config.js";
import type { Helix } from "../../../createHelix.js";
import type { ModelInfo } from "../../../core/types/models.js";
import { HelixObject } from "../../../core/types/helix-object.js";
import { toHelixResponse, toOpenAIParams } from "../_shared/openai.mapper.js";
import { customNotSupportedError, mapCustomError } from "./custom.errors.js";

type CustomConfig = Extract<HelixConfig, { provider: "custom" }>;

export function createCustomAdapter(config: CustomConfig): Helix {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  return {
    responses: {
      async create(params) {
        try {
          const raw = await client.responses.create(toOpenAIParams(params));
          return toHelixResponse(raw, config.provider);
        } catch (err) {
          throw mapCustomError(err);
        }
      },
    },
    files: {
      create(_params): Promise<never> {
        throw customNotSupportedError("files.create");
      },
      get(_id): Promise<never> {
        throw customNotSupportedError("files.get");
      },
      list(): Promise<never> {
        throw customNotSupportedError("files.list");
      },
      delete(_id): Promise<never> {
        throw customNotSupportedError("files.delete");
      },
    },
    models: {
      async list() {
        try {
          const page = await client.models.list();
          return page.data.map((m) => ({
            id: m.id,
            object: HelixObject.Model,
            type: undefined,
            created: m.created,
            tools: [], // Custom provider doesn't support tools, so we return an empty array
            owned_by: m.owned_by,
          })) as ModelInfo[];
        } catch (err) {
          throw mapCustomError(err);
        }
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
