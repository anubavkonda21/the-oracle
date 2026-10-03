import { describe, expect, it } from 'vitest';
import { BOX_TIMING } from '../../src/game/config/boxConfig';
import { GameSession } from '../../src/game/systems/GameSession';

/** Source text of the game's files, for checking that nothing is written to storage. */
const gameSources = import.meta.glob<string>('../../src/game/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('GameSession', () => {
  it('starts with THE BOX not yet observed', () => {
    const session = new GameSession();
    expect(session.hasObservedBox).toBe(false);
    expect(session.boxObservationCount).toBe(0);
  });

  it('remembers that THE BOX has been observed', () => {
    const session = new GameSession();
    session.recordBoxObservation();

    expect(session.hasObservedBox).toBe(true);
    expect(session.boxObservationCount).toBe(1);
  });

  it('counts each observation, and stays "observed" however many there are', () => {
    const session = new GameSession();
    for (let observation = 0; observation < 5; observation += 1) {
      session.recordBoxObservation();
    }
    expect(session.boxObservationCount).toBe(5);
    expect(session.hasObservedBox).toBe(true);
  });

  it('cannot have its record overwritten from outside', () => {
    const session = new GameSession();
    session.recordBoxObservation();

    expect(() => {
      (session as unknown as { hasObservedBox: boolean }).hasObservedBox = false;
    }).toThrow(TypeError);
    expect(session.hasObservedBox).toBe(true);
    expect(Object.keys(session)).toEqual([]);
  });

  it('belongs to one session only: a new session starts clean', () => {
    const first = new GameSession();
    first.recordBoxObservation();
    expect(new GameSession().hasObservedBox).toBe(false);
  });

  it('is kept in memory, not in the browser’s storage', () => {
    const usesStorage = Object.entries(gameSources)
      .filter(([, source]) => /localStorage|sessionStorage|indexedDB|document\.cookie/.test(source))
      .map(([path]) => path);
    expect(usesStorage).toEqual([]);
  });
});

describe('THE BOX: timing', () => {
  it('holds for a moment before the measurement, then opens — consequential, but not drawn out', () => {
    expect(BOX_TIMING.holdMs).toBeGreaterThanOrEqual(600);
    expect(BOX_TIMING.holdMs).toBeLessThanOrEqual(1500);
    expect(BOX_TIMING.openMs).toBeGreaterThanOrEqual(600);
    expect(BOX_TIMING.openMs).toBeLessThanOrEqual(1500);
  });

  it('is quicker, but still perceptible, when motion is reduced', () => {
    expect(BOX_TIMING.reducedMotionHoldMs).toBeLessThan(BOX_TIMING.holdMs);
    expect(BOX_TIMING.reducedMotionOpenMs).toBeLessThan(BOX_TIMING.openMs);
    expect(BOX_TIMING.reducedMotionHoldMs + BOX_TIMING.reducedMotionOpenMs).toBeGreaterThanOrEqual(400);
  });
});
