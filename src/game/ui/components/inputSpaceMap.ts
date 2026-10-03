import { formatCount } from '../../../utils/format';
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
}

/**
 * A picture of everything the machine could be asked (styles: `.input-space`
 * in oracle.css): one cell for every possible input, in counting order from
 * the first input at the top left to the last at the bottom right. A cell is
 * empty until its input has been tested, and from then on shows the answer.
 * One cell carries a marker: the input the player is composing.
 *
 * Like the bit input, it holds no state of its own and draws what it is told.
 * It is a picture rather than a control — nothing in it takes focus — and
 * everything it shows is also in the experiment log, as text.
 *
 * It draws the space cell by cell, which suits the prototype's six bits (64
 * cells). A much longer input would need a different picture.
 */
export function createInputSpaceMap(inputLength: number): InputSpaceMap {
  const copy = INVESTIGATION_COPY.inputSpace;
  const size = inputSpaceSize(inputLength);
  const { columns } = inputSpaceLayout(inputLength);

  const cells = Array.from({ length: size }, () => createElement('span', { className: 'input-space__cell' }));
  const grid = createElement('div', { className: 'input-space__grid' }, cells);
  grid.style.setProperty('--columns', String(columns));

  // To assistive technology this is one picture with a description in words (see `renderProgress`), not 64 separate cells.
  const map = createElement('div', { className: 'input-space__map', attributes: { role: 'img' } }, [
    createElement('span', { className: 'input-space__end', text: inputAt(0, inputLength) }),
    grid,
    createElement('span', { className: 'input-space__end input-space__end--last', text: inputAt(size - 1, inputLength) }),
  ]);

  const tested = createElement('span');
  const untested = createElement('span');

  const element = createPanel({
    heading: copy.heading,
    content: [
      createElement('p', { className: 'input-space__summary' }, [
        createElement('span', { text: copy.bits(inputLength) }),
        createElement('span', { text: copy.possibleInputs(size) }),
      ]),
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
      const cell = cells[inputIndex(query.input)];
      if (!cell) {
        return;
      }
      // The digit is printed as well as shown by the fill, so the answer never depends on telling light from dark.
      cell.textContent = String(query.output);
      cell.dataset.output = String(query.output);
      cell.toggleAttribute('data-arrived', animate);
    },

    setCursor(input) {
      grid.querySelector('[data-cursor]')?.removeAttribute('data-cursor');
      cells[inputIndex(input)]?.setAttribute('data-cursor', '');
    },

    renderProgress(progress) {
      tested.textContent = formatCount(progress.testedCount);
      untested.textContent = formatCount(progress.untestedCount);
      map.setAttribute('aria-label', copy.description(progress));
    },
  };

  inputSpaceMap.renderProgress({ queryCount: 0, testedCount: 0, untestedCount: size, inputSpaceSize: size });
  return inputSpaceMap;
}
