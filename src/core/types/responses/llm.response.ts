import { type HelixObject } from "../helix-object.js";
import { type HelixProviderKind } from "../config.js";

export interface OutputTextPart {
  type: "output_text";
  text: string;
}

export interface RefusalPart {
  type: "refusal";
  refusal: string;
}

export type OutputContentPart = OutputTextPart | RefusalPart;

type OutputRole = "user" | "system" | "assistant" | "tool";

export interface OutputMessage {
  type: "message";
  id: string;
  role: OutputRole;
  content: OutputContentPart[];
  status?: "in_progress" | "completed" | "incomplete";
}

/**
 * v0 supports message output only; tool/refusal/reasoning variants return
 * in the future `helix-tools` and `helix-error-model` changes.
 */
export type OutputItem = OutputMessage;

// quequed y in_progress se consideran "en progreso", completed e incomplete se consideran "finalizados" 
// (aunque incomplete indica que el modelo no pudo completar la respuesta por alguna razon, 
// como max tokens o filtro de contenido, pero no es un error en si mismo) 
export type HelixResponseStatus =
  | "completed"
  | "incomplete"
  | "in_progress"
  | "failed";

// stop_sequence y tool_use reservados: stop_sequence para cuando expongamos stop en params, tool_use para helix-tools
export type HelixFinishReason =
  | "end_turn"
  | "max_tokens"
  | "stop_sequence"
  | "tool_use"
  | "content_filter"
  | "refusal"
  | "error";

export interface HelixUsage {
  input_tokens: number;
  input_tokens_details?: { cached_tokens: number };
  output_tokens: number;
  output_tokens_details?: { reasoning_tokens: number };
  total_tokens: number;
}

export type HelixResponseMetadata = Partial<Record<HelixProviderKind, unknown>>;

export interface HelixResponse {
  id: string;
  object: typeof HelixObject.Response;
  created_at: number;
  completed_at: number | null;
  status: HelixResponseStatus;
  finish_reason: HelixFinishReason | null;
  error: unknown | null;
  model: string;
  output: OutputItem[];
  output_text: string;
  usage: HelixUsage;
  metadata: HelixResponseMetadata;
}
