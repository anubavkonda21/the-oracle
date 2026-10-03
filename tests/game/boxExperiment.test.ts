import { describe, expect, it } from 'vitest';
import { BoxExperiment } from '../../src/game/systems/box/BoxExperiment';
import { GameOracle } from '../../src/game/systems/oracle/GameOracle';
import { Gates, QuantumState, createParityFunction } from '../../src/quantum';
import { createSeededRandom } from '../../src/utils/random';

/** Source text of the game's files, for checking where the outcome comes from. */
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

const INVERSE_SQRT_2 = Math.SQRT1_2;
const PRECISION = 10;

/** Runs one complete observation and returns the experiment afterwards. */
function observeOnce(experiment = new BoxExperiment()): BoxExperiment {
  experiment.beginObservation();
  experiment.measure();
  return experiment;
}

describe('THE BOX: entering', () => {
  it('starts sealed, with nothing measured', () => {
    const experiment = new BoxExperiment();
    expect(experiment.phase).toBe('sealed');
    expect(experiment.outcome).toBeNull();
  });

  it('is registered as a scene the laboratory can open and that returns to the laboratory', () => {
    expect(sourceOf('/config/sceneKeys.ts')).toMatch(/box: 'Box'/);
    expect(sourceOf('/config/gameConfig.ts')).toMatch(/scene: \[[^\]]*BoxScene[^\]]*\]/);
    expect(sourceOf('/scenes/LaboratoryScene.ts')).toMatch(/leaveTo\(SCENE_KEYS\.box\)/);
    expect(sourceOf('/scenes/BoxScene.ts')).toMatch(/leaveTo\(SCENE_KEYS\.laboratory, \{ resume: true \}\)/);
  });
});

describe('THE BOX: the state before measurement', () => {
  it('is the superposition (|0⟩ + |1⟩)/√2', () => {
    const state = new BoxExperiment().state;

    expect(state.qubitCount).toBe(1);
    expect(state.getAmplitude(0).real).toBeCloseTo(INVERSE_SQRT_2, PRECISION);
    expect(state.getAmplitude(0).imaginary).toBeCloseTo(0, PRECISION);
    expect(state.getAmplitude(1).real).toBeCloseTo(INVERSE_SQRT_2, PRECISION);
    expect(state.getAmplitude(1).imaginary).toBeCloseTo(0, PRECISION);
  });

  it('is exactly what the engine’s Hadamard gate makes from |0⟩', () => {
    const expected = QuantumState.basis(1, 0).applyGate(Gates.H, 0);
    expect(new BoxExperiment().state.equals(expected)).toBe(true);
  });

  it('gives each outcome a probability of one half', () => {
    const [zero, one] = new BoxExperiment().probabilities;
    expect(zero).toBeCloseTo(0.5, PRECISION);
    expect(one).toBeCloseTo(0.5, PRECISION);
  });

  it('is normalised', () => {
    expect(new BoxExperiment().state.isNormalized()).toBe(true);
  });

  it('is still the superposition after the player chooses to observe, until the measurement itself', () => {
    const experiment = new BoxExperiment();
    experiment.beginObservation();

    expect(experiment.phase).toBe('observing');
    expect(experiment.outcome).toBeNull();
    expect(experiment.probabilities[0]).toBeCloseTo(0.5, PRECISION);
    expect(experiment.probabilities[1]).toBeCloseTo(0.5, PRECISION);
  });

  it('is not disturbed by being inspected', () => {
    const experiment = new BoxExperiment();
    const copy = experiment.state;
    copy.measure(); // measuring the copy collapses the copy, not the box

    void experiment.probabilities;
    expect(experiment.phase).toBe('sealed');
    expect(experiment.probabilities[0]).toBeCloseTo(0.5, PRECISION);
    expect(experiment.probabilities[1]).toBeCloseTo(0.5, PRECISION);
  });
});

