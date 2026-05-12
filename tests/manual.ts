import { readFile } from 'node:fs/promises';
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
// const config: HelixConfig = {
//   provider: 'google',
//   apiKey: process.env.HELIX_GOOGLE_API_KEY!,
//   baseUrl: process.env.HELIX_GOOGLE_BASE_URL!,
// };

// OPENAI
const config: HelixConfig = {
  provider: 'openai',
  apiKey: process.env.HELIX_OPENAI_API_KEY!,
};

const helix = createHelix(config);

// ── happy path ──────────────────────────────────────────────────────────────

// const ok = await helix.test();
// console.log('test:', ok);

// ── error scenarios ─────────────────────────────────────────────────────────
// // await runErrorScenarios(helix, config);

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

// const structured = await helix.responses.create({
//   model: 'gemini-3-flash-preview',
//   instructions: 'Devuelve solo JSON válido conforme al schema.',
//   input: [
//     {
//       role: 'user',
//       content: [
//         {
//           type: 'input_text',
//           text: 'Inventate un libro con título, personajes y resumen.',
//         },
//       ],
//     },
//   ],
//   text: {
//     format: {
//       type: 'json_schema',
//       name: 'book_schema',
//       schema: {
//         type: 'object',
//         properties: {
//           titulo: { type: 'string' },
//           personajes: { type: 'array', items: { type: 'string' } },
//           resumen: { type: 'string' },
//         },
//         required: ['titulo', 'personajes', 'resumen'],
//         additionalProperties: false,
//       },
//       strict: true,
//     },
//   },
//   max_output_tokens: 1500,
//   temperature: 0.7,
// });
// console.log(structured);

// ── optional: files ──────────────────────────────────────────────────────────

const bytes = await readFile(new URL('./files/axium.pdf', import.meta.url));
const file = new File([bytes], 'axium.pdf', {
  type: 'application/pdf',
});

const created = await helix.files.create({ file, purpose: 'user_data' });
console.log('created:', created);

const files = await helix.files.list();
console.log('files:', files);

const resWithFile = await helix.responses.create({
  model: 'gpt-5.1',
  input: [
    {
      role: 'user',
      content: [
        { type: 'input_file', file_id: 'file-VHyUHknNTPur9ctFqBV8vC' },
        { type: 'input_text', text: '¿Qué contiene este archivo?' },
      ],
    },
  ],
  max_output_tokens: 200,
  temperature: 0.2,
});
console.log('resWithFileContent:', resWithFile);

// const deleted = await helix.files.delete('file-7g3ojnJbuKyHWTPVz3ffXq');
// console.log('deleted:', deleted);
