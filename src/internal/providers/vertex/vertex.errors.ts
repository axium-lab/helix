import { HelixError, isHelixError } from '../../../core/index.js';

export function mapVertexError(err: unknown): HelixError {
  return isHelixError(err)
    ? err
    : new HelixError({
        category: 'unknown',
        provider: 'vertex',
        message:
          'helix-lib: fake-vertex error mapper - vertex provider is not yet supported',
        cause: err,
      });
}
