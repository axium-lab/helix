export type {
  HelixProviderKind,
  VertexCredentials,
  HelixConfig,
} from "./types/config.js";

export type {
  HelixRole,
  InputText,
  InputFile,
  InputContentPart,
  InputMessage,
  HelixResponseFormat,
  ResponsesCreateParams,
} from "./types/request.js";

export type {
  OutputTextPart,
  RefusalPart,
  OutputContentPart,
  OutputMessage,
  OutputItem,
  HelixUsage,
  HelixResponse,
  HelixResponseStatus,
  HelixFinishReason,
  HelixResponseMetadata,
} from "./types/responses/llm.response.js";

export type {
  FilesCreateParams,
  FileObject,
  HelixFilePurpose,
} from "./types/responses/file.response.js";

export type { ModelInfo } from "./types/models.js";

export { HelixObject } from "./types/helix-object.js";

export { HelixError, isHelixError } from "./errors/helix-error.js";
export type { HelixErrorCategory, HelixErrorArgs } from "./errors/helix-error.js";
