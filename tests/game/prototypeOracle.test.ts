import { describe, expect, it } from 'vitest';
import { ORACLE_INPUT_LENGTH, ORACLE_TIMING } from '../../src/game/config/oracleConfig';
import { createPrototypeOracle } from '../../src/game/systems/oracle/prototypeOracle';

const allInputs = (): string[] =>
  Array.from({ length: 2 ** ORACLE_INPUT_LENGTH }, (_, value) => value.toString(2).padStart(ORACLE_INPUT_LENGTH, '0'));

/** The machine's answer to every possible input, as one string of 64 digits. */
function fingerprint(): string {
  const oracle = createPrototypeOracle();
  return allInputs()
    .map((input) => oracle.query(input).output)
    .join('');
}

describe('prototype machine', () => {
  it('takes a 6-bit input', () => {
    expect(ORACLE_INPUT_LENGTH).toBe(6);
    expect(createPrototypeOracle().inputLength).toBe(6);
  });

  it('starts every session with an empty record', () => {
    const first = createPrototypeOracle();
    first.query('010110');
    expect(createPrototypeOracle().queryCount).toBe(0);
  });

  it('behaves identically in every session: nothing about it is random', () => {
    const sessions = Array.from({ length: 5 }, fingerprint);
    expect(new Set(sessions).size).toBe(1);
  });

  it('keeps the behaviour it shipped with', () => {
    // Pinned so that an accidental change to the hidden rule is noticed. Replacing the rule on purpose means updating this.
    expect(fingerprint()).toBe('0101101010100101010110101010010110100101010110101010010101011010');
  });

  it('answers 0 to the all-zero input', () => {
    expect(createPrototypeOracle().query('000000').output).toBe(0);
  });

  it('depends on some bits and not on others, so there is something to discover', () => {
    const oracle = createPrototypeOracle();
    const baseline = oracle.query('000000').output;

    const bitsThatMatter = Array.from({ length: ORACLE_INPUT_LENGTH }, (_, index) => {
      const input = '0'.repeat(index) + '1' + '0'.repeat(ORACLE_INPUT_LENGTH - index - 1);
      return oracle.query(input).output !== baseline;
    });

    expect(bitsThatMatter).toContain(true);
    expect(bitsThatMatter).toContain(false);
  });

  it('gives both answers, so the output is worth reading', () => {
    const outputs = new Set(fingerprint());
    expect(outputs).toEqual(new Set(['0', '1']));
  });
});

describe('machine timing', () => {
  it('works on a query for about a second: long enough to watch, short enough to repeat', () => {
    expect(ORACLE_TIMING.processingMs).toBeGreaterThanOrEqual(600);
    expect(ORACLE_TIMING.processingMs).toBeLessThanOrEqual(1500);
  });

  it('fits its two ring contractions inside the processing time', () => {
    expect(ORACLE_TIMING.irisPulseMs * 2).toBeLessThanOrEqual(ORACLE_TIMING.processingMs);
  });

  it('waits less, but still perceptibly, when motion is reduced', () => {
    expect(ORACLE_TIMING.reducedMotionProcessingMs).toBeLessThan(ORACLE_TIMING.processingMs);
    expect(ORACLE_TIMING.reducedMotionProcessingMs).toBeGreaterThanOrEqual(200);
  });
});
