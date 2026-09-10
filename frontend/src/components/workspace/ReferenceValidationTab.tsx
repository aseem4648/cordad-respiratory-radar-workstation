import React, { useMemo } from 'react';
import { CheckCircle2, AlertCircle, BarChart3, Scale } from 'lucide-react';
import { DatasetValidationReport } from '../../utils/datasetParser';
import { SignalAnalysisEngine, ReferenceComparisonResult } from '../../utils/signalAnalysis';

interface ReferenceValidationTabProps {
  report: DatasetValidationReport;
  selectedSignal: string;
  isDarkMode: boolean;
}

export const ReferenceValidationTab: React.FC<ReferenceValidationTabProps> = ({
  report,
  selectedSignal,
  isDarkMode
}) => {
  const refCol = report.detectedSignalColumns.find(c => c.type === 'REFERENCE_RR')?.name 
    || report.columnNames.find(c => ['ref', 'reference', 'gold_standard', 'ecg_rr', 'reference_rr'].some(k => c.toLowerCase().includes(k))) || null;

  const results: ReferenceComparisonResult | null = useMemo(() => {
    if (!refCol) return null;
    const est = report.rawRows.map(r => Number(r[selectedSignal]));
    const ref = report.rawRows.map(r => Number(r[refCol]));
    return SignalAnalysisEngine.calculateReferenceValidation(est, ref);
  }, [report, selectedSignal, refCol]);

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-600/20">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight uppercase">
              REFERENCE GROUND-TRUTH VALIDATION
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Evaluates statistical error (MAE, RMSE, Bias, Correlation) against paired reference signals.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">
            Reference Column: <span className="font-bold text-sky-400">{refCol || 'None Detected'}</span>
          </span>
        </div>
      </div>

      {!refCol || !results ? (
        <div className={`p-8 rounded-xl border text-center ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200'}`}>
          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-200">No Reference Ground-Truth Column Detected</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
            Validation metrics (MAE, RMSE, Bias) require a paired reference column (e.g. <code>ref_rr</code>, <code>reference_rr</code>, <code>gold_standard</code>) in the uploaded dataset. Zero fabricated accuracy metrics are produced.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="text-[10px] font-mono uppercase text-slate-500">MEAN ABSOLUTE ERROR (MAE)</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{results.mae}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Average absolute divergence</div>
          </div>

          <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="text-[10px] font-mono uppercase text-slate-500">ROOT MEAN SQ ERROR (RMSE)</div>
            <div className="text-2xl font-bold font-mono text-sky-400 mt-1">{results.rmse}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Quadratic deviation penalty</div>
          </div>

          <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="text-[10px] font-mono uppercase text-slate-500">SYSTEMATIC BIAS</div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{results.bias}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Mean signed error offset</div>
          </div>

          <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="text-[10px] font-mono uppercase text-slate-500">PEARSON CORRELATION (r)</div>
            <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">{results.pearsonCorrelation}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Linear agreement with reference</div>
          </div>
        </div>
      )}
    </div>
  );
};
