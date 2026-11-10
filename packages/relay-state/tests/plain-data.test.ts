import { describe, expect, it } from 'vitest';
import { ownPlainData } from '../src/core';

describe('plain-data ownership', () => {
  it('rejects functions, custom classes, accessors, cycles and repeated aliases', () => {
    expect(() => ownPlainData({ x: () => 1 })).toThrow();
    expect(() => ownPlainData({ x: new Date() })).toThrow();
    const accessed = Object.defineProperty({}, 'x', { get() { throw Error('should not execute'); } });
    expect(() => ownPlainData(accessed)).toThrow();
    const cycle: { self?: unknown } = {}; cycle.self = cycle;
    expect(() => ownPlainData(cycle)).toThrow();
    const repeated = { x: 1 };
    expect(() => ownPlainData({ a: repeated, b: repeated })).toThrow();
  });
  it('rejects unsupported numeric values and oversized payloads', () => {
    expect(() => ownPlainData({ count: Number.POSITIVE_INFINITY })).toThrow();
    expect(() => ownPlainData({ value: 'abcdefghijkl' }, {
      maxBytes: 10, maxDepth: 32, maxNodes: 100, maxStringLength: 100,
    })).toThrow();
  });
  it('freezes an independently owned nested snapshot', () => {
    const input = { tasks: [{ label: 'first' }] };
    const output = ownPlainData(input);
    input.tasks[0]!.label = 'changed';
    expect(output.tasks[0]!.label).toBe('first');
    expect(Object.isFrozen(output.tasks[0])).toBe(true);
  });
});
