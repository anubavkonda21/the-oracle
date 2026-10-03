import { describe, expect, it } from 'vitest';
import { ORACLE_INPUT_LENGTH } from '../../src/game/config/oracleConfig';
import { BoxExperiment } from '../../src/game/systems/box/BoxExperiment';
import { GameOracle } from '../../src/game/systems/oracle/GameOracle';
import { Investigation } from '../../src/game/systems/oracle/Investigation';
import { inputAt, inputSpaceSize } from '../../src/game/systems/oracle/inputSpace';
import { createPrototypeOracle } from '../../src/game/systems/oracle/prototypeOracle';
import { createBooleanFunction, createConstantFunction, createParityFunction } from '../../src/quantum';
import { createSeededRandom } from '../../src/utils/random';

/** Source text of the game's files, for checking how the laboratory uses the investigation. */
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

/**
 * A 3-bit machine that answers 1 only for 101, with a count of how many times
 * its hidden function has really been evaluated — that is, how many queries
 * have really been spent.
 */
function watchedMachine(): { oracle: GameOracle; investigation: Investigation; evaluations: () => number } {
  let evaluations = 0;
  const oracle = new GameOracle(
    createBooleanFunction(3, (input) => {
      evaluations += 1;
      return input === 0b101 ? 1 : 0;
    }),
  );
  return { oracle, investigation: new Investigation(oracle), evaluations: () => evaluations };
}

const prototypeInvestigation = (): Investigation => new Investigation(createPrototypeOracle());

const everyInput = (inputLength: number): string[] =>
  Array.from({ length: inputSpaceSize(inputLength) }, (_, index) => inputAt(index, inputLength));

/** The answer to every possible input, in counting order, as one string of digits. */
const fingerprint = (investigation: Investigation): string =>
  everyInput(investigation.inputLength)
    .map((input) => investigation.ask(input).query.output)
    .join('');

/** Pinned in tests/game/prototypeOracle.test.ts: everything the prototype machine does. */
const PROTOTYPE_BEHAVIOUR = '0101101010100101010110101010010110100101010110101010010101011010';

describe('Investigation: before anything has been asked', () => {
  it('has an empty record and has used no queries', () => {
    const { investigation, evaluations } = watchedMachine();

    expect(investigation.record).toEqual([]);
    expect(investigation.progress).toEqual({ queryCount: 0, testedCount: 0, untestedCount: 8, inputSpaceSize: 8 });
    expect(evaluations()).toBe(0);
  });

  it('takes its input length, and the size of its input space, from the machine', () => {
    expect(watchedMachine().investigation.inputLength).toBe(3);
    expect(watchedMachine().investigation.inputSpaceSize).toBe(8);

    expect(prototypeInvestigation().inputLength).toBe(ORACLE_INPUT_LENGTH);
    expect(prototypeInvestigation().inputSpaceSize).toBe(64);
  });

  it('has 64 untested inputs for the six-bit prototype', () => {
    expect(prototypeInvestigation().progress.untestedCount).toBe(64);
  });
});

describe('Investigation: asking about a new input', () => {
  it('asks the machine, and returns its answer', () => {
    const { investigation } = watchedMachine();

    expect(investigation.ask('101')).toEqual({ kind: 'asked', query: { number: 1, input: '101', output: 1 } });
    expect(investigation.ask('100')).toEqual({ kind: 'asked', query: { number: 2, input: '100', output: 0 } });
  });

  it('uses exactly one query', () => {
    const { oracle, investigation, evaluations } = watchedMachine();
    investigation.ask('101');

    expect(evaluations()).toBe(1);
    expect(oracle.queryCount).toBe(1);
    expect(investigation.progress.queryCount).toBe(1);
  });

  it('puts the answer on record', () => {
    const { investigation } = watchedMachine();
    const { query } = investigation.ask('101');

    expect(investigation.record).toEqual([{ number: 1, input: '101', output: 1 }]);
    expect(investigation.find('101')).toBe(query);
  });

  it('numbers the queries in the order they were asked', () => {
    const { investigation } = watchedMachine();
    const numbers = ['000', '111', '010', '101'].map((input) => investigation.ask(input).query.number);

    expect(numbers).toEqual([1, 2, 3, 4]);
    expect(investigation.record.map((entry) => entry.input)).toEqual(['000', '111', '010', '101']);
  });

  it('gives the machine’s own answer for every input', () => {
    const f = createParityFunction(4, 0b0110);
    const investigation = new Investigation(new GameOracle(f));

    for (let value = 0; value < 16; value += 1) {
      expect(investigation.ask(inputAt(value, 4)).query.output).toBe(f.evaluate(value));
    }
  });
});

