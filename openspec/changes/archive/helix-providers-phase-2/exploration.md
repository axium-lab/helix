# Exploration: helix-providers-phase-2

## Change context

Phase 2 replaces all four `createHelix` provider stubs (openai, azure, custom, vertex) with real HTTP adapters. Public surface (`createHelix`, `Helix`, all types) is **FROZEN** from Phase 1 v2 — no new exports, no type changes. The stubs currently throw `"not implemented"`; this change makes them functional.

---

## A. HTTP Transport — SDK vs fetch

### OpenAI SDK (v6.x)

- Zero runtime dependencies; uses native `fetch` globally available in Node ≥18 (≥22 per our `engines.node`)
- Supports `baseURL` override natively → the **custom** provider can reuse the same SDK instance
- Full TypeScript types for both Responses API and Files API
- Handles retries, auth headers, error shapes
- `openai@^6` is the current major; the Responses API surface (`openai.responses.*`) is stable in v6

### Azure

- The OpenAI npm package also exports `AzureOpenAI` — same npm install, different class
- Maps cleanly to `HelixConfig.azure` (`endpoint`, `apiKey`, `apiVersion`)
- **Hard problem**: `models.list()` on Azure. The data-plane endpoint (`/openai/deployments?api-version=...`) was retired April 2024. The only current API is the ARM management plane (`management.azure.com/subscriptions/...`) which requires Azure RBAC credentials (NOT the API key). The `HelixConfig.azure` shape carries only `apiKey` — therefore ARM is unreachable.

### Vertex AI

- The `@google-cloud/vertexai` SDK is heavy and pulls in `google-auth-library` + Google Cloud deps (~2.8MB unpacked) → violates **PR2** ("lightest possible")
- Raw `fetch` is viable: Gemini's `generateContent` is a simple POST with a Bearer OAuth2 token
- Auth options:
  1. `{ clientEmail, privateKey }` → sign RSA-SHA256 JWT with `node:crypto` → exchange for access token via `https://oauth2.googleapis.com/token`
  2. `{ keyFile }` → read the JSON file, extract `client_email` + `private_key`, then proceed as above
  3. Absent credentials → Application Default Credentials (ADC): read `GOOGLE_APPLICATION_CREDENTIALS` env var or fall back to the GCE metadata server
- `node:crypto` (built-in Node 22) signs RSA JWTs natively via `crypto.createSign('RSA-SHA256')`
- **Recommendation**: raw `fetch` + `node:crypto`. **Zero new deps.**

### Custom

- OpenAI SDK with `baseURL` override (per spec, "OpenAI-compatible endpoint")
- `HelixConfig.custom` (`apiKey`, `baseUrl`) maps directly: `new OpenAI({ apiKey, baseURL: baseUrl })`
- Same auth model as OpenAI (`Authorization: Bearer ...`)
- No config extension needed

### Transport matrix

| Provider | Approach | New runtime deps |
|----------|----------|------------------|
| openai | `openai` SDK (zero-dep) | `openai` |
| azure | `openai` SDK (`AzureOpenAI` class) | (same `openai`) |
| custom | `openai` SDK (`baseURL` override) | (same `openai`) |
| vertex | raw fetch + `node:crypto` | none |

**One** runtime dep total: `openai`. Vertex uses zero additional deps.

---

## B. Authentication per provider

- **OpenAI**: `new OpenAI({ apiKey, baseURL? })` — SDK handles `Authorization: Bearer`
- **Azure**: `new AzureOpenAI({ apiKey, endpoint, apiVersion })` — SDK handles `api-key` header + `api-version` query param. **Deployment name is passed as the `model` field per call** (Azure URL path requires it; SDK accepts model string as deployment alias).
- **Custom**: `new OpenAI({ apiKey, baseURL })` — Bearer auth
- **Vertex**: obtain OAuth2 access token before each request (cache with ~50min TTL). JWT assertion: header `{alg:"RS256", typ:"JWT"}`, claims `{iss:clientEmail, scope:"https://www.googleapis.com/auth/cloud-platform", aud:"https://oauth2.googleapis.com/token", iat, exp}`. Sign with `node:crypto`. Exchange via POST `oauth2.googleapis.com/token` with `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<jwt>`.

