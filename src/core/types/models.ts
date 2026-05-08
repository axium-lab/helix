import { type HelixObject } from "./helix-object.js";

export type ModelType = "llm" | "video" | "image";

export interface ModelInfo {
  id: string;
  object: typeof HelixObject.Model;
  type?: ModelType; // TODO - now only undefined because of backward compatibility, but should be required in the future
  created: number;
  tools?: string[];
  display_name?: string;
  owned_by?: string; // TODO - this should be provider "openai | azure | custom" or organization fine-tuned
}
