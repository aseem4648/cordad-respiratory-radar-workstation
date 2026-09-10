import React from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { DatasetValidationReport } from '../../utils/datasetParser';

interface DataQualityAuditTabProps {
  report: DatasetValidationReport;
  isDarkMode: boolean;
}

export const DataQualityAuditTab: React.FC<DataQualityAuditTabProps> = ({ report, isDarkMode }) => {
  const constantCols = report.columnProfiles.filter(c => c.uniqueCount <= 1);
  const highMissingCols = report.columnProfiles.filter(c => c.missingCount > 0);

  return (
    <div className="space-y-6">
      {/* Overview Status */}
      <div className={`p-5 rounded-xl border flex items-center justify-between gap-4 ${
        isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-600/10 text-emerald-500 border border-emerald-600/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight uppercase">
              DATASET INTEGRITY &amp; FIDELITY AUDIT
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Rigorous sanity verification of file formats, monotonic timestamps, null rates, and quantization flatlines.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
            report.isValid
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}>
            {report.isValid ? 'VALIDATED FOR ANALYSIS' : 'CRITICAL INTEGRITY ERRORS'}
          </span>
        </div>
      </div>

      {/* Audit Checklist Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Check 1: Timestamps Monotonicity */}
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">Timestamp Monotonicity</span>
            {report.isMonotonicTimestamps ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-400" />
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {report.isMonotonicTimestamps
              ? 'All timestamps increase monotonically without backwards time jumps.'
              : 'Non-monotonic sequence detected! Some timestamps appear out of order.'}
          </p>
        </div>

        {/* Check 2: Sampling Gaps */}
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">Sampling Continuity</span>
            {report.timestampGapsCount === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-400" />
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {report.timestampGapsCount === 0
              ? 'Zero sampling gaps detected. Continuous regular transmission.'
              : `${report.timestampGapsCount} timing gaps (&gt;3× median interval) detected in stream.`}
          </p>
        </div>

        {/* Check 3: Duplicate Rows */}
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">Duplicate Records</span>
            {report.duplicateRowsCount === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-400" />
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {report.duplicateRowsCount === 0
              ? 'Zero duplicate sample rows identified in the dataset.'
              : `${report.duplicateRowsCount} duplicate data rows detected.`}
          </p>
        </div>

        {/* Check 4: Missing Cell Rate */}
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">Null / Missing Rates</span>
            {report.missingValuesCount === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-400" />
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {report.missingValuesCount === 0
              ? '100% complete dataset. Zero missing or null values.'
              : `${report.missingValuesCount} missing cells across ${highMissingCols.length} columns.`}
          </p>
        </div>

        {/* Check 5: Constant Flatline Channels */}
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">Flatline Detection</span>
            {constantCols.length === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-400" />
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {constantCols.length === 0
              ? 'All numeric channels have dynamic variance. No constant flatlines.'
              : `${constantCols.length} columns exhibit zero variance (constant values).`}
          </p>
        </div>

        {/* Check 6: Mathematical Format */}
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">Numerical Validity</span>
            {report.invalidValuesCount === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400" />
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {report.invalidValuesCount === 0
              ? 'All numeric columns contain valid IEEE floating point numbers.'
              : `${report.invalidValuesCount} invalid or non-numeric tokens found in numeric channels.`}
          </p>
        </div>
      </div>
    </div>
  );
};
