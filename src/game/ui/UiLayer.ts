/**
 * The HTML layer above the canvas.
 *
 * Text and controls are real DOM rather than canvas drawings: type stays sharp
 * at any scale, buttons are focusable and keyboard-operable for free, and the
 * styling lives in CSS alongside the design tokens. Each scene shows exactly
 * one view at a time.
 */
export class UiLayer {
  /** True when the view being replaced held keyboard focus, so focus should follow into the next view. */
  private shouldCarryFocus = false;

  constructor(private readonly root: HTMLElement) {}

  show(view: HTMLElement): void {
    const carryFocus = this.shouldCarryFocus || this.root.contains(document.activeElement);
    this.shouldCarryFocus = false;
    this.root.replaceChildren(view);

    if (carryFocus) {
      // Without this, removing the focused control drops keyboard and screen-reader
      // users back at the top of the document after every scene change.
      view.tabIndex = -1;
      view.focus({ preventScroll: true });
    }
  }

  clear(): void {
    this.shouldCarryFocus = this.root.contains(document.activeElement);
    this.root.replaceChildren();
  }
}
