import { describe, expect, it, vi } from 'vitest';

import { cell, createStore } from '@suzumiyaaoba/scope-flux-core';
import {
  autoPersistScope,
  autoPersistScopeAsync,
  createMemoryStorage,
  escapeJsonForHtml,
  hydrate,
  hydrateFromStorageAsync,
  hydrateFromStorage,
  persistToStorageAsync,
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
    s2.registerCell(name);
    s2.registerCell(age);
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
    target.registerCell(count);
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
    target.registerCell(count);
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
    target.registerCell(count);
    expect(() =>
      hydrate(target, payload, { mode: 'unexpected' as 'safe' })
    ).toThrowError(/NS_SER_INVALID_HYDRATE_MODE/);
  });

  it('hydrate supports payload migration', () => {
    const count = cell(0, { id: 'hydrate_migrate_count' });
    const target = createStore().fork();
    target.registerCell(count);
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
    target.registerCell(count);

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
    target.registerCell(count);
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
    scope.registerCell(count);
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

  it('persistToStorage/hydrateFromStorage support codec hooks', () => {
    const count = cell(0, { id: 'codec_count' });
    const source = createStore().fork();
    source.set(count, 7);
    const storage = createMemoryStorage();
    const codec = {
      encode: (raw: string) => Buffer.from(raw, 'utf8').toString('base64'),
      decode: (encoded: string) => Buffer.from(encoded, 'base64').toString('utf8'),
    };

    persistToStorage(source, 'scope:codec', { storage, codec });
    const raw = storage.getItem('scope:codec');
    expect(raw).toBeTruthy();
    expect(raw?.includes('"values"')).toBe(false);

    const target = createStore().fork();
    target.registerCell(count);
    hydrateFromStorage(target, 'scope:codec', { storage, codec });
    expect(target.get(count)).toBe(7);
  });

  it('autoPersistScope can merge external payloads on conflict', () => {
    const a = cell(0, { id: 'merge_a' });
    const b = cell(0, { id: 'merge_b' });
    const scope = createStore().fork();
    scope.registerCell(a);
    scope.registerCell(b);
    const storage = createMemoryStorage();
    const persistence = autoPersistScope(scope, 'scope:merge', {
      storage,
      conflictPolicy: 'merge',
      mergePayloads: (localPayload, externalPayload) => {
        return {
          ...externalPayload,
          values: {
            ...localPayload.values,
            ...externalPayload.values,
          },
        };
      },
    });

    scope.set(a, 1);
    persistence.flush();

    const external = createStore().fork();
    external.set(b, 2);
    persistToStorage(external, 'scope:merge', { storage });
    const merged = persistence.hydrateNow();

    expect(merged).not.toBeNull();
    expect(scope.get(a)).toBe(1);
    expect(scope.get(b)).toBe(2);
    persistence.unsubscribe();
  });

  it('autoPersistScope hydrateNow applies merge policy for conflicting keys', () => {
    const value = cell(0, { id: 'merge_conflict_value' });
    const scope = createStore().fork();
    const storage = createMemoryStorage();
    const persistence = autoPersistScope(scope, 'scope:merge:hydrate-now', {
      storage,
      conflictPolicy: 'merge',
      mergePayloads: (localPayload, externalPayload) => ({
        ...externalPayload,
        values: {
          ...externalPayload.values,
          merge_conflict_value: localPayload.values.merge_conflict_value,
        },
      }),
    });

    scope.set(value, 10);
    persistence.flush();

    const external = createStore().fork();
    external.set(value, 99);
    persistToStorage(external, 'scope:merge:hydrate-now', { storage });

    const merged = persistence.hydrateNow();
    expect(merged?.values.merge_conflict_value).toBe(10);
    expect(scope.get(value)).toBe(10);
    persistence.unsubscribe();
  });

  it('autoPersistScope throttleMs coalesces frequent writes', () => {
    vi.useFakeTimers();
    try {
      const count = cell(0, { id: 'auto_persist_throttle_count' });
      const scope = createStore().fork();
      const storage = createMemoryStorage();
      const persistence = autoPersistScope(scope, 'scope:throttle', {
        storage,
        debounceMs: 0,
        throttleMs: 30,
      });

      scope.set(count, 1);
      const first = storage.getItem('scope:throttle');
      expect(first).toBeTruthy();

      scope.set(count, 2);
      const stillFirst = storage.getItem('scope:throttle');
      expect(stillFirst).toBe(first);

      vi.advanceTimersByTime(30);
      const second = storage.getItem('scope:throttle');
      expect(second).not.toBe(first);
      expect(JSON.parse(second as string).values.auto_persist_throttle_count).toBe(2);
      persistence.unsubscribe();
    } finally {
      vi.useRealTimers();
    }
  });

  it('autoPersistScope listens external updates and can prefer local on conflict', () => {
    const local = cell(0, { id: 'external_local' });
    const externalOnly = cell(0, { id: 'external_only' });
    const scope = createStore().fork();
    const storage = createMemoryStorage();
    const listeners: Array<(event: unknown) => void> = [];
    const g = globalThis as {
      addEventListener?: (type: string, listener: (event: unknown) => void) => void;
      removeEventListener?: (type: string, listener: (event: unknown) => void) => void;
    };
    const originalAdd = g.addEventListener;
    const originalRemove = g.removeEventListener;
    g.addEventListener = (_type, listener) => {
      listeners.push(listener);
    };
    g.removeEventListener = (_type, listener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    };

    try {
      const onExternalHydrate = vi.fn();
      const persistence = autoPersistScope(scope, 'scope:external', {
        storage,
        listenExternalUpdates: true,
        conflictPolicy: 'prefer_local',
        debounceMs: 100,
        onExternalHydrate,
      });

      scope.set(local, 10);
      const externalPayload = {
        version: 1,
        scopeId: 'remote',
        values: {
          external_local: 1,
          external_only: 2,
        },
      };
      storage.setItem('scope:external', JSON.stringify(externalPayload));

      for (const listener of [...listeners]) {
        listener({
          key: 'scope:external',
          newValue: JSON.stringify(externalPayload),
          storageArea: storage,
        });
      }
      expect(scope.get(local)).toBe(10);
      expect(scope.get(externalOnly)).toBe(0);
      expect(onExternalHydrate).not.toHaveBeenCalled();

      persistence.flush();
      for (const listener of [...listeners]) {
        listener({
          key: 'scope:external',
          newValue: JSON.stringify(externalPayload),
          storageArea: storage,
        });
      }
      expect(scope.get(local)).toBe(1);
      expect(scope.get(externalOnly)).toBe(2);
      expect(onExternalHydrate).toHaveBeenCalledTimes(1);
      persistence.unsubscribe();
    } finally {
      g.addEventListener = originalAdd;
      g.removeEventListener = originalRemove;
    }
  });

  it('autoPersistScope reports external listener parse errors via onError', () => {
    const scope = createStore().fork();
    const storage = createMemoryStorage();
    const listeners: Array<(event: unknown) => void> = [];
    const g = globalThis as {
      addEventListener?: (type: string, listener: (event: unknown) => void) => void;
      removeEventListener?: (type: string, listener: (event: unknown) => void) => void;
    };
    const originalAdd = g.addEventListener;
    const originalRemove = g.removeEventListener;
    g.addEventListener = (_type, listener) => {
      listeners.push(listener);
    };
    g.removeEventListener = (_type, listener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    };
    try {
      const onError = vi.fn();
      const persistence = autoPersistScope(scope, 'scope:external:error', {
        storage,
        listenExternalUpdates: true,
        onError,
      });
      for (const listener of [...listeners]) {
        listener({
          key: 'scope:external:error',
          newValue: '{bad-json',
          storageArea: storage,
        });
      }
      expect(onError).toHaveBeenCalledTimes(1);
      persistence.unsubscribe();
    } finally {
      g.addEventListener = originalAdd;
      g.removeEventListener = originalRemove;
    }
  });

  it('autoPersistScope does not call mergePayloads for invalid external payload', () => {
    const value = cell(0, { id: 'scope_merge_invalid_external' });
    const scope = createStore().fork();
    const storage = createMemoryStorage();
    const listeners: Array<(event: unknown) => void> = [];
    const g = globalThis as {
      addEventListener?: (type: string, listener: (event: unknown) => void) => void;
      removeEventListener?: (type: string, listener: (event: unknown) => void) => void;
    };
    const originalAdd = g.addEventListener;
    const originalRemove = g.removeEventListener;
    g.addEventListener = (_type, listener) => {
      listeners.push(listener);
    };
    g.removeEventListener = (_type, listener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    };

    try {
      const mergePayloads = vi.fn((localPayload, externalPayload) => ({
        ...localPayload,
        values: { ...localPayload.values, ...externalPayload.values },
      }));
      const onError = vi.fn();
      const persistence = autoPersistScope(scope, 'scope:merge:invalid-external', {
        storage,
        listenExternalUpdates: true,
        conflictPolicy: 'merge',
        mergePayloads,
        onError,
      });
      scope.set(value, 10);

      for (const listener of [...listeners]) {
        listener({
          key: 'scope:merge:invalid-external',
          newValue: JSON.stringify({ version: 1, scopeId: 'external', values: 123 }),
          storageArea: storage,
        });
      }

      expect(mergePayloads).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(scope.get(value)).toBe(10);
      persistence.unsubscribe();
    } finally {
      g.addEventListener = originalAdd;
      g.removeEventListener = originalRemove;
    }
  });

  it('autoPersistScope hydrateNow returns null and calls onError for invalid payload', () => {
    const scope = createStore().fork();
    const storage = createMemoryStorage({ 'scope:hydrate:error': '{bad-json' });
    const onError = vi.fn();

    const persistence = autoPersistScope(scope, 'scope:hydrate:error', {
      storage,
      onError,
    });

    expect(persistence.hydrateNow()).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    persistence.unsubscribe();
  });

  it('persistToStorageAsync and hydrateFromStorageAsync roundtrip', async () => {
    const count = cell(0, { id: 'async_storage_count' });
    const source = createStore().fork();
    source.set(count, 5);

    const memory = new Map<string, string>();
    const storage = {
      async getItem(key: string) {
        return memory.get(key) ?? null;
      },
      async setItem(key: string, value: string) {
        memory.set(key, value);
      },
    };

    await persistToStorageAsync(source, 'scope:async:key', { storage });
    const target = createStore().fork();
    target.registerCell(count);
    const loaded = await hydrateFromStorageAsync(target, 'scope:async:key', { storage });

    expect(loaded).not.toBeNull();
    expect(target.get(count)).toBe(5);
  });

  it('autoPersistScopeAsync persists and hydrateNow works', async () => {
    const count = cell(0, { id: 'auto_persist_async_count' });
    const scope = createStore().fork();
    const memory = new Map<string, string>();
    const storage = {
      async getItem(key: string) {
        return memory.get(key) ?? null;
      },
      async setItem(key: string, value: string) {
        memory.set(key, value);
      },
    };

    const persistence = autoPersistScopeAsync(scope, 'scope:auto:async', {
      storage,
      debounceMs: 0,
    });

    scope.set(count, 3);
    await persistence.flush();
    expect(memory.has('scope:auto:async')).toBe(true);

    const next = createStore().fork();
    next.registerCell(count);
    const loaded = await hydrateFromStorageAsync(next, 'scope:auto:async', { storage });
    expect(loaded?.values.auto_persist_async_count).toBe(3);
    expect(next.get(count)).toBe(3);
    persistence.unsubscribe();
  });

  it('autoPersistScopeAsync serializes concurrent flush calls', async () => {
    const count = cell(0, { id: 'auto_persist_async_serialized_count' });
    const scope = createStore().fork();
    const memory = new Map<string, string>();
    const storage = {
      async getItem(key: string) {
        return memory.get(key) ?? null;
      },
      async setItem(key: string, value: string) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        memory.set(key, value);
      },
    };

    const persistence = autoPersistScopeAsync(scope, 'scope:auto:async:serial', {
      storage,
      debounceMs: 0,
    });

    scope.set(count, 1);
    const [a, b] = await Promise.all([persistence.flush(), persistence.flush()]);
    expect(a?.values.auto_persist_async_serialized_count).toBe(1);
    expect(b?.values.auto_persist_async_serialized_count).toBe(1);
    persistence.unsubscribe();
  });
});
