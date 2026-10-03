import { describe, expect, it } from 'vitest';
import { INVESTIGATION_COPY, INVESTIGATION_NOTES } from '../../src/game/config/investigationConfig';
import { ORACLE_INPUT_LENGTH } from '../../src/game/config/oracleConfig';
import type { InvestigationProgress } from '../../src/game/systems/oracle/Investigation';
import { inputSpaceSize } from '../../src/game/systems/oracle/inputSpace';
import { investigationNote } from '../../src/game/systems/oracle/investigationNotes';

/** The progress of an investigation that has asked about this many different inputs. */
function progressAt(queryCount: number, inputLength = ORACLE_INPUT_LENGTH): InvestigationProgress {
  const size = inputSpaceSize(inputLength);
  return { queryCount, testedCount: queryCount, untestedCount: size - queryCount, inputSpaceSize: size };
}

const textAt = (queryCount: number, inputLength?: number): string =>
  investigationNote(progressAt(queryCount, inputLength))?.text ?? '';

const stageAt = (queryCount: number, inputLength?: number): number =>
  investigationNote(progressAt(queryCount, inputLength))?.stage ?? -1;

/** Every query count the six-bit machine allows, from the first query to a complete record. */
const SIX_BIT_QUERIES = Array.from({ length: 64 }, (_, index) => index + 1);

/** Nothing the laboratory says may give away the rule, name what comes later, or declare the job done. */
const GIVES_SOMETHING_AWAY =
  /constant|balanced|quantum|superposition|classical|algorithm|circuit|parity|pattern|\brule\b|solved|correct|well done|congratulations|complete the|you (have )?(won|finished)/i;

describe('what the laboratory remarks: when', () => {
  it('says nothing before the first query: the player acts first', () => {
    expect(investigationNote(progressAt(0))).toBeNull();
  });

  it('has something to say from the first query on', () => {
    for (const queries of SIX_BIT_QUERIES) {
      expect(textAt(queries).length).toBeGreaterThan(0);
    }
  });

  it('moves on at 1, 3, 5, 8, 11, 14, 32 and 64 queries for the six-bit machine', () => {
    const firstQueryOfEachStage = INVESTIGATION_NOTES.map((_, stage) =>
      SIX_BIT_QUERIES.find((queries) => stageAt(queries) === stage),
    );
    expect(firstQueryOfEachStage).toEqual([1, 3, 5, 8, 11, 14, 32, 64]);
  });

  it('lists its remarks in the order they arrive', () => {
    const thresholds = INVESTIGATION_NOTES.map((rule) => rule.fromQuery(64));
    expect(thresholds).toEqual([...thresholds].sort((first, second) => first - second));
    expect(new Set(thresholds).size).toBe(thresholds.length);
  });

  it('never goes back to an earlier remark', () => {
    for (const queries of SIX_BIT_QUERIES) {
      expect(stageAt(queries)).toBeGreaterThanOrEqual(stageAt(queries - 1));
    }
  });

  it('does not change remark with every query: most queries leave it where it is', () => {
    const changes = SIX_BIT_QUERIES.filter((queries) => stageAt(queries) !== stageAt(queries - 1));
    expect(changes).toHaveLength(INVESTIGATION_NOTES.length);
  });
});

