import Phaser from 'phaser';
import { TEXTURE_KEYS } from '../config/assetKeys';
import { colorNumber } from '../config/designTokens';
import { prefersReducedMotion } from '../effects/motion';
import { ORACLE_MACHINE } from './oracleMachineTexture';

/**
 * PLACEHOLDER for the Oracle: a matte black machine with one aperture and a
 * status light. It establishes the object's physical presence only — there is
 * no Oracle logic, input or output here. That arrives in later checkpoints.
 */
export class OracleMachine extends Phaser.GameObjects.Container {
  /** Positioned by the centre of the machine's body. */
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const { width, height, margin, statusLight } = ORACLE_MACHINE;

    const body = new Phaser.GameObjects.Image(scene, 0, 0, TEXTURE_KEYS.oracleMachine);
    body.setDisplaySize(width + margin * 2, height + margin * 2);

    const light = new Phaser.GameObjects.Arc(
      scene,
      statusLight.x - width / 2,
      statusLight.y - height / 2,
      statusLight.radius,
      0,
      360,
      false,
      colorNumber('signalRed'),
    );

    this.add([body, light]);
    this.setSize(width, height);
    scene.add.existing(this);

    if (!prefersReducedMotion()) {
      // A slow standby pulse — the one sign that the machine is powered.
      scene.tweens.add({
        targets: light,
        alpha: 0.4,
        duration: 1800,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    }
  }
}
