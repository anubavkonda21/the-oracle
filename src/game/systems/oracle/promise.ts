import { classifyByTruthTable, type BooleanFunction } from '../../../quantum';
import { GameOracle } from './GameOracle';
import type { OracleKind } from './oracleKind';

/**
 * THE PROMISE. The machine's hidden function is guaranteed to be one of two
 * kinds: constant, or balanced (see oracleKind.ts). The game tells the player
 * so, and what it tells the player has to be true of the machine in front of
 * them — so a machine is only ever built here, from a function that has been
 * checked.
 *
 * The check is the slow, certain one: every output of the function is worked
 * out and counted. That happens once, before the machine exists, and outside
 * its record — it uses none of the player's queries.
 *
 * This is the one module in the game that can see what kind the machine is,
 * and it does not keep the answer. The kind is checked and thrown away: no
 * machine, investigation or interface holds it, so none of them can give it
 * away. It has to be found out.
 */

/** The kind of a function that keeps the promise. A function that is neither kind is refused. */
export function promisedKind(hiddenFunction: BooleanFunction): OracleKind {
  const kind = classifyByTruthTable(hiddenFunction);
  if (kind === 'neither') {
    const bits = hiddenFunction.inputQubitCount;
    throw new RangeError(
      `This function of ${bits} bit(s) breaks the promise: it is neither constant (the same output for every input) nor balanced (0 for exactly half the inputs, 1 for the rest).`,
    );
  }
  return kind;
}

/**
 * Builds the machine for a hidden function — but only one that keeps the
 * promise. The machine it returns is an ordinary `GameOracle`: it carries no
 * mark of which kind it is.
 */
export function createPromisedOracle(hiddenFunction: BooleanFunction): GameOracle {
  promisedKind(hiddenFunction); // Refuses a function that breaks the promise. The kind it finds is deliberately not kept.
  return new GameOracle(hiddenFunction);
}
