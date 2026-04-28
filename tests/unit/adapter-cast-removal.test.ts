import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";

// ---------------------------------------------------------------------------
// REQ-FP-3: openai.ts files.create MUST NOT contain the Parameters<...> cast.
// REQ-FP-4: azure.ts files.create MUST follow the same pattern.
// REQ-FP-6: responses.create cast MUST remain unchanged (negative scope guard).
//
// These are source-level regression guards. A future refactor that re-introduces
// the forbidden cast will fail loudly at the NEXT CI run, before merge.
// ---------------------------------------------------------------------------

const FORBIDDEN_CAST = "as Parameters<typeof client.files.create>[0]";
const REQUIRED_CAST = "as Parameters<typeof client.responses.create>[0]";

describe("adapter parameter-cast removal — REQ-FP-3, REQ-FP-4", () => {
  it("openai.ts files.create body has no Parameters<client.files.create> cast", async () => {
    const source = await readFile(
      new URL("../../src/internal/providers/openai.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain(FORBIDDEN_CAST);
  });

  it("azure.ts files.create body has no Parameters<client.files.create> cast", async () => {
    const source = await readFile(
      new URL("../../src/internal/providers/azure.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain(FORBIDDEN_CAST);
  });
});

// ---------------------------------------------------------------------------
// Phase 4: Negative-scope guard — responses.create cast MUST still be present.
// REQ-FP-6 (ADR-FP-9): the responses.create carve-out is a separate SDD concern.
// This positive assertion locks it in place against accidental removal.
// ---------------------------------------------------------------------------

describe("adapter negative-scope guard — REQ-FP-6", () => {
  it("openai.ts responses.create body STILL contains Parameters<client.responses.create> cast", async () => {
    const source = await readFile(
      new URL("../../src/internal/providers/openai.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain(REQUIRED_CAST);
  });
});