describe('THE BOX: observation', () => {
  it('produces a measurement', () => {
    const experiment = new BoxExperiment();
    expect(experiment.beginObservation()).toBe(true);

    const outcome = experiment.measure();
    expect(experiment.phase).toBe('observed');
    expect(experiment.outcome).toBe(outcome);
  });

  it('gives one valid basis state: 0 or 1', () => {
    for (let trial = 0; trial < 200; trial += 1) {
      expect([0, 1]).toContain(observeOnce().outcome);
    }
  });

  it('collapses the state onto the outcome that was measured', () => {
    for (let trial = 0; trial < 200; trial += 1) {
      const experiment = observeOnce();
      const outcome = experiment.outcome;

      expect(experiment.state.equals(QuantumState.basis(1, outcome === 1 ? 1 : 0))).toBe(true);
      expect(experiment.probabilities).toEqual(outcome === 1 ? [0, 1] : [1, 0]);
    }
  });

  it('leaves a definite state: measuring it again can only give the same result', () => {
    const experiment = observeOnce();
    const collapsed = experiment.state;
    for (let repeat = 0; repeat < 100; repeat += 1) {
      expect(collapsed.measure()).toBe(experiment.outcome);
    }
  });

  it('cannot be measured before the player has chosen to observe', () => {
    const experiment = new BoxExperiment();
    expect(() => experiment.measure()).toThrow(/only be measured while it is being observed/);
    expect(experiment.phase).toBe('sealed');
    expect(experiment.probabilities[0]).toBeCloseTo(0.5, PRECISION);
  });
});

describe('THE BOX: one observation at a time', () => {
  it('refuses a second observation while one is under way', () => {
    const experiment = new BoxExperiment();
    expect(experiment.beginObservation()).toBe(true);
    expect(experiment.beginObservation()).toBe(false);
    expect(experiment.beginObservation()).toBe(false);
    expect(experiment.phase).toBe('observing');
  });

  it('refuses another observation once the box has been observed', () => {
    const experiment = observeOnce();
    const outcome = experiment.outcome;

    expect(experiment.beginObservation()).toBe(false);
    expect(experiment.phase).toBe('observed');
    expect(experiment.outcome).toBe(outcome);
  });

  it('measures exactly once per observation', () => {
    const experiment = observeOnce();
    expect(() => experiment.measure()).toThrow(/only be measured while it is being observed/);
  });
});

describe('THE BOX: replay', () => {
  it('prepares a fresh superposition each time', () => {
    const experiment = observeOnce();
    experiment.reset();

    expect(experiment.phase).toBe('sealed');
    expect(experiment.outcome).toBeNull();
    expect(experiment.probabilities[0]).toBeCloseTo(0.5, PRECISION);
    expect(experiment.probabilities[1]).toBeCloseTo(0.5, PRECISION);
  });

  it('gives a valid outcome on every replay', () => {
    const experiment = new BoxExperiment();
    for (let replay = 0; replay < 300; replay += 1) {
      observeOnce(experiment);
      expect([0, 1]).toContain(experiment.outcome);
      experiment.reset();
    }
  });

  it('can give either outcome: neither is fixed, and the order is not arranged', () => {
    const experiment = new BoxExperiment();
    const seen = new Set<number | null>();
    const firstOutcomes = new Set<number | null>();

    for (let replay = 0; replay < 200; replay += 1) {
      seen.add(observeOnce(experiment).outcome);
      experiment.reset();
      firstOutcomes.add(observeOnce(new BoxExperiment()).outcome); // the very first observation of a new box
    }
    // The chance of 200 identical fair outcomes is 2^-199.
    expect(seen).toEqual(new Set([0, 1]));
    expect(firstOutcomes).toEqual(new Set([0, 1]));
  });

  it('gives each outcome about half the time', () => {
    // The engine's own randomness, not a fake. 20,000 observations put one standard deviation at 0.35%,
    // so a 3% margin is more than eight of them: a fair box fails by chance less than once in 10^14 runs.
    const observations = 20_000;
    const experiment = new BoxExperiment();
    let ones = 0;

    for (let replay = 0; replay < observations; replay += 1) {
      ones += observeOnce(experiment).outcome ?? 0;
      experiment.reset();
    }
    expect(Math.abs(ones / observations - 0.5)).toBeLessThan(0.03);
  });

  it('does not let one outcome influence the next', () => {
    // After a 1, the next outcome should still be 1 about half the time.
    const experiment = new BoxExperiment();
    let afterOne = 0;
    let oneThenOne = 0;
    let previous: number | null = null;

    for (let replay = 0; replay < 40_000; replay += 1) {
      const outcome = observeOnce(experiment).outcome;
      if (previous === 1) {
        afterOne += 1;
        oneThenOne += outcome === 1 ? 1 : 0;
      }
      previous = outcome;
      experiment.reset();
    }
    expect(Math.abs(oneThenOne / afterOne - 0.5)).toBeLessThan(0.03);
  });
});

