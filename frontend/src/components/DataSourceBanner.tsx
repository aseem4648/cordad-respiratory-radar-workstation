import React from 'react';
import { DatasetValidationReport } from '../utils/datasetParser';

export type DataSourceMode = 'NONE' | 'LIVE_HARDWARE' | 'OFFLINE_DATASET' | 'DEV_SIMULATION';

interface DataSourceBannerProps {
  dataSource: DataSourceMode;
  datasetReport: DatasetValidationReport | null;
  onOpenUpload: () => void;
  onClearDataset: () => void;
  onViewReport: () => void;
  onOpenWorkspace?: () => void;
  hardwareLastPacketTime?: number;
  isDarkMode: boolean;
}

export const DataSourceBanner: React.FC<DataSourceBannerProps> = ({
  dataSource,
  datasetReport,
  onOpenUpload,
  onClearDataset,
  onViewReport,
  onOpenWorkspace,
  isDarkMode
}) => {
  return (
    <div
      className={`p-3.5 sm:p-4 rounded-xl border shadow-sm transition-all select-none ${
        dataSource === 'LIVE_HARDWARE'
          ? isDarkMode ? 'bg-emerald-950/30 border-emerald-800 text-slate-100' : 'bg-emerald-50 border-emerald-300 text-emerald-950'
          : dataSource === 'OFFLINE_DATASET'
          ? isDarkMode ? 'bg-sky-950/30 border-sky-800 text-slate-100' : 'bg-sky-50 border-sky-300 text-sky-950'
          : dataSource === 'DEV_SIMULATION'
          ? isDarkMode ? 'bg-amber-950/40 border-amber-600 text-amber-200' : 'bg-amber-50 border-amber-400 text-amber-950'
          : isDarkMode ? 'bg-[#0B1120] border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: State Badge + Provenance */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="mt-0.5 sm:mt-0">
            {dataSource === 'LIVE_HARDWARE' ? (
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
            ) : dataSource === 'OFFLINE_DATASET' ? (
              <span className="inline-flex rounded-full h-3.5 w-3.5 bg-sky-500"></span>
            ) : dataSource === 'DEV_SIMULATION' ? (
              <span className="inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 animate-pulse"></span>
            ) : (
              <span className="inline-flex rounded-full h-3.5 w-3.5 bg-slate-400"></span>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                DATA SOURCE:
              </span>
              <span
                className={`font-mono text-xs font-extrabold px-2.5 py-0.5 rounded uppercase tracking-wider ${
                  dataSource === 'LIVE_HARDWARE'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                    : dataSource === 'OFFLINE_DATASET'
                    ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-700'
                    : dataSource === 'DEV_SIMULATION'
                    ? 'bg-amber-200 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-400'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                }`}
              >
                {dataSource === 'LIVE_HARDWARE'
                  ? '● LIVE HARDWARE'
                  : dataSource === 'OFFLINE_DATASET'
                  ? '● OFFLINE DATASET ANALYSIS'
                  : dataSource === 'DEV_SIMULATION'
                  ? '⚠️ DIGITAL SIMULATION — NOT REAL SENSOR DATA'
                  : '● NO DATA SOURCE CONNECTED'}
              </span>

              {/* Provenance Tag */}
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {dataSource === 'LIVE_HARDWARE' && 'Source: MR24BSD1 24 GHz Radar → ESP32 → Backend → Dashboard'}
                {dataSource === 'OFFLINE_DATASET' && `Source: ${datasetReport?.fileName} → DatasetParser → DSP → Dashboard`}
                {dataSource === 'NONE' && 'Status: Waiting for radar hardware or dataset upload'}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {dataSource === 'LIVE_HARDWARE' && 'Genuine physical millimeter-wave radar RF Doppler stream is active. Displaying real thoracic displacement.'}
              {dataSource === 'OFFLINE_DATASET' && `Displaying ${datasetReport?.rowCount.toLocaleString()} actual recorded data samples from uploaded file. Zero synthetic interpolation.`}
              {dataSource === 'NONE' && 'Biomedical integrity active: No waveform or physiological numbers are fabricated when sensor or dataset is absent.'}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {dataSource === 'NONE' && (
            <button
              onClick={onOpenUpload}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/30 transition-all flex items-center gap-1.5"
            >
              <span>📁</span>
              <span>Upload Dataset (.xlsx, .csv)</span>
            </button>
          )}

          {dataSource === 'OFFLINE_DATASET' && (
            <>
              {onOpenWorkspace && (
                <button
                  onClick={onOpenWorkspace}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm shadow-sky-600/30 transition-all flex items-center gap-1.5"
                >
                  <span>📊</span>
                  <span>Open Analysis Workspace →</span>
                </button>
              )}
              <button
                onClick={onViewReport}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/80 dark:bg-slate-800 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-white transition-colors"
              >
                Validation Report
              </button>
              <button
                onClick={onClearDataset}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors"
              >
                Unload Dataset
              </button>
            </>
          )}

          {dataSource === 'LIVE_HARDWARE' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-semibold">
                HARDWARE STREAMING
              </span>
              <button
                onClick={onOpenUpload}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Switch to Offline File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
