import { HelixConfig } from '../src/core/index.js';
import { createHelix } from '../src/createHelix.js';
import { runErrorScenarios } from './manual-errors.js';

// AZURE
// const config: HelixConfig = {
//   provider: 'azure',
//   apiKey: process.env.HELIX_AZURE_API_KEY!,
//   baseUrl: process.env.HELIX_AZURE_BASE_URL!,
//   apiVersion: process.env.HELIX_AZURE_API_VERSION!,
// };

// GOOGLE
const config: HelixConfig = {
  provider: 'google',
  apiKey: process.env.HELIX_GOOGLE_API_KEY!,
  baseUrl: process.env.HELIX_GOOGLE_BASE_URL!,
};

// // OPENAI
// const config: HelixConfig = {
//   provider: 'openai',
//   apiKey: process.env.HELIX_OPENAI_API_KEY!,
// };

const helix = createHelix(config);

// ── happy path ──────────────────────────────────────────────────────────────

const ok = await helix.test();
console.log('test:', ok);

// ── error scenarios ─────────────────────────────────────────────────────────
// await runErrorScenarios(helix, config);

// ── optional: list models ────────────────────────────────────────────────────

// const models = await helix.models.list();
// console.log('models count:', models);

// ── optional: happy response ─────────────────────────────────────────────────

// const res = await helix.responses.create({
//   model: 'gemini-3-flash-preview',
//   instructions: 'Be concise.',
//   input: [
//     {
//       role: 'system',
//       content: [{ type: 'input_text', text: 'Responde brevemente' }],
//     },
//     {
//       role: 'user',
//       content: [{ type: 'input_text', text: 'quiero un rollo' }],
//     },
//   ],
//   text: { format: { type: 'text' } },
//   max_output_tokens: 250,
//   temperature: 0.5,
// });
// console.log(res);

// ── optional: structured output (json_schema) ────────────────────────────────

const structured = await helix.responses.create({
  model: 'gemini-3-flash-preview',
  instructions: 'Devuelve solo JSON válido conforme al schema.',
  input: [
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: 'Inventate un libro con título, personajes y resumen.',
        },
      ],
    },
  ],
  text: {
    format: {
      type: 'json_schema',
      name: 'book_schema',
      schema: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          personajes: { type: 'array', items: { type: 'string' } },
          resumen: { type: 'string' },
        },
        required: ['titulo', 'personajes', 'resumen'],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  max_output_tokens: 1500,
  temperature: 0.7,
});
console.log(structured);

// ── optional: files ──────────────────────────────────────────────────────────

// const file = new File(['hello from helix'], 'manual.txt', {
//   type: 'text/plain',
// });
// const created = await helix.files.create({ file, purpose: 'user_data' });
// console.log('created:', created.id);

// const files = await helix.files.list();
// console.log('files:', files);

// const deleted = await helix.files.delete(created.id);
// console.log('deleted:', deleted);
