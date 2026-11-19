import {
  createConstantFunction,
  createRandomBalancedFunction,
  type Bit,
  type BooleanFunction,
} from '../../quantum/booleanFunction';
import { runDeutschJozsa, type DeutschJozsaResult } from '../../quantum/deutschJozsa';
import { createOracle, type QuantumOracle } from '../../quantum/oracle';
import { GameOracle, type OracleQuery } from './oracle/GameOracle';
import { ORACLE_KINDS, type OracleKind } from './oracle/oracleKind';

export type OracleClassificationType = OracleKind;

export interface GeneratedOracle {
  readonly bits: number;
  readonly type: OracleClassificationType;
  readonly booleanFunction: BooleanFunction;
}

export interface QuantumProbeResult {
  readonly isZeroDetectorLit: boolean;
  readonly measuredLabel: string;
  readonly measuredInput: number;
  readonly detectorStatus: string;
  readonly rawResult: DeutschJozsaResult;
}

/**
 * Generates an Oracle with mathematical guarantee:
 * - Constant: 100% identical outputs (all 0s or all 1s) across all 2^bits inputs.
 * - Balanced: exactly 2^(bits - 1) zeros and 2^(bits - 1) ones across all 2^bits inputs.
 */
export function generateOracle(
  bits: number,
  type: OracleClassificationType,
  random: () => number = Math.random,
): GeneratedOracle {
  if (bits < 1 || bits > 12) {
    throw new RangeError(`Bits must be between 1 and 12; received ${bits}`);
  }

  if (type === ORACLE_KINDS[0]) {
    const value: Bit = random() >= 0.5 ? 1 : 0;
    return {
      bits,
      type: ORACLE_KINDS[0],
      booleanFunction: createConstantFunction(bits, value),
    };
  }

  return {
    bits,
    type: ORACLE_KINDS[1],
    booleanFunction: createRandomBalancedFunction(bits, random),
  };
}

/**
 * Executes a simulated Quantum Probe on an Oracle black-box using the Deutsch–Jozsa circuit.
 * - Constant: 000...0 detector circle is LIT (probability 1.0).
 * - Balanced: 000...0 detector circle CANCELLED to 0% (probability 0.0), scattering into a non-zero state.
 */
export function runQuantumProbe(
  oracleOrFn: QuantumOracle | BooleanFunction,
  random: () => number = Math.random,
): QuantumProbeResult {
  const oracle = 'applyTo' in oracleOrFn ? oracleOrFn : createOracle(oracleOrFn);
  const result = runDeutschJozsa(oracle, random);

  const isZero = result.measuredInput === 0;
  const zeroLabel = '0'.repeat(result.inputQubitCount);

  return {
    isZeroDetectorLit: isZero,
    measuredLabel: result.measuredLabel,
    measuredInput: result.measuredInput,
    detectorStatus: isZero
      ? `${zeroLabel} DETECTOR: LIT`
      : `${zeroLabel} DETECTOR: CANCELLED (SCATTER: ${result.measuredLabel})`,
    rawResult: result,
  };
}

export interface LevelConfig {
  readonly levelNumber: number | 'endless';
  readonly name: string;
  readonly bits: number;
  readonly queryBudget: number;
  readonly quantumBudget: number;
  readonly targetStreak: number;
  readonly timeLimitSeconds?: number;
  readonly description: string;
}

export const LEVEL_CONFIGS: Record<number, LevelConfig> = {
  1: {
    levelNumber: 1,
    name: 'LEVEL 1: FOUNDATION',
    bits: 2,
    queryBudget: 3,
    quantumBudget: 0,
    targetStreak: 2,
    description: 'Classify 2 consecutive boxes within 3 queries.',
  },
  2: {
    levelNumber: 2,
    name: 'LEVEL 2: UNCERTAINTY',
    bits: 4,
    queryBudget: 5,
    quantumBudget: 0,
    targetStreak: 2,
    description: 'Classify 2 consecutive boxes within 5 queries.',
  },
  3: {
    levelNumber: 3,
    name: 'LEVEL 3: THE SCALE',
    bits: 6,
    queryBudget: 8,
    quantumBudget: 0,
    targetStreak: 1,
    description: '64 possible inputs. Classical budget exhausted.',
  },
  4: {
    levelNumber: 4,
    name: 'LEVEL 4: QUANTUM PROBE',
    bits: 6,
    queryBudget: 8,
    quantumBudget: 1,
    targetStreak: 3,
    description: 'Classify 3 consecutive boxes using the quantum probe.',
  },
  5: {
    levelNumber: 5,
    name: 'LEVEL 5: THE GAUNTLET',
    bits: 6,
    queryBudget: 8,
    quantumBudget: 1,
    targetStreak: 5,
    timeLimitSeconds: 15,
    description: '15 seconds per box. 1 life. 5 consecutive boxes.',
  },
};

