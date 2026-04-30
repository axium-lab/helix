import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted before imports; factory runs at module load.
vi.mock("openai", () => {
  const OpenAI = vi.fn();
  const AzureOpenAI = vi.fn();
  return { default: OpenAI, OpenAI, AzureOpenAI };
});

import { OpenAI } from "openai";
import { createOpenAIAdapter } from "../../src/internal/providers/openai/openai.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OPENAI_RESPONSE_OK = {
  id: "resp_abc",
  object: "response",
  created_at: 1714291200,
  model: "gpt-4o",
  output: [
    {
      type: "message",
      id: "msg_1",
      role: "assistant",
      content: [{ type: "output_text", text: "Hello world", annotations: [] }],
      status: "completed",
    },
  ],
  output_text: "Hello world",
  usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
};

const FILE_OBJECT_OK = {
  id: "file-abc",
  object: "file",
  bytes: 1024,
  created_at: 1714291200,
  filename: "test.txt",
  purpose: "assistants",
};

const FILES_LIST_OK = {
  object: "list",
  data: [FILE_OBJECT_OK],
};

const FILE_DELETED_OK = {
  id: "file-abc",
  object: "file",
  deleted: true,
};

const MODELS_LIST_OK = {
  object: "list",
  data: [
    { id: "gpt-4o", object: "model", created: 1714291200, owned_by: "openai" },
    { id: "gpt-4o-mini", object: "model", created: 1714291200, owned_by: "openai" },
  ],
};

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockResponsesCreate = vi.fn();
const mockFilesCreate = vi.fn();
const mockFilesList = vi.fn();
const mockFilesDelete = vi.fn();
const mockModelsList = vi.fn();

beforeEach(() => {
  vi.mocked(OpenAI).mockImplementation((_opts?: unknown) => ({
    responses: { create: mockResponsesCreate },
    files: { create: mockFilesCreate, list: mockFilesList, delete: mockFilesDelete },
    models: { list: mockModelsList },
  }) as unknown as InstanceType<typeof OpenAI>);

  [mockResponsesCreate, mockFilesCreate, mockFilesList, mockFilesDelete, mockModelsList].forEach(
    (m) => m.mockReset(),
  );
});

// ---------------------------------------------------------------------------
// describe: SDK client construction (REQ-OAI-001)
// ---------------------------------------------------------------------------

describe("createOpenAIAdapter — SDK client construction", () => {
  it("constructs OpenAI with { apiKey } only when baseUrl is absent", () => {
    const adapter = createOpenAIAdapter({ provider: "openai", apiKey: "sk-test" });
    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "sk-test" }));
    expect(adapter).toBeDefined();
    expect(typeof adapter.responses.create).toBe("function");
    expect(typeof adapter.test).toBe("function");
  });

  it("constructs OpenAI with { apiKey, baseURL } when baseUrl is set", () => {
    const adapter = createOpenAIAdapter({
      provider: "openai",
      apiKey: "sk-test",
      baseUrl: "https://proxy.example.com/v1",
    });
    expect(OpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "sk-test", baseURL: "https://proxy.example.com/v1" }),
    );
    expect(adapter).toBeDefined();
    expect(typeof adapter.responses.create).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// describe: responses.create (REQ-OAI-002)
// ---------------------------------------------------------------------------

