import { RespiratoryEventState } from '../../../hardware-interface/types';

export interface EventDetectionInput {
  timestamp: number;
  filteredSignal: number | null;
  respiratoryRate: number | null;
  signalQuality: number | null;
  presence: boolean | null;
  isRadarConnected: boolean;
  sampleRateHz: number;
}

export interface EventDetectionOutput {
  currentState: RespiratoryEventState;
  stateLabel: string;
  durationSeconds: number;
  hasStateChanged: boolean;
  previousState: RespiratoryEventState;
  severity: 'normal' | 'warning' | 'critical' | 'info';
  details: string;
}

export class RespiratoryEventDetector {
  private apneaThresholdSec: number;
  private tachypneaThresholdBpm: number;
  private bradypneaThresholdBpm: number;
  private minSignalQuality: number;

  private currentState: RespiratoryEventState = 'WAITING_FOR_DATA';
  private stateStartTime: number = Date.now();
  private flatlineStartTime: number | null = null;
  private recentAmplitudes: number[] = [];
  private amplitudeWindowSize: number;

  constructor(
    apneaThresholdSec = 10,
    tachypneaThresholdBpm = 25,
    bradypneaThresholdBpm = 10,
    minSignalQuality = 35,
    sampleRateHz = 20
  ) {
    this.apneaThresholdSec = apneaThresholdSec;
    this.tachypneaThresholdBpm = tachypneaThresholdBpm;
    this.bradypneaThresholdBpm = bradypneaThresholdBpm;
    this.minSignalQuality = minSignalQuality;
    this.amplitudeWindowSize = Math.round(sampleRateHz * 3);
  }

  public updateSettings(params: {
    apneaThresholdSec?: number;
    tachypneaThresholdBpm?: number;
    bradypneaThresholdBpm?: number;
    minSignalQuality?: number;
  }) {
    if (params.apneaThresholdSec !== undefined) this.apneaThresholdSec = params.apneaThresholdSec;
    if (params.tachypneaThresholdBpm !== undefined) this.tachypneaThresholdBpm = params.tachypneaThresholdBpm;
    if (params.bradypneaThresholdBpm !== undefined) this.bradypneaThresholdBpm = params.bradypneaThresholdBpm;
    if (params.minSignalQuality !== undefined) this.minSignalQuality = params.minSignalQuality;
  }

  public evaluate(input: EventDetectionInput): EventDetectionOutput {
    const now = input.timestamp || Date.now();
    const prev = this.currentState;
    let nextState: RespiratoryEventState = 'WAITING_FOR_DATA';
    let details = '';

    if (!input.isRadarConnected || input.filteredSignal === null) {
      nextState = 'WAITING_FOR_DATA';
      details = 'Radar stream is inactive or disconnected';
      this.flatlineStartTime = null;
    }
    else if (input.presence === false) {
      nextState = 'NO_TARGET';
      details = 'No target detected in 24 GHz radar field of view';
      this.flatlineStartTime = null;
    }
    else if (input.signalQuality !== null && input.signalQuality < this.minSignalQuality) {
      nextState = 'INSUFFICIENT_SIGNAL';
      details = `Radar signal quality degraded (${input.signalQuality}% < threshold ${this.minSignalQuality}%)`;
      this.flatlineStartTime = null;
    }
    else {
      this.recentAmplitudes.push(Math.abs(input.filteredSignal));
      if (this.recentAmplitudes.length > this.amplitudeWindowSize) {
        this.recentAmplitudes.shift();
      }

      const avgAmplitude = this.recentAmplitudes.reduce((a, b) => a + b, 0) / this.recentAmplitudes.length;

      if (avgAmplitude < 0.012) {
        if (!this.flatlineStartTime) {
          this.flatlineStartTime = now;
        }

        const flatlineDurationSec = (now - this.flatlineStartTime) / 1000;
        if (flatlineDurationSec >= this.apneaThresholdSec) {
          nextState = 'POSSIBLE_APNEA';
          details = `Cessation of respiratory motion detected for ${flatlineDurationSec.toFixed(1)}s (threshold: ${this.apneaThresholdSec}s)`;
        } else {
          nextState = 'POSSIBLE_ABNORMAL_RESPIRATION';
          details = `Reduced respiratory amplitude for ${flatlineDurationSec.toFixed(1)}s`;
        }
      } else {
        this.flatlineStartTime = null;

        if (input.respiratoryRate !== null) {
          if (input.respiratoryRate > this.tachypneaThresholdBpm) {
            nextState = 'TACHYPNEA';
            details = `Elevated respiratory rate (${input.respiratoryRate} BPM > ${this.tachypneaThresholdBpm} BPM)`;
          } else if (input.respiratoryRate < this.bradypneaThresholdBpm) {
            nextState = 'BRADYPNEA';
            details = `Reduced respiratory rate (${input.respiratoryRate} BPM < ${this.bradypneaThresholdBpm} BPM)`;
          } else {
            nextState = 'NORMAL_BREATHING';
            details = `Stable respiration within normal limits (${input.respiratoryRate} BPM)`;
          }
        } else {
          nextState = 'NORMAL_BREATHING';
          details = 'Respiratory oscillation detected (calculating rate)';
        }
      }
    }

    const hasStateChanged = nextState !== prev;
    if (hasStateChanged) {
      this.currentState = nextState;
      this.stateStartTime = now;
    }

    const durationSeconds = Math.max(0, Math.round(((now - this.stateStartTime) / 1000) * 10) / 10);
    const { label, severity } = this.formatState(this.currentState);

    return {
      currentState: this.currentState,
      stateLabel: label,
      durationSeconds,
      hasStateChanged,
      previousState: prev,
      severity,
      details
    };
  }

  private formatState(state: RespiratoryEventState): { label: string; severity: 'normal' | 'warning' | 'critical' | 'info' } {
    switch (state) {
      case 'NORMAL_BREATHING':
        return { label: 'NORMAL BREATHING', severity: 'normal' };
      case 'POSSIBLE_APNEA':
        return { label: 'POSSIBLE APNEA EVENT', severity: 'critical' };
      case 'POSSIBLE_ABNORMAL_RESPIRATION':
        return { label: 'POSSIBLE ABNORMAL RESPIRATION', severity: 'warning' };
      case 'TACHYPNEA':
        return { label: 'POSSIBLE TACHYPNEA (RAPID)', severity: 'warning' };
      case 'BRADYPNEA':
        return { label: 'POSSIBLE BRADYPNEA (SLOW)', severity: 'warning' };
      case 'MOTION_ARTIFACT':
        return { label: 'MOTION ARTIFACT DETECTED', severity: 'warning' };
      case 'INSUFFICIENT_SIGNAL':
        return { label: 'INSUFFICIENT SIGNAL', severity: 'warning' };
      case 'NO_TARGET':
        return { label: 'NO TARGET DETECTED', severity: 'info' };
      case 'WAITING_FOR_DATA':
      default:
        return { label: 'WAITING FOR DATA', severity: 'info' };
    }
  }

  public reset() {
    this.currentState = 'WAITING_FOR_DATA';
    this.stateStartTime = Date.now();
    this.flatlineStartTime = null;
    this.recentAmplitudes = [];
  }
}
