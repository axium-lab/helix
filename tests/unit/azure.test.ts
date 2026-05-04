import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.mock is hoisted before imports; factory runs at module load.
// importOriginal preserves real APIError/RateLimitError/etc. classes so the
// HelixError mapper's `instanceof` checks still work — only constructors are mocked.
vi.mock("openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("openai")>();
  const OpenAI = vi.fn();
  const AzureOpenAI = vi.fn();
  return { ...actual, default: OpenAI, OpenAI, AzureOpenAI };
});

import { AzureOpenAI } from "openai";
import { createAzureAdapter } from "../../src/internal/providers/azure/azure.js";
import { HelixError } from "../../src/core/errors/helix-error.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AZURE_BASE_URL = "https://my.openai.azure.com";
const API_VERSION = "2024-10-01-preview";

const AZURE_RESPONSE_OK = {
  id: "resp_azure_1",
  object: "response",
  created_at: 1714291200,
  model: "gpt-4o-deployment",
  output: [
    {
      type: "message",
      id: "msg_1",
      role: "assistant",
      content: [{ type: "output_text", text: "Azure response", annotations: [] }],
      status: "completed",
    },
  ],
  output_text: "Azure response",
  usage: { input_tokens: 6, output_tokens: 3, total_tokens: 9 },
};

const FILE_OBJECT_OK = {
  id: "file-azure-1",
  object: "file",
  bytes: 512,
  created_at: 1714291200,
  filename: "azure-test.txt",
  purpose: "assistants",
};

const FILE_DELETED_OK = {
  id: "file-xyz",
  object: "file",
  deleted: true,
};

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockResponsesCreate = vi.fn();
const mockFilesCreate = vi.fn();
const mockFilesList = vi.fn();
const mockFilesDelete = vi.fn();

