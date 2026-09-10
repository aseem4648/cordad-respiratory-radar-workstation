export interface EstimatorResult {
  respiratoryRateBpm: number | null;
  confidence: number;
  isValid: boolean;
  status: 'VALID' | 'INSUFFICIENT_SIGNAL' | 'AWAITING_BUFFER';
  detectedPeaksCount: number;
  averageInterBreathIntervalSec: number | null;
}

export class RespiratoryRateEstimator {
  private sampleRateHz: number;
  private bufferSize: number;
  private signalBuffer: { time: number; value: number }[] = [];
  
  private minBpm = 6.0;
  private maxBpm = 45.0;
  private minWindowSec = 12;

  constructor(sampleRateHz = 20, windowSec = 25) {
    this.sampleRateHz = sampleRateHz;
    this.bufferSize = Math.round(sampleRateHz * windowSec);
  }

  public addSample(value: number, timestamp = Date.now()): EstimatorResult {
    if (isNaN(value) || !isFinite(value)) {
      return this.getEmptyResult('INSUFFICIENT_SIGNAL');
    }

    this.signalBuffer.push({ time: timestamp, value });
    if (this.signalBuffer.length > this.bufferSize) {
      this.signalBuffer.shift();
    }

    const currentWindowSec = (timestamp - this.signalBuffer[0].time) / 1000;
    if (currentWindowSec < this.minWindowSec) {
      return this.getEmptyResult('AWAITING_BUFFER');
    }

    return this.calculateRate();
  }

  public calculateRate(): EstimatorResult {
    if (this.signalBuffer.length < this.sampleRateHz * this.minWindowSec) {
      return this.getEmptyResult('AWAITING_BUFFER');
    }

    const values = this.signalBuffer.map(p => p.value);
    const times = this.signalBuffer.map(p => p.time);

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < 0.005) {
      return this.getEmptyResult('INSUFFICIENT_SIGNAL');
    }

    const peaks = this.findPeaks(values, times, stdDev * 0.4);
    const autocorrBpm = this.estimateViaAutocorrelation(values);

    if (peaks.length < 2 && autocorrBpm === null) {
      return this.getEmptyResult('INSUFFICIENT_SIGNAL');
    }

    let peakBpm: number | null = null;
    let avgIbi: number | null = null;

    if (peaks.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < peaks.length; i++) {
        const intervalSec = (peaks[i] - peaks[i - 1]) / 1000;
        if (intervalSec >= 60 / this.maxBpm && intervalSec <= 60 / this.minBpm) {
          intervals.push(intervalSec);
        }
      }

      if (intervals.length >= 2) {
        avgIbi = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        peakBpm = 60 / avgIbi;
      }
    }

    let finalBpm: number | null = null;
    let confidence = 0;

    if (peakBpm !== null && autocorrBpm !== null) {
      const diff = Math.abs(peakBpm - autocorrBpm);
      if (diff < 4.0) {
        finalBpm = (peakBpm * 0.5) + (autocorrBpm * 0.5);
        confidence = Math.max(70, Math.min(98, 100 - diff * 8));
      } else {
        finalBpm = autocorrBpm;
        confidence = 55;
      }
    } else if (autocorrBpm !== null) {
      finalBpm = autocorrBpm;
      confidence = 65;
    } else if (peakBpm !== null) {
      finalBpm = peakBpm;
      confidence = 60;
    }

    if (finalBpm === null || finalBpm < this.minBpm || finalBpm > this.maxBpm) {
      return this.getEmptyResult('INSUFFICIENT_SIGNAL');
    }

    const roundedBpm = Math.round(finalBpm * 10) / 10;

    return {
      respiratoryRateBpm: roundedBpm,
      confidence: Math.round(confidence),
      isValid: true,
      status: 'VALID',
      detectedPeaksCount: peaks.length,
      averageInterBreathIntervalSec: avgIbi ? Math.round(avgIbi * 100) / 100 : null
    };
  }

  private findPeaks(values: number[], times: number[], threshold: number): number[] {
    const peaks: number[] = [];
    const minSamplesBetweenPeaks = Math.round(this.sampleRateHz * (60 / this.maxBpm));

    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > threshold && values[i] > values[i - 1] && values[i] > values[i + 1]) {
        if (peaks.length === 0 || (times[i] - peaks[peaks.length - 1]) >= (minSamplesBetweenPeaks / this.sampleRateHz) * 1000) {
          peaks.push(times[i]);
        }
      }
    }
    return peaks;
  }

  private estimateViaAutocorrelation(values: number[]): number | null {
    const n = values.length;
    if (n < this.sampleRateHz * 10) return null;

    const minLag = Math.floor(this.sampleRateHz * (60 / this.maxBpm));
    const maxLag = Math.ceil(this.sampleRateHz * (60 / this.minBpm));

    let maxCorr = -Infinity;
    let bestLag = -1;

    for (let lag = minLag; lag <= maxLag && lag < n / 2; lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += values[i] * values[i + lag];
      }
      if (sum > maxCorr) {
        maxCorr = sum;
        bestLag = lag;
      }
    }

    if (bestLag > 0 && maxCorr > 0) {
      const periodSec = bestLag / this.sampleRateHz;
      const bpm = 60 / periodSec;
      if (bpm >= this.minBpm && bpm <= this.maxBpm) {
        return bpm;
      }
    }

    return null;
  }

  private getEmptyResult(status: 'VALID' | 'INSUFFICIENT_SIGNAL' | 'AWAITING_BUFFER'): EstimatorResult {
    return {
      respiratoryRateBpm: null,
      confidence: 0,
      isValid: false,
      status,
      detectedPeaksCount: 0,
      averageInterBreathIntervalSec: null
    };
  }

  public reset() {
    this.signalBuffer = [];
  }
}
