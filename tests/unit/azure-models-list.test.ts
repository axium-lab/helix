import { describe, it, expect, vi, afterEach } from "vitest";
import { createHelix } from "../../src/index.js";
import { isAzureFetchError } from "../../src/internal/providers/azure-errors.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const BASE_CONFIG = {
  provider: "azure" as const,
  apiKey: "test-api-key",
  endpoint: "https://my.openai.azure.com",
  apiVersion: "2024-10-01-preview",
};

function makeOkResponse(data: unknown[]) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data }),
  });
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("azure models.list — happy path", () => {
  it("returns sorted ModelInfo[] from two unordered deployments", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      makeOkResponse([
        { id: "gpt-4o", model: "gpt-4o" },
        { id: "ada-embeddings", model: "text-embedding-ada-002" },
      ])
    ));

    const helix = createHelix(BASE_CONFIG);
    const result = await helix.models.list();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);

    // Should be sorted ascending by id
    expect(result[0].id).toBe("ada-embeddings");
    expect(result[1].id).toBe("gpt-4o");

    // Each item must have the required ModelInfo shape
    for (const item of result) {
      expect(typeof item.id).toBe("string");
      expect(item.object).toBe("model");
      expect(item.created).toBe(0);
      expect(item.owned_by).toBe("azure");
    }
  });

  it("returns [] for 200 with empty data array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => makeOkResponse([])));

    const helix = createHelix(BASE_CONFIG);
    const result = await helix.models.list();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("URL is correctly constructed with trailing-slash normalization", async () => {
    const capturedUrls: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      capturedUrls.push(url);
      return makeOkResponse([]);
    }));

    // Endpoint with trailing slash — must be stripped
    const helix = createHelix({
      ...BASE_CONFIG,
      endpoint: "https://x.azure.com/",
      apiVersion: "2024-10-01-preview",
    });
    await helix.models.list();

    expect(capturedUrls).toHaveLength(1);
    expect(capturedUrls[0]).toBe(
      "https://x.azure.com/openai/deployments?api-version=2023-03-15-preview"
    );
  });

  it("request uses api-key header and no Authorization header", async () => {
    const capturedInits: RequestInit[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedInits.push(init);
      return makeOkResponse([]);
    }));

    const helix = createHelix({ ...BASE_CONFIG, apiKey: "secret-key-xyz" });
    await helix.models.list();

    expect(capturedInits).toHaveLength(1);
    const headers = capturedInits[0].headers as Record<string, string>;
    expect(headers["api-key"]).toBe("secret-key-xyz");
    expect(headers["Authorization"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Error branches (Phase 3)
// ---------------------------------------------------------------------------

function makeErrorResponse(status: number) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: { code: status } }),
  });
}

describe("azure models.list — error branches", () => {
  it("HTTP 401 → AzureFetchError kind:auth", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => makeErrorResponse(401)));

    const helix = createHelix(BASE_CONFIG);
    try {
      await helix.models.list();
      expect.fail("Should have thrown");
    } catch (err) {
      expect(isAzureFetchError(err)).toBe(true);
      if (isAzureFetchError(err)) {
        expect(err.kind).toBe("auth");
        expect(err.status).toBe(401);
        expect(err.operation).toBe("models.list");
        expect(err.provider).toBe("azure");
        expect(err.message).toBe("helix-lib: Azure models.list — invalid api-key (HTTP 401)");
      }
    }
  });

  it("HTTP 404 → AzureFetchError kind:config referencing the hardcoded listing apiVersion", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => makeErrorResponse(404)));

    const helix = createHelix({ ...BASE_CONFIG, apiVersion: "2024-10-01-preview" });
    try {
      await helix.models.list();
      expect.fail("Should have thrown");
    } catch (err) {
      expect(isAzureFetchError(err)).toBe(true);
      if (isAzureFetchError(err)) {
        expect(err.kind).toBe("config");
        expect(err.status).toBe(404);
        expect(err.operation).toBe("models.list");
        expect(err.message).toContain("2023-03-15-preview");
        expect(err.message).toContain("HTTP 404");
      }
    }
  });

  it("HTTP 500 → AzureFetchError kind:upstream with status 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => makeErrorResponse(500)));

    const helix = createHelix(BASE_CONFIG);
    try {
      await helix.models.list();
      expect.fail("Should have thrown");
    } catch (err) {
      expect(isAzureFetchError(err)).toBe(true);
      if (isAzureFetchError(err)) {
        expect(err.kind).toBe("upstream");
        expect(err.status).toBe(500);
        expect(err.message).toContain("500");
      }
    }
  });

  it("HTTP 429 → AzureFetchError kind:upstream with status 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => makeErrorResponse(429)));

    const helix = createHelix(BASE_CONFIG);
    try {
      await helix.models.list();
      expect.fail("Should have thrown");
    } catch (err) {
      expect(isAzureFetchError(err)).toBe(true);
      if (isAzureFetchError(err)) {
        expect(err.kind).toBe("upstream");
        expect(err.status).toBe(429);
        expect(err.message).toContain("429");
      }
    }
  });

  it("fetch rejection → AzureFetchError kind:network with original cause", async () => {
    const originalError = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.reject(originalError)));

    const helix = createHelix(BASE_CONFIG);
    try {
      await helix.models.list();
      expect.fail("Should have thrown");
    } catch (err) {
      expect(isAzureFetchError(err)).toBe(true);
      if (isAzureFetchError(err)) {
        expect(err.kind).toBe("network");
        expect(err.cause).toBe(originalError);
        expect(err.message).toBe("helix-lib: Azure models.list — network error (see cause)");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Completeness: no-filter + undefined data.data (Phase 6)
// ---------------------------------------------------------------------------

describe("azure models.list — completeness (REQ-AZ-LM-2 + REQ-AZ-LM-7)", () => {
  it("undefined data.data → resolves [] without throwing (REQ-AZ-LM-2)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}), // no data property at all
      })
    ));

    const helix = createHelix(BASE_CONFIG);
    const result = await helix.models.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("no filter applied — text-embedding-ada-002, whisper-1, gpt-4o all returned (REQ-AZ-LM-7)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          data: [
            { id: "text-embedding-ada-002" },
            { id: "whisper-1" },
            { id: "gpt-4o" },
          ],
        }),
      })
    ));

    const helix = createHelix(BASE_CONFIG);
    const result = await helix.models.list();

    const ids = result.map((m) => m.id);
    expect(ids).toContain("text-embedding-ada-002");
    expect(ids).toContain("whisper-1");
    expect(ids).toContain("gpt-4o");
    expect(result).toHaveLength(3);
  });
});
