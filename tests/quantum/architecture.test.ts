import { describe, expect, it } from 'vitest';
import * as quantum from '../../src/quantum';

/** Source text of every file in the quantum engine, keyed by path. */
const sources = import.meta.glob<string>('../../src/quantum/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const withoutComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('quantum engine: independence', () => {
  it('consists of the expected modules', () => {
    const fileNames = Object.keys(sources)
      .map((path) => path.split('/').pop())
      .sort();
    expect(fileNames).toEqual(['complex.ts', 'gates.ts', 'index.ts', 'measurement.ts', 'state.ts']);
  });

  it('imports nothing from outside its own folder — no Phaser, no game code, no packages', () => {
    for (const [path, source] of Object.entries(sources)) {
      const specifiers = [...withoutComments(source).matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
      for (const specifier of specifiers) {
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

describe('quantum engine: public API', () => {
  it('exports exactly the intended names', () => {
    expect(Object.keys(quantum).sort()).toEqual([
      'ComplexNumber',
      'Gates',
      'MAX_QUBIT_COUNT',
      'QUANTUM_EPSILON',
      'QuantumState',
      'basisStateLabel',
    ]);
  });

  it('offers the four single-qubit gates', () => {
    expect(Object.keys(quantum.Gates).sort()).toEqual(['H', 'I', 'X', 'Z']);
  });
});
