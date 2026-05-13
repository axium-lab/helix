import { mapGoogleHttpError, mapGoogleNetworkError } from './google.errors.js';

export interface GoogleClient {
  apiKey: string;
  baseUrl: string;
}

export async function googleFetch<T>(
  client: GoogleClient,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${client.baseUrl}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': client.apiKey,
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch (err) {
    // Only conection errors, timeouts, etc. will be caught here. Errores HTTP no entran aquí.
    throw mapGoogleNetworkError(err);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let errorBody: unknown = undefined;
    if (text) {
      try {
        errorBody = JSON.parse(text);
      } catch {
        errorBody = text;
      }
    }
    throw mapGoogleHttpError(res, errorBody);
  }

  // Gemini devuelve body vacío en DELETE — no parseamos si no hay nada.
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
