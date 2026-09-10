import { SystemSettings } from '../../hardware-interface/types';

export const DEFAULT_SETTINGS: SystemSettings = {
  webSocketUrl: 'ws://localhost:5000/ws/radar',
  samplingRateHz: 20,
  waveformWindowSeconds: 30,
  apneaThresholdSeconds: 10,
  filterLowCutHz: 0.10,
  filterHighCutHz: 0.70,
  signalQualityThreshold: 35,
  reconnectIntervalMs: 2000,
  soundAlertsEnabled: false,
  tachypneaThresholdBpm: 25,
  bradypneaThresholdBpm: 10
};

export const SERVER_CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  HOST: '0.0.0.0',
  WS_PATH: '/ws/radar',
  DEMO_INTERVAL_MS: 50
};