describe('THE BOX: the outcome comes from the engine’s measurement', () => {
  it('follows the random source handed to the engine, through cumulative sampling', () => {
    // With probabilities [0.5, 0.5] the engine maps a draw below 0.5 to outcome 0 and above to 1.
    expect(observeOnce(new BoxExperiment(() => 0.25)).outcome).toBe(0);
    expect(observeOnce(new BoxExperiment(() => 0.75)).outcome).toBe(1);
  });

  it('matches what the engine gives for the same state and the same random draws', () => {
    const boxRandom = createSeededRandom(2026);
    const engineRandom = createSeededRandom(2026);
    const experiment = new BoxExperiment(boxRandom);

    for (let replay = 0; replay < 100; replay += 1) {
      const expected = QuantumState.basis(1, 0).applyGate(Gates.H, 0).measure(engineRandom);
      expect(observeOnce(experiment).outcome).toBe(expected);
      experiment.reset();
    }
  });

  it('never calls Math.random itself, and builds its state from the engine', () => {
    const source = sourceOf('/systems/box/BoxExperiment.ts');
    expect(source).not.toMatch(/Math\.random/);
    expect(source).toMatch(/QuantumState\.basis\(1, 0\)\.applyGate\(Gates\.H, 0\)/);
    expect(source).toMatch(/this\.#state\.measure\(/);
  });

  it('is the only place the scene gets an outcome from', () => {
    const scene = sourceOf('/scenes/BoxScene.ts');
    expect(scene).not.toMatch(/Math\.random/);
    expect(scene).toMatch(/const outcome = this\.experiment\.measure\(\)/);
  });

  it('uses no randomness anywhere in the game layer except through the engine', () => {
    const offenders = Object.entries(gameSources)
      .filter(([, source]) => /Math\.random/.test(source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});

describe('THE BOX: leaving and coming back', () => {
  it('is sealed and fair again after being abandoned mid-observation', () => {
    const experiment = new BoxExperiment();
    experiment.beginObservation(); // the player leaves before the measurement happens
    experiment.reset(); // what the scene does on every entry

    expect(experiment.phase).toBe('sealed');
    expect(experiment.outcome).toBeNull();
    expect(experiment.beginObservation()).toBe(true);
    expect([0, 1]).toContain(experiment.measure());
  });

  it('carries nothing over from the previous visit', () => {
    const experiment = observeOnce(new BoxExperiment(() => 0.75));
    expect(experiment.outcome).toBe(1);

    experiment.reset();
    expect(experiment.outcome).toBeNull();
    expect(experiment.probabilities[0]).toBeCloseTo(0.5, PRECISION);
  });

  it('resumes the laboratory only when THE BOX asks it to, never because of an earlier visit', () => {
    // Phaser re-uses a scene's previous start data when none is passed. Without an explicit empty
    // object, entering the laboratory from the main menu would inherit `resume` from the last
    // return from THE BOX and bring back an experiment that should have been cleared.
    expect(sourceOf('/scenes/StageScene.ts')).toMatch(/this\.scene\.start\(sceneKey, data \?\? \{\}\)/);
    expect(sourceOf('/scenes/LaboratoryScene.ts')).toMatch(/entry\?\.resume === true && this\.hasExperiment/);
    expect(sourceOf('/scenes/LaboratoryScene.ts')).toMatch(/this\.leaveTo\(SCENE_KEYS\.mainMenu\)/);
  });

  it('does not touch the Oracle: its record is the same after any number of observations', () => {
    const oracle = new GameOracle(createParityFunction(6, 0b101101));
    oracle.query('010110');
    oracle.query('000001');
    const before = JSON.stringify(oracle.history);

    const experiment = new BoxExperiment();
    for (let replay = 0; replay < 25; replay += 1) {
      observeOnce(experiment);
      experiment.reset();
    }

    expect(JSON.stringify(oracle.history)).toBe(before);
    expect(oracle.queryCount).toBe(2);
    expect(oracle.query('010110').output).toBe(1);
  });
});
