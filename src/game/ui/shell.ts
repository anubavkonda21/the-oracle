/** The static elements declared in `index.html` that the game attaches to. */
export interface Shell {
  /** Full-viewport root; carries the paper background. */
  app: HTMLElement;
  /** Wraps canvas and interface together, so both fade as one during scene transitions. */
  stage: HTMLElement;
  /** Phaser mounts its canvas here. */
  canvasHost: HTMLElement;
  /** Scenes mount their HTML interface here, above the canvas. */
  uiRoot: HTMLElement;
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`index.html is missing the required element #${id}.`);
  }
  return element;
}

export function queryShell(): Shell {
  return {
    app: requireElement('app'),
    stage: requireElement('stage'),
    canvasHost: requireElement('stage-canvas'),
    uiRoot: requireElement('stage-ui'),
  };
}

/** Marks start-up as finished, which retires the static "SYSTEM: INITIALIZING" readout. */
export function markBootComplete(): void {
  document.documentElement.dataset.boot = 'ready';
}
