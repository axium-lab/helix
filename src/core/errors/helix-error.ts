import type { HelixProviderKind } from "../types/config.js";

export type HelixErrorCategory =
  | "auth_error"
  | "permission_denied"
  | "not_found"
  | "rate_limit"
  | "quota_exceeded"
  | "content_filter"
  | "invalid_request"
  | "server_error"
  | "timeout"
  | "connection_error"
  | "unknown";

export interface HelixErrorArgs {
  category: HelixErrorCategory;
  provider: HelixProviderKind;
  message: string;
  httpStatus?: number;
  requestId?: string;
  meta?: Record<string, unknown>;
  cause?: unknown;
}

export class HelixError extends Error {
  readonly category: HelixErrorCategory;
  readonly provider: HelixProviderKind;
  readonly httpStatus: number;
  readonly requestId?: string;
  readonly meta?: Record<string, unknown>;

  constructor(args: HelixErrorArgs) {
    super(args.message, args.cause !== undefined ? { cause: args.cause } : undefined);
    this.name = "HelixError";
    this.category = args.category;
    this.provider = args.provider;
    this.httpStatus = args.httpStatus ?? fallbackHttpStatus(args.category);
    this.requestId = args.requestId;
    this.meta = args.meta;
  }
}

// En caso de que no tengamos un httpStatus explícito, podemos sugerir uno basado en la categoría del error.
// Ya que aveces vienen sin httpStatus (ej: errores de conexión), 
// o con httpStatus genéricos (ej: OpenAI devuelve 400 para invalid_request incluso en casos de model_not_found).
function fallbackHttpStatus(category: HelixErrorCategory): number {
  switch (category) {
    case "connection_error": return 502;
    case "timeout": return 504;
    default: return 500;
  }
}

export function isHelixError(value: unknown): value is HelixError {
  return value instanceof HelixError;
}

