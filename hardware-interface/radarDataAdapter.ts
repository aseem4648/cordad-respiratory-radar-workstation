import { RawRadarPayload, StandardRadarPacket } from './types';

export class RadarDataAdapter {
  private packetCounter = 0;
  private lastTimestamp = 0;
  private packetLossCounter = 0;

  public adapt(raw: RawRadarPayload, isDemo = false): StandardRadarPacket {
    this.packetCounter++;
    const now = Date.now();
    const timestamp = typeof raw.rawTimestamp === 'number' && !isNaN(raw.rawTimestamp) 
      ? raw.rawTimestamp 
      : now;

    if (this.lastTimestamp > 0 && timestamp - this.lastTimestamp > 250) {
      this.packetLossCounter++;
    }
    this.lastTimestamp = timestamp;

    let signal: number | null = null;
    if (raw.rawSignal !== undefined && raw.rawSignal !== null) {
      const parsed = typeof raw.rawSignal === 'number' ? raw.rawSignal : parseFloat(String(raw.rawSignal));
      if (!isNaN(parsed) && isFinite(parsed)) {
        signal = parsed;
      }
    }

    let hardwareRR: number | null = null;
    let rrSource: 'CALCULATED_RADAR_DSP' | 'RADAR_ONBOARD_FIRMWARE' | 'UNAVAILABLE' = 'UNAVAILABLE';
    if (raw.hardwareRR !== undefined && raw.hardwareRR !== null) {
      const parsedRR = typeof raw.hardwareRR === 'number' ? raw.hardwareRR : parseFloat(String(raw.hardwareRR));
      if (!isNaN(parsedRR) && isFinite(parsedRR) && parsedRR > 0) {
        hardwareRR = Math.round(parsedRR * 10) / 10;
        rrSource = 'RADAR_ONBOARD_FIRMWARE';
      }
    }

    let presence: boolean | null = null;
    if (raw.presence !== undefined && raw.presence !== null) {
      if (typeof raw.presence === 'boolean') {
        presence = raw.presence;
      } else if (typeof raw.presence === 'number') {
        presence = raw.presence > 0;
      } else if (typeof raw.presence === 'string') {
        presence = raw.presence.toLowerCase() === 'true' || raw.presence === '1';
      }
    }

    let targetDistance: number | null = null;
    if (raw.distance !== undefined && raw.distance !== null) {
      const parsedDist = typeof raw.distance === 'number' ? raw.distance : parseFloat(String(raw.distance));
      if (!isNaN(parsedDist) && isFinite(parsedDist) && parsedDist >= 0) {
        targetDistance = Math.round(parsedDist * 100) / 100;
      }
    }

    let signalQuality: number | null = null;
    if (raw.rawQuality !== undefined && raw.rawQuality !== null) {
      const parsedQ = typeof raw.rawQuality === 'number' ? raw.rawQuality : parseFloat(String(raw.rawQuality));
      if (!isNaN(parsedQ) && isFinite(parsedQ)) {
        signalQuality = Math.min(100, Math.max(0, Math.round(parsedQ)));
      }
    }

    return {
      timestamp,
      isoTimestamp: new Date(timestamp).toISOString(),
      signal,
      filteredSignal: null,
      respiratoryRate: hardwareRR,
      rrSource,
      signalQuality,
      presence,
      targetDistance,
      event: 'WAITING_FOR_DATA',
      eventDurationSeconds: 0,
      isDemo,
      packetIndex: this.packetCounter
    };
  }

  public getStats() {
    return {
      totalPackets: this.packetCounter,
      packetLoss: this.packetLossCounter,
      lastTimestamp: this.lastTimestamp
    };
  }

  public resetStats() {
    this.packetCounter = 0;
    this.packetLossCounter = 0;
    this.lastTimestamp = 0;
  }
}

export const radarDataAdapter = new RadarDataAdapter();
