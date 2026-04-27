import type { NativeTool, FunctionTool, ToolChoice } from "./tools.js";

export type HelixRole = "user" | "assistant" | "system" | "developer";

export interface InputText {
  type: "input_text";
  text: string;
}

export interface InputFile {
  type: "input_file";
  file_id: string;
}

export interface InputFileEphemeral {
  type: "input_file";
  data: Uint8Array | ArrayBuffer;
  mimeType: string;
  ttl?: number;
}

export type InputContentPart = InputText | InputFile | InputFileEphemeral;

export interface InputMessage {
  role: HelixRole;
  content: InputContentPart[];
}

export type HelixThinking =
  | { effort: "low" | "medium" | "high" }
  | { budget: number };

export type HelixResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | {
      type: "json_schema";
      name: string;
      schema: object;
      strict?: boolean;
    };

export interface HelixRequestOptions {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  thinking?: HelixThinking;
  responseFormat?: HelixResponseFormat;
  seed?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  strict?: boolean;
}

export interface HelixRequest {
  model: string;
  instructions?: string;
  input: InputMessage[];
  previousResponseId?: string;
  tools?: ReadonlyArray<NativeTool | FunctionTool>;
  toolChoice?: ToolChoice;
  options?: HelixRequestOptions;
}
