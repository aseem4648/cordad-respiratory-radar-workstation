export interface RawRadarPayload {
  rawTimestamp?: number;
  rawSignal?: number | string | null;
  rawFrame?: string;
  hardwareRR?: number | string | null;
  presence?: boolean | number | string | null;
  distance?: number | string | null;
  rawQuality?: number | string | null;
  heartRate?: number | string | null;
  deviceId?: string;
}

export type PresenceState = 'PRESENT' | 'ABSENT' | 'UNAVAILABLE';
export type SignalState = 'OPTIMAL' | 'ACCEPTABLE' | 'DEGRADED' | 'NO_SIGNAL' | 'UNAVAILABLE';
export type RespiratoryEventState = 
  | 'NORMAL_BREATHING'
  | 'POSSIBLE_APNEA'
  | 'POSSIBLE_ABNORMAL_RESPIRATION'
  | 'TACHYPNEA'
  | 'BRADYPNEA'
  | 'MOTION_ARTIFACT'
  | 'INSUFFICIENT_SIGNAL'
  | 'NO_TARGET'
  | 'WAITING_FOR_DATA';

export interface StandardRadarPacket {
  timestamp: number;
  isoTimestamp: string;
  signal: number | null;
  filteredSignal: number | null;
  respiratoryRate: number | null;
  rrSource: 'CALCULATED_RADAR_DSP' | 'RADAR_ONBOARD_FIRMWARE' | 'UNAVAILABLE';
  signalQuality: number | null;
  presence: boolean | null;
  targetDistance: number | null;
  event: RespiratoryEventState;
  eventDurationSeconds: number;
  isDemo: boolean;
  packetIndex: number;
}

export interface RadarTelemetry {
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'ERROR';
  dataStreamStatus: 'LIVE' | 'PAUSED' | 'IDLE' | 'NO_LIVE_DATA';
  totalPacketsReceived: number;
  packetsPerSecond: number;
  packetLossCount: number;
  lastPacketTimestamp: number | null;
  samplingRateHz: number;
  hardwareDeviceId: string | null;
  firmwareVersion: string | null;
  mode: 'LIVE_RADAR' | 'DEMO_MODE';
}

export interface MonitoringEvent {
  id: string;
  timestamp: number;
  timeString: string;
  type: RespiratoryEventState;
  label: string;
  durationSeconds?: number;
  severity: 'normal' | 'warning' | 'critical' | 'info';
  details?: string;
}

export interface SystemSettings {
  webSocketUrl: string;
  samplingRateHz: number;
  waveformWindowSeconds: number;
  apneaThresholdSeconds: number;
  filterLowCutHz: number;
  filterHighCutHz: number;
  signalQualityThreshold: number;
  reconnectIntervalMs: number;
  soundAlertsEnabled: boolean;
  tachypneaThresholdBpm: number;
  bradypneaThresholdBpm: number;
}
