/**
 * Biomedical Audio Alert Synthesizer using Web Audio API
 * Generates standard clinical monitor auditory signals without external audio files.
 */
class SoundAlerts {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private lastAlertTime = 0;

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private getAudioContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public playApneaAlarm() {
    if (!this.enabled) return;
    const now = Date.now();
    if (now - this.lastAlertTime < 2500) return;
    this.lastAlertTime = now;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    // Standard clinical emergency pattern (two-tone beep: 880 Hz -> 660 Hz)
    this.beep(ctx, 880, 0.15, 0.0);
    this.beep(ctx, 660, 0.20, 0.18);
    this.beep(ctx, 880, 0.15, 0.45);
    this.beep(ctx, 660, 0.25, 0.63);
  }

  public playWarningChime() {
    if (!this.enabled) return;
    const now = Date.now();
    if (now - this.lastAlertTime < 3000) return;
    this.lastAlertTime = now;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.beep(ctx, 587.33, 0.12, 0.0); // D5
    this.beep(ctx, 880.00, 0.18, 0.15); // A5
  }

  private beep(ctx: AudioContext, freq: number, duration: number, delay: number) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration + 0.05);
    } catch (e) {
      // Audio context policy fallback
    }
  }
}

export const soundAlerts = new SoundAlerts();
