/** Keys of textures held by Phaser's texture manager. All are created or loaded by PreloadScene. */
export const TEXTURE_KEYS = {
  /** The machine as it stands unlit. */
  oracleMachine: 'oracle-machine',
  /** The same machine as the eye's own light catches it — laid over the body, as bright as the eye is. */
  oracleMachineLight: 'oracle-machine-light',
  /** Every light and moving piece of the machine, one frame each. */
  oracleMachineParts: 'oracle-machine-parts',
  /** The dark behind the machine. */
  backdrop: 'backdrop',
} as const;