export const ENDLESS_LEVEL_CONFIG: LevelConfig = {
  levelNumber: 'endless',
  name: 'ENDLESS SANDBOX',
  bits: 6,
  queryBudget: 8,
  quantumBudget: 1,
  targetStreak: Infinity,
  description: 'Infinite stream of mystery Oracles with classical and quantum tools.',
};

export interface BoxState {
  readonly oracle: GeneratedOracle;
  readonly gameOracle: GameOracle;
  readonly queriesMax: number;
  queriesLeft: number;
  quantumQueriesLeft: number;
  history: OracleQuery[];
  tally: { zeros: number; ones: number };
  quantumProbeResult: QuantumProbeResult | null;
  timeRemaining: number | null;
  isResolved: boolean;
}

export interface ClassificationOutcome {
  readonly correct: boolean;
  readonly guess: OracleClassificationType;
  readonly trueType: OracleClassificationType;
  readonly levelAdvanced: boolean;
  readonly levelCompleted: boolean;
  readonly nextLevel: number | 'endless';
  readonly streak: number;
  readonly highestEndlessStreak: number;
  readonly fullGridMap?: Bit[];
}

/**
 * Deterministic Game State Machine driving the 5-level progression + Endless mode.
 */
export class GameStateMachine {
  private currentLevelNumber: number | 'endless' = 1;
  private currentStreak = 0;
  private maxEndlessStreak = 0;
  private currentBoxState!: BoxState;
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
    this.startLevel(1);
  }

  get levelNumber(): number | 'endless' {
    return this.currentLevelNumber;
  }

  get config(): LevelConfig {
    if (this.currentLevelNumber === 'endless') {
      return ENDLESS_LEVEL_CONFIG;
    }
    return (LEVEL_CONFIGS[this.currentLevelNumber] ?? LEVEL_CONFIGS[1]) as LevelConfig;
  }

  get streak(): number {
    return this.currentStreak;
  }

  get targetStreak(): number {
    return this.config.targetStreak;
  }

  get highestEndlessStreak(): number {
    return this.maxEndlessStreak;
  }

  get box(): BoxState {
    return this.currentBoxState;
  }

  get canAskClassical(): boolean {
    return !this.currentBoxState.isResolved && this.currentBoxState.queriesLeft > 0;
  }

  get canFireQuantum(): boolean {
    return (
      !this.currentBoxState.isResolved &&
      this.config.quantumBudget > 0 &&
      this.currentBoxState.quantumQueriesLeft > 0
    );
  }

  startLevel(level: number | 'endless'): void {
    this.currentLevelNumber = level;
    this.currentStreak = 0;
    this.nextBox();
  }

  nextBox(): BoxState {
    const cfg = this.config;
    const chosenType: OracleClassificationType = this.random() >= 0.5 ? ORACLE_KINDS[0] : ORACLE_KINDS[1];
    const oracle = generateOracle(cfg.bits, chosenType, this.random);
    const gameOracle = new GameOracle(oracle.booleanFunction);

    this.currentBoxState = {
      oracle,
      gameOracle,
      queriesMax: cfg.queryBudget,
      queriesLeft: cfg.queryBudget,
      quantumQueriesLeft: cfg.quantumBudget,
      history: [],
      tally: { zeros: 0, ones: 0 },
      quantumProbeResult: null,
      timeRemaining: cfg.timeLimitSeconds ?? null,
      isResolved: false,
    };

    return this.currentBoxState;
  }

  recordQuery(query: OracleQuery): { queriesLeft: number; tally: { zeros: number; ones: number } } {
    if (this.currentBoxState.isResolved) {
      throw new Error('This box is already classified.');
    }
    if (this.currentBoxState.queriesLeft <= 0) {
      throw new Error('No classical queries left for this box.');
    }

    this.currentBoxState.queriesLeft -= 1;
    this.currentBoxState.history.push(query);

    if (query.output === 0) {
      this.currentBoxState.tally.zeros += 1;
    } else {
      this.currentBoxState.tally.ones += 1;
    }

    return {
      queriesLeft: this.currentBoxState.queriesLeft,
      tally: { ...this.currentBoxState.tally },
    };
  }

  queryClassical(input: string): { query: OracleQuery; queriesLeft: number; tally: { zeros: number; ones: number } } {
    const paddedInput = input.padStart(this.currentBoxState.oracle.bits, '0');
    const query = this.currentBoxState.gameOracle.query(paddedInput);
    const { queriesLeft, tally } = this.recordQuery(query);

    return {
      query,
      queriesLeft,
      tally,
    };
  }

  fireQuantumProbe(): QuantumProbeResult {
    if (this.currentBoxState.isResolved) {
      throw new Error('This box is already classified.');
    }
    if (!this.canFireQuantum) {
      throw new Error('Quantum probe unavailable or query budget exhausted.');
    }

    const result = runQuantumProbe(this.currentBoxState.oracle.booleanFunction, this.random);
    this.currentBoxState.quantumQueriesLeft -= 1;
    this.currentBoxState.quantumProbeResult = result;
    return result;
  }

  classify(guess: OracleClassificationType): ClassificationOutcome {
    if (this.currentBoxState.isResolved) {
      throw new Error('This box is already classified.');
    }

    this.currentBoxState.isResolved = true;
    const isCorrect = guess === this.currentBoxState.oracle.type;

    if (isCorrect) {
      this.currentStreak += 1;

      if (this.currentLevelNumber === 'endless') {
        if (this.currentStreak > this.maxEndlessStreak) {
          this.maxEndlessStreak = this.currentStreak;
        }
        return {
          correct: true,
          guess,
          trueType: this.currentBoxState.oracle.type,
          levelAdvanced: false,
          levelCompleted: false,
          nextLevel: 'endless',
          streak: this.currentStreak,
          highestEndlessStreak: this.maxEndlessStreak,
        };
      }

      const completed = this.currentStreak >= this.config.targetStreak;
      let nextLevel: number | 'endless' = this.currentLevelNumber;

      if (completed) {
        if (typeof this.currentLevelNumber === 'number') {
          if (this.currentLevelNumber < 5) {
            nextLevel = this.currentLevelNumber + 1;
          } else {
            nextLevel = 'endless';
          }
        }
      }

      return {
        correct: true,
        guess,
        trueType: this.currentBoxState.oracle.type,
        levelAdvanced: completed,
        levelCompleted: completed,
        nextLevel,
        streak: this.currentStreak,
        highestEndlessStreak: this.maxEndlessStreak,
      };
    }

    this.currentStreak = 0;

    const size = 2 ** this.currentBoxState.oracle.bits;
    const fullGridMap: Bit[] = [];
    const oracleCopy = new GameOracle(this.currentBoxState.oracle.booleanFunction);
    for (let i = 0; i < size; i++) {
      const bitStr = i.toString(2).padStart(this.currentBoxState.oracle.bits, '0');
      fullGridMap.push(oracleCopy.query(bitStr).output);
    }

    return {
      correct: false,
      guess,
      trueType: this.currentBoxState.oracle.type,
      levelAdvanced: false,
      levelCompleted: false,
      nextLevel: this.currentLevelNumber,
      streak: 0,
      highestEndlessStreak: this.maxEndlessStreak,
      fullGridMap,
    };
  }

  handleTimeout(): ClassificationOutcome {
    const oppositeGuess: OracleClassificationType =
      this.currentBoxState.oracle.type === ORACLE_KINDS[0] ? ORACLE_KINDS[1] : ORACLE_KINDS[0];
    return this.classify(oppositeGuess);
  }
}
