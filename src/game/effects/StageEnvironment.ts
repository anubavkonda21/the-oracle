/**
 * The room a scene takes place in.
 *
 *   paper — the laboratory's warm off-white, the default
 *   dark  — a darker, quieter room, used by THE BOX
 */
export type Environment = 'paper' | 'dark';

/**
 * Switches the stage between rooms. The colours themselves are CSS (the
 * `.stage[data-environment]` rules in shell.css); this only says which set
 * applies. Scenes change room while the stage is faded out, so the change is
 * never seen as a cut.
 */
export class StageEnvironment {
  constructor(private readonly stage: HTMLElement) {}

  set(environment: Environment): void {
    this.stage.dataset.environment = environment;
  }
}
