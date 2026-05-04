import { describe, it, expect } from "vitest";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from "openai";

import { HelixError } from "../../src/core/errors/helix-error.js";
import { mapOpenAIError } from "../../src/internal/providers/openai/openai.errors.js";

function buildHeaders(values: Record<string, string> = {}): Headers {
  return new Headers({ "x-request-id": "req_test_123", ...values });
}

function buildAPIError(status: number, body: unknown): APIError {
  // APIError.generate is the SDK's own factory — produces the right subclass
  return APIError.generate(status, body as object, "msg", buildHeaders());
}

describe("mapOpenAIError — APIError subclass mapping", () => {
  it("401 AuthenticationError → category=auth_error, httpStatus, requestId", () => {
    const err = buildAPIError(401, { error: { code: "invalid_api_key", message: "bad key" } });
    const helix = mapOpenAIError(err);

    expect(helix).toBeInstanceOf(HelixError);
    expect(helix.category).toBe("auth_error");
    expect(helix.provider).toBe("openai");
    expect(helix.httpStatus).toBe(401);
    expect(helix.requestId).toBe("req_test_123");
    expect(helix.cause).toBe(err);
  });

  it("403 PermissionDeniedError → category=permission_denied", () => {
    const err = buildAPIError(403, { error: { code: "permission_denied", message: "no" } });
    expect(mapOpenAIError(err).category).toBe("permission_denied");
  });

  it("404 NotFoundError → category=not_found", () => {
    const err = buildAPIError(404, { error: { code: "model_not_found", message: "no" } });
    expect(mapOpenAIError(err).category).toBe("not_found");
  });

  it("429 RateLimitError without insufficient_quota code → category=rate_limit", () => {
    const err = buildAPIError(429, { error: { code: "rate_limit_exceeded", message: "throttled" } });
    expect(mapOpenAIError(err).category).toBe("rate_limit");
  });

  it("429 RateLimitError with code=insufficient_quota → category=quota_exceeded", () => {
    const err = buildAPIError(429, { error: { code: "insufficient_quota", message: "quota gone" } });
    expect(mapOpenAIError(err).category).toBe("quota_exceeded");
  });

  it("400 BadRequestError default → category=invalid_request", () => {
    const err = buildAPIError(400, { error: { code: "missing_param", message: "no input" } });
    expect(mapOpenAIError(err).category).toBe("invalid_request");
  });

  it("400 BadRequestError with code=content_filter → category=content_filter", () => {
    const err = buildAPIError(400, { error: { code: "content_filter", message: "blocked" } });
    expect(mapOpenAIError(err).category).toBe("content_filter");
  });

  it("422 UnprocessableEntityError → category=invalid_request", () => {
    const err = buildAPIError(422, { error: { code: "unprocessable", message: "bad" } });
    expect(mapOpenAIError(err).category).toBe("invalid_request");
  });

  it("500 InternalServerError → category=server_error", () => {
    const err = buildAPIError(500, { error: { code: "server_error", message: "boom" } });
    expect(mapOpenAIError(err).category).toBe("server_error");
  });
});

describe("mapOpenAIError — non-APIError SDK errors", () => {
  it("APIConnectionTimeoutError → category=timeout", () => {
    const err = new APIConnectionTimeoutError({ message: "timed out" });
    const helix = mapOpenAIError(err);
    expect(helix.category).toBe("timeout");
    expect(helix.cause).toBe(err);
  });

  it("APIConnectionError → category=connection_error", () => {
    const err = new APIConnectionError({ message: "no connection" });
    expect(mapOpenAIError(err).category).toBe("connection_error");
  });

  it("APIUserAbortError → category=unknown", () => {
    expect(mapOpenAIError(new APIUserAbortError()).category).toBe("unknown");
  });
});

describe("mapOpenAIError — fallback paths", () => {
  it("plain Error → category=unknown with cause preserved", () => {
    const err = new Error("something weird");
    const helix = mapOpenAIError(err);
    expect(helix.category).toBe("unknown");
    expect(helix.message).toBe("something weird");
    expect(helix.cause).toBe(err);
  });

  it("non-Error thrown value → category=unknown with default message", () => {
    const helix = mapOpenAIError("string-thrown-as-error");
    expect(helix.category).toBe("unknown");
    expect(helix.cause).toBe("string-thrown-as-error");
  });

  it("already a HelixError → returned as-is (no double wrap)", () => {
    const original = new HelixError({ category: "rate_limit", provider: "openai", message: "x" });
    expect(mapOpenAIError(original)).toBe(original);
  });
});

describe("mapOpenAIError — meta carries upstream body", () => {
  it("APIError body is exposed via meta.body", () => {
    const err = buildAPIError(400, { error: { code: "missing_param", message: "no input", param: "input" } });
    const helix = mapOpenAIError(err);
    expect(helix.meta).toBeDefined();
    expect(helix.meta?.body).toEqual({ code: "missing_param", message: "no input", param: "input" });
  });
});
