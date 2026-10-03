import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT } from '../../src/game/config/identity';
import { formatCounter } from '../../src/utils/format';

describe('formatCounter', () => {
  it('formats the first level as shown in the laboratory HUD', () => {
    expect(formatCounter(1, LEVEL_COUNT)).toBe('01 / 06');
  });

  it('zero-pads to at least two digits', () => {
    expect(formatCounter(6, 6)).toBe('06 / 06');
    expect(formatCounter(10, 12)).toBe('10 / 12');
  });

  it('widens both numbers together when the total needs more digits', () => {
    expect(formatCounter(7, 128)).toBe('007 / 128');
  });
});
