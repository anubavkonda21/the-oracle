import Phaser from 'phaser';
import type { Bit } from '../../quantum';
import { TEXTURE_KEYS } from '../config/assetKeys';
import { colorNumber } from '../config/designTokens';
import { prefersReducedMotion } from '../effects/motion';
import { OBSERVATION_BOX, outcomeTextureKey } from './observationBoxTexture';

/**
 * THE BOX as it appears on the canvas: a sealed, matte container with a
 * shuttered opening and one status light. Like the machine, it only shows
 * what it is told — when to hold still, when to open, and which outcome to
 * reveal. The outcome itself is decided by the measurement in
 * systems/box/BoxExperiment.ts.
 */
export class ObservationBox extends Phaser.GameObjects.Container {
  private readonly shutter: Phaser.GameObjects.Image;
  private readonly outcomes: Record<Bit, Phaser.GameObjects.Image>;
  private readonly statusLight: Phaser.GameObjects.Arc;

  private standbyPulse: Phaser.Tweens.Tween | null = null;
  private shutterTween: Phaser.Tweens.Tween | null = null;

  /** Positioned by the centre of the box's body. */
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const { width, height, margin, window, statusLight } = OBSERVATION_BOX;

    const body = new Phaser.GameObjects.Image(scene, 0, 0, TEXTURE_KEYS.box);
    body.setDisplaySize(width + margin * 2, height + margin * 2);

    // Everything in the opening shares one position: the centre of the window, relative to the centre of the body.
    const windowX = window.x + window.width / 2 - width / 2;
    const windowY = window.y + window.height / 2 - height / 2;
    const inWindow = (key: string): Phaser.GameObjects.Image =>
      new Phaser.GameObjects.Image(scene, windowX, windowY, key).setDisplaySize(window.width, window.height);

    const interior = inWindow(TEXTURE_KEYS.boxInterior);
    this.outcomes = {
      0: inWindow(outcomeTextureKey(0)).setVisible(false),
      1: inWindow(outcomeTextureKey(1)).setVisible(false),
    };
    this.shutter = inWindow(TEXTURE_KEYS.boxShutter);

    this.statusLight = new Phaser.GameObjects.Arc(
      scene,
      statusLight.x - width / 2,
      statusLight.y - height / 2,
      statusLight.radius,
      0,
      360,
      false,
      colorNumber('signalRed'),
    );

    this.add([body, interior, this.outcomes[0], this.outcomes[1], this.shutter, this.statusLight]);
    this.setSize(width, height);
    scene.add.existing(this);

    this.seal();
  }

  /** Closed and untouched: the shutter is down, nothing is shown, the light idles. */
  seal(): void {
    this.stopShutter();
    this.outcomes[0].setVisible(false);
    this.outcomes[1].setVisible(false);
    this.setShutterCover(1);

    this.standbyPulse?.remove();
    this.standbyPulse = null;
    this.statusLight.setAlpha(1);
    if (!prefersReducedMotion()) {
      this.standbyPulse = this.scene.tweens.add({
        targets: this.statusLight,
        alpha: 0.35,
        duration: 2400,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    }
  }

  /** The moment before the measurement: everything stops, and the light burns steadily. */
  hold(): void {
    this.standbyPulse?.remove();
    this.standbyPulse = null;
    this.statusLight.setAlpha(1);
  }

  /** The shutter rises over `durationMs` to show the outcome that was measured. */
  open(outcome: Bit, durationMs: number): void {
    this.stopShutter();
    this.outcomes[0].setVisible(outcome === 0);
    this.outcomes[1].setVisible(outcome === 1);

    if (prefersReducedMotion() || durationMs <= 0) {
      this.setShutterCover(0);
      return;
    }
    this.shutterTween = this.scene.tweens.addCounter({
      from: 1,
      to: 0,
      duration: durationMs,
      ease: 'Cubic.easeInOut',
      onUpdate: (tween) => this.setShutterCover(tween.getValue() ?? 0),
    });
  }

  /**
   * Puts the box in its fully open state at once. The scene calls this when
   * the opening time has elapsed on the real clock, so the box is guaranteed
   * to be open by then even if frames were dropped and the animation is behind.
   */
  settleOpen(): void {
    this.stopShutter();
    this.setShutterCover(0);
  }

  private stopShutter(): void {
    this.shutterTween?.remove();
    this.shutterTween = null;
  }

  /** How much of the opening the shutter still covers: 1 is closed, 0 fully raised. It retracts upward. */
  private setShutterCover(fraction: number): void {
    const { width, height } = this.shutter.frame;
    this.shutter.setVisible(fraction > 0);
    this.shutter.setCrop(0, 0, width, height * fraction);
  }
}
