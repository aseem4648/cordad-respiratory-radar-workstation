/**
 * Digital Signal Processing - Filter Module for 24 GHz FMCW Radar
 * 
 * Implements:
 * 1. DC Offset / Baseline Drift Removal (Moving Average Highpass Detrending)
 * 2. 2nd-Order Butterworth Bandpass Filter (0.10 Hz - 0.70 Hz / 6 - 42 BPM)
 * 3. Moving Average Smoothing
 */

export interface FilterConfig {
  sampleRateHz: number;
  lowCutHz: number;    // default: 0.10 Hz (~6 BPM)
  highCutHz: number;   // default: 0.70 Hz (~42 BPM)
  baselineWindowSamples?: number;
}

export class RespiratoryBandpassFilter {
  private sampleRate: number;
  private lowCut: number;
  private highCut: number;
  private baselineWindow: number;
  
  private rawBuffer: number[] = [];
  
  private b0_lp = 0; private b1_lp = 0; private b2_lp = 0;
  private a1_lp = 0; private a2_lp = 0;
  private x1_lp = 0; private x2_lp = 0;
  private y1_lp = 0; private y2_lp = 0;

  private b0_hp = 0; private b1_hp = 0; private b2_hp = 0;
  private a1_hp = 0; private a2_hp = 0;
  private x1_hp = 0; private x2_hp = 0;
  private y1_hp = 0; private y2_hp = 0;

  constructor(config: FilterConfig) {
    this.sampleRate = config.sampleRateHz || 20;
    this.lowCut = config.lowCutHz || 0.10;
    this.highCut = config.highCutHz || 0.70;
    this.baselineWindow = config.baselineWindowSamples || Math.round(this.sampleRate * 5);
    this.calculateCoefficients();
  }

  public updateConfig(config: Partial<FilterConfig>) {
    if (config.sampleRateHz) this.sampleRate = config.sampleRateHz;
    if (config.lowCutHz) this.lowCut = config.lowCutHz;
    if (config.highCutHz) this.highCut = config.highCutHz;
    if (config.baselineWindowSamples) this.baselineWindow = config.baselineWindowSamples;
    this.calculateCoefficients();
    this.resetState();
  }

  private calculateCoefficients() {
    const omegaHp = Math.tan((Math.PI * this.lowCut) / this.sampleRate);
    const omegaHp2 = omegaHp * omegaHp;
    const sqrt2 = Math.SQRT2;
    const normHp = 1 + sqrt2 * omegaHp + omegaHp2;

    this.b0_hp = 1 / normHp;
    this.b1_hp = -2 / normHp;
    this.b2_hp = 1 / normHp;
    this.a1_hp = 2 * (omegaHp2 - 1) / normHp;
    this.a2_hp = (1 - sqrt2 * omegaHp + omegaHp2) / normHp;

    const omegaLp = Math.tan((Math.PI * this.highCut) / this.sampleRate);
    const omegaLp2 = omegaLp * omegaLp;
    const normLp = 1 + sqrt2 * omegaLp + omegaLp2;

    this.b0_lp = omegaLp2 / normLp;
    this.b1_lp = 2 * this.b0_lp;
    this.b2_lp = this.b0_lp;
    this.a1_lp = 2 * (omegaLp2 - 1) / normLp;
    this.a2_lp = (1 - sqrt2 * omegaLp + omegaLp2) / normLp;
  }

  public process(rawSample: number): number {
    if (isNaN(rawSample) || !isFinite(rawSample)) {
      return 0;
    }

    this.rawBuffer.push(rawSample);
    if (this.rawBuffer.length > this.baselineWindow) {
      this.rawBuffer.shift();
    }
    const baseline = this.rawBuffer.reduce((acc, val) => acc + val, 0) / this.rawBuffer.length;
    const detrended = rawSample - baseline;

    const y_hp = this.b0_hp * detrended + this.b1_hp * this.x1_hp + this.b2_hp * this.x2_hp
                 - this.a1_hp * this.y1_hp - this.a2_hp * this.y2_hp;
    this.x2_hp = this.x1_hp;
    this.x1_hp = detrended;
    this.y2_hp = this.y1_hp;
    this.y1_hp = y_hp;

    const y_lp = this.b0_lp * y_hp + this.b1_lp * this.x1_lp + this.b2_lp * this.x2_lp
                 - this.a1_lp * this.y1_lp - this.a2_lp * this.y2_lp;
    this.x2_lp = this.x1_lp;
    this.x1_lp = y_hp;
    this.y2_lp = this.y1_lp;
    this.y1_lp = y_lp;

    if (isNaN(y_lp) || !isFinite(y_lp)) {
      this.resetState();
      return 0;
    }

    return y_lp;
  }

  public processBatch(samples: number[]): number[] {
    this.resetState();
    return samples.map(s => this.process(s));
  }

  public resetState() {
    this.x1_hp = 0; this.x2_hp = 0; this.y1_hp = 0; this.y2_hp = 0;
    this.x1_lp = 0; this.x2_lp = 0; this.y1_lp = 0; this.y2_lp = 0;
    this.rawBuffer = [];
  }
}
