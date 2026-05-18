import { AzureOpenAI } from 'openai';
import { Helix } from '../../../createHelix.js';
import type {
  FileObject,
  FilesCreateParams,
} from '../../../core/types/responses/file.response.js';
import {
  toHelixFileObject,
  toOpenAIFilesCreateBody,
} from '../_shared/openai.mapper.js';
import { mapAzureError } from './azure.errors.js';

async function createFile(
  client: AzureOpenAI,
  params: FilesCreateParams,
): Promise<FileObject> {
  try {
    const file = await client.files.create(toOpenAIFilesCreateBody(params));
    return toHelixFileObject(file);
  } catch (err) {
    throw mapAzureError(err);
  }
}

async function getFile(client: AzureOpenAI, id: string): Promise<FileObject> {
  try {
    const file = await client.files.retrieve(id);
    return toHelixFileObject(file);
  } catch (err) {
    throw mapAzureError(err);
  }
}

async function listFiles(client: AzureOpenAI): Promise<FileObject[]> {
  try {
    const page = await client.files.list();
    return page.data.map(toHelixFileObject);
  } catch (err) {
    throw mapAzureError(err);
  }
}

async function deleteFile(
  client: AzureOpenAI,
  id: string,
): Promise<{ id: string; deleted: true }> {
  try {
    const res = await client.files.delete(id);
    return { id: res.id, deleted: true as const };
  } catch (err) {
    throw mapAzureError(err);
  }
}

export function handleFiles(client: AzureOpenAI): Helix['files'] {
  return {
    create: (params) => createFile(client, params),
    get: (id) => getFile(client, id),
    list: () => listFiles(client),
    delete: (id) => deleteFile(client, id),
  };
}
