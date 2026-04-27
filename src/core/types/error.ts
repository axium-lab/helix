export type HelixProviderKind = "openai" | "azure" | "custom" | "vertex";

export type HelixErrorKind =
  | "InvalidApiKey"
  | "PermissionDenied"
  | "InvalidRequest"
  | "RateLimit"
  | "QuotaExceeded"
  | "ServerError"
  | "ProviderUnavailable"
  | "ContentFiltered"
  | "UnsupportedFeature"
  | "NormalizationError"
  | "Unknown";

export interface HelixErrorInit {
  kind: HelixErrorKind;
  provider: HelixProviderKind;
  message: string;
  statusCode?: number;
  raw?: unknown;
  retryable?: boolean;
  cause?: unknown;
}

export class HelixError extends Error {
  readonly kind: HelixErrorKind;
  readonly provider: HelixProviderKind;
  readonly statusCode?: number;
  readonly raw?: unknown;
  readonly retryable: boolean;

  constructor(init: HelixErrorInit) {
    super(init.message, { cause: init.cause });
    this.name = "HelixError";
    this.kind = init.kind;
    this.provider = init.provider;
    this.statusCode = init.statusCode;
    this.raw = init.raw;
    this.retryable = init.retryable ?? false;
  }

  static is(err: unknown): err is HelixError {
    return (
      err instanceof HelixError ||
      (typeof err === "object" &&
        err !== null &&
        (err as { name?: unknown }).name === "HelixError" &&
        typeof (err as { kind?: unknown }).kind === "string")
    );
  }
}
