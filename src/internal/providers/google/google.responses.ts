import type GoogleOpenAI from "openai";
import type { Helix } from "../../../createHelix.js";

export function responsesHandler(_client: GoogleOpenAI): Helix["responses"] {
  return {
    create(_params) {
      throw new Error("not implemented");
    },
  };
}
