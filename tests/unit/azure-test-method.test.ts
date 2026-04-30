import { describe, it, expect, vi, afterEach } from "vitest";
import { createHelix } from "../../src/index.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const BASE_CONFIG = {
  provider: "azure" as const,
  apiKey: "test-api-key",
  baseUrl: "https://my.openai.azure.com",
  apiVersion: "2024-10-01-preview",
};

describe("azure test() — behavioral regression (REQ-AZ-005 replacement)", () => {
  it("resolves true when models.list succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [{ id: "gpt-4o" }] }),
      })
    ));

    const helix = createHelix(BASE_CONFIG);
    const result = await helix.test();
    expect(result).toBe(true);
  });

  it("resolves false when models.list throws (auth error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      })
    ));

    const helix = createHelix(BASE_CONFIG);
    const result = await helix.test();
    expect(result).toBe(false);
  });

  it("resolves false when models.list throws (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.reject(new TypeError("fetch failed"))
    ));

    const helix = createHelix(BASE_CONFIG);
    const result = await helix.test();
    expect(result).toBe(false);
  });

  it("never rejects — always resolves to boolean", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.reject(new TypeError("catastrophic failure"))
    ));

    const helix = createHelix(BASE_CONFIG);
    await expect(helix.test()).resolves.toBe(false);
  });

  it("resolves true for empty deployments list (models.list does not throw on empty)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      })
    ));

    const helix = createHelix(BASE_CONFIG);
    const result = await helix.test();
    expect(result).toBe(true);
  });
});
