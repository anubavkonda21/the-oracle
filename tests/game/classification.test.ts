import { describe, expect, it } from 'vitest';
import { PROMISE_COPY, PROMISE_REVEAL_QUERY, PROMISE_TIMING } from '../../src/game/config/promiseConfig';
import { Classification, promiseIsRevealed } from '../../src/game/systems/oracle/Classification';
import { GameOracle } from '../../src/game/systems/oracle/GameOracle';
import { Investigation, type InvestigationProgress } from '../../src/game/systems/oracle/Investigation';
import { classifyEvidence, type Evidence } from '../../src/game/systems/oracle/evidence';
import { inputAt, inputSpaceSize } from '../../src/game/systems/oracle/inputSpace';
import { investigationNote } from '../../src/game/systems/oracle/investigationNotes';
import { ORACLE_KINDS, type OracleKind } from '../../src/game/systems/oracle/oracleKind';
import { createPromisedOracle } from '../../src/game/systems/oracle/promise';
import { createPrototypeOracle } from '../../src/game/systems/oracle/prototypeOracle';
import {
  createBooleanFunction,
  createConstantFunction,
  createFunctionFromTruthTable,
  createRandomBalancedFunction,
  type Bit,
  type BooleanFunction,
} from '../../src/quantum';
import { createSeededRandom } from '../../src/utils/random';
import oracleCss from '../../src/styles/oracle.css?raw';

/** Source text of the game's files, for checking how the laboratory uses all this. */
const gameSources = import.meta.glob<string>('../../src/game/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const withoutComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const sourceOf = (fileName: string): string => {
  const entry = Object.entries(gameSources).find(([path]) => path.endsWith(fileName));
  if (!entry) {
    throw new Error(`No game source file named ${fileName}.`);
  }
  return withoutComments(entry[1]);
};

