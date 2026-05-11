import {
  HelixError,
  isHelixError,
  type HelixErrorCategory,
} from '../../../core/errors/helix-error.js';

const PROVIDER = 'google' as const;

type GoogleErrorEnvelope = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: unknown;
  };
};

interface ParsedBody {
  message?: string;
  status?: string;
}

// Solo para errores HTTP, no para errores de red o de otro tipo. Para esos otros tipos de error, se debe usar mapGoogleNetworkError o mapGoogleError.
export function mapGoogleHttpError(res: Response, body: unknown): HelixError {
  const parsed = parseErrorBody(body);
  return new HelixError({
    category: categorize(res.status, parsed.status, parsed.message),
    provider: PROVIDER,
    message: parsed.message ?? res.statusText ?? `HTTP ${res.status}`,
    httpStatus: res.status,
    requestId: res.headers.get('x-goog-request-id') ?? undefined,
    meta: body !== undefined ? { body } : undefined,
  });
}

// Para errores de red (p. ej. no se pudo conectar, timeout, etc.)
export function mapGoogleNetworkError(err: unknown): HelixError {
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return new HelixError({
        category: 'timeout',
        provider: PROVIDER,
        message: err.message,
        cause: err,
      });
    }
    return new HelixError({
      category: 'connection_error',
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

// Para mapear cualquier error relacionado con Google, ya sea un error HTTP o un error de red u otro tipo de error.
// Usar esta función en los catch genéricos para asegurarse de que siempre se devuelve un HelixError consistente.
export function mapGoogleError(err: unknown): HelixError {
  if (isHelixError(err)) return err;
  return mapGoogleNetworkError(err);
}

// Intenta extraer un mensaje de error y un código de estado específicos de Google del cuerpo de la respuesta. Si no se pueden extraer, devuelve un objeto vacío.
function parseErrorBody(body: unknown): ParsedBody {
  if (body && typeof body === 'object' && 'error' in body) {
    const e = (body as GoogleErrorEnvelope).error;
    if (e && typeof e === 'object') {
      return { message: e.message, status: e.status };
    }
  }
  if (typeof body === 'string') return { message: body };
  return {};
}

// Docu Gemini Para categrizar Error https://ai.google.dev/gemini-api/docs/troubleshooting?hl=es-419
function categorize(
  httpStatus: number,
  googleStatus: string | undefined,
  message: string | undefined,
): HelixErrorCategory {
  switch (googleStatus) {
    case 'INVALID_ARGUMENT':
      // sub-case: API key inválida llega con 400 + INVALID_ARGUMENT pero es auth
      if (/api key not valid/i.test(message ?? '')) return 'auth_error';
      return 'invalid_request';
    case 'FAILED_PRECONDITION':
      return 'permission_denied';
    case 'PERMISSION_DENIED':
      return 'permission_denied';
    case 'NOT_FOUND':
      return 'not_found';
    case 'RESOURCE_EXHAUSTED':
      return /quota/i.test(message ?? '') ? 'quota_exceeded' : 'rate_limit';
    case 'INTERNAL':
      return 'server_error';
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
