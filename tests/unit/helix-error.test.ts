import { describe, it, expect } from "vitest";
import { HelixError, isHelixError } from "../../src/core/errors/helix-error.js";

describe("HelixError — construction", () => {
  it("extends Error", () => {
    const err = new HelixError({ category: "auth_error", provider: "openai", message: "bad key" });
    expect(err instanceof Error).toBe(true);
    expect(err instanceof HelixError).toBe(true);
  });

  it("name is 'HelixError'", () => {
    const err = new HelixError({ category: "unknown", provider: "openai", message: "x" });
    expect(err.name).toBe("HelixError");
  });

  it("carries category, provider, message", () => {
    const err = new HelixError({ category: "rate_limit", provider: "azure", message: "throttled" });
    expect(err.category).toBe("rate_limit");
    expect(err.provider).toBe("azure");
    expect(err.message).toBe("throttled");
  });

  it("httpStatus, requestId, meta are optional", () => {
    const minimal = new HelixError({ category: "unknown", provider: "custom", message: "x" });
    expect(minimal.httpStatus).toBeUndefined();
    expect(minimal.requestId).toBeUndefined();
    expect(minimal.meta).toBeUndefined();

    const full = new HelixError({
      category: "rate_limit",
      provider: "openai",
      message: "x",
      httpStatus: 429,
      requestId: "req_123",
      meta: { retryAfter: 5 },
    });
    expect(full.httpStatus).toBe(429);
    expect(full.requestId).toBe("req_123");
    expect(full.meta).toEqual({ retryAfter: 5 });
  });

  it("cause propagates via Error.cause (ES2022)", () => {
    const original = new Error("network down");
    const err = new HelixError({ category: "connection_error", provider: "openai", message: "x", cause: original });
    expect(err.cause).toBe(original);
  });

});

describe("isHelixError type guard", () => {
  it("returns true for a HelixError instance", () => {
    const err = new HelixError({ category: "unknown", provider: "openai", message: "x" });
    expect(isHelixError(err)).toBe(true);
  });

  it("returns false for a plain Error", () => {
    expect(isHelixError(new Error("plain"))).toBe(false);
  });

  it("returns false for null, undefined, primitives, plain objects", () => {
    expect(isHelixError(null)).toBe(false);
    expect(isHelixError(undefined)).toBe(false);
    expect(isHelixError("string")).toBe(false);
    expect(isHelixError(42)).toBe(false);
    expect(isHelixError({ category: "auth_error" })).toBe(false);
  });

  it("narrows type so category/provider are accessible", () => {
    const value: unknown = new HelixError({
      category: "rate_limit",
      provider: "openai",
      message: "x",
      httpStatus: 429,
    });
    if (isHelixError(value)) {
      expect(value.category).toBe("rate_limit");
      expect(value.provider).toBe("openai");
      expect(value.httpStatus).toBe(429);
    } else {
      expect.fail("guard should have returned true");
    }
  });
});