describe('Investigation: asking about an input that is already on record', () => {
  it('does not ask the machine again', () => {
    const { oracle, investigation, evaluations } = watchedMachine();
    investigation.ask('101');
    investigation.ask('101');

    expect(evaluations()).toBe(1);
    expect(oracle.queryCount).toBe(1);
  });

  it('says so, and hands back the entry that is on record', () => {
    const { investigation } = watchedMachine();
    const first = investigation.ask('101');
    const second = investigation.ask('101');

    expect(first.kind).toBe('asked');
    expect(second.kind).toBe('recalled');
    expect(second.query).toBe(first.query); // the very same entry, not a new one that looks like it
  });

  it('uses no query, however many times it is repeated', () => {
    const { oracle, investigation, evaluations } = watchedMachine();
    investigation.ask('011');

    for (let repeat = 0; repeat < 50; repeat += 1) {
      expect(investigation.ask('011').kind).toBe('recalled');
    }
    expect(evaluations()).toBe(1);
    expect(oracle.queryCount).toBe(1);
    expect(investigation.progress.queryCount).toBe(1);
  });

  it('adds nothing to the record', () => {
    const { investigation } = watchedMachine();
    investigation.ask('011');
    const before = JSON.stringify(investigation.record);

    investigation.ask('011');
    investigation.ask('011');
    expect(JSON.stringify(investigation.record)).toBe(before);
    expect(investigation.record).toHaveLength(1);
  });

  it('is noticed however long ago the input was asked, not only when it was the last one', () => {
    const { investigation } = watchedMachine();
    investigation.ask('101');
    investigation.ask('000');
    investigation.ask('111');

    const again = investigation.ask('101');
    expect(again.kind).toBe('recalled');
    expect(again.query.number).toBe(1);
    expect(investigation.record).toHaveLength(3);
  });

  it('leaves no gap in the numbering of the queries that follow', () => {
    const { investigation } = watchedMachine();
    investigation.ask('101');
    investigation.ask('101');
    investigation.ask('101');

    expect(investigation.ask('110').query.number).toBe(2);
  });

  it('does not mistake a different input for a repeat', () => {
    const investigation = prototypeInvestigation();
    const kinds = ['000001', '000010', '100000', '010000', '000000'].map((input) => investigation.ask(input).kind);

    expect(kinds).toEqual(['asked', 'asked', 'asked', 'asked', 'asked']);
    expect(investigation.progress.queryCount).toBe(5);
  });

  it('recalls the same answer the machine gave the first time, for every input', () => {
    const investigation = prototypeInvestigation();
    const first = everyInput(6).map((input) => investigation.ask(input));
    const second = everyInput(6).map((input) => investigation.ask(input));

    second.forEach((outcome, index) => {
      expect(outcome.kind).toBe('recalled');
      expect(outcome.query.output).toBe(first[index]?.query.output);
    });
  });
});

describe('Investigation: looking an input up', () => {
  it('finds nothing for an input that has not been asked', () => {
    const { investigation } = watchedMachine();
    investigation.ask('101');

    expect(investigation.find('100')).toBeUndefined();
    expect(investigation.find('001')).toBeUndefined();
  });

  it('finds the entry for one that has', () => {
    const { investigation } = watchedMachine();
    investigation.ask('000');
    investigation.ask('101');

    expect(investigation.find('101')).toEqual({ number: 2, input: '101', output: 1 });
    expect(investigation.find('000')).toEqual({ number: 1, input: '000', output: 0 });
  });

  it('is free: it uses no query and does not consult the machine', () => {
    const { oracle, investigation, evaluations } = watchedMachine();
    investigation.ask('101');

    for (const input of everyInput(3)) {
      void investigation.find(input);
    }
    void investigation.record;
    void investigation.progress;

    expect(evaluations()).toBe(1);
    expect(oracle.queryCount).toBe(1);
  });

  it('finds nothing for something that is not an input at all', () => {
    const { investigation } = watchedMachine();
    investigation.ask('101');

    expect(investigation.find('')).toBeUndefined();
    expect(investigation.find('10')).toBeUndefined();
    expect(investigation.find('1010')).toBeUndefined();
  });
});

