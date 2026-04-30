/**
 * Discriminator for every public Helix resource.
 *
 * Helix adopts the `object` field convention from OpenAI's wire format
 * to keep parity with the LLM ecosystem and to allow safe runtime
 * discrimination when responses are serialized to JSON.
 *
 * Adding a new resource? Add its kind here, NOT in adapters.
 */
export const HelixObject = {
  Model: "model",
  Response: "response",
  File: "file",
} as const;
