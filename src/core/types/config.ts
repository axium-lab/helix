export type HelixProviderKind =
  | 'openai'
  | 'azure'
  | 'google-aistudio'
  | 'vertex';

// Service Account credentials for Google Cloud (Vertex AI).
export interface VertexServiceAccountCredentials {
  client_email: string;
  private_key: string;
  type?: string;
  project_id?: string;
  private_key_id?: string;
  client_id?: string;
  universe_domain?: string;
}

type HelixConfigBase =
  | { provider: 'openai'; baseUrl?: string }
  | { provider: 'azure'; baseUrl: string; apiVersion: string }
  | { provider: 'google-aistudio'; baseUrl?: string }
  | {
      provider: 'vertex';
      projectId: string;
      location: string;
      credentials: VertexServiceAccountCredentials;
      bucketUri?: string;
    };

export type HelixConfig = HelixConfigBase & { apiKey?: string };

export type HelixConfigClean = HelixConfigBase;