describe('Investigation: progress', () => {
  it('counts queries, tested inputs and untested inputs', () => {
    const investigation = prototypeInvestigation();
    for (const input of ['000000', '111111', '010110']) {
      investigation.ask(input);
    }
    expect(investigation.progress).toEqual({ queryCount: 3, testedCount: 3, untestedCount: 61, inputSpaceSize: 64 });
  });

  it('does not move when an input is repeated', () => {
    const investigation = prototypeInvestigation();
    investigation.ask('000000');
    investigation.ask('010110');
    const before = investigation.progress;

    investigation.ask('000000');
    investigation.ask('010110');
    investigation.ask('010110');
    expect(investigation.progress).toEqual(before);
  });

  it('always accounts for the whole input space', () => {
    const investigation = prototypeInvestigation();

    everyInput(6).forEach((input, index) => {
      investigation.ask(input);
      const { queryCount, testedCount, untestedCount, inputSpaceSize: size } = investigation.progress;

      expect(queryCount).toBe(index + 1);
      expect(testedCount).toBe(index + 1);
      expect(testedCount + untestedCount).toBe(size);
    });
  });

  it('reaches a complete record in exactly as many queries as there are inputs', () => {
    const oracle = createPrototypeOracle();
    const investigation = new Investigation(oracle);
    for (const input of everyInput(6)) {
      investigation.ask(input);
    }

    expect(investigation.progress).toEqual({ queryCount: 64, testedCount: 64, untestedCount: 0, inputSpaceSize: 64 });
    expect(oracle.queryCount).toBe(64);
  });

  it('can only recall once the record is complete: no further query is possible', () => {
    const oracle = createPrototypeOracle();
    const investigation = new Investigation(oracle);
    for (const input of everyInput(6)) {
      investigation.ask(input);
    }

    for (const input of everyInput(6)) {
      expect(investigation.ask(input).kind).toBe('recalled');
    }
    expect(oracle.queryCount).toBe(64);
  });

  it('never uses more queries than there are inputs, whatever is asked and however often', () => {
    const { oracle, investigation, evaluations } = watchedMachine();
    const random = createSeededRandom(6);

    for (let ask = 0; ask < 500; ask += 1) {
      investigation.ask(inputAt(Math.floor(random() * 8), 3));
      expect(oracle.queryCount).toBeLessThanOrEqual(8);
    }
    expect(evaluations()).toBe(8); // 500 questions at random reach all eight inputs — and spend eight queries, not 500
    expect(investigation.progress.untestedCount).toBe(0);
  });

  it('is a snapshot: it does not change after it has been taken', () => {
    const investigation = prototypeInvestigation();
    investigation.ask('000000');
    const snapshot = investigation.progress;
    investigation.ask('111111');

    expect(snapshot.queryCount).toBe(1);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(investigation.progress.queryCount).toBe(2);
  });
});

describe('Investigation: something the machine cannot accept', () => {
  it.each(['', '1', '10', '1010', '2', '1x1', '１０１'])('refuses "%s", as the machine does', (input) => {
    const { investigation } = watchedMachine();
    expect(() => investigation.ask(input)).toThrow(RangeError);
  });

  it('records nothing and uses no query', () => {
    const { oracle, investigation, evaluations } = watchedMachine();
    expect(() => investigation.ask('10')).toThrow(/Expected exactly 3 bits/);
    expect(() => investigation.ask('1x1')).toThrow(/only the digits 0 and 1/);

    expect(investigation.record).toEqual([]);
    expect(investigation.progress.queryCount).toBe(0);
    expect(oracle.queryCount).toBe(0);
    expect(evaluations()).toBe(0);
  });

  it('is refused every time: a refusal is never remembered as an answer', () => {
    const { investigation } = watchedMachine();
    expect(() => investigation.ask('10')).toThrow(RangeError);
    expect(() => investigation.ask('10')).toThrow(RangeError);
    expect(investigation.find('10')).toBeUndefined();
  });
});

