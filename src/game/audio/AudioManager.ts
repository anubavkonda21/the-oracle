export class AudioManager {
  private ctx: AudioContext | null = null;
  private initialized = false;
  private muted = false;

  init() {
    if (this.initialized) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.initialized = true;
        this.startAmbience();
      }
    } catch (e) {
      console.warn('Audio initialization failed', e);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
  }

  private playTone(frequency: number, type: OscillatorType, duration: number, vol: number) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
    osc.onended = () => { gain.disconnect(); osc.disconnect(); };
  }

  private startAmbience() {
    if (!this.ctx) return;
    // Very subtle low-frequency drone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A
    
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.1, this.ctx.currentTime);
    
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(2, this.ctx.currentTime);
    
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.05, this.ctx.currentTime); // Very quiet
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    lfo.start();
  }

  playClick() {
    this.playTone(800, 'sine', 0.1, 0.2);
  }

  playOracleQuery() {
    this.playTone(200, 'square', 0.15, 0.15);
  }

  playConstraintReveal() {
    this.playTone(440, 'sine', 0.5, 0.15);
    setTimeout(() => this.playTone(660, 'sine', 0.5, 0.15), 100);
  }

  playQuantumTransition() {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 1.5);
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.5);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.5);
    osc.onended = () => { gain.disconnect(); osc.disconnect(); };
  }

  playQuantumStep(step: string) {
    if (step === 'superposed' || step === 'interfered') {
      this.playTone(330, 'sine', 0.3, 0.15);
    } else if (step === 'queried') {
      this.playTone(150, 'square', 0.2, 0.15);
    }
  }

  playMeasurement() {
    this.playTone(1200, 'sine', 0.1, 0.2);
  }

  playResult() {
    this.playTone(440, 'sine', 0.3, 0.2);
    setTimeout(() => this.playTone(554.37, 'sine', 0.5, 0.2), 150);
  }
}

export const audioManager = new AudioManager();
