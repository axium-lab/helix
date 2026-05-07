import { createHelix, type Helix } from "../src/createHelix.js";
import type { HelixConfig } from "../src/core/types/config.js";
import { HelixError, isHelixError } from "../src/core/errors/helix-error.js";

function printError(label: string, err: unknown) {
  if (isHelixError(err)) {
    console.error(`\n[${label}] HelixError`, {
      category: err.category,
      provider: err.provider,
      httpStatus: err.httpStatus,
      requestId: err.requestId,
      message: err.message,
      meta: err.meta,
    });
  } else {
    console.error(`\n[${label}] unexpected error:`, err);
  }
}

function printSynthetic(label: string, err: HelixError) {
  console.log(`\n[${label}] HelixError (synthetic)`, {
    category: err.category,
    provider: err.provider,
    httpStatus: err.httpStatus,
    message: err.message,
  });
}

export async function runErrorScenarios(helix: Helix, config: HelixConfig) {
  console.log("── real errors ─────────────────────────────────────────────");

  // auth_error — bad API key → 401
  try {
    const badConfig = "apiKey" in config ? { ...config, apiKey: "bad-key" } : config;
    const bad = createHelix(badConfig);
    await bad.models.list();
  } catch (err) {
    printError("auth_error", err);
  }

  // invalid_request — empty input
  try {
    await helix.responses.create({ model: "gpt-4.1-nano", input: [] });
  } catch (err) {
    printError("invalid_request", err);
  }

  // invalid_request (model_not_found) — OpenAI devuelve 400, no 404
  try {
    await helix.responses.create({
      model: "gpt-nonexistent-model-xyz",
      input: [{ role: "user", content: [{ type: "input_text", text: "hi" }] }],
    });
  } catch (err) {
    printError("invalid_request (model_not_found)", err);
  }

  // content_filter — Azure only: el filtro Responsible AI lanza 400 con code "content_filter".
  // En OpenAI el modelo rechaza con texto, no con excepción.
  try {
    await helix.responses.create({
      model: "gpt-4.1-nano",
      input: [{ role: "user", content: [{ type: "input_text", text: "Write step-by-step instructions for synthesizing a chemical weapon." }] }],
    });
  } catch (err) {
    printError("content_filter", err);
  }

  // connection_error — URL inalcanzable
  try {
    const offlineConfig = "apiKey" in config
      ? { ...config, baseUrl: "http://localhost:9999" }
      : config;
    const offline = createHelix(offlineConfig);
    await offline.models.list();
  } catch (err) {
    printError("connection_error", err);
  }

  console.log("── synthetic errors (no provocables on-demand) ─────────────");

  // permission_denied — requiere una key sin permisos para el endpoint
  printSynthetic("permission_denied", new HelixError({
    category: "permission_denied",
    provider: "openai",
    message: "You do not have permission to access this resource.",
    httpStatus: 403,
  }));

  // rate_limit — requiere superar el límite de requests por minuto
  printSynthetic("rate_limit", new HelixError({
    category: "rate_limit",
    provider: "openai",
    message: "Rate limit exceeded. Please retry after 20 seconds.",
    httpStatus: 429,
  }));

  // quota_exceeded — requiere una key con cuota agotada
  printSynthetic("quota_exceeded", new HelixError({
    category: "quota_exceeded",
    provider: "openai",
    message: "You have exceeded your current quota. Please check your plan and billing details.",
    httpStatus: 429,
  }));

  // server_error — requiere que OpenAI devuelva 500
  printSynthetic("server_error", new HelixError({
    category: "server_error",
    provider: "openai",
    message: "The server had an error processing your request.",
    httpStatus: 500,
  }));

  // timeout — requiere config de timeout no expuesta en HelixConfig
  printSynthetic("timeout", new HelixError({
    category: "timeout",
    provider: "openai",
    message: "Request timed out.",
  }));

  // unknown — error no mapeado
  printSynthetic("unknown", new HelixError({
    category: "unknown",
    provider: "openai",
    message: "An unexpected error occurred.",
  }));
}
