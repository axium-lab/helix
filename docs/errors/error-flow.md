# Error Flow

Todo error que sale de helix-lib es un `HelixError`. El camino desde el SDK hasta el consumer pasa por un mapper compartido + configuración por provider.

## Arquitectura

```
openai.errors.ts  ─┐
azure.errors.ts   ─┼──► _shared/openai-sdk-error.mapper.ts ──► HelixError
custom.errors.ts  ─┘
```

La lógica de clasificación (qué tipo de error del SDK → qué `category`) vive **una sola vez** en el shared. Cada provider solo configura sus diferencias.

---

## OpenAI

El más simple. No tiene overrides — usa el comportamiento default del shared.

```typescript
mapSdkError(err, {
  provider: "openai",
  buildMeta: (e) => e.error !== undefined ? { body: e.error } : undefined,
});
```

El body crudo del proveedor se guarda en `meta.body`.

**Ejemplo — auth_error:**
```
AuthenticationError (401) → HelixError {
  category: "auth_error",
  provider: "openai",
  httpStatus: 401,
  requestId: "req_abc123",
  meta: { body: { message: "Incorrect API key provided", code: "invalid_api_key" } }
}
```

---

## Azure

Tiene tres diferencias respecto a OpenAI:

**1. `buildRequestId`** — Azure no envía `x-request-id`. Usa sus propios headers:
```
x-ms-request-id → apim-request-id → err.requestID (fallback)
```

**2. `buildMeta`** — incluye `innererror` si existe (campo específico de Azure).

**3. `detectResponsibleAIViolation`** — Azure tiene un segundo código de content filter además de `"content_filter"`: `innererror.code === "ResponsibleAIPolicyViolation"`.

```typescript
mapSdkError(err, {
  provider: "azure",
  buildMeta: (e) => ({
    body: e.error,
    innererror: extractInnererror(e.error), // solo si existe
  }),
  buildRequestId: (e) =>
    e.headers?.get("x-ms-request-id") ??
    e.headers?.get("apim-request-id") ??
    e.requestID,
  detectResponsibleAIViolation: (e, code) =>
    code === "content_filter" ||
    innererror?.code === "ResponsibleAIPolicyViolation",
});
```

**Ejemplo — content_filter via Responsible AI:**
```
BadRequestError (400) → HelixError {
  category: "content_filter",
  provider: "azure",
  httpStatus: 400,
  requestId: "a1b2c3d4-...",   // de x-ms-request-id
  meta: {
    body: { code: "content_filter", message: "..." },
    innererror: { code: "ResponsibleAIPolicyViolation" }
  }
}
```

Azure también tiene un **raw fetch path** para `models.list` que no usa el SDK. Ese path pasa por `azureFetchHttpError` directamente y extrae `x-ms-request-id` del `Response` nativo de fetch.

---

## Custom

Meta-provider: no sabemos qué vendor hay detrás (`baseUrl` puede apuntar a Groq, Together AI, OpenRouter, etc.). No puede replicar quirks por vendor. El body raw se guarda en `meta.upstream` para debugging.

```typescript
mapSdkError(err, {
  provider: "custom",
  buildMeta: (e) => e.error !== undefined ? { upstream: e.error } : undefined,
});
```

La clave es `upstream` (no `body`) para dejar claro que viene de un vendor desconocido.

**Ejemplo — rate_limit:**
```
RateLimitError (429) → HelixError {
  category: "rate_limit",
  provider: "custom",
  httpStatus: 429,
  meta: { upstream: { message: "...", type: "...", code: "..." } }
}
```

> Si un vendor necesita mapeo fino (ej: Together devuelve 503 para rate limit), tiene que convertirse en un adapter dedicado — no usar Custom.

---

## httpStatus — siempre un número

`HelixError.httpStatus` es siempre `number`. Si el proveedor devolvió un status se usa ese. Si no hubo respuesta HTTP se aplica un fallback por categoría:

| Sin respuesta HTTP | httpStatus |
|---|---|
| `connection_error` | 502 |
| `timeout` | 504 |
| cualquier otro | 500 |

---

## Tabla de categorías

| Error del SDK | category |
|---|---|
| `APIConnectionTimeoutError` | `timeout` |
| `APIConnectionError` | `connection_error` |
| `BadRequestError` + content_filter / ResponsibleAI | `content_filter` |
| `BadRequestError` | `invalid_request` |
| `AuthenticationError` | `auth_error` |
| `PermissionDeniedError` | `permission_denied` |
| `NotFoundError` | `not_found` |
| `RateLimitError` + insufficient_quota | `quota_exceeded` |
| `RateLimitError` | `rate_limit` |
| `InternalServerError` / status >= 500 | `server_error` |
| cualquier otra cosa | `unknown` |

---

## Uso en el consumer

```typescript
import { isHelixError } from "helix-lib";

try {
  await helix.responses.create({ ... });
} catch (err) {
  if (isHelixError(err)) {
    res.status(err.httpStatus).json({
      error: err.category,
      message: err.message,
    });
  }
}
```
