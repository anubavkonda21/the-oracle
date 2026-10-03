import { describe, expect, it } from 'vitest';
import { createParityFunction, createConstantFunction } from '../../src/quantum/booleanFunction';
import { createPromisedOracle } from '../../src/game/systems/oracle/promise';
import { Investigation, ORACLE_INSTANCE } from '../../src/game/systems/oracle/Investigation';
import { HIDDEN_FUNCTION } from '../../src/game/systems/oracle/GameOracle';
import { createOracle } from '../../src/quantum/oracle';
import { runDeutschJozsa } from '../../src/quantum/deutschJozsa';

describe('Quantum Mode Integration', () => {
  const runTest = (f: any, expectedVerdict: string) => {
    const gameOracle = createPromisedOracle(f);
    const investigation = new Investigation(gameOracle);
    
    // Get the hidden function using the symbols
    const oracle = (investigation as any)[ORACLE_INSTANCE];
    const hiddenFunction = oracle[HIDDEN_FUNCTION];
    
    // Create the quantum oracle and run DJ
    const quantumOracle = createOracle(hiddenFunction);
    const result = runDeutschJozsa(quantumOracle);
    
    expect(result.verdict).toBe(expectedVerdict);
    expect(result.oracleQueries).toBe(1);
    expect(investigation.progress.queryCount).toBe(0);
    
    if (expectedVerdict === 'constant') {
      expect(result.measuredInput).toBe(0);
    } else {
      expect(result.measuredInput).not.toBe(0);
    }
  };

  it('works for constant-0 function', () => {
    runTest(createConstantFunction(6, 0), 'constant');
  });

  it('works for constant-1 function', () => {
    runTest(createConstantFunction(6, 1), 'constant');
  });

  it('works for balanced function', () => {
    runTest(createParityFunction(6, 0b101010), 'balanced');
  });
});
