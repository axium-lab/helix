import { describe, it, expect } from "vitest";
import { createHelix } from "../../src/index.js";

const env = (k: string): string | undefined => process.env[k];
const hasCustom = !!env("HELIX_CUSTOM_API_KEY") && !!env("HELIX_CUSTOM_BASE_URL");

describe.skipIf(!hasCustom)("integration: custom", () => {
  it("responses.create round-trips against custom endpoint", async () => {
    const helix = createHelix({
      provider: "custom",
      apiKey: env("HELIX_CUSTOM_API_KEY")!,
      baseUrl: env("HELIX_CUSTOM_BASE_URL")!,
    });

    const res = await helix.responses.create({
      model: env("HELIX_CUSTOM_MODEL") ?? "default",
      input: [{ role: "user", content: [{ type: "input_text", text: "ping" }] }],
    });

    expect(res.object).toBe("response");
    expect(typeof res.id).toBe("string");
  });

  it("models.list() returns ModelInfo[]", async () => {
    const helix = createHelix({
      provider: "custom",
      apiKey: env("HELIX_CUSTOM_API_KEY")!,
      baseUrl: env("HELIX_CUSTOM_BASE_URL")!,
    });

    const models = await helix.models.list();
    expect(Array.isArray(models)).toBe(true);
  });
});