---

## C. Endpoint mapping per capability

### `responses.create`

| Provider | Upstream call | Notes |
|----------|---------------|-------|
| openai | `openai.responses.create({...})` | SDK native Responses API |
| azure | `azure.responses.create({...})` | model field = deployment name |
| custom | `openai.responses.create({...})` | baseURL override |
| vertex | POST `{location}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google/models/{model}:generateContent` | full normalization required |

**Vertex normalization** (`responses.create`):
- `params.input` → `contents[].role/parts` (role: `user`/`model`, parts: `[{text}]`)
- `params.instructions` → `systemInstruction: { parts: [{ text }] }`
- `params.temperature` → `generationConfig.temperature`
- `params.max_output_tokens` → `generationConfig.maxOutputTokens`
- `params.text.format` → `generationConfig.responseMimeType` (`application/json`) or `responseSchema`
- Response `candidates[0].content.parts[0].text` → `output[0].content[0].text`
- `usageMetadata.promptTokenCount` → `usage.input_tokens`
- `usageMetadata.candidatesTokenCount` → `usage.output_tokens`
- `id`: Gemini does NOT return one — synthesize via `crypto.randomUUID()`
- `created_at`: Gemini does NOT return one — use `Math.floor(Date.now() / 1000)`
- `finishReason`: `STOP` → `"completed"`, `MAX_TOKENS` → `"incomplete"`, others → `"incomplete"`

### `files.{create,list,delete}`

| Provider | Behavior |
|----------|----------|
| openai | `openai.files.{create,list,delete}` — SDK native |
| azure | `azure.files.{create,list,delete}` — mirrors OpenAI shape in `AzureOpenAI` SDK |
| custom | throw `Error("helix-lib: 'files.<op>' not supported by provider 'custom'")` — already in stub |
| vertex | throw same — already in stub |

**`purpose` field**: OpenAI and Azure require different conventional values (`"user_data"` vs `"assistants"` are common). Phase 2 should pass `params.purpose` through unchanged — the caller picks the right value per provider; the lib does NOT default or translate.

### `models.list`

| Provider | Behavior | Status |
|----------|----------|--------|
| openai | `openai.models.list()` → normalize `data[]` to `ModelInfo[]` | ✅ |
| azure | **THROW** plain `Error` with "ARM credentials required" message | ⚠️ blocked |
| custom | `openai.models.list()` with baseURL → normalize | ✅ if endpoint supports |
| vertex | GET `https://aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google/models` → normalize. `created` field absent → set `0`. | ✅ |

**Azure resolution**: throw a plain `Error` for now. If a consumer needs deployment listing, they can implement it externally with their own ARM credentials. Future `helix-azure-config-v2` change can add `deploymentName` to config and synthesize a single-element `ModelInfo[]` from it.

### `test()`

- All four providers wrap `models.list()` in `try/catch` → return `true`/`false`
- Pattern already in stubs
- Azure will return `false` (because `models.list` throws) until `helix-azure-config-v2` lands
- This is documented as a known limitation

---

## D. Vertex/Gemini Normalization (hardest piece)

### What maps cleanly

- text input → `contents[].parts[].text`
- system instructions → `systemInstruction`
- temperature → `generationConfig.temperature`
- max_output_tokens → `generationConfig.maxOutputTokens`
- json_object format → `generationConfig.responseMimeType: "application/json"`
- json_schema format → `responseMimeType` + `responseSchema`

### Gaps that require synthesis or rejection

- `id`: synthesize via `crypto.randomUUID()`
- `created_at`: use `Date.now() / 1000`
- `model` in response: use `params.model` echo (Gemini returns `modelVersion` which is verbose)
- `output[].id` (`OutputMessage`): synthesize
- `output[].status`: from `finishReason` (`STOP` → `completed`, others → `incomplete`)
- `InputFile` (file_id references): Gemini has no compatible Files API → if any `InputFile` parts appear in `params.input`, throw `Error("helix-lib: InputFile not supported for Vertex in Phase 2")`
- Safety ratings, grounding, function calls: **OUT of scope** for Phase 2

