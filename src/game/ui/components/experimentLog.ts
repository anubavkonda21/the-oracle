import { formatCount, formatQueryId } from '../../../utils/format';
import type { OracleQuery } from '../../systems/oracle/GameOracle';
import { createElement, restartAnimation } from '../dom';
import { createPanel } from './panel';

export interface ExperimentLog {
  readonly element: HTMLElement;
  /** Appends an answered query to the record and brings it into view. */
  add(query: OracleQuery): void;
  /** Shows how many queries are left (or queries used). */
  renderCount(queriesLeft: number, queriesMax?: number): void;
  /** Updates the live tally of observed 0s and 1s. */
  updateTally(zeros: number, ones: number): void;
  /** Marks the entry for the input the player is composing — or none, if that input has not been tested. */
  setCurrent(query: OracleQuery | null): void;
  /** Brings an earlier entry into view and draws the eye to it. */
  recall(query: OracleQuery): void;
  /** Clears the log for a new box. */
  clear(): void;
}

export const QUERIES_USED_LEGACY = 'QUERIES USED';

/**
 * The record of the investigation: everything the player has asked the
 * machine and what it answered. Features a live tally bar (0s: X | 1s: Y)
 * and a countdown badge showing QUERIES LEFT.
 */
export function createExperimentLog(summary?: HTMLElement): ExperimentLog {
  const count = createElement('span', { className: 'log__count-value', text: formatCount(0) });
  const countLabel = createElement('span', { className: 'log__count-label', text: 'QUERIES LEFT' });
  const emptyNotice = createElement('p', { className: 'log__empty', text: 'NO QUERIES RECORDED' });
  const rows = createElement('tbody');
  /** The row of each entry, by query number. */
  const entries = new Map<number, HTMLTableRowElement>();

  // Live tally bar: 0s: X | 1s: Y
  const tallyZeros = createElement('span', { className: 'tally__count tally__zeros', text: '0s: 0' });
  const tallyDivider = createElement('span', { className: 'tally__divider', text: ' | ' });
  const tallyOnes = createElement('span', { className: 'tally__count tally__ones', text: '1s: 0' });
  const tallyMixedBadge = createElement('span', { className: 'tally__badge', text: 'MIXED' });
  tallyMixedBadge.style.display = 'none';

  const tallyBar = createElement('div', { className: 'log__tally-bar' }, [
    tallyZeros,
    tallyDivider,
    tallyOnes,
    tallyMixedBadge,
  ]);

  const table = createElement('table', { className: 'log__table' }, [
    createElement('thead', {}, [
      createElement('tr', {}, [
        createElement('th', { text: 'QUERY', attributes: { scope: 'col' } }),
        createElement('th', { text: 'INPUT', attributes: { scope: 'col' } }),
        createElement('th', { text: 'OUTPUT', attributes: { scope: 'col' } }),
      ]),
    ]),
    rows,
  ]);
  table.hidden = true;

  const scrollArea = createElement(
    'div',
    { className: 'log__scroll', attributes: { role: 'log', 'aria-label': 'Experiment log entries', tabindex: '0' } },
    [table],
  );

  const element = createPanel({
    heading: 'EXPERIMENT LOG',
    content: [
      createElement('p', { className: 'log__count' }, [countLabel, count]),
      tallyBar,
      ...(summary ? [summary] : []),
      emptyNotice,
      scrollArea,
    ],
  });
  element.classList.add('log');

  function bringIntoView(row: HTMLTableRowElement): void {
    const headingHeight = table.tHead?.offsetHeight ?? 0;
    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;

    if (rowTop < scrollArea.scrollTop + headingHeight) {
      scrollArea.scrollTop = rowTop - headingHeight;
    } else if (rowBottom > scrollArea.scrollTop + scrollArea.clientHeight) {
      scrollArea.scrollTop = rowBottom - scrollArea.clientHeight;
    }
  }

  return {
    element,

    add(query) {
      emptyNotice.remove();
      table.hidden = false;

      rows.querySelector('[data-latest]')?.removeAttribute('data-latest');
      const row = createElement('tr', { attributes: { 'data-latest': '' } }, [
        createElement('td', { text: formatQueryId(query.number) }),
        createElement('td', { text: query.input }),
        createElement('td', { text: String(query.output) }),
      ]);
      rows.append(row);
      entries.set(query.number, row);

      scrollArea.scrollTop = scrollArea.scrollHeight;
    },

    renderCount(queriesLeft: number) {
      count.textContent = formatCount(queriesLeft);
      countLabel.textContent = 'QUERIES LEFT';
      if (queriesLeft === 0) {
        count.classList.add('log__count--depleted');
      } else {
        count.classList.remove('log__count--depleted');
      }
    },

    updateTally(zeros: number, ones: number) {
      tallyZeros.textContent = `0s: ${zeros}`;
      tallyOnes.textContent = `1s: ${ones}`;

      if (zeros > 0 && ones > 0) {
        tallyBar.classList.add('log__tally-bar--mixed');
        tallyMixedBadge.style.display = 'inline-block';
      } else {
        tallyBar.classList.remove('log__tally-bar--mixed');
        tallyMixedBadge.style.display = 'none';
      }
    },

    setCurrent(query) {
      rows.querySelector('[aria-current]')?.removeAttribute('aria-current');
      if (query) {
        entries.get(query.number)?.setAttribute('aria-current', 'true');
      }
    },

    recall(query) {
      const row = entries.get(query.number);
      if (!row) {
        return;
      }
      bringIntoView(row);
      rows.querySelector('[data-recalled]')?.removeAttribute('data-recalled');
      restartAnimation(row, 'data-recalled');
    },

    clear() {
      rows.innerHTML = '';
      entries.clear();
      table.hidden = true;
      if (!element.contains(emptyNotice)) {
        scrollArea.before(emptyNotice);
      }
      this.updateTally(0, 0);
    },
  };
}
