import React, { useState, useRef } from 'react';
import { DatasetParser, DatasetValidationReport } from '../utils/datasetParser';

interface DatasetUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDataset: (report: DatasetValidationReport) => void;
  isDarkMode: boolean;
}

export const DatasetUploadModal: React.FC<DatasetUploadModalProps> = ({
  isOpen,
  onClose,
  onLoadDataset,
  isDarkMode
}) => {
  const [report, setReport] = useState<DatasetValidationReport | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    setIsParsing(true);
    try {
      const validation = await DatasetParser.parseFile(file);
      setReport(validation);
    } catch (err: any) {
      console.error('File parsing error', err);
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      setReport(DatasetParser.createErrorValidation(
        file.name,
        ext,
        file.size,
        [`File analysis failed: ${err?.message || 'Processing error'}. Please ensure the file contains valid tabular data or export to CSV.`]
      ));
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmLoad = () => {
    if (report && report.isValid) {
      onLoadDataset(report);
      onClose();
    }
  };

  const handleDownloadSampleDataset = () => {
    // Generate a sample genuine recorded CSV format for offline testing
    const rows = ['timestamp,time_str,filtered_signal,raw_signal,target_distance,presence'];
    const now = Date.now() - 60000;
    for (let i = 0; i < 600; i++) {
      const t = now + i * 50; // 20 Hz
      const sec = i * 0.05;
      // 16 BPM pure respiration recording: 16 / 60 = 0.2667 Hz
      const val = Math.sin(2 * Math.PI * 0.2667 * sec) * 0.45;
      rows.push(`${t},${new Date(t).toISOString()},${val.toFixed(4)},${(val * 1.1).toFixed(4)},0.85,1`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mr24bsd1_sample_respiratory_dataset.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isDarkMode ? 'bg-[#0B1120] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Offline Dataset Mode
            </div>
            <h3 className="text-lg font-extrabold tracking-tight">
              Upload Dataset for Analysis
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* File Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/30'
                : isDarkMode
                ? 'border-slate-700 hover:border-slate-600 bg-slate-900/40'
                : 'border-slate-300 hover:border-slate-400 bg-slate-50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileChange(e.target.files[0]);
                }
              }}
              accept=".xlsx,.xls,.csv,.json,.txt,.dat"
              className="hidden"
            />
            <div className="text-3xl mb-2">📁</div>
            <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
              {isParsing ? 'Inspecting & Validating Dataset...' : 'Drag & Drop your dataset file here, or browse'}
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Supports large Excel (<span className="font-mono">.xlsx, .xls</span>), CSV (<span className="font-mono">.csv</span>), JSON (<span className="font-mono">.json</span>), and Tabular Text (<span className="font-mono">.txt, .dat</span>) up to 200,000+ data rows
            </p>

            <div className="mt-3 inline-block">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadSampleDataset();
                }}
                className="text-xs text-sky-600 dark:text-sky-400 font-semibold hover:underline flex items-center gap-1 mx-auto"
              >
                <span>⬇ Download Sample MR24BSD1 Dataset (.csv)</span>
              </button>
            </div>
          </div>

          {/* Validation Summary Report */}
          {report && (
            <div className={`p-4 rounded-xl border space-y-3 ${
              report.isValid
                ? isDarkMode ? 'bg-emerald-950/20 border-emerald-800/60' : 'bg-emerald-50/50 border-emerald-200'
                : isDarkMode ? 'bg-rose-950/20 border-rose-800/60' : 'bg-rose-50/50 border-rose-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{report.isValid ? '✅' : '❌'}</span>
                  <span className="font-bold text-sm">
                    {report.isValid ? 'Dataset Validation: PASSED' : 'Dataset Validation: FAILED'}
                  </span>
                </div>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/60 dark:bg-black/40 font-semibold">
                  {report.fileType}
                </span>
              </div>

              {/* Error messages if any */}
              {!report.isValid && (
                <div className="p-3 rounded-lg bg-rose-100/70 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 space-y-1">
                  {report.validationErrors.map((err, i) => (
                    <div key={i} className="font-medium">• {err}</div>
                  ))}
                </div>
              )}

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                <div className="p-2 rounded bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500 block">File Name:</span>
                  <span className="font-semibold font-mono truncate block">{report.fileName}</span>
                </div>

                <div className="p-2 rounded bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500 block">Total Data Rows:</span>
                  <span className="font-bold font-mono">{report.rowCount.toLocaleString()} samples</span>
                </div>

                <div className="p-2 rounded bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500 block">Detected Columns:</span>
                  <span className="font-bold font-mono">{report.columnCount} columns</span>
                </div>

                <div className="p-2 rounded bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500 block">Signal Columns:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 truncate block">
                    {report.detectedSignalColumns.length > 0
                      ? report.detectedSignalColumns.map(c => c.name).join(', ')
                      : 'None detected'}
                  </span>
                </div>

                <div className="p-2 rounded bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500 block">Est. Sampling Frequency:</span>
                  <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {report.estimatedSamplingRateHz ? `${report.estimatedSamplingRateHz} Hz` : 'Determined from row index'}
                  </span>
                </div>

                <div className="p-2 rounded bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-500 block">Signal Duration:</span>
                  <span className="font-bold font-mono">
                    {report.signalDurationSeconds ? `${report.signalDurationSeconds} s (~${(report.signalDurationSeconds / 60).toFixed(1)} min)` : '--'}
                  </span>
                </div>
              </div>

              {/* Data Preview Table */}
              {report.previewRows.length > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-1">
                    <span className="font-semibold">First 5 Rows Preview:</span>
                    <span className="text-[10px] font-mono">Full {report.rowCount.toLocaleString()} rows × {report.columnCount} columns available in Workspace</span>
                  </div>
                  <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left font-mono text-[10px]">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <tr>
                          {report.columnNames.slice(0, 8).map(c => (
                            <th key={c} className="p-1.5 border-r last:border-r-0 border-slate-200 dark:border-slate-700">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {report.previewRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                            {report.columnNames.slice(0, 8).map(c => (
                              <td key={c} className="p-1.5 border-r last:border-r-0 border-slate-200 dark:border-slate-700 truncate max-w-[120px]">
                                {row[c] !== null && row[c] !== undefined ? String(row[c]) : '--'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirmLoad}
            disabled={!report || !report.isValid}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
              report && report.isValid
                ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/30'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
            }`}
          >
            Load &amp; Open Analysis Workspace →
          </button>
        </div>
      </div>
    </div>
  );
};
