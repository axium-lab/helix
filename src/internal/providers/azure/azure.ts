import { AzureOpenAI } from "openai";
import type { HelixConfig } from "../../../core/types/config.js";
import type { Helix } from "../../../createHelix.js";
import type { FileObject } from "../../../core/types/responses/file.response.js";
import type { ModelInfo } from "../../../core/types/models.js";
import { HelixObject } from "../../../core/types/helix-object.js";
import { toHelixResponse, toOpenAIParams } from "../_shared/openai.mapper.js";
import { azureFetchHttpError, azureFetchNetworkError, mapAzureError } from "./azure.errors.js";

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
        try {
          const raw = await client.responses.create(toOpenAIParams(params));
          return toHelixResponse(raw, config.provider);
        } catch (err) {
          throw mapAzureError(err);
        }
      },
    },
    files: {
      async create(params) {
        try {
          const file =
            params.file instanceof File
              ? params.file
              : new File([params.file], "blob", { type: params.file.type || "application/octet-stream" });
          return (await client.files.create({ ...params, file })) as FileObject;
        } catch (err) {
          throw mapAzureError(err);
        }
      },
      async list() {
        try {
          const page = await client.files.list();
          return page.data as unknown as FileObject[];
        } catch (err) {
          throw mapAzureError(err);
        }
      },
      async delete(id) {
        try {
          const res = await client.files.delete(id);
          return { id: res.id, deleted: true as const };
        } catch (err) {
          throw mapAzureError(err);
        }
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
          throw azureFetchNetworkError({
            operation: "models.list",
            message: "helix-lib: Azure models.list — network error (see cause)",
            cause: err,
          });
        }
        if (res.status === 401) {
          throw azureFetchHttpError({
            status: 401,
            operation: "models.list",
            message: "helix-lib: Azure models.list — invalid api-key (HTTP 401)",
          });
        }
        if (res.status === 404) {
          throw azureFetchHttpError({
            status: 404,
            operation: "models.list",
            message: `helix-lib: Azure models.list — deployments listing apiVersion '${AZURE_DEPLOYMENTS_API_VERSION}' rejected by base URL '${config.baseUrl}' (HTTP 404). The hardcoded data-plane listing version may have been retired by Microsoft.`,
          });
        }
        if (!res.ok) {
          throw azureFetchHttpError({
            status: res.status,
            operation: "models.list",
            message: `helix-lib: Azure models.list — failed to fetch deployments: ${res.status} ${res.statusText}`,
          });
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