import { describe, expect, it } from 'vitest';
import { GameOracle } from '../../src/game/systems/oracle/GameOracle';
import {
  createBooleanFunction,
  createConstantFunction,
  createFunctionFromTruthTable,
  createParityFunction,
} from '../../src/quantum';

/** A 3-bit machine that answers 1 only for the input 101. */
const onlyFive = (): GameOracle => new GameOracle(createBooleanFunction(3, (input) => (input === 0b101 ? 1 : 0)));

describe('GameOracle: answering', () => {
  it('takes its input length from the hidden function', () => {
    expect(new GameOracle(createConstantFunction(6, 0)).inputLength).toBe(6);
    expect(onlyFive().inputLength).toBe(3);
  });

  it('answers with the hidden function’s output for that input', () => {
    const oracle = onlyFive();
    expect(oracle.query('101').output).toBe(1);
    expect(oracle.query('100').output).toBe(0);
    expect(oracle.query('000').output).toBe(0);
  });

  it('reads the input with the leftmost bit as the most significant', () => {
    // "100" is 4 and "001" is 1: a function of the first bit must tell them apart.
    const firstBit = new GameOracle(createFunctionFromTruthTable([0, 0, 0, 0, 1, 1, 1, 1]));
    expect(firstBit.query('100').output).toBe(1);
    expect(firstBit.query('001').output).toBe(0);
  });

  it('agrees with the hidden function on every input', () => {
    const f = createParityFunction(4, 0b0110);
    const oracle = new GameOracle(f);
    for (let value = 0; value < 16; value += 1) {
      const input = value.toString(2).padStart(4, '0');
      expect(oracle.query(input).output).toBe(f.evaluate(value));
    }
  });

  it('gives the same answer every time the same input is asked', () => {
    const oracle = onlyFive();
    const answers = Array.from({ length: 20 }, () => oracle.query('101').output);
    expect(new Set(answers)).toEqual(new Set([1]));
  });

  it('behaves differently when given a different function, with nothing else changed', () => {
    expect(new GameOracle(createConstantFunction(3, 0)).query('111').output).toBe(0);
    expect(new GameOracle(createConstantFunction(3, 1)).query('111').output).toBe(1);
  });
});

describe('GameOracle: input validation', () => {
  it.each(['', '1', '10', '1010', '101010'])('rejects "%s", which is not 3 bits long', (input) => {
    expect(() => onlyFive().query(input)).toThrow(/Expected exactly 3 bits/);
  });

  it.each(['12a', 'abc', '1 1', '1.1', '-01', '２１０'])('rejects "%s", which is not binary', (input) => {
    expect(() => onlyFive().query(input)).toThrow(/only the digits 0 and 1/);
  });

  it('records nothing when an input is rejected', () => {
    const oracle = onlyFive();
    expect(() => oracle.query('10')).toThrow();
    expect(() => oracle.query('1x1')).toThrow();

    expect(oracle.queryCount).toBe(0);
    expect(oracle.history).toEqual([]);
  });
});

describe('GameOracle: the record of queries', () => {
  it('starts empty', () => {
    const oracle = onlyFive();
    expect(oracle.queryCount).toBe(0);
    expect(oracle.history).toEqual([]);
  });

  it('records each query with its number, input and output, oldest first', () => {
    const oracle = onlyFive();
    oracle.query('000');
    oracle.query('101');
    oracle.query('111');

    expect(oracle.history).toEqual([
      { number: 1, input: '000', output: 0 },
      { number: 2, input: '101', output: 1 },
      { number: 3, input: '111', output: 0 },
    ]);
    expect(oracle.queryCount).toBe(3);
  });

  it('returns the same entry that it records', () => {
    const oracle = onlyFive();
    const returned = oracle.query('101');
    expect(oracle.history[0]).toBe(returned);
  });

  it('records a repeated input as a separate query', () => {
    const oracle = onlyFive();
    oracle.query('101');
    oracle.query('101');

    expect(oracle.queryCount).toBe(2);
    expect(oracle.history.map((entry) => entry.number)).toEqual([1, 2]);
  });

  it('cannot have its record altered from outside', () => {
    const oracle = onlyFive();
    const entry = oracle.query('101');

    (oracle.history as unknown[]).length = 0; // tampering with the returned copy
    expect(oracle.queryCount).toBe(1);

    expect(Object.isFrozen(entry)).toBe(true);
    expect(() => {
      (entry as { output: number }).output = 0;
    }).toThrow(TypeError);
    expect(oracle.history[0]?.output).toBe(1);
  });

  it('keeps separate machines separate', () => {
    const first = onlyFive();
    const second = onlyFive();
    first.query('101');

    expect(first.queryCount).toBe(1);
    expect(second.queryCount).toBe(0);
  });
});

describe('GameOracle: the hidden function stays hidden', () => {
  it('exposes nothing but its input length', () => {
    const oracle = new GameOracle(createParityFunction(6, 0b101101));
    expect(Object.keys(oracle)).toEqual(['inputLength']);
    expect(JSON.stringify(oracle)).toBe('{"inputLength":6}');
  });

  it('offers no property or method that describes the function', () => {
    const members = Object.getOwnPropertyNames(GameOracle.prototype).sort();
    expect(members).toEqual(['constructor', 'history', 'query', 'queryCount']);
  });

  it('never evaluates the function except to answer a query', () => {
    let evaluations = 0;
    const oracle = new GameOracle(
      createBooleanFunction(3, () => {
        evaluations += 1;
        return 0;
      }),
    );
    expect(evaluations).toBe(0);

    oracle.query('010');
    oracle.query('011');
    void oracle.history;
    void oracle.queryCount;
    expect(evaluations).toBe(2);
  });
});