describe('what the laboratory remarks: the train of thought', () => {
  it('first acknowledges that the machine answered, and how small one answer is', () => {
    expect(textAt(1)).toBe('The machine answered. That is one input out of 64.');
  });

  it('then that an answer says nothing about any other input', () => {
    expect(textAt(3)).toBe('Each answer describes a single input, and no other.');
  });

  it('then how many inputs there are', () => {
    expect(textAt(5)).toBe('59 of the 64 possible inputs are untested.');
  });

  it('then that the machine is still not understood', () => {
    expect(textAt(8)).toBe('8 answers on record. What the machine does is still unknown.');
  });

  it('then what finishing this way would cost', () => {
    expect(textAt(11)).toBe('One input at a time, a complete record would take 64 queries.');
  });

  it('and finally wonders whether there is a better way to ask — without saying that there is', () => {
    expect(textAt(14)).toBe('There may be a better way to ask.');
  });

  it('arrives at that question within about a dozen queries, not after an hour of them', () => {
    const firstMention = SIX_BIT_QUERIES.find((queries) => /better way to ask/.test(textAt(queries)));

    expect(firstMention).toBeGreaterThanOrEqual(10); // not before the size of the task has been felt
    expect(firstMention).toBeLessThanOrEqual(16);
  });

  it('keeps asking it for as long as the record is incomplete', () => {
    for (let queries = 14; queries < 64; queries += 1) {
      expect(textAt(queries)).toMatch(/There may be a better way to ask\.$/);
    }
  });

  it('marks the halfway point, with half the inputs still unknown', () => {
    expect(textAt(32)).toBe('32 queries, and 32 inputs are still unknown. There may be a better way to ask.');
    expect(textAt(40)).toBe('40 queries, and 24 inputs are still unknown. There may be a better way to ask.');
  });

  it('says what a complete record cost', () => {
    expect(textAt(64)).toBe('Every input is on record. It took 64 queries: one for each.');
  });
});

describe('what the laboratory remarks: it is true while it is shown', () => {
  it('quotes the real numbers, which keep up with the record', () => {
    expect(textAt(6)).toBe('58 of the 64 possible inputs are untested.');
    expect(textAt(7)).toBe('57 of the 64 possible inputs are untested.');
    expect(textAt(10)).toBe('10 answers on record. What the machine does is still unknown.');
    expect(textAt(63)).toBe('63 queries, and 1 input is still unknown. There may be a better way to ask.');
  });

  it('quotes no number that is not the queries used, the inputs untested or the inputs there are', () => {
    for (const queries of SIX_BIT_QUERIES) {
      const { untestedCount, inputSpaceSize: size } = progressAt(queries);
      const quoted = (textAt(queries).match(/\d+/g) ?? []).map(Number);

      for (const number of quoted) {
        expect([queries, untestedCount, size]).toContain(number);
      }
    }
  });

  it('calls the record complete only when it is', () => {
    for (const queries of SIX_BIT_QUERIES) {
      expect(/every input is on record/i.test(textAt(queries))).toBe(queries === 64);
    }
  });

  it('calls anything unknown or untested only while something is', () => {
    expect(textAt(64)).not.toMatch(/unknown|untested/i);
  });

  it('is the same for the same progress: nothing about it is random', () => {
    for (const queries of SIX_BIT_QUERIES) {
      expect(investigationNote(progressAt(queries))).toEqual(investigationNote(progressAt(queries)));
    }
  });
});

