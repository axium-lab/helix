import {
  FinishReason as SdkFinishReason,
  type Content,
  type GenerateContentConfig,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type GenerateContentResponseUsageMetadata,
  type Part,
} from '@google/genai';

import type {
  HelixFinishReason,
  HelixResponse,
  HelixResponseStatus,
  HelixUsage,
} from '../../../../core/types/responses/llm.response.js';
import type {
  InputContentPart,
  InputText,
  ResponsesCreateParams,
} from '../../../../core/types/request.js';
import type { HelixConfigClean } from '../../../../core/types/config.js';
import { HelixObject } from '../../../../core/types/helix-object.js';
import { HelixError } from '../../../../core/index.js';

// Helix → Vertex SDK GenerateContentParameters.
export function toGenerateContentParams(
  params: ResponsesCreateParams,
  mimeMap: Map<string, string> = new Map(),
): GenerateContentParameters {
  const systemTexts: string[] = [];
  if (params.instructions) systemTexts.push(params.instructions);

  const contents: Content[] = [];

  for (const msg of params.input) {
    if (msg.role === 'system' || msg.role === 'developer') {
      const text = msg.content
        .filter((p): p is InputText => p.type === 'input_text')
        .map((p) => p.text)
        .join('');

      systemTexts.push(text);

      continue;
    }

    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: msg.content.map((p) => toVertexPart(p, mimeMap)),
    });
  }

  const config: GenerateContentConfig = {};

  if (systemTexts.length > 0) {
    config.systemInstruction = systemTexts.join('\n\n');
  }

  if (params.temperature !== undefined) {
    config.temperature = params.temperature;
  }

  if (params.max_output_tokens !== undefined) {
    config.maxOutputTokens = params.max_output_tokens;
  }

  const format = params.text?.format;
  if (format?.type === 'json_object' || format?.type === 'json_schema') {
    config.responseMimeType = 'application/json';
    if (format.type === 'json_schema') {
      config.responseSchema = stripAdditionalProperties(format.schema);
    }
  }

  return {
    model: params.model,
    contents,
    ...(Object.keys(config).length > 0 ? { config } : {}),
  };
}

// Vertex resolves files exclusively through GCS: upload via `files.create`,
// then reference the returned `gs://` URI as `file_id`. Inline `file_data` is
// not accepted — the file must live in the bucket.
function toVertexPart(p: InputContentPart, mimeMap: Map<string, string>): Part {
  if (p.type === 'input_text') return { text: p.text };

  if (p.file_id === undefined) {
    throw new HelixError({
      category: 'invalid_request',
      provider: 'vertex',
      message:
        'helix-lib: Vertex requires `file_id` (a gs:// URI from files.create); inline `file_data` is not supported.',
    });
  }

  const mimeType = mimeMap.get(p.file_id);
  if (!mimeType) {
    throw new HelixError({
      category: 'invalid_request',
      provider: 'vertex',
      message:
        'helix-lib: file_id requires bucketUri to be set in HelixConfig.vertex.',
    });
  }

  return { fileData: { fileUri: p.file_id, mimeType } };
}

// Gemini uses OpenAPI 3.0 (not JSON Schema). `additionalProperties` is rejected
// even when the request comes via Vertex. Strip it to keep cross-provider
// schemas compatible.
function stripAdditionalProperties(schema: unknown): object {
  const serialized = JSON.stringify(schema, (key, value) =>
    key === 'additionalProperties' ? undefined : value,
  );
  return JSON.parse(serialized);
}

// Vertex SDK GenerateContentResponse → Helix response.
export function toHelixResponse(
  raw: GenerateContentResponse,
  config: HelixConfigClean,
): HelixResponse {
  const candidate = raw.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const status = toStatus(finishReason);

  const parts = candidate?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? '').join('');

  // Vertex does not always return a responseId. Fall back to an empty string
  // rather than `undefined`; callers can correlate via metadata if needed.
  const id = raw.responseId ?? '';

  const role = candidate?.content?.role === 'user' ? 'user' : 'assistant';

  return {
    id,
    object: HelixObject.Response,
    created_at: null,
    completed_at: null,
    status,
    finish_reason: toHelixFinishReason(finishReason),
    error: null,
    model: raw.modelVersion ?? '',
    output: candidate
      ? [
          {
            type: 'message',
            id,
            role,
            content: parts
              .filter((p): p is { text: string } => typeof p.text === 'string')
              .map((p) => ({ type: 'output_text' as const, text: p.text })),
            status: status === 'completed' ? 'completed' : 'incomplete',
          },
        ]
      : [],
    output_text: text,
    usage: toUsage(raw.usageMetadata),
    metadata: { [config.provider]: raw },
  };
}

// Finish reasons where Gemini cut the model off via a safety/content filter.
// Single source of truth — both `toStatus` and `toHelixFinishReason` read it.
const CONTENT_FILTER_REASONS: SdkFinishReason[] = [
  SdkFinishReason.SAFETY,
  SdkFinishReason.RECITATION,
  SdkFinishReason.BLOCKLIST,
  SdkFinishReason.PROHIBITED_CONTENT,
  SdkFinishReason.SPII,
  SdkFinishReason.IMAGE_SAFETY,
  SdkFinishReason.IMAGE_PROHIBITED_CONTENT,
  SdkFinishReason.IMAGE_RECITATION,
];

function toStatus(reason: SdkFinishReason | undefined): HelixResponseStatus {
  if (
    reason === undefined ||
    reason === SdkFinishReason.STOP ||
    reason === SdkFinishReason.FINISH_REASON_UNSPECIFIED
  ) {
    return 'completed';
  }
  if (
    reason === SdkFinishReason.MAX_TOKENS ||
    CONTENT_FILTER_REASONS.includes(reason)
  ) {
    return 'incomplete';
  }
  return 'failed';
}

function toHelixFinishReason(
  reason: SdkFinishReason | undefined,
): HelixFinishReason | null {
  if (reason === SdkFinishReason.MAX_TOKENS) return 'max_tokens';
  if (reason !== undefined && CONTENT_FILTER_REASONS.includes(reason)) {
    return 'content_filter';
  }
  return null;
}

function toUsage(
  u: GenerateContentResponseUsageMetadata | undefined,
): HelixUsage {
  const out: HelixUsage = {
    input_tokens: u?.promptTokenCount ?? 0,
    output_tokens: u?.candidatesTokenCount ?? 0,
    total_tokens: u?.totalTokenCount ?? 0,
  };
  if (u?.cachedContentTokenCount !== undefined) {
    out.input_tokens_details = { cached_tokens: u.cachedContentTokenCount };
  }
  if (u?.thoughtsTokenCount !== undefined) {
    out.output_tokens_details = { reasoning_tokens: u.thoughtsTokenCount };
  }
  return out;
}
