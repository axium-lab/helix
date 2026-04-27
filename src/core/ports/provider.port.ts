import type { HelixRequest } from "../types/request.js";
import type { HelixResponse } from "../types/response.js";
import type { ProviderCapabilities } from "../types/capabilities.js";

export interface HelixProvider {
  request(req: HelixRequest): Promise<HelixResponse>;
  capabilities(): ProviderCapabilities;
}
