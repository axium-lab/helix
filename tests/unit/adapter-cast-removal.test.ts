import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";

// ---------------------------------------------------------------------------
// REQ-FP-3: openai.ts files.create MUST NOT contain the Parameters<...> cast.
// REQ-FP-4: azure.ts files.create MUST follow the same pattern.
// REQ-FP-6 (superseded by ADR-0007): responses.create cast MUST NOT exist.
//   The carve-out from helix-files-params-tightening was closed by ADR-0007;
//   this assertion now mirrors REQ-FP-3/4 — same regression discipline.
//
// These are source-level regression guards. A future refactor that re-introduces
// the forbidden cast will fail loudly at the NEXT CI run, before merge.
// ---------------------------------------------------------------------------

const FORBIDDEN_FILES_CAST = "as Parameters<typeof client.files.create>[0]";
const FORBIDDEN_RESPONSES_CAST = "as Parameters<typeof client.responses.create>[0]";
const FORBIDDEN_RESPONSE_OUTPUT_CAST = "as unknown as HelixResponse";

describe("adapter parameter-cast removal — REQ-FP-3, REQ-FP-4", () => {
  it("openai.ts files.create body has no Parameters<client.files.create> cast", async () => {
    const source = await readFile(
      new URL("../../src/internal/providers/openai/openai.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain(FORBIDDEN_FILES_CAST);
  });

  it("azure.ts files.create body has no Parameters<client.files.create> cast", async () => {
    const source = await readFile(
      new URL("../../src/internal/providers/azure/azure.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain(FORBIDDEN_FILES_CAST);
  });
});

// ---------------------------------------------------------------------------
// ADR-0007: responses.create cast MUST NOT exist anymore. Closes the carve-out
// left by REQ-FP-6 in `helix-files-params-tightening`. Both the input cast and
// the unsafe `as unknown as HelixResponse` output cast are forbidden in EVERY
// adapter that speaks the OpenAI wire format (OpenAI, Azure).
// ---------------------------------------------------------------------------

const ADAPTERS_OPENAI_SHAPE = [
  {
    name: "openai.responses.ts",
    path: "../../src/internal/providers/openai/openai.responses.ts",
  },
  {
    name: "azure.ts",
    path: "../../src/internal/providers/azure/azure.ts",
  },
];

describe("adapter responses-cast removal — ADR-0007", () => {
  for (const adapter of ADAPTERS_OPENAI_SHAPE) {
    it(`${adapter.name} has no Parameters<client.responses.create> cast`, async () => {
      const source = await readFile(new URL(adapter.path, import.meta.url), "utf8");
      expect(source).not.toContain(FORBIDDEN_RESPONSES_CAST);
    });

    it(`${adapter.name} has no \`as unknown as HelixResponse\` output cast`, async () => {
      const source = await readFile(new URL(adapter.path, import.meta.url), "utf8");
      expect(source).not.toContain(FORBIDDEN_RESPONSE_OUTPUT_CAST);
    });
  }
});
