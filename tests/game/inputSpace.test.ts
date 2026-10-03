import { describe, expect, it } from 'vitest';
import { ORACLE_INPUT_LENGTH } from '../../src/game/config/oracleConfig';
import { GameOracle } from '../../src/game/systems/oracle/GameOracle';
import { inputAt, inputIndex, inputSpaceLayout, inputSpaceSize } from '../../src/game/systems/oracle/inputSpace';
import { createFunctionFromTruthTable, type Bit } from '../../src/quantum';

describe('input space: its size', () => {
  it('is 2 to the power of the number of bits', () => {
    expect(inputSpaceSize(1)).toBe(2);
    expect(inputSpaceSize(2)).toBe(4);
    expect(inputSpaceSize(3)).toBe(8);
    expect(inputSpaceSize(10)).toBe(1024);
  });

  it('is 64 for the six bits of the prototype machine', () => {
    expect(inputSpaceSize(ORACLE_INPUT_LENGTH)).toBe(64);
  });

  it('doubles with every bit added', () => {
    for (let bits = 1; bits < 14; bits += 1) {
      expect(inputSpaceSize(bits + 1)).toBe(2 * inputSpaceSize(bits));
    }
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s as a number of bits', (bits) => {
    expect(() => inputSpaceSize(bits)).toThrow(/positive whole number/);
  });
});

describe('input space: laid out as a grid', () => {
  it('is 8 by 8 for six bits', () => {
    expect(inputSpaceLayout(6)).toEqual({ columns: 8, rows: 8 });
  });

  it('is square for an even number of bits, and twice as wide as tall for an odd one', () => {
    expect(inputSpaceLayout(2)).toEqual({ columns: 2, rows: 2 });
    expect(inputSpaceLayout(4)).toEqual({ columns: 4, rows: 4 });
    expect(inputSpaceLayout(1)).toEqual({ columns: 2, rows: 1 });
    expect(inputSpaceLayout(3)).toEqual({ columns: 4, rows: 2 });
    expect(inputSpaceLayout(5)).toEqual({ columns: 8, rows: 4 });
  });

  it('has exactly one cell for every possible input', () => {
    for (let bits = 1; bits <= 12; bits += 1) {
      const { columns, rows } = inputSpaceLayout(bits);
      expect(columns * rows).toBe(inputSpaceSize(bits));
      expect(Number.isInteger(rows)).toBe(true);
      expect([1, 2]).toContain(columns / rows);
    }
  });

  it('rejects a number of bits that is not a positive whole number', () => {
    expect(() => inputSpaceLayout(0)).toThrow(RangeError);
    expect(() => inputSpaceLayout(2.5)).toThrow(RangeError);
  });
});

describe('input space: the position of an input', () => {
  it('is the input read as a binary number', () => {
    expect(inputIndex('000000')).toBe(0);
    expect(inputIndex('000001')).toBe(1);
    expect(inputIndex('000010')).toBe(2);
    expect(inputIndex('111111')).toBe(63);
  });

  it('takes the leftmost bit as the most significant', () => {
    expect(inputIndex('100000')).toBe(32);
    expect(inputIndex('100')).toBe(4);
    expect(inputIndex('001')).toBe(1);
  });

  it.each(['', '12', 'abc', ' 01', '0 1', '1.0', '-1'])('rejects "%s", which is not a binary input', (input) => {
    expect(() => inputIndex(input)).toThrow(/no position in the input space/);
  });
});

describe('input space: the input at a position', () => {
  it('is that number written in binary, padded to the full width', () => {
    expect(inputAt(0, 6)).toBe('000000');
    expect(inputAt(1, 6)).toBe('000001');
    expect(inputAt(32, 6)).toBe('100000');
    expect(inputAt(63, 6)).toBe('111111');
    expect(inputAt(5, 3)).toBe('101');
  });

  it.each([-1, 64, 1.5, Number.NaN])('rejects position %s in a space of 64', (index) => {
    expect(() => inputAt(index, 6)).toThrow(/outside an input space of 64/);
  });

  it('lists every input exactly once, in counting order', () => {
    const inputs = Array.from({ length: 64 }, (_, index) => inputAt(index, 6));

    expect(new Set(inputs).size).toBe(64);
    expect(inputs[0]).toBe('000000');
    expect(inputs[63]).toBe('111111');
    expect([...inputs].sort()).toEqual(inputs); // binary strings of one width sort in counting order
    for (const input of inputs) {
      expect(input).toMatch(/^[01]{6}$/);
    }
  });

  it('is undone by taking the position again', () => {
    for (let bits = 1; bits <= 8; bits += 1) {
      for (let index = 0; index < inputSpaceSize(bits); index += 1) {
        expect(inputIndex(inputAt(index, bits))).toBe(index);
      }
    }
  });
});

describe('input space: where an input sits in the grid', () => {
  it('is picked by its first three bits (the row) and its last three (the column), for six bits', () => {
    const { columns } = inputSpaceLayout(6);

    for (let index = 0; index < 64; index += 1) {
      const input = inputAt(index, 6);
      const row = Number.parseInt(input.slice(0, 3), 2);
      const column = Number.parseInt(input.slice(3), 2);

      expect(Math.floor(index / columns)).toBe(row);
      expect(index % columns).toBe(column);
    }
  });

  it('puts the first input in the first cell and the last input in the last', () => {
    const { columns, rows } = inputSpaceLayout(6);
    expect(inputIndex('000000')).toBe(0);
    expect(inputIndex('111111')).toBe(columns * rows - 1);
  });
});

describe('input space: the same order the machine reads inputs in', () => {
  it('gives each position the answer the hidden function has for that number', () => {
    const table: Bit[] = [0, 1, 1, 0, 1, 0, 0, 0];
    const oracle = new GameOracle(createFunctionFromTruthTable(table));

    table.forEach((expected, index) => {
      expect(oracle.query(inputAt(index, 3)).output).toBe(expected);
    });
  });
});
