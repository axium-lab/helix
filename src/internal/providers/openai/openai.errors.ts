import type { HelixError } from '../../../core/errors/helix-error.js';
import { mapSdkError } from '../_shared/openai-sdk-error.mapper.js';

export function mapOpenAIError(err: unknown): HelixError {
  return mapSdkError(err, {
    provider: 'openai',
    buildMeta: (e) =>
      e.error && typeof e.error === 'object'
        ? { ...(e.error as Record<string, unknown>) }
        : undefined,
  });
}
