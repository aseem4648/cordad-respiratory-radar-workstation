/**
 * Contactless Respiratory Radar Digital Signal Processing (DSP) Pipeline
 * 
 * Features:
 * - 4th-order Butterworth bandpass filter (0.1–0.7 Hz, physiological 6–42 BPM band)
 * - Chest wall micro-displacement estimation (0.1–12 mm)
 * - Adaptive peak detection & RR calculation
 * - Signal Quality Index (SQI 0–100%) calculation
 * - Clinical Respiratory Event Classification (Normal, Apnea, Bradypnea, Tachypnea, Low SQI)
 */

import { RespiratoryBandpassFilter } from '../signalProcessing/filter';
import { RespiratoryRateEstimator } from '../signalProcessing/respiratoryEstimator';
import { SignalQualityCalculator } from '../signalProcessing/signalQuality';
import { RespiratoryEventDetector } from '../signalProcessing/eventDetector';
import { RespiratoryEventState } from '../../../hardware-interface/types';

export interface DSPProcessingResult {
  filteredSignal: number;
  displacementMm: number;
  respiratoryRate: number | null;
  rrSource: 'CALCULATED_RADAR_DSP' | 'RADAR_ONBOARD_FIRMWARE' | 'UNAVAILABLE';
  signalQuality: number;
  presence: boolean | null;
  targetDistance: number | null;
  event: RespiratoryEventState;
  eventDurationSeconds: number;
}

export class RespiratorySignalProcessor {
  private filter: RespiratoryBandpassFilter;
  private estimator: RespiratoryRateEstimator;
  private qualityCalc: SignalQualityCalculator;
  private eventDetector: RespiratoryEventDetector;
  private sampleRateHz: number;

  constructor(
    sampleRateHz: number = 20,
    lowCutHz: number = 0.1,
    highCutHz: number = 0.7,
    apneaThresholdSec: number = 10,
    tachypneaBpm: number = 24,
    bradypneaBpm: number = 10,
    minQuality: number = 40
  ) {
    this.sampleRateHz = sampleRateHz;
    this.filter = new RespiratoryBandpassFilter({
      sampleRateHz,
      lowCutHz,
      highCutHz
    });
    this.estimator = new RespiratoryRateEstimator(sampleRateHz, 25);
    this.qualityCalc = new SignalQualityCalculator(sampleRateHz, 10);
    this.eventDetector = new RespiratoryEventDetector(
      apneaThresholdSec,
      tachypneaBpm,
      bradypneaBpm,
      minQuality,
      sampleRateHz
    );
  }

  /**
   * Process a single incoming radar displacement sample
   */
  public processSample(
    rawSample: number,
    hardwareRR: number | null = null,
    presence: boolean | null = null,
    targetDistance: number | null = null,
    rawQuality: number | null = null,
    timestamp: number = Date.now()
  ): DSPProcessingResult {
    // 1. Butterworth bandpass filtering (0.1–0.7 Hz)
    const filtered = this.filter.process(rawSample);

    // 2. Chest wall micro-displacement estimation (calibrated range: 0.1–12.0 mm)
    const displacementMm = Math.round(Math.abs(filtered * 8.5) * 100) / 100;

    // 3. Signal Quality Index (SQI)
    let sqi: number;
    if (rawQuality !== null && !isNaN(rawQuality) && rawQuality > 0) {
      sqi = Math.min(100, Math.max(0, Math.round(rawQuality)));
    } else {
      const qRes = this.qualityCalc.update(filtered, rawSample);
      sqi = qRes.sqi;
    }

    // 4. Peak detection & Breathing Rate (BPM)
    const estimatorRes = this.estimator.addSample(filtered, timestamp);
    let finalRR = hardwareRR;
    let rrSource: 'CALCULATED_RADAR_DSP' | 'RADAR_ONBOARD_FIRMWARE' | 'UNAVAILABLE' = 'UNAVAILABLE';

    if (finalRR !== null && finalRR > 0) {
      rrSource = 'RADAR_ONBOARD_FIRMWARE';
    } else if (estimatorRes.respiratoryRateBpm !== null && estimatorRes.respiratoryRateBpm > 0 && sqi >= 30) {
      finalRR = Math.round(estimatorRes.respiratoryRateBpm * 10) / 10;
      rrSource = 'CALCULATED_RADAR_DSP';
    }

    // 5. Clinical Event Classification
    const eventResult = this.eventDetector.evaluate({
      timestamp,
      filteredSignal: filtered,
      respiratoryRate: finalRR,
      signalQuality: sqi,
      presence,
      isRadarConnected: true,
      sampleRateHz: this.sampleRateHz
    });

    return {
      filteredSignal: filtered,
      displacementMm,
      respiratoryRate: finalRR,
      rrSource,
      signalQuality: sqi,
      presence,
      targetDistance,
      event: eventResult.currentState,
      eventDurationSeconds: eventResult.durationSeconds
    };
  }

  public updateConfig(config: {
    sampleRateHz?: number;
    lowCutHz?: number;
    highCutHz?: number;
    apneaThresholdSec?: number;
    tachypneaBpm?: number;
    bradypneaBpm?: number;
    minQuality?: number;
  }) {
    if (config.sampleRateHz) {
      this.sampleRateHz = config.sampleRateHz;
      this.filter.updateConfig({ sampleRateHz: this.sampleRateHz });
    }
    if (config.lowCutHz || config.highCutHz) {
      this.filter.updateConfig({
        lowCutHz: config.lowCutHz,
        highCutHz: config.highCutHz
      });
    }
    this.eventDetector.updateSettings({
      apneaThresholdSec: config.apneaThresholdSec,
      tachypneaThresholdBpm: config.tachypneaBpm,
      bradypneaThresholdBpm: config.bradypneaBpm,
      minSignalQuality: config.minQuality
    });
  }

  public reset() {
    this.filter.resetState();
    this.qualityCalc = new SignalQualityCalculator(this.sampleRateHz, 10);
    this.estimator = new RespiratoryRateEstimator(this.sampleRateHz, 25);
  }
}
