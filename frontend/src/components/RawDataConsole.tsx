import React, { useState } from 'react';
import { Terminal, Copy, Check } from 'lucide-react';
import { StandardRadarPacket } from '../types';

interface RawDataConsoleProps {
  lastPacket: StandardRadarPacket | null;
  isDarkMode?: boolean;
}

export const RawDataConsole: React.FC<RawDataConsoleProps> = ({
  lastPacket,
  isDarkMode = false
}) => {
  const [copied, setCopied] = useState(false);

  const rawJson = lastPacket ? JSON.stringify({
    sensor: "24 GHz FMCW Radar",
    timestamp: lastPacket.timestamp,
    iso_time: lastPacket.isoTimestamp,
    signal: lastPacket.signal,
    filtered_signal: lastPacket.filteredSignal,
    respiratory_rate: lastPacket.respiratoryRate,
    signal_quality: lastPacket.signalQuality,
    presence: lastPacket.presence,
    target_distance: lastPacket.targetDistance,
    event: lastPacket.event,
    is_demo: lastPacket.isDemo
  }, null, 2) : '// Waiting for incoming 24 GHz radar packets...';

  const handleCopy = () => {
    navigator.clipboard.writeText(rawJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`${isDarkMode ? 'bg-[#0F172A]/90 border-slate-800' : 'bg-white border-slate-200/90 shadow-md'} border rounded-xl p-4 flex flex-col justify-between transition-colors`}>
      <div className={`flex items-center justify-between border-b pb-2 mb-2 select-none ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan-600" />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            RAW 24 GHz DATA INSPECTOR
          </h3>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] font-mono text-slate-500 hover:text-slate-900 transition"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy JSON'}
        </button>
      </div>

      <pre className={`rounded-lg p-3 font-mono text-[11px] overflow-x-auto h-[120px] select-all border ${
        isDarkMode ? 'bg-[#070A12] border-slate-900 text-cyan-300' : 'bg-slate-50 border-slate-200 text-slate-800'
      }`}>
        {rawJson}
      </pre>
    </div>
  );
};
