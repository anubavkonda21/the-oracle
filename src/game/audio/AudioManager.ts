/**
 * Dependency-free procedural audio engine using the browser Web Audio API.
 * Synthesizes tactile mechanical and quantum atmospheric SFX in real time.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private initialized = false;
  private muted = false;
  private ambienceGain: GainNode | null = null;

  init(): void {
    if (typeof window === 'undefined') return;
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.initialized = true;
        this.startAmbience();
      }
    } catch {
      // Audio not available
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    if (typeof window === 'undefined') return false;
    this.muted = !this.muted;
    if (this.ambienceGain && this.ctx) {
      this.ambienceGain.gain.setValueAtTime(this.muted ? 0 : 0.03, this.ctx.currentTime);
    }
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private startAmbience(): void {
    if (typeof window === 'undefined' || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, this.ctx.currentTime);

      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.08, this.ctx.currentTime);

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(1.5, this.ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(this.muted ? 0 : 0.03, this.ctx.currentTime);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      lfo.start();
      this.ambienceGain = gain;
    } catch {
      // Ambience init safe ignore
    }
  }

  /** Soft high tick on bit toggle */
  playBitToggle(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.02);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    } catch {
      // Audio playback safe ignore
    }
  }

  /** Low mechanical thud on classical ASK */
  playMechanicalThud(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(95, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch {
      // Audio playback safe ignore
    }
  }

  /** Rising synth sweep on FIRE QUANTUM PROBE */
  playQuantumProbeSweep(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.6);

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.4);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.65);
    } catch {
      // Audio playback safe ignore
    }
  }

  /** Resonant bell tone for constructive 000000 spike */
  playConstructiveSpike(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    try {
      const f0 = 528;
      [f0, f0 * 2.02].forEach((freq, idx) => {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const amp = idx === 0 ? 0.35 : 0.15;
        gain.gain.setValueAtTime(amp, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 1.4);
      });
    } catch {
      // Audio playback safe ignore
    }
  }

  /** Muted phase-cancel whoosh for balanced cancellation */
  playDestructiveCancel(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(220, ctx.currentTime);
      osc2.frequency.setValueAtTime(224, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);
      osc2.frequency.exponentialRampToValueAtTime(48, ctx.currentTime + 0.5);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.5);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.55);
      osc2.stop(ctx.currentTime + 0.55);
    } catch {
      // Audio playback safe ignore
    }
  }

  /** Ascending 3-note arpeggio on level clear */
  playLevelClear(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    try {
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, index) => {
        if (!ctx) return;
        const startTime = ctx.currentTime + index * 0.1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.28, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });
    } catch {
      // Audio playback safe ignore
    }
  }

  /** Low buzzer on wrong guess */
  playWrongBuzzer(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(110, ctx.currentTime);
      osc2.frequency.setValueAtTime(116, ctx.currentTime);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.35);
      osc2.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio playback safe ignore
    }
  }

  /** Gentle correct classification chime */
  playChime(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);

      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // Audio playback safe ignore
    }
  }

  playClick(): void {
    this.playBitToggle();
  }

  playOracleQuery(): void {
    this.playMechanicalThud();
  }

  playConstraintReveal(): void {
    this.playChime();
  }

  playQuantumTransition(): void {
    this.playQuantumProbeSweep();
  }

  playQuantumStep(): void {}

  playMeasurement(): void {
    this.playBitToggle();
  }

  playResult(): void {
    this.playConstructiveSpike();
  }
}

export const audioManager = new AudioManager();
