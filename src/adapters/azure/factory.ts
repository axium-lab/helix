import type { HelixClient } from "../../core/index.js";

export interface AzureOpenAIConfig {
  apiKey: string;
  endpoint: string;
  apiVersion: string;
  defaultHeaders?: Record<string, string>;
}

export function createAzureOpenAI(config: AzureOpenAIConfig): HelixClient {
  void config;
  throw new Error("not implemented");
}