beforeEach(() => {
  vi.mocked(AzureOpenAI).mockImplementation((_opts?: unknown) => ({
    responses: { create: mockResponsesCreate },
    files: { create: mockFilesCreate, list: mockFilesList, delete: mockFilesDelete },
  }) as unknown as InstanceType<typeof AzureOpenAI>);

  [mockResponsesCreate, mockFilesCreate, mockFilesList, mockFilesDelete].forEach(
    (m) => m.mockReset(),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// describe: SDK client construction (REQ-AZ-001)
// ---------------------------------------------------------------------------

describe("createAzureAdapter — SDK client construction", () => {
  it("constructs AzureOpenAI with { apiKey, baseURL, apiVersion }", () => {
    const adapter = createAzureAdapter({
      provider: "azure",
      apiKey: "k",
      baseUrl: AZURE_BASE_URL,
      apiVersion: API_VERSION,
    });
    expect(AzureOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "k", baseURL: AZURE_BASE_URL, apiVersion: API_VERSION }),
    );
    expect(adapter).toBeDefined();
    expect(typeof adapter.responses.create).toBe("function");
    expect(typeof adapter.test).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// describe: responses.create (REQ-AZ-002)
// ---------------------------------------------------------------------------

describe("createAzureAdapter — responses.create", () => {
  it("happy-path: deployment name forwarded as model unchanged", async () => {
    mockResponsesCreate.mockResolvedValue(AZURE_RESPONSE_OK);
    const adapter = createAzureAdapter({
      provider: "azure",
      apiKey: "k",
      baseUrl: AZURE_BASE_URL,
      apiVersion: API_VERSION,
    });

    const result = await adapter.responses.create({
      model: "gpt-4o-deployment",
      input: [{ role: "user", content: [{ type: "input_text", text: "Hello" }] }],
    });

    expect(mockResponsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o-deployment" }),
    );
    expect(result.id).toBe("resp_azure_1");
    expect(result.object).toBe("response");
  });

  it("error mapped to HelixError when SDK throws", async () => {
    mockResponsesCreate.mockRejectedValue(new Error("401 Unauthorized"));
    const adapter = createAzureAdapter({
      provider: "azure",
      apiKey: "k",
      baseUrl: AZURE_BASE_URL,
      apiVersion: API_VERSION,
    });

    const promise = adapter.responses.create({
      model: "gpt-4o-deployment",
      input: [{ role: "user", content: [{ type: "input_text", text: "Hello" }] }],
    });
    await expect(promise).rejects.toBeInstanceOf(HelixError);
    await expect(promise).rejects.toMatchObject({ provider: "azure", category: "unknown" });
  });
});

// ---------------------------------------------------------------------------
// describe: files.create, files.list, files.delete (REQ-AZ-003)
// ---------------------------------------------------------------------------

describe("createAzureAdapter — files.create", () => {
  it("params forwarded to Azure SDK", async () => {
    mockFilesCreate.mockResolvedValue(FILE_OBJECT_OK);
    const adapter = createAzureAdapter({
      provider: "azure",
      apiKey: "k",
      baseUrl: AZURE_BASE_URL,
      apiVersion: API_VERSION,
    });

    const result = await adapter.files.create({
      file: new File(["test content"], "test.txt", { type: "text/plain" }),
      purpose: "assistants",
    });

    expect(mockFilesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "assistants" }),
    );
    expect(result.object).toBe("file");
    expect(result.id).toBe("file-azure-1");
  });
});

describe("createAzureAdapter — files.list", () => {
  it("returns FileObject[]", async () => {
    // adapter does: const page = await client.files.list(); return page.data
    mockFilesList.mockResolvedValue({ data: [FILE_OBJECT_OK] });
    const adapter = createAzureAdapter({
      provider: "azure",
      apiKey: "k",
      baseUrl: AZURE_BASE_URL,
      apiVersion: API_VERSION,
    });

    const result = await adapter.files.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].object).toBe("file");
  });
});

describe("createAzureAdapter — files.delete", () => {
  it("resolves with { id, deleted: true }", async () => {
    // adapter does: const res = await client.files.delete(id); return { id: res.id, deleted: true }
    mockFilesDelete.mockResolvedValue({ id: "file-xyz", deleted: true });
    const adapter = createAzureAdapter({
      provider: "azure",
      apiKey: "k",
      baseUrl: AZURE_BASE_URL,
      apiVersion: API_VERSION,
    });

    const result = await adapter.files.delete("file-xyz");
    expect(result).toEqual({ id: "file-xyz", deleted: true });
  });
});

// ---------------------------------------------------------------------------
// describe: models.list (REQ-AZ-LM-1..7 — replaced REQ-AZ-004)
// ---------------------------------------------------------------------------

describe("createAzureAdapter — models.list", () => {
  it("returns sorted ModelInfo[] on 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        data: [{ id: "gpt-4o" }, { id: "ada-002" }],
      }),
    }));

    const adapter = createAzureAdapter({
      provider: "azure",
      apiKey: "k",
      baseUrl: AZURE_BASE_URL,
      apiVersion: API_VERSION,
    });

    const result = await adapter.models.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].id).toBe("ada-002");
    expect(result[1].id).toBe("gpt-4o");
    for (const m of result) {
      expect(m.object).toBe("model");
      expect(m.created).toBe(0);
      expect(m.owned_by).toBe("azure");
    }
  });
});

// ---------------------------------------------------------------------------
// describe: test() (REQ-AZ-005 replaced — now resolves true on success)
// ---------------------------------------------------------------------------

describe("createAzureAdapter — test()", () => {
  it("resolves true when models.list succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [{ id: "gpt-4o" }] }),
    }));

    const adapter = createAzureAdapter({
      provider: "azure",
      apiKey: "k",
      baseUrl: AZURE_BASE_URL,
      apiVersion: API_VERSION,
    });

    const result = await adapter.test();
    expect(result).toBe(true);
  });

  it("resolves false when models.list throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    }));

    const adapter = createAzureAdapter({
      provider: "azure",
      apiKey: "k",
      baseUrl: AZURE_BASE_URL,
      apiVersion: API_VERSION,
    });

    const result = await adapter.test();
    expect(result).toBe(false);
  });

  it("never rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network failure")));

    const adapter = createAzureAdapter({
      provider: "azure",
      apiKey: "k",
      baseUrl: AZURE_BASE_URL,
      apiVersion: API_VERSION,
    });

    await expect(adapter.test()).resolves.toBe(false);
  });
});
