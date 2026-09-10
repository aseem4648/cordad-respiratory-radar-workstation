import React, { useState, useMemo } from 'react';
import { Layers, Sliders, CheckSquare, Square, Info } from 'lucide-react';
import { DatasetValidationReport } from '../../utils/datasetParser';
import { SignalAnalysisEngine } from '../../utils/signalAnalysis';

interface MultiSignalComparisonTabProps {
  report: DatasetValidationReport;
  isDarkMode: boolean;
}

export const MultiSignalComparisonTab: React.FC<MultiSignalComparisonTabProps> = ({ report, isDarkMode }) => {
  const numericColumns = useMemo(() => report.columnProfiles.filter(c => c.isNumeric), [report]);

  // Default selection: up to 2 detected signals (e.g. raw and filtered)
  const [selectedCols, setSelectedCols] = useState<string[]>(() => {
    const raw = report.detectedSignalColumns.find(c => c.type === 'RAW_RADAR')?.name;
    const filt = report.detectedSignalColumns.find(c => c.type === 'FILTERED_RADAR' || c.type === 'PRIMARY_RESPIRATORY')?.name;
    const init = [raw, filt].filter(Boolean) as string[];
    return init.length > 0 ? init : numericColumns.slice(0, 2).map(c => c.name);
  });

  const [normalizeScale, setNormalizeScale] = useState<boolean>(true);

  const toggleColumn = (col: string) => {
    if (selectedCols.includes(col)) {
      if (selectedCols.length > 1) setSelectedCols(selectedCols.filter(c => c !== col));
    } else {
      if (selectedCols.length < 4) setSelectedCols([...selectedCols, col]);
    }
  };

  const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#ec4899'];

  // Calculate series values and paths
  const seriesData = useMemo(() => {
    const raw = report.rawRows;
    return selectedCols.map((colName, idx) => {
      const vals: number[] = [];
      let minVal = Infinity;
      let maxVal = -Infinity;
      let sum = 0;

      for (let i = 0; i < raw.length; i++) {
        const rawV = Number(raw[i][colName]);
        const v = isNaN(rawV) ? 0 : rawV;
        vals.push(v);
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
        sum += v;
      }

      const mean = vals.length > 0 ? sum / vals.length : 0;
      let sumSq = 0;
      for (let i = 0; i < vals.length; i++) {
        const diff = vals[i] - mean;
        sumSq += diff * diff;
      }
      const std = Math.sqrt(sumSq / (vals.length || 1)) || 1;

      // Z-score normalized or min-max
      const normalizedVals = normalizeScale
        ? vals.map(v => (v - mean) / std)
        : vals;

      return {
        colName,
        color: colors[idx % colors.length],
        vals,
        normalizedVals,
        min: minVal === Infinity ? 0 : minVal,
        max: maxVal === -Infinity ? 1 : maxVal,
        mean,
        std
      };
    });
  }, [report, selectedCols, normalizeScale]);

  // Global bounds for plotting
  const globalMin = useMemo(() => {
    if (seriesData.length === 0) return 0;
    let min = Infinity;
    for (const s of seriesData) {
      for (let i = 0; i < s.normalizedVals.length; i++) {
        if (s.normalizedVals[i] < min) min = s.normalizedVals[i];
      }
    }
    return min === Infinity ? 0 : min;
  }, [seriesData]);

  const globalMax = useMemo(() => {
    if (seriesData.length === 0) return 1;
    let max = -Infinity;
    for (const s of seriesData) {
      for (let i = 0; i < s.normalizedVals.length; i++) {
        if (s.normalizedVals[i] > max) max = s.normalizedVals[i];
      }
    }
    return max === -Infinity ? 1 : max;
  }, [seriesData]);

  // SVG Paths with decimation for large datasets
  const paths = useMemo(() => {
    const width = 1000;
    const height = 300;
    const padding = 20;
    const range = globalMax - globalMin || 1;

    return seriesData.map(s => {
      const len = s.normalizedVals.length;
      const step = len > 3000 ? Math.ceil(len / 3000) : 1;
      const points: string[] = [];

      for (let i = 0; i < len; i += step) {
        const v = s.normalizedVals[i];
        const x = padding + (i / (len - 1 || 1)) * (width - 2 * padding);
        const y = height - padding - ((v - globalMin) / range) * (height - 2 * padding);
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }

      // Always include the final point
      if ((len - 1) % step !== 0 && len > 0) {
        const v = s.normalizedVals[len - 1];
        const x = width - padding;
        const y = height - padding - ((v - globalMin) / range) * (height - 2 * padding);
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }

      return { colName: s.colName, color: s.color, path: `M ${points.join(' L ')}` };
    });
  }, [seriesData, globalMin, globalMax]);

  // Pairwise statistics if 2 signals selected (e.g. Raw vs Filtered)
  const comparisonMetrics = useMemo(() => {
    if (seriesData.length !== 2) return null;
    const s1 = seriesData[0];
    const s2 = seriesData[1];
    const r = SignalAnalysisEngine.calculatePearsonCorrelation(s1.vals, s2.vals);

    // Variance change
    const var1 = s1.std * s1.std;
    const var2 = s2.std * s2.std;
    const varDiffPct = var1 > 0 ? Math.round(((var1 - var2) / var1) * 100) : 0;

    // RMS Difference
    let sumSqDiff = 0;
    const n = Math.min(s1.vals.length, s2.vals.length);
    for (let i = 0; i < n; i++) {
      const diff = s1.vals[i] - s2.vals[i];
      sumSqDiff += diff * diff;
    }
    const rmsDiff = Math.sqrt(sumSqDiff / (n || 1));

    return {
      correlation: r,
      varianceReductionPct: varDiffPct,
      rmsDifference: Math.round(rmsDiff * 10000) / 10000,
      nameA: s1.colName,
      nameB: s2.colName
    };
  }, [seriesData]);

  return (
    <div className="space-y-6">
      {/* Controls & Channel Selector */}
      <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold tracking-tight uppercase flex items-center gap-2">
              <Layers className="h-4 w-4 text-sky-500" />
              MULTI-SIGNAL OVERLAY &amp; COMPARISON
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Select up to 4 numeric channels to overlay on the common sampling time axis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setNormalizeScale(!normalizeScale)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                normalizeScale ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {normalizeScale ? 'Scale: Z-Score Normalized' : 'Scale: Raw Native Units'}
            </button>
          </div>
        </div>

        {/* Column Toggles */}
        <div className="flex flex-wrap gap-2 mt-4">
          {numericColumns.map(col => {
            const isSelected = selectedCols.includes(col.name);
            const idx = selectedCols.indexOf(col.name);
            const badgeColor = isSelected ? colors[idx % colors.length] : 'transparent';

            return (
              <button
                key={col.name}
                onClick={() => toggleColumn(col.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border flex items-center gap-2 transition ${
                  isSelected
                    ? 'bg-slate-800 text-white border-sky-500 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: isSelected ? badgeColor : '#64748b' }}
                />
                <span>{col.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Comparison Waveform Canvas */}
      <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex justify-between items-center mb-3">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            COMMON TIME-AXIS OVERLAY ({paths.length} Active Channels)
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            {seriesData.map(s => (
              <div key={s.colName} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-slate-300">{s.colName}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative w-full h-80 bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:40px_30px]" />

          <svg viewBox="0 0 1000 300" className="w-full h-full preserve-3d" preserveAspectRatio="none">
            {paths.map(p => (
              <path
                key={p.colName}
                d={p.path}
                fill="none"
                stroke={p.color}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        </div>
      </div>

      {/* Pairwise Comparison Metrics (e.g. Raw vs Filtered) */}
      {comparisonMetrics && (
        <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-sky-500" />
            COMPARATIVE PAIR ANALYSIS: {comparisonMetrics.nameA} vs {comparisonMetrics.nameB}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-[10px] font-mono uppercase text-slate-500">PEARSON CORRELATION (r)</div>
              <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
                {comparisonMetrics.correlation !== null ? comparisonMetrics.correlation : 'N/A'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Linear alignment coefficient</div>
            </div>

            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-[10px] font-mono uppercase text-slate-500">VARIANCE DIFFERENCE</div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                {comparisonMetrics.varianceReductionPct}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">High-frequency noise attenuation proxy</div>
            </div>

            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-[10px] font-mono uppercase text-slate-500">RMS DIFFERENCE</div>
              <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                {comparisonMetrics.rmsDifference}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Root mean square point-by-point deviation</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