describe('Investigation: the hidden function stays fixed', () => {
  it('means an input asked first and looked up last has the same answer, whatever was asked in between', () => {
    const investigation = prototypeInvestigation();
    const first = investigation.ask('010110').query.output;

    for (const input of everyInput(6)) {
      investigation.ask(input);
    }
    expect(investigation.ask('010110').query.output).toBe(first);
    expect(createPrototypeOracle().query('010110').output).toBe(first); // and a machine asked fresh agrees
  });

  it('is the same machine in every investigation of a session', () => {
    expect(fingerprint(prototypeInvestigation())).toBe(fingerprint(prototypeInvestigation()));
  });

  it('gives a complete record that is exactly the machine’s whole behaviour', () => {
    expect(fingerprint(prototypeInvestigation())).toBe(PROTOTYPE_BEHAVIOUR);
  });

  it('does not depend on the order the inputs are asked in', () => {
    const forwards = prototypeInvestigation();
    const backwards = prototypeInvestigation();
    for (const input of everyInput(6)) {
      forwards.ask(input);
    }
    for (const input of everyInput(6).reverse()) {
      backwards.ask(input);
    }

    for (const input of everyInput(6)) {
      expect(backwards.find(input)?.output).toBe(forwards.find(input)?.output);
    }
  });
});

describe('Investigation: the record', () => {
  it('is the machine’s own record, not a second copy that could disagree with it', () => {
    const { oracle, investigation } = watchedMachine();
    investigation.ask('101');
    investigation.ask('000');
    investigation.ask('101');

    expect(investigation.record).toEqual(oracle.history);
  });

  it('cannot be altered from outside', () => {
    const { investigation } = watchedMachine();
    const { query } = investigation.ask('101');

    (investigation.record as unknown[]).length = 0; // tampering with the returned copy
    expect(investigation.record).toHaveLength(1);

    expect(() => {
      (query as { output: number }).output = 0;
    }).toThrow(TypeError);
    expect(investigation.find('101')?.output).toBe(1);
  });

  it('takes over a machine that has already been asked things', () => {
    const { oracle, evaluations } = watchedMachine();
    const earlier = oracle.query('101');
    const investigation = new Investigation(oracle);

    expect(investigation.progress.queryCount).toBe(1);
    expect(investigation.ask('101')).toEqual({ kind: 'recalled', query: earlier });
    expect(evaluations()).toBe(1);
  });

  it('never repeats an input, even one the machine was asked directly', () => {
    const { oracle, investigation, evaluations } = watchedMachine();
    oracle.query('110'); // asked behind the investigation's back

    expect(investigation.ask('110').kind).toBe('recalled');
    expect(evaluations()).toBe(1);
  });

  it('counts an input as tested once, however often the machine itself was asked it', () => {
    const { oracle, investigation } = watchedMachine();
    oracle.query('110'); // the machine, asked directly, does answer a repeat — and counts it as a query
    oracle.query('110');

    expect(investigation.progress).toEqual({ queryCount: 2, testedCount: 1, untestedCount: 7, inputSpaceSize: 8 });
    expect(investigation.find('110')?.number).toBe(1); // and the entry on record is the first
  });

  it('keeps separate investigations separate', () => {
    const first = prototypeInvestigation();
    const second = prototypeInvestigation();
    first.ask('010110');

    expect(first.progress.queryCount).toBe(1);
    expect(second.progress.queryCount).toBe(0);
    expect(second.find('010110')).toBeUndefined();
  });
});

