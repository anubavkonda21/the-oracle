import { describe, expect, it } from 'vitest';
import { ComplexNumber, QUANTUM_EPSILON } from '../../src/quantum';
import { PRECISION, expectComplex } from './helpers';

const z = new ComplexNumber(1, 2);
const w = new ComplexNumber(3, 4);

describe('ComplexNumber: construction', () => {
  it('provides zero, one and i', () => {
    expectComplex(ComplexNumber.zero, 0, 0);
    expectComplex(ComplexNumber.one, 1, 0);
    expectComplex(ComplexNumber.i, 0, 1);
  });

  it('defaults the imaginary part to 0', () => {
    expectComplex(new ComplexNumber(5), 5, 0);
    expectComplex(ComplexNumber.fromReal(-2.5), -2.5, 0);
  });

  it('builds from polar form: magnitude · e^(i·phase)', () => {
    expectComplex(ComplexNumber.fromPolar(1, 0), 1, 0);
    expectComplex(ComplexNumber.fromPolar(2, Math.PI / 2), 0, 2);
    expectComplex(ComplexNumber.fromPolar(1, Math.PI), -1, 0);
    expectComplex(ComplexNumber.fromPolar(3, -Math.PI / 2), 0, -3);
    expectComplex(ComplexNumber.fromPolar(1, Math.PI / 4), Math.SQRT1_2, Math.SQRT1_2);
  });

  it('keeps the requested magnitude for any phase', () => {
    for (const phase of [0, 0.3, 1, 2.5, Math.PI, 4, 6]) {
      expect(ComplexNumber.fromPolar(1.75, phase).magnitude()).toBeCloseTo(1.75, PRECISION);
    }
  });
});

describe('ComplexNumber: addition and subtraction', () => {
  it('adds part by part', () => {
    expectComplex(z.add(w), 4, 6);
  });

  it('subtracts part by part', () => {
    expectComplex(z.subtract(w), -2, -2);
    expectComplex(w.subtract(z), 2, 2);
  });

  it('treats zero as the additive identity', () => {
    expectComplex(z.add(ComplexNumber.zero), 1, 2);
    expectComplex(z.subtract(ComplexNumber.zero), 1, 2);
    expectComplex(z.subtract(z), 0, 0);
  });
});

describe('ComplexNumber: multiplication', () => {
  it('follows (a + bi)(c + di) = (ac − bd) + (ad + bc)i', () => {
    // (1 + 2i)(3 + 4i) = (3 − 8) + (4 + 6)i
    expectComplex(z.multiply(w), -5, 10);
  });

  it('gives i² = −1', () => {
    expectComplex(ComplexNumber.i.multiply(ComplexNumber.i), -1, 0);
  });

  it('treats one as the multiplicative identity', () => {
    expectComplex(z.multiply(ComplexNumber.one), 1, 2);
    expectComplex(ComplexNumber.one.multiply(z), 1, 2);
  });

  it('gives zero when multiplied by zero', () => {
    expectComplex(z.multiply(ComplexNumber.zero), 0, 0);
  });

  it('is commutative', () => {
    const product = z.multiply(w);
    const reversed = w.multiply(z);
    expectComplex(product, reversed.real, reversed.imaginary);
  });

  it('multiplies magnitudes: |zw| = |z||w|', () => {
    expect(z.multiply(w).magnitude()).toBeCloseTo(z.magnitude() * w.magnitude(), PRECISION);
  });

  it('adds phases: e^(iα) · e^(iβ) = e^(i(α + β))', () => {
    const product = ComplexNumber.fromPolar(1, 0.7).multiply(ComplexNumber.fromPolar(1, 1.9));
    const expected = ComplexNumber.fromPolar(1, 2.6);
    expectComplex(product, expected.real, expected.imaginary);
  });

  it('scales by a real number', () => {
    expectComplex(z.scale(3), 3, 6);
    expectComplex(z.scale(-0.5), -0.5, -1);
  });
});

describe('ComplexNumber: magnitude and conjugate', () => {
  it('computes magnitude as √(real² + imaginary²)', () => {
    expect(w.magnitude()).toBeCloseTo(5, PRECISION);
    expect(new ComplexNumber(-3, -4).magnitude()).toBeCloseTo(5, PRECISION);
    expect(ComplexNumber.zero.magnitude()).toBe(0);
  });

  it('computes magnitude squared as real² + imaginary²', () => {
    expect(w.magnitudeSquared()).toBeCloseTo(25, PRECISION);
    expect(z.magnitudeSquared()).toBeCloseTo(5, PRECISION);
    expect(ComplexNumber.i.magnitudeSquared()).toBeCloseTo(1, PRECISION);
  });

  it('keeps magnitude² consistent with magnitude', () => {
    expect(z.magnitude() ** 2).toBeCloseTo(z.magnitudeSquared(), PRECISION);
  });

  it('conjugates by negating the imaginary part', () => {
    expectComplex(z.conjugate(), 1, -2);
    expectComplex(ComplexNumber.fromReal(7).conjugate(), 7, 0);
  });

  it('returns the original when conjugated twice', () => {
    expectComplex(z.conjugate().conjugate(), 1, 2);
  });

  it('satisfies z · z̄ = |z|², a real number', () => {
    expectComplex(z.multiply(z.conjugate()), z.magnitudeSquared(), 0);
  });
});

describe('ComplexNumber: comparison and immutability', () => {
  it('compares with a tolerance rather than exact equality', () => {
    const sum = new ComplexNumber(0.1 + 0.2, 0);
    expect(sum.real === 0.3).toBe(false); // the classic floating-point surprise
    expect(sum.equals(ComplexNumber.fromReal(0.3))).toBe(true);
  });

  it('distinguishes values that differ by more than the tolerance', () => {
    expect(z.equals(new ComplexNumber(1, 2 + QUANTUM_EPSILON * 100))).toBe(false);
    expect(z.equals(new ComplexNumber(1 + QUANTUM_EPSILON * 100, 2))).toBe(false);
    expect(z.equals(new ComplexNumber(1, 2.01), 0.1)).toBe(true);
  });

  it('never changes its operands', () => {
    z.add(w);
    z.multiply(w);
    z.conjugate();
    z.scale(9);
    expectComplex(z, 1, 2);
    expectComplex(w, 3, 4);
  });
});
