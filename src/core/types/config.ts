export type HelixProviderKind =
  | 'openai'
  | 'azure'
  | 'custom'
  | 'google-aistudio';


type HelixConfigBase =
    | { provider: 'openai'; baseUrl?: string }
    | { provider: 'azure'; baseUrl: string; apiVersion: string }
    | { provider: 'custom'; baseUrl: string }
    | { provider: 'google-aistudio'; baseUrl?: string };

export type HelixConfig = HelixConfigBase & { apiKey: string };

export type HelixConfigClean = HelixConfigBase;