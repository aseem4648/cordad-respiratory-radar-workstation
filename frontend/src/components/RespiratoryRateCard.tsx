import React from 'react';
import { Wind } from 'lucide-react';

interface RespiratoryRateCardProps {
  respiratoryRate: number | null;
  isValid: boolean;
  isDarkMode?: boolean;
}

export const RespiratoryRateCard: React.FC<RespiratoryRateCardProps> = ({
  respiratoryRate,
  isValid,
  isDarkMode = false
}) => {
  const hasRate = respiratoryRate !== null && !isNaN(respiratoryRate);

  let valColor = isDarkMode ? 'text-amber-400' : 'text-cyan-700';
  let badgeColor = isDarkMode ? 'bg-amber-950/60 border-amber-800/50 text-amber-300' : 'bg-cyan-50 border-cyan-200 text-cyan-800';
  let rateState = 'NORMAL LIMITS';

  if (!hasRate) {
    valColor = 'text-slate-400';
  } else if (respiratoryRate > 24) {
    valColor = 'text-rose-600';
    badgeColor = 'bg-rose-50 border-rose-200 text-rose-800';
    rateState = 'ELEVATED (TACHYPNEA)';
  } else if (respiratoryRate < 10) {
    valColor = 'text-amber-600';
    badgeColor = 'bg-amber-50 border-amber-200 text-amber-800';
    rateState = 'REDUCED (BRADYPNEA)';
  }

  return (
    <div className={`${isDarkMode ? 'bg-[#0F172A]/90 border-slate-800' : 'bg-white border-slate-200/90 shadow-md'} border rounded-xl p-5 flex flex-col justify-between transition-colors`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wind className="h-5 w-5 text-cyan-600" />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            RESPIRATORY RATE
          </h3>
        </div>
        {hasRate && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
            {rateState}
          </span>
        )}
      </div>

      <div className="my-3 flex items-baseline gap-3">
        <span className={`text-6xl font-extrabold font-mono tracking-tight ${valColor}`}>
          {hasRate ? respiratoryRate.toFixed(1) : '--'}
        </span>
        <div className="flex flex-col">
          <span className={`text-sm font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>BPM</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Breaths / min</span>
        </div>
      </div>

      <div className={`pt-2 border-t flex items-center justify-between text-[11px] ${isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
        <span className="font-medium">
          {hasRate 
            ? 'Calculated from 24 GHz radar signal' 
            : 'Awaiting sufficient valid signal'}
        </span>
        <span className={`font-mono text-[10px] font-bold ${isValid ? 'text-emerald-600' : 'text-slate-400'}`}>
          {isValid ? '● VALID ESTIMATE' : '○ INSUFFICIENT DATA'}
        </span>
      </div>
    </div>
  );
};
