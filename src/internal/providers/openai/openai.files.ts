import type OpenAI from "openai";
import type { Helix } from "../../../createHelix.js";
import type { FileObject, FilesCreateParams } from "../../../core/types/responses/file.response.js";

async function createFile(client: OpenAI, params: FilesCreateParams): Promise<FileObject> {
  const file =
    params.file instanceof File
      ? params.file
      : new File([params.file], "blob", { type: params.file.type || "application/octet-stream" });
  return (await client.files.create({ ...params, file })) as FileObject;
}

async function listFiles(client: OpenAI): Promise<FileObject[]> {
  const page = await client.files.list();
  return page.data as unknown as FileObject[];
}

async function deleteFile(client: OpenAI, id: string): Promise<{ id: string; deleted: true }> {
  const res = await client.files.delete(id);
  return { id: res.id, deleted: true as const };
}

export function filesHandler(client: OpenAI): Helix["files"] {
  return {
    create: (params) => createFile(client, params),
    list: () => listFiles(client),
    delete: (id) => deleteFile(client, id),
  };
}
