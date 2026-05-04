import type { APIError } from "openai";

import { HelixError, type HelixErrorCategory } from "../../../core/errors/helix-error.js";
import { mapSdkError } from "../_shared/openai-sdk-error.mapper.js";

const PROVIDER = "azure" as const;

export function mapAzureError(err: unknown): HelixError {
  return mapSdkError(err, {
    provider: PROVIDER,
    buildMeta: buildAzureMeta,
    detectResponsibleAIViolation: isResponsibleAIViolation,
  });
}

function buildAzureMeta(err: APIError): Record<string, unknown> | undefined {
  const meta: Record<string, unknown> = {};
  if (err.error !== undefined) meta.body = err.error as unknown;
  const innererror = extractInnererror(err.error);
  if (innererror) meta.innererror = innererror;
  return Object.keys(meta).length > 0 ? meta : undefined;
}

function isResponsibleAIViolation(err: APIError, code: string | undefined): boolean {
  if (code === "content_filter") return true;
  const innererror = extractInnererror(err.error);
  return innererror?.code === "ResponsibleAIPolicyViolation";
}

function extractInnererror(body: unknown): { code?: string; message?: string } | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const i = (body as Record<string, unknown>).innererror;
  if (typeof i === "object" && i !== null) {
    return i as { code?: string; message?: string };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Raw fetch path helpers (Azure data-plane /openai/deployments listing).
// These do NOT go through the openai SDK, so they cannot share mapSdkError.
// ---------------------------------------------------------------------------

export function azureFetchHttpError(args: {
  status: number;
  operation: string;
  message: string;
  body?: unknown;
}): HelixError {
  const meta: Record<string, unknown> = { operation: args.operation };
  if (args.body !== undefined) meta.body = args.body;
  return new HelixError({
    category: categorizeAzureHttpStatus(args.status),
    provider: PROVIDER,
    message: args.message,
    httpStatus: args.status,
    meta,
  });
}

export function azureFetchNetworkError(args: {
  operation: string;
  message: string;
  cause: unknown;
}): HelixError {
  return new HelixError({
    category: "connection_error",
    provider: PROVIDER,
    message: args.message,
    meta: { operation: args.operation },
    cause: args.cause,
  });
}

function categorizeAzureHttpStatus(status: number): HelixErrorCategory {
  if (status === 401) return "auth_error";
  if (status === 403) return "permission_denied";
  if (status === 404) return "not_found";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server_error";
  if (status >= 400) return "invalid_request";
  return "unknown";
}
