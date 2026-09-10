/**
 * Contactless Respiratory Distress and Apnea Detection System
 * Mathematical & Statistical Signal Processing Engine for Offline Datasets
 * 
 * ZERO FABRICATION: All calculations are derived strictly from user data arrays.
 */

export interface TimeDomainMetrics {
  count: number;
  durationSeconds: number | null;
  min: number;
  max: number;
  mean: number;
  median: number;
  variance: number;
  stdDev: number;
  rms: number;
  peakToPeak: number;
  zeroCrossings: number;
  detectedPeaksCount: number;
  meanPeakIntervalSeconds: number | null;
}

export interface FftResult {
  frequencies: number[];
  magnitudes: number[];
  dominantFrequencyHz: number | null;
  dominantRespiratoryBpm: number | null;
  peakPower: number | null;
  totalPower: number;
  isRespiratoryBandValid: boolean;
}

export interface SpectrogramResult {
  times: number[];
  frequencies: number[];
  spectrogramMatrix: number[][]; // [timeIdx][freqIdx]
  minPower: number;
  maxPower: number;
}

export interface CandidateRespiratoryEvent {
  id: string;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  type: 'CANDIDATE_HYPOPNEA' | 'CANDIDATE_APNEA' | 'AMPLITUDE_DROP';
  amplitudeReductionPct: number;
  preEventMean: number;
  duringEventMean: number;
}

export interface SignalQualityAudit {
  totalSamples: number;
  missingSamples: number;
  missingPercentage: number;
  clippedSamples: number;
  clippingPercentage: number;
  variance: number;
  constantValueDetected: boolean;
  snrDb: number | null;
  timestampGapsCount: number;
}

export interface ReferenceComparisonResult {
  pairedCount: number;
  mae: number;
  rmse: number;
  meanError: number;
  bias: number;
  pearsonCorrelation: number;
  minError: number;
  maxError: number;
}

