export type HelixProviderKind = "openai" | "azure" | "custom" | "vertex";

export type VertexCredentials =
  | { clientEmail: string; privateKey: string }
  | { keyFile: string };

export type HelixConfig =
  | { provider: "openai"; apiKey: string; baseUrl?: string }
  | { provider: "azure"; apiKey: string; baseUrl: string; apiVersion: string }
  | { provider: "custom"; apiKey: string; baseUrl: string }
  | { provider: "vertex"; projectId: string; location: string; credentials?: VertexCredentials };
