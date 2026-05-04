import { AzureOpenAI } from "openai";
import type { HelixConfig } from "../../../core/types/config.js";
import type { Helix } from "../../../createHelix.js";
import type { FileObject } from "../../../core/types/responses/file.response.js";
import type { ModelInfo } from "../../../core/types/models.js";
import { HelixObject } from "../../../core/types/helix-object.js";
import { toHelixResponse, toOpenAIParams } from "../_shared/openai-shape.mappers.js";

// Azure data-plane /openai/deployments listing only works on older preview
// api-versions. Newer versions (e.g. 2024-10-21, 2025-04-01-preview) return
// HTTP 404 for this base URL even though they are valid for inference.
// This constant is intentionally decoupled from `config.apiVersion`.
const AZURE_DEPLOYMENTS_API_VERSION = "2023-03-15-preview";

type AzureConfig = Extract<HelixConfig, { provider: "azure" }>;

export function createAzureAdapter(config: AzureConfig): Helix {
  const client = new AzureOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    apiVersion: config.apiVersion,
  });

  return {
    responses: {
      async create(params) {
        const raw = await client.responses.create(toOpenAIParams(params));
        return toHelixResponse(raw);
      },
    },
    files: {
      async create(params) {
        const file =
          params.file instanceof File
            ? params.file
            : new File([params.file], "blob", { type: params.file.type || "application/octet-stream" });
        return (await client.files.create({ ...params, file })) as FileObject;
      },
      async list() {
        const page = await client.files.list();
        return page.data as unknown as FileObject[];
      },
      async delete(id) {
        const res = await client.files.delete(id);
        return { id: res.id, deleted: true as const };
      },
    },
    models: {
      async list(): Promise<ModelInfo[]> {
        const url = `${config.baseUrl.replace(/\/$/, "")}/openai/deployments?api-version=${AZURE_DEPLOYMENTS_API_VERSION}`;
        let res: Response;

        try {
          res = await fetch(url, {
            headers: {
              "api-key": config.apiKey,
            },
          });
        } catch (err) {
          throw new Error(`helix-lib: Azure models.list — network error: ${(err as Error).message}`);
        }
        if (res.status === 401) {
          throw new Error(`helix-lib: Azure models.list — authentication failed with provided API key (HTTP 401)`);
        }
        if (res.status === 404) {
          throw new Error(`helix-lib: Azure models.list — endpoint not found. This may be due to an incompatible API version. Ensure that the base URL and API version in your configuration are correct (HTTP 404)`);
        }
        if (!res.ok) {
          throw new Error(`helix-lib: Azure models.list — failed to fetch deployments: ${res.status} ${res.statusText}`);
        }
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        const deployments = data.data ?? [];
        return deployments
          .map((d) => ({
            id: d.id,
            object: HelixObject.Model,
            type: undefined,
            created: 0,
            tools: [],
            owned_by: "azure",
          }))
          .sort((a, b) => a.id.localeCompare(b.id));
      },
    },
    async test() {
      try {
        await this.models.list();
        return true;
      } catch {
        return false;
      }
    },
  };
}
