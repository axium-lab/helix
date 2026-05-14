import type {
  HelixResponse,
  HelixFinishReason,
  HelixResponseStatus,
  HelixUsage,
  HelixResponseMetadata,
} from '../../../../core/types/responses/llm.response.js';
import type {
  InputContentPart,
  InputText,
  ResponsesCreateParams,
} from '../../../../core/types/request.js';
import type { GoogleClient } from '../google.fetch.js';
import { fetchGeminiFile } from '../files/google.files.js';
import type {
  GeminiContent,
  GeminiFinishReason,
  GeminiGenerateContentRequest,
  GeminiGenerateContentResponse,
  GeminiGenerationConfig,
  GeminiPart,
  GeminiUsageMetadata,
} from './google.responses.types.js';

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
export async function toGoogleBody(
  client: GoogleClient,
  params: ResponsesCreateParams,
): Promise<GeminiGenerateContentRequest> {
  const systemTexts: string[] = [];
  if (params.instructions) systemTexts.push(params.instructions);

  const contents: GeminiContent[] = [];

  for (const msg of params.input) {
    // system/developer no soportan archivos en Gemini → solo concat texto y van
    // a systemInstruction (separado de contents[]).
    if (msg.role === 'system' || msg.role === 'developer') {
      const text = msg.content
        .filter((p): p is InputText => p.type === 'input_text')
        .map((p) => p.text)
        .join('');
      systemTexts.push(text);
      continue;
    }

    const parts = await toGoogleParts(client, msg.content);

    // Gemini usa "model" donde Helix (y OpenAI) usan "assistant". Si en el curl pones
    // "role": "assistant" directo, Gemini te devuelve 400 INVALID_ARGUMENT.
    // "user" sí coincide en ambos lados → mapeo directo.
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts,
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

  if (format?.type === 'json_object' || format?.type === 'json_schema') {
    generationConfig.responseMimeType = 'application/json';

    if (format.type === 'json_schema') {
      generationConfig.responseSchema = toGeminiStructuredOutputSchema(
        format.schema,
      );
    }
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

// Convierte los InputContentPart de Helix a GeminiPart,
// resolviendo archivos con la Files API de Gemini.
// TODO Google

async function toGoogleParts(
  client: GoogleClient,
  content: InputContentPart[],
): Promise<GeminiPart[]> {
  return Promise.all(content.map((p) => toGooglePart(client, p)));
}

// Es necesaria esta transformacion
// Helix espera {file_id: string}
// Gemini espera {fileUri: string, mimeType: string}.
async function toGooglePart(
  client: GoogleClient,
  p: InputContentPart,
): Promise<GeminiPart> {
  if (p.type === 'input_text') return { text: p.text };

  const file = await fetchGeminiFile(client, p.file_id);
  return { fileData: { mimeType: file.mimeType, fileUri: file.uri } };
}

// ── Gemini → Helix (response) ────────────────────────────────────────────────
export function toHelixResponse(
  raw: GeminiGenerateContentResponse,
  provider: string,
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
    finish_reason: toIncompleteDetails(finishReason),
    error: null,
    model: String(raw.modelVersion),
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
    metadata: { [provider]: raw },
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
): HelixFinishReason | null {
  switch (reason) {
    case 'MAX_TOKENS':
      return 'max_tokens';
    case 'SAFETY':
    case 'RECITATION':
    case 'BLOCKLIST':
    case 'PROHIBITED_CONTENT':
    case 'SPII':
    case 'IMAGE_SAFETY':
    case 'IMAGE_PROHIBITED_CONTENT':
    case 'IMAGE_RECITATION':
      return 'content_filter';
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
