import React from 'react';
import { FileText, Download, CheckCircle2 } from 'lucide-react';
import { DatasetValidationReport } from '../../utils/datasetParser';

interface ResultsSummaryTabProps {
  report: DatasetValidationReport;
  selectedSignal: string;
  isDarkMode: boolean;
}

export const ResultsSummaryTab: React.FC<ResultsSummaryTabProps> = ({ report, selectedSignal, isDarkMode }) => {
  const handleExportJson = () => {
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      datasetMetadata: {
        fileName: report.fileName,
        fileType: report.fileType,
        rowCount: report.rowCount,
        columnCount: report.columnCount,
        samplingRateHz: report.estimatedSamplingRateHz,
        durationSeconds: report.signalDurationSeconds
      },
      analyzedChannel: selectedSignal,
      columnProfiles: report.columnProfiles.map(c => ({
        name: c.name,
        type: c.dataType,
        min: c.min,
        max: c.max,
        mean: c.mean,
        stdDev: c.stdDev
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis_report_${report.fileName}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-600/10 text-sky-400 border border-sky-600/20">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight uppercase">
              OFFLINE ANALYSIS EXECUTIVE REPORT
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Structured summary of all statistical findings derived from the uploaded dataset.
            </p>
          </div>
        </div>

        <button
          onClick={handleExportJson}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition shadow-sm"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Full JSON Report</span>
        </button>
      </div>

      {/* Structured Summary Grid */}
      <div className={`p-5 rounded-xl border font-mono text-xs ${isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          <div className="space-y-2.5 pr-0 md:pr-4">
            <div className="flex justify-between">
              <span className="text-slate-500">DATASET FILE:</span>
              <span className="font-bold text-slate-200">{report.fileName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ANALYSIS TYPE:</span>
              <span className="text-sky-400">Offline Retrospective Analysis</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">TOTAL RECORDED SAMPLES:</span>
              <span className="text-slate-200">{report.rowCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ANALYZED DURATION:</span>
              <span className="text-slate-200">{report.signalDurationSeconds ? `${report.signalDurationSeconds}s` : 'Undetermined'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">SAMPLING FREQUENCY:</span>
              <span className="text-amber-400">{report.estimatedSamplingRateHz ? `${report.estimatedSamplingRateHz} Hz` : 'Unavailable'}</span>
            </div>
          </div>

          <div className="space-y-2.5 pt-4 md:pt-0 pl-0 md:pl-4">
            <div className="flex justify-between">
              <span className="text-slate-500">PRIMARY CHANNEL:</span>
              <span className="font-bold text-sky-400">{selectedSignal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">MISSING VALUE RATE:</span>
              <span className="text-emerald-400">{((report.missingValuesCount / Math.max(1, report.rowCount * report.columnCount)) * 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">TIMING INTEGRITY:</span>
              <span className={report.isMonotonicTimestamps ? 'text-emerald-400' : 'text-rose-400'}>
                {report.isMonotonicTimestamps ? 'Monotonic' : 'Non-monotonic'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">DATA INTEGRITY STATUS:</span>
              <span className="text-emerald-400 font-bold">100% Sourced from Upload</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
