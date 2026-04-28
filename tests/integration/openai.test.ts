import { describe, it, expect } from "vitest";
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
});
