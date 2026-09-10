import React from 'react';
import { MonitoringEvent } from '../types';
import { Trash2, Clock, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface EventMonitorTimelineProps {
  events: MonitoringEvent[];
  onClearEvents: () => void;
  isDarkMode?: boolean;
}

export const EventMonitorTimeline: React.FC<EventMonitorTimelineProps> = ({
  events,
  onClearEvents,
  isDarkMode = false
}) => {
  return (
    <div className={`${isDarkMode ? 'bg-[#0F172A]/90 border-slate-800' : 'bg-white border-slate-200/90 shadow-md'} border rounded-xl p-4 flex flex-col justify-between h-[340px] transition-colors`}>
      <div className={`flex items-center justify-between border-b pb-2 mb-2 select-none ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-600" />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            RESPIRATORY EVENT TIMELINE
          </h3>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
            {events.length} Logs
          </span>
        </div>

        <button
          onClick={onClearEvents}
          title="Clear Event Log History"
          className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-1">
            <span className="font-semibold">NO EVENTS RECORDED YET</span>
            <span className="text-[11px] text-slate-400 font-sans">Active transitions will appear here in real-time</span>
          </div>
        ) : (
          events.map((evt) => {
            let badgeBg = isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-700 border-slate-200';
            let icon = <Info className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />;

            if (evt.severity === 'critical') {
              badgeBg = 'bg-rose-50 text-rose-900 border-rose-300';
              icon = <AlertTriangle className="h-3.5 w-3.5 text-rose-600 flex-shrink-0" />;
            } else if (evt.severity === 'warning') {
              badgeBg = 'bg-amber-50 text-amber-900 border-amber-300';
              icon = <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />;
            } else if (evt.severity === 'normal') {
              badgeBg = 'bg-emerald-50 text-emerald-900 border-emerald-300';
              icon = <CheckCircle className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />;
            }

            return (
              <div 
                key={evt.id}
                className={`p-2 rounded-lg border flex items-start justify-between gap-3 ${badgeBg}`}
              >
                <div className="flex items-start gap-2">
                  {icon}
                  <div>
                    <div className="font-bold text-[11px] tracking-wide">{evt.label}</div>
                    {evt.details && (
                      <div className="text-[10px] text-slate-500 font-sans mt-0.5">{evt.details}</div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">{evt.timeString}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
