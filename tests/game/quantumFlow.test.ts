import { describe, expect, it } from 'vitest';
import { PROMISE_REVEAL_QUERY } from '../../src/game/config/promiseConfig';
import { promiseIsRevealed } from '../../src/game/systems/oracle/Classification';
import { Investigation } from '../../src/game/systems/oracle/Investigation';
import { inputAt } from '../../src/game/systems/oracle/inputSpace';
import { createPrototypeOracle } from '../../src/game/systems/oracle/prototypeOracle';
import componentsCss from '../../src/styles/components.css?raw';

/**
 * Regression tests for two defects in the way into, and out of, Quantum Mode.
 *
 *   1. ENTER QUANTUM MODE was on show, and usable, from the first moment in the
 *      laboratory, so the whole investigation could be skipped.
 *   2. CONTINUE was on show in Quantum Mode before the algorithm had been run.
 *      Pressing it threw, leaving a blank stage — or, on a later visit, showed
 *      the result of an earlier run.
 *
 * Both came from the same cause: a control marked `hidden` was still drawn,
 * because its own `display` value beat the attribute.
 */

const gameSources = import.meta.glob<string>('../../src/game/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const sourceOf = (fileName: string): string => {
  const entry = Object.entries(gameSources).find(([path]) => path.endsWith(fileName));
  if (!entry) {
    throw new Error(`No game source file named ${fileName}.`);
  }
  return entry[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
};

/** The body of a method, by its signature. */
const bodyOf = (source: string, signature: RegExp): string => {
  const start = signature.exec(source);
  if (!start) {
    throw new Error(`No method matching ${signature}.`);
  }
  const rest = source.slice(start.index + start[0].length);
  return rest.slice(0, rest.search(/\n {2}\}/));
};

describe('a hidden control is not there', () => {
  it('is not drawn: the hidden attribute beats the control’s own display value', () => {
    const css = componentsCss.replace(/\/\*[\s\S]*?\*\//g, '');
    const control = /\.control\s*\{[^}]*\}/.exec(css)?.[0] ?? '';

    expect(control).toMatch(/display:\s*inline-flex/); // the value that used to win
    expect(css).toMatch(/\.control\[hidden\]\s*\{\s*display:\s*none;\s*\}/);
  });

  it('is never forced back on screen with an inline display value', () => {
    for (const file of ['/ui/views/laboratoryView.ts', '/ui/views/quantumView.ts']) {
      expect(sourceOf(file)).not.toMatch(/\.style\.display\s*=/);
    }
  });
});

