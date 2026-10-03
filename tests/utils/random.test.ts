import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../../src/utils/random';

function take(random: () => number, count: number): number[] {
  return Array.from({ length: count }, () => random());
}

describe('createSeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    expect(take(createSeededRandom(42), 50)).toEqual(take(createSeededRandom(42), 50));
  });

  it('produces different sequences for different seeds', () => {
    expect(take(createSeededRandom(1), 10)).not.toEqual(take(createSeededRandom(2), 10));
  });

  it('stays within [0, 1)', () => {
    for (const value of take(createSeededRandom(2026), 5000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is roughly uniform', () => {
    const values = take(createSeededRandom(9), 20000);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });
});
