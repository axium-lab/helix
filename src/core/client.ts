import type { HelixProvider } from "./ports/provider.port.js";
import type { HelixFileStore } from "./ports/file-store.port.js";

export interface HelixClient {
  provider: HelixProvider;
  files?: HelixFileStore;
}
