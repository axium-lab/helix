import type OpenAI from "openai";
import type { Helix } from "../../../createHelix.js";
import type { ModelInfo } from "../../../core/types/models.js";

async function listModels(client: OpenAI): Promise<ModelInfo[]> {
  const page = await client.models.list();

  return page.data.map((m) => ({
    id: m.id,
    object: "model" as const,
    created: m.created,
    tools: [], // OpenAI's API doesn't return tools in the models endpoint, so we return an empty array
    owned_by: m.owned_by,
  })) as ModelInfo[];
}

export function modelsHandler(client: OpenAI): Helix["models"] {
  return {
    list: () => listModels(client),
  };
}
