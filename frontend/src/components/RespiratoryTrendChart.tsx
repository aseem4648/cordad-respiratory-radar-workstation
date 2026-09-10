import React, { useState } from 'react';
import { TrendPoint } from '../types';
import { TrendingUp } from 'lucide-react';

interface RespiratoryTrendChartProps {
  trendBuffer: TrendPoint[];
  isDarkMode?: boolean;
}

export const RespiratoryTrendChart: React.FC<RespiratoryTrendChartProps> = ({
  trendBuffer,
  isDarkMode = false
}) => {
  const [windowMin, setWindowMin] = useState<number>(5);

  const now = Date.now();
  const windowMs = windowMin * 60 * 1000;
  const cutoffTime = now - windowMs;
  const visibleTrend = trendBuffer.filter(p => p.time >= cutoffTime);

  const width = 600;
  const height = 180;
  const padding = { top: 20, right: 30, bottom: 25, left: 40 };
  const maxBpm = 40;

  let pointsStr = '';
  visibleTrend.forEach((pt, i) => {
    if (pt.respiratoryRate !== null) {
      const x = padding.left + ((pt.time - cutoffTime) / windowMs) * (width - padding.left - padding.right);
      const y = height - padding.bottom - (pt.respiratoryRate / maxBpm) * (height - padding.top - padding.bottom);
      pointsStr += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
    }
  });

  return (
    <div className={`${isDarkMode ? 'bg-[#0F172A]/90 border-slate-800' : 'bg-white border-slate-200/90 shadow-md'} border rounded-xl p-4 flex flex-col justify-between transition-colors`}>
      <div className={`flex items-center justify-between mb-3 border-b pb-2 select-none ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-cyan-600" />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            RESPIRATORY RATE TREND (BPM)
          </h3>
        </div>

        <div className={`flex items-center gap-1 p-1 rounded-lg border text-[11px] font-mono ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          {[1, 5, 15, 30, 60].map(mins => (
            <button
              key={mins}
              onClick={() => setWindowMin(mins)}
              className={`px-2 py-0.5 rounded font-bold transition ${windowMin === mins ? 'bg-cyan-600 text-white' : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')}`}
            >
              {mins}m
            </button>
          ))}
        </div>
      </div>

      <div className={`relative w-full h-[190px] border rounded-lg overflow-hidden flex items-center justify-center ${isDarkMode ? 'bg-[#070A12] border-slate-900' : 'bg-white border-slate-200'}`}>
        {visibleTrend.length === 0 ? (
          <span className="text-xs font-mono text-slate-400">No trend history in current window</span>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
            {[10, 20, 30].map(bpm => {
              const y = height - padding.bottom - (bpm / maxBpm) * (height - padding.top - padding.bottom);
              return (
                <g key={bpm}>
                  <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke={isDarkMode ? "rgba(51, 65, 85, 0.4)" : "rgba(226, 232, 240, 0.9)"} strokeDasharray="3 3" />
                  <text x={padding.left - 6} y={y + 4} fill="#94A3B8" fontSize="10" fontFamily="monospace" textAnchor="end">{bpm}</text>
                </g>
              );
            })}

            <rect
              x={padding.left}
              y={height - padding.bottom - (20 / maxBpm) * (height - padding.top - padding.bottom)}
              width={width - padding.left - padding.right}
              height={((20 - 12) / maxBpm) * (height - padding.top - padding.bottom)}
              fill={isDarkMode ? "rgba(16, 185, 129, 0.06)" : "rgba(16, 185, 129, 0.10)"}
            />

            {pointsStr && (
              <path
                d={pointsStr}
                fill="none"
                stroke={isDarkMode ? "#06B6D4" : "#0284C7"}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        )}
      </div>

      <div className={`pt-2 mt-2 border-t flex items-center justify-between text-[11px] font-mono ${isDarkMode ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
        <span>NORMAL RANGE: <strong className="text-emerald-600">12 - 20 BPM</strong></span>
        <span>POINTS: <strong className={isDarkMode ? "text-slate-200" : "text-slate-800"}>{visibleTrend.length}</strong></span>
      </div>
    </div>
  );
};
