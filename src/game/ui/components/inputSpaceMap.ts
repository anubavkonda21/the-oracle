import { formatCount } from '../../../utils/format';
import type { Bit } from '../../../quantum';
import { INVESTIGATION_COPY } from '../../config/investigationConfig';
import type { OracleQuery } from '../../systems/oracle/GameOracle';
import type { InvestigationProgress } from '../../systems/oracle/Investigation';
import { inputAt, inputIndex, inputSpaceLayout, inputSpaceSize } from '../../systems/oracle/inputSpace';
import { createElement } from '../dom';
import { createPanel } from './panel';

export interface InputSpaceMap {
  readonly element: HTMLElement;
  /** Shows the machine's answer in the cell of the input it was given. With `animate` off the answer is simply there. */
  mark(query: OracleQuery, animate?: boolean): void;
  /** Moves the marker to the cell of the input the player is composing. */
  setCursor(input: string): void;
  /** Draws how many inputs have been tested and how many have not. */
  renderProgress(progress: InvestigationProgress): void;
  /** Briefly reveals all cells on the grid with their true outputs for error visualization. */
  revealAll(outputs: Bit[]): void;
  /** Clears revealed answers and resets untested cells back to blank/neutral. */
  hideAll(): void;
  /** Animates all cells lighting up in superposition. */
  setSuperposition(active: boolean): void;
  /** Resets the map for a new box or bit length. */
  reset(length?: number): void;
}

/**
 * A picture of everything the machine could be asked: one cell for every possible input.
 * Supports dynamic bit lengths (2-bit: 4 cells, 4-bit: 16 cells, 6-bit: 64 cells),
 * error reveal, and superposition illumination.
 */
export function createInputSpaceMap(initialInputLength: number): InputSpaceMap {
  const copy = INVESTIGATION_COPY.inputSpace;
  let currentLength = initialInputLength;
  let size = inputSpaceSize(currentLength);
  let layout = inputSpaceLayout(currentLength);

  const grid = createElement('div', { className: 'input-space__grid' });
  let cells: HTMLSpanElement[] = [];

  const startEnd = createElement('span', { className: 'input-space__end' });
  const lastEnd = createElement('span', { className: 'input-space__end input-space__end--last' });

  const map = createElement('div', { className: 'input-space__map', attributes: { role: 'img' } }, [
    startEnd,
    grid,
    lastEnd,
  ]);

  const tested = createElement('span');
  const untested = createElement('span');
  const bitsSummary = createElement('span');
  const possibleInputsSummary = createElement('span');

  function buildGrid(length: number): void {
    currentLength = length;
    size = inputSpaceSize(currentLength);
    layout = inputSpaceLayout(currentLength);

    grid.innerHTML = '';
    cells = Array.from({ length: size }, () => createElement('span', { className: 'input-space__cell' }));
    cells.forEach((c) => grid.appendChild(c));
    grid.style.setProperty('--columns', String(layout.columns));

    startEnd.textContent = inputAt(0, currentLength);
    lastEnd.textContent = inputAt(size - 1, currentLength);

    bitsSummary.textContent = copy.bits(currentLength);
    possibleInputsSummary.textContent = copy.possibleInputs(size);
  }

  buildGrid(initialInputLength);

  const element = createPanel({
    heading: copy.heading,
    content: [
      createElement('p', { className: 'input-space__summary' }, [bitsSummary, possibleInputsSummary]),
      map,
      createElement('div', { className: 'input-space__counts' }, [
        createElement('p', { className: 'input-space__count' }, [createElement('span', { text: copy.tested }), tested]),
        createElement('p', { className: 'input-space__count' }, [createElement('span', { text: copy.untested }), untested]),
      ]),
    ],
  });
  element.classList.add('input-space');

  const inputSpaceMap: InputSpaceMap = {
    element,

    mark(query, animate = true) {
      const idx = inputIndex(query.input);
      const cell = cells[idx];
      if (!cell) return;

      cell.textContent = String(query.output);
      cell.dataset.output = String(query.output);
      cell.classList.remove('cell--revealed');
      cell.toggleAttribute('data-arrived', animate);
    },

    setCursor(input) {
      grid.querySelector('[data-cursor]')?.removeAttribute('data-cursor');
      if (input.length === currentLength) {
        cells[inputIndex(input)]?.setAttribute('data-cursor', '');
      }
    },

    renderProgress(progress) {
      tested.textContent = formatCount(progress.testedCount);
      untested.textContent = formatCount(progress.untestedCount);
      map.setAttribute('aria-label', copy.description(progress));
    },

    revealAll(outputs) {
      outputs.forEach((output, idx) => {
        const cell = cells[idx];
        if (cell) {
          cell.textContent = String(output);
          cell.dataset.output = String(output);
          cell.classList.add('cell--revealed');
        }
      });
    },

    hideAll() {
      cells.forEach((cell) => {
        cell.textContent = '';
        cell.removeAttribute('data-output');
        cell.removeAttribute('data-arrived');
        cell.classList.remove('cell--revealed', 'cell--superposed');
      });
    },

    setSuperposition(active) {
      grid.classList.toggle('quantum-superposition', active);
      cells.forEach((c) => c.classList.toggle('cell--superposed', active));
    },

    reset(newLength) {
      const targetLength = newLength ?? currentLength;
      buildGrid(targetLength);
      this.hideAll();
      grid.classList.remove('quantum-superposition');
      this.renderProgress({
        queryCount: 0,
        testedCount: 0,
        untestedCount: size,
        inputSpaceSize: size,
      });
    },
  };

  inputSpaceMap.renderProgress({ queryCount: 0, testedCount: 0, untestedCount: size, inputSpaceSize: size });
  return inputSpaceMap;
}
