import type Phaser from 'phaser';
import type { StageEnvironment } from '../effects/StageEnvironment';
import type { StageFade } from '../effects/StageFade';
import type { UiLayer } from '../ui/UiLayer';
import type { GameSession } from './GameSession';

/** Long-lived objects shared by every scene. Created once by BootScene. */
export interface GameServices {
  readonly ui: UiLayer;
  readonly stageFade: StageFade;
  readonly stageEnvironment: StageEnvironment;
  readonly session: GameSession;
}

const REGISTRY_KEY = 'services';

export function registerServices(registry: Phaser.Data.DataManager, services: GameServices): void {
  registry.set(REGISTRY_KEY, services);
}

export function getServices(registry: Phaser.Data.DataManager): GameServices {
  const services = registry.get(REGISTRY_KEY) as GameServices | undefined;
  if (!services) {
    throw new Error('Game services are not registered yet. BootScene must run before any other scene.');
  }
  return services;
}
