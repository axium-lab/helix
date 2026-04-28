export interface OutputTextPart {
  type: "output_text";
  text: string;
}

export interface OutputMessage {
  type: "message";
  id: string;
  role: "assistant";
  content: OutputTextPart[];
  status?: "in_progress" | "completed" | "incomplete";
}

/**
 * v0 supports message output only; tool/refusal/reasoning variants return
 * in the future `helix-tools` and `helix-error-model` changes.
 */
export type OutputItem = OutputMessage;

export interface HelixUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface HelixResponse {
  id: string;
  object: "response";
  created_at: number;
  model: string;
  output: OutputItem[];
  output_text: string;
  usage: HelixUsage;
}
