import React from 'react';
import { Signal } from 'lucide-react';

interface SignalQualityCardProps {
  signalQuality: number | null;
  isDarkMode?: boolean;
}

export const SignalQualityCard: React.FC<SignalQualityCardProps> = ({
  signalQuality,
  isDarkMode = false
}) => {
  const hasQuality = signalQuality !== null && !isNaN(signalQuality);

  let barColor = 'bg-slate-300';
  let qualityLabel = 'UNAVAILABLE';
  let textColor = 'text-slate-400';

  if (hasQuality) {
    if (signalQuality >= 75) {
      barColor = 'bg-emerald-500';
      qualityLabel = 'OPTIMAL QUALITY';
      textColor = 'text-emerald-600';
    } else if (signalQuality >= 45) {
      barColor = 'bg-cyan-600';
      qualityLabel = 'ACCEPTABLE';
      textColor = 'text-cyan-700';
    } else if (signalQuality >= 20) {
      barColor = 'bg-amber-500';
      qualityLabel = 'DEGRADED';
      textColor = 'text-amber-600';
    } else {
      barColor = 'bg-rose-500';
      qualityLabel = 'POOR / NO SIGNAL';
      textColor = 'text-rose-600';
    }
  }

  return (
    <div className={`${isDarkMode ? 'bg-[#0F172A]/90 border-slate-800' : 'bg-white border-slate-200/90 shadow-md'} border rounded-xl p-5 flex flex-col justify-between transition-colors`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Signal className="h-5 w-5 text-cyan-600" />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            RADAR SIGNAL QUALITY
          </h3>
        </div>
        {hasQuality && (
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
            isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
          }`}>
            {qualityLabel}
          </span>
        )}
      </div>

      <div className="my-3">
        <div className="flex items-baseline gap-2">
          <span className={`text-5xl font-black font-mono tracking-tight ${textColor}`}>
            {hasQuality ? `${signalQuality}%` : '--'}
          </span>
        </div>

        <div className={`w-full rounded-full h-2 mt-3 overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
          <div 
            className={`h-full transition-all duration-300 ${barColor}`} 
            style={{ width: `${hasQuality ? signalQuality : 0}%` }}
          />
        </div>
      </div>

      <div className={`pt-2 border-t text-[11px] ${isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
        Radar Signal Quality Index (SQI) - Not clinical accuracy
      </div>
    </div>
  );
};
