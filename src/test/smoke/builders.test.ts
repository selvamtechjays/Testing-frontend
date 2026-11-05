import { describe, expect, it } from 'vitest';
import { buildExampleRecord } from '../builders/example';

describe('harness: builders', () => {
  it('produces unique records with defaults', () => {
    const a = buildExampleRecord();
    const b = buildExampleRecord();
    expect(a.id).not.toBe(b.id);
    expect(a.name).toMatch(/^Example /);
  });

  it('applies overrides without leaking them to later records', () => {
    expect(buildExampleRecord({ name: 'Custom' }).name).toBe('Custom');
    expect(buildExampleRecord().name).not.toBe('Custom');
  });
});
