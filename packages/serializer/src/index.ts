import { getRegisteredCellById, isObject, type AnyCell, type Scope } from '@suzumiyaaoba/scope-flux-core';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [k: string]: JsonValue };

export interface SerializedScope {
  version: number;
  scopeId: string;
  values: Record<string, JsonValue>;
  meta?: {
    createdAt?: string;
    source?: 'ssr' | 'persist' | 'test';
  };
}

export interface SerializeOptions {
  only?: AnyCell[];
  maxBytes?: number;
}

export interface HydrateOptions {
  mode?: 'safe' | 'force';
  migrate?: (payload: SerializedScope) => SerializedScope;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface StorageCodec {
  encode(rawJson: string): string;
  decode(encoded: string): string;
}

export interface PersistToStorageOptions extends SerializeOptions {
  storage?: StorageLike;
  codec?: StorageCodec;
}

export interface HydrateFromStorageOptions extends HydrateOptions {
  storage?: StorageLike;
  codec?: StorageCodec;
}

export interface AutoPersistOptions extends PersistToStorageOptions {
  debounceMs?: number;
  throttleMs?: number;
  mode?: 'safe' | 'force';
  migrate?: (payload: SerializedScope) => SerializedScope;
  listenExternalUpdates?: boolean;
  onExternalHydrate?: (payload: SerializedScope) => void;
  conflictPolicy?: 'prefer_external' | 'prefer_local' | 'merge';
  mergePayloads?: (
    localPayload: SerializedScope,
    externalPayload: SerializedScope
  ) => SerializedScope;
  onError?: (error: unknown) => void;
}

export function createMemoryStorage(seed: Record<string, string> = {}): StorageLike {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem(key: string): string | null {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    },
  };
}

function encodeStorageValue(rawJson: string, codec?: StorageCodec): string {
  return codec ? codec.encode(rawJson) : rawJson;
}

function decodeStorageValue(encoded: string, codec?: StorageCodec): string {
  return codec ? codec.decode(encoded) : encoded;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') {
    return t === 'number' ? Number.isFinite(value) : true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (isObject(value)) {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

function assertScope(scope: Scope): void {
  if (!scope || typeof scope.get !== 'function' || typeof scope.set !== 'function') {
    throw new Error('NS_SER_INVALID_SCOPE');
  }
}

const _textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : undefined;

function utf8ByteLength(value: string): number {
  if (_textEncoder) {
    return _textEncoder.encode(value).byteLength;
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.byteLength(value, 'utf8');
  }

  // Manual UTF-8 byte length for runtimes without TextEncoder/Buffer.
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) { bytes += 4; i++; }
    else bytes += 3;
  }
  return bytes;
}

export function serialize(scope: Scope, opts: SerializeOptions = {}): SerializedScope {
  assertScope(scope);

  const only = opts.only;
  const maxBytes = opts.maxBytes ?? Number.POSITIVE_INFINITY;

  const cells = only ?? scope._listKnownCells();
  const values: Record<string, JsonValue> = {};

  for (const unit of cells) {
    if (!unit || unit.kind !== 'cell') {
      continue;
    }

    const id = unit.meta?.id;
    if (!id) {
      continue;
    }

    if (unit.meta?.serializable === false) {
      continue;
    }

    const value = scope.get(unit);
    if (!isJsonValue(value)) {
      throw new Error(`NS_SER_NON_JSON_VALUE:${id}`);
    }

    values[id] = value;
  }

  const payload: SerializedScope = {
    version: 1,
    scopeId: scope.id,
    values,
  };

  const encoded = JSON.stringify(payload);
  const bytes = utf8ByteLength(encoded);
  if (bytes > maxBytes) {
    throw new Error('NS_SER_PAYLOAD_TOO_LARGE');
  }

  return payload;
}

function validatePayload(payload: unknown): asserts payload is SerializedScope {
  if (!isObject(payload)) {
    throw new Error('NS_SER_INVALID_SCHEMA');
  }

  if (typeof payload.version !== 'number' || !Number.isInteger(payload.version) || payload.version <= 0) {
    throw new Error('NS_SER_INVALID_SCHEMA');
  }

  if (typeof payload.scopeId !== 'string') {
    throw new Error('NS_SER_INVALID_SCHEMA');
  }

  if (!isObject(payload.values)) {
    throw new Error('NS_SER_INVALID_SCHEMA');
  }

  for (const [id, value] of Object.entries(payload.values)) {
    if (typeof id !== 'string' || !isJsonValue(value)) {
      throw new Error('NS_SER_INVALID_SCHEMA');
    }
  }
}

export function hydrate(scope: Scope, payload: unknown, opts: HydrateOptions = {}): void {
  assertScope(scope);
  validatePayload(payload);
  let sourcePayload = payload;

  if (sourcePayload.version !== 1) {
    if (!opts.migrate) {
      throw new Error(`NS_SER_UNSUPPORTED_VERSION:${sourcePayload.version}`);
    }
    sourcePayload = opts.migrate(sourcePayload);
    validatePayload(sourcePayload);
    if (sourcePayload.version !== 1) {
      throw new Error('NS_SER_MIGRATE_TARGET_VERSION_REQUIRED');
    }
  }

  const mode = opts.mode ?? 'safe';
  if (mode !== 'safe' && mode !== 'force') {
    throw new Error('NS_SER_INVALID_HYDRATE_MODE');
  }

  for (const [id, value] of Object.entries(sourcePayload.values)) {
    const cellUnit = getRegisteredCellById(id);
    if (!cellUnit) {
      continue;
    }

    if (mode !== 'force' && scope._isHydrated(id)) {
      continue;
    }

    scope.set(cellUnit, value, { reason: 'hydrate', priority: 'urgent' });
    scope._markHydrated(id);
  }
}

