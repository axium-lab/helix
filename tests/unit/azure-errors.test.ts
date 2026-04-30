import { describe, it, expect } from "vitest";
import { AzureFetchError, isAzureFetchError } from "../../src/internal/providers/azure/azure-errors.js";

describe("AzureFetchError", () => {
  it("extends Error", () => {
    const err = new AzureFetchError({
      kind: "auth",
      message: "test message",
      operation: "models.list",
    });
    expect(err instanceof Error).toBe(true);
  });

  it("carries kind field", () => {
    const err = new AzureFetchError({
      kind: "auth",
      message: "test",
      operation: "models.list",
    });
    expect(err.kind).toBe("auth");
  });

  it("carries all four kind variants", () => {
    const kinds = ["auth", "config", "upstream", "network"] as const;
    for (const kind of kinds) {
      const err = new AzureFetchError({ kind, message: "test", operation: "models.list" });
      expect(err.kind).toBe(kind);
    }
  });

  it("carries status when provided", () => {
    const err = new AzureFetchError({
      kind: "upstream",
      message: "test",
      status: 500,
      operation: "models.list",
    });
    expect(err.status).toBe(500);
  });

  it("status is undefined when not provided", () => {
    const err = new AzureFetchError({
      kind: "network",
      message: "test",
      operation: "models.list",
    });
    expect(err.status).toBeUndefined();
  });

  it("provider is always 'azure'", () => {
    const err = new AzureFetchError({
      kind: "auth",
      message: "test",
      operation: "models.list",
    });
    expect(err.provider).toBe("azure");
  });

  it("carries operation field", () => {
    const err = new AzureFetchError({
      kind: "config",
      message: "test",
      operation: "models.list",
    });
    expect(err.operation).toBe("models.list");
  });

  it("cause propagates via error.cause", () => {
    const originalError = new TypeError("fetch failed");
    const err = new AzureFetchError({
      kind: "network",
      message: "network error",
      operation: "models.list",
      cause: originalError,
    });
    expect(err.cause).toBe(originalError);
  });

  it("name is AzureFetchError", () => {
    const err = new AzureFetchError({
      kind: "auth",
      message: "test",
      operation: "models.list",
    });
    expect(err.name).toBe("AzureFetchError");
  });
});

describe("isAzureFetchError", () => {
  it("returns true for AzureFetchError instance", () => {
    const err = new AzureFetchError({
      kind: "auth",
      message: "test",
      operation: "models.list",
    });
    expect(isAzureFetchError(err)).toBe(true);
  });

  it("returns false for plain Error", () => {
    const err = new Error("plain error");
    expect(isAzureFetchError(err)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAzureFetchError(null)).toBe(false);
  });

  it("returns false for plain object", () => {
    expect(isAzureFetchError({ kind: "auth", message: "test" })).toBe(false);
  });

  it("narrows type correctly — kind is accessible after guard", () => {
    const unknown: unknown = new AzureFetchError({
      kind: "upstream",
      message: "upstream error",
      status: 503,
      operation: "models.list",
    });
    if (isAzureFetchError(unknown)) {
      // TypeScript should narrow here — kind must be accessible
      expect(unknown.kind).toBe("upstream");
      expect(unknown.status).toBe(503);
    } else {
      expect.fail("Guard should have returned true");
    }
  });
});
