export interface ModelInfo {
  id: string;
  object: "model";
  created: number;
  tools: string[];
  owned_by?: string;
}
