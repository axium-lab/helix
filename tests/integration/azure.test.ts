import { describe, it, expect } from "vitest";
import { createHelix } from "../../src/index.js";

const env = (k: string): string | undefined => process.env[k];
const hasAzure =
  !!env("HELIX_AZURE_API_KEY") &&
  !!env("HELIX_AZURE_ENDPOINT") &&
  !!env("HELIX_AZURE_API_VERSION") &&
  !!env("HELIX_AZURE_DEPLOYMENT");

const AZURE_MODELS_LIST_ERROR_MSG =
  "helix-lib: 'models.list' not supported by provider 'azure' — Azure data-plane deployment listing was retired April 2024; ARM management plane requires credentials not present in HelixConfig.azure";

describe.skipIf(!hasAzure)("integration: azure", () => {
  it("responses.create round-trips with deployment name as model", async () => {
    const helix = createHelix({
      provider: "azure",
      apiKey: env("HELIX_AZURE_API_KEY")!,
      endpoint: env("HELIX_AZURE_ENDPOINT")!,
      apiVersion: env("HELIX_AZURE_API_VERSION")!,
    });

    const res = await helix.responses.create({
      model: env("HELIX_AZURE_DEPLOYMENT")!,
      input: [{ role: "user", content: [{ type: "input_text", text: "ping" }] }],
    });

    expect(res.object).toBe("response");
    expect(typeof res.id).toBe("string");
  });

  it("models.list() throws with ARM message", () => {
    const helix = createHelix({
      provider: "azure",
      apiKey: env("HELIX_AZURE_API_KEY")!,
      endpoint: env("HELIX_AZURE_ENDPOINT")!,
      apiVersion: env("HELIX_AZURE_API_VERSION")!,
    });

    expect(() => helix.models.list()).toThrow(AZURE_MODELS_LIST_ERROR_MSG);
  });

  it("test() resolves false", async () => {
    const helix = createHelix({
      provider: "azure",
      apiKey: env("HELIX_AZURE_API_KEY")!,
      endpoint: env("HELIX_AZURE_ENDPOINT")!,
      apiVersion: env("HELIX_AZURE_API_VERSION")!,
    });

    const result = await helix.test();
    expect(result).toBe(false);
  });
});
