/**
 * What the player has done since the page was opened. It lives in memory
 * only: nothing is saved, and a reload starts a new session. (A real save
 * system is a later checkpoint.)
 */
export class GameSession {
  #boxObservations = 0;

  /** True once the player has observed THE BOX at least once in this session. */
  get hasObservedBox(): boolean {
    return this.#boxObservations > 0;
  }

  /** How many times the player has observed THE BOX in this session. */
  get boxObservationCount(): number {
    return this.#boxObservations;
  }

  recordBoxObservation(): void {
    this.#boxObservations += 1;
  }
}
