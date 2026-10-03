import type { ComplexNumber } from './complex';

/**
 * A source of uniformly distributed random numbers in [0, 1).
 * Measurement uses `Math.random` unless another source is passed in.
 */
export type RandomSource = () => number;

/**
 * The Born rule: the probability of observing basis state i is |αᵢ|².
 * Probabilities are always derived from the amplitudes, never stored or
 * generated separately.
 */
export function probabilitiesOf(amplitudes: readonly ComplexNumber[]): number[] {
  return amplitudes.map((amplitude) => amplitude.magnitudeSquared());
}

/**
 * Draws one outcome by cumulative (inverse-transform) sampling: pick a point
 * uniformly along the total probability, then walk the outcomes until the
 * running sum passes that point. Outcome i is therefore returned with
 * probability pᵢ / Σp.
 *
 * An outcome with probability exactly 0 can never be returned.
 */
export function sampleIndex(probabilities: readonly number[], random: RandomSource = Math.random): number {
  let total = 0;
  for (const probability of probabilities) {
    total += probability;
  }
  if (!(total > 0)) {
    throw new RangeError('Cannot sample a measurement: no outcome has a non-zero probability.');
  }

  const threshold = random() * total;

  let cumulative = 0;
  let lastPossible = -1;
  for (const [index, probability] of probabilities.entries()) {
    if (probability <= 0) {
      continue;
    }
    cumulative += probability;
    lastPossible = index;
    if (threshold < cumulative) {
      return index;
    }
  }

  // Reached only if floating-point rounding leaves the threshold level with the final running sum.
  return lastPossible;
}
