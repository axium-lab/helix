import { ApiError } from '@google/genai';
import {
  HelixError,
  isHelixError,
  type HelixErrorCategory,
} from '../../../core/index.js';

const PROVIDER = 'vertex' as const;

// Vertex AI (y todas las APIs de Google) devuelven errores con el formato AIP-193:
// https://google.aip.dev/193 — un objeto { code, message, status, details }.
// El SDK @google/genai expone ApiError con `status` (HTTP) y `message` (string
// que típicamente contiene el body de error serializado como JSON).
interface GoogleErrorObject {
  code?: number;
  message?: string;
  status?: string;
  details?: unknown;
}

export function mapVertexError(err: unknown): HelixError {
  if (isHelixError(err)) return err;

  if (err instanceof ApiError) return mapApiError(err);

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

function mapApiError(err: ApiError): HelixError {
  const errorObject = extractGoogleErrorObject(err.message);
  const message = errorObject?.message ?? err.message;

  return new HelixError({
    category: categorize(err.status, errorObject?.status, message),
    provider: PROVIDER,
    message,
    httpStatus: err.status,
    meta: errorObject as Record<string, unknown> | undefined,
    cause: err,
  });
}

// El SDK guarda el body de error de Google dentro de err.message como string.
// A veces es JSON parseable ({ error: { code, message, status, details } }),
// a veces es texto plano. Devolvemos undefined si no podemos parsearlo.
function extractGoogleErrorObject(
  message: string,
): GoogleErrorObject | undefined {
  try {
    const parsed: unknown = JSON.parse(message);
    if (parsed && typeof parsed === 'object' && 'error' in parsed) {
      return (parsed as { error?: GoogleErrorObject }).error;
    }
  } catch {
    // message no es JSON — ignoramos
  }
  return undefined;
}

function categorize(
  httpStatus: number,
  googleStatus: string | undefined,
  message: string | undefined,
): HelixErrorCategory {
  // Prioridad 1: status string de Google (más preciso que el HTTP code)
  switch (googleStatus) {
    case 'INVALID_ARGUMENT':
      // sub-case: credenciales inválidas a veces llegan con 400 + INVALID_ARGUMENT
      if (/api key not valid|invalid.*credentials/i.test(message ?? ''))
        return 'auth_error';
      return 'invalid_request';
    case 'FAILED_PRECONDITION':
    case 'PERMISSION_DENIED':
      return 'permission_denied';
    case 'UNAUTHENTICATED':
      return 'auth_error';
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

  // Prioridad 2: fallback por HTTP status
  if (httpStatus === 408 || httpStatus === 504) return 'timeout';
  if (httpStatus >= 500 && httpStatus < 600) return 'server_error';
  if (httpStatus === 429) return 'rate_limit';
  if (httpStatus === 404) return 'not_found';
  if (httpStatus === 403) return 'permission_denied';
  if (httpStatus === 401) return 'auth_error';
  if (httpStatus === 400) return 'invalid_request';

  return 'unknown';
}