describe('what the laboratory remarks: how it is said', () => {
  it('is short enough to read at a glance', () => {
    for (const queries of SIX_BIT_QUERIES) {
      const text = textAt(queries);
      expect(text.split(/\s+/).length).toBeLessThanOrEqual(18);
      expect(text.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(2);
    }
  });

  it('is written in plain sentences', () => {
    for (const queries of SIX_BIT_QUERIES) {
      expect(textAt(queries)).toMatch(/^[A-Z0-9].*\.$/);
    }
  });

  it('never gives away the rule, names what comes later, or declares the job done', () => {
    for (const queries of SIX_BIT_QUERIES) {
      expect(textAt(queries)).not.toMatch(GIVES_SOMETHING_AWAY);
    }
  });

  it('wonders about a better way; it does not announce one', () => {
    const wondering = SIX_BIT_QUERIES.map((queries) => textAt(queries)).filter((text) => /better way/.test(text));

    expect(wondering.length).toBeGreaterThan(0);
    for (const text of wondering) {
      expect(text).toMatch(/There may be a better way to ask\./);
      expect(text).not.toMatch(/there is a better way|you can|try |instead/i);
    }
  });
});

describe('what the laboratory remarks: machines of other sizes', () => {
  it.each([1, 2, 3, 4, 5, 7, 8])('stays in order, and true, for a %i-bit machine', (inputLength) => {
    const size = inputSpaceSize(inputLength);
    expect(investigationNote(progressAt(0, inputLength))).toBeNull();

    for (let queries = 1; queries <= size; queries += 1) {
      const text = textAt(queries, inputLength);

      expect(text.length).toBeGreaterThan(0);
      expect(stageAt(queries, inputLength)).toBeGreaterThanOrEqual(stageAt(queries - 1, inputLength));
      expect(/every input is on record/i.test(text)).toBe(queries === size);
      expect(text).not.toMatch(GIVES_SOMETHING_AWAY);
    }
  });

  it('reads correctly when there is one of something', () => {
    expect(textAt(1, 1)).toBe('1 query, and 1 input is still unknown. There may be a better way to ask.');
    expect(textAt(7, 3)).toBe('7 queries, and 1 input is still unknown. There may be a better way to ask.');
  });

  it('quotes the size of that machine’s input space, not the prototype’s', () => {
    expect(textAt(1, 4)).toBe('The machine answered. That is one input out of 16.');
    expect(textAt(16, 4)).toBe('Every input is on record. It took 16 queries: one for each.');
  });
});

describe('what the laboratory prints about the record', () => {
  const query = { number: 3, input: '010110', output: 1 } as const;

  it('describes the input space in bits and in possible inputs', () => {
    expect(INVESTIGATION_COPY.inputSpace.bits(6)).toBe('6 BITS');
    expect(INVESTIGATION_COPY.inputSpace.bits(1)).toBe('1 BIT');
    expect(INVESTIGATION_COPY.inputSpace.possibleInputs(64)).toBe('64 POSSIBLE INPUTS');
  });

  it('describes the picture of the input space in words', () => {
    expect(INVESTIGATION_COPY.inputSpace.description(progressAt(7))).toBe('7 of 64 possible inputs tested.');
    expect(INVESTIGATION_COPY.inputSpace.description(progressAt(0))).toBe('0 of 64 possible inputs tested.');
  });

  it('says whether the input as it stands has been tested, and if so which query it was and what came out', () => {
    expect(INVESTIGATION_COPY.record.untested).toBe('UNTESTED');
    expect(INVESTIGATION_COPY.record.tested(query)).toBe('TESTED · QUERY_003 · OUTPUT 1');
    expect(INVESTIGATION_COPY.record.tested({ number: 12, input: '000000', output: 0 })).toBe(
      'TESTED · QUERY_012 · OUTPUT 0',
    );
  });

  it('says that a repeated input used no query', () => {
    expect(INVESTIGATION_COPY.record.noQueryUsed).toBe('NO QUERY USED');
    expect(INVESTIGATION_COPY.record.recalledAnnouncement(query)).toBe(
      'This input is already on record. Query 3 gave output 1. No query was used.',
    );
  });

  it('uses only characters the machine typeface has, so nothing falls back to another font', () => {
    // The self-hosted JetBrains Mono is a Latin subset: it has the middle dot, but no arrows or box-drawing.
    const machineText = [
      INVESTIGATION_COPY.inputSpace.heading,
      INVESTIGATION_COPY.inputSpace.bits(6),
      INVESTIGATION_COPY.inputSpace.possibleInputs(64),
      INVESTIGATION_COPY.inputSpace.tested,
      INVESTIGATION_COPY.inputSpace.untested,
      INVESTIGATION_COPY.record.untested,
      INVESTIGATION_COPY.record.tested(query),
      INVESTIGATION_COPY.record.noQueryUsed,
    ];
    for (const text of machineText) {
      expect(text).toMatch(/^[ -~·]+$/);
      expect(text).toBe(text.toUpperCase());
    }
  });
});
