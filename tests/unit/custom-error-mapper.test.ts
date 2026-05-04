import { describe, it, expect } from "vitest";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from "openai";

import { HelixError } from "../../src/core/errors/helix-error.js";
import {
  customNotSupportedError,
  mapCustomError,
} from "../../src/internal/providers/custom/custom.errors.js";

function buildHeaders(): Headers {
  return new Headers({ "x-request-id": "req_custom_test" });
}

function buildAPIError(status: number, body: unknown): APIError {
  return APIError.generate(status, body as Object | undefined, "msg", buildHeaders());
}

describe("mapCustomError — APIError subclass mapping", () => {
  it("401 → category=auth_error, provider=custom, httpStatus=401", () => {
    const err = buildAPIError(401, { error: { code: "invalid_api_key", message: "bad" } });
    const helix = mapCustomError(err);
    expect(helix).toBeInstanceOf(HelixError);
    expect(helix.category).toBe("auth_error");
    expect(helix.provider).toBe("custom");
    expect(helix.httpStatus).toBe(401);
  });

  it("403 → category=permission_denied", () => {
    const err = buildAPIError(403, { error: { code: "permission_denied", message: "x" } });
    expect(mapCustomError(err).category).toBe("permission_denied");
  });

  it("404 → category=not_found", () => {
    const err = buildAPIError(404, { error: { code: "not_found", message: "x" } });
    expect(mapCustomError(err).category).toBe("not_found");
  });

  it("429 → category=rate_limit", () => {
    const err = buildAPIError(429, { error: { code: "rate_limit", message: "x" } });
    expect(mapCustomError(err).category).toBe("rate_limit");
  });

  it("400 → category=invalid_request", () => {
    const err = buildAPIError(400, { error: { code: "missing_param", message: "x" } });
    expect(mapCustomError(err).category).toBe("invalid_request");
  });

  it("500 → category=server_error", () => {
    const err = buildAPIError(500, { error: { code: "server_error", message: "x" } });
    expect(mapCustomError(err).category).toBe("server_error");
  });
});

describe("mapCustomError — meta.upstream preserves raw body", () => {
  it("upstream body is exposed in meta.upstream for caller debugging", () => {
    const upstreamBody = { code: "vendor_specific_quirk", message: "weird", custom_field: 42 };
    const err = buildAPIError(503, { error: upstreamBody });
    const helix = mapCustomError(err);
    expect(helix.meta?.upstream).toEqual(upstreamBody);
  });
});

describe("mapCustomError — non-APIError SDK errors", () => {
  it("APIConnectionTimeoutError → category=timeout", () => {
    expect(mapCustomError(new APIConnectionTimeoutError({ message: "timed out" })).category).toBe("timeout");
  });

  it("APIConnectionError → category=connection_error", () => {
    expect(mapCustomError(new APIConnectionError({ message: "down" })).category).toBe("connection_error");
  });

  it("APIUserAbortError → category=unknown", () => {
    expect(mapCustomError(new APIUserAbortError()).category).toBe("unknown");
  });

  it("plain Error → category=unknown with cause", () => {
    const original = new Error("weird");
    const helix = mapCustomError(original);
    expect(helix.category).toBe("unknown");
    expect(helix.cause).toBe(original);
  });

  it("already a HelixError → returned as-is", () => {
    const original = new HelixError({ category: "rate_limit", provider: "custom", message: "x" });
    expect(mapCustomError(original)).toBe(original);
  });
});

describe("customNotSupportedError", () => {
  it("returns HelixError with category=invalid_request, provider=custom, meta.reason=not_supported", () => {
    const helix = customNotSupportedError("files.create");
    expect(helix).toBeInstanceOf(HelixError);
    expect(helix.category).toBe("invalid_request");
    expect(helix.provider).toBe("custom");
    expect(helix.meta?.reason).toBe("not_supported");
    expect(helix.meta?.operation).toBe("files.create");
    expect(helix.message).toBe("helix-lib: 'files.create' not supported by provider 'custom'");
  });
});
