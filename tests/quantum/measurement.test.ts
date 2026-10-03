import { describe, expect, it } from 'vitest';
import { ComplexNumber, Gates, QuantumState } from '../../src/quantum';
import { probabilitiesOf, sampleIndex } from '../../src/quantum/measurement';
import { createSeededRandom } from '../../src/utils/random';
import { PRECISION, expectAmplitudes, expectStatesEqual } from './helpers';

/*
 * The statistical tests below use the engine's real default randomness
 * (Math.random), not a fake. Each allows a margin of at least eight standard
 * deviations, so a correct engine fails them by chance less than once in
 * 10^14 runs, while a wrong distribution (say 60/40) is caught every time.
 */
const SHOTS = 20_000;
const TOLERANCE = 0.03;

/** Fraction of non-destructive samples that landed on each basis state. */
function sampleFrequencies(state: QuantumState, shots = SHOTS): number[] {
  const counts = new Array<number>(state.dimension).fill(0);
  for (let shot = 0; shot < shots; shot += 1) {
    const outcome = state.sampleMeasurement();
    counts[outcome] = (counts[outcome] ?? 0) + 1;
  }
  return counts.map((count) => count / shots);
}

function expectFrequencies(actual: readonly number[], expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((probability, index) => {
    expect(Math.abs((actual[index] ?? Number.NaN) - probability)).toBeLessThan(TOLERANCE);
  });
}

const plusState = (): QuantumState => QuantumState.basis(1, 0).applyGate(Gates.H, 0);

describe('measurement: certain outcomes', () => {
  it('always measures 0 for |0⟩', () => {
    for (let trial = 0; trial < 500; trial += 1) {
      expect(QuantumState.basis(1, 0).measure()).toBe(0);
    }
  });

  it('always measures 1 for |1⟩', () => {
    for (let trial = 0; trial < 500; trial += 1) {
      expect(QuantumState.basis(1, 1).measure()).toBe(1);
    }
  });

  it('always measures the basis index of a multi-qubit basis state', () => {
    for (let basisIndex = 0; basisIndex < 8; basisIndex += 1) {
      for (let trial = 0; trial < 50; trial += 1) {
        expect(QuantumState.basis(3, basisIndex).measure()).toBe(basisIndex);
        expect(QuantumState.basis(3, basisIndex).sampleMeasurement()).toBe(basisIndex);
      }
    }
  });

  it('becomes certain again when interference restores a basis state: H·H|0⟩ always measures 0', () => {
    for (let trial = 0; trial < 500; trial += 1) {
      expect(plusState().applyGate(Gates.H, 0).measure()).toBe(0);
    }
  });
});

describe('measurement: sampling follows |amplitude|²', () => {
  it('samples (|0⟩ + |1⟩)/√2 about half 0 and half 1', () => {
    expectFrequencies(sampleFrequencies(plusState()), [0.5, 0.5]);
  });

  it('is unaffected by relative phase: (|0⟩ − |1⟩)/√2 is also half and half', () => {
    const minusState = QuantumState.basis(1, 1).applyGate(Gates.H, 0);
    expectFrequencies(sampleFrequencies(minusState), [0.5, 0.5]);
  });

  it('samples an uneven state in proportion to its probabilities', () => {
    const state = QuantumState.fromAmplitudes([Math.sqrt(0.2), new ComplexNumber(0, Math.sqrt(0.8))]);
    expectFrequencies(sampleFrequencies(state), [0.2, 0.8]);
  });

  it('samples a two-qubit uniform superposition about a quarter each', () => {
    const state = QuantumState.basis(2, 0).applyHadamardAll();
    expectFrequencies(sampleFrequencies(state), [0.25, 0.25, 0.25, 0.25]);
  });

  it('never returns an outcome whose amplitude is zero', () => {
    // (|00⟩ + |11⟩)/√2: only 00 and 11 can ever be observed.
    const state = QuantumState.fromAmplitudes([1, 0, 0, 1]).normalize();
    const frequencies = sampleFrequencies(state);

    expect(frequencies[1]).toBe(0);
    expect(frequencies[2]).toBe(0);
    expectFrequencies(frequencies, [0.5, 0, 0, 0.5]);
  });

  it('follows the same distribution when measuring destructively', () => {
    const shots = 10_000;
    let ones = 0;
    for (let shot = 0; shot < shots; shot += 1) {
      ones += plusState().measure();
    }
    expect(Math.abs(ones / shots - 0.5)).toBeLessThan(0.04);
  });
});

describe('sampleMeasurement: non-destructive', () => {
  it('leaves the state exactly as it was', () => {
    const state = plusState();
    const before = state.getAmplitudes();

    for (let shot = 0; shot < 1000; shot += 1) {
      state.sampleMeasurement();
    }

    expect(state.getAmplitudes()).toEqual(before);
    expectAmplitudes(state, [Math.SQRT1_2, Math.SQRT1_2]);
  });

  it('can therefore return different results from the same state', () => {
    const state = plusState();
    const seen = new Set<number>();
    for (let shot = 0; shot < 200; shot += 1) {
      seen.add(state.sampleMeasurement());
    }
    // The chance of 200 identical fair samples is 2^-199.
    expect(seen).toEqual(new Set([0, 1]));
  });
});

