import {
  HelixError,
  isHelixError,
  type HelixErrorCategory,
} from '../../../core/errors/helix-error.js';

const PROVIDER = 'google' as const;

// Docu Google: https://ai.google.dev/gemini-api/docs/troubleshooting?hl=es-419
// Definicion de errores de todas las APis de google https://google.aip.dev/193
interface GoogleErrorObject {
  code?: number;
  message?: string;
  status?: string;
  details?: unknown;
}

export function mapGoogleHttpError(res: Response, body: unknown): HelixError {
  let errorObject: GoogleErrorObject | undefined;
  let message: string | undefined;

  if (body && typeof body === 'object' && 'error' in body) {
    errorObject = (body as { error?: GoogleErrorObject }).error;
    message = errorObject?.message;
  } else if (typeof body === 'string') {
    message = body;
  }

  return new HelixError({
    category: categorize(res.status, errorObject?.status, message),
    provider: PROVIDER,
    message: message ?? res.statusText ?? `HTTP ${res.status}`,
    httpStatus: res.status,
    requestId: res.headers.get('x-goog-request-id') ?? undefined,
    meta: errorObject as Record<string, unknown> | undefined,
  });
}

export function mapGoogleNetworkError(err: unknown): HelixError {
  if (err instanceof Error) {
    const category: HelixErrorCategory =
      err.name === 'AbortError' ? 'timeout' : 'connection_error';
    return new HelixError({
      category,
      provider: PROVIDER,
      message: err.message,
      cause: err,
    });
  }
  return new HelixError({
    category: 'unknown',
    provider: PROVIDER,
    message: 'helix-lib: unknown error',
    cause: err,
  });
}

export function mapGoogleError(err: unknown): HelixError {
  return isHelixError(err) ? err : mapGoogleNetworkError(err);
}

// Docu Gemini: https://ai.google.dev/gemini-api/docs/troubleshooting?hl=es-419
function categorize(
  httpStatus: number,
  googleStatus: string | undefined,
  message: string | undefined,
): HelixErrorCategory {
  // Prioridad 1: status string de Gemini (más preciso semánticamente que el HTTP code)
  switch (googleStatus) {
    case 'INVALID_ARGUMENT':
      // sub-case: API key inválida llega con 400 + INVALID_ARGUMENT pero es auth
      if (/api key not valid/i.test(message ?? '')) return 'auth_error';
      return 'invalid_request';
    case 'FAILED_PRECONDITION':
    case 'PERMISSION_DENIED':
      return 'permission_denied';
    case 'NOT_FOUND':
      return 'not_found';
    case 'RESOURCE_EXHAUSTED':
      return /quota/i.test(message ?? '') ? 'quota_exceeded' : 'rate_limit';
    case 'INTERNAL':
    case 'UNAVAILABLE':
      return 'server_error';
    case 'DEADLINE_EXCEEDED':
      return 'timeout';
  }

  // Prioridad 2: fallback por HTTP status (cuando el body no trae status string)
  if (httpStatus === 408 || httpStatus === 504) return 'timeout';
  if (httpStatus >= 500 && httpStatus < 600) return 'server_error';
  if (httpStatus === 429) return 'rate_limit';
  if (httpStatus === 404) return 'not_found';
  if (httpStatus === 403) return 'permission_denied';
  if (httpStatus === 401) return 'auth_error';
  if (httpStatus === 400) return 'invalid_request';

  return 'unknown';
}
