import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, UserX, Activity } from 'lucide-react';
import { RespiratoryEventState } from '../types';

interface BreathingStatusCardProps {
  eventState: RespiratoryEventState;
  durationSeconds: number;
  isDarkMode?: boolean;
}

export const BreathingStatusCard: React.FC<BreathingStatusCardProps> = ({
  eventState,
  durationSeconds,
  isDarkMode = false
}) => {
  let label = 'Unavailable';
  let bgGradient = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-md';
  let textColor = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  let icon = <Activity className="h-5 w-5 text-slate-400" />;
  let isCritical = false;

  switch (eventState) {
    case 'WAITING_FOR_DATA':
      label = 'Unavailable';
      break;
    case 'NORMAL_BREATHING':
      label = 'NORMAL BREATHING';
      bgGradient = isDarkMode ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-emerald-50/70 border-emerald-300 shadow-md';
      textColor = 'text-emerald-700';
      icon = <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      break;

    case 'POSSIBLE_APNEA':
      label = 'POSSIBLE APNEA EVENT';
      bgGradient = 'bg-rose-100 border-rose-500 shadow-lg animate-critical-alert';
      textColor = 'text-rose-700';
      icon = <AlertTriangle className="h-5 w-5 text-rose-600 animate-bounce" />;
      isCritical = true;
      break;

    case 'POSSIBLE_ABNORMAL_RESPIRATION':
      label = 'POSSIBLE ABNORMAL RESPIRATION';
      bgGradient = isDarkMode ? 'bg-amber-950/40 border-amber-700/60' : 'bg-amber-50 border-amber-300 shadow-md';
      textColor = 'text-amber-800';
      icon = <AlertCircle className="h-5 w-5 text-amber-600" />;
      break;

    case 'TACHYPNEA':
      label = 'POSSIBLE TACHYPNEA (RAPID)';
      bgGradient = isDarkMode ? 'bg-amber-950/40 border-amber-700/60' : 'bg-amber-50 border-amber-300 shadow-md';
      textColor = 'text-amber-800';
      icon = <AlertCircle className="h-5 w-5 text-amber-600" />;
      break;

    case 'BRADYPNEA':
      label = 'POSSIBLE BRADYPNEA (SLOW)';
      bgGradient = isDarkMode ? 'bg-amber-950/40 border-amber-700/60' : 'bg-amber-50 border-amber-300 shadow-md';
      textColor = 'text-amber-800';
      icon = <AlertCircle className="h-5 w-5 text-amber-600" />;
      break;

    case 'INSUFFICIENT_SIGNAL':
      label = 'INSUFFICIENT SIGNAL';
      bgGradient = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-md';
      textColor = 'text-amber-700';
      icon = <AlertCircle className="h-5 w-5 text-amber-600" />;
      break;

    case 'NO_TARGET':
      label = 'NO TARGET DETECTED';
      bgGradient = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-md';
      textColor = 'text-slate-500';
      icon = <UserX className="h-5 w-5 text-slate-400" />;
      break;
  }

  return (
    <div className={`rounded-xl p-5 flex flex-col justify-between border transition-all ${bgGradient}`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
          BREATHING STATUS
        </h3>
        {icon}
      </div>

      <div className="my-3">
        <div className={`text-xl sm:text-2xl font-black tracking-tight ${textColor}`}>
          {label}
        </div>
        {durationSeconds > 0 && (
          <div className="text-xs font-mono text-slate-500 mt-1">
            Active Duration: <strong className={isCritical ? "text-rose-700 font-bold" : (isDarkMode ? "text-slate-200" : "text-slate-800")}>{durationSeconds.toFixed(1)}s</strong>
          </div>
        )}
      </div>

      <div className={`pt-2 border-t text-[11px] ${isDarkMode ? 'border-slate-800/70 text-slate-400' : 'border-slate-200/80 text-slate-500'}`}>
        Continuous 24 GHz algorithmic evaluation
      </div>
    </div>
  );
};
