import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted before imports; factory runs at module load.
vi.mock("openai", () => {
  const OpenAI = vi.fn();
  const AzureOpenAI = vi.fn();
  return { default: OpenAI, OpenAI, AzureOpenAI };
});

import { OpenAI } from "openai";
import { createCustomAdapter } from "../../src/internal/providers/custom.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_URL = "https://compat.example.com/v1";

const CUSTOM_RESPONSE_OK = {
  id: "resp_custom_1",
  object: "response",
  created_at: 1714291200,
  model: "local-model",
  output: [
    {
      type: "message",
      id: "msg_1",
      role: "assistant",
      content: [{ type: "output_text", text: "Custom response", annotations: [] }],
      status: "completed",
    },
  ],
  output_text: "Custom response",
  usage: { input_tokens: 8, output_tokens: 4, total_tokens: 12 },
};

const MODELS_LIST_OK = {
  object: "list",
  data: [
    { id: "local-model", object: "model", created: 1714291200, owned_by: "custom" },
    { id: "local-model-v2", object: "model", created: 1714291200, owned_by: "custom" },
  ],
};

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockResponsesCreate = vi.fn();
const mockModelsList = vi.fn();

beforeEach(() => {
  vi.mocked(OpenAI).mockImplementation((_opts?: unknown) => ({
    responses: { create: mockResponsesCreate },
    // files.* are not delegated to the SDK on custom — the adapter throws synchronously
    models: { list: mockModelsList },
  }) as unknown as InstanceType<typeof OpenAI>);

  [mockResponsesCreate, mockModelsList].forEach((m) => m.mockReset());
});

// ---------------------------------------------------------------------------
// describe: SDK client construction (REQ-CUSTOM-001)
// ---------------------------------------------------------------------------

describe("createCustomAdapter — SDK client construction", () => {
  it("constructs OpenAI with { apiKey, baseURL } where baseURL equals config.baseUrl", () => {
    const adapter = createCustomAdapter({
      provider: "custom",
      apiKey: "key-abc",
      baseUrl: BASE_URL,
    });
    expect(OpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "key-abc", baseURL: BASE_URL }),
    );
    expect(adapter).toBeDefined();
    expect(typeof adapter.responses.create).toBe("function");
    expect(typeof adapter.test).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// describe: responses.create (REQ-CUSTOM-002)
// ---------------------------------------------------------------------------

describe("createCustomAdapter — responses.create", () => {
  it("happy-path: params forwarded verbatim to custom endpoint", async () => {
    mockResponsesCreate.mockResolvedValue(CUSTOM_RESPONSE_OK);
    const adapter = createCustomAdapter({ provider: "custom", apiKey: "key-abc", baseUrl: BASE_URL });

    const result = await adapter.responses.create({
      model: "local-model",
      input: [{ role: "user", content: [{ type: "input_text", text: "Hello" }] }],
      temperature: 0.3,
    });

    expect(mockResponsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "local-model", temperature: 0.3 }),
    );
    expect(result.id).toBe("resp_custom_1");
    expect(result.object).toBe("response");
    expect(result.output_text).toBe("Custom response");
  });

  it("error propagation: 403 from custom endpoint propagates raw", async () => {
    mockResponsesCreate.mockRejectedValue(new Error("403 Forbidden"));
    const adapter = createCustomAdapter({ provider: "custom", apiKey: "key-abc", baseUrl: BASE_URL });

    await expect(
      adapter.responses.create({
        model: "local-model",
        input: [{ role: "user", content: [{ type: "input_text", text: "Hello" }] }],
      }),
    ).rejects.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// describe: files.* throw stubs (REQ-CUSTOM-004)
// ---------------------------------------------------------------------------

describe("createCustomAdapter — files.create throws", () => {
  const adapter = createCustomAdapter({ provider: "custom", apiKey: "key-abc", baseUrl: BASE_URL });

  it("throws plain Error with exact message", () => {
    expect(() => adapter.files.create({ file: new Uint8Array([1, 2, 3]) }))
      .toThrow("helix-lib: 'files.create' not supported by provider 'custom'");
    try {
      adapter.files.create({ file: new Uint8Array([1, 2, 3]) });
    } catch (e) {
      expect(e instanceof Error).toBe(true);
      expect((e as Error).constructor).toBe(Error);
    }
  });
});

describe("createCustomAdapter — files.list throws", () => {
  const adapter = createCustomAdapter({ provider: "custom", apiKey: "key-abc", baseUrl: BASE_URL });

  it("throws plain Error with exact message", () => {
    expect(() => adapter.files.list())
      .toThrow("helix-lib: 'files.list' not supported by provider 'custom'");
    try {
      adapter.files.list();
    } catch (e) {
      expect(e instanceof Error).toBe(true);
      expect((e as Error).constructor).toBe(Error);
    }
  });
});

describe("createCustomAdapter — files.delete throws", () => {
  const adapter = createCustomAdapter({ provider: "custom", apiKey: "key-abc", baseUrl: BASE_URL });

  it("throws plain Error with exact message", () => {
    expect(() => adapter.files.delete("file-x"))
      .toThrow("helix-lib: 'files.delete' not supported by provider 'custom'");
    try {
      adapter.files.delete("file-x");
    } catch (e) {
      expect(e instanceof Error).toBe(true);
      expect((e as Error).constructor).toBe(Error);
    }
  });
});

// ---------------------------------------------------------------------------
// describe: models.list (REQ-CUSTOM-003)
// ---------------------------------------------------------------------------

describe("createCustomAdapter — models.list", () => {
  it("happy-path: ModelInfo[] from custom endpoint", async () => {
    // adapter does: const page = await client.models.list(); return page.data.map(...)
    mockModelsList.mockResolvedValue(MODELS_LIST_OK);
    const adapter = createCustomAdapter({ provider: "custom", apiKey: "key-abc", baseUrl: BASE_URL });

    const result = await adapter.models.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0].object).toBe("model");
    expect(typeof result[0].id).toBe("string");
  });

  it("error propagation: raw SDK error propagates", async () => {
    mockModelsList.mockRejectedValue(new Error("401 Unauthorized"));
    const adapter = createCustomAdapter({ provider: "custom", apiKey: "key-abc", baseUrl: BASE_URL });

    await expect(adapter.models.list()).rejects.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// describe: test() (REQ-TEST-UNIT-005)
// ---------------------------------------------------------------------------

describe("createCustomAdapter — test()", () => {
  it("returns true when models endpoint succeeds", async () => {
    mockModelsList.mockResolvedValue(MODELS_LIST_OK);
    const adapter = createCustomAdapter({ provider: "custom", apiKey: "key-abc", baseUrl: BASE_URL });

    const result = await adapter.test();
    expect(result).toBe(true);
  });

  it("returns false when models endpoint fails", async () => {
    mockModelsList.mockRejectedValue(new Error("401 Unauthorized"));
    const adapter = createCustomAdapter({ provider: "custom", apiKey: "key-abc", baseUrl: BASE_URL });

    const result = await adapter.test();
    expect(result).toBe(false);
  });

  it("never rejects in either case", async () => {
    mockModelsList.mockRejectedValue(new Error("401 Unauthorized"));
    const adapter = createCustomAdapter({ provider: "custom", apiKey: "key-abc", baseUrl: BASE_URL });

    await expect(adapter.test()).resolves.toBe(false);
  });
});
