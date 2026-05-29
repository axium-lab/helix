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
} from '../../../core/types/responses/llm.response.js';
import type {
  InputContentPart,
  InputText,
  ResponsesCreateParams,
} from '../../../core/types/request.js';
import type { HelixConfigClean } from '../../../core/types/config.js';
import { HelixObject } from '../../../core/types/helix-object.js';
import { HelixError } from '../../../core/index.js';

// Helix → Vertex SDK GenerateContentParameters.
// Vertex AI uses the same Gemini wire format as Google AI Studio:
//   - `systemInstruction` lives separately from `contents[]`
//   - role `assistant` (Helix/OpenAI) → `model` (Gemini)
//   - structured output via `responseMimeType` + `responseSchema`
export async function toGenerateContentParams(
  params: ResponsesCreateParams,
): Promise<GenerateContentParameters> {
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
      parts: await Promise.all(msg.content.map(toVertexPart)),
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

// Vertex acepta archivos como `inlineData` (base64 + mime). El caller pasa un
// `File`; helix extrae bytes y mime internamente.
//
// `file_id` no se soporta: Vertex requiere `mimeType` junto al `fileUri` y la
// convención de OpenAI no lo expone como campo separado. El caller que tenga
// archivos en GCS los descarga y arma un File para mandar inline.
async function toVertexPart(p: InputContentPart): Promise<Part> {
  if (p.type === 'input_text') return { text: p.text };

  if (p.file_data instanceof File) {
    const base64 = Buffer.from(await p.file_data.arrayBuffer()).toString('base64');
    return {
      inlineData: {
        data: base64,
        mimeType: p.file_data.type || 'application/octet-stream',
      },
    };
  }

  if (p.file_id !== undefined) {
    throw new HelixError({
      category: 'invalid_request',
      provider: 'vertex',
      message:
        'helix-lib: Vertex does not support `file_id` in input_file. Use `file_data` with a `File` object.',
    });
  }

  throw new HelixError({
    category: 'invalid_request',
    provider: 'vertex',
    message: 'helix-lib: input_file requires `file_data` (a `File` object).',
  });
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

function toStatus(reason: SdkFinishReason | undefined): HelixResponseStatus {
  switch (reason) {
    case SdkFinishReason.STOP:
    case SdkFinishReason.FINISH_REASON_UNSPECIFIED:
    case undefined:
      return 'completed';
    case SdkFinishReason.MAX_TOKENS:
    case SdkFinishReason.SAFETY:
    case SdkFinishReason.RECITATION:
    case SdkFinishReason.BLOCKLIST:
    case SdkFinishReason.PROHIBITED_CONTENT:
    case SdkFinishReason.SPII:
    case SdkFinishReason.IMAGE_SAFETY:
    case SdkFinishReason.IMAGE_PROHIBITED_CONTENT:
    case SdkFinishReason.IMAGE_RECITATION:
      return 'incomplete';
    default:
      return 'failed';
  }
}

function toHelixFinishReason(
  reason: SdkFinishReason | undefined,
): HelixFinishReason | null {
  switch (reason) {
    case SdkFinishReason.MAX_TOKENS:
      return 'max_tokens';
    case SdkFinishReason.SAFETY:
    case SdkFinishReason.RECITATION:
    case SdkFinishReason.BLOCKLIST:
    case SdkFinishReason.PROHIBITED_CONTENT:
    case SdkFinishReason.SPII:
    case SdkFinishReason.IMAGE_SAFETY:
    case SdkFinishReason.IMAGE_PROHIBITED_CONTENT:
    case SdkFinishReason.IMAGE_RECITATION:
      return 'content_filter';
    default:
      return null;
  }
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
