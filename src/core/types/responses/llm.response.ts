import { type HelixObject } from "../helix-object.js";

export interface OutputTextPart {
  type: "output_text";
  text: string;
}

type OutputRole = "user" | "system" | "assistant" | "tool";

export interface OutputMessage {
  type: "message";
  id: string;
  role: OutputRole;
  content: OutputTextPart[];
  status?: "in_progress" | "completed" | "incomplete";
}

/**
 * v0 supports message output only; tool/refusal/reasoning variants return
 * in the future `helix-tools` and `helix-error-model` changes.
 */
export type OutputItem = OutputMessage;

export type HelixResponseStatus =
  | "completed"
  | "incomplete"
  | "in_progress"
  | "failed";

export interface HelixIncompleteDetails {
  reason: "max_output_tokens" | "content_filter";
}

export interface HelixUsage {
  input_tokens: number;
  input_tokens_details?: { cached_tokens: number };
  output_tokens: number;
  output_tokens_details?: { reasoning_tokens: number };
  total_tokens: number;
}

export interface HelixResponse {
  id: string;
  object: typeof HelixObject.Response;
  created_at: number | null;
  completed_at: number | null;
  status: HelixResponseStatus;
  incomplete_details: HelixIncompleteDetails | null;
  error: unknown | null;
  model: string;
  output: OutputItem[];
  output_text: string;
  usage: HelixUsage;
}
