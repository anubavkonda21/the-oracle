/**
 * The laboratory's lighting, as plain numbers.
 *
 * The room is lit by a handful of sources, each with a level between 0 and 1.
 * A lighting state — the room dormant, at work, in Quantum Mode — is a set of
 * levels for all of them, and the rig moves from one set to the next over a
 * second or so, each source in its own time. Nothing here draws anything: the
 * room scene reads the levels every frame and applies them (see RoomScene).
 *
 * What the light says:
 *
 *   dormant     the room is dark and waiting. Standby lamps only.
 *   classical   clean, even work light. The machine is being questioned.
 *   constraint  the same work light, drawn in a little — and the cooling line
 *               that serves the machine's resonators has come on.
 *   quantum     the work light is out. What light there is comes from the
 *               machine, and it is a light the room has not shown before.
 *   revealed    every light in the room is up: something has been found out.
 *   power-down  the lights go out, the work light first. It ends in the dark.
 *
 * `working` is not a state of its own but something the machine does within
 * one: the room's general light drops away and the light on the machine
 * holds, for as long as the machine is busy.
 */

export type LightingState = 'dormant' | 'classical' | 'constraint' | 'quantum' | 'revealed' | 'power-down';

export const LIGHTING_STATES: readonly LightingState[] = ['dormant', 'classical', 'constraint', 'quantum', 'revealed', 'power-down'];

export interface LightLevels {
  /** Light with no source: what is left when everything is off. It keeps the room from going blacker than the page. */
  ambient: number;
  /** The work light over the machine. */
  key: number;
  /** The room's general lighting. */
  fill: number;
  /** Air made visible in the work light. */
  haze: number;
  /** Indicator lamps that never go out. */
  standby: number;
  /** Indicators and screens of equipment that is in use. */
  active: number;
  /** The cooling and control line that serves the machine's resonators. */
  subsystem: number;
  /** How far the room's own indicators have turned to the quantum light (0 = not at all). */
  quantum: number;
  /** How much of the room's light falls on the body of the machine. */
  onMachine: number;
  /** How far the machine's own light carries into the room. Above 1 it carries further than the machine alone would throw it. */
  spill: number;
  /** How busy the equipment's activity lamps are: 0 is a slow tick, 1 a flurry. */
  activity: number;
}

export type LightChannel = keyof LightLevels;

export const LIGHT_CHANNELS: readonly LightChannel[] = [
  'ambient',
  'key',
  'fill',
  'haze',
  'standby',
  'active',
  'subsystem',
  'quantum',
  'onMachine',
  'spill',
  'activity',
];

export const LIGHT_PRESETS: Readonly<Record<LightingState, Readonly<LightLevels>>> = {
  dormant: { ambient: 0.2, key: 0, fill: 0.05, haze: 0, standby: 0.7, active: 0, subsystem: 0, quantum: 0, onMachine: 0.3, spill: 0.6, activity: 0 },
  classical: { ambient: 0.22, key: 0.8, fill: 0.44, haze: 0.5, standby: 1, active: 1, subsystem: 0, quantum: 0, onMachine: 1, spill: 0.55, activity: 0.2 },
  constraint: { ambient: 0.21, key: 0.74, fill: 0.3, haze: 0.58, standby: 1, active: 1, subsystem: 1, quantum: 0, onMachine: 0.95, spill: 0.6, activity: 0.3 },
  quantum: { ambient: 0.17, key: 0.03, fill: 0.03, haze: 0.08, standby: 0.8, active: 0.25, subsystem: 1, quantum: 1, onMachine: 0.34, spill: 1.6, activity: 0.5 },
  revealed: { ambient: 0.24, key: 1, fill: 0.9, haze: 0.6, standby: 1, active: 1, subsystem: 1, quantum: 0, onMachine: 1, spill: 0.4, activity: 0.1 },
  'power-down': { ambient: 0.19, key: 0, fill: 0.03, haze: 0, standby: 0.5, active: 0, subsystem: 0, quantum: 0, onMachine: 0.26, spill: 0.5, activity: 0 },
};

/**
 * The room while the machine is working on a question: its general light
 * drops away, the light on the machine holds and thickens, and every activity
 * lamp in the room goes at once. Whatever else the state had on stays on.
 */
export function whileWorking(levels: Readonly<LightLevels>): LightLevels {
  return {
    ...levels,
    key: Math.min(1, levels.key * 1.12),
    fill: levels.fill * 0.3,
    haze: Math.min(1, levels.haze + 0.14),
    activity: 1,
  };
}

/** The levels a state calls for, with the machine working or not. */
export function levelsFor(state: LightingState, working = false): LightLevels {
  const preset = LIGHT_PRESETS[state];
  return working ? whileWorking(preset) : { ...preset };
}

/** When one source starts to change after a change of state, and how long it takes, in milliseconds. */
export interface Timing {
  readonly delay: number;
  readonly duration: number;
}

const together = (delay: number, duration: number): Record<LightChannel, Timing> => {
  const timing = {} as Record<LightChannel, Timing>;
  for (const channel of LIGHT_CHANNELS) {
    timing[channel] = { delay, duration };
  }
  return timing;
};