const escapeMap: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

export function escapeJsonForHtml(json: string): string {
  return json.replace(/[<>&\u2028\u2029]/g, (ch) => escapeMap[ch]);
}

function resolveStorage(storage?: StorageLike): StorageLike {
  if (storage) {
    return storage;
  }

  const candidate = (globalThis as { localStorage?: StorageLike }).localStorage;
  if (!candidate) {
    throw new Error('NS_SER_STORAGE_UNAVAILABLE');
  }
  return candidate;
}

export function persistToStorage(
  scope: Scope,
  key: string,
  options: PersistToStorageOptions = {}
): SerializedScope {
  const payload = serialize(scope, options);
  const storage = resolveStorage(options.storage);
  const rawJson = JSON.stringify(payload);
  storage.setItem(key, encodeStorageValue(rawJson, options.codec));
  return payload;
}

export function hydrateFromStorage(
  scope: Scope,
  key: string,
  options: HydrateFromStorageOptions = {}
): SerializedScope | null {
  const storage = resolveStorage(options.storage);
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeStorageValue(raw, options.codec));
  } catch {
    throw new Error('NS_SER_INVALID_STORAGE_PAYLOAD');
  }
  hydrate(scope, parsed, options);
  return parsed as SerializedScope;
}

export function autoPersistScope(
  scope: Scope,
  key: string,
  options: AutoPersistOptions = {}
): {
  unsubscribe: () => void;
  flush: () => SerializedScope | null;
  hydrateNow: () => SerializedScope | null;
} {
  assertScope(scope);
  const storage = resolveStorage(options.storage);
  const debounceMs = Math.max(0, options.debounceMs ?? 0);
  const throttleMs = Math.max(0, options.throttleMs ?? 0);
  const conflictPolicy = options.conflictPolicy ?? 'prefer_external';
  let lastPersistAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let localDirty = false;
  let lastPersistedEncoded = '';

  const clearTimer = () => {
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    timer = undefined;
  };

  const persistNow = (): SerializedScope | null => {
    try {
      const payload = persistToStorage(scope, key, { ...options, storage });
      lastPersistAt = Date.now();
      lastPersistedEncoded = encodeStorageValue(JSON.stringify(payload), options.codec);
      localDirty = false;
      return payload;
    } catch (error) {
      options.onError?.(error);
      return null;
    }
  };

  const schedulePersist = () => {
    const now = Date.now();
    const throttleWait = throttleMs > 0 ? Math.max(0, throttleMs - (now - lastPersistAt)) : 0;
    const waitMs = Math.max(debounceMs, throttleWait);
    clearTimer();
    if (waitMs === 0) {
      persistNow();
      return;
    }
    timer = setTimeout(() => {
      timer = undefined;
      persistNow();
    }, waitMs);
  };

  const unsubscribe = scope.subscribe(() => {
    localDirty = true;
    schedulePersist();
  });

  let unsubscribeExternal = () => {
    // no-op
  };

  if (options.listenExternalUpdates) {
    const g = globalThis as {
      addEventListener?: (
        type: string,
        listener: (event: unknown) => void
      ) => void;
      removeEventListener?: (
        type: string,
        listener: (event: unknown) => void
      ) => void;
    };

    if (typeof g.addEventListener === 'function' && typeof g.removeEventListener === 'function') {
      const onStorage = (event: unknown) => {
        const e = event as {
          key?: string | null;
          newValue?: string | null;
          storageArea?: StorageLike;
        };
        if (e.key !== key || !e.newValue) {
          return;
        }
        if (e.storageArea && e.storageArea !== storage) {
          return;
        }
        if (e.newValue === lastPersistedEncoded) {
          return;
        }
        if (conflictPolicy === 'prefer_local' && (localDirty || !!timer)) {
          return;
        }
        try {
          const parsed = JSON.parse(decodeStorageValue(e.newValue, options.codec)) as unknown;
          let payloadToHydrate = parsed as SerializedScope;

          if (conflictPolicy === 'merge' && options.mergePayloads) {
            const localPayload = serialize(scope, options);
            payloadToHydrate = options.mergePayloads(localPayload, payloadToHydrate);
          }

          hydrate(scope, payloadToHydrate, {
            mode: options.mode ?? 'force',
            migrate: options.migrate,
          });
          localDirty = false;
          options.onExternalHydrate?.(payloadToHydrate);
        } catch (error) {
          options.onError?.(error);
        }
      };

      g.addEventListener('storage', onStorage);
      unsubscribeExternal = () => {
        g.removeEventListener?.('storage', onStorage);
      };
    }
  }

  return {
    unsubscribe: () => {
      clearTimer();
      unsubscribe();
      unsubscribeExternal();
    },
    flush: () => {
      clearTimer();
      return persistNow();
    },
    hydrateNow: () => {
      try {
        const loaded = hydrateFromStorage(scope, key, {
          mode: options.mode,
          migrate: options.migrate,
          storage,
        });
        if (loaded) {
          options.onExternalHydrate?.(loaded);
        }
        return loaded;
      } catch (error) {
        options.onError?.(error);
        return null;
      }
    },
  };
}
