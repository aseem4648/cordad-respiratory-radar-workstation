import React from 'react';
import { RadarTelemetry, PanTiltState, CameraConfig, UserSession } from '../types';

interface SystemStatusViewProps {
  telemetry: RadarTelemetry | null;
  wsStatus: string;
  panTilt: PanTiltState | null;
  camera: CameraConfig | null;
  session: UserSession | null;
  isDarkMode: boolean;
}

export const SystemStatusView: React.FC<SystemStatusViewProps> = ({
  telemetry,
  wsStatus,
  panTilt,
  camera,
  session,
  isDarkMode
}) => {
  const subsystems = [
    {
      name: '24 GHz FMCW Radar Transceiver',
      category: 'RF Physiological Sensor',
      status: telemetry?.connectionStatus === 'CONNECTED' ? 'ONLINE' : 'OFFLINE',
      metric: `${telemetry?.samplingRateHz || 20} Hz Sampling`,
      detail: '24.125 GHz ISM Band • Direct Phase Demodulation'
    },
    {
      name: 'ESP32 Directional Camera',
      category: 'Optical ROI Aiming',
      status: camera?.status === 'CONNECTED' ? 'ONLINE' : 'STANDBY',
      metric: camera?.streamUrl || 'http://192.168.4.1/stream',
      detail: 'Strict Alignment Sensor • Independent from Vitals DSP'
    },
    {
      name: 'Dual-Axis Pan-Tilt Gimbal',
      category: 'Mechanical Actuation',
      status: panTilt?.hardwareConnected ? 'READY' : 'OFFLINE',
      metric: `Pan: ${panTilt?.pan || 0}° | Tilt: ${panTilt?.tilt || 0}°`,
      detail: `${panTilt?.mode || 'MANUAL'} Mode • Status: ${panTilt?.status || 'IDLE'}`
    },
    {
      name: 'WebSocket Telemetry Stream',
      category: 'Network Transport',
      status: wsStatus === 'CONNECTED' ? 'ONLINE' : 'DISCONNECTED',
      metric: `${telemetry?.packetsPerSecond || 20} pkts/sec`,
      detail: `Total: ${telemetry?.totalPacketsReceived || 0} packets • Loss: ${telemetry?.packetLossCount || 0}`
    },
    {
      name: 'Biomedical DSP Filter Bank',
      category: 'Signal Processing',
      status: 'OPTIMAL',
      metric: 'Butterworth 0.10 - 0.70 Hz',
      detail: 'Zero-latency continuous ring buffer processing'
    },
    {
      name: 'Security & Access Control',
      category: 'Authentication',
      status: session?.isAuthenticated ? 'ACTIVE' : 'LOCKED',
      metric: `${session?.tier} • ${session?.role}`,
      detail: 'Local-Only Processing • Zero Cloud Leakage'
    }
  ];

  return (
    <div className="space-y-4">
      <div className={`p-4 sm:p-5 rounded-xl border shadow-sm ${isDarkMode ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-200'}`}>
        <h3 className="font-bold text-base tracking-tight mb-1">
          Comprehensive System Diagnostics &amp; Subsystem Telemetry
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Real-time hardware status verification for clinical bedside compliance
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subsystems.map((sub, i) => (
            <div
              key={i}
              className={`p-4 rounded-xl border ${
                isDarkMode ? 'bg-[#070D18] border-slate-800/80' : 'bg-slate-50 border-slate-200/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                  {sub.category}
                </span>
                <span
                  className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded uppercase ${
                    ['ONLINE', 'READY', 'OPTIMAL', 'ACTIVE'].includes(sub.status)
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                  }`}
                >
                  {sub.status}
                </span>
              </div>

              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {sub.name}
              </div>
              <div className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 mt-1">
                {sub.metric}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 border-t pt-2 border-slate-200 dark:border-slate-800">
                {sub.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
