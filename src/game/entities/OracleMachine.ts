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
 * aperture, one status light. Supports classical single-bit answers and
 * 3-step visual quantum interference animations.
 */
export class OracleMachine extends Phaser.GameObjects.Container {
  private readonly statusLight: Phaser.GameObjects.Arc;
  /** A thin ring that contracts inside the aperture while the machine is working. */
  private readonly irisRing: Phaser.GameObjects.Arc;
  private readonly answer: Phaser.GameObjects.Text;

  // Quantum visual elements inside the aperture
  private readonly energyRays: Phaser.GameObjects.Graphics;
  private readonly cyanWaveBar: Phaser.GameObjects.Rectangle;
  private readonly purpleWaveBar: Phaser.GameObjects.Rectangle;
  private readonly detectorCircle: Phaser.GameObjects.Arc;
  private readonly detectorHalo: Phaser.GameObjects.Arc;
  private readonly scatterText: Phaser.GameObjects.Text;

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

    // Quantum visual components
    this.energyRays = new Phaser.GameObjects.Graphics(scene);

    // Cyan (+) and Purple (-) wave bars
    this.cyanWaveBar = new Phaser.GameObjects.Rectangle(scene, 0, -14, 52, 6, 0x00e5ff);
    this.cyanWaveBar.setAlpha(0);

    this.purpleWaveBar = new Phaser.GameObjects.Rectangle(scene, 0, 14, 52, 6, 0xa855f7);
    this.purpleWaveBar.setAlpha(0);

    // 000000 Central detector circle
    this.detectorHalo = new Phaser.GameObjects.Arc(scene, 0, 0, 32, 0, 360, false, 0xa855f7, 0.4);
    this.detectorHalo.setAlpha(0);

    this.detectorCircle = new Phaser.GameObjects.Arc(scene, 0, 0, 20, 0, 360, false, 0xffffff);
    this.detectorCircle.setStrokeStyle(2, 0xa855f7);
    this.detectorCircle.setAlpha(0);

    this.scatterText = new Phaser.GameObjects.Text(scene, 0, 32, '', {
      fontFamily: FONT_STACKS.machine,
      fontSize: '12px',
      color: '#c084fc',
    });
    this.scatterText.setOrigin(0.5).setAlpha(0);

    this.answer = new Phaser.GameObjects.Text(scene, 0, 0, '', {
      fontFamily: FONT_STACKS.machine,
      fontSize: `${ANSWER_FONT_SIZE}px`,
      fontStyle: '500',
      color: COLORS.background,
    });
    this.answer.setOrigin(0.5).setResolution(scene.scale.width / DESIGN_WIDTH).setAlpha(0);

    this.add([
      body,
      this.energyRays,
      this.irisRing,
      this.detectorHalo,
      this.detectorCircle,
      this.cyanWaveBar,
      this.purpleWaveBar,
      this.scatterText,
      this.answer,
      this.statusLight,
    ]);

    this.setSize(width, height);
    scene.add.existing(this);

