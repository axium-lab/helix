import type { HelixConfig } from "../../core/types/config.js";
import type { Helix } from "../../createHelix.js";

type VertexConfig = Extract<HelixConfig, { provider: "vertex" }>;

export function createVertexAdapter(config: VertexConfig): Helix {
  return {
    responses: {
      create(_params) {
        throw new Error("not implemented");
      },
    },
    files: {
      create(_params): Promise<never> {
        throw new Error("helix-lib: 'files.create' not supported by provider 'vertex'");
      },
      list(): Promise<never> {
        throw new Error("helix-lib: 'files.list' not supported by provider 'vertex'");
      },
      delete(_id): Promise<never> {
        throw new Error("helix-lib: 'files.delete' not supported by provider 'vertex'");
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
