/**
 * SOURCE OF TRUTH: mirrors `openai`'s `FilePurpose` from
 * `node_modules/openai/resources/files.d.ts`.
 * When upgrading the `openai` dependency, audit this union for drift.
 * Helix must ship a patch release that mirrors any new value.
 */
export type HelixFilePurpose =
  | "assistants"
  | "batch"
  | "fine-tune"
  | "vision"
  | "user_data"
  | "evals";

export interface FilesCreateParams {
  file: File | Blob;
  purpose: HelixFilePurpose;
  expires_after?: { anchor: "created_at"; seconds: number };
}

export interface FileObject {
  id: string;
  object: "file";
  bytes: number;
  created_at: number;
  filename?: string;
  purpose: string;
  expires_at?: number;
}
