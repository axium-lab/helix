import type { HelixClient } from "../../core/index.js";

export interface OpenAIConfig {
  apiKey: string;
  baseUrl?: string;
  organization?: string;
  project?: string;
  defaultHeaders?: Record<string, string>;
}

export function createOpenAI(config: OpenAIConfig): HelixClient {
  void config;
  throw new Error("not implemented");
}