export class SignalAnalysisEngine {
  /**
   * Calculate comprehensive time-domain statistical metrics
   */
  public static calculateTimeDomain(values: number[], timestamps?: number[]): TimeDomainMetrics | null {
    const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v) && isFinite(v));
    if (valid.length === 0) return null;

    const count = valid.length;
    let min = valid[0];
    let max = valid[0];
    let sum = 0;
    let sumSquares = 0;

    for (let i = 0; i < count; i++) {
      const v = valid[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
      sumSquares += v * v;
    }

    const mean = sum / count;
    const rms = Math.sqrt(sumSquares / count);

    // Variance & StdDev
    let sumDiffSquares = 0;
    for (let i = 0; i < count; i++) {
      const diff = valid[i] - mean;
      sumDiffSquares += diff * diff;
    }
    const variance = count > 1 ? sumDiffSquares / (count - 1) : 0;
    const stdDev = Math.sqrt(variance);

    // Median (subsampled if massive array to prevent UI blocking)
    let median: number;
    if (count > 10000) {
      const step = Math.ceil(count / 10000);
      const sampled: number[] = [];
      for (let i = 0; i < count; i += step) {
        sampled.push(valid[i]);
      }
      sampled.sort((a, b) => a - b);
      median = sampled.length % 2 === 0
        ? (sampled[sampled.length / 2 - 1] + sampled[sampled.length / 2]) / 2
        : sampled[Math.floor(sampled.length / 2)];
    } else {
      const sorted = [...valid].sort((a, b) => a - b);
      median = count % 2 === 0
        ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
        : sorted[Math.floor(count / 2)];
    }

    // Zero crossings (centered around mean)
    let zeroCrossings = 0;
    for (let i = 1; i < count; i++) {
      const prev = valid[i - 1] - mean;
      const curr = valid[i] - mean;
      if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
        zeroCrossings++;
      }
    }

    // Peak detection (local maxima with simple threshold)
    const peakIndices: number[] = [];
    const threshold = mean + 0.3 * stdDev;
    for (let i = 1; i < count - 1; i++) {
      if (valid[i] > valid[i - 1] && valid[i] > valid[i + 1] && valid[i] > threshold) {
        if (peakIndices.length === 0 || i - peakIndices[peakIndices.length - 1] >= 5) {
          peakIndices.push(i);
        }
      }
    }

    // Duration and peak interval
    let durationSeconds: number | null = null;
    let meanPeakIntervalSeconds: number | null = null;

    if (timestamps && timestamps.length === values.length && timestamps.length > 1) {
      const t0 = timestamps[0];
      const tEnd = timestamps[timestamps.length - 1];
      const deltaT = Math.abs(tEnd - t0);
      durationSeconds = deltaT > 1e6 ? deltaT / 1000 : deltaT;

      if (peakIndices.length > 1) {
        const intervals: number[] = [];
        for (let j = 1; j < peakIndices.length; j++) {
          const dt = Math.abs(timestamps[peakIndices[j]] - timestamps[peakIndices[j - 1]]);
          intervals.push(dt > 1e6 ? dt / 1000 : dt);
        }
        if (intervals.length > 0) {
          meanPeakIntervalSeconds = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        }
      }
    }

    return {
      count,
      durationSeconds,
      min: Math.round(min * 10000) / 10000,
      max: Math.round(max * 10000) / 10000,
      mean: Math.round(mean * 10000) / 10000,
      median: Math.round(median * 10000) / 10000,
      variance: Math.round(variance * 10000) / 10000,
      stdDev: Math.round(stdDev * 10000) / 10000,
      rms: Math.round(rms * 10000) / 10000,
      peakToPeak: Math.round((max - min) * 10000) / 10000,
      zeroCrossings,
      detectedPeaksCount: peakIndices.length,
      meanPeakIntervalSeconds: meanPeakIntervalSeconds ? Math.round(meanPeakIntervalSeconds * 100) / 100 : null
    };
  }

  /**
   * Compute Discrete Fourier Transform (DFT / FFT) power spectrum
   */
  public static calculateFFT(values: number[], samplingRateHz: number | null): FftResult | null {
    if (!samplingRateHz || samplingRateHz <= 0) return null;

    const valid = values.filter(v => v !== null && !isNaN(v) && isFinite(v));
    if (valid.length < 16) return null;

    // Zero-mean detrending
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    const variance = valid.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / valid.length;

    // DATA INTEGRITY: If signal has near-zero variance (flatline / constant parameter),
    // no periodic respiratory AC spectrum exists.
    if (variance < 1e-6) {
      return {
        frequencies: [],
        magnitudes: [],
        dominantFrequencyHz: null,
        dominantRespiratoryBpm: null,
        peakPower: null,
        totalPower: 0,
        isRespiratoryBandValid: false
      };
    }

    const detrended = valid.map(v => v - mean);

    // Limit to power-of-2 up to 1024 or full length for performance
    const N = Math.min(1024, Math.pow(2, Math.floor(Math.log2(detrended.length))));
    if (N < 16) return null;

    const segment = detrended.slice(0, N);

    // Apply Hann window
    const windowed = segment.map((v, i) => v * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1))));

    // Cooley-Tukey Radix-2 FFT
    const real = [...windowed];
    const imag = new Array(N).fill(0);

    // Bit reversal
    let j = 0;
    for (let i = 0; i < N - 1; i++) {
      if (i < j) {
        const tempR = real[i]; real[i] = real[j]; real[j] = tempR;
        const tempI = imag[i]; imag[i] = imag[j]; imag[j] = tempI;
      }
      let k = N >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    // Butterfly computations
    for (let l = 2; l <= N; l <<= 1) {
      const halfL = l >> 1;
      const angle = (-2 * Math.PI) / l;
      const wStepR = Math.cos(angle);
      const wStepI = Math.sin(angle);

      for (let i = 0; i < N; i += l) {
        let wR = 1;
        let wI = 0;
        for (let k = 0; k < halfL; k++) {
          const uR = real[i + k];
          const uI = imag[i + k];
          const vR = real[i + k + halfL] * wR - imag[i + k + halfL] * wI;
          const vI = real[i + k + halfL] * wI + imag[i + k + halfL] * wR;

          real[i + k] = uR + vR;
          imag[i + k] = uI + vI;
          real[i + k + halfL] = uR - vR;
          imag[i + k + halfL] = uI - vI;

          const nextWR = wR * wStepR - wI * wStepI;
          wI = wR * wStepI + wI * wStepR;
          wR = nextWR;
        }
      }
    }

    // Magnitude spectrum for positive frequencies (up to Nyquist = Fs / 2)
    const numFreqs = N / 2;
    const frequencies: number[] = [];
    const magnitudes: number[] = [];

    let peakMag = -1;
    let peakIdx = -1;
    let totalPower = 0;

    for (let k = 1; k < numFreqs; k++) {
      const freq = (k * samplingRateHz) / N;
      const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]) / N;
      frequencies.push(Math.round(freq * 1000) / 1000);
      magnitudes.push(Math.round(mag * 10000) / 10000);
      totalPower += mag * mag;

      // Focus on respiratory frequency band (0.08 Hz to 0.75 Hz = 5 to 45 bpm)
      if (freq >= 0.08 && freq <= 0.75) {
        if (mag > peakMag) {
          peakMag = mag;
          peakIdx = k;
        }
      }
    }

    const dominantFrequencyHz = peakIdx !== -1 ? (peakIdx * samplingRateHz) / N : null;
    const dominantRespiratoryBpm = dominantFrequencyHz ? Math.round(dominantFrequencyHz * 60 * 10) / 10 : null;

    return {
      frequencies,
      magnitudes,
      dominantFrequencyHz: dominantFrequencyHz ? Math.round(dominantFrequencyHz * 1000) / 1000 : null,
      dominantRespiratoryBpm,
      peakPower: peakMag > 0 ? Math.round(peakMag * 10000) / 10000 : null,
      totalPower: Math.round(totalPower * 10000) / 10000,
      isRespiratoryBandValid: dominantFrequencyHz !== null
    };
  }

  /**
   * Short-Time Fourier Transform (STFT) for Spectrogram
   */
  public static calculateSpectrogram(
    values: number[],
    samplingRateHz: number | null,
    windowSize = 64,
    overlapPct = 50
  ): SpectrogramResult | null {
    if (!samplingRateHz || values.length < windowSize) return null;

    const rawStep = Math.max(1, Math.floor(windowSize * (1 - overlapPct / 100)));
    const totalSteps = Math.floor((values.length - windowSize) / rawStep);
    // Limit to at most 100 time columns for smooth rendering
    const step = totalSteps > 100 ? Math.max(1, Math.floor((values.length - windowSize) / 100)) : rawStep;
    const times: number[] = [];
    const spectrogramMatrix: number[][] = [];
    const numFreqs = windowSize / 2;

    const frequencies: number[] = [];
    for (let k = 0; k < numFreqs; k++) {
      frequencies.push(Math.round(((k * samplingRateHz) / windowSize) * 100) / 100);
    }

    let minPower = Infinity;
    let maxPower = -Infinity;

    for (let start = 0; start + windowSize <= values.length; start += step) {
      const windowData = values.slice(start, start + windowSize);
      const mean = windowData.reduce((a, b) => a + b, 0) / windowSize;

      // Real DFT for window
      const slicePowers: number[] = [];
      for (let k = 0; k < numFreqs; k++) {
        let r = 0;
        let im = 0;
        for (let n = 0; n < windowSize; n++) {
          const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (windowSize - 1))); // Hann
          const val = (windowData[n] - mean) * w;
          const angle = (-2 * Math.PI * k * n) / windowSize;
          r += val * Math.cos(angle);
          im += val * Math.sin(angle);
        }
        const power = (r * r + im * im) / (windowSize * windowSize);
        slicePowers.push(power);
        if (power < minPower) minPower = power;
        if (power > maxPower) maxPower = power;
      }

      times.push(Math.round(((start + windowSize / 2) / samplingRateHz) * 10) / 10);
      spectrogramMatrix.push(slicePowers);
    }

    return {
      times,
      frequencies,
      spectrogramMatrix,
      minPower: minPower === Infinity ? 0 : minPower,
      maxPower: maxPower === -Infinity ? 1 : maxPower
    };
  }

  /**
   * Pearson Correlation Coefficient between two numeric series
   */
  public static calculatePearsonCorrelation(x: number[], y: number[]): number | null {
    if (!x || !y || x.length !== y.length || x.length < 3) return null;

    let validCount = 0;
    let sumX = 0;
    let sumY = 0;

    for (let i = 0; i < x.length; i++) {
      if (!isNaN(x[i]) && !isNaN(y[i]) && isFinite(x[i]) && isFinite(y[i])) {
        sumX += x[i];
        sumY += y[i];
        validCount++;
      }
    }

    if (validCount < 3) return null;

    const meanX = sumX / validCount;
    const meanY = sumY / validCount;

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < x.length; i++) {
      if (!isNaN(x[i]) && !isNaN(y[i]) && isFinite(x[i]) && isFinite(y[i])) {
        const dx = x[i] - meanX;
        const dy = y[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }
    }

    const den = Math.sqrt(denX * denY);
    if (den === 0) return 0;

    return Math.round((num / den) * 10000) / 10000;
  }

  /**
   * Detect Candidate Respiratory Events (amplitude envelope collapse >= 70% for >= 10s)
   */
  public static detectCandidateEvents(
    values: number[],
    timestamps?: number[],
    samplingRateHz?: number | null
  ): CandidateRespiratoryEvent[] {
    const events: CandidateRespiratoryEvent[] = [];
    const valid = values.filter(v => v !== null && !isNaN(v) && isFinite(v));
    if (valid.length < 50) return events;

    const fs = samplingRateHz || 20; // Default or calculated
    const windowSamples = Math.round(fs * 4); // 4-second baseline window

    // Subsample step for massive arrays (> 10,000 samples)
    const step = valid.length > 10000 ? Math.max(1, Math.floor(fs / 2)) : 1;
    const effectiveFs = fs / step;

    // Calculate moving standard deviation (envelope amplitude proxy)
    const envelope: number[] = [];
    const envIndices: number[] = [];

    for (let i = 0; i < valid.length; i += step) {
      const start = Math.max(0, i - Math.floor(windowSamples / 2));
      const end = Math.min(valid.length, i + Math.floor(windowSamples / 2));
      const sliceLen = end - start;
      let sum = 0;
      for (let k = start; k < end; k++) sum += valid[k];
      const m = sum / sliceLen;
      let sumSq = 0;
      for (let k = start; k < end; k++) {
        const diff = valid[k] - m;
        sumSq += diff * diff;
      }
      envelope.push(Math.sqrt(sumSq / sliceLen));
      envIndices.push(i);
    }

    // Baseline median envelope amplitude
    let baselineEnv: number;
    if (envelope.length > 10000) {
      const sStep = Math.ceil(envelope.length / 10000);
      const sEnv: number[] = [];
      for (let i = 0; i < envelope.length; i += sStep) sEnv.push(envelope[i]);
      sEnv.sort((a, b) => a - b);
      baselineEnv = sEnv[Math.floor(sEnv.length * 0.75)];
    } else {
      const sortedEnv = [...envelope].sort((a, b) => a - b);
      baselineEnv = sortedEnv[Math.floor(sortedEnv.length * 0.75)]; // 75th percentile healthy breathing
    }
    if (baselineEnv <= 0.001) return events;

    const apneaThreshold = baselineEnv * 0.25; // 75% reduction
    const hypopneaThreshold = baselineEnv * 0.50; // 50% reduction
    const minEventSamples = Math.round(effectiveFs * 10); // Minimum 10 seconds per clinical definitions

    let inEvent = false;
    let eventStart = 0;
    let eventType: 'CANDIDATE_APNEA' | 'CANDIDATE_HYPOPNEA' = 'CANDIDATE_APNEA';

    for (let i = 0; i < envelope.length; i++) {
      if (!inEvent && envelope[i] < hypopneaThreshold) {
        inEvent = true;
        eventStart = i;
        eventType = envelope[i] < apneaThreshold ? 'CANDIDATE_APNEA' : 'CANDIDATE_HYPOPNEA';
      } else if (inEvent && (envelope[i] >= hypopneaThreshold || i === envelope.length - 1)) {
        const durationSamples = i - eventStart;
        if (durationSamples >= minEventSamples) {
          const rawIdxStart = envIndices[eventStart];
          const rawIdxEnd = envIndices[i];
          const tStart = timestamps && timestamps[rawIdxStart] ? timestamps[rawIdxStart] / 1000 : rawIdxStart / fs;
          const tEnd = timestamps && timestamps[rawIdxEnd] ? timestamps[rawIdxEnd] / 1000 : rawIdxEnd / fs;

          let evSum = 0;
          for (let k = eventStart; k < i; k++) evSum += envelope[k];
          const eventMean = evSum / durationSamples;
          const dropPct = Math.round((1 - eventMean / baselineEnv) * 100);

          events.push({
            id: `EVT-${events.length + 1}`,
            startTimeSec: Math.round(tStart * 10) / 10,
            endTimeSec: Math.round(tEnd * 10) / 10,
            durationSec: Math.round((durationSamples / effectiveFs) * 10) / 10,
            type: eventType,
            amplitudeReductionPct: dropPct,
            preEventMean: Math.round(baselineEnv * 1000) / 1000,
            duringEventMean: Math.round(eventMean * 1000) / 1000
          });
        }
        inEvent = false;
      }
    }

    return events;
  }

  /**
   * Reference vs Estimated Validation Metrics
   */
  public static calculateReferenceValidation(estimated: number[], reference: number[]): ReferenceComparisonResult | null {
    if (!estimated || !reference || estimated.length !== reference.length) return null;

    const pairs: Array<{ est: number; ref: number }> = [];
    for (let i = 0; i < estimated.length; i++) {
      const e = estimated[i];
      const r = reference[i];
      if (e !== null && r !== null && !isNaN(e) && !isNaN(r) && isFinite(e) && isFinite(r)) {
        pairs.push({ est: e, ref: r });
      }
    }

    if (pairs.length < 5) return null;

    let sumAbsError = 0;
    let sumSqError = 0;
    let sumError = 0;
    let minErr = Infinity;
    let maxErr = -Infinity;

    pairs.forEach(p => {
      const err = p.est - p.ref;
      const absErr = Math.abs(err);
      sumAbsError += absErr;
      sumSqError += err * err;
      sumError += err;
      if (err < minErr) minErr = err;
      if (err > maxErr) maxErr = err;
    });

    const n = pairs.length;
    const mae = sumAbsError / n;
    const rmse = Math.sqrt(sumSqError / n);
    const meanError = sumError / n;
    const bias = meanError;

    const estList = pairs.map(p => p.est);
    const refList = pairs.map(p => p.ref);
    const corr = this.calculatePearsonCorrelation(estList, refList) ?? 0;

    return {
      pairedCount: n,
      mae: Math.round(mae * 100) / 100,
      rmse: Math.round(rmse * 100) / 100,
      meanError: Math.round(meanError * 100) / 100,
      bias: Math.round(bias * 100) / 100,
      pearsonCorrelation: corr,
      minError: Math.round(minErr * 100) / 100,
      maxError: Math.round(maxErr * 100) / 100
    };
  }
}
