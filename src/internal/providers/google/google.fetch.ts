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

  return (await res.json()) as T;
}
