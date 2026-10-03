/**
 * Shared tolerance for comparing floating-point results anywhere in the
 * quantum engine. It is used for comparisons only: amplitudes are never
 * rounded, so no precision is thrown away between operations.
 */
export const QUANTUM_EPSILON = 1e-10;

/**
 * An immutable complex number, a + bi.
 *
 * Quantum amplitudes are complex, so every entry of a state vector and of a
 * gate matrix is one of these. Every operation returns a new instance.
 */
export class ComplexNumber {
  static readonly zero = new ComplexNumber(0, 0);
  static readonly one = new ComplexNumber(1, 0);
  static readonly i = new ComplexNumber(0, 1);

  constructor(
    readonly real: number,
    readonly imaginary: number = 0,
  ) {}

  static fromReal(value: number): ComplexNumber {
    return new ComplexNumber(value, 0);
  }

  /** magnitude · e^(i·phase), with the phase in radians. */
  static fromPolar(magnitude: number, phase: number): ComplexNumber {
    return new ComplexNumber(magnitude * Math.cos(phase), magnitude * Math.sin(phase));
  }

  add(other: ComplexNumber): ComplexNumber {
    return new ComplexNumber(this.real + other.real, this.imaginary + other.imaginary);
  }

  subtract(other: ComplexNumber): ComplexNumber {
    return new ComplexNumber(this.real - other.real, this.imaginary - other.imaginary);
  }

  /** (a + bi)(c + di) = (ac − bd) + (ad + bc)i */
  multiply(other: ComplexNumber): ComplexNumber {
    return new ComplexNumber(
      this.real * other.real - this.imaginary * other.imaginary,
      this.real * other.imaginary + this.imaginary * other.real,
    );
  }

  /** Multiplies by a real number. */
  scale(factor: number): ComplexNumber {
    return new ComplexNumber(this.real * factor, this.imaginary * factor);
  }

  /** a + bi → a − bi */
  conjugate(): ComplexNumber {
    return new ComplexNumber(this.real, -this.imaginary);
  }

  /** |z|² = a² + b². For an amplitude, this is the probability of its outcome (the Born rule). */
  magnitudeSquared(): number {
    return this.real * this.real + this.imaginary * this.imaginary;
  }

  /** |z| = √(a² + b²) */
  magnitude(): number {
    return Math.hypot(this.real, this.imaginary);
  }

  /** True when both parts agree to within `tolerance`. Use this rather than `===` on computed values. */
  equals(other: ComplexNumber, tolerance = QUANTUM_EPSILON): boolean {
    return (
      Math.abs(this.real - other.real) <= tolerance && Math.abs(this.imaginary - other.imaginary) <= tolerance
    );
  }
}
