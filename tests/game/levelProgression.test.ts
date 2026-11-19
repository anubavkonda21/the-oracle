import { describe, expect, it } from 'vitest';
import {
  generateOracle,
  runQuantumProbe,
  GameStateMachine,
} from '../../src/game/systems/levelProgression';
import { ORACLE_KINDS } from '../../src/game/systems/oracle/oracleKind';
import { Investigation, bindInvestigationOracle } from '../../src/game/systems/oracle/Investigation';
import { createPrototypeOracle } from '../../src/game/systems/oracle/prototypeOracle';

describe('Level Progression & Oracle Generator (Specification 6)', () => {
  describe('generateOracle(bits, type)', () => {
    it.each([2, 4, 6])(
      'asserts CONSTANT produces 100% identical outputs across all 2^%i inputs',
      (bits) => {
        const constantOracle = generateOracle(bits, ORACLE_KINDS[0]);
        const size = 2 ** bits;
        const outputs: number[] = [];

        for (let i = 0; i < size; i++) {
          outputs.push(constantOracle.booleanFunction.evaluate(i));
        }

        const firstOutput = outputs[0];
        expect(outputs.every((out) => out === firstOutput)).toBe(true);
        expect(new Set(outputs).size).toBe(1);
      },
    );

    it.each([2, 4, 6])(
      'asserts BALANCED produces exactly 2^(bits-1) zeros and 2^(bits-1) ones for bits = %i',
      (bits) => {
        const balancedOracle = generateOracle(bits, ORACLE_KINDS[1]);
        const size = 2 ** bits;
        const halfSize = 2 ** (bits - 1);
        let zeros = 0;
        let ones = 0;

        for (let i = 0; i < size; i++) {
          const out = balancedOracle.booleanFunction.evaluate(i);
          if (out === 0) zeros++;
          if (out === 1) ones++;
        }

        expect(zeros).toBe(halfSize);
        expect(ones).toBe(halfSize);
        expect(zeros + ones).toBe(size);
      },
    );
  });

  describe('Game State Machine', () => {
    it('decrements query budget on classical query and locks ASK at 0 queries left', () => {
      const gsm = new GameStateMachine();
      gsm.startLevel(1); // 2-bit, query budget = 3
      expect(gsm.box.queriesLeft).toBe(3);
      expect(gsm.canAskClassical).toBe(true);

      gsm.queryClassical('00');
      expect(gsm.box.queriesLeft).toBe(2);
      expect(gsm.canAskClassical).toBe(true);

      gsm.queryClassical('01');
      expect(gsm.box.queriesLeft).toBe(1);
      expect(gsm.canAskClassical).toBe(true);

      gsm.queryClassical('10');
      expect(gsm.box.queriesLeft).toBe(0);
      expect(gsm.canAskClassical).toBe(false);

      expect(() => gsm.queryClassical('11')).toThrowError(/No classical queries left/);
    });

    it('advances levels on target streak completion', () => {
      const gsm = new GameStateMachine();
      gsm.startLevel(1); // Level 1: targetStreak = 2
      expect(gsm.levelNumber).toBe(1);
      expect(gsm.streak).toBe(0);

      // Guess 1 correct
      const firstGuess = gsm.box.oracle.type;
      const res1 = gsm.classify(firstGuess);
      expect(res1.correct).toBe(true);
      expect(res1.streak).toBe(1);
      expect(res1.levelCompleted).toBe(false);

      // Move to next box
      gsm.nextBox();

      // Guess 2 correct
      const secondGuess = gsm.box.oracle.type;
      const res2 = gsm.classify(secondGuess);
      expect(res2.correct).toBe(true);
      expect(res2.streak).toBe(2);
      expect(res2.levelCompleted).toBe(true);
      expect(res2.nextLevel).toBe(2);
    });

    it('triggers level reset on wrong classification (streak reset to 0)', () => {
      const gsm = new GameStateMachine();
      gsm.startLevel(2); // target streak = 2

      // First box correct
      gsm.classify(gsm.box.oracle.type);
      expect(gsm.streak).toBe(1);

      // Second box wrong guess
      gsm.nextBox();
      const wrongGuess = gsm.box.oracle.type === ORACLE_KINDS[0] ? ORACLE_KINDS[1] : ORACLE_KINDS[0];
      const outcome = gsm.classify(wrongGuess);

      expect(outcome.correct).toBe(false);
      expect(outcome.streak).toBe(0);
      expect(gsm.streak).toBe(0);
      expect(outcome.fullGridMap).toBeDefined();
      expect(outcome.fullGridMap?.length).toBe(16); // 4-bit space
    });

    it('queries an input on 2-bit, 4-bit, and 6-bit levels and asserts a valid 0 or 1 output is returned every time', () => {
      const gsm = new GameStateMachine();

      // Level 1: 2-bit
      gsm.startLevel(1);
      expect(gsm.config.bits).toBe(2);
      const res2 = gsm.queryClassical('01');
      expect([0, 1]).toContain(res2.query.output);
      expect(res2.query.input).toBe('01');

      // Level 2: 4-bit
      gsm.startLevel(2);
      expect(gsm.config.bits).toBe(4);
      const res4 = gsm.queryClassical('0101');
      expect([0, 1]).toContain(res4.query.output);
      expect(res4.query.input).toBe('0101');

      // Level 3: 6-bit
      gsm.startLevel(3);
      expect(gsm.config.bits).toBe(6);
      const res6 = gsm.queryClassical('010101');
      expect([0, 1]).toContain(res6.query.output);
      expect(res6.query.input).toBe('010101');
    });

    it('queries through bound Investigation on 2-bit, 4-bit, and 6-bit levels and returns valid 0 or 1 output', () => {
      const gsm = new GameStateMachine();
      const investigation = new Investigation(createPrototypeOracle());

      for (const level of [1, 2, 3]) {
        gsm.startLevel(level);
        const bits = gsm.config.bits;
        bindInvestigationOracle(investigation, gsm.box.gameOracle);

        const input = '1'.padStart(bits, '0');
        const outcome = investigation.ask(input);
        expect(outcome.kind).toBe('asked');
        expect([0, 1]).toContain(outcome.query.output);
        expect(outcome.query.input).toBe(input);
        expect(outcome.query.input.length).toBe(bits);
        expect(investigation.progress.inputSpaceSize).toBe(2 ** bits);
      }
    });
  });

  describe('Quantum Probe Output (Specification 6)', () => {
    it('asserts 000000 detector is true for all CONSTANT oracles', () => {
      for (let i = 0; i < 5; i++) {
        const constantOracle = generateOracle(6, ORACLE_KINDS[0]);
        const probe = runQuantumProbe(constantOracle.booleanFunction);

        expect(probe.isZeroDetectorLit).toBe(true);
        expect(probe.measuredInput).toBe(0);
        expect(probe.measuredLabel).toBe('000000');
        expect(probe.detectorStatus).toBe('000000 DETECTOR: LIT');
      }
    });

    it('asserts 000000 detector is false (non-zero scatter) for all BALANCED oracles', () => {
      for (let i = 0; i < 5; i++) {
        const balancedOracle = generateOracle(6, ORACLE_KINDS[1]);
        const probe = runQuantumProbe(balancedOracle.booleanFunction);

        expect(probe.isZeroDetectorLit).toBe(false);
        expect(probe.measuredInput).not.toBe(0);
        expect(probe.measuredLabel).not.toBe('000000');
        expect(probe.detectorStatus).toContain('000000 DETECTOR: CANCELLED (SCATTER:');
        expect(probe.detectorStatus).toContain(probe.measuredLabel);
      }
    });
  });
});
