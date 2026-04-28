export type HelixRole = "user" | "assistant" | "system" | "developer";

export interface InputText {
  type: "input_text";
  text: string;
}

export interface InputFile {
  type: "input_file";
  file_id: string;
}

export type InputContentPart = InputText | InputFile;

export interface InputMessage {
  role: HelixRole;
  content: InputContentPart[];
}

export type HelixResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; name: string; schema: object; strict?: boolean };

export interface ResponsesCreateParams {
  model: string;
  input: InputMessage[];
  instructions?: string;
  temperature?: number;
  max_output_tokens?: number;
  text?: { format?: HelixResponseFormat };
}
