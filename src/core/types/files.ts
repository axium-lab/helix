export interface FilesCreateParams {
  file: Uint8Array | ArrayBuffer | Blob;
  purpose?: string;
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
