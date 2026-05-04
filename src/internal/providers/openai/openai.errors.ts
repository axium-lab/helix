import type { HelixError } from "../../../core/errors/helix-error.js";
import { mapSdkError } from "../_shared/openai-sdk-error.mapper.js";

export function mapOpenAIError(err: unknown): HelixError {
  return mapSdkError(err, {
    provider: "openai",
    buildMeta: (e) => (e.error !== undefined ? { body: e.error as unknown } : undefined),
  });
}
