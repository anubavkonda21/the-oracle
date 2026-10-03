import { Gates, QuantumState, type Bit, type RandomSource } from '../../../quantum';

/**
 * Where the experiment stands.
 *
 *   sealed    — prepared and untouched; nothing has been measured
 *   observing — the player has chosen to observe; the measurement is about to happen
 *   observed  — measured; there is one definite outcome
 */
export type BoxPhase = 'sealed' | 'observing' | 'observed';

/** A fresh, unmeasured system: (|0⟩ + |1⟩)/√2, made by a Hadamard gate on |0⟩. */
function prepareSuperposition(): QuantumState {
  return QuantumState.basis(1, 0).applyGate(Gates.H, 0);
}

/**
 * The logic of THE BOX: one qubit, prepared in an equal superposition and
 * measured once, when the player observes.
 *
 * Nothing here is staged. The state is a real state vector from the quantum
 * engine, and the outcome comes from that engine's own measurement — it is not
 * drawn from a random number and attached to a picture, and the two outcomes
 * are never ordered or weighted for effect. Before `measure()` the state
 * really is the superposition; afterwards it really has collapsed.
 *
 * The cat is only how the result is pictured. This class models a single
 * qubit, not an animal: Schrödinger's cat is a thought experiment about what
 * goes wrong when quantum rules are stretched to everyday objects.
 */
export class BoxExperiment {
  #state = prepareSuperposition();
  #phase: BoxPhase = 'sealed';
  #outcome: Bit | null = null;
  readonly #random: RandomSource | undefined;

  /** `random` is for tests and replays only; left out, the engine's measurement uses its own randomness. */
  constructor(random?: RandomSource) {
    this.#random = random;
  }

  get phase(): BoxPhase {
    return this.#phase;
  }

  /** The measured outcome, or `null` while nothing has been measured. */
  get outcome(): Bit | null {
    return this.#outcome;
  }

  /** A copy of the current state vector, for inspection. Looking at the copy does not measure anything. */
  get state(): QuantumState {
    return this.#state.clone();
  }

  /** The probability of each outcome if the box were measured now: [P(0), P(1)]. */
  get probabilities(): number[] {
    return this.#state.getProbabilities();
  }

  /**
   * The player has chosen to observe. Returns `false`, and changes nothing,
   * unless the box is sealed — so a second request while one observation is
   * under way, or after it has finished, is refused.
   */
  beginObservation(): boolean {
    if (this.#phase !== 'sealed') {
      return false;
    }
    this.#phase = 'observing';
    return true;
  }

  /** Performs the measurement. The state collapses onto the outcome that is returned. */
  measure(): Bit {
    const current = this.#phase;
    if (current !== 'observing') {
      throw new Error(`The box can only be measured while it is being observed; it is ${current}.`);
    }
    this.#outcome = this.#state.measure(this.#random) === 1 ? 1 : 0;
    this.#phase = 'observed';
    return this.#outcome;
  }

  /** Seals a newly prepared box, discarding whatever happened to the last one. */
  reset(): void {
    this.#state = prepareSuperposition();
    this.#phase = 'sealed';
    this.#outcome = null;
  }
}
