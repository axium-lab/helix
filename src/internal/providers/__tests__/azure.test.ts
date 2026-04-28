import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted before imports; factory runs at module load.
vi.mock("openai", () => {
  const OpenAI = vi.fn();
  const AzureOpenAI = vi.fn();
  return { default: OpenAI, OpenAI, AzureOpenAI };
});

import { AzureOpenAI } from "openai";
import { createAzureAdapter } from "../azure.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AZURE_ENDPOINT = "https://my.openai.azure.com";
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

const AZURE_MODELS_LIST_ERROR_MSG =
  "helix-lib: 'models.list' not supported by provider 'azure' — Azure data-plane deployment listing was retired April 2024; ARM management plane requires credentials not present in HelixConfig.azure";

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
    // models.list is not delegated to the SDK on Azure — the adapter throws synchronously
  }) as unknown as InstanceType<typeof AzureOpenAI>);

  [mockResponsesCreate, mockFilesCreate, mockFilesList, mockFilesDelete].forEach(
    (m) => m.mockReset(),
  );
});

// ---------------------------------------------------------------------------
// describe: SDK client construction (REQ-AZ-001)
// ---------------------------------------------------------------------------

describe("createAzureAdapter — SDK client construction", () => {
  it("constructs AzureOpenAI with { apiKey, endpoint, apiVersion }", () => {
    const adapter = createAzureAdapter({
      provider: "azure",
      apiKey: "k",
      endpoint: AZURE_ENDPOINT,
      apiVersion: API_VERSION,
    });
    expect(AzureOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "k", endpoint: AZURE_ENDPOINT, apiVersion: API_VERSION }),
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
      endpoint: AZURE_ENDPOINT,
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

  it("error propagation: 401 from Azure propagates raw", async () => {
    mockResponsesCreate.mockRejectedValue(new Error("401 Unauthorized"));
    const adapter = createAzureAdapter({
      provider: "azure",
      apiKey: "k",
      endpoint: AZURE_ENDPOINT,
      apiVersion: API_VERSION,
    });

    await expect(
      adapter.responses.create({
        model: "gpt-4o-deployment",
        input: [{ role: "user", content: [{ type: "input_text", text: "Hello" }] }],
      }),
    ).rejects.toBeDefined();
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
      endpoint: AZURE_ENDPOINT,
      apiVersion: API_VERSION,
    });

    const result = await adapter.files.create({
      file: new Uint8Array([1, 2]),
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
      endpoint: AZURE_ENDPOINT,
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
      endpoint: AZURE_ENDPOINT,
      apiVersion: API_VERSION,
    });

    const result = await adapter.files.delete("file-xyz");
    expect(result).toEqual({ id: "file-xyz", deleted: true });
  });
});

// ---------------------------------------------------------------------------
// describe: models.list throws (REQ-AZ-004)
// ---------------------------------------------------------------------------

describe("createAzureAdapter — models.list", () => {
  const adapter = createAzureAdapter({
    provider: "azure",
    apiKey: "k",
    endpoint: AZURE_ENDPOINT,
    apiVersion: API_VERSION,
  });

  it("throws synchronously with exact ARM message — no HTTP call", () => {
    expect(() => adapter.models.list()).toThrow(AZURE_MODELS_LIST_ERROR_MSG);
  });

  it("error is a plain Error (not a subclass)", () => {
    try {
      adapter.models.list();
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e instanceof Error).toBe(true);
      expect((e as Error).constructor).toBe(Error);
      expect((e as Error).message).toBe(AZURE_MODELS_LIST_ERROR_MSG);
    }
  });
});

// ---------------------------------------------------------------------------
// describe: test() (REQ-AZ-005)
// ---------------------------------------------------------------------------

describe("createAzureAdapter — test()", () => {
  it("always resolves false on Azure (models.list always throws)", async () => {
    const adapter = createAzureAdapter({
      provider: "azure",
      apiKey: "k",
      endpoint: AZURE_ENDPOINT,
      apiVersion: API_VERSION,
    });

    const result = await adapter.test();
    expect(result).toBe(false);
  });

  it("never rejects", async () => {
    const adapter = createAzureAdapter({
      provider: "azure",
      apiKey: "k",
      endpoint: AZURE_ENDPOINT,
      apiVersion: API_VERSION,
    });

    await expect(adapter.test()).resolves.toBe(false);
  });
});