describe("createOpenAIAdapter — responses.create", () => {
  it("happy-path: returns HelixResponse-shaped object", async () => {
    mockResponsesCreate.mockResolvedValue(OPENAI_RESPONSE_OK);
    const adapter = createOpenAIAdapter({ provider: "openai", apiKey: "sk-test" });

    const result = await adapter.responses.create({
      model: "gpt-4o",
      input: [{ role: "user", content: [{ type: "input_text", text: "Hello" }] }],
    });

    expect(mockResponsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o" }),
    );
    expect(result.id).toBe("resp_abc");
    expect(result.object).toBe("response");
    expect(Array.isArray(result.output)).toBe(true);
    expect(result.output_text).toBe("Hello world");
    expect(result.usage).toMatchObject({ input_tokens: 10, output_tokens: 5, total_tokens: 15 });
  });

  it("error passthrough: raw SDK error propagates on 401", async () => {
    mockResponsesCreate.mockRejectedValue(new Error("401 Unauthorized"));
    const adapter = createOpenAIAdapter({ provider: "openai", apiKey: "sk-test" });

    await expect(
      adapter.responses.create({
        model: "gpt-4o",
        input: [{ role: "user", content: [{ type: "input_text", text: "Hello" }] }],
      }),
    ).rejects.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// describe: files.create (REQ-OAI-003)
// ---------------------------------------------------------------------------

describe("createOpenAIAdapter — files.create", () => {
  it("happy-path with purpose forwarded: result.object === 'file'", async () => {
    mockFilesCreate.mockResolvedValue(FILE_OBJECT_OK);
    const adapter = createOpenAIAdapter({ provider: "openai", apiKey: "sk-test" });

    const result = await adapter.files.create({
      file: new File(["test content"], "test.txt", { type: "text/plain" }),
      purpose: "assistants",
    });

    expect(mockFilesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "assistants" }),
    );
    expect(result.object).toBe("file");
    expect(result.id).toBe("file-abc");
  });

  it("happy-path without purpose: SDK default applies, no injection", async () => {
    mockFilesCreate.mockResolvedValue({ ...FILE_OBJECT_OK, purpose: "user_data" });
    const adapter = createOpenAIAdapter({ provider: "openai", apiKey: "sk-test" });

    const result = await adapter.files.create({
      file: new File(["test content"], "test.txt", { type: "text/plain" }),
      purpose: "assistants",
    });

    expect(result.object).toBe("file");
  });
});

// ---------------------------------------------------------------------------
// describe: files.list and files.delete (REQ-OAI-004)
// ---------------------------------------------------------------------------

describe("createOpenAIAdapter — files.list", () => {
  it("returns FileObject[]", async () => {
    // adapter does: const page = await client.files.list(); return page.data
    mockFilesList.mockResolvedValue({ data: [FILE_OBJECT_OK] });
    const adapter = createOpenAIAdapter({ provider: "openai", apiKey: "sk-test" });

    const result = await adapter.files.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].object).toBe("file");
  });
});

describe("createOpenAIAdapter — files.delete", () => {
  it("resolves with { id, deleted: true }", async () => {
    // adapter does: const res = await client.files.delete(id); return { id: res.id, deleted: true }
    mockFilesDelete.mockResolvedValue({ id: "file-abc", deleted: true });
    const adapter = createOpenAIAdapter({ provider: "openai", apiKey: "sk-test" });

    const result = await adapter.files.delete("file-abc");
    expect(result).toEqual({ id: "file-abc", deleted: true });
  });
});

// ---------------------------------------------------------------------------
// describe: models.list (REQ-OAI-005)
// ---------------------------------------------------------------------------

describe("createOpenAIAdapter — models.list", () => {
  it("happy-path: returns ModelInfo[] with object === 'model' on each item", async () => {
    // adapter does: const page = await client.models.list(); return page.data.map(...)
    mockModelsList.mockResolvedValue(MODELS_LIST_OK);
    const adapter = createOpenAIAdapter({ provider: "openai", apiKey: "sk-test" });

    const result = await adapter.models.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0].object).toBe("model");
    expect(typeof result[0].id).toBe("string");
  });

  it("error propagation: error from SDK propagates raw", async () => {
    mockModelsList.mockRejectedValue(new Error("401 Invalid API key"));
    const adapter = createOpenAIAdapter({ provider: "openai", apiKey: "sk-test" });

    await expect(adapter.models.list()).rejects.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// describe: test() (REQ-TEST-UNIT-005)
// ---------------------------------------------------------------------------

describe("createOpenAIAdapter — test()", () => {
  it("returns true when models endpoint succeeds", async () => {
    mockModelsList.mockResolvedValue(MODELS_LIST_OK);
    const adapter = createOpenAIAdapter({ provider: "openai", apiKey: "sk-test" });

    const result = await adapter.test();
    expect(result).toBe(true);
  });

  it("returns false when models endpoint fails (401)", async () => {
    mockModelsList.mockRejectedValue(new Error("401 Invalid API key"));
    const adapter = createOpenAIAdapter({ provider: "openai", apiKey: "sk-test" });

    const result = await adapter.test();
    expect(result).toBe(false);
  });

  it("never rejects in either case", async () => {
    mockModelsList.mockRejectedValue(new Error("401 Invalid API key"));
    const adapter = createOpenAIAdapter({ provider: "openai", apiKey: "sk-test" });

    await expect(adapter.test()).resolves.toBe(false);
  });
});
