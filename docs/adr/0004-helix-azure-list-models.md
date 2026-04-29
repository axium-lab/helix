# ADR-0004: Azure models.list via Native Fetch with Hardcoded API Version

- **Date**: 2026-04-28
- **Status**: Accepted (shipped)

## Context

ADR-0003 left Azure `models.list()` as a throw stub, causing `test()` to permanently return `false`. The Azure data-plane deployments listing endpoint exists, but integration testing revealed newer api-versions (including `2025-04-01-preview`) return HTTP 404 — only `2023-03-15-preview` works reliably, confirmed via a sibling project (ocr-ai).

## Decision

Replaced the Azure stub with a native-`fetch` implementation against `{endpoint}/openai/deployments`:

- **`AZURE_DEPLOYMENTS_API_VERSION = "2023-03-15-preview"`** hardcoded as an internal constant, decoupled from `config.apiVersion` (which governs inference calls).
- **`AzureFetchError`** (internal class, not exported): discriminated error with `kind` field — `"auth"` (401), `"config"` (404), `"upstream"` (other non-OK), `"network"` (fetch rejection).
- Response normalized to sorted `ModelInfo[]`; `data.data` missing or empty safely returns `[]`.
- `test()` now returns `true` on successful `models.list()` — closes ADR-0003's known limitation.
- No new runtime dependencies — only `node` built-in `fetch`.

## Consequences

- The hardcoded `2023-03-15-preview` is a vendor quirk helix abstracts; it must be audited if Microsoft updates the deployments listing endpoint.
- `AzureFetchError` is a migration target for the future `helix-error-model` — its `kind/provider/operation` fields align with the planned `HelixError` discriminators.
- `AzureFetchError` must NOT be exported until `helix-error-model` renames and unifies it.
- `created: 0` sentinel from the Azure API renders as epoch (1970) in UIs — consumers must branch on `created === 0`.