describe('Investigation: the hidden function stays hidden', () => {
  it('exposes nothing but the length of an input and the size of the input space', () => {
    const investigation = prototypeInvestigation();
    expect(Object.keys(investigation)).toEqual(['inputLength', 'inputSpaceSize']);
    expect(JSON.stringify(investigation)).toBe('{"inputLength":6,"inputSpaceSize":64}');
  });

  it('offers no property or method that describes the function', () => {
    const members = Object.getOwnPropertyNames(Investigation.prototype).sort();
    expect(members).toEqual(['ask', 'constructor', 'find', 'progress', 'record']);
  });

  it('reports the same progress whatever the machine does: only what was asked counts', () => {
    const always0 = new Investigation(new GameOracle(createConstantFunction(3, 0)));
    const always1 = new Investigation(new GameOracle(createConstantFunction(3, 1)));
    for (const input of ['000', '011', '011', '110']) {
      always0.ask(input);
      always1.ask(input);
    }
    expect(always0.progress).toEqual(always1.progress);
  });
});

describe('the laboratory investigates through the record', () => {
  const scene = sourceOf('/scenes/LaboratoryScene.ts');

  it('gives each new experiment an investigation of the prototype machine', () => {
    expect(scene).toMatch(/this\.investigation = new Investigation\(createPrototypeOracle\(\)\)/);
  });

  it('keeps the same investigation when the player comes back from THE BOX', () => {
    // A new investigation is made only when the laboratory is NOT being resumed.
    expect(scene).toMatch(/if \(!resuming\) \{\s*this\.investigation = new Investigation\(/);
    expect(scene.match(/new Investigation\(/g)).toHaveLength(1);
  });

  it('never asks the machine directly, so a repeated input cannot slip past the record', () => {
    expect(scene).toMatch(/this\.investigation\.ask\(/);
    expect(scene).not.toMatch(/\.query\(/);
    // It may name the type of a recorded query, but it holds no machine of its own to ask.
    expect(scene).not.toMatch(/\{[^}]*\bGameOracle\b[^}]*\} from/);
    expect(scene).not.toMatch(/private oracle\b/);
  });

  it('answers a repeated input from the record, without setting the machine to work', () => {
    const repeatBranch = /if \(outcome\.kind === 'recalled'\) \{([\s\S]*?)\n {4}\}/.exec(scene)?.[1];

    expect(repeatBranch).toBeDefined();
    expect(repeatBranch).toMatch(/this\.view\.showRecalled\(outcome\.query\)/);
    expect(repeatBranch).toMatch(/return;/);
    expect(repeatBranch).not.toMatch(/startProcessing|setProcessing|afterDelay|isProcessing = true|showAnswer|recordQuery/);
  });

  it('lets the next input be typed straight away after a repeat, just as after an answer', () => {
    // Typing fills the bits from the cursor, which sits past the last bit once all six are typed.
    // Unless it is sent back to the start, the digits of the next input would go nowhere.
    const repeatBranch = /if \(outcome\.kind === 'recalled'\) \{([\s\S]*?)\n {4}\}/.exec(scene)?.[1];
    const answer = /private answer\(query: OracleQuery\): void \{([\s\S]*?)\n {2}\}/.exec(scene)?.[1];

    // Before the repeat is pointed out, not after: redrawing the input would wipe the notice again.
    expect(repeatBranch).toMatch(/this\.restartTyping\(\);\s*this\.view\.showRecalled\(/);
    expect(answer).toMatch(/this\.restartTyping\(\);/);
    expect(scene).toMatch(/private restartTyping\(\): void \{[\s\S]*?setCursor\(this\.binaryInput, 0\)[\s\S]*?this\.drawInput\(\);/);
  });

  it('only sets the machine to work after the record has been consulted', () => {
    const consulted = scene.indexOf('this.investigation.ask(');
    const working = scene.indexOf('this.machine.startProcessing()');

    expect(consulted).toBeGreaterThan(-1);
    expect(working).toBeGreaterThan(consulted);
  });
});

describe('THE BOX leaves the investigation alone', () => {
  it('has the same record and the same progress after any number of observations', () => {
    const investigation = prototypeInvestigation();
    investigation.ask('010110');
    investigation.ask('000001');
    const record = JSON.stringify(investigation.record);
    const progress = investigation.progress;

    const experiment = new BoxExperiment();
    for (let replay = 0; replay < 25; replay += 1) {
      experiment.beginObservation();
      experiment.measure();
      experiment.reset();
    }

    expect(JSON.stringify(investigation.record)).toBe(record);
    expect(investigation.progress).toEqual(progress);
    expect(investigation.ask('010110').kind).toBe('recalled');
  });
});
