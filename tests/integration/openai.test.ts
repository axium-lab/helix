import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createHelix } from "../../src/index.js";

const hasOpenAI = !!process.env.HELIX_OPENAI_API_KEY;

describe.skipIf(!hasOpenAI)("integration: openai", () => {
  it("responses.create round-trips", async () => {
    const helix = createHelix({
      provider: "openai",
      apiKey: process.env.HELIX_OPENAI_API_KEY!,
    });

    const res = await helix.responses.create({
      model: "gpt-4o-mini",
      input: [{ role: "user", content: [{ type: "input_text", text: "ping" }] }],
    });

    expect(res.object).toBe("response");
    expect(typeof res.id).toBe("string");
    expect(Array.isArray(res.output)).toBe(true);
    expect(res.usage).toBeDefined();
  });

  it("test() resolves true", async () => {
    const helix = createHelix({
      provider: "openai",
      apiKey: process.env.HELIX_OPENAI_API_KEY!,
    });

    const result = await helix.test();
    expect(result).toBe(true);
  });

  it(
    "files lifecycle: create, list, delete",
    async () => {
      const helix = createHelix({
        provider: "openai",
        apiKey: process.env.HELIX_OPENAI_API_KEY!,
      });

      const buffer = await readFile(
        new URL("./fixtures/sample.txt", import.meta.url),
      );
      const file = new File([buffer], "sample.txt", { type: "text/plain" });

      let uploadedId: string | null = null;
      try {
        const uploaded = await helix.files.create({
          file,
          purpose: "user_data",
        });
        uploadedId = uploaded.id;
        expect(uploaded.object).toBe("file");
        expect(typeof uploaded.id).toBe("string");
        expect(uploaded.bytes).toBeGreaterThan(0);
        expect(uploaded.purpose).toBe("user_data");

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

  it(
    "PDF: upload + responses.create with input_file",
    async () => {
      const helix = createHelix({
        provider: "openai",
        apiKey: process.env.HELIX_OPENAI_API_KEY!,
      });

      const buffer = await readFile(
        new URL("./fixtures/fini-2-pages.pdf", import.meta.url),
      );
      const file = new File([buffer], "fini-2-pages.pdf", {
        type: "application/pdf",
      });

      let uploadedId: string | null = null;
      try {
        const uploaded = await helix.files.create({
          file,
          purpose: "user_data",
        });
        uploadedId = uploaded.id;

        const res = await helix.responses.create({
          model: "gpt-4o-mini",
          input: [
            {
              role: "user",
              content: [
                { type: "input_file", file_id: uploadedId },
                {
                  type: "input_text",
                  text: "Summarize this document in one sentence.",
                },
              ],
            },
          ],
        });

        expect(res.object).toBe("response");
        expect(res.output.length).toBeGreaterThan(0);
        expect(res.output[0]?.type).toBe("message");
        expect(res.usage?.input_tokens).toBeGreaterThan(0);
      } finally {
        if (uploadedId) {
          await helix.files.delete(uploadedId);
        }
      }
    },
    60_000,
  );
});
