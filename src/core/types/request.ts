export type HelixRole = 'user' | 'assistant' | 'system' | 'developer';

export interface InputText {
  type: 'input_text';
  text: string;
}

// Convención OpenAI Responses API para archivos:
//   - file_id:   "file-abc123" (Files API del provider).
//   - file_data: new File([bytes], 'x.pdf', { type: 'application/pdf' })
export interface InputFile {
  type: 'input_file';
  file_id?: string;
  file_data?: File;
}

export type InputContentPart = InputText | InputFile;

export interface InputMessage {
  role: HelixRole;
  content: InputContentPart[];
}

export type HelixResponseFormat =
  | { type: 'text' }
  | { type: 'json_object' }
  | { type: 'json_schema'; name: string; schema: object; strict?: boolean };

export interface ResponsesCreateParams {
  model: string;
  input: InputMessage[];
  instructions?: string;
  temperature?: number;
  max_output_tokens?: number;
  text?: { format?: HelixResponseFormat };
}
