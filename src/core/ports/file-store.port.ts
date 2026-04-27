export interface UploadInput {
  data: Uint8Array | ArrayBuffer;
  mimeType: string;
  filename?: string;
  ttl?: number;
  purpose?: string;
}

export interface FileRef {
  id: string;
  bytes: number;
  mimeType: string;
  filename?: string;
  createdAt: number;
  expiresAt?: number;
}

export interface HelixFileStore {
  upload(input: UploadInput): Promise<FileRef>;
  list(opts?: { limit?: number }): Promise<FileRef[]>;
  delete(fileId: string): Promise<{ id: string; deleted: true }>;
}
