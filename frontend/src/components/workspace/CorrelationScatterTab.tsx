import React, { useState, useMemo } from 'react';
import { Grid, ScatterChart, Info } from 'lucide-react';
import { DatasetValidationReport } from '../../utils/datasetParser';
import { SignalAnalysisEngine } from '../../utils/signalAnalysis';

interface CorrelationScatterTabProps {
  report: DatasetValidationReport;
  isDarkMode: boolean;
}

export const CorrelationScatterTab: React.FC<CorrelationScatterTabProps> = ({ report, isDarkMode }) => {
  const numericCols = useMemo(() => {
    return report.columnProfiles.filter(c => c.isNumeric && c.name !== report.timestampColumn);
  }, [report]);

  const [colX, setColX] = useState<string>(numericCols[0]?.name || '');
  const [colY, setColY] = useState<string>(numericCols[1]?.name || numericCols[0]?.name || '');

  // Correlation Matrix across all numeric columns (up to 12)
  const matrixCols = numericCols.slice(0, 10);
  const correlationMatrix = useMemo(() => {
    const raw = report.rawRows;
    const seriesMap = new Map<string, number[]>();
    matrixCols.forEach(c => {
      seriesMap.set(c.name, raw.map(r => Number(r[c.name])));
    });

    const matrix: Array<{ colA: string; colB: string; r: number | null }> = [];
    for (const cA of matrixCols) {
      for (const cB of matrixCols) {
        const sA = seriesMap.get(cA.name)!;
        const sB = seriesMap.get(cB.name)!;
        const r = SignalAnalysisEngine.calculatePearsonCorrelation(sA, sB);
        matrix.push({ colA: cA.name, colB: cB.name, r });
      }
    }
    return matrix;
  }, [report, matrixCols]);

  // Scatter plot points
  const scatterPoints = useMemo(() => {
    const raw = report.rawRows;
    const pts: Array<{ x: number; y: number }> = [];
    const limit = Math.min(raw.length, 500); // Sample for performance

    for (let i = 0; i < limit; i++) {
      const vx = Number(raw[i][colX]);
      const vy = Number(raw[i][colY]);
      if (!isNaN(vx) && !isNaN(vy) && isFinite(vx) && isFinite(vy)) {
        pts.push({ x: vx, y: vy });
      }
    }
    return pts;
  }, [report, colX, colY]);

  const pairR = useMemo(() => {
    const raw = report.rawRows;
    const xs = raw.map(r => Number(r[colX]));
    const ys = raw.map(r => Number(r[colY]));
    return SignalAnalysisEngine.calculatePearsonCorrelation(xs, ys);
  }, [report, colX, colY]);

  const minX = Math.min(...scatterPoints.map(p => p.x), 0);
  const maxX = Math.max(...scatterPoints.map(p => p.x), 1);
  const minY = Math.min(...scatterPoints.map(p => p.y), 0);
  const maxY = Math.max(...scatterPoints.map(p => p.y), 1);

  return (
    <div className="space-y-6">
      {/* Correlation Matrix */}
      <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Grid className="h-4 w-4 text-sky-500" />
          PEARSON CORRELATION MATRIX (All Numeric Channels)
        </div>

        <div className="overflow-x-auto">
          <table className="text-center text-xs font-mono border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-slate-500 text-left">Channel</th>
                {matrixCols.map(c => (
                  <th key={c.name} className="p-2 text-slate-400 font-bold max-w-[90px] truncate" title={c.name}>
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixCols.map(cA => (
                <tr key={cA.name} className="border-t border-slate-800/60">
                  <td className="p-2 text-slate-300 font-bold text-left max-w-[120px] truncate" title={cA.name}>
                    {cA.name}
                  </td>
                  {matrixCols.map(cB => {
                    const entry = correlationMatrix.find(m => m.colA === cA.name && m.colB === cB.name);
                    const r = entry?.r ?? 0;
                    const isSelf = cA.name === cB.name;
                    const absR = Math.abs(r);
                    const bg = isSelf ? 'bg-sky-500/20 text-sky-300 font-bold' : absR > 0.7 ? 'bg-emerald-500/20 text-emerald-300 font-bold' : absR > 0.3 ? 'bg-slate-800 text-slate-300' : 'text-slate-500';

                    return (
                      <td key={cB.name} className={`p-2 ${bg}`}>
                        {r !== null ? r.toFixed(2) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Column-to-Column Scatter Plot */}
      <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
          <div>
            <h3 className="text-sm font-bold tracking-tight uppercase">
              BIVARIATE SCATTER PLOT
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Inspect linear and non-linear relationships between any two uploaded channels.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">X-Axis:</span>
              <select
                value={colX}
                onChange={e => setColX(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 px-2 py-1 rounded outline-none"
              >
                {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Y-Axis:</span>
              <select
                value={colY}
                onChange={e => setColY(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 px-2 py-1 rounded outline-none"
              >
                {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-2">
          <span>r = {pairR !== null ? pairR : 'N/A'}</span>
          <span>Sampled {scatterPoints.length} Points</span>
        </div>

        <div className="relative w-full h-72 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-center p-4">
          <svg viewBox="0 0 600 240" className="w-full h-full" preserveAspectRatio="none">
            {scatterPoints.map((p, idx) => {
              const cx = 30 + ((p.x - minX) / (maxX - minX || 1)) * 540;
              const cy = 210 - ((p.y - minY) / (maxY - minY || 1)) * 180;
              return (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r="2.5"
                  fill="#0ea5e9"
                  opacity="0.65"
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};
