import OpenAI from "openai";
import type { HelixConfig } from "../../../core/types/config.js";
import type { Helix } from "../../../createHelix.js";
import { responsesHandler } from "./openai.responses.js";
import { filesHandler } from "./openai.files.js";
import { modelsHandler } from "./openai.models.js";
import { sanitizeProviderConfig } from "../_shared/config.helpers.js";

type OpenAIConfig = Extract<HelixConfig, { provider: "openai" }>;

export function createOpenAIAdapter(config: OpenAIConfig): Helix {
  const client = new OpenAI({
    apiKey: config.apiKey,
    ...(config.baseUrl && { baseURL: config.baseUrl }),
  });

  const configClean = sanitizeProviderConfig(config);

  return {
    responses: responsesHandler(client, configClean),
    files: filesHandler(client),
    models: modelsHandler(client),
    test: {
      connection: () => modelsHandler(client).list().then(() => true).catch(() => false),
    },
  };
}
