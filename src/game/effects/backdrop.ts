import Phaser from 'phaser';
import { TEXTURE_KEYS } from '../config/assetKeys';
import { COLORS, colorRgba } from '../config/designTokens';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/display';
import { createSeededRandom } from '../../utils/random';

/**
 * The dark behind the machine: the room's own colour, with one soft pool of
 * light where the machine stands. It is a stand-in. The laboratory itself —
 * walls, equipment, a floor — is drawn in a later stage of the work, and
 * takes this one's place.
 *
 * It is painted on the canvas, rather than left to the page behind it, for
 * one reason: the machine's lights are added to whatever is beneath them,
 * and that only works on something solid. Toward its edges it fades out, so
 * it meets the page without a seam whatever shape the window is.
 */

/** The backdrop is all soft gradients, so it is painted small and stretched. */
const PIXELS_PER_UNIT = 0.5;
/** Distance over which the backdrop fades out at its edges, in design units. */
const FEATHER = 72;

export function createBackdropTexture(textures: Phaser.Textures.TextureManager, machineCentreY: number): void {
  if (textures.exists(TEXTURE_KEYS.backdrop)) {
    return;
  }
  const width = Math.round(DESIGN_WIDTH * PIXELS_PER_UNIT);
  const height = Math.round(DESIGN_HEIGHT * PIXELS_PER_UNIT);
  const texture = textures.createCanvas(TEXTURE_KEYS.backdrop, width, height);
  if (!texture) {
    throw new Error('Could not create the canvas texture for the backdrop.');
  }
  const context = texture.context;
  context.scale(PIXELS_PER_UNIT, PIXELS_PER_UNIT);

  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

  // Light on the wall behind the machine.
  const centreX = DESIGN_WIDTH / 2;
  context.save();
  context.translate(centreX, machineCentreY - 20);
  context.scale(1, 0.72);
  const wall = context.createRadialGradient(0, 0, 0, 0, 0, 560);
  wall.addColorStop(0, colorRgba('instrument', 0.075));
  wall.addColorStop(0.35, colorRgba('instrument', 0.04));
  wall.addColorStop(0.7, colorRgba('instrument', 0.012));
  wall.addColorStop(1, colorRgba('instrument', 0));
  context.fillStyle = wall;
  context.fillRect(-centreX, -DESIGN_HEIGHT, DESIGN_WIDTH, DESIGN_HEIGHT * 2);
  context.restore();

  // A trace of the same light on the floor in front of it.
  context.save();
  context.translate(centreX, machineCentreY + 196);
  context.scale(1, 0.16);
  const floor = context.createRadialGradient(0, 0, 0, 0, 0, 430);
  floor.addColorStop(0, colorRgba('instrument', 0.07));
  floor.addColorStop(0.5, colorRgba('instrument', 0.022));
  floor.addColorStop(1, colorRgba('instrument', 0));
  context.fillStyle = floor;
  context.fillRect(-centreX, -DESIGN_HEIGHT * 4, DESIGN_WIDTH, DESIGN_HEIGHT * 8);
  context.restore();

  // Gradients this dark show as bands on most screens. A little noise, a shade either way, breaks them up.
  context.setTransform(1, 0, 0, 1, 0, 0);
  const image = context.getImageData(0, 0, width, height);
  const random = createSeededRandom(5);
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const shift = Math.round((random() - 0.5) * 2.4);
    image.data[offset] = (image.data[offset] ?? 0) + shift;
    image.data[offset + 1] = (image.data[offset + 1] ?? 0) + shift;
    image.data[offset + 2] = (image.data[offset + 2] ?? 0) + shift;
  }
  context.putImageData(image, 0, 0);

  // Fade out toward every edge.
  const feather = FEATHER * PIXELS_PER_UNIT;
  context.globalCompositeOperation = 'destination-in';
  const across = context.createLinearGradient(0, 0, width, 0);
  across.addColorStop(0, 'rgba(0, 0, 0, 0)');
  across.addColorStop(feather / width, 'rgba(0, 0, 0, 1)');
  across.addColorStop(1 - feather / width, 'rgba(0, 0, 0, 1)');
  across.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = across;
  context.fillRect(0, 0, width, height);
  const down = context.createLinearGradient(0, 0, 0, height);
  down.addColorStop(0, 'rgba(0, 0, 0, 0)');
  down.addColorStop(feather / height, 'rgba(0, 0, 0, 1)');
  down.addColorStop(1 - feather / height, 'rgba(0, 0, 0, 1)');
  down.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = down;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';

  texture.refresh();
}

/** Puts the backdrop behind everything else in a scene. */
export function addBackdrop(scene: Phaser.Scene): Phaser.GameObjects.Image {
  return scene.add
    .image(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, TEXTURE_KEYS.backdrop)
    .setDisplaySize(DESIGN_WIDTH, DESIGN_HEIGHT)
    .setDepth(-1000);
}
