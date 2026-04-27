export type NativeToolName =
  | "web_search"
  | "file_search"
  | "code_interpreter"
  | "google_search";

export interface NativeTool {
  type: "native";
  name: NativeToolName;
  config?: Record<string, unknown>;
}

export interface FunctionTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: object;
    strict?: boolean;
  };
}

export type ToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "function"; name: string };
