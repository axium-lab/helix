import type { HelixClient } from "../../core/index.js";

export interface OpenAICompatibleConfig {
  apiKey: string;
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
}

export function createOpenAICompatible(config: OpenAICompatibleConfig): HelixClient {
  void config;
  throw new Error("not implemented");
}
