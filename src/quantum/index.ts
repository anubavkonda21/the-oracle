/**
 * Public API of the quantum engine — a small state-vector simulator, and the
 * Deutsch–Jozsa algorithm built on it.
 *
 * The engine is pure TypeScript and depends on nothing outside this folder:
 * no Phaser, no DOM, no game code. Game code imports from here; this folder
 * never imports from the game.
 */
export { ComplexNumber, QUANTUM_EPSILON } from './complex';
export { Gates } from './gates';
export type { Gate, GateMatrix } from './gates';
export type { RandomSource } from './measurement';
export { MAX_QUBIT_COUNT, QuantumState, basisStateLabel } from './state';

export {
  MAX_INPUT_QUBIT_COUNT,
  classifyByTruthTable,
  createBooleanFunction,
  createConstantFunction,
  createFunctionFromTruthTable,
  createParityFunction,
  createRandomBalancedFunction,
  truthTable,
} from './booleanFunction';
export type { Bit, BooleanFunction, BooleanFunctionKind } from './booleanFunction';
export { createOracle } from './oracle';
export type { QuantumOracle } from './oracle';
export { runDeutschJozsa } from './deutschJozsa';
export type {
  DeutschJozsaResult,
  DeutschJozsaStep,
  DeutschJozsaStepId,
  DeutschJozsaVerdict,
} from './deutschJozsa';
