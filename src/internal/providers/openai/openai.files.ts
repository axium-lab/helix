import type OpenAI from 'openai';
import type { Helix } from '../../../createHelix.js';
import type {
  FileObject,
  FilesCreateParams,
} from '../../../core/types/responses/file.response.js';
import {
  toHelixFileObject,
  toOpenAIFilesCreateBody,
} from '../_shared/openai.mapper.js';
import { mapOpenAIError } from './openai.errors.js';

async function createFile(
  client: OpenAI,
  params: FilesCreateParams,
): Promise<FileObject> {
  try {
    const file = await client.files.create(toOpenAIFilesCreateBody(params));
    return toHelixFileObject(file);
  } catch (err) {
    throw mapOpenAIError(err);
  }
}

async function getFile(client: OpenAI, id: string): Promise<FileObject> {
  try {
    const file = await client.files.retrieve(id);
    return toHelixFileObject(file);
  } catch (err) {
    throw mapOpenAIError(err);
  }
}

async function listFiles(client: OpenAI): Promise<FileObject[]> {
  try {
    // TODO: Pagination ??????
    const page = await client.files.list({
      limit: 1000,
    });

    return page.data.map((page) => toHelixFileObject(page));
  } catch (err) {
    throw mapOpenAIError(err);
  }
}

async function deleteFile(
  client: OpenAI,
  id: string,
): Promise<{ id: string; deleted: true }> {
  try {
    const res = await client.files.delete(id);
    return { id: res.id, deleted: true as const };
  } catch (err) {
    throw mapOpenAIError(err);
  }
}

export function filesHandler(client: OpenAI): Helix['files'] {
  return {
    create: (params) => createFile(client, params),
    get: (id) => getFile(client, id),
    list: () => listFiles(client),
    delete: (id) => deleteFile(client, id),
  };
}
