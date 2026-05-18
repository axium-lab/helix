export type HelixProviderKind =
  | 'openai'
  | 'azure'
  | 'custom'
  | 'google-aistudio';

export type HelixConfig =
  | { provider: 'openai'; apiKey: string; baseUrl?: string }
  | { provider: 'azure'; apiKey: string; baseUrl: string; apiVersion: string }
  | { provider: 'custom'; apiKey: string; baseUrl: string }
  | { provider: 'google-aistudio'; apiKey: string; baseUrl?: string };
