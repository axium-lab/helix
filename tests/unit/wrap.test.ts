import { describe, it, expect } from 'vitest';
import { wrap } from '../../src/internal/providers/_shared/wrap.js';
import { HelixError, isHelixError } from '../../src/core/errors/helix-error.js';
import { mapOpenAIError } from '../../src/internal/providers/openai/openai.errors.js';

// Mapper minimalista para tests independientes de provider.
const testMapper = (err: unknown): HelixError =>
  isHelixError(err)
    ? err
    : new HelixError({
        category: 'unknown',
        provider: 'openai',
        message: err instanceof Error ? err.message : `non-Error: ${String(err)}`,
        cause: err,
      });

describe('wrap — normaliza errores a HelixError', () => {
  it('captura async reject', async () => {
    const wrapped = wrap(
      { fail: async () => Promise.reject(new Error('async boom')) },
      testMapper,
    );

    await expect(wrapped.fail()).rejects.toSatisfy((err: unknown) => {
      expect(isHelixError(err)).toBe(true);
      expect((err as HelixError).category).toBe('unknown');
      expect((err as HelixError).message).toBe('async boom');
      return true;
    });
  });

  it('captura sync throw dentro de async fn (antes del primer await)', async () => {
    const wrapped = wrap(
      {
        fail: async () => {
          throw new Error('sync boom');
        },
      },
      testMapper,
    );

    await expect(wrapped.fail()).rejects.toSatisfy((err: unknown) => {
      expect(isHelixError(err)).toBe(true);
      expect((err as HelixError).message).toBe('sync boom');
      return true;
    });
  });

  it('captura throw de string (no-Error)', async () => {
    const wrapped = wrap(
      {
        fail: async () => {
          throw 'string error';
        },
      },
      testMapper,
    );

    await expect(wrapped.fail()).rejects.toSatisfy((err: unknown) => {
      expect(isHelixError(err)).toBe(true);
      expect((err as HelixError).message).toContain('string error');
      expect((err as HelixError).cause).toBe('string error');
      return true;
    });
  });

  it('captura throw de null', async () => {
    const wrapped = wrap(
      {
        fail: async () => {
          throw null;
        },
      },
      testMapper,
    );

    await expect(wrapped.fail()).rejects.toSatisfy((err: unknown) => {
      expect(isHelixError(err)).toBe(true);
      expect((err as HelixError).cause).toBe(null);
      return true;
    });
  });

  it('captura throw de objeto plano', async () => {
    const wrapped = wrap(
      {
        fail: async () => {
          throw { code: 'WEIRD', message: 'plain object thrown' };
        },
      },
      testMapper,
    );

    await expect(wrapped.fail()).rejects.toSatisfy((err: unknown) => {
      expect(isHelixError(err)).toBe(true);
      expect((err as HelixError).cause).toEqual({
        code: 'WEIRD',
        message: 'plain object thrown',
      });
      return true;
    });
  });

  it('captura TypeError de acceso inseguro (caso bug google files)', async () => {
    // Simula lo que pasaba en google-aistudio.files.ts cuando params.file es null
    // y se intentaba acceder a params.file.type FUERA del try interno.
    const wrapped = wrap(
      {
        create: async (params: { file: { type: string } | null }) => {
          const _type = (params.file as { type: string }).type; // TypeError si null
          return _type;
        },
      },
      testMapper,
    );

    await expect(wrapped.create({ file: null })).rejects.toSatisfy(
      (err: unknown) => {
        expect(isHelixError(err)).toBe(true);
        expect((err as HelixError).cause).toBeInstanceOf(TypeError);
        return true;
      },
    );
  });
});

describe('wrap — NO double-wrap de HelixError existente', () => {
  it('preserva HelixError tal cual cuando ya fue mapeado adentro', async () => {
    const original = new HelixError({
      category: 'rate_limit',
      provider: 'openai',
      message: 'throttled',
      httpStatus: 429,
      requestId: 'req_abc',
    });

    const wrapped = wrap(
      {
        fail: async () => {
          throw original;
        },
      },
      mapOpenAIError, // usamos el mapper real, que hace isHelixError check
    );

    await expect(wrapped.fail()).rejects.toBe(original);
  });
});

describe('wrap — no toca el happy path', () => {
  it('pasa el valor de retorno sin modificar', async () => {
    const wrapped = wrap(
      {
        ok: async () => ({ id: '123', value: 'ok' }),
      },
      testMapper,
    );

    await expect(wrapped.ok()).resolves.toEqual({ id: '123', value: 'ok' });
  });

  it('preserva los argumentos pasados al handler', async () => {
    const wrapped = wrap(
      {
        echo: async (a: string, b: number, c: { x: boolean }) => ({ a, b, c }),
      },
      testMapper,
    );

    await expect(wrapped.echo('hello', 42, { x: true })).resolves.toEqual({
      a: 'hello',
      b: 42,
      c: { x: true },
    });
  });

  it('envuelve TODOS los métodos del namespace', async () => {
    const wrapped = wrap(
      {
        a: async () => {
          throw new Error('a fails');
        },
        b: async () => {
          throw new Error('b fails');
        },
        c: async () => 'c ok',
      },
      testMapper,
    );

    await expect(wrapped.a()).rejects.toSatisfy(isHelixError);
    await expect(wrapped.b()).rejects.toSatisfy(isHelixError);
    await expect(wrapped.c()).resolves.toBe('c ok');
  });
});
