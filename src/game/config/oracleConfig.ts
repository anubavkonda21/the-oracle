/** Number of bits in the input the player gives the machine. */
export const ORACLE_INPUT_LENGTH = 6;

/** Vertical centre of the machine in the 1440 × 900 design frame: above the middle, leaving room for the input console. */
export const MACHINE_CENTER_Y = 340;

export const ORACLE_TIMING = {
  /** How long the machine visibly works on a query before it answers. */
  processingMs: 1100,
  /** The same wait when the player has asked for reduced motion: long enough to register, with nothing animated. */
  reducedMotionProcessingMs: 350,
  /** One contraction of the ring in the machine's aperture. Two fit inside the processing time. */
  irisPulseMs: 500,
  /** Fade-in of the answer in the aperture. */
  revealMs: 180,
} as const;
