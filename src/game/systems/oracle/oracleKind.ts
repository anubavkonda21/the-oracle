/**
 * The two kinds of machine the promise allows.
 *
 *   constant — every possible input produces the same output
 *   balanced — exactly half of all possible inputs produce 0, and half produce 1
 *
 * Nothing in between is allowed: that is the promise.
 */
export const ORACLE_KINDS = ['constant', 'balanced'] as const;

export type OracleKind = (typeof ORACLE_KINDS)[number];
