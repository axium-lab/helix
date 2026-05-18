// Wire-level types para la API REST nativa de Gemini.
// Docu: https://ai.google.dev/api/generate-content

// ── Request ──────────────────────────────────────────────────────────────────

export type GeminiRole = 'user' | 'model';

export interface GeminiFileData {
  mimeType: string;
  fileUri: string;
}

export interface GeminiPart {
  text?: string;
  fileData?: GeminiFileData;
  // Pendiente: inlineData / functionCall / functionResponse cuando agreguemos multimodal/tools.
}

export interface GeminiContent {
  role: GeminiRole;
  parts: GeminiPart[];
}

export interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseMimeType?: string;
  responseSchema?: object;
}

export interface GeminiGenerateContentRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: GeminiPart[] };
  generationConfig?: GeminiGenerationConfig;
}

// ── Response ─────────────────────────────────────────────────────────────────
// Docu Google: https://ai.google.dev/api/generate-content?hl=es-419#FinishReason
export type GeminiFinishReason =
  | 'FINISH_REASON_UNSPECIFIED' // Valor predeterminado, no se usa
  | 'STOP' // Punto de detención natural del modelo o stop sequence
  | 'MAX_TOKENS' // Se alcanzó el max de tokens de la solicitud
  | 'SAFETY' // Contenido marcado por motivos de seguridad
  | 'RECITATION' // Contenido marcado por motivos de recitación
  | 'LANGUAGE' // Contenido en idioma no admitido
  | 'OTHER' // Motivo desconocido
  | 'BLOCKLIST' // Contenido con términos prohibidos
  | 'PROHIBITED_CONTENT' // Posible contenido prohibido
  | 'SPII' // Posible info personal sensible (IIPS)
  | 'MALFORMED_FUNCTION_CALL' // Function call generado por el modelo no es válido
  | 'IMAGE_SAFETY' // Imágenes con incumplimientos de seguridad
  | 'IMAGE_PROHIBITED_CONTENT' // Imágenes con otro contenido prohibido
  | 'IMAGE_OTHER' // Otro problema en generación de imágenes
  | 'NO_IMAGE' // Se esperaba imagen pero no se generó
  | 'IMAGE_RECITATION' // Imágenes detenidas por recitación
  | 'UNEXPECTED_TOOL_CALL' // El modelo llamó a una tool no habilitada
  | 'TOO_MANY_TOOL_CALLS' // Demasiadas tool calls consecutivas
  | 'MISSING_THOUGHT_SIGNATURE' // Falta al menos una firma de pensamiento
  | 'MALFORMED_RESPONSE'; // Respuesta con formato incorrecto

export interface GeminiCandidate {
  content?: GeminiContent;
  finishReason?: GeminiFinishReason;
  index?: number;
}

export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
  thoughtsTokenCount?: number; // tokens de thinking (Gemini 2.5+)
}

export interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  modelVersion?: string;
  responseId: string;
}
