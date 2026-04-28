import { describe, it, expect } from "vitest";
import type { FilesCreateParams, HelixFilePurpose } from "../../src/index.js";

// ---------------------------------------------------------------------------
// REQ-FP-1: FilesCreateParams.file MUST be File | Blob.
// REQ-FP-2: FilesCreateParams.purpose MUST be required, typed HelixFilePurpose.
//
// How @ts-expect-error works here:
//   Each directive tells the TypeScript compiler "I expect an error on the next
//   line." If the next line DOES produce a type error, the test passes. If it
//   does NOT (because the type is still too permissive), the directive itself
//   becomes an error and the test suite fails.
//
//   The runtime assertions (expect(...).toBeDefined()) are no-ops; the real
//   assertion is the type-checker gate during vitest's TS transform.
// ---------------------------------------------------------------------------

describe("FilesCreateParams type contract — REQ-FP-1, REQ-FP-2", () => {
  // -------------------------------------------------------------------------
  // Rejected inputs (FP-1-C, FP-1-D, FP-2-A, FP-2-B)
  // -------------------------------------------------------------------------

  it("FP-1-C: rejects Uint8Array for `file`", () => {
    const buf = new Uint8Array([1, 2, 3]);
    // @ts-expect-error — Uint8Array is no longer accepted; must be File | Blob
    const params: FilesCreateParams = { file: buf, purpose: "user_data" };
    expect(params).toBeDefined();
  });

  it("FP-1-D: rejects ArrayBuffer for `file`", () => {
    const ab = new ArrayBuffer(8);
    // @ts-expect-error — ArrayBuffer is no longer accepted; must be File | Blob
    const params: FilesCreateParams = { file: ab, purpose: "user_data" };
    expect(params).toBeDefined();
  });

  it("FP-2-A: rejects when `purpose` is omitted (it is now required)", () => {
    const file = new File(["x"], "x.txt", { type: "text/plain" });
    // @ts-expect-error — purpose is now a required field
    const params: FilesCreateParams = { file };
    expect(params).toBeDefined();
  });

  it("FP-2-B: rejects strings outside the HelixFilePurpose union", () => {
    const file = new File(["x"], "x.txt", { type: "text/plain" });
    // @ts-expect-error — "anything" is not a member of HelixFilePurpose
    const params: FilesCreateParams = { file, purpose: "anything" };
    expect(params).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Accepted inputs (FP-1-A, FP-1-B, FP-2-C)
  // -------------------------------------------------------------------------

  it("FP-1-A: accepts File for `file`", () => {
    const file = new File(["x"], "x.txt", { type: "text/plain" });
    const params: FilesCreateParams = { file, purpose: "user_data" };
    expect(params.file).toBeInstanceOf(File);
  });

  it("FP-1-B: accepts Blob for `file`", () => {
    const blob = new Blob(["x"], { type: "text/plain" });
    const params: FilesCreateParams = { file: blob, purpose: "assistants" };
    expect(params.file).toBeInstanceOf(Blob);
  });

  it("FP-2-C: HelixFilePurpose mirrors all six SDK values", () => {
    const purposes: HelixFilePurpose[] = [
      "assistants",
      "batch",
      "fine-tune",
      "vision",
      "user_data",
      "evals",
    ];
    expect(purposes).toHaveLength(6);
  });
});
