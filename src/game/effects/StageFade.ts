import { MOTION } from '../config/designTokens';
import { prefersReducedMotion } from './motion';

/**
 * How one scene's interface gives way to the next: it fades out, the scene
 * changes while no interface is showing, and the new one fades in. The
 * laboratory on the canvas does not fade — it is the same room throughout,
 * and changes its light instead (see RoomScene). The fade itself is a CSS
 * opacity transition on the interface (`.stage__ui` in shell.css); this class
 * flips the state and waits for it to finish.
 */
export class StageFade {
  constructor(private readonly stage: HTMLElement) {}

  /** Starts fading the interface in. */
  fadeIn(): void {
    this.stage.dataset.visibility = 'visible';
  }

  /** Fades the interface out and resolves once it is fully hidden. */
  fadeOut(): Promise<void> {
    this.stage.dataset.visibility = 'hidden';
    const duration = prefersReducedMotion() ? 0 : MOTION.sceneFadeMs;
    return new Promise((resolve) => window.setTimeout(resolve, duration));
  }
}
