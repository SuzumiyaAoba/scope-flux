import { describe, expect, it } from 'vitest';

import { cell, createStore } from '@scope-flux/core';
import { escapeJsonForHtml, hydrate, serialize } from '../src/index.js';

describe('serializer', () => {
  it('serialize/hydrate roundtrip', () => {
    const name = cell('alice', { id: 'name' });
    const age = cell(20, { id: 'age' });

    const s1 = createStore().fork();
    s1.set(name, 'bob');
    s1.set(age, 42);

    const payload = serialize(s1);

    const s2 = createStore().fork();
    hydrate(s2, payload);

    expect(s2.get(name)).toBe('bob');
    expect(s2.get(age)).toBe(42);
  });

  it('serialize rejects non-json values', () => {
    const bad = cell<unknown>(() => {}, { id: 'bad' });
    const scope = createStore().fork();
    scope.set(bad, () => {});

    expect(() => serialize(scope)).toThrowError(/NS_SER_NON_JSON_VALUE/);
  });

  it('serialize skips non-serializable cells', () => {
    const publicValue = cell('ok', { id: 'public_value', serializable: true });
    const privateValue = cell('secret', { id: 'private_value', serializable: false });
    const scope = createStore().fork();
    scope.set(publicValue, 'visible');
    scope.set(privateValue, 'hidden');

    const payload = serialize(scope);
    expect(payload.values.public_value).toBe('visible');
    expect('private_value' in payload.values).toBe(false);
  });

  it('safe hydrate is idempotent', () => {
    const count = cell(1, { id: 'safe_count' });

    const source = createStore().fork();
    source.set(count, 2);
    const payload = serialize(source);

    const target = createStore().fork();
    hydrate(target, payload);
    expect(target.get(count)).toBe(2);

    target.set(count, 50);
    hydrate(target, payload, { mode: 'safe' });
    expect(target.get(count)).toBe(50);
  });

  it('force hydrate overwrites existing value', () => {
    const count = cell(1, { id: 'force_count' });

    const source = createStore().fork();
    source.set(count, 9);
    const payload = serialize(source);

    const target = createStore().fork();
    target.set(count, 3);
    hydrate(target, payload, { mode: 'force' });

    expect(target.get(count)).toBe(9);
  });

  it('hydrate ignores unknown stable IDs', () => {
    const known = cell(0, { id: 'known_cell' });
    const scope = createStore().fork();
    scope.set(known, 1);

    hydrate(scope, {
      version: 1,
      scopeId: 'external_scope',
      values: {
        unknown_cell: 99,
      },
    });

    expect(scope.get(known)).toBe(1);
  });

  it('payload size limit is enforced', () => {
    const text = cell('x'.repeat(100), { id: 'text' });
    const scope = createStore().fork();
    scope.set(text, 'x'.repeat(100));

    expect(() => serialize(scope, { maxBytes: 20 })).toThrowError(/NS_SER_PAYLOAD_TOO_LARGE/);
  });

  it('serialize works when Buffer global is unavailable', () => {
    const count = cell(1, { id: 'no_buffer_count' });
    const scope = createStore().fork();
    scope.set(count, 2);

    const originalBuffer = (globalThis as { Buffer?: unknown }).Buffer;
    (globalThis as { Buffer?: unknown }).Buffer = undefined;

    try {
      const payload = serialize(scope);
      expect(payload.values.no_buffer_count).toBe(2);
    } finally {
      (globalThis as { Buffer?: unknown }).Buffer = originalBuffer;
    }
  });

  it('escapeJsonForHtml escapes dangerous chars', () => {
    const escaped = escapeJsonForHtml('{"x":"<script>"}');
    expect(escaped.includes('\\u003cscript>')).toBe(true);
  });

  it('hydrate rejects invalid payload shapes', () => {
    const scope = createStore().fork();
    expect(() => hydrate(scope, 'bad_payload')).toThrowError(/NS_SER_INVALID_SCHEMA/);
  });

  it('serialize/hydrate reject invalid scope objects', () => {
    expect(() => serialize(null as unknown as ReturnType<typeof createStore>['root'])).toThrowError(
      /NS_SER_INVALID_SCOPE/
    );
    expect(() => hydrate(null as unknown as ReturnType<typeof createStore>['root'], {})).toThrowError(
      /NS_SER_INVALID_SCOPE/
    );
  });

  it('hydrate rejects invalid mode values', () => {
    const count = cell(1, { id: 'invalid_mode_count' });
    const source = createStore().fork();
    source.set(count, 2);
    const payload = serialize(source);

    const target = createStore().fork();
    expect(() =>
      hydrate(target, payload, { mode: 'unexpected' as 'safe' })
    ).toThrowError(/NS_SER_INVALID_HYDRATE_MODE/);
  });
});