/**
 * How the room gets to a state: which lights move first, and how fast. The
 * order is what makes a change read as something happening in a real room —
 * lamps coming on bank by bank, or the work light dying before the rest.
 */
export function timingFor(to: LightingState): Record<LightChannel, Timing> {
  switch (to) {
    case 'classical':
    case 'constraint':
      // The indicators wake, the room's light comes up, and the work light strikes last.
      return {
        ...together(0, 700),
        standby: { delay: 0, duration: 300 },
        active: { delay: 120, duration: 500 },
        subsystem: { delay: 300, duration: 900 },
        fill: { delay: 100, duration: 800 },
        key: { delay: 380, duration: 900 },
        haze: { delay: 500, duration: 1100 },
        onMachine: { delay: 300, duration: 900 },
      };
    case 'quantum':
      // The work light goes first and the room follows it down. The machine's own light is what is left.
      return {
        ...together(0, 1100),
        key: { delay: 0, duration: 800 },
        fill: { delay: 200, duration: 1300 },
        haze: { delay: 0, duration: 900 },
        active: { delay: 300, duration: 900 },
        quantum: { delay: 500, duration: 1200 },
        spill: { delay: 400, duration: 1000 },
        onMachine: { delay: 100, duration: 1100 },
      };
    case 'revealed':
      // Everything comes up, steadily — nothing snaps.
      return {
        ...together(0, 1100),
        quantum: { delay: 0, duration: 700 },
        fill: { delay: 0, duration: 1100 },
        key: { delay: 180, duration: 1300 },
        haze: { delay: 300, duration: 1400 },
      };
    case 'power-down':
      // The work light, then the room, then the lamps on the equipment, one bank after another.
      return {
        ...together(0, 900),
        key: { delay: 0, duration: 600 },
        haze: { delay: 0, duration: 700 },
        fill: { delay: 550, duration: 1300 },
        onMachine: { delay: 400, duration: 1300 },
        active: { delay: 1300, duration: 600 },
        subsystem: { delay: 1700, duration: 600 },
        standby: { delay: 2000, duration: 800 },
        ambient: { delay: 600, duration: 1600 },
      };
    case 'dormant':
      return together(0, 900);
  }
}

/** The machine setting to work is felt at once; coming back from it is a breath slower. */
const WORK_BEGINS: Timing = { delay: 0, duration: 180 };
const WORK_ENDS: Timing = { delay: 0, duration: 420 };

export interface LightRig {
  state: LightingState;
  working: boolean;
  /** Where every source stood when the last change began, where it is going, and the timing of the way there. */
  from: LightLevels;
  to: LightLevels;
  timing: Record<LightChannel, Timing>;
  changedAt: number;
}

/** A rig standing in a state, with nothing in motion. */
export function createLightRig(state: LightingState): LightRig {
  return {
    state,
    working: false,
    from: levelsFor(state),
    to: levelsFor(state),
    timing: together(0, 0),
    changedAt: Number.NEGATIVE_INFINITY,
  };
}

const smooth = (t: number): number => {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
};

/**
 * Every source's level at the moment `now`. With `still` set — reduced motion
 * — a change of state is simply there: the room does not animate into it.
 */
export function levelsAt(rig: LightRig, now: number, still = false): LightLevels {
  const levels = { ...rig.to };
  if (still) {
    return levels;
  }
  const elapsed = now - rig.changedAt;
  for (const channel of LIGHT_CHANNELS) {
    const { delay, duration } = rig.timing[channel];
    const progress = duration <= 0 ? (elapsed >= delay ? 1 : 0) : smooth((elapsed - delay) / duration);
    // Once a light has arrived it is exactly where it was going, not a rounding error away from it.
    levels[channel] = progress >= 1 ? rig.to[channel] : rig.from[channel] + (rig.to[channel] - rig.from[channel]) * progress;
  }
  return levels;
}

function retarget(rig: LightRig, now: number, timing: Record<LightChannel, Timing>, still: boolean): void {
  // A change that arrives mid-way starts from wherever the lights have got to — never from where they were headed.
  rig.from = levelsAt(rig, now, still);
  rig.to = levelsFor(rig.state, rig.working);
  rig.timing = timing;
  rig.changedAt = now;
}

/** Moves the room to a lighting state. Asking for the state it is already in changes nothing. */
export function setLighting(rig: LightRig, state: LightingState, now: number, still = false): void {
  if (state === rig.state) {
    return;
  }
  rig.state = state;
  retarget(rig, now, timingFor(state), still);
}

/** The machine has set to work, or has finished. */
export function setWorking(rig: LightRig, working: boolean, now: number, still = false): void {
  if (working === rig.working) {
    return;
  }
  rig.working = working;
  retarget(rig, now, together(0, 0), still);
  const pace = working ? WORK_BEGINS : WORK_ENDS;
  for (const channel of LIGHT_CHANNELS) {
    rig.timing[channel] = pace;
  }
}

/** True while any light is still on its way to where it is going. */
export function isSettling(rig: LightRig, now: number): boolean {
  const elapsed = now - rig.changedAt;
  return LIGHT_CHANNELS.some((channel) => {
    const { delay, duration } = rig.timing[channel];
    return rig.from[channel] !== rig.to[channel] && elapsed < delay + duration;
  });
}
