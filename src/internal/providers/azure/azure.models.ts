import type { HelixConfig } from '../../../core/types/config.js';
import { Helix } from '../../../createHelix.js';
import { HelixObject } from '../../../core/types/helix-object.js';
import { ModelInfo } from '../../../core/index.js';
import { azureFetchHttpError, azureFetchNetworkError } from './azure.errors.js';

// Azure data-plane /openai/deployments listing only works on older preview
// api-versions. Newer versions (e.g. 2024-10-21, 2025-04-01-preview) return
// HTTP 404 for this base URL even though they are valid for inference.
// This constant is intentionally decoupled from `config.apiVersion`.
const AZURE_DEPLOYMENTS_API_VERSION = '2023-03-15-preview';

type AzureConfig = Extract<HelixConfig, { provider: 'azure' }>;

async function list(config: AzureConfig): Promise<ModelInfo[]> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/openai/deployments?api-version=${AZURE_DEPLOYMENTS_API_VERSION}`;
  let res: Response;

  try {
    res = await fetch(url, {
      headers: {
        'api-key': config.apiKey,
      },
    });
  } catch (err) {
    // Solo entramos aquí por errores de red (p. ej. DNS, timeout, CORS).
    throw azureFetchNetworkError({
      operation: 'models.list',
      message: 'helix-lib: Azure models.list — network error (see cause)',
      cause: err,
    });
  }

  const azureRequestId =
    res.headers.get('x-ms-request-id') ??
    res.headers.get('apim-request-id') ??
    undefined;

  if (!res.ok) {
    const message =
      res.status === 401
        ? 'helix-lib: Azure models.list — invalid api-key (HTTP 401)'
        : res.status === 404
          ? `helix-lib: Azure models.list — deployments listing apiVersion '${AZURE_DEPLOYMENTS_API_VERSION}' rejected by base URL '${config.baseUrl}' (HTTP 404). The hardcoded data-plane listing version may have been retired by Microsoft.`
          : `helix-lib: Azure models.list — failed to fetch deployments: ${res.status} ${res.statusText}`;

    throw azureFetchHttpError({
      status: res.status,
      operation: 'models.list',
      message,
      requestId: azureRequestId,
    });
  }

  const data = (await res.json()) as { data?: Array<{ id: string }> };
  const deployments = data.data ?? [];

  return deployments.map((d) => ({
    id: d.id,
    object: HelixObject.Model,
    type: undefined,
    created: 0,
    tools: [],
    owned_by: 'azure',
  }));
}

export function handleModels(config: AzureConfig): Helix['models'] {
  return {
    list: () => list(config),
  };
}
