/**
 * 24 GHz FMCW Respiratory Radar Packet & Binary Frame Parser
 * Supports Seeed MR24BSD1, NMEA $RADAR strings, and JSON telemetry payloads.
 */

import { RawRadarPayload } from '../../../hardware-interface/types';

export interface MR24BSD1ParsedFrame {
  type: 'PRESENCE' | 'RESPIRATION' | 'DISTANCE' | 'MOVEMENT' | 'RAW_WAVEFORM' | 'UNKNOWN';
  presence?: boolean;
  respiratoryRate?: number;
  displacementMm?: number;
  targetDistance?: number;
  movementParam?: number;
  signalQuality?: number;
  rawPayload?: RawRadarPayload;
}

export class RadarParser {
  private buffer: Buffer = Buffer.alloc(0);

  /**
   * Parses string data (JSON, $RADAR CSV, or raw float) into a standardized RawRadarPayload
   */
  public static parseString(data: string): RawRadarPayload | null {
    const trimmed = data.trim();
    if (!trimmed) return null;

    // JSON format
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return {
          rawTimestamp: parsed.timestamp || parsed.t || Date.now(),
          rawSignal: parsed.respiration_signal ?? parsed.signal ?? parsed.s ?? parsed.val ?? parsed.displacement,
          hardwareRR: parsed.respiratory_rate ?? parsed.rr ?? parsed.bpm ?? null,
          presence: parsed.presence ?? parsed.target ?? parsed.p ?? null,
          distance: parsed.target_distance ?? parsed.distance ?? parsed.dist ?? parsed.d ?? null,
          rawQuality: parsed.signal_quality ?? parsed.quality ?? parsed.sqi ?? parsed.q ?? null,
          heartRate: parsed.heart_rate ?? parsed.hr ?? null,
          deviceId: parsed.device_id ?? parsed.id ?? 'SEEED_MR24BSD1_24G'
        };
      } catch (err) {
        return null;
      }
    }

    // $RADAR CSV format ($RADAR,timestamp,signal,distance,presence,quality)
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

    // Pure raw floating-point displacement stream
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

  /**
   * Ingests chunk of binary data from serial stream and extracts Seeed MR24BSD1 frames
   * Frame structure: 0x53 0x59 [Control] [Command] [Len_H] [Len_L] [Data...] [Checksum] 0x54 0x43
   */
  public parseBinaryChunk(chunk: Buffer): RawRadarPayload[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const payloads: RawRadarPayload[] = [];

    while (this.buffer.length >= 10) {
      // Look for SOF (0x53, 0x59)
      const sofIndex = this.findSOF(this.buffer);
      if (sofIndex === -1) {
        // Keep last byte in case SOF is split across chunks
        this.buffer = this.buffer.slice(Math.max(0, this.buffer.length - 1));
        break;
      }

      if (sofIndex > 0) {
        this.buffer = this.buffer.slice(sofIndex);
      }

      if (this.buffer.length < 10) break;

      const control = this.buffer[2];
      const command = this.buffer[3];
      const length = (this.buffer[4] << 8) | this.buffer[5];
      const totalFrameLen = 6 + length + 1 + 2; // SOF(2) + Ctrl(1) + Cmd(1) + Len(2) + Data(len) + Crc(1) + EOF(2)

      if (this.buffer.length < totalFrameLen) {
        // Frame not fully received yet
        break;
      }

      // Check EOF (0x54, 0x43)
      const eof1 = this.buffer[totalFrameLen - 2];
      const eof2 = this.buffer[totalFrameLen - 1];
      if (eof1 === 0x54 && eof2 === 0x43) {
        // Validate checksum: sum of all bytes prior to checksum modulo 256
        let sum = 0;
        for (let i = 0; i < totalFrameLen - 3; i++) {
          sum += this.buffer[i];
        }
        const expectedCrc = sum & 0xff;
        const actualCrc = this.buffer[totalFrameLen - 3];

        if (expectedCrc === actualCrc) {
          const dataPayload = this.buffer.slice(6, 6 + length);
          const raw = this.decodeMR24Frame(control, command, dataPayload);
          if (raw) {
            payloads.push(raw);
          }
        }
      }

      // Slide buffer past this frame
      this.buffer = this.buffer.slice(totalFrameLen);
    }

    return payloads;
  }

  private findSOF(buf: Buffer): number {
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i] === 0x53 && buf[i + 1] === 0x59) {
        return i;
      }
    }
    return -1;
  }

  private decodeMR24Frame(control: number, command: number, data: Buffer): RawRadarPayload | null {
    const now = Date.now();

    // 0x80: Human Presence & Target Distance
    if (control === 0x80) {
      if (command === 0x01) {
        // Presence state: 0x01 someone present, 0x00 unoccupied
        const present = data[0] === 0x01;
        return {
          rawTimestamp: now,
          presence: present,
          deviceId: 'MR24BSD1_24G'
        };
      } else if (command === 0x04 && data.length >= 2) {
        // Distance in cm
        const distCm = (data[0] << 8) | data[1];
        return {
          rawTimestamp: now,
          distance: distCm / 100.0,
          deviceId: 'MR24BSD1_24G'
        };
      }
    }

    // 0x81: Respiration Monitoring Data
    if (control === 0x81) {
      if (command === 0x01 || command === 0x02) {
        // Respiration Rate value
        const rr = data[0];
        return {
          rawTimestamp: now,
          hardwareRR: rr > 0 && rr < 60 ? rr : null,
          presence: true,
          deviceId: 'MR24BSD1_24G'
        };
      } else if (command === 0x03 || command === 0x06) {
        // Real-time displacement / respiration curve value (signed or unsigned 0-255 / 0-65535)
        let signalVal = 0;
        if (data.length >= 2) {
          signalVal = data.readInt16BE(0) / 1000.0; // mm to normalized value
        } else if (data.length >= 1) {
          signalVal = (data[0] - 128) / 128.0;
        }
        return {
          rawTimestamp: now,
          rawSignal: signalVal,
          presence: true,
          deviceId: 'MR24BSD1_24G'
        };
      }
    }

    return null;
  }
}
