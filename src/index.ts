export type {
  HelixRole,
  InputText,
  InputFile,
  InputFileEphemeral,
  InputContentPart,
  InputMessage,
  HelixThinking,
  HelixResponseFormat,
  HelixRequestOptions,
  HelixRequest,
  OutputTextPart,
  RefusalPart,
  OutputContentPart,
  OutputMessage,
  FunctionCallOutput,
  ReasoningOutput,
  OutputItem,
  HelixUsage,
  HelixResponse,
  NativeToolName,
  NativeTool,
  FunctionTool,
  ToolChoice,
  HelixProviderKind,
  HelixErrorKind,
  HelixErrorInit,
  ProviderCapabilities,
  HelixProvider,
  UploadInput,
  FileRef,
  HelixFileStore,
  HelixClient,
} from "./core/index.js";

export { HelixError } from "./core/index.js";

export type { OpenAIConfig } from "./adapters/openai/factory.js";
export { createOpenAI } from "./adapters/openai/factory.js";

export type { AzureOpenAIConfig } from "./adapters/azure/factory.js";
export { createAzureOpenAI } from "./adapters/azure/factory.js";

export type { OpenAICompatibleConfig } from "./adapters/custom/factory.js";
export { createOpenAICompatible } from "./adapters/custom/factory.js";

export type { VertexCredentials, VertexConfig } from "./adapters/vertex/factory.js";
export { createVertex } from "./adapters/vertex/factory.js";
