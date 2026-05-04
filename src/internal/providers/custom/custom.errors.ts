import { HelixError } from "../../../core/errors/helix-error.js";
import { mapSdkError } from "../_shared/openai-sdk-error.mapper.js";

/**
 * Maps errors from any OpenAI-compatible "custom" endpoint to HelixError.
 *
 * Custom is a META-PROVIDER: we do NOT know which actual vendor (Together AI,
 * Groq, OpenRouter, Anyscale, …) sits behind the configured baseUrl, so we
 * cannot replicate per-vendor quirks (e.g. Together's HTTP 503 = rate_limit,
 * Groq's 498 = rate_limit, OpenRouter's 424 = upstream wrapper). The raw
 * upstream body is preserved in `meta.upstream` for caller debugging.
 *
 * If a vendor needs fine-grained mapping, it should become a dedicated adapter
 * (not Custom).
 */
export function mapCustomError(err: unknown): HelixError {
  return mapSdkError(err, {
    provider: "custom",
    buildMeta: (e) => (e.error !== undefined ? { upstream: e.error as unknown } : undefined),
  });
}

export function customNotSupportedError(operation: string): HelixError {
  return new HelixError({
    category: "invalid_request",
    provider: "custom",
    message: `helix-lib: '${operation}' not supported by provider 'custom'`,
    meta: { reason: "not_supported", operation },
  });
}
