export type HelixProviderKind =
  | 'openai'
  | 'azure'
  | 'google-aistudio'
  | 'vertex';

type HelixConfigBase =
  | { provider: 'openai'; baseUrl?: string }
  | { provider: 'azure'; baseUrl: string; apiVersion: string }
  | { provider: 'google-aistudio'; baseUrl?: string }
  | { provider: 'vertex'; baseUrl?: string };

export type HelixConfig = HelixConfigBase & { apiKey: string };

export type HelixConfigClean = HelixConfigBase;
