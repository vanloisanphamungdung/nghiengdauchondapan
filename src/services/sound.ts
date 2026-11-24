class SoundEffects {
  private ctx: AudioContext | null = null;
  private enabled = true;

  public setEnabled(val: boolean) {
    this.enabled = val;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    delay = 0,
    volume = 0.16
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const startTime = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  public playCorrect() {
    this.playTone(523.25, 0.14, 'triangle', 0, 0.18); // C5
    this.playTone(659.25, 0.14, 'triangle', 0.09, 0.18); // E5
    this.playTone(783.99, 0.24, 'triangle', 0.18, 0.2); // G5
    this.playTone(1046.5, 0.3, 'sine', 0.27, 0.16); // C6
  }

  public playWrong() {
    this.playTone(311.13, 0.18, 'sine', 0, 0.12); // D#4
    this.playTone(261.63, 0.28, 'sine', 0.14, 0.12); // C4
  }

  public playSelectLock() {
    this.playTone(660, 0.08, 'sine', 0, 0.1);
  }

  public playZoneHover() {
    this.playTone(440, 0.05, 'sine', 0, 0.05);
  }

  public playComplete() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const times = [0, 0.1, 0.2, 0.3, 0.45, 0.58];
    const durations = [0.12, 0.12, 0.12, 0.16, 0.12, 0.45];
    notes.forEach((n, idx) => {
      this.playTone(n, durations[idx], 'triangle', times[idx], 0.18);
    });
  }
}

export const soundFX = new SoundEffects();
