import { MOTION } from '../config/designTokens';
import { prefersReducedMotion } from './motion';

/**
 * The game's only scene transition: the whole stage (canvas and interface
 * together) fades out, the scene changes while nothing is visible, and the
 * stage fades back in. The fade itself is a CSS opacity transition on
 * `.stage` (shell.css); this class flips the state and waits for it to finish.
 */
export class StageFade {
  constructor(private readonly stage: HTMLElement) {}

  /** Starts fading the stage in. */
  fadeIn(): void {
    this.stage.dataset.visibility = 'visible';
  }

  /** Fades the stage out and resolves once it is fully hidden. */
  fadeOut(): Promise<void> {
    this.stage.dataset.visibility = 'hidden';
    const duration = prefersReducedMotion() ? 0 : MOTION.sceneFadeMs;
    return new Promise((resolve) => window.setTimeout(resolve, duration));
  }
}
