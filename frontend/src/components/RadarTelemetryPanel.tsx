import React from 'react';
import { RadarTelemetry } from '../types';
import { Cpu } from 'lucide-react';
import { formatTimestamp } from '../utils/formatting';

interface RadarTelemetryPanelProps {
  telemetry: RadarTelemetry | null;
  samplingRate: number;
  isDarkMode?: boolean;
}

export const RadarTelemetryPanel: React.FC<RadarTelemetryPanelProps> = ({
  telemetry,
  samplingRate,
  isDarkMode = false
}) => {
  return (
    <div className={`${isDarkMode ? 'bg-[#0F172A]/90 border-slate-800' : 'bg-white border-slate-200/90 shadow-md'} border rounded-xl p-4 transition-colors`}>
      <div className={`flex items-center justify-between border-b pb-2 mb-3 select-none ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-cyan-600" />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            24 GHz RADAR TELEMETRY
          </h3>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${isDarkMode ? 'bg-slate-800 text-cyan-300 border-slate-700' : 'bg-cyan-50 text-cyan-800 border-cyan-200 font-bold'}`}>
          24 GHz FMCW
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className={`p-2.5 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="text-[10px] text-slate-500 font-sans font-semibold">TOTAL PACKETS</div>
          <div className={`text-base font-bold mt-0.5 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            {telemetry?.totalPacketsReceived || 0}
          </div>
        </div>

        <div className={`p-2.5 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="text-[10px] text-slate-500 font-sans font-semibold">SAMPLING RATE</div>
          <div className="text-base font-bold text-cyan-700 mt-0.5">
            {telemetry?.packetsPerSecond || samplingRate} Hz
          </div>
        </div>

        <div className={`p-2.5 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="text-[10px] text-slate-500 font-sans font-semibold">PACKET LOSS</div>
          <div className={`text-base font-bold mt-0.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            {telemetry?.packetLossCount || 0}
          </div>
        </div>

        <div className={`p-2.5 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="text-[10px] text-slate-500 font-sans font-semibold">LAST PACKET</div>
          <div className={`text-base font-bold mt-0.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            {formatTimestamp(telemetry?.lastPacketTimestamp || null)}
          </div>
        </div>
      </div>
    </div>
  );
};