describe('the way into Quantum Mode', () => {
  const view = sourceOf('/ui/views/laboratoryView.ts');
  const scene = sourceOf('/scenes/LaboratoryScene.ts');

  it('is hidden when the laboratory is built', () => {
    expect(view).toMatch(/quantumModeButton\.hidden = true;/);
  });

  it('is shown in one place only: when the constraint is disclosed', () => {
    expect(view.match(/quantumModeButton\.hidden = /g)).toHaveLength(2);
    expect(bodyOf(view, /revealPromise\([^)]*\) \{/)).toMatch(/quantumModeButton\.hidden = !onEnterQuantumMode;/);
  });

  it('is refused by the laboratory itself until then, however it is asked for', () => {
    const enter = bodyOf(scene, /private enterQuantumMode\(\): void \{/);

    expect(enter).toMatch(/if \(this\.isLeavingStage \|\| !promiseIsRevealed\(this\.investigation\.progress\)\) \{\s*return;/);
    // The refusal comes before anything else happens: no sound, no reaching for the machine, no change of scene.
    expect(enter.indexOf('return;')).toBeLessThan(enter.indexOf('audioManager'));
    expect(enter.indexOf('return;')).toBeLessThan(enter.indexOf('this.leaveTo('));
  });

  it('opens at the query that discloses the constraint, and at no earlier one', () => {
    const investigation = new Investigation(createPrototypeOracle());
    expect(promiseIsRevealed(investigation.progress)).toBe(false); // a fresh laboratory: no way in

    for (let query = 1; query <= PROMISE_REVEAL_QUERY; query += 1) {
      investigation.ask(inputAt(query, 6));
      expect(promiseIsRevealed(investigation.progress)).toBe(query >= PROMISE_REVEAL_QUERY);
    }
  });

  it('is not opened by repeating an input: a repeat is not a query', () => {
    const investigation = new Investigation(createPrototypeOracle());
    for (let repeat = 0; repeat < 30; repeat += 1) {
      investigation.ask('000000');
    }
    expect(promiseIsRevealed(investigation.progress)).toBe(false);
  });
});

describe('the way out of Quantum Mode', () => {
  const view = sourceOf('/ui/views/quantumView.ts');
  const scene = sourceOf('/scenes/QuantumScene.ts');

  it('is hidden until a run has finished', () => {
    expect(view).toMatch(/nextButton\.hidden = true;/);
    expect(bodyOf(view, /showResult\([^)]*\) \{/)).toMatch(/nextButton\.hidden = false;/);
  });

  it('is withdrawn again while the algorithm is run another time', () => {
    const run = bodyOf(scene, /private runAlgorithm\(\): void \{/);

    expect(view).toMatch(/setContinueAvailable\(available\) \{\s*nextButton\.hidden = !available;/);
    expect(run).toMatch(/this\.view\.setContinueAvailable\(false\);/);
  });

  it('is refused by the scene itself while a run is under way or there is no result', () => {
    const next = bodyOf(scene, /private continueToReveal\(\): void \{/);

    expect(next).toMatch(/if \(this\.isRunning \|\| !this\.result\) \{\s*return;/);
    expect(next.indexOf('return;')).toBeLessThan(next.indexOf('this.leaveTo('));
    expect(scene).toMatch(/onNext: \(\) => this\.continueToReveal\(\)/);
    // It is the only way on to the reveal.
    expect(scene.match(/this\.leaveTo\(/g)).toHaveLength(1);
  });

  it('has a result only once the run has finished, not from the moment it starts', () => {
    const run = bodyOf(scene, /private runAlgorithm\(\): void \{/);
    const cleared = run.indexOf('this.result = null;');
    const computed = run.indexOf('runDeutschJozsa(');
    const finished = run.indexOf('this.afterDelay(5500');
    const kept = run.indexOf('this.result = result;');

    expect(cleared).toBeGreaterThan(-1);
    expect(cleared).toBeLessThan(computed);
    expect(kept).toBeGreaterThan(finished); // kept inside the callback that ends the run
    expect(run.match(/this\.result = result;/g)).toHaveLength(1);
  });

  it('carries nothing over from an earlier visit', () => {
    const create = bodyOf(scene, /create\(entry: QuantumEntry\): void \{/);

    expect(create).toMatch(/this\.result = null;/);
    expect(create).toMatch(/this\.hasRun = false;/);
    expect(create).toMatch(/this\.isRunning = false;/);
  });

  it('still takes its result from the real algorithm, run on the real machine', () => {
    const run = bodyOf(scene, /private runAlgorithm\(\): void \{/);

    expect(run).toMatch(/const oracle = createOracle\(this\.hiddenFunction\);\s*const result = runDeutschJozsa\(oracle\);/);
  });
});

describe('the reveal', () => {
  it('goes back to the laboratory rather than fail when it is given no result', () => {
    const create = bodyOf(sourceOf('/scenes/RevealScene.ts'), /create\(entry: RevealEntry\): void \{/);

    expect(create).toMatch(/if \(!entry\?\.result\) \{\s*this\.scene\.start\(SCENE_KEYS\.laboratory, \{ resume: true \}\);\s*return;/);
    expect(create.indexOf('return;')).toBeLessThan(create.indexOf('createRevealView('));
  });
});
