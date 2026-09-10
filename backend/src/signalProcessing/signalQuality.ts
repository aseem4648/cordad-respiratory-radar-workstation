import { SignalState } from '../../../hardware-interface/types';

export interface SignalQualityResult {
  sqi: number;
  state: SignalState;
  snrDb: number;
  isStable: boolean;
  noiseLevel: number;
  metrics: {
    amplitudeScore: number;
    periodicityScore: number;
    snrScore: number;
  };
}

export class SignalQualityCalculator {
  private sampleRateHz: number;
  private bufferSize: number;
  private sampleBuffer: number[] = [];
  private rawBuffer: number[] = [];

  constructor(sampleRateHz = 20, windowSec = 10) {
    this.sampleRateHz = sampleRateHz;
    this.bufferSize = Math.round(sampleRateHz * windowSec);
  }

  public update(filteredSample: number, rawSample: number): SignalQualityResult {
    if (isNaN(filteredSample) || isNaN(rawSample)) {
      return this.getEmptyResult('UNAVAILABLE');
    }

    this.sampleBuffer.push(filteredSample);
    this.rawBuffer.push(rawSample);

    if (this.sampleBuffer.length > this.bufferSize) {
      this.sampleBuffer.shift();
      this.rawBuffer.shift();
    }

    if (this.sampleBuffer.length < this.sampleRateHz * 3) {
      return this.getEmptyResult('UNAVAILABLE');
    }

    return this.calculateSQI();
  }

  private calculateSQI(): SignalQualityResult {
    const N = this.sampleBuffer.length;
    
    let max = -Infinity;
    let min = Infinity;
    let sumSq = 0;

    for (let i = 0; i < N; i++) {
      const v = this.sampleBuffer[i];
      if (v > max) max = v;
      if (v < min) min = v;
      sumSq += v * v;
    }

    const peakToPeak = max - min;
    const rms = Math.sqrt(sumSq / N);

    let amplitudeScore = 0;
    if (peakToPeak < 0.003) {
      amplitudeScore = 5;
    } else if (peakToPeak > 5.0) {
      amplitudeScore = 20;
    } else {
      amplitudeScore = Math.min(100, Math.max(40, (peakToPeak / 0.15) * 85));
    }

    let highFreqNoiseEnergy = 0;
    for (let i = 1; i < this.rawBuffer.length; i++) {
      const diff = this.rawBuffer[i] - this.rawBuffer[i - 1];
      highFreqNoiseEnergy += diff * diff;
    }
    const noiseRms = Math.sqrt(highFreqNoiseEnergy / N);
    
    const snr = noiseRms > 0 ? (rms / (noiseRms + 0.0001)) : 10;
    const snrDb = Math.round(20 * Math.log10(Math.max(0.1, snr)) * 10) / 10;
    const snrScore = Math.min(100, Math.max(0, (snrDb + 5) * 4));

    let zeroCrossings = 0;
    for (let i = 1; i < N; i++) {
      if ((this.sampleBuffer[i] >= 0 && this.sampleBuffer[i - 1] < 0) ||
          (this.sampleBuffer[i] < 0 && this.sampleBuffer[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    
    const durationSec = N / this.sampleRateHz;
    const expectedCrossingsMin = (6 / 60) * 2 * durationSec;
    const expectedCrossingsMax = (40 / 60) * 2 * durationSec;

    let periodicityScore = 50;
    if (zeroCrossings >= expectedCrossingsMin && zeroCrossings <= expectedCrossingsMax) {
      periodicityScore = 90;
    } else if (zeroCrossings === 0) {
      periodicityScore = 10;
    } else {
      periodicityScore = 40;
    }

    const sqiRaw = (amplitudeScore * 0.35) + (snrScore * 0.35) + (periodicityScore * 0.30);
    const sqi = Math.min(100, Math.max(0, Math.round(sqiRaw)));

    let state: SignalState = 'OPTIMAL';
    if (sqi >= 75) state = 'OPTIMAL';
    else if (sqi >= 45) state = 'ACCEPTABLE';
    else if (sqi >= 20) state = 'DEGRADED';
    else state = 'NO_SIGNAL';

    return {
      sqi,
      state,
      snrDb,
      isStable: sqi >= 45,
      noiseLevel: Math.round(noiseRms * 1000) / 1000,
      metrics: {
        amplitudeScore: Math.round(amplitudeScore),
        periodicityScore: Math.round(periodicityScore),
        snrScore: Math.round(snrScore)
      }
    };
  }

  private getEmptyResult(state: SignalState): SignalQualityResult {
    return {
      sqi: 0,
      state,
      snrDb: 0,
      isStable: false,
      noiseLevel: 0,
      metrics: { amplitudeScore: 0, periodicityScore: 0, snrScore: 0 }
    };
  }

  public reset() {
    this.sampleBuffer = [];
    this.rawBuffer = [];
  }
}
