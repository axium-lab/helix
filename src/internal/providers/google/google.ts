import GoogleOpenAI from "openai";
import type { HelixConfig } from "../../../core/types/config.js";
import type { Helix } from "../../../createHelix.js";
import { responsesHandler } from "./google.responses.js";
import { filesHandler } from "./google.files.js";
import { modelsHandler } from "./google.models.js";

type GoogleConfig = Extract<HelixConfig, { provider: "google" }>;

export function createGoogleAdapter(config: GoogleConfig): Helix {
  const client = new GoogleOpenAI({
    apiKey: config.apiKey,
    ...(config.baseUrl && { baseURL: config.baseUrl }),
  });

  return {
    responses: responsesHandler(client),
    files: filesHandler(client),
    models: modelsHandler(client),
    test: () => modelsHandler(client).list().then(() => true).catch(() => false),
  };
}
