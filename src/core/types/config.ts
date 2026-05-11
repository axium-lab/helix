export type HelixProviderKind = "openai" | "azure" | "custom" | "google";


export type HelixConfig =
  | { provider: "openai"; apiKey: string; baseUrl?: string }
  | { provider: "azure"; apiKey: string; baseUrl: string; apiVersion: string }
  | { provider: "custom"; apiKey: string; baseUrl: string }
  | { provider: "google"; apiKey: string; baseUrl?: string };