describe('measure: destructive', () => {
  it('collapses the state onto the basis state that was observed', () => {
    for (let trial = 0; trial < 100; trial += 1) {
      const state = plusState();
      const outcome = state.measure();

      expectStatesEqual(state, QuantumState.basis(1, outcome));
      expect(state.getProbabilities()).toEqual(outcome === 0 ? [1, 0] : [0, 1]);
    }
  });

  it('gives the same result on every later measurement', () => {
    const state = QuantumState.basis(3, 0).applyHadamardAll();
    const first = state.measure();

    for (let repeat = 0; repeat < 200; repeat += 1) {
      expect(state.measure()).toBe(first);
      expect(state.sampleMeasurement()).toBe(first);
    }
  });

  it('leaves a normalised state behind', () => {
    const state = QuantumState.fromAmplitudes([1, new ComplexNumber(0, 2), -3, new ComplexNumber(4, 4)]).normalize();
    state.measure();

    expect(state.isNormalized()).toBe(true);
    expect(state.getProbabilities().filter((probability) => probability === 1)).toHaveLength(1);
  });

  it('collapses a multi-qubit state to the full observed bit string', () => {
    // (|00⟩ + |11⟩)/√2: whichever outcome occurs, both qubits agree afterwards.
    for (let trial = 0; trial < 100; trial += 1) {
      const state = QuantumState.fromAmplitudes([1, 0, 0, 1]).normalize();
      const outcome = state.measure();

      expect([0, 3]).toContain(outcome);
      expectStatesEqual(state, QuantumState.basis(2, outcome));
    }
  });

  it('destroys the superposition: a Hadamard no longer undoes itself after measuring', () => {
    // Unmeasured, H·H|0⟩ is |0⟩ with certainty. Measuring in between leaves |0⟩ or |1⟩,
    // and the second Hadamard then produces a superposition instead.
    const state = plusState();
    state.measure();
    state.applyGate(Gates.H, 0);

    const [p0, p1] = state.getProbabilities();
    expect(p0).toBeCloseTo(0.5, PRECISION);
    expect(p1).toBeCloseTo(0.5, PRECISION);
  });
});

describe('measurement: invalid states', () => {
  it('refuses to measure or sample a state that is not normalised', () => {
    const state = QuantumState.fromAmplitudes([1, 1]);
    expect(() => state.measure()).toThrow(/not normalised/);
    expect(() => state.sampleMeasurement()).toThrow(/not normalised/);
    expectAmplitudes(state, [1, 1]);
  });

  it('refuses to measure the zero vector', () => {
    expect(() => QuantumState.fromAmplitudes([0, 0]).measure()).toThrow(/not normalised/);
  });
});

/*
 * From here on a controlled random source is passed in. This is deliberate
 * and isolated: it pins down exactly where the sampler's boundaries fall,
 * which random trials cannot do. The distribution itself is tested above
 * with real randomness.
 */
describe('measurement: with an injected random source', () => {
  it('maps a random number to an outcome through the cumulative probabilities', () => {
    const state = plusState(); // cumulative boundaries at 0.5 and 1
    expect(state.sampleMeasurement(() => 0)).toBe(0);
    expect(state.sampleMeasurement(() => 0.49)).toBe(0);
    expect(state.sampleMeasurement(() => 0.51)).toBe(1);
    expect(state.sampleMeasurement(() => 0.999)).toBe(1);
  });

  it('uses the same source for a destructive measurement', () => {
    const state = QuantumState.basis(2, 0).applyHadamardAll(); // boundaries at 0.25, 0.5, 0.75, 1
    expect(state.measure(() => 0.6)).toBe(2);
    expectStatesEqual(state, QuantumState.basis(2, 2));
  });

  it('is reproducible for a given seed', () => {
    const run = (seed: number): number[] => {
      const random = createSeededRandom(seed);
      const state = QuantumState.basis(3, 0).applyHadamardAll();
      return Array.from({ length: 50 }, () => state.sampleMeasurement(random));
    };

    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });
});

describe('probabilitiesOf', () => {
  it('applies the Born rule to each amplitude', () => {
    const probabilities = probabilitiesOf([new ComplexNumber(0.6, 0), new ComplexNumber(0, -0.8)]);
    expect(probabilities[0]).toBeCloseTo(0.36, PRECISION);
    expect(probabilities[1]).toBeCloseTo(0.64, PRECISION);
  });
});

describe('sampleIndex: cumulative sampling', () => {
  const probabilities = [0.25, 0.25, 0.5];

  it.each([
    { random: 0, expected: 0 },
    { random: 0.2499, expected: 0 },
    { random: 0.25, expected: 1 },
    { random: 0.4999, expected: 1 },
    { random: 0.5, expected: 2 },
    { random: 0.9999, expected: 2 },
  ])('returns outcome $expected when the random number is $random', ({ random, expected }) => {
    expect(sampleIndex(probabilities, () => random)).toBe(expected);
  });

  it('skips outcomes with zero probability, even at a boundary', () => {
    expect(sampleIndex([0, 1], () => 0)).toBe(1);
    expect(sampleIndex([0.5, 0, 0.5], () => 0.5)).toBe(2);
    expect(sampleIndex([0, 0, 1, 0], () => 0.999)).toBe(2);
  });

  it('still returns a possible outcome if the random source misbehaves', () => {
    expect(sampleIndex([0.5, 0.5, 0], () => 1)).toBe(1);
    expect(sampleIndex([0, 0.5, 0.5], () => -1)).toBe(1);
  });

  it('samples by proportion, so tiny rounding drift in the total cannot bias the result', () => {
    expect(sampleIndex([2, 2], () => 0.49)).toBe(0);
    expect(sampleIndex([2, 2], () => 0.51)).toBe(1);
  });

  it('refuses to sample when nothing can happen', () => {
    expect(() => sampleIndex([0, 0])).toThrow(/Cannot sample/);
    expect(() => sampleIndex([])).toThrow(/Cannot sample/);
  });
});
