import type { HelixConfig } from "../../core/types/config.js";
import type { Helix } from "../../createHelix.js";

type AzureConfig = Extract<HelixConfig, { provider: "azure" }>;

export function createAzureAdapter(config: AzureConfig): Helix {
  return {
    responses: {
      create(_params) {
        throw new Error("not implemented");
      },
    },
    files: {
      create(_params) {
        throw new Error("not implemented");
      },
      list() {
        throw new Error("not implemented");
      },
      delete(_id) {
        throw new Error("not implemented");
      },
    },
    models: {
      list() {
        throw new Error("not implemented");
      },
    },
    async test() {
      try {
        await this.models.list();
        return true;
      } catch {
        return false;
      }
    },
  };
}
