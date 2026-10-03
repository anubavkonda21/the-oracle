import { BOX_CENTER_Y, BOX_TIMING } from '../config/boxConfig';
import { DESIGN_WIDTH } from '../config/display';
import { SCENE_KEYS } from '../config/sceneKeys';
import { prefersReducedMotion } from '../effects/motion';
import { ObservationBox } from '../entities/ObservationBox';
import { BoxExperiment } from '../systems/box/BoxExperiment';
import { listenForKeyPresses } from '../systems/keyboard';
import { createBoxView, type BoxView } from '../ui/views/boxView';
import { StageScene } from './StageScene';

/**
 * THE BOX: a short detour from the laboratory. A sealed box, one action —
 * OBSERVE — a held moment, and then one definite outcome, followed by three
 * sentences of context and the way back to the Oracle.
 *
 * The player is told nothing beforehand. The experience comes first.
 *
 * This scene only stages what happens. The qubit, its superposition and the
 * measurement are in systems/box/BoxExperiment.ts, built on the quantum engine.
 */
export class BoxScene extends StageScene {
  private readonly experiment = new BoxExperiment();
  private box!: ObservationBox;
  private view!: BoxView;

  constructor() {
    super(SCENE_KEYS.box);
  }

  create(): void {
    // A newly prepared, sealed box on every visit, however the last visit ended.
    this.experiment.reset();

    this.view = createBoxView({
      onObserve: () => this.observe(),
      onObserveAgain: () => this.sealAgain(),
      onReturn: () => this.returnToOracle(),
    });
    this.enterStage(this.view.element, 'dark');
    this.view.setPhase(this.experiment.phase);

    this.box = new ObservationBox(this, DESIGN_WIDTH / 2, BOX_CENTER_Y);

    listenForKeyPresses(this, (event) => this.handleKey(event));
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.repeat) {
      return; // A key held down — perhaps since the laboratory — must not act here again and again.
    }

    if (event.key === 'Escape') {
      this.returnToOracle();
    } else if (event.key === 'Enter' && !(document.activeElement instanceof HTMLButtonElement)) {
      // With a button focused, Enter already presses that button. Otherwise it is the phase's main action.
      if (this.experiment.phase === 'sealed') {
        this.observe();
      } else if (this.experiment.phase === 'observed') {
        this.returnToOracle();
      }
    }
  }

  private observe(): void {
    // `beginObservation` refuses unless the box is sealed, so a second request during the sequence does nothing.
    if (this.isLeavingStage || !this.experiment.beginObservation()) {
      return;
    }
    this.view.setPhase('observing');
    this.box.hold();

    const reducedMotion = prefersReducedMotion();
    const holdMs = reducedMotion ? BOX_TIMING.reducedMotionHoldMs : BOX_TIMING.holdMs;
    const openMs = reducedMotion ? BOX_TIMING.reducedMotionOpenMs : BOX_TIMING.openMs;

    // Until this moment the state is still the superposition. The measurement happens here, once.
    this.afterDelay(holdMs, () => {
      const outcome = this.experiment.measure();
      this.session.recordBoxObservation();
      this.box.open(outcome, openMs);

      this.afterDelay(openMs, () => {
        this.box.settleOpen();
        this.view.showReport(outcome);
        this.view.setPhase('observed');
      });
    });
  }

  /** Replay: a new box is prepared and sealed, and can be observed afresh. */
  private sealAgain(): void {
    if (this.isLeavingStage || this.experiment.phase !== 'observed') {
      return;
    }
    this.experiment.reset();
    this.box.seal();
    this.view.clearReport();
    this.view.setPhase('sealed');
  }

  private returnToOracle(): void {
    // The laboratory picks up where it was left: same machine, same experiment log.
    this.leaveTo(SCENE_KEYS.laboratory, { resume: true });
  }
}
