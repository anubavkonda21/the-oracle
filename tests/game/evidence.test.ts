import { describe, expect, it } from 'vitest';
import { GameOracle, type OracleQuery } from '../../src/game/systems/oracle/GameOracle';
import {
  agreementNeeded,
  classifyEvidence,
  gatherEvidence,
  judgeConclusion,
  observedOutputs,
  possibleKinds,
  soleOutput,
  type Evidence,
} from '../../src/game/systems/oracle/evidence';
import { inputAt } from '../../src/game/systems/oracle/inputSpace';
import { ORACLE_KINDS, type OracleKind } from '../../src/game/systems/oracle/oracleKind';
import { createBooleanFunction, createConstantFunction, type Bit } from '../../src/quantum';

/** Source text of the game's files, for checking what the evidence module can reach. */
const gameSources = import.meta.glob<string>('../../src/game/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const sourceOf = (fileName: string): string => {
  const entry = Object.entries(gameSources).find(([path]) => path.endsWith(fileName));
  if (!entry) {
    throw new Error(`No game source file named ${fileName}.`);
  }
  return entry[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
};

/** A record written out by hand: no machine produced it. Each pair is an input and the output observed for it. */
const recordOf = (...entries: readonly (readonly [input: string, output: Bit])[]): OracleQuery[] =>
  entries.map(([input, output], index) => ({ number: index + 1, input, output }));

/** Evidence with the given counts, for a six-bit machine unless told otherwise. */
const evidence = (zeros: number, ones: number, inputSpaceSize = 64): Evidence => ({ inputSpaceSize, zeros, ones });

/** A six-bit record of the first `count` inputs, all with the same output. */
const identicalAnswers = (count: number, output: Bit): OracleQuery[] =>
  Array.from({ length: count }, (_, index) => ({ number: index + 1, input: inputAt(index, 6), output }));

describe('evidence: counting the record', () => {
  it('is nothing at all before anything has been asked', () => {
    expect(gatherEvidence([], 64)).toEqual({ inputSpaceSize: 64, zeros: 0, ones: 0 });
  });

  it('counts the inputs on record by the output each one gave', () => {
    const record = recordOf(['000000', 0], ['111111', 0], ['010110', 1], ['000001', 1], ['100000', 1]);
    expect(gatherEvidence(record, 64)).toEqual({ inputSpaceSize: 64, zeros: 2, ones: 3 });
  });

  it('counts an input once, however often it appears', () => {
    const record = recordOf(['000000', 0], ['000000', 0], ['000000', 0], ['010110', 1]);
    expect(gatherEvidence(record, 64)).toEqual({ inputSpaceSize: 64, zeros: 1, ones: 1 });
  });

  it('counts a complete record in full', () => {
    expect(gatherEvidence(identicalAnswers(64, 1), 64)).toEqual({ inputSpaceSize: 64, zeros: 0, ones: 64 });
  });

  it('refuses a record in which one input has two different outputs: no fixed machine produces that', () => {
    expect(() => gatherEvidence(recordOf(['010110', 1], ['010110', 0]), 64)).toThrow(/two different outputs/);
  });

  it('refuses a record with more inputs than exist', () => {
    expect(() => gatherEvidence(recordOf(['00', 0], ['01', 0], ['10', 0]), 2)).toThrow(/more than the 2 that exist/);
  });

  it.each([0, 1, 3, 7, 2.5, -4, Number.NaN])('refuses %s as the size of an input space', (size) => {
    expect(() => gatherEvidence([], size)).toThrow(RangeError);
  });

  it('is a snapshot, and leaves the record as it found it', () => {
    const record = recordOf(['000000', 0], ['010110', 1]);
    const before = JSON.stringify(record);
    const gathered = gatherEvidence(record, 64);

    expect(Object.isFrozen(gathered)).toBe(true);
    expect(JSON.stringify(record)).toBe(before);
  });
});

describe('evidence: which outputs have been observed', () => {
  it('is none, only 0, only 1, or both', () => {
    expect(observedOutputs(evidence(0, 0))).toBe('none');
    expect(observedOutputs(evidence(5, 0))).toBe('zero');
    expect(observedOutputs(evidence(0, 5))).toBe('one');
    expect(observedOutputs(evidence(5, 1))).toBe('both');
  });

  it('follows the record as it grows', () => {
    const record = recordOf(['000000', 0], ['111111', 0], ['100000', 1]);

    expect(observedOutputs(gatherEvidence(record.slice(0, 0), 64))).toBe('none');
    expect(observedOutputs(gatherEvidence(record.slice(0, 1), 64))).toBe('zero');
    expect(observedOutputs(gatherEvidence(record.slice(0, 2), 64))).toBe('zero');
    expect(observedOutputs(gatherEvidence(record.slice(0, 3), 64))).toBe('both');
  });

  it('names the one output every answer agrees on, and how many agree', () => {
    expect(soleOutput(evidence(5, 0))).toEqual({ output: 0, count: 5 });
    expect(soleOutput(evidence(0, 12))).toEqual({ output: 1, count: 12 });
    expect(soleOutput(evidence(0, 0))).toBeNull();
    expect(soleOutput(evidence(5, 1))).toBeNull();
  });
});

describe('evidence: both outputs observed rules out constant', () => {
  it('proves the machine cannot be constant, as soon as one of each is on record', () => {
    expect(possibleKinds(evidence(1, 1)).constant).toBe(false);
  });

  it('however lopsided the record', () => {
    for (const [zeros, ones] of [
      [31, 1],
      [1, 31],
      [32, 32],
      [20, 3],
    ] as const) {
      expect(possibleKinds(evidence(zeros, ones)).constant).toBe(false);
    }
  });

  it('needs no promise: two different outputs are not the same output', () => {
    // Even evidence that fits neither kind still rules constant out.
    expect(possibleKinds(evidence(40, 1)).constant).toBe(false);
  });

  it('under the promise, leaves balanced', () => {
    expect(classifyEvidence(evidence(1, 1))).toBe('balanced');
    expect(classifyEvidence(evidence(7, 2))).toBe('balanced');
    expect(classifyEvidence(evidence(32, 32))).toBe('balanced');
  });

  it('is reached from a real record the moment the second output appears', () => {
    const record = recordOf(['000000', 0], ['111111', 0], ['101010', 0], ['100000', 1]);

    expect(classifyEvidence(gatherEvidence(record.slice(0, 3), 64))).toBe('undetermined');
    expect(classifyEvidence(gatherEvidence(record, 64))).toBe('balanced');
  });
});

describe('evidence: one output observed cannot tell constant from balanced', () => {
  it('does not prove the machine constant, for any number of identical answers up to half of all inputs', () => {
    for (let count = 1; count <= 32; count += 1) {
      for (const identical of [evidence(count, 0), evidence(0, count)]) {
        expect(possibleKinds(identical)).toEqual({ constant: true, balanced: true });
        expect(classifyEvidence(identical)).toBe('undetermined');
      }
    }
  });

  it('settles nothing before anything has been observed', () => {
    expect(possibleKinds(evidence(0, 0))).toEqual({ constant: true, balanced: true });
    expect(classifyEvidence(evidence(0, 0))).toBe('undetermined');
  });

  it('is exactly the record a balanced machine can produce: a constant machine and a balanced one, asked the same 32 inputs', () => {
    const constant = new GameOracle(createConstantFunction(6, 0));
    const balanced = new GameOracle(createBooleanFunction(6, (input) => (input < 32 ? 0 : 1)));
    for (let index = 0; index < 32; index += 1) {
      constant.query(inputAt(index, 6));
      balanced.query(inputAt(index, 6));
    }

    // Two machines of different kinds; one and the same record; so no verdict.
    expect(balanced.history).toEqual(constant.history);
    expect(gatherEvidence(balanced.history, 64)).toEqual(gatherEvidence(constant.history, 64));
    expect(classifyEvidence(gatherEvidence(constant.history, 64))).toBe('undetermined');

    // One more input tells them apart — in opposite directions.
    constant.query(inputAt(32, 6));
    balanced.query(inputAt(32, 6));
    expect(classifyEvidence(gatherEvidence(constant.history, 64))).toBe('constant');
    expect(classifyEvidence(gatherEvidence(balanced.history, 64))).toBe('balanced');
  });
});

describe('evidence: more than half agreeing rules out balanced', () => {
  it('takes one more than half: 33 of 64', () => {
    expect(agreementNeeded(64)).toBe(33);
    expect(agreementNeeded(8)).toBe(5);
    expect(agreementNeeded(2)).toBe(2);
  });

  it('is not reached at exactly half: 32 identical answers still allow a balanced machine', () => {
    expect(possibleKinds(evidence(32, 0)).balanced).toBe(true);
    expect(possibleKinds(evidence(0, 32)).balanced).toBe(true);
  });

  it('is reached at 33, and stays reached', () => {
    for (let count = 33; count <= 64; count += 1) {
      for (const identical of [evidence(count, 0), evidence(0, count)]) {
        expect(possibleKinds(identical)).toEqual({ constant: true, balanced: false });
        expect(classifyEvidence(identical)).toBe('constant');
      }
    }
  });

  it('is reached from a real record at the 33rd identical answer and not before', () => {
    expect(classifyEvidence(gatherEvidence(identicalAnswers(32, 0), 64))).toBe('undetermined');
    expect(classifyEvidence(gatherEvidence(identicalAnswers(33, 0), 64))).toBe('constant');
    expect(classifyEvidence(gatherEvidence(identicalAnswers(33, 1), 64))).toBe('constant');
  });
});

describe('evidence: a complete record classifies exactly', () => {
  it('as constant when all 64 outputs are identical', () => {
    expect(classifyEvidence(gatherEvidence(identicalAnswers(64, 0), 64))).toBe('constant');
    expect(classifyEvidence(gatherEvidence(identicalAnswers(64, 1), 64))).toBe('constant');
  });

  it('as balanced when 32 are 0 and 32 are 1', () => {
    const record = Array.from({ length: 64 }, (_, index): OracleQuery => ({
      number: index + 1,
      input: inputAt(index, 6),
      output: index % 2 === 0 ? 0 : 1,
    }));
    expect(classifyEvidence(gatherEvidence(record, 64))).toBe('balanced');
  });

  it('as neither when the outputs fit neither kind: the promise was broken', () => {
    expect(classifyEvidence(evidence(40, 24))).toBe('neither');
    expect(classifyEvidence(evidence(63, 1))).toBe('neither');
    expect(possibleKinds(evidence(40, 24))).toEqual({ constant: false, balanced: false });
  });

  it('never leaves a complete record undetermined', () => {
    for (let ones = 0; ones <= 64; ones += 1) {
      expect(classifyEvidence(evidence(64 - ones, ones))).not.toBe('undetermined');
    }
  });

  it('notices a broken promise before the record is complete, too', () => {
    expect(classifyEvidence(evidence(33, 1))).toBe('neither'); // more than half agree, yet both outputs were seen
  });
});

describe('evidence: it concludes exactly what the record allows — no more, no less', () => {
  /** Every function of `bits` bits that keeps the promise, as its truth table and its kind. */
  function promisedFunctions(bits: number): { table: Bit[]; kind: OracleKind }[] {
    const inputs = 2 ** bits;
    const functions: { table: Bit[]; kind: OracleKind }[] = [];

    for (let code = 0; code < 2 ** inputs; code += 1) {
      const table = Array.from({ length: inputs }, (_, input): Bit => ((code >> input) & 1) as Bit);
      const ones = table.filter((output) => output === 1).length;
      if (ones === 0 || ones === inputs) {
        functions.push({ table, kind: 'constant' });
      } else if (ones === inputs / 2) {
        functions.push({ table, kind: 'balanced' });
      }
    }
    return functions;
  }

  it.each([1, 2, 3])('for every promised machine of %i bit(s), and every set of inputs that could be on record', (bits) => {
    const inputs = 2 ** bits;
    const machines = promisedFunctions(bits);
    let checked = 0;

    for (const machine of machines) {
      for (let asked = 0; asked < 2 ** inputs; asked += 1) {
        const onRecord = Array.from({ length: inputs }, (_, input) => input).filter((input) => (asked >> input) & 1);
        const record = onRecord.map((input, index): OracleQuery => ({
          number: index + 1,
          input: inputAt(input, bits),
          output: machine.table[input] ?? 0,
        }));

        // The kinds of every promised machine that would have given this same record.
        const stillPossible = new Set(
          machines
            .filter((other) => onRecord.every((input) => other.table[input] === machine.table[input]))
            .map((other) => other.kind),
        );
        const expected = stillPossible.size === 2 ? 'undetermined' : [...stillPossible][0];

        expect(classifyEvidence(gatherEvidence(record, inputs))).toBe(expected);
        checked += 1;
      }
    }
    expect(checked).toBe(machines.length * 2 ** inputs);
  });

  it('covers all 72 promised machines of three bits against all 256 possible records each', () => {
    expect(promisedFunctions(3)).toHaveLength(72);
    expect(promisedFunctions(3).filter((machine) => machine.kind === 'constant')).toHaveLength(2);
  });

  it('is never wrong about a real machine: a verdict, once given, is the machine’s true kind', () => {
    for (const machine of promisedFunctions(3)) {
      const record: OracleQuery[] = [];
      for (let input = 0; input < 8; input += 1) {
        record.push({ number: input + 1, input: inputAt(input, 3), output: machine.table[input] ?? 0 });
        const verdict = classifyEvidence(gatherEvidence(record, 8));

        expect(['undetermined', machine.kind]).toContain(verdict);
      }
      expect(classifyEvidence(gatherEvidence(record, 8))).toBe(machine.kind);
    }
  });

  it('never goes back on a verdict as the record grows', () => {
    for (const machine of promisedFunctions(3)) {
      const record: OracleQuery[] = [];
      let settled = false;
      for (let input = 0; input < 8; input += 1) {
        record.push({ number: input + 1, input: inputAt(input, 3), output: machine.table[input] ?? 0 });
        const verdict = classifyEvidence(gatherEvidence(record, 8));

        if (settled) {
          expect(verdict).toBe(machine.kind);
        }
        settled = settled || verdict !== 'undetermined';
      }
    }
  });
});

describe('evidence: how a conclusion stands', () => {
  it.each([
    // conclusion, zeros, ones, standing
    ['constant', 0, 0, 'not-established'],
    ['balanced', 0, 0, 'not-established'],
    ['constant', 5, 0, 'not-established'],
    ['balanced', 5, 0, 'not-established'],
    ['constant', 32, 0, 'not-established'],
    ['balanced', 0, 32, 'not-established'],
    ['constant', 33, 0, 'established'],
    ['balanced', 33, 0, 'contradicted'],
    ['constant', 0, 64, 'established'],
    ['balanced', 0, 64, 'contradicted'],
    ['constant', 1, 1, 'contradicted'],
    ['balanced', 1, 1, 'established'],
    ['constant', 7, 2, 'contradicted'],
    ['balanced', 7, 2, 'established'],
    ['constant', 32, 32, 'contradicted'],
    ['balanced', 32, 32, 'established'],
  ] as const)('%s, with %i zeros and %i ones on record, is %s', (conclusion, zeros, ones, standing) => {
    expect(judgeConclusion(conclusion, evidence(zeros, ones))).toBe(standing);
  });

  it('is established exactly when the evidence has settled on that kind', () => {
    for (let zeros = 0; zeros <= 8; zeros += 1) {
      for (let ones = 0; zeros + ones <= 8; ones += 1) {
        const counted = evidence(zeros, ones, 8);
        const verdict = classifyEvidence(counted);

        for (const kind of ORACLE_KINDS) {
          expect(judgeConclusion(kind, counted) === 'established').toBe(verdict === kind);
          expect(judgeConclusion(kind, counted) === 'contradicted').toBe(!possibleKinds(counted)[kind]);
        }
      }
    }
  });

  it('never establishes both conclusions at once, and never leaves both contradicted under the promise', () => {
    for (let zeros = 0; zeros <= 8; zeros += 1) {
      for (let ones = 0; zeros + ones <= 8; ones += 1) {
        const counted = evidence(zeros, ones, 8);
        const standings = ORACLE_KINDS.map((kind) => judgeConclusion(kind, counted));

        expect(standings.filter((standing) => standing === 'established').length).toBeLessThanOrEqual(1);
        if (classifyEvidence(counted) !== 'neither') {
          expect(standings.filter((standing) => standing === 'contradicted').length).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('contradicts both conclusions when the evidence fits neither kind', () => {
    expect(ORACLE_KINDS.map((kind) => judgeConclusion(kind, evidence(40, 24)))).toEqual(['contradicted', 'contradicted']);
  });
});

describe('evidence: it sees only the record', () => {
  it('works from a record written out by hand, with no machine anywhere', () => {
    const record = recordOf(['000000', 0], ['111111', 0], ['010110', 1]);

    expect(classifyEvidence(gatherEvidence(record, 64))).toBe('balanced');
    expect(judgeConclusion('constant', gatherEvidence(record, 64))).toBe('contradicted');
  });

  it('does not consult the machine: gathering, classifying and judging evaluate nothing', () => {
    let evaluations = 0;
    const oracle = new GameOracle(
      createBooleanFunction(3, (input) => {
        evaluations += 1;
        return input === 0b101 ? 1 : 0;
      }),
    );
    oracle.query('000');
    oracle.query('011');
    expect(evaluations).toBe(2);

    const gathered = gatherEvidence(oracle.history, 8);
    void observedOutputs(gathered);
    void possibleKinds(gathered);
    void classifyEvidence(gathered);
    void judgeConclusion('constant', gathered);
    void judgeConclusion('balanced', gathered);

    expect(evaluations).toBe(2); // the two queries, and nothing since
    expect(oracle.queryCount).toBe(2);
  });

  it('gives the same evidence for the same record, whatever the machines would have answered elsewhere', () => {
    // Three machines that agree on 000 and 011, and on nothing else that matters.
    const machines = [
      new GameOracle(createConstantFunction(3, 0)),
      new GameOracle(createBooleanFunction(3, (input) => (input >= 4 ? 1 : 0))),
      new GameOracle(createBooleanFunction(3, (input) => ([1, 2, 4, 7].includes(input) ? 1 : 0))),
    ];
    const gathered = machines.map((oracle) => {
      oracle.query('000');
      oracle.query('011');
      return gatherEvidence(oracle.history, 8);
    });

    expect(gathered[1]).toEqual(gathered[0]);
    expect(gathered[2]).toEqual(gathered[0]);
    expect(classifyEvidence(gathered[0] ?? evidence(0, 0, 8))).toBe('undetermined');
  });

  it('is handed nothing but the record and the size of the input space', () => {
    expect(gatherEvidence.length).toBe(2);
    expect(classifyEvidence.length).toBe(1);
    expect(judgeConclusion.length).toBe(2);
  });

  it('cannot reach the machine, the hidden function or the quantum engine', () => {
    const source = sourceOf('/systems/oracle/evidence.ts');
    const imports = [...source.matchAll(/^import (type )?\{[^}]*\} from '([^']+)';/gm)].map((match) => ({
      typeOnly: match[1] !== undefined,
      from: match[2],
    }));

    // Two imports, both of types only: the shape of a recorded query, and the names of the two kinds.
    expect(imports).toEqual([
      { typeOnly: true, from: './GameOracle' },
      { typeOnly: true, from: './oracleKind' },
    ]);
    expect(source).not.toMatch(/quantum/i);
    expect(source).not.toMatch(/\bevaluate\b|\.query\(|\bBooleanFunction\b|\btruthTable\b|classifyByTruthTable/);
    expect(source).not.toMatch(/Math\.random/);
  });
});
