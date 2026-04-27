export interface OutputTextPart {
  type: "output_text";
  text: string;
}

export interface RefusalPart {
  type: "refusal";
  refusal: string;
}

export type OutputContentPart = OutputTextPart | RefusalPart;

export interface OutputMessage {
  type: "message";
  id: string;
  role: "assistant";
  content: OutputContentPart[];
  status?: "in_progress" | "completed" | "incomplete";
}

export interface FunctionCallOutput {
  type: "function_call";
  id: string;
  call_id: string;
  name: string;
  arguments: string;
}

export interface ReasoningOutput {
  type: "reasoning";
  id: string;
  summary: Array<{ type: "summary_text"; text: string }>;
}

export type OutputItem = OutputMessage | FunctionCallOutput | ReasoningOutput;

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
  metadata?: Record<string, unknown>;
}
