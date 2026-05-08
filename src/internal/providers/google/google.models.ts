import type GoogleOpenAI from "openai";
import type { Helix } from "../../../createHelix.js";
import type { ModelInfo } from "../../../core/types/models.js";
import { HelixObject } from "../../../core/types/helix-object.js";
import { mapGoogleError } from "./google.errors.js";

type GoogleModel = { display_name?: string };

async function listModels(client: GoogleOpenAI): Promise<ModelInfo[]> {
  try {
    const page = await client.models.list();

    return page.data.map((m) => ({
      id: m.id,
      object: HelixObject.Model,
      created: m.created || null,
      tools: [],
      display_name: (m as typeof m & GoogleModel).display_name,
      owned_by: m.owned_by,
    })) as ModelInfo[];
  } catch (err) {
    throw mapGoogleError(err);
  }
}

export function modelsHandler(client: GoogleOpenAI): Helix["models"] {
  return {
    list: () => listModels(client),
  };
}
