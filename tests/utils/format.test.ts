import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT } from '../../src/game/config/identity';
import { formatCount, formatCounter, formatQueryId } from '../../src/utils/format';

describe('formatCount', () => {
  it('zero-pads to three digits', () => {
    expect(formatCount(0)).toBe('000');
    expect(formatCount(7)).toBe('007');
    expect(formatCount(42)).toBe('042');
    expect(formatCount(999)).toBe('999');
  });

  it('does not truncate larger numbers', () => {
    expect(formatCount(1234)).toBe('1234');
  });
});

describe('formatQueryId', () => {
  it('names a query the way the machine’s log prints it', () => {
    expect(formatQueryId(1)).toBe('QUERY_001');
    expect(formatQueryId(4)).toBe('QUERY_004');
    expect(formatQueryId(120)).toBe('QUERY_120');
  });
});

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
