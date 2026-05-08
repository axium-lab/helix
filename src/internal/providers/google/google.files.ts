import type GoogleOpenAI from "openai";
import type { Helix } from "../../../createHelix.js";

export function filesHandler(_client: GoogleOpenAI): Helix["files"] {
  return {
    create(_params): Promise<never> {
      throw new Error("helix-lib: 'files.create' not supported by provider 'google'");
    },
    list(): Promise<never> {
      throw new Error("helix-lib: 'files.list' not supported by provider 'google'");
    },
    delete(_id): Promise<never> {
      throw new Error("helix-lib: 'files.delete' not supported by provider 'google'");
    },
  };
}
