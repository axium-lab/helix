import type {
  HelixResponse,
  HelixIncompleteDetails,
  HelixResponseStatus,
  HelixUsage,
} from '../../../../core/types/responses/llm.response.js';
import type {
  InputText,
  ResponsesCreateParams,
} from '../../../../core/types/request.js';
import type {
  GeminiContent,
  GeminiFinishReason,
  GeminiGenerateContentRequest,
  GeminiGenerateContentResponse,
  GeminiGenerationConfig,
  GeminiUsageMetadata,
} from './responses.types.js';

interface MapperContext {
  model: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ejemplo de body Gemini (referencia rápida — para usar contra el endpoint REST)
// ─────────────────────────────────────────────────────────────────────────────
// {
//   "systemInstruction": {                  // ← lo que en Helix es role:"system"/"developer".
//     "parts": [{ "text": "Responde siempre en haiku." }]  //   Va SEPARADO de contents[]
//   },
//   "contents": [
//     {
//       "role": "user",
//       "parts": [{ "text": "¿Cuál es la capital de Francia?" }]
//     },
//     {
//       "role": "model",                    // ← Gemini usa "model" donde Helix usa "assistant"
//       "parts": [{ "text": "París, ciudad luz / brilla bajo el cielo gris / Sena la abraza." }]
//     },
//     {
//       "role": "user",
//       "parts": [{ "text": "Hablame de la luna" }]
//     }
//   ],
//   "generationConfig": {
//     "temperature": 0.7,
//     "topP": 0.9,
//     "topK": 40,
//     "maxOutputTokens": 100,
//     "stopSequences": ["FIN"]
//   }
// }
//
// ─────────────────────────────────────────────────────────────────────────────
// Tipos de "part" que existen en Geminii
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. Texto plano:
//    { "text": "Hola Gemini" }
//
// 2. Imagen inline (base64):
//    { "inlineData": { "mimeType": "image/jpeg", "data": "<base64>" } }
//
// 3. Archivo por URI (Files API):
//    { "fileData": { "mimeType": "video/mp4", "fileUri": "https://.../files/xyz" } }
//
// 4. Function call (el modelo invoca una tool):
//    { "functionCall": { "name": "get_weather", "args": { "city": "Madrid" } } }
//
// 5. Function response (responde  una tool call):
//    { "functionResponse": { "name": "get_weather", "response": { "temp": 22 } } }
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Helix → Gemini (request) Input Body
export function toGoogleBody(
  params: ResponsesCreateParams,
): GeminiGenerateContentRequest {
  const systemTexts: string[] = [];
  if (params.instructions) systemTexts.push(params.instructions);

  const contents: GeminiContent[] = [];

  for (const msg of params.input) {
    const text = msg.content
      .filter((p): p is InputText => p.type === 'input_text')
      .map((p) => p.text)
      .join('');

    // system/developer NO van en contents[], van a systemInstruction
    if (msg.role === 'system' || msg.role === 'developer') {
      systemTexts.push(text);
      continue;
    }

    // Gemini usa "model" donde Helix (y OpenAI) usan "assistant". Si en el curl pones
    // "role": "assistant" directo, Gemini te devuelve 400 INVALID_ARGUMENT.
    // "user" sí coincide en ambos lados → mapeo directo.
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text }],
    });
  }

  const generationConfig: GeminiGenerationConfig = {};
  if (params.temperature !== undefined) {
    generationConfig.temperature = params.temperature;
  }
  if (params.max_output_tokens !== undefined) {
    generationConfig.maxOutputTokens = params.max_output_tokens;
  }

  const format = params.text?.format;

  if (format?.type === 'json_object') {
    generationConfig.responseMimeType = 'application/json';
  } else if (format?.type === 'json_schema') {
    generationConfig.responseMimeType = 'application/json';

    generationConfig.responseSchema = toGeminiStructuredOutputSchema(
      format.schema,
    );
  }

  const out: GeminiGenerateContentRequest = { contents };

  if (systemTexts.length > 0) {
    out.systemInstruction = { parts: [{ text: systemTexts.join('\n\n') }] };
  }
  if (Object.keys(generationConfig).length > 0) {
    out.generationConfig = generationConfig;
  }
  return out;
}

// ── Gemini → Helix (response) ────────────────────────────────────────────────
export function toHelixResponse(
  raw: GeminiGenerateContentResponse,
  ctx: MapperContext,
): HelixResponse {
  // Los modelos actuales (2.x, 3.x) solo soportan 1 candidato.
  const candidate = raw.candidates?.[0];

  const finishReason = candidate?.finishReason;
  const status = toStatus(finishReason);
  const text = (candidate?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('');

  const id = raw.responseId;

  // Gemini "model" → Helix "assistant". "user" se mapea directo.
  const role = candidate?.content?.role === 'user' ? 'user' : 'assistant';

  return {
    id,
    object: 'response',
    // Gemini no devuelve timestamps
    created_at: null,
    completed_at: null,
    status,
    incomplete_details: toIncompleteDetails(finishReason),
    error: null,
    model: raw.modelVersion ?? ctx.model,
    output: candidate
      ? [
          {
            type: 'message',
            id,
            role,
            content: (candidate.content?.parts ?? [])
              .filter((p): p is { text: string } => typeof p.text === 'string')
              .map((p) => ({ type: 'output_text', text: p.text })),
            status: status === 'completed' ? 'completed' : 'incomplete',
          },
        ]
      : [],
    output_text: text,
    usage: toUsage(raw.usageMetadata),
  };
}

function toStatus(reason: GeminiFinishReason | undefined): HelixResponseStatus {
  switch (reason) {
    case 'STOP':
    case 'FINISH_REASON_UNSPECIFIED':
    case undefined:
      return 'completed';
    case 'MAX_TOKENS':
    case 'SAFETY':
    case 'RECITATION':
    case 'BLOCKLIST':
    case 'PROHIBITED_CONTENT':
    case 'SPII':
    case 'IMAGE_SAFETY':
    case 'IMAGE_PROHIBITED_CONTENT':
    case 'IMAGE_RECITATION':
      return 'incomplete';
    case 'LANGUAGE':
    case 'OTHER':
    case 'MALFORMED_FUNCTION_CALL':
    case 'UNEXPECTED_TOOL_CALL':
    case 'TOO_MANY_TOOL_CALLS':
    case 'MISSING_THOUGHT_SIGNATURE':
    case 'MALFORMED_RESPONSE':
    case 'NO_IMAGE':
    case 'IMAGE_OTHER':
      return 'failed';
  }
}

function toIncompleteDetails(
  reason: GeminiFinishReason | undefined,
): HelixIncompleteDetails | null {
  switch (reason) {
    case 'MAX_TOKENS':
      return { reason: 'max_output_tokens' };
    case 'SAFETY':
    case 'RECITATION':
    case 'BLOCKLIST':
    case 'PROHIBITED_CONTENT':
    case 'SPII':
    case 'IMAGE_SAFETY':
    case 'IMAGE_PROHIBITED_CONTENT':
    case 'IMAGE_RECITATION':
      return { reason: 'content_filter' };
    default:
      return null;
  }
}

// Gemini usa OpenAPI 3.0 (no JSON Schema) en responseSchema y rechaza
// `additionalProperties`, que OpenAI exige con strict:true. Lo filtramos.
function toGeminiStructuredOutputSchema(schema: unknown): object {
  const serialized = JSON.stringify(schema, (key, value) =>
    key === 'additionalProperties' ? undefined : value,
  );

  return JSON.parse(serialized);
}

function toUsage(u: GeminiUsageMetadata | undefined): HelixUsage {
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
