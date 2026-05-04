import { describe, it, expect } from "vitest";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from "openai";

import { HelixError } from "../../src/core/errors/helix-error.js";
import {
  azureFetchHttpError,
  azureFetchNetworkError,
  mapAzureError,
} from "../../src/internal/providers/azure/azure.errors.js";

function buildHeaders(): Headers {
  return new Headers({ "x-request-id": "req_azure_test" });
}

function buildAPIError(status: number, body: unknown): APIError {
  return APIError.generate(status, body, "msg", buildHeaders());
}

// ---------------------------------------------------------------------------
// SDK error mapping
// ---------------------------------------------------------------------------

describe("mapAzureError — SDK error subclass mapping", () => {
  it("401 → category=auth_error, provider=azure, httpStatus, requestId", () => {
    const err = buildAPIError(401, { error: { code: "invalid_api_key", message: "bad key" } });
    const helix = mapAzureError(err);

    expect(helix).toBeInstanceOf(HelixError);
    expect(helix.category).toBe("auth_error");
    expect(helix.provider).toBe("azure");
    expect(helix.httpStatus).toBe(401);
    expect(helix.requestId).toBe("req_azure_test");
    expect(helix.cause).toBe(err);
  });

  it("403 → category=permission_denied", () => {
    const err = buildAPIError(403, { error: { code: "permission_denied", message: "no" } });
    expect(mapAzureError(err).category).toBe("permission_denied");
  });

  it("404 → category=not_found", () => {
    const err = buildAPIError(404, { error: { code: "DeploymentNotFound", message: "no" } });
    expect(mapAzureError(err).category).toBe("not_found");
  });

  it("429 default → category=rate_limit", () => {
    const err = buildAPIError(429, { error: { code: "rate_limit_exceeded", message: "throttled" } });
    expect(mapAzureError(err).category).toBe("rate_limit");
  });

  it("429 with code=insufficient_quota → category=quota_exceeded", () => {
    const err = buildAPIError(429, { error: { code: "insufficient_quota", message: "quota gone" } });
    expect(mapAzureError(err).category).toBe("quota_exceeded");
  });

  it("500 → category=server_error", () => {
    const err = buildAPIError(500, { error: { code: "server_error", message: "boom" } });
    expect(mapAzureError(err).category).toBe("server_error");
  });
});

describe("mapAzureError — Azure-specific content_filter detection", () => {
  it("400 with code=content_filter → category=content_filter", () => {
    const err = buildAPIError(400, { error: { code: "content_filter", message: "blocked" } });
    expect(mapAzureError(err).category).toBe("content_filter");
  });

  it("400 with innererror.code=ResponsibleAIPolicyViolation → category=content_filter", () => {
    const err = buildAPIError(400, {
      error: {
        message: "blocked",
        innererror: {
          code: "ResponsibleAIPolicyViolation",
          content_filter_result: { hate: { filtered: true, severity: "high" } },
        },
      },
    });
    const helix = mapAzureError(err);
    expect(helix.category).toBe("content_filter");
    expect(helix.meta?.innererror).toBeDefined();
  });

  it("400 generic (no content_filter signal) → category=invalid_request", () => {
    const err = buildAPIError(400, { error: { code: "missing_param", message: "no input" } });
    expect(mapAzureError(err).category).toBe("invalid_request");
  });
});

describe("mapAzureError — non-APIError SDK errors", () => {
  it("APIConnectionTimeoutError → category=timeout", () => {
    const helix = mapAzureError(new APIConnectionTimeoutError({ message: "timed out" }));
    expect(helix.category).toBe("timeout");
  });

  it("APIConnectionError → category=connection_error", () => {
    const helix = mapAzureError(new APIConnectionError({ message: "no connection" }));
    expect(helix.category).toBe("connection_error");
  });

  it("APIUserAbortError → category=unknown", () => {
    const helix = mapAzureError(new APIUserAbortError());
    expect(helix.category).toBe("unknown");
  });

  it("plain Error → category=unknown with cause", () => {
    const original = new Error("weird");
    const helix = mapAzureError(original);
    expect(helix.category).toBe("unknown");
    expect(helix.cause).toBe(original);
  });

  it("already a HelixError → returned as-is", () => {
    const original = new HelixError({ category: "rate_limit", provider: "azure", message: "x" });
    expect(mapAzureError(original)).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// Raw fetch path helpers
// ---------------------------------------------------------------------------

describe("azureFetchHttpError — status → category mapping", () => {
  it("401 → auth_error", () => {
    const helix = azureFetchHttpError({ status: 401, operation: "models.list", message: "401" });
    expect(helix.category).toBe("auth_error");
    expect(helix.provider).toBe("azure");
    expect(helix.httpStatus).toBe(401);
    expect(helix.meta?.operation).toBe("models.list");
  });

  it("403 → permission_denied", () => {
    expect(azureFetchHttpError({ status: 403, operation: "x", message: "" }).category).toBe("permission_denied");
  });

  it("404 → not_found", () => {
    expect(azureFetchHttpError({ status: 404, operation: "x", message: "" }).category).toBe("not_found");
  });

  it("408 → timeout", () => {
    expect(azureFetchHttpError({ status: 408, operation: "x", message: "" }).category).toBe("timeout");
  });

  it("429 → rate_limit", () => {
    expect(azureFetchHttpError({ status: 429, operation: "x", message: "" }).category).toBe("rate_limit");
  });

  it("500 → server_error", () => {
    expect(azureFetchHttpError({ status: 500, operation: "x", message: "" }).category).toBe("server_error");
  });

  it("502 → server_error", () => {
    expect(azureFetchHttpError({ status: 502, operation: "x", message: "" }).category).toBe("server_error");
  });

  it("400 → invalid_request (4xx fallback)", () => {
    expect(azureFetchHttpError({ status: 400, operation: "x", message: "" }).category).toBe("invalid_request");
  });
});

describe("azureFetchNetworkError", () => {
  it("network error → category=connection_error with cause preserved", () => {
    const cause = new TypeError("fetch failed");
    const helix = azureFetchNetworkError({
      operation: "models.list",
      message: "helix-lib: Azure models.list — network error (see cause)",
      cause,
    });
    expect(helix.category).toBe("connection_error");
    expect(helix.provider).toBe("azure");
    expect(helix.cause).toBe(cause);
    expect(helix.meta?.operation).toBe("models.list");
    expect(helix.message).toBe("helix-lib: Azure models.list — network error (see cause)");
  });
});