    this.startStandbyPulse();
  }

  /** The machine has been given an input: its last answer clears and it visibly sets to work. */
  startProcessing(): void {
    this.stopWorkingTweens();
    this.clearQuantumVisuals();
    this.answer.setAlpha(0);

    this.standbyPulse?.remove();
    this.standbyPulse = null;
    this.statusLight.setAlpha(1);

    if (prefersReducedMotion()) {
      return;
    }

    const { apertureRadius, lensRadius } = ORACLE_MACHINE;
    const outer = apertureRadius - 3;
    const inner = lensRadius + 2;

    this.workingTweens = [
      this.scene.tweens.add({
        targets: this.statusLight,
        alpha: 0.2,
        duration: 110,
        yoyo: true,
        repeat: -1,
      }),
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
   * Shows a classical 1-bit answer in the aperture.
   */
  showAnswer(output: Bit, animate = true): void {
    this.stopWorkingTweens();
    this.clearQuantumVisuals();
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

  /**
   * Executes the 3-step visual quantum interference sequence:
   * Step 1: Superposition Split (0.6s) - energy lines converging into central box.
   * Step 2: Phase Interference (0.8s) - cyan (+) & purple (-) wave bars oscillating:
   *         - If CONSTANT: Constructive interference spiking into 000000 detector (bright solid white/purple).
   *         - If BALANCED: Destructive interference cancelling 000000 detector (dark 0%), scattering pulses outward.
   * Step 3: Calls onComplete() for Player Call.
   */
  playQuantumInterferenceAnimation(
    isConstant: boolean,
    scatterLabel: string,
    onComplete: () => void,
  ): void {
    this.stopWorkingTweens();
    this.clearQuantumVisuals();
    this.answer.setAlpha(0);

    const reduce = prefersReducedMotion();
    const step1Duration = reduce ? 200 : 600;
    const step2Duration = reduce ? 300 : 800;

    // STEP 1: Superposition Split (0.6s)
    let convergenceStep = 0;
    const convergeTween = this.scene.tweens.addCounter({
      from: 140,
      to: 18,
      duration: step1Duration,
      ease: 'Quad.easeIn',
      onUpdate: (tw) => {
        const radius = tw.getValue() ?? 140;
        convergenceStep += 0.15;
        this.energyRays.clear();
        this.energyRays.lineStyle(1.5, 0xa855f7, 0.7);

        const rayCount = 12;
        for (let i = 0; i < rayCount; i++) {
          const angle = (i * Math.PI * 2) / rayCount + convergenceStep;
          const x1 = Math.cos(angle) * radius;
          const y1 = Math.sin(angle) * radius;
          const x2 = Math.cos(angle) * (radius - 16);
          const y2 = Math.sin(angle) * (radius - 16);
          this.energyRays.lineBetween(x1, y1, x2, y2);
        }
      },
      onComplete: () => {
        this.energyRays.clear();

        // STEP 2: Phase Interference (0.8s)
        this.cyanWaveBar.setAlpha(0.85);
        this.purpleWaveBar.setAlpha(0.85);

        if (isConstant) {
          // CONSTANT: Constructive interference
          // Both waves oscillate in phase and merge into center
          this.scene.tweens.add({
            targets: [this.cyanWaveBar, this.purpleWaveBar],
            scaleX: { from: 0.7, to: 1.2 },
            alpha: { from: 0.5, to: 1.0 },
            yoyo: true,
            repeat: 2,
            duration: step2Duration / 6,
            onComplete: () => {
              this.cyanWaveBar.setAlpha(0);
              this.purpleWaveBar.setAlpha(0);

              // 000000 DETECTOR SPIKES SOLID BRIGHT WHITE/PURPLE
              this.detectorCircle.setFillStyle(0xffffff, 1.0);
              this.detectorCircle.setStrokeStyle(3, 0xa855f7);
              this.detectorCircle.setAlpha(1);

              this.detectorHalo.setFillStyle(0xc084fc, 0.6);
              this.detectorHalo.setAlpha(1);

              this.scene.tweens.add({
                targets: this.detectorHalo,
                scale: 1.4,
                alpha: 0.3,
                yoyo: true,
                repeat: -1,
                duration: 600,
              });

              onComplete();
            },
          });
        } else {
          // BALANCED: Destructive interference
          // Opposing wave bars collide with inverted phase
          this.scene.tweens.add({
            targets: this.cyanWaveBar,
            x: { from: -8, to: 8 },
            yoyo: true,
            repeat: 3,
            duration: step2Duration / 8,
          });

          this.scene.tweens.add({
            targets: this.purpleWaveBar,
            x: { from: 8, to: -8 },
            yoyo: true,
            repeat: 3,
            duration: step2Duration / 8,
            onComplete: () => {
              this.cyanWaveBar.setAlpha(0);
              this.purpleWaveBar.setAlpha(0);

              // 000000 DETECTOR CANCELLED TO DARK / 0%
              this.detectorCircle.setFillStyle(0x111111, 0.05);
              this.detectorCircle.setStrokeStyle(1, 0x444444);
              this.detectorCircle.setAlpha(0.3);
              this.detectorHalo.setAlpha(0);

              // Scatter pulse
              this.scatterText.setText(`SCATTER: ${scatterLabel}`);
              this.scatterText.setAlpha(1);

              // Scattering ring ripples outward
              const scatterRing = this.scene.add.arc(this.x, this.y, 10, 0, 360, false);
              scatterRing.setStrokeStyle(2, 0xc084fc, 0.9);
              this.scene.tweens.add({
                targets: scatterRing,
                radius: 75,
                alpha: 0,
                duration: 600,
                onComplete: () => scatterRing.destroy(),
              });

              onComplete();
            },
          });
        }
      },
    });

    this.workingTweens.push(convergeTween);
  }

  clearAnswer(): void {
    this.stopWorkingTweens();
    this.clearQuantumVisuals();
    this.answer.setAlpha(0);
    this.answer.setText('');
  }

  private clearQuantumVisuals(): void {
    this.energyRays.clear();
    this.cyanWaveBar.setAlpha(0);
    this.purpleWaveBar.setAlpha(0);
    this.detectorCircle.setAlpha(0);
    this.detectorHalo.setAlpha(0);
    this.scatterText.setAlpha(0);
    this.scatterText.setText('');
  }

  private stopWorkingTweens(): void {
    for (const tween of this.workingTweens) {
      tween.remove();
    }
    this.workingTweens = [];
    this.irisRing.setAlpha(0);
  }

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
