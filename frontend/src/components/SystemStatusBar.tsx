import React from 'react';
import { RadarTelemetry } from '../types';

interface SystemStatusBarProps {
  telemetry: RadarTelemetry | null;
  wsStatus: string;
  isDemo: boolean;
  sqi: number | null;
  isRecording: boolean;
  isDarkMode?: boolean;
}

export const SystemStatusBar: React.FC<SystemStatusBarProps> = ({
  telemetry,
  wsStatus,
  isDemo,
  sqi,
  isRecording,
  isDarkMode = false
}) => {
  const radarStatus = isDemo ? 'SIMULATED (DEMO)' : (telemetry?.connectionStatus === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED');
  const streamStatus = telemetry?.dataStreamStatus || 'IDLE';

  let sqiColor = 'text-slate-500';
  let sqiText = 'N/A';
  if (sqi !== null) {
    if (sqi >= 75) { sqiColor = 'text-emerald-600'; sqiText = `${sqi}% (OPTIMAL)`; }
    else if (sqi >= 45) { sqiColor = 'text-cyan-700'; sqiText = `${sqi}% (ACCEPTABLE)`; }
    else if (sqi >= 20) { sqiColor = 'text-amber-600'; sqiText = `${sqi}% (DEGRADED)`; }
    else { sqiColor = 'text-rose-600'; sqiText = `${sqi}% (NO SIGNAL)`; }
  }

  return (
    <div className={`${isDarkMode ? 'bg-[#0B101D] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'} border-b px-4 py-2 text-xs font-mono select-none transition-colors`}>
      <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-3">
        
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-sans text-[11px] font-semibold">SENSOR HARDWARE:</span>
            <span className="font-bold text-cyan-700">
              24 GHz FMCW RADAR
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-sans text-[11px] font-semibold">RADAR STATUS:</span>
            <span className={`font-bold ${radarStatus.includes('CONNECTED') ? 'text-emerald-600' : (radarStatus.includes('SIMULATED') ? 'text-amber-600' : 'text-rose-600')}`}>
              {radarStatus}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-sans text-[11px] font-semibold">ESP32 GATEWAY:</span>
            <span className={`font-bold ${wsStatus === 'CONNECTED' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {wsStatus}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-sans text-[11px] font-semibold">STREAM:</span>
            <span className={`font-bold ${streamStatus === 'LIVE' ? 'text-cyan-700' : 'text-amber-600'}`}>
              {streamStatus}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-sans text-[11px] font-semibold">SIGNAL QUALITY:</span>
            <span className={`font-bold ${sqiColor}`}>
              {sqiText}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-sans text-[11px] font-semibold">RECORDING:</span>
            <span className={`font-bold flex items-center gap-1.5 ${isRecording ? 'text-rose-600' : 'text-slate-500'}`}>
              {isRecording && <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />}
              {isRecording ? 'ACTIVE' : 'OFF'}
            </span>
          </div>

          <div className="text-[11px] text-slate-500 hidden md:block">
            DATA RATE: <span className="text-slate-900 font-bold">{telemetry?.packetsPerSecond || 20} Samples/s (20 Hz)</span>
          </div>
        </div>

      </div>
    </div>
  );
};
