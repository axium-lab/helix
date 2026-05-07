import { HelixConfig } from "../src/core/index.js";
import { createHelix } from "../src/createHelix.js";
import { runErrorScenarios } from "./manual-errors.js";

// AZURE
const config: HelixConfig = {
  provider: "azure",
  apiKey: process.env.HELIX_AZURE_API_KEY!,
  baseUrl: process.env.HELIX_AZURE_BASE_URL!,
  apiVersion: process.env.HELIX_AZURE_API_VERSION!
};

// OPENAI
// const config: HelixConfig = {
//   provider: "openai",
//   apiKey: process.env.HELIX_OPENAI_API_KEY!
// };

const helix = createHelix(config);

// ── happy path ──────────────────────────────────────────────────────────────

// const ok = await helix.test();
// console.log("test:", ok);

const models = await helix.models.list();
console.log("models:", models.map((m) => m.id));

// ── error scenarios ─────────────────────────────────────────────────────────
// await runErrorScenarios(helix, config);

// ── optional: happy response ─────────────────────────────────────────────────

// const res = await helix.responses.create({
//   model: "gpt-4.1-nano",
//   instructions: "Be concise.",
//   input: [{ role: "user", content: [{ type: "input_text", text: "Say hello in one word." }] }],
//   text: { format: { type: "text" } },
// });
// console.log("response:", res);

// ── optional: files ──────────────────────────────────────────────────────────

// const file = new File(["hello from helix"], "manual.txt", { type: "text/plain" });
// const created = await helix.files.create({ file, purpose: "user_data" });
// console.log("created:", created.id);

// const files = await helix.files.list();
// console.log("files:", files);

// const deleted = await helix.files.delete(created.id);
// console.log("deleted:", deleted);
