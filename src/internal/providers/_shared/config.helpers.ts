import type { HelixConfig, HelixConfigClean } from '../../../core/types/config.js';

export function sanitizeProviderConfig(config: HelixConfig): HelixConfigClean {
  const { apiKey: _apiKey, ...clean } = config;
  return clean;
}
