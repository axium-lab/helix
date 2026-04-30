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
  retryable?: boolean;
  meta?: Record<string, unknown>;
  cause?: unknown;
}

export class HelixError extends Error {
  readonly category: HelixErrorCategory;
  readonly provider: HelixProviderKind;
  readonly httpStatus?: number;
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly meta?: Record<string, unknown>;

  constructor(args: HelixErrorArgs) {
    super(args.message, args.cause !== undefined ? { cause: args.cause } : undefined);
    this.name = "HelixError";
    this.category = args.category;
    this.provider = args.provider;
    this.httpStatus = args.httpStatus;
    this.requestId = args.requestId;
    this.retryable = args.retryable ?? defaultRetryable(args.category);
    this.meta = args.meta;
  }
}

export function isHelixError(value: unknown): value is HelixError {
  return value instanceof HelixError;
}

function defaultRetryable(category: HelixErrorCategory): boolean {
  switch (category) {
    case "rate_limit":
    case "server_error":
    case "timeout":
    case "connection_error":
      return true;
    case "auth_error":
    case "permission_denied":
    case "not_found":
    case "quota_exceeded":
    case "content_filter":
    case "invalid_request":
    case "unknown":
      return false;
  }
}
