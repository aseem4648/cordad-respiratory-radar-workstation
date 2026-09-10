import { RawRadarPayload } from './types';

export class PacketParser {
  public static parseString(data: string): RawRadarPayload | null {
    const trimmed = data.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return {
          rawTimestamp: parsed.timestamp || parsed.t || Date.now(),
          rawSignal: parsed.respiration_signal ?? parsed.signal ?? parsed.s ?? parsed.val,
          hardwareRR: parsed.respiratory_rate ?? parsed.rr ?? parsed.bpm ?? null,
          presence: parsed.presence ?? parsed.target ?? parsed.p ?? null,
          distance: parsed.target_distance ?? parsed.distance ?? parsed.dist ?? parsed.d ?? null,
          rawQuality: parsed.signal_quality ?? parsed.quality ?? parsed.sqi ?? parsed.q ?? null,
          heartRate: parsed.heart_rate ?? parsed.hr ?? null,
          deviceId: parsed.device_id ?? parsed.id ?? 'ESP32_RADAR_24G'
        };
      } catch (err) {
        return null;
      }
    }

    if (trimmed.startsWith('$RADAR')) {
      const parts = trimmed.split(',');
      if (parts.length >= 3) {
        return {
          rawTimestamp: parts[1] ? Number(parts[1]) : Date.now(),
          rawSignal: parts[2] ? Number(parts[2]) : null,
          distance: parts[3] ? Number(parts[3]) : null,
          presence: parts[4] ? parts[4] === '1' || parts[4].toLowerCase() === 'true' : null,
          rawQuality: parts[5] ? Number(parts[5]) : null,
          deviceId: 'UART_SERIAL_STREAM'
        };
      }
    }

    const num = parseFloat(trimmed);
    if (!isNaN(num) && isFinite(num)) {
      return {
        rawTimestamp: Date.now(),
        rawSignal: num,
        deviceId: 'RAW_FLOAT_STREAM'
      };
    }

    return null;
  }
}
