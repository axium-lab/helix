import type OpenAI from "openai";
import type { Helix } from "../../../createHelix.js";
import type { ModelInfo } from "../../../core/types/models.js";
import { HelixObject } from "../../../core/types/helix-object.js";
import { mapOpenAIError } from "./openai.errors.js";

async function listModels(client: OpenAI): Promise<ModelInfo[]> {
  try {
    const page = await client.models.list();

    return page.data.map((m) => ({
      id: m.id,
      object: HelixObject.Model,
      type: undefined,
      created: m.created,
      tools: [], // OpenAI's API doesn't return tools in the models endpoint, so we return an empty array
      owned_by: m.owned_by,
    })) as ModelInfo[];
  } catch (err) {
    throw mapOpenAIError(err);
  }
}

export function modelsHandler(client: OpenAI): Helix["models"] {
  return {
    list: () => listModels(client),
  };
}
