import React from 'react';
import { Play, Square, Download, Trash2, Database } from 'lucide-react';
import { RecordingStatus } from '../types';
import { formatDuration } from '../utils/formatting';

interface RecordingControlsProps {
  status: RecordingStatus | null;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  exportCsvUrl: string;
  isDarkMode?: boolean;
}

export const RecordingControls: React.FC<RecordingControlsProps> = ({
  status,
  onStart,
  onStop,
  onClear,
  exportCsvUrl,
  isDarkMode = false
}) => {
  const isRecording = status?.isRecording || false;
  const duration = status?.durationSeconds || 0;
  const sampleCount = status?.recordedSamplesCount || 0;

  return (
    <div className={`${isDarkMode ? 'bg-[#0F172A]/90 border-slate-800' : 'bg-white border-slate-200/90 shadow-md'} border rounded-xl p-4 transition-colors`}>
      <div className={`flex items-center justify-between border-b pb-2 mb-3 select-none ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-cyan-600" />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            SESSION RECORDING & CSV EXPORT
          </h3>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className={`h-2.5 w-2.5 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-slate-400'}`} />
          <span className={`font-bold ${isRecording ? 'text-rose-600' : 'text-slate-500'}`}>
            {isRecording ? `RECORDING ${formatDuration(duration)}` : 'IDLE'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!isRecording ? (
            <button
              onClick={onStart}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
            >
              <Play className="h-3.5 w-3.5 fill-current" /> START RECORDING
            </button>
          ) : (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-sm"
            >
              <Square className="h-3.5 w-3.5 fill-current" /> STOP RECORDING
            </button>
          )}

          <a
            href={exportCsvUrl}
            download
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold transition shadow-sm"
          >
            <Download className="h-3.5 w-3.5" /> EXPORT CSV
          </a>

          <button
            onClick={onClear}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" /> CLEAR
          </button>
        </div>

        <div className="text-xs font-mono text-slate-500">
          RECORDED SAMPLES: <strong className={isDarkMode ? "text-slate-200" : "text-slate-800"}>{sampleCount}</strong>
        </div>
      </div>
    </div>
  );
};
