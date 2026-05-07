import { createHelix, type Helix } from "../src/createHelix.js";
import { isHelixError } from "../src/core/errors/helix-error.js";

function printError(label: string, err: unknown) {
  if (isHelixError(err)) {
    console.error(`[${label}] HelixError`, {
      category: err.category,
      provider: err.provider,
      httpStatus: err.httpStatus,
      requestId: err.requestId,
      message: err.message,
      meta: err.meta,
    });
  } else {
    console.error(`[${label}] unexpected error:`, err);
  }
}

export async function runErrorScenarios(helix: Helix, apiKey: string) {
  // auth_error — bad API key
  try {
    const bad = createHelix({ provider: "openai", apiKey: "sk-bad-key" });
    await bad.test();
  } catch (err) {
    printError("auth_error", err);
  }

  // not_found — model that doesn't exist
  try {
    await helix.responses.create({
      model: "gpt-nonexistent-model-xyz",
      input: [{ role: "user", content: [{ type: "input_text", text: "hi" }] }],
    });
  } catch (err) {
    printError("not_found", err);
  }

  // invalid_request — empty input array
  try {
    await helix.responses.create({
      model: "gpt-4.1-nano",
      input: [],
    });
  } catch (err) {
    printError("invalid_request", err);
  }

  // connection_error — unreachable base URL
  try {
    const offline = createHelix({
      provider: "openai",
      apiKey,
      baseUrl: "http://localhost:9999",
    });
    await offline.test();
  } catch (err) {
    printError("connection_error", err);
  }
}
