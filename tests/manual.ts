import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { HelixConfig } from '../src/core/index.js';
import { createHelix } from '../src/createHelix.js';
// import { runErrorScenarios } from './manual-errors.js';

// AZURE
// const config: HelixConfig = {
//   provider: 'azure',
//   apiKey: process.env.HELIX_AZURE_API_KEY!,
//   baseUrl: process.env.HELIX_AZURE_BASE_URL!,
//   apiVersion: process.env.HELIX_AZURE_API_VERSION!,
// };

// GOOGLE
// const config: HelixConfig = {
//   provider: 'google-aistudio',
//   apiKey: process.env.HELIX_GOOGLE_API_KEY!,
//   baseUrl: process.env.HELIX_GOOGLE_BASE_URL!,
// };

// OPENAI
// const config: HelixConfig = {
//   provider: 'openai',
//   apiKey: process.env.HELIX_OPENAI_API_KEY!,
// };

// VERTEX
const credentials = JSON.parse(
  readFileSync(process.env.HELIX_VERTEX_KEY_FILE ?? './key-axium.json', 'utf8'),
);

const config: HelixConfig = {
  provider: 'vertex',
  projectId: process.env.HELIX_VERTEX_PROJECT_ID!,
  credentials,
  // Bucket
  location: process.env.HELIX_VERTEX_LOCATION!,
  bucketUri: process.env.HELIX_VERTEX_BUCKET_URI!,
};

const helix = createHelix(config);

// ── happy path ──────────────────────────────────────────────────────────────

// const ok = await helix.test.connection();
// console.log('test:', ok);

// ── error scenarios ─────────────────────────────────────────────────────────
// await runErrorScenarios(helix, config);

// ── optional: list models ────────────────────────────────────────────────────

// const models = await helix.models.list();
// console.log('models count:', models);

// ── optional: happy response ─────────────────────────────────────────────────

// const res = await helix.responses.create({
//   model: 'gemini-2.5-flash',
//   instructions: 'Be concise.',
//   input: [
//     {
//       role: 'system',
//       content: [{ type: 'input_text', text: 'Responde brevemente' }],
//     },
//     {
//       role: 'user',
//       content: [{ type: 'input_text', text: 'describe a un gato' }],
//     },
//   ],
//   text: { format: { type: 'text' } },
//   max_output_tokens: 50,
//   temperature: 0.5,
// });
// console.log(res);

// ── optional: structured output (json_schema) ────────────────────────────────

// const structured = await helix.responses.create({
//   model: 'gemini-2.5-flash',
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

// const bytes = await readFile(new URL('./files/axium.pdf', import.meta.url));
// const file = new File([bytes], 'axium.pdf', {
//   type: 'application/pdf',
// });

// const created = await helix.files.create({ file });
// console.log('created:', created);

const files = await helix.files.list();
console.log('files:', files);

// const fileById = await helix.files.get(
//   'gs://axium-test/helix/ceb1048f-ee2b-43cc-a87e-0cb44ee82dbf',
// );
// console.log('fileById:', fileById);

const resWithFile = await helix.responses.create({
  model: 'gemini-2.5-flash',
  input: [
    {
      role: 'user',
      content: [
        {
          type: 'input_file',
          file_id:
            'gs://axium-test/helix/04f1f5c6-46a1-4d40-a1d9-c6c3a68a634f.pdf',
        },
        { type: 'input_text', text: '¿Qué contiene este archivo?' },
      ],
    },
  ],
  max_output_tokens: 200,
  temperature: 0.2,
});
console.log('resWithFileContent:', resWithFile);

// const deleted = await helix.files.delete(
//   'gs://axium-test/helix/ceb1048f-ee2b-43cc-a87e-0cb44ee82dbf',
// );
// console.log('deleted:', deleted);
