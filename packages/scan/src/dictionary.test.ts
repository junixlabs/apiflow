import { describe, expect, it } from 'vitest';
import { isDictionary, shapeOf, mergeShapes } from './shape';

const dict = (n: number, value: unknown = 'x'): Record<string, unknown> =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`key_${i}`, value]));

describe('dictionary collapse', () => {
  // cm:why The real case: GET /api/v1/languages returns the i18n table, and its 100
  // `data.en.validation.*` keys are translation ids. 263 of one endpoint's fields were these.
  it('collapses the i18n table to one {key} path and keeps the count', () => {
    const shape = shapeOf({ data: { en: { validation: dict(100) } } });
    const collapsed = shape.find((f) => f.path === 'data.en.validation.{key}');
    expect(collapsed).toMatchObject({ type: 'string', keys: 100 });
    expect(shape.filter((f) => f.path.startsWith('data.en.validation.'))).toHaveLength(1);
  });

  // cm:guard Ground truth: the widest genuine record across two Zod-read APIs has 15 children. A
  // record must keep its field NAMES — over-collapsing deletes them, which is worse than noise.
  it('keeps a 15-field record whole', () => {
    const shape = shapeOf({ row: dict(15) });
    expect(shape.filter((f) => f.path.startsWith('row.'))).toHaveLength(15);
    expect(shape.some((f) => f.path.includes('{key}'))).toBe(false);
  });

  it('keeps a wide record whose values have mixed types', () => {
    const mixed = { ...dict(15), n: 1, flag: true, nested: { a: 1 }, list: [1] };
    const shape = shapeOf({ row: mixed });
    expect(shape.some((f) => f.path === 'row.{key}')).toBe(false);
  });

  it('samples the value shape into the collapsed path, like the array rule', () => {
    const groups = Object.fromEntries(
      Array.from({ length: 34 }, (_, i) => [`group_${i}`, [{ id: i, label: 'x' }]])
    );
    const shape = shapeOf({ data: groups });
    expect(shape.find((f) => f.path === 'data.{key}')).toMatchObject({ type: 'array', keys: 34 });
    expect(shape.map((f) => f.path)).toContain('data.{key}.id');
    expect(shape.map((f) => f.path)).toContain('data.{key}.label');
  });

  it('carries the widest key count through a merge of two samples', () => {
    const merged = mergeShapes(shapeOf({ d: dict(20) }), shapeOf({ d: dict(40) }));
    expect(merged.find((f) => f.path === 'd.{key}')?.keys).toBe(40);
  });

  describe('isDictionary', () => {
    it('needs both width and one shape', () => {
      expect(isDictionary(Object.entries(dict(20)))).toBe(true);
      expect(isDictionary(Object.entries(dict(19)))).toBe(false);
      expect(isDictionary(Object.entries({ ...dict(19), n: 1 }))).toBe(false);
    });
  });
});
