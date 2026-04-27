import type { HelixClient } from "../../core/index.js";

export type VertexCredentials =
  | { clientEmail: string; privateKey: string }
  | { keyFile: string };

export interface VertexConfig {
  projectId: string;
  location: string;
  credentials?: VertexCredentials;
  apiVersion?: string;
}

export function createVertex(config: VertexConfig): HelixClient {
  void config;
  throw new Error("not implemented");
}
