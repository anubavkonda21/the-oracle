import Phaser from 'phaser';
import type { Bit } from '../../quantum';
import { TEXTURE_KEYS } from '../config/assetKeys';
import { COLORS, FONT_STACKS, colorNumber } from '../config/designTokens';
import { DESIGN_WIDTH } from '../config/display';
import { ORACLE_TIMING } from '../config/oracleConfig';
import { prefersReducedMotion } from '../effects/motion';
import { ORACLE_MACHINE } from './oracleMachineTexture';

/** Height of the answer digit shown in the aperture, in design units. */
const ANSWER_FONT_SIZE = 40;

/**
 * The machine as it appears in the laboratory: a matte black body, one
 * aperture, one status light. It only LOOKS the part — it shows that it is
 * working and shows an answer it is handed. What the answer is gets decided
 * elsewhere (see systems/oracle/GameOracle.ts).
 */
export class OracleMachine extends Phaser.GameObjects.Container {
  private readonly statusLight: Phaser.GameObjects.Arc;
  /** A thin ring that contracts inside the aperture while the machine is working. */
  private readonly irisRing: Phaser.GameObjects.Arc;
  private readonly answer: Phaser.GameObjects.Text;

  private standbyPulse: Phaser.Tweens.Tween | null = null;
  private workingTweens: Phaser.Tweens.Tween[] = [];

  /** Positioned by the centre of the machine's body. */
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const { width, height, margin, statusLight } = ORACLE_MACHINE;

    const body = new Phaser.GameObjects.Image(scene, 0, 0, TEXTURE_KEYS.oracleMachine);
    body.setDisplaySize(width + margin * 2, height + margin * 2);

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

    // The aperture is at the centre of the body, which is this container's origin.
    this.irisRing = new Phaser.GameObjects.Arc(scene, 0, 0, ORACLE_MACHINE.apertureRadius);
    this.irisRing.setStrokeStyle(1.5, colorNumber('background')).setAlpha(0);

    this.answer = new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: FONT_STACKS.machine,
      fontSize: `${ANSWER_FONT_SIZE}px`,
      fontStyle: '500',
      color: COLORS.background,
    });
    // Rendered at the canvas's own pixel density, so the digit is as sharp as the HTML text around it.
    this.answer.setOrigin(0.5).setResolution(scene.scale.width / DESIGN_WIDTH).setAlpha(0);

    this.add([body, this.irisRing, this.answer, this.statusLight]);
    this.setSize(width, height);
    scene.add.existing(this);

    this.startStandbyPulse();
  }

  /** The machine has been given an input: its last answer clears and it visibly sets to work. */
  startProcessing(): void {
    this.stopWorkingTweens();
    this.answer.setAlpha(0);

    this.standbyPulse?.remove();
    this.standbyPulse = null;
    this.statusLight.setAlpha(1);

    if (prefersReducedMotion()) {
      return; // A steady light and the status readout are signal enough.
    }

    const { apertureRadius, lensRadius } = ORACLE_MACHINE;
    const outer = apertureRadius - 3;
    const inner = lensRadius + 2;

    this.workingTweens = [
      // The status light quickens.
      this.scene.tweens.add({
        targets: this.statusLight,
        alpha: 0.2,
        duration: 110,
        yoyo: true,
        repeat: -1,
      }),
      // A ring closes in on the lens and fades as it arrives, twice.
      this.scene.tweens.addCounter({
        from: outer,
        to: inner,
        duration: ORACLE_TIMING.irisPulseMs,
        ease: 'Cubic.easeIn',
        repeat: 1,
        onUpdate: (tween) => {
          const radius = tween.getValue() ?? outer;
          this.irisRing.setRadius(radius).setAlpha(0.6 * ((radius - inner) / (outer - inner)));
        },
      }),
    ];
  }

  /**
   * The machine answers: the digit appears in the aperture and the machine
   * returns to standby. With `animate` off the digit is simply there — used
   * when the player comes back to a machine that had already answered.
   */
  showAnswer(output: Bit, animate = true): void {
    this.stopWorkingTweens();
    this.standbyPulse?.remove();
    this.statusLight.setAlpha(1);
    this.startStandbyPulse();

    this.answer.setText(String(output));
    if (!animate || prefersReducedMotion()) {
      this.answer.setAlpha(1);
      return;
    }
    this.workingTweens = [
      this.scene.tweens.add({
        targets: this.answer,
        alpha: { from: 0, to: 1 },
        duration: ORACLE_TIMING.revealMs,
      }),
    ];
  }

  private stopWorkingTweens(): void {
    for (const tween of this.workingTweens) {
      tween.remove();
    }
    this.workingTweens = [];
    this.irisRing.setAlpha(0);
  }

  /** A slow pulse of the status light — the one sign that the machine is powered. */
  private startStandbyPulse(): void {
    if (prefersReducedMotion()) {
      return;
    }
    this.standbyPulse = this.scene.tweens.add({
      targets: this.statusLight,
      alpha: 0.4,
      duration: 1800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }
}
