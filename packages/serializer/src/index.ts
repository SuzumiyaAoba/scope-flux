import { getRegisteredCellById, type AnyCell, type Scope } from '@scope-flux/core';

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
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') {
    return t === 'number' ? !Number.isNaN(value) : true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (isPlainObject(value)) {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

function assertScope(scope: Scope): void {
  if (!scope || typeof scope.get !== 'function' || typeof scope.set !== 'function') {
    throw new Error('NS_SER_INVALID_SCOPE');
  }
}

export function serialize(scope: Scope, opts: SerializeOptions = {}): SerializedScope {
  assertScope(scope);

  const only = opts.only ?? null;
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
  const bytes = Buffer.byteLength(encoded, 'utf8');
  if (bytes > maxBytes) {
    throw new Error('NS_SER_PAYLOAD_TOO_LARGE');
  }

  return payload;
}

function validatePayload(payload: SerializedScope): void {
  if (!isPlainObject(payload)) {
    throw new Error('NS_SER_INVALID_SCHEMA');
  }

  if (typeof payload.version !== 'number') {
    throw new Error('NS_SER_INVALID_SCHEMA');
  }

  if (typeof payload.scopeId !== 'string') {
    throw new Error('NS_SER_INVALID_SCHEMA');
  }

  if (!isPlainObject(payload.values)) {
    throw new Error('NS_SER_INVALID_SCHEMA');
  }

  for (const [id, value] of Object.entries(payload.values)) {
    if (typeof id !== 'string' || !isJsonValue(value)) {
      throw new Error('NS_SER_INVALID_SCHEMA');
    }
  }
}

export function hydrate(scope: Scope, payload: SerializedScope, opts: HydrateOptions = {}): void {
  assertScope(scope);
  validatePayload(payload);

  const mode = opts.mode ?? 'safe';

  for (const [id, value] of Object.entries(payload.values)) {
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

export function escapeJsonForHtml(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
