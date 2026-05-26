import type { HelixError } from '../../../core/errors/helix-error.js';

export function wrapError<T extends Record<string, (...args: any[]) => any>>(
  handlers: T,
  mapError: (err: unknown) => HelixError,
): T {
  const out = {} as T;
  for (const key of Object.keys(handlers) as Array<keyof T>) {
    const original = handlers[key];
    out[key] = (async (...args: any[]) => {
      try {
        return await original.call(handlers, ...args);
      } catch (err) {
        throw mapError(err);
      }
    }) as T[keyof T];
  }
  return out;
}
