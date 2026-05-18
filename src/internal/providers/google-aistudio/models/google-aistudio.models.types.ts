export interface GeminiModel {
  name: string;
  displayName?: string;
}

export interface GeminiModelsResponse {
  models?: GeminiModel[];
}
