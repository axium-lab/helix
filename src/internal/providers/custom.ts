import type { HelixConfig } from "../../core/types/config.js";
import type { Helix } from "../../createHelix.js";

type CustomConfig = Extract<HelixConfig, { provider: "custom" }>;

export function createCustomAdapter(config: CustomConfig): Helix {
  return {
    responses: {
      create(_params) {
        throw new Error("not implemented");
      },
    },
    files: {
      create(_params): Promise<never> {
        throw new Error("helix-lib: 'files.create' not supported by provider 'custom'");
      },
      list(): Promise<never> {
        throw new Error("helix-lib: 'files.list' not supported by provider 'custom'");
      },
      delete(_id): Promise<never> {
        throw new Error("helix-lib: 'files.delete' not supported by provider 'custom'");
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
