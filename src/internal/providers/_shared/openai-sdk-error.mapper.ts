import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from "openai";

import type { HelixProviderKind } from "../../../core/types/config.js";
import {
  HelixError,
  isHelixError,
  type HelixErrorCategory,
} from "../../../core/errors/helix-error.js";

/**
 * Per-provider configuration consumed by `mapSdkError`. Captures the small
 * deltas between providers that share the OpenAI wire format (today: openai,
 * azure, custom) so the instanceof chain itself lives in ONE place.
 *
 * - `provider`: the discriminator stamped on every emitted HelixError.
 * - `buildMeta`: returns the per-provider meta payload (e.g. openai → { body },
 *   custom → { upstream }, azure → { body, innererror? }).
 * - `detectResponsibleAIViolation` (optional): override default content-filter detection
 *   on 400 BadRequest. Default: `code === "content_filter"`. Azure also accepts
 *   `innererror.code === "ResponsibleAIPolicyViolation"`.
 */
export type ProviderErrorConfig = {
  provider: HelixProviderKind;
  buildMeta: (err: APIError) => Record<string, unknown> | undefined;
  // Detecta contenido inapropiado  Azure Responsible AI Policy Violation
  detectResponsibleAIViolation?: (err: APIError, code: string | undefined) => boolean;
  // Override para providers que usan headers distintos a x-request-id (ej: Azure)
  buildRequestId?: (err: APIError) => string | undefined;
};

export function mapSdkError(err: unknown, cfg: ProviderErrorConfig): HelixError {

  if (isHelixError(err)) return err;
  if (err instanceof APIConnectionTimeoutError)
    return defaultHelixError("timeout", err, cfg);

  if (err instanceof APIConnectionError)
    return defaultHelixError("connection_error", err, cfg);

  if (err instanceof APIUserAbortError)
    return defaultHelixError("unknown", err, cfg);

  if (err instanceof APIError)
    return mapAPIError(err, cfg);

  if (err instanceof Error)
    return defaultHelixError("unknown", err, cfg);

  return new HelixError({
    category: "unknown",
    provider: cfg.provider,
    message: "helix-lib: unknown error",
    cause: err,
  });
}

function defaultHelixError(category: HelixErrorCategory, err: Error, cfg: ProviderErrorConfig): HelixError {
  return new HelixError({ category, provider: cfg.provider, message: err.message, cause: err });
}

function mapAPIError(err: APIError, cfg: ProviderErrorConfig): HelixError {
  const code = typeof err.code === "string" ? err.code : undefined;
  const category = categorize(err, code, cfg);
  const meta = cfg.buildMeta(err);

  const requestId = cfg.buildRequestId
    ? cfg.buildRequestId(err)
    : (err.requestID ?? undefined);

  return new HelixError({
    category,
    provider: cfg.provider,
    message: err.message,
    httpStatus: err.status,
    requestId,
    meta,
    cause: err,
  });
}

function categorize(
  err: APIError,
  code: string | undefined,
  cfg: ProviderErrorConfig,
): HelixErrorCategory {

  if (err instanceof BadRequestError) {
    const isContentFilter = cfg.detectResponsibleAIViolation
      ? cfg.detectResponsibleAIViolation(err, code)
      : code === "content_filter";
    return isContentFilter ? "content_filter" : "invalid_request";
  }

  if (err instanceof AuthenticationError) return "auth_error";
  if (err instanceof PermissionDeniedError) return "permission_denied";
  if (err instanceof NotFoundError) return "not_found";
  if (err instanceof RateLimitError) {
    return code === "insufficient_quota" ? "quota_exceeded" : "rate_limit";
  }
  if (err instanceof UnprocessableEntityError) return "invalid_request";
  if (err instanceof ConflictError) return "invalid_request";
  if (err instanceof InternalServerError) return "server_error";

  if (typeof err.status === "number" && err.status >= 500) return "server_error";
  return "unknown";
}