### Phase 2 scope for Vertex

Text-only `responses.create` with the 6 mapped fields. No file references. No tools. No streaming.

---

## E. Error Handling — `HelixError` deferred

Phase 1 v2 deferred `HelixError` to a future `helix-error-model` change. Phase 2 makes real HTTP calls. Three options:

1. **Raw passthrough** (matches Phase 1 contract). REQ-RESP-009, REQ-FILES-006, REQ-MODELS-004 ALL mandate "raw error MUST propagate." Zero extra work.
2. **Fold `HelixError` into Phase 2**. Inflates scope, requires spec changes to client + responses + files + models.
3. **Local interim wrapper**. No benefit over option 1.

**Recommendation**: option 1, raw passthrough. The frozen specs explicitly mandate it. `HelixError` belongs in `helix-error-model` as designed.

**Caller impact**: error shapes will be heterogeneous — OpenAI SDK errors on openai/azure/custom, raw `fetch` rejection / Gemini error JSON on vertex. Consumers (axium-api) will need a thin per-provider `try/catch` switch until `helix-error-model` ships. This trade-off is **explicit, documented, and accepted** — the alternative (folding `HelixError` in) violates the frozen Phase 1 v2 contract.

---

## F. Testing strategy (PR3 requires tests for all 4 providers)

### Test runner comparison

| Runner | TypeScript | Native ESM | Watch | HTTP mocking | Verdict |
|--------|-----------|------------|-------|--------------|---------|
| **Vitest** | Native | Yes | Yes | MSW + `vi.mock` | RECOMMENDED |
| `node:test` | via `tsx` | Yes | No | Manual | Viable but limited DX |
| Jest | via `ts-jest` | Limited | Yes | nock/MSW | Against PR2 (heavyweight) |

Vitest wins: native ESM (project is `"type": "module"`), excellent TS support, devDep only (PR2 constraint applies to runtime, not dev).

### HTTP mocking

- **MSW** (`@mswjs/interceptors` for Node): intercepts `fetch` at module level. Works with native `fetch` in Node 22. **Recommended.**
- `nock`: does NOT support native fetch (uses undici internally). Ruled out.
- `vi.mock`: useful for mocking the `openai` SDK module directly in pure unit tests.

### Two-tier strategy

1. **Unit tests** (always run): mock HTTP via MSW or `vi.mock`. Cover request shaping, response normalization, error passthrough, "not supported" throws. Run in CI.
2. **Integration tests** (gated by env vars): `HELIX_OPENAI_API_KEY`, `HELIX_AZURE_*`, `HELIX_VERTEX_*`. Skip gracefully when creds absent.

PR3 ("tests with all 4 providers") is satisfied by the unit tier alone since each provider has a dedicated unit suite. The integration tier is for confidence on real HTTP, gated to local dev / scheduled CI runs.

---

## G. Consumer surface — axium-api

The real consumer is **axium-api**. The library will be invoked exactly as:

```ts
const helix = createHelix({ provider: "openai", apiKey, baseUrl? });

await helix.responses.create({ model, input, instructions, text: { format }, ... });
await helix.files.create({ file, purpose, expires_after? });
await helix.files.list();
await helix.files.delete(id);

await helix.test();          // health check / credential validation
await helix.models.list();
```

This is **exactly** the surface frozen in Phase 1 v2. Phase 2's job is to make every one of those calls actually hit the wire.

### Capability coverage

| Capability | Phase 2 delivers |
|-----------|------------------|
| `responses.create` | YES — all 4 providers (Vertex text-only) |
| `text.format` (incl. json_schema) | YES — already in `ResponsesCreateParams`, passes through to provider |
| `files.create` / `files.list` / `files.delete` | YES on openai + azure; throws on custom + vertex (already in stub) |
| `models.list` | YES on openai + custom + vertex; throws on azure (ARM credentials gap) |
| `test()` | YES on all 4 (azure returns `false` because models.list throws) |
| `expires_after` on files.create | YES — passed through (OpenAI/Azure handle TTL semantics natively) |
| `baseUrl` for OpenAI provider | YES — passes through to `new OpenAI({ apiKey, baseURL })` |

