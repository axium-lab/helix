import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createHelix } from "../../src/index.js";

const env = (k: string): string | undefined => process.env[k];
const hasAzure =
  !!env("HELIX_AZURE_API_KEY") &&
  !!env("HELIX_AZURE_BASE_URL") &&
  !!env("HELIX_AZURE_API_VERSION") &&
  !!env("HELIX_AZURE_DEPLOYMENT");

describe.skipIf(!hasAzure)("integration: azure", () => {
  it("responses.create round-trips with deployment name as model", async () => {
    const helix = createHelix({
      provider: "azure",
      apiKey: env("HELIX_AZURE_API_KEY")!,
      baseUrl: env("HELIX_AZURE_BASE_URL")!,
      apiVersion: env("HELIX_AZURE_API_VERSION")!,
    });

    const res = await helix.responses.create({
      model: env("HELIX_AZURE_DEPLOYMENT")!,
      input: [{ role: "user", content: [{ type: "input_text", text: "ping" }] }],
    });

    expect(res.object).toBe("response");
    expect(typeof res.id).toBe("string");
  });

  it("models.list returns sorted ModelInfo[]", async () => {
    const helix = createHelix({
      provider: "azure",
      apiKey: env("HELIX_AZURE_API_KEY")!,
      baseUrl: env("HELIX_AZURE_BASE_URL")!,
      apiVersion: env("HELIX_AZURE_API_VERSION")!,
    });

    const result = await helix.models.list();

    expect(Array.isArray(result)).toBe(true);
    for (const item of result) {
      expect(typeof item.id).toBe("string");
      expect(item.object).toBe("model");
      expect(item.created).toBe(0);
      expect(item.owned_by).toBe("azure");
    }
    if (result.length > 1) {
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].id.localeCompare(result[i].id)).toBeLessThanOrEqual(0);
      }
    }
  });

  it("test() resolves true", async () => {
    const helix = createHelix({
      provider: "azure",
      apiKey: env("HELIX_AZURE_API_KEY")!,
      baseUrl: env("HELIX_AZURE_BASE_URL")!,
      apiVersion: env("HELIX_AZURE_API_VERSION")!,
    });

    const result = await helix.test.connection();
    expect(result).toBe(true);
  });

  it(
    "files lifecycle: create, list, delete",
    async () => {
      const helix = createHelix({
        provider: "azure",
        apiKey: env("HELIX_AZURE_API_KEY")!,
        baseUrl: env("HELIX_AZURE_BASE_URL")!,
        apiVersion: env("HELIX_AZURE_API_VERSION")!,
      });

      const buffer = await readFile(
        new URL("./fixtures/sample.txt", import.meta.url),
      );
      const file = new File([buffer], "sample.txt", { type: "text/plain" });

      let uploadedId: string | null = null;
      try {
        const uploaded = await helix.files.create({
          file,
          purpose: "assistants",
        });
        uploadedId = uploaded.id;
        expect(uploaded.object).toBe("file");
        expect(typeof uploaded.id).toBe("string");
        expect(uploaded.bytes).toBeGreaterThan(0);

        const list = await helix.files.list();
        expect(list.some((f) => f.id === uploadedId)).toBe(true);
      } finally {
        if (uploadedId) {
          const del = await helix.files.delete(uploadedId);
          expect(del).toMatchObject({
            id: uploadedId,
            deleted: true,
          });
        }
      }
    },
    30_000,
  );
});
