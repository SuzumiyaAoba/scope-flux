import { describe, expect, it, vi } from 'vitest';

import { cell, createStore } from '@suzumiyaaoba/scope-flux-core';
import {
  autoPersistScope,
  createMemoryStorage,
  escapeJsonForHtml,
  hydrate,
  hydrateFromStorage,
  persistToStorage,
  serialize,
} from '../src/index.js';

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
    expect(escaped.includes('\\u003cscript\\u003e')).toBe(true);
  });

  it('hydrate rejects invalid payload shapes', () => {
    const scope = createStore().fork();
    expect(() => hydrate(scope, 'bad_payload')).toThrowError(/NS_SER_INVALID_SCHEMA/);
  });

  it('hydrate rejects malformed payload fields', () => {
    const scope = createStore().fork();

    expect(() => hydrate(scope, { version: '1', scopeId: 'x', values: {} })).toThrowError(/NS_SER_INVALID_SCHEMA/);
    expect(() => hydrate(scope, { version: 1, scopeId: 100, values: {} })).toThrowError(/NS_SER_INVALID_SCHEMA/);
    expect(() => hydrate(scope, { version: 1, scopeId: 'x', values: [] })).toThrowError(/NS_SER_INVALID_SCHEMA/);
  });

  it('hydrate rejects non-json value entries inside payload.values', () => {
    const scope = createStore().fork();
    expect(() =>
      hydrate(scope, {
        version: 1,
        scopeId: 'x',
        values: { bad: () => {} },
      })
    ).toThrowError(/NS_SER_INVALID_SCHEMA/);
  });

  it('serialize with only option exports only targeted cells', () => {
    const included = cell('in', { id: 'serialize_only_included' });
    const excluded = cell('out', { id: 'serialize_only_excluded' });
    const scope = createStore().fork();
    scope.set(included, 'included');
    scope.set(excluded, 'excluded');

    const payload = serialize(scope, { only: [included] });

    expect(payload.values.serialize_only_included).toBe('included');
    expect(payload.values.serialize_only_excluded).toBeUndefined();
  });

  it('serialize ignores non-cell values and cells without stable IDs in only option', () => {
    const noId = cell('x');
    const withId = cell('ok', { id: 'serialize_only_with_id' });
    const scope = createStore().fork();
    scope.set(noId, 'no-id');
    scope.set(withId, 'yes-id');

    const payload = serialize(scope, {
      only: [withId, noId, { kind: 'event' } as any],
    });

    expect(payload.values.serialize_only_with_id).toBe('yes-id');
    expect(Object.keys(payload.values)).toEqual(['serialize_only_with_id']);
  });

  it('serialize works when both TextEncoder and Buffer are unavailable', () => {
    const count = cell(1, { id: 'no_text_encoder_count' });
    const scope = createStore().fork();
    scope.set(count, 2);

    const g = globalThis as { Buffer?: unknown; TextEncoder?: unknown };
    const originalBuffer = g.Buffer;
    const originalTextEncoder = g.TextEncoder;
    g.Buffer = undefined;
    g.TextEncoder = undefined;

    try {
      const payload = serialize(scope);
      expect(payload.values.no_text_encoder_count).toBe(2);
    } finally {
      g.Buffer = originalBuffer;
      g.TextEncoder = originalTextEncoder;
    }
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

  it('hydrate supports payload migration', () => {
    const count = cell(0, { id: 'hydrate_migrate_count' });
    const target = createStore().fork();
    const legacyPayload = {
      version: 2,
      scopeId: 'legacy',
      values: { hydrate_migrate_count: 9 },
    };

    hydrate(target, legacyPayload, {
      migrate: (payload) => ({
        ...payload,
        version: 1,
      }),
    });

    expect(target.get(count)).toBe(9);
  });

  it('hydrate rejects unsupported version without migrate', () => {
    const count = cell(0, { id: 'hydrate_migrate_reject_count' });
    const target = createStore().fork();

    expect(() =>
      hydrate(target, {
        version: 2,
        scopeId: 'legacy',
        values: { hydrate_migrate_reject_count: 1 },
      })
    ).toThrowError(/NS_SER_UNSUPPORTED_VERSION/);
    expect(target.get(count)).toBe(0);
  });

  it('persistToStorage and hydrateFromStorage roundtrip', () => {
    const count = cell(0, { id: 'storage_count' });
    const source = createStore().fork();
    source.set(count, 3);

    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };

    persistToStorage(source, 'scope:key', { storage });
    const target = createStore().fork();
    const loaded = hydrateFromStorage(target, 'scope:key', { storage });

    expect(loaded).not.toBeNull();
    expect(target.get(count)).toBe(3);
  });

  it('autoPersistScope persists on commits with debounce', () => {
    vi.useFakeTimers();
    try {
      const count = cell(0, { id: 'auto_persist_count' });
      const scope = createStore().fork();
      const memory = new Map<string, string>();
      const storage = {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memory.set(key, value);
        },
      };

      const { unsubscribe } = autoPersistScope(scope, 'scope:auto', {
        storage,
        debounceMs: 20,
      });

      scope.set(count, 1);
      scope.set(count, 2);
      expect(memory.has('scope:auto')).toBe(false);

      vi.advanceTimersByTime(20);
      const persisted = memory.get('scope:auto');
      expect(persisted).toBeTruthy();
      expect(JSON.parse(persisted as string).values.auto_persist_count).toBe(2);

      unsubscribe();
    } finally {
      vi.useRealTimers();
    }
  });

  it('autoPersistScope flush writes immediately', () => {
    const count = cell(0, { id: 'auto_persist_flush_count' });
    const scope = createStore().fork();
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    const { flush, unsubscribe } = autoPersistScope(scope, 'scope:auto:flush', {
      storage,
      debounceMs: 1000,
    });
    scope.set(count, 5);
    const payload = flush();
    expect(payload?.values.auto_persist_flush_count).toBe(5);
    unsubscribe();
  });

  it('createMemoryStorage can seed and mutate values', () => {
    const storage = createMemoryStorage({ a: '1' });
    expect(storage.getItem('a')).toBe('1');
    storage.setItem('b', '2');
    expect(storage.getItem('b')).toBe('2');
  });

  it('autoPersistScope hydrateNow hydrates from existing storage payload', () => {
    const count = cell(0, { id: 'auto_persist_hydrate_now_count' });
    const scope = createStore().fork();
    const storage = createMemoryStorage();

    const source = createStore().fork();
    source.set(count, 11);
    persistToStorage(source, 'scope:auto:hydrate', { storage });

    const persistence = autoPersistScope(scope, 'scope:auto:hydrate', {
      storage,
      mode: 'force',
    });
    const loaded = persistence.hydrateNow();
    expect(loaded?.values.auto_persist_hydrate_now_count).toBe(11);
    expect(scope.get(count)).toBe(11);
    persistence.unsubscribe();
  });
});
