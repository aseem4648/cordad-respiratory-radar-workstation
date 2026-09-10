import { RawRadarPayload } from '../../../hardware-interface/types';

export type DemoScenario = 
  | 'NORMAL_BREATHING'
  | 'TACHYPNEA'
  | 'BRADYPNEA'
  | 'POSSIBLE_APNEA'
  | 'MOTION_ARTIFACT'
  | 'SIGNAL_DROP'
  | 'TARGET_ABSENT'
  | 'RADAR_DISCONNECTED';

export class RespiratorySignalGenerator {
  private sampleRateHz: number;
  private scenario: DemoScenario = 'NORMAL_BREATHING';
  private timeStep = 0;
  private apneaTimer = 0;

  constructor(sampleRateHz = 20) {
    this.sampleRateHz = sampleRateHz;
  }

  public setScenario(scenario: DemoScenario) {
    this.scenario = scenario;
    this.apneaTimer = 0;
  }

  public getScenario(): DemoScenario {
    return this.scenario;
  }

  public getNextSample(): RawRadarPayload | null {
    if (this.scenario === 'RADAR_DISCONNECTED') {
      return null;
    }

    this.timeStep++;
    const t = this.timeStep / this.sampleRateHz;
    const now = Date.now();

    let presence: boolean | null = true;
    let distance: number | null = 1.38 + 0.02 * Math.sin(t * 0.05);
    let rawQuality = 92;
    let signal = 0;

    switch (this.scenario) {
      case 'NORMAL_BREATHING': {
        const freq = 0.267;
        const respWave = this.generateBreathingWaveform(t, freq, 0.14);
        const cardiac = 0.008 * Math.sin(2 * Math.PI * 1.15 * t);
        const baseline = 0.02 * Math.sin(2 * Math.PI * 0.02 * t);
        const noise = (Math.random() - 0.5) * 0.006;
        signal = respWave + cardiac + baseline + noise;
        rawQuality = 92 + Math.round(5 * (Math.random() - 0.5));
        break;
      }

      case 'TACHYPNEA': {
        const freq = 0.467;
        const respWave = this.generateBreathingWaveform(t, freq, 0.09);
        const baseline = 0.015 * Math.sin(2 * Math.PI * 0.03 * t);
        const noise = (Math.random() - 0.5) * 0.008;
        signal = respWave + baseline + noise;
        rawQuality = 85 + Math.round(6 * (Math.random() - 0.5));
        break;
      }

      case 'BRADYPNEA': {
        const freq = 0.133;
        const respWave = this.generateBreathingWaveform(t, freq, 0.22);
        const cardiac = 0.01 * Math.sin(2 * Math.PI * 1.0 * t);
        const noise = (Math.random() - 0.5) * 0.005;
        signal = respWave + cardiac + noise;
        rawQuality = 90 + Math.round(4 * (Math.random() - 0.5));
        break;
      }

      case 'POSSIBLE_APNEA': {
        this.apneaTimer += 1 / this.sampleRateHz;
        if (this.apneaTimer > 28) {
          this.apneaTimer = 0;
        }

        if (this.apneaTimer >= 8 && this.apneaTimer <= 22) {
          const cardiac = 0.003 * Math.sin(2 * Math.PI * 1.1 * t);
          const noise = (Math.random() - 0.5) * 0.003;
          signal = cardiac + noise;
          rawQuality = 88;
        } else if (this.apneaTimer > 22 && this.apneaTimer <= 24) {
          signal = 0.28 * Math.sin(2 * Math.PI * 0.3 * (t - 22));
          rawQuality = 82;
        } else {
          signal = this.generateBreathingWaveform(t, 0.25, 0.14) + (Math.random() - 0.5) * 0.005;
          rawQuality = 91;
        }
        break;
      }

      case 'MOTION_ARTIFACT': {
        const noise = (Math.random() - 0.5) * 0.8;
        const lowFreqSway = 0.4 * Math.sin(2 * Math.PI * 0.8 * t);
        signal = lowFreqSway + noise;
        rawQuality = 25;
        break;
      }

      case 'SIGNAL_DROP': {
        signal = 0.02 * Math.sin(2 * Math.PI * 0.25 * t) + (Math.random() - 0.5) * 0.1;
        rawQuality = 18;
        break;
      }

      case 'TARGET_ABSENT': {
        presence = false;
        distance = null;
        signal = (Math.random() - 0.5) * 0.002;
        rawQuality = 0;
        break;
      }
    }

    return {
      rawTimestamp: now,
      rawSignal: Math.round(signal * 10000) / 10000,
      presence,
      distance,
      rawQuality,
      deviceId: 'DEMO_24GHZ_FMCW_SIMULATOR'
    };
  }

  private generateBreathingWaveform(t: number, freqHz: number, amplitude: number): number {
    const phase = (2 * Math.PI * freqHz * t) % (2 * Math.PI);
    const wave = Math.sin(phase) + 0.25 * Math.sin(2 * phase - Math.PI / 4);
    return wave * amplitude;
  }

  public reset() {
    this.timeStep = 0;
    this.apneaTimer = 0;
  }
}
