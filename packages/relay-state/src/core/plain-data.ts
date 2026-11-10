import { RelayError } from './errors';
import type { DeepReadonly, StoreLimits } from './types';

export const DEFAULT_LIMITS: StoreLimits = Object.freeze({
  maxBytes: 262_144,
  maxDepth: 32,
  maxNodes: 10_000,
  maxStringLength: 16_384,
});

export function resolveLimits(partial: Partial<StoreLimits> = {}): StoreLimits {
  const result = { ...DEFAULT_LIMITS, ...partial };
  for (const [key, value] of Object.entries(result)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RelayError('INVALID_STATE', `Invalid limit: ${key}`);
    }
  }
  return Object.freeze(result);
}

/**
 * Copy, validate and recursively freeze the supported plain-data subset.
 * Reject cycles, aliases, sparse arrays, accessors, symbols, and custom prototypes.
 * Does not execute getters or stringify arbitrary unsupported objects.
 */
export function ownPlainData<T>(input: T, limits: StoreLimits = DEFAULT_LIMITS): DeepReadonly<T> {
  const seen = new WeakSet<object>();
  let nodes = 0;
  const problem = (message: string): never => {
    throw new RelayError('INVALID_STATE', message);
  };

  function visit(value: unknown, depth: number): unknown {
    if (depth > limits.maxDepth) return problem('Maximum state nesting depth exceeded');
    if (++nodes > limits.maxNodes) return problem('Maximum state node count exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return problem('Non-finite numbers are not allowed');
      return value;
    }
    if (typeof value === 'string') {
      if (value.length > limits.maxStringLength) return problem('String length limit exceeded');
      return value;
    }
    if (typeof value !== 'object') return problem('Unsupported state value');
    if (seen.has(value)) return problem('Cycles and shared object references are not supported');
    seen.add(value);

    if (Array.isArray(value)) {
      if (Reflect.ownKeys(value).some((key) =>
        typeof key !== 'string' || (key !== 'length' && !/^(0|[1-9]\d*)$/.test(key)))) {
        return problem('Unsupported array properties');
      }
      const result: unknown[] = [];
      for (let i = 0; i < value.length; i++) {
        if (!Object.hasOwn(value, i)) return problem('Sparse arrays are not supported');
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor || !('value' in descriptor)) return problem('Array accessors are not supported');
        result.push(visit(descriptor.value, depth + 1));
      }
      return Object.freeze(result);
    }

    const proto: unknown = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return problem('Only plain objects are supported');
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') return problem('Symbol object keys are not supported');
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return problem('Reserved object key');
      }
      if (key.length > limits.maxStringLength) return problem('Object key length limit exceeded');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return problem('Accessors are not supported');
      result[key] = visit(descriptor.value, depth + 1);
    }
    return Object.freeze(result);
  }

  const owned = visit(input, 0);
  // Serialized bytes limit enforces a realistic bound on IPC traffic.
  const encoded = new TextEncoder().encode(JSON.stringify(owned));
  if (encoded.byteLength > limits.maxBytes) problem('Maximum serialized payload exceeded');
  return owned as DeepReadonly<T>;
}
