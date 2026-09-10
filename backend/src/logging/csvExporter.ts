import { StandardRadarPacket } from '../../../hardware-interface/types';

export class CsvExporter {
  public static generateCsv(packets: StandardRadarPacket[], sessionInfo?: { durationSec?: number; source?: string }): string {
    const lines: string[] = [];

    lines.push('# ========================================================');
    lines.push('# CONTACTLESS RESPIRATORY DISTRESS & APNEA MONITORING SYSTEM');
    lines.push('# Sensor: 24 GHz FMCW Radar');
    lines.push(`# Exported: ${new Date().toISOString()}`);
    lines.push(`# Total Samples: ${packets.length}`);
    if (sessionInfo?.source) lines.push(`# Source: ${sessionInfo.source}`);
    if (sessionInfo?.durationSec) lines.push(`# Duration: ${sessionInfo.durationSec} seconds`);
    lines.push('# ========================================================');

    const columns = [
      'timestamp_ms',
      'iso_time',
      'raw_signal',
      'filtered_respiratory_signal',
      'respiratory_rate_bpm',
      'rr_source',
      'signal_quality_pct',
      'presence',
      'target_distance_m',
      'respiratory_event',
      'event_duration_sec',
      'is_demo'
    ];
    lines.push(columns.join(','));

    for (const p of packets) {
      const row = [
        p.timestamp,
        p.isoTimestamp,
        p.signal !== null ? p.signal.toFixed(6) : '',
        p.filteredSignal !== null ? p.filteredSignal.toFixed(6) : '',
        p.respiratoryRate !== null ? p.respiratoryRate.toFixed(1) : '',
        p.rrSource,
        p.signalQuality !== null ? p.signalQuality : '',
        p.presence !== null ? (p.presence ? '1' : '0') : '',
        p.targetDistance !== null ? p.targetDistance.toFixed(2) : '',
        `"${p.event}"`,
        p.eventDurationSeconds.toFixed(1),
        p.isDemo ? '1' : '0'
      ];
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }
}
