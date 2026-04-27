import type { NativeToolName } from "./tools.js";
import type { HelixProviderKind } from "./error.js";

export interface ProviderCapabilities {
  provider: HelixProviderKind;
  files: boolean;
  nativeTools: ReadonlyArray<NativeToolName>;
  thinking: boolean;
  structuredOutput: boolean;
  streaming: false;
}