### Open questions for the proposal — about axium-api

I do NOT have visibility into axium-api's repo or its actual implementation plans. Before the proposal commits scope, **two questions should be answered**:

1. **Which providers does axium-api actually use today (or plan to)?** Phase 1 spec (PR4) commits to all 4 (openai, azure, custom, vertex). Phase 2 must deliver all 4 unless that commitment is renegotiated. If axium-api is OpenAI-only, the others can still be implemented per spec, but the proposal can prioritize/deprioritize accordingly.
2. **Reasoning models / temperature quirks**: some OpenAI models (o-series, gpt-5-mini, gpt-5-nano) REJECT `temperature`. The lib should be a thin pass-through and let the caller manage these per-model details — Phase 2 should NOT auto-omit fields. Confirm this stance before the proposal closes.

---

## H. Scope tightness

| Feature | Status |
|---------|--------|
| Streaming responses | OUT — `helix-streaming` change |
| `HelixError` structured errors | OUT — `helix-error-model` change |
| Tools / function calling | OUT — `helix-tools` change |
| `InputFile` for Vertex | OUT — no Gemini-compatible Files API |
| Azure `models.list` (full) | OUT — blocked until `helix-azure-config-v2` adds `deploymentName` |
| Pagination for files/models | OUT — future change |
| `OpenAI-Organization`/`Project` headers | OUT — YAGNI per Phase 1 spec |
| Reasoning-model field auto-omission (e.g., temperature on o-series) | OUT — caller responsibility, lib stays a thin pass-through |

**Phase 2 strictly delivers**:
- Real HTTP for `responses.create` on all 4 providers (Vertex text-only)
- Real `files.{create,list,delete}` on openai + azure; throws on custom + vertex (already)
- Real `models.list` on openai + custom + vertex; throws on azure
- Real `test()` on all 4 (azure returns `false` until config v2)
- Vitest + MSW devDeps installed; unit + integration test tiers; suite covers all 4 providers

---

## Open questions for the proposal

1. **`HelixError` fold-in?** Recommendation: NO — keep deferred to `helix-error-model`.
2. **Azure `models.list` — throw vs synthetic?** Recommendation: throw with helpful message.
3. **Add `deploymentName` to `HelixConfig.azure`?** Recommendation: NO in Phase 2 — that's a separate `helix-azure-config-v2` change because it's a public-surface modification.
4. **Vertex `InputFile` gap acceptable?** Recommendation: YES — document, throw when used.
5. **axium-api scope** → see §G open questions (which providers, temperature/reasoning-model handling).
6. **Install Vitest + MSW as devDependencies?** Recommendation: YES.
7. **ADC fallback for Vertex**: env var `GOOGLE_APPLICATION_CREDENTIALS` only, or also GCE metadata server? Recommendation: env var first; GCE metadata as a documented future extension if needed.
8. **OpenAI SDK version pin**: `openai@^6.0.0`. Recommendation: `^6` since the Responses API is stable there.

---

## Risks for proposal to adjudicate

1. **Azure `models.list` is broken by design** until `helix-azure-config-v2`. `test()` on Azure always returns `false` in Phase 2.
2. **Vertex `id`/`created_at` are synthesized** (UUID + `Date.now()`). Document as non-canonical.
3. **OpenAI SDK v6 Responses API surface** must be reverified at proposal-finalize time (changing fast).
4. **Heterogeneous error shapes** between providers until `helix-error-model`. axium-api (or any consumer) will need a per-provider error switch until then.
5. **Vertex JWT signing in `node:crypto`** — moderate code volume (~150–200 LOC) for the auth helper. Worth the savings of 2.8MB+ from `google-auth-library`.

---

## Ready for proposal

**ALMOST** — two questions for axium-api remain (see §G):
- Which of the 4 providers is axium-api actually using or planning to use?
- Confirm the lib's stance on reasoning-model field omission (recommendation: pass-through, no auto-omit)

Both are answerable with one user message. Once answered, the proposal can confidently scope Phase 2 to what is described in §H with the recommendations from this document.
