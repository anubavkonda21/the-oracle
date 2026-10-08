/** Keys of textures held by Phaser's texture manager. All are created or loaded by PreloadScene. */
export const TEXTURE_KEYS = {
  /** The machine as it stands unlit. */
  oracleMachine: 'oracle-machine',
  /** The same machine as the eye's own light catches it — laid over the body, as bright as the eye is. */
  oracleMachineLight: 'oracle-machine-light',
  /** Every light and moving piece of the machine, one frame each. */
  oracleMachineParts: 'oracle-machine-parts',
  /** The laboratory, painted with every light on. */
  room: 'room',
  /** Where each source's light falls in the room: the work light, the room's general light, and the machine's own. */
  roomKeyLight: 'room-light-key',
  roomFillLight: 'room-light-fill',
  roomSpillLight: 'room-light-spill',
  /** The cone of the work light in the air. */
  roomHaze: 'room-haze',
  /** Out-of-focus shapes at the edges of the picture, and its fade into the page. */
  roomFrame: 'room-frame',
  /** What glows by itself in the room — light fittings and screens — one frame each. */
  roomParts: 'room-parts',
} as const;