const filesMatching = (pattern: RegExp): string[] =>
  Object.entries(gameSources)
    .filter(([, source]) => pattern.test(withoutComments(source)))
    .map(([path]) => path.replace(/^.*\/src\/game\//, ''))
    .sort();

/** The progress of an investigation of the six-bit machine that has asked about this many different inputs. */
const progressAt = (queryCount: number): InvestigationProgress => ({
  queryCount,
  testedCount: queryCount,
  untestedCount: 64 - queryCount,
  inputSpaceSize: 64,
});

/** An investigation of a machine with the given hidden function, and the classification task that goes with it. */
function investigating(hiddenFunction: BooleanFunction): { investigation: Investigation; classification: Classification } {
  const investigation = new Investigation(createPromisedOracle(hiddenFunction));
  return { investigation, classification: new Classification(investigation) };
}

const prototypeTask = (): { investigation: Investigation; classification: Classification } => {
  const investigation = new Investigation(createPrototypeOracle());
  return { investigation, classification: new Classification(investigation) };
};

/** How many queries it takes, asking the inputs in the given order, before the record settles the machine's kind. */
function queriesToSettle(hiddenFunction: BooleanFunction, order: readonly number[]): { queries: number; verdict: string } {
  const { investigation, classification } = investigating(hiddenFunction);

  for (const [index, input] of order.entries()) {
    investigation.ask(inputAt(input, investigation.inputLength));
    const verdict = classifyEvidence(classification.evidence);
    if (verdict !== 'undetermined') {
      return { queries: index + 1, verdict };
    }
  }
  return { queries: order.length, verdict: 'undetermined' };
}

const inOrder = (count: number): number[] => Array.from({ length: count }, (_, index) => index);

function shuffled(count: number, random: () => number): number[] {
  return inOrder(count)
    .map((input) => ({ input, key: random() }))
    .sort((first, second) => first.key - second.key)
    .map(({ input }) => input);
}

describe('the constraint: when the laboratory discloses it', () => {
  it('is not disclosed while the player is still meeting the machine', () => {
    for (let queries = 0; queries < PROMISE_REVEAL_QUERY; queries += 1) {
      expect(promiseIsRevealed(progressAt(queries))).toBe(false);
    }
  });

  it('is disclosed at the eighth query, and stays disclosed', () => {
    expect(PROMISE_REVEAL_QUERY).toBe(8);
    for (let queries = PROMISE_REVEAL_QUERY; queries <= 64; queries += 1) {
      expect(promiseIsRevealed(progressAt(queries))).toBe(true);
    }
  });

  it('arrives with the remark that the machine is still unknown: the one thing that is known', () => {
    expect(investigationNote(progressAt(PROMISE_REVEAL_QUERY))?.text).toBe(
      '8 answers on record. What the machine does is still unknown.',
    );
    expect(investigationNote(progressAt(PROMISE_REVEAL_QUERY - 1))?.text).not.toMatch(/still unknown/);
  });

  it('comes before the laboratory speaks of certainty, which only means something once the two kinds are known', () => {
    const firstMention = Array.from({ length: 64 }, (_, index) => index + 1).find((queries) =>
      /certainty/.test(investigationNote(progressAt(queries))?.text ?? ''),
    );

    expect(firstMention).toBe(11);
    expect(PROMISE_REVEAL_QUERY).toBeLessThan(firstMention ?? 0);
  });

  it('depends on the number of queries alone, not on what the answers were', () => {
    const allZero = investigating(createConstantFunction(6, 0)).investigation;
    const mixed = prototypeTask().investigation;
    for (let index = 0; index < PROMISE_REVEAL_QUERY; index += 1) {
      allZero.ask(inputAt(index, 6));
      mixed.ask(inputAt(index, 6));
    }

    expect(promiseIsRevealed(allZero.progress)).toBe(true);
    expect(promiseIsRevealed(mixed.progress)).toBe(true);
  });

  it('is not brought forward by repeating an input: a repeat is not a query', () => {
    const { investigation } = prototypeTask();
    for (let repeat = 0; repeat < 20; repeat += 1) {
      investigation.ask('000000');
    }
    expect(promiseIsRevealed(investigation.progress)).toBe(false);
  });

  it('gives the objective its new wording only once the two kinds have been named', () => {
    const delayOf = (selector: string): number => {
      const rule = new RegExp(`${selector.replace(/[.[\]]/g, '\\$&')}\\s*\\{[^}]*animation-delay:\\s*(\\d+)ms`).exec(oracleCss);
      if (!rule) {
        throw new Error(`oracle.css has no animation-delay for ${selector}.`);
      }
      return Number(rule[1]);
    };
    const arrivalMs = Number(/--constraint-arrival:\s*(\d+)ms/.exec(oracleCss)?.[1]);
    const statement = delayOf('.constraint[data-arrived] .constraint__statement');
    const behaviour = delayOf('.constraint[data-arrived] .constraint__behaviour');
    const name = delayOf('.constraint[data-arrived] .constraint__name');

    // The statement, then what each kind of machine does, and only then what the kinds are called.
    expect(statement).toBeLessThan(behaviour);
    expect(behaviour + arrivalMs).toBeLessThanOrEqual(name);
    expect(name + arrivalMs).toBeLessThanOrEqual(PROMISE_TIMING.objectiveDelayMs);
    expect(PROMISE_TIMING.reducedMotionObjectiveDelayMs).toBeLessThan(PROMISE_TIMING.objectiveDelayMs);
  });
});

describe('Classification: the conclusion on record', () => {
  it('starts with none', () => {
    const { classification } = prototypeTask();

    expect(classification.conclusion).toBeNull();
    expect(classification.standing).toBeNull();
  });

  it('records the conclusion the player comes to', () => {
    const { classification } = prototypeTask();
    classification.conclude('balanced');

    expect(classification.conclusion).toBe('balanced');
  });

  it('lets a conclusion be changed', () => {
    const { classification } = prototypeTask();
    classification.conclude('constant');
    classification.conclude('balanced');

    expect(classification.conclusion).toBe('balanced');
  });

  it('withdraws a conclusion that is concluded a second time', () => {
    const { classification } = prototypeTask();
    classification.conclude('constant');
    classification.conclude('constant');

    expect(classification.conclusion).toBeNull();
    expect(classification.standing).toBeNull();
  });

  it('accepts only one of the two kinds', () => {
    const { classification } = prototypeTask();

    for (const invalid of ['neither', 'undetermined', '', 'CONSTANT', null, undefined]) {
      expect(() => classification.conclude(invalid as OracleKind)).toThrow(TypeError);
    }
    expect(classification.conclusion).toBeNull();
  });

  it('uses no query, and leaves the record exactly as it was', () => {
    let evaluations = 0;
    const oracle = new GameOracle(
      createBooleanFunction(3, () => {
        evaluations += 1;
        return 0;
      }),
    );
    const investigation = new Investigation(oracle);
    const classification = new Classification(investigation);
    investigation.ask('000');
    investigation.ask('011');
    const record = JSON.stringify(investigation.record);

    classification.conclude('constant');
    void classification.standing;
    void classification.evidence;
    classification.conclude('balanced');
    void classification.standing;

    expect(evaluations).toBe(2);
    expect(oracle.queryCount).toBe(2);
    expect(JSON.stringify(investigation.record)).toBe(record);
  });

  it('belongs to one investigation: a new one starts with no conclusion', () => {
    const first = prototypeTask();
    first.classification.conclude('balanced');

    expect(prototypeTask().classification.conclusion).toBeNull();
  });

  it('holds nothing but the conclusion: the machine and its function are out of reach', () => {
    const { classification } = prototypeTask();

    expect(Object.keys(classification)).toEqual([]);
    expect(JSON.stringify(classification)).toBe('{}');
    expect(Object.getOwnPropertyNames(Classification.prototype).sort()).toEqual([
      'conclude',
      'conclusion',
      'constructor',
      'evidence',
      'standing',
    ]);
  });
});

describe('Classification: the evidence is the record, counted', () => {
  it('is empty before anything is asked', () => {
    expect(prototypeTask().classification.evidence).toEqual({ inputSpaceSize: 64, zeros: 0, ones: 0 });
  });

  it('follows the record as the investigation goes on', () => {
    const { investigation, classification } = prototypeTask();
    investigation.ask('000000'); // 0
    investigation.ask('111111'); // 0
    expect(classification.evidence).toEqual({ inputSpaceSize: 64, zeros: 2, ones: 0 });

    investigation.ask('100000'); // 1
    expect(classification.evidence).toEqual({ inputSpaceSize: 64, zeros: 2, ones: 1 });
  });

  it('gains nothing from an input that is repeated: there is nothing new on record', () => {
    const { investigation, classification } = prototypeTask();
    investigation.ask('000000');
    const before = classification.evidence;

    investigation.ask('000000');
    investigation.ask('000000');
    expect(classification.evidence).toEqual(before);
  });

  it('agrees with the count of tested inputs', () => {
    const { investigation, classification } = prototypeTask();
    for (let index = 0; index < 20; index += 1) {
      investigation.ask(inputAt(index * 3, 6));
      const { zeros, ones } = classification.evidence;

      expect(zeros + ones).toBe(investigation.progress.testedCount);
    }
  });
});

describe('Classification: how the conclusion stands follows the evidence', () => {
  it('is not established by a single answer, whichever kind is concluded', () => {
    const { investigation, classification } = prototypeTask();
    investigation.ask('000000');

    classification.conclude('constant');
    expect(classification.standing).toBe('not-established');
    classification.conclude('balanced');
    expect(classification.standing).toBe('not-established');
  });

  it('is not established by the inputs people try first, though all six answer the same', () => {
    const { investigation, classification } = prototypeTask();
    for (const input of ['000000', '111111', '101010', '010101', '111000', '000111']) {
      investigation.ask(input);
    }

    expect(classification.evidence).toEqual({ inputSpaceSize: 64, zeros: 6, ones: 0 });
    classification.conclude('constant');
    expect(classification.standing).toBe('not-established'); // six identical answers prove nothing
  });

  it('turns against a conclusion of constant the moment a different output is observed', () => {
    const { investigation, classification } = prototypeTask();
    for (const input of ['000000', '111111', '101010']) {
      investigation.ask(input);
    }
    classification.conclude('constant');
    expect(classification.standing).toBe('not-established');

    investigation.ask('100000'); // answers 1
    expect(classification.standing).toBe('contradicted'); // nothing was pressed: the evidence changed
  });

  it('establishes balanced once both outputs are on record', () => {
    const { investigation, classification } = prototypeTask();
    classification.conclude('balanced');
    investigation.ask('000000');
    expect(classification.standing).toBe('not-established');

    investigation.ask('100000');
    expect(classification.standing).toBe('established');
  });

  it('judges the conclusion on record, not the one that happens to be true', () => {
    const { investigation, classification } = prototypeTask();
    investigation.ask('000000');
    investigation.ask('100000');

    classification.conclude('balanced');
    expect(classification.standing).toBe('established');
    classification.conclude('constant');
    expect(classification.standing).toBe('contradicted');
  });
});

describe('classifying one input at a time can take substantial evidence', () => {
  it('takes two queries at the very least: one answer settles nothing', () => {
    const { investigation, classification } = prototypeTask();
    investigation.ask('000000');
    expect(classifyEvidence(classification.evidence)).toBe('undetermined');

    investigation.ask('100000');
    expect(classifyEvidence(classification.evidence)).toBe('balanced');
  });

  it('takes 33 queries to establish that a constant machine is constant — and 32 are not enough', () => {
    for (const value of [0, 1] as const) {
      const { investigation, classification } = investigating(createConstantFunction(6, value));
      classification.conclude('constant');

      for (let index = 0; index < 32; index += 1) {
        investigation.ask(inputAt(index, 6));
        expect(classification.standing).toBe('not-established');
      }
      investigation.ask(inputAt(32, 6));
      expect(classification.standing).toBe('established');
      expect(investigation.progress.queryCount).toBe(33);
    }
  });

  it('takes 33 for a constant machine in any order of asking: no order is a shortcut', () => {
    const random = createSeededRandom(33);
    for (let trial = 0; trial < 25; trial += 1) {
      expect(queriesToSettle(createConstantFunction(6, 1), shuffled(64, random))).toEqual({ queries: 33, verdict: 'constant' });
    }
  });

  it('can take 33 for a balanced machine too, if its first 32 answers happen to agree', () => {
    // Balanced: the first 32 inputs answer 0 and the rest answer 1. Asked in order, it looks constant for 32 queries.
    const unlucky = createBooleanFunction(6, (input) => (input < 32 ? 0 : 1));

    expect(queriesToSettle(unlucky, inOrder(64))).toEqual({ queries: 33, verdict: 'balanced' });
  });

  it('never takes more than 33, whatever the machine and whatever the order', () => {
    const random = createSeededRandom(2026);
    const machines = [
      createConstantFunction(6, 0),
      createConstantFunction(6, 1),
      ...Array.from({ length: 40 }, () => createRandomBalancedFunction(6, random)),
    ];

    for (const machine of machines) {
      const { queries, verdict } = queriesToSettle(machine, shuffled(64, random));

      expect(queries).toBeGreaterThanOrEqual(2);
      expect(queries).toBeLessThanOrEqual(33);
      expect(verdict).not.toBe('undetermined');
    }
  });

  it('settles the laboratory’s own machine in two queries if they differ, and not before they do', () => {
    expect(queriesToSettle(createFunctionFromTruthTable(prototypeTable()), [0, 32])).toEqual({ queries: 2, verdict: 'balanced' });
    // The six inputs people try first all agree, so the seventh query is the first that can settle it.
    const natural = ['000000', '111111', '101010', '010101', '111000', '000111', '100000'].map((input) => Number.parseInt(input, 2));
    expect(queriesToSettle(createFunctionFromTruthTable(prototypeTable()), natural)).toEqual({ queries: 7, verdict: 'balanced' });
  });

  /** The prototype machine's answers, read off a machine by asking — the only way there is. */
  function prototypeTable(): Bit[] {
    const oracle = createPrototypeOracle();
    return Array.from({ length: inputSpaceSize(6) }, (_, index) => oracle.query(inputAt(index, 6)).output);
  }
});

describe('what the player reads about the promise', () => {
  const { rules, evidence: evidenceCopy, conclusion } = PROMISE_COPY;
  const counted = (zeros: number, ones: number): Evidence => ({ inputSpaceSize: 64, zeros, ones });

  it('says first that there are two rules, naming neither', () => {
    expect(PROMISE_COPY.heading).toBe('ORACLE CONSTRAINT');
    expect(PROMISE_COPY.statement).toBe('This machine is guaranteed to obey one of two rules.');
    expect(PROMISE_COPY.statement).not.toMatch(/constant|balanced/i);
  });

  it('describes each kind by what such a machine does, without using its name', () => {
    expect(rules.constant.behaviour).toBe('Every possible input produces the same output.');
    expect(rules.balanced.behaviour).toBe('Half of all possible inputs produce 0. Half produce 1.');
    for (const kind of ORACLE_KINDS) {
      expect(rules[kind].behaviour).not.toMatch(/constant|balanced/i);
    }
  });

  it('then names the two kinds', () => {
    expect(rules.constant.name).toBe('CONSTANT');
    expect(rules.balanced.name).toBe('BALANCED');
  });

  it('gives the split of the 64 inputs: 64 / 0 for one kind, 32 / 32 for the other', () => {
    expect(rules.constant.split(64)).toBe('64 / 0');
    expect(rules.balanced.split(64)).toBe('32 / 32');
    expect(rules.balanced.split(8)).toBe('4 / 4');
    expect(rules.constant.splitInWords(64)).toBe('All 64 inputs give one output.');
    expect(rules.balanced.splitInWords(64)).toBe('32 inputs give 0 and 32 give 1.');
  });

  it('sets the task of telling them apart', () => {
    expect(PROMISE_COPY.objective).toBe('Determine which kind of Oracle you are dealing with.');
    expect(PROMISE_COPY.objectiveAnnouncement(PROMISE_COPY.objective)).toBe(
      'New objective. Determine which kind of Oracle you are dealing with.',
    );
  });

  it('reads the constraint out in the same order: two rules, each one’s behaviour beside its name', () => {
    expect(PROMISE_COPY.announcement).toBe(
      'Oracle constraint. This machine is guaranteed to obey one of two rules. Constant: Every possible input produces the same output. Balanced: Half of all possible inputs produce 0. Half produce 1.',
    );
  });

  it('states which outputs have been observed, and draws no conclusion from them', () => {
    expect(evidenceCopy.label).toBe('OUTPUTS OBSERVED');
    expect(evidenceCopy.observed).toEqual({ none: 'NONE', zero: '0 ONLY', one: '1 ONLY', both: '0 AND 1' });
    for (const text of Object.values(evidenceCopy.observed)) {
      expect(text).not.toMatch(/constant|balanced|proves|therefore|must be/i);
    }
  });

  it('has a word for each way a conclusion can stand', () => {
    expect(conclusion.label).toBe('CONCLUSION');
    expect(conclusion.standing).toEqual({
      none: 'NONE',
      established: 'ESTABLISHED',
      'not-established': 'NOT ESTABLISHED',
      contradicted: 'CONTRADICTED',
    });
  });

  it.each([
    ['constant', 5, 0, '5 OF 64 AGREE · 33 NEEDED'],
    ['constant', 0, 32, '32 OF 64 AGREE · 33 NEEDED'],
    ['constant', 33, 0, '33 OF 64 AGREE'],
    ['constant', 7, 2, '0 AND 1 OBSERVED'],
    ['balanced', 7, 2, '0 AND 1 OBSERVED'],
    ['balanced', 5, 0, 'ONLY 0 OBSERVED'],
    ['balanced', 0, 9, 'ONLY 1 OBSERVED'],
    ['balanced', 33, 0, '33 OF 64 AGREE'],
    ['constant', 0, 0, 'NOTHING OBSERVED'],
    ['balanced', 0, 0, 'NOTHING OBSERVED'],
  ] as const)('gives the evidence that decides it: %s with %i zeros and %i ones → "%s"', (kind, zeros, ones, reason) => {
    expect(conclusion.reason(kind, counted(zeros, ones))).toBe(reason);
  });

  it('says the same in sentences, for a screen reader', () => {
    expect(conclusion.announcement('balanced', counted(7, 2))).toBe(
      'Conclusion: balanced. Established by the record. Both outputs have been observed.',
    );
    expect(conclusion.announcement('constant', counted(7, 2))).toBe(
      'Conclusion: constant. Contradicted by the record. Both outputs have been observed.',
    );
    expect(conclusion.announcement('constant', counted(5, 0))).toBe(
      'Conclusion: constant. Not established by the record. 5 of 64 inputs agree; 33 are needed.',
    );
    expect(conclusion.announcement('balanced', counted(5, 0))).toBe(
      'Conclusion: balanced. Not established by the record. Only 0 has been observed.',
    );
    expect(conclusion.announcement('constant', counted(0, 33))).toBe(
      'Conclusion: constant. Established by the record. 33 of 64 inputs agree.',
    );
    expect(conclusion.announcement('balanced', counted(0, 33))).toBe(
      'Conclusion: balanced. Contradicted by the record. 33 of 64 inputs agree.',
    );
    expect(conclusion.announcement(null, counted(7, 2))).toBe('Conclusion withdrawn.');
  });

  it('quotes the number of identical answers certainty needs: 33 of 64', () => {
    expect(conclusion.reason('constant', counted(12, 0))).toMatch(/33 NEEDED$/);
    expect(investigationNote(progressAt(11))?.text).toBe('One input at a time, certainty can take as many as 33 queries.');
  });

  it('prints its machine text in characters the machine typeface has', () => {
    const machineText = [
      PROMISE_COPY.heading,
      rules.constant.name,
      rules.balanced.name,
      rules.constant.split(64),
      rules.balanced.split(64),
      evidenceCopy.label,
      ...Object.values(evidenceCopy.observed),
      conclusion.label,
      ...Object.values(conclusion.standing),
      conclusion.reason('constant', counted(5, 0)),
      conclusion.reason('balanced', counted(5, 0)),
      conclusion.reason('balanced', counted(7, 2)),
      conclusion.reason('constant', counted(33, 0)),
    ];
    for (const text of machineText) {
      expect(text).toMatch(/^[ -~·]+$/);
      expect(text).toBe(text.toUpperCase());
    }
  });

  it('names nothing that belongs to a later part of the game', () => {
    const everything = [
      PROMISE_COPY.heading,
      PROMISE_COPY.statement,
      PROMISE_COPY.objective,
      PROMISE_COPY.announcement,
      ...ORACLE_KINDS.flatMap((kind) => [rules[kind].name, rules[kind].behaviour, rules[kind].splitInWords(64)]),
      ...ORACLE_KINDS.map((kind) => conclusion.announcement(kind, counted(7, 2))),
      ...ORACLE_KINDS.map((kind) => conclusion.announcement(kind, counted(5, 0))),
    ].join(' ');

    expect(everything).not.toMatch(/quantum|superposition|deutsch|jozsa|hadamard|phase|qubit|algorithm|circuit|interference/i);
    expect(everything).not.toMatch(/correct|wrong|well done|success|fail|score|solved/i);
  });

  it('never says which kind this machine is: what it says depends on the evidence alone', () => {
    // Every function that produces text about a conclusion is given the evidence, and nothing of the machine.
    expect(conclusion.reason.length).toBe(2);
    expect(conclusion.announcement.length).toBe(2);
    const source = sourceOf('/config/promiseConfig.ts');
    expect(source).not.toMatch(/prototypeOracle|GameOracle|Investigation|quantum/);
  });
});

describe('the laboratory and the promise', () => {
  const scene = sourceOf('/scenes/LaboratoryScene.ts');
  const view = sourceOf('/ui/views/laboratoryView.ts');

  it('gives each new investigation its own classification task, and keeps it across a visit to THE BOX', () => {
    expect(scene).toMatch(
      /if \(!resuming\) \{\s*this\.investigation = new Investigation\(createPrototypeOracle\(\)\);\s*this\.classification = new Classification\(this\.investigation\);/,
    );
    expect(scene.match(/new Classification\(/g)).toHaveLength(1);
  });

  it('discloses the constraint when the investigation has earned it, and not on a timer or a click', () => {
    expect(scene).toMatch(/promiseIsRevealed\(/);
    expect(scene).toMatch(/this\.view\.revealPromise\(/);
  });

  it('starts with the open question, and only later sets the task of telling the kinds apart', () => {
    expect(scene).toMatch(/'The Oracle accepts a binary input and returns a single bit\. The rule is unknown\.'/);
    expect(scene).toMatch(/PROMISE_COPY\.objective/);
  });

  it('keeps the constraint out of sight until it is disclosed', () => {
    // The plate, and the evidence and conclusion, are built hidden, and each is shown in one place only.
    expect(view).toMatch(/constraint\.element\.hidden = true;/);
    expect(view).toMatch(/classificationRecord\.element\.hidden = true;/);
    expect(view.match(/\.hidden = false;/g)).toHaveLength(2);
    expect(view).toMatch(/revealPromise\([^)]*\) \{\s*constraint\.element\.hidden = false;/);
    expect(view).toMatch(/setClassificationTask\([^)]*\) \{[\s\S]*?classificationRecord\.element\.hidden = false;/);
  });

  it('sets the task only after the constraint has finished arriving: the two kinds are named before the player is asked to choose', () => {
    // The controls that name the two kinds belong to the task, not to the constraint.
    const disclose = /private disclosePromise\(arrive: boolean\): void \{([\s\S]*?)\n {2}\}/.exec(scene)?.[1] ?? '';

    expect(disclose).toMatch(/this\.view\.revealPromise\(arrive\);/);
    expect(disclose).toMatch(/PROMISE_TIMING\.objectiveDelayMs/);
    expect(disclose).toMatch(/this\.afterDelay\(wait, \(\) => this\.view\.setClassificationTask\(PROMISE_COPY\.objective\)\);/);
    expect(disclose.indexOf('revealPromise')).toBeLessThan(disclose.indexOf('afterDelay'));
  });

  it('discloses it once, however many answers follow', () => {
    expect(scene).toMatch(/if \(promiseIsRevealed\(progress\) && !this\.promiseShown\) \{\s*this\.promiseShown = true;/);
    // A new visit to the laboratory draws everything again, the constraint included.
    expect(scene).toMatch(/this\.promiseShown = false;/);
  });

  it('shows a returning player the constraint and the task as they stand, without the ceremony', () => {
    const disclose = /private disclosePromise\(arrive: boolean\): void \{([\s\S]*?)\n {2}\}/.exec(scene)?.[1] ?? '';

    expect(disclose).toMatch(/if \(!arrive\) \{\s*this\.view\.setClassificationTask\(PROMISE_COPY\.objective, false\);\s*return;/);
  });

  it('never announces a verdict of its own: only how the player’s conclusion stands', () => {
    // The classifier is reached through the conclusion the player has recorded, and no other way.
    expect(filesMatching(/\bclassifyEvidence\b/)).toEqual(['systems/oracle/evidence.ts']);
    expect(filesMatching(/\bjudgeConclusion\b/)).toEqual([
      'config/promiseConfig.ts',
      'systems/oracle/Classification.ts',
      'systems/oracle/evidence.ts',
    ]);
  });

  it('cannot reach the check that knows the machine’s kind', () => {
    for (const source of [scene, view]) {
      expect(source).not.toMatch(/promisedKind|classifyByTruthTable|truthTable|from '[^']*\/promise'/);
    }
  });

  it('records a conclusion through the classification task, and redraws how it stands', () => {
    expect(scene).toMatch(/this\.classification\.conclude\(kind\)/);
    expect(scene).toMatch(/this\.classification\.standing/);
  });

  it('adds no new colour: the indigo is still held back', () => {
    expect(oracleCss).not.toMatch(/quantum-indigo/);
  });
});
