import React, { useState, useMemo } from 'react';
import { Activity, Sliders, AlertTriangle, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { DatasetValidationReport } from '../../utils/datasetParser';
import { SignalAnalysisEngine, TimeDomainMetrics } from '../../utils/signalAnalysis';

interface SignalAnalysisTabProps {
  report: DatasetValidationReport;
  selectedSignal: string;
  onSelectSignal: (colName: string) => void;
  isDarkMode: boolean;
}

export const SignalAnalysisTab: React.FC<SignalAnalysisTabProps> = ({
  report,
  selectedSignal,
  onSelectSignal,
  isDarkMode
}) => {
  const [zoomWindowSec, setZoomWindowSec] = useState<number | 'ALL'>('ALL');
  const [windowOffsetSec, setWindowOffsetSec] = useState<number>(0);

  const numericColumns = useMemo(() => {
    return report.columnProfiles.filter(c => c.isNumeric);
  }, [report.columnProfiles]);

  const profile = report.columnProfiles.find(c => c.name === selectedSignal);
  const isSuitable = profile?.isSuitableForWaveform ?? false;

  // Extract values and timestamps
  const { values, timestamps, timeLabels } = useMemo(() => {
    const raw = report.rawRows;
    const vals: number[] = [];
    const ts: number[] = [];
    const labels: string[] = [];
    const dt = report.samplingIntervalSeconds || (1 / (report.estimatedSamplingRateHz || 20));

    raw.forEach((r, idx) => {
      const v = Number(r[selectedSignal]);
      vals.push(isNaN(v) ? 0 : v);

      let t = idx * dt;
      if (report.timestampColumn && r[report.timestampColumn] !== null) {
        const rawT = Number(r[report.timestampColumn]);
        if (!isNaN(rawT)) t = rawT > 1e10 ? rawT / 1000 : rawT;
      }
      ts.push(t);
      labels.push(`${t.toFixed(1)}s`);
    });

    return { values: vals, timestamps: ts, timeLabels: labels };
  }, [report, selectedSignal]);

  // Window slicing
  const { displayValues, displayTimestamps, displayLabels } = useMemo(() => {
    if (zoomWindowSec === 'ALL' || !report.signalDurationSeconds) {
      return { displayValues: values, displayTimestamps: timestamps, displayLabels: timeLabels };
    }
    const fs = report.estimatedSamplingRateHz || 20;
    const windowSamples = Math.round(zoomWindowSec * fs);
    const offsetSamples = Math.round(windowOffsetSec * fs);
    const start = Math.max(0, Math.min(values.length - windowSamples, offsetSamples));
    const end = Math.min(values.length, start + windowSamples);

    return {
      displayValues: values.slice(start, end),
      displayTimestamps: timestamps.slice(start, end),
      displayLabels: timeLabels.slice(start, end)
    };
  }, [values, timestamps, timeLabels, zoomWindowSec, windowOffsetSec, report]);

  const metrics: TimeDomainMetrics | null = useMemo(() => {
    return SignalAnalysisEngine.calculateTimeDomain(displayValues, displayTimestamps);
  }, [displayValues, displayTimestamps]);

  // Generate SVG Path for Waveform Plot with decimation for large datasets
  const svgPath = useMemo(() => {
    if (!displayValues || displayValues.length === 0) return '';
    const min = metrics?.min ?? 0;
    const max = metrics?.max ?? 1;
    const range = max - min || 1;
    const width = 1000;
    const height = 280;
    const padding = 20;

    const len = displayValues.length;
    const step = len > 3000 ? Math.ceil(len / 3000) : 1;
    const points: string[] = [];

    for (let i = 0; i < len; i += step) {
      const v = displayValues[i];
      const x = padding + (i / (len - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - ((v - min) / range) * (height - 2 * padding);
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    if ((len - 1) % step !== 0 && len > 0) {
      const v = displayValues[len - 1];
      const x = width - padding;
      const y = height - padding - ((v - min) / range) * (height - 2 * padding);
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    return `M ${points.join(' L ')}`;
  }, [displayValues, metrics]);

  return (
    <div className="space-y-6">
      {/* Signal Selection Header */}
      <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-sky-600/10 text-sky-500 border border-sky-600/20">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold uppercase text-slate-400">ACTIVE SIGNAL CHANNEL</div>
              <div className="flex items-center gap-2 mt-0.5">
                <select
                  value={selectedSignal}
                  onChange={e => onSelectSignal(e.target.value)}
                  className={`text-sm font-mono font-bold px-3 py-1.5 rounded-lg border outline-none ${
                    isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200 focus:border-sky-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  {numericColumns.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.dataType})
                    </option>
                  ))}
                </select>
                <span className={`text-[10px] font-mono px-2 py-1 rounded border uppercase font-bold ${
                  isSuitable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  {isSuitable ? 'CONTINUOUS SIGNAL' : 'DISCRETE / CONSTANT'}
                </span>
              </div>
            </div>
          </div>

          {/* Time Window Zoom Selectors */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Window:</span>
            <button
              onClick={() => setZoomWindowSec('ALL')}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold border transition ${
                zoomWindowSec === 'ALL' ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              Full ({report.signalDurationSeconds || values.length}s)
            </button>
            {(report.signalDurationSeconds || 60) >= 30 && (
              <button
                onClick={() => setZoomWindowSec(30)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold border transition ${
                  zoomWindowSec === 30 ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                30s
              </button>
            )}
            {(report.signalDurationSeconds || 60) >= 10 && (
              <button
                onClick={() => setZoomWindowSec(10)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold border transition ${
                  zoomWindowSec === 10 ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                10s
              </button>
            )}
          </div>
        </div>

        {!isSuitable && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Selected column is not suitable for continuous signal analysis.</div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Channel <b>{selectedSignal}</b> contains discrete, constant, or categorical values ({profile?.uniqueCount} unique values). Continuous physiological analysis is best performed on analog radar displacement channels.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Complete Waveform Canvas */}
      <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex justify-between items-center mb-3">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            TIME-DOMAIN WAVEFORM • {displayValues.length.toLocaleString()} Samples
          </div>
          <div className="text-xs font-mono text-slate-400">
            Y: [{metrics?.min ?? 0} to {metrics?.max ?? 0}] • X: [{displayLabels[0] || '0s'} to {displayLabels[displayLabels.length - 1] || 'End'}]
          </div>
        </div>

        {/* Waveform SVG Plot */}
        <div className="relative w-full h-72 bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
          {/* Subtle Grid Lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:40px_30px]" />

          <svg viewBox="0 0 1000 280" className="w-full h-full preserve-3d" preserveAspectRatio="none">
            {/* Zero line if crosses zero */}
            {metrics && metrics.min < 0 && metrics.max > 0 && (
              <line
                x1="20"
                y1={280 - 20 - ((-metrics.min) / (metrics.max - metrics.min)) * 240}
                x2="980"
                y2={280 - 20 - ((-metrics.min) / (metrics.max - metrics.min)) * 240}
                stroke="#64748b"
                strokeDasharray="4,4"
                strokeWidth="1"
              />
            )}
            <path
              d={svgPath}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Time-Domain Statistical Summary Grid */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="text-[9px] font-mono uppercase text-slate-500">MINIMUM</div>
            <div className="text-lg font-bold font-mono text-slate-200 mt-0.5">{metrics.min}</div>
          </div>
          <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="text-[9px] font-mono uppercase text-slate-500">MAXIMUM</div>
            <div className="text-lg font-bold font-mono text-slate-200 mt-0.5">{metrics.max}</div>
          </div>
          <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="text-[9px] font-mono uppercase text-slate-500">PEAK-TO-PEAK</div>
            <div className="text-lg font-bold font-mono text-sky-400 mt-0.5">{metrics.peakToPeak}</div>
          </div>
          <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="text-[9px] font-mono uppercase text-slate-500">MEAN</div>
            <div className="text-lg font-bold font-mono text-slate-200 mt-0.5">{metrics.mean}</div>
          </div>
          <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="text-[9px] font-mono uppercase text-slate-500">MEDIAN</div>
            <div className="text-lg font-bold font-mono text-slate-200 mt-0.5">{metrics.median}</div>
          </div>
          <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="text-[9px] font-mono uppercase text-slate-500">STD DEV (σ)</div>
            <div className="text-lg font-bold font-mono text-indigo-400 mt-0.5">{metrics.stdDev}</div>
          </div>
          <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="text-[9px] font-mono uppercase text-slate-500">ROOT MEAN SQ (RMS)</div>
            <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">{metrics.rms}</div>
          </div>
          <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="text-[9px] font-mono uppercase text-slate-500">DETECTED PEAKS</div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">{metrics.detectedPeaksCount}</div>
          </div>
        </div>
      )}
    </div>
  );
};
