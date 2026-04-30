import { AzureOpenAI } from "openai";
import type { HelixConfig } from "../../../core/types/config.js";
import type { Helix } from "../../../createHelix.js";
import type { HelixResponse } from "../../../core/types/responses/llm.response.js";
import type { FileObject } from "../../../core/types/responses/file.response.js";
import type { ModelInfo } from "../../../core/types/models.js";
import { AzureFetchError } from "./azure-errors.js";

// Azure data-plane /openai/deployments listing only works on older preview
// api-versions. Newer versions (e.g. 2024-10-21, 2025-04-01-preview) return
// HTTP 404 for this endpoint even though they are valid for inference.
// This constant is intentionally decoupled from `config.apiVersion`.
const AZURE_DEPLOYMENTS_API_VERSION = "2023-03-15-preview";

type AzureConfig = Extract<HelixConfig, { provider: "azure" }>;

export function createAzureAdapter(config: AzureConfig): Helix {
  const client = new AzureOpenAI({
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    apiVersion: config.apiVersion,
  });

  return {
    responses: {
      async create(params) {
        return client.responses.create(
          params as Parameters<typeof client.responses.create>[0],
        ) as unknown as HelixResponse;
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
        const url = `${config.endpoint.replace(/\/$/, "")}/openai/deployments?api-version=${AZURE_DEPLOYMENTS_API_VERSION}`;
        let res: Response;

        try {
          res = await fetch(url, {
            headers: {
              "api-key": config.apiKey,
            },
          });
        } catch (err) {
          throw new AzureFetchError({
            kind: "network",
            message: "helix-lib: Azure models.list — network error (see cause)",
            operation: "models.list",
            cause: err,
          });
        }
        if (res.status === 401) {
          throw new AzureFetchError({
            kind: "auth",
            message: "helix-lib: Azure models.list — invalid api-key (HTTP 401)",
            status: 401,
            operation: "models.list",
          });
        }
        if (res.status === 404) {
          throw new AzureFetchError({
            kind: "config",
            message: `helix-lib: Azure models.list — deployments listing apiVersion '${AZURE_DEPLOYMENTS_API_VERSION}' rejected by endpoint (HTTP 404). The hardcoded data-plane listing version may have been retired by Microsoft.`,
            status: 404,
            operation: "models.list",
          });
        }
        if (!res.ok) {
          throw new AzureFetchError({
            kind: "upstream",
            message: `helix-lib: Azure models.list — upstream error (HTTP ${res.status})`,
            status: res.status,
            operation: "models.list",
          });
        }
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        const deployments = data.data ?? [];
        return deployments
          .map((d) => ({
            id: d.id,
            object: "model" as const,
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
