export class AzureFetchError extends Error {
  readonly kind: "auth" | "config" | "upstream" | "network";
  readonly status?: number;
  readonly provider: "azure" = "azure";
  readonly operation: string;
  readonly cause?: unknown;

  constructor(args: {
    kind: "auth" | "config" | "upstream" | "network";
    message: string;
    status?: number;
    operation?: string;
    cause?: unknown;
  }) {
    super(args.message);
    this.name = "AzureFetchError";
    this.kind = args.kind;
    this.status = args.status;
    this.operation = args.operation ?? "unknown";
    this.cause = args.cause;
  }
}

export function isAzureFetchError(value: unknown): value is AzureFetchError {
  return value instanceof AzureFetchError;
}
