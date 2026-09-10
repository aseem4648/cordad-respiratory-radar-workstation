import React from 'react';
import { UserCheck, UserX, Compass } from 'lucide-react';

interface TargetDistanceCardProps {
  presence: boolean | null;
  targetDistance: number | null;
  isDarkMode?: boolean;
}

export const TargetDistanceCard: React.FC<TargetDistanceCardProps> = ({
  presence,
  targetDistance,
  isDarkMode = false
}) => {
  const hasPresence = presence !== null;
  const isPresent = presence === true;
  const hasDist = targetDistance !== null && !isNaN(targetDistance);

  return (
    <div className={`${isDarkMode ? 'bg-[#0F172A]/90 border-slate-800' : 'bg-white border-slate-200/90 shadow-md'} border rounded-xl p-5 flex flex-col justify-between transition-colors`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-teal-600" />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            TARGET & DISTANCE
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {isPresent ? (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
              <UserCheck className="h-3.5 w-3.5" /> DETECTED
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">
              <UserX className="h-3.5 w-3.5" /> {hasPresence ? 'NO TARGET' : 'N/A'}
            </span>
          )}
        </div>
      </div>

      <div className="my-3">
        <div className="flex items-baseline gap-2">
          <span className={`text-5xl font-black font-mono tracking-tight ${isDarkMode ? 'text-teal-400' : 'text-teal-700'}`}>
            {hasDist ? targetDistance.toFixed(2) : '--'}
          </span>
          <span className="text-sm font-bold text-slate-400">m</span>
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {hasDist ? 'Distance from 24 GHz antenna array' : 'Target distance not provided by radar'}
        </div>
      </div>

      <div className={`pt-2 border-t text-[11px] ${isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
        24 GHz FMCW Range Gate Target Verification
      </div>
    </div>
  );
};
