import { describe, expect, it } from 'vitest';
import * as quantum from '../../src/quantum';

/** Source text of every file in the quantum engine, keyed by path. */
const sources = import.meta.glob<string>('../../src/quantum/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const withoutComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function sourceOf(fileName: string): string {
  const entry = Object.entries(sources).find(([path]) => path.endsWith(`/${fileName}`));
  if (!entry) {
    throw new Error(`No source file named ${fileName} in the quantum engine.`);
  }
  return withoutComments(entry[1]);
}

function importsOf(source: string): string[] {
  return [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1] ?? '');
}

describe('quantum engine: independence', () => {
  it('consists of the expected modules', () => {
    const fileNames = Object.keys(sources)
      .map((path) => path.split('/').pop())
      .sort();
    expect(fileNames).toEqual([
      'booleanFunction.ts',
      'complex.ts',
      'deutschJozsa.ts',
      'gates.ts',
      'index.ts',
      'measurement.ts',
      'oracle.ts',
      'state.ts',
    ]);
  });

  it('imports nothing from outside its own folder — no Phaser, no game code, no packages', () => {
    for (const [path, source] of Object.entries(sources)) {
      for (const specifier of importsOf(withoutComments(source))) {
        expect(specifier, `${path} imports "${specifier}"`).toMatch(/^\.\/[a-z]+$/i);
      }
    }
  });

  it('uses no browser globals, so it runs anywhere TypeScript does', () => {
    for (const [path, source] of Object.entries(sources)) {
      const browserGlobals = withoutComments(source).match(/\b(window|document|navigator|localStorage|Phaser)\b/g);
      expect(browserGlobals, `${path} refers to a browser global`).toBeNull();
    }
  });
});

describe('quantum engine: Deutsch–Jozsa cannot read the function', () => {
  const source = sourceOf('deutschJozsa.ts');

  it('does not import the Boolean-function module at all', () => {
    expect(importsOf(source)).not.toContain('./booleanFunction');
  });

  it('never evaluates, tabulates or classifies a function', () => {
    expect(source).not.toMatch(/\bevaluate\b/);
    expect(source).not.toMatch(/\btruthTable\b/);
    expect(source).not.toMatch(/\bclassifyByTruthTable\b/);
  });

  it('decides its verdict from the measured input register', () => {
    expect(source).toMatch(/measuredInput\s*=\s*state\.measureQubits\(/);
    expect(source).toMatch(/verdict[^=]*=\s*measuredInput === 0 \? 'constant' : 'balanced'/);
  });
});

describe('quantum engine: public API', () => {
  it('exports exactly the intended names', () => {
    expect(Object.keys(quantum).sort()).toEqual([
      'ComplexNumber',
      'Gates',
      'MAX_INPUT_QUBIT_COUNT',
      'MAX_QUBIT_COUNT',
      'QUANTUM_EPSILON',
      'QuantumState',
      'basisStateLabel',
      'classifyByTruthTable',
      'createBooleanFunction',
      'createConstantFunction',
      'createFunctionFromTruthTable',
      'createOracle',
      'createParityFunction',
      'createRandomBalancedFunction',
      'runDeutschJozsa',
      'truthTable',
    ]);
  });

  it('offers the four single-qubit gates', () => {
    expect(Object.keys(quantum.Gates).sort()).toEqual(['H', 'I', 'X', 'Z']);
  });
});
