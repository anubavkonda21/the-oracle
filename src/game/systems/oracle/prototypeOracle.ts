import { createParityFunction } from '../../../quantum';
import { ORACLE_INPUT_LENGTH } from '../../config/oracleConfig';
import type { GameOracle } from './GameOracle';
import { createPromisedOracle } from './promise';

/**
 * Which bits of the input the prototype's rule depends on. The machine
 * answers 1 when an odd number of these bits are set. Some bits matter and
 * some do not, which makes the machine worth probing.
 *
 * This rule is never shown to the player.
 */
const PROTOTYPE_RULE_MASK = 0b101101;

/**
 * The machine for the first playable prototype. Its hidden function is fixed
 * rather than random, so every session behaves identically and a bug can be
 * reproduced. Later checkpoints replace this one function; nothing else needs
 * to change.
 *
 * It is built through `createPromisedOracle`, which checks that the function
 * keeps the promise the game makes about it and refuses one that does not.
 * This function does: see tests/game/promise.test.ts.
 */
export function createPrototypeOracle(): GameOracle {
  return createPromisedOracle(createParityFunction(ORACLE_INPUT_LENGTH, PROTOTYPE_RULE_MASK));
}
