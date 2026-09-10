import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Download,
  Layers,
  Clock,
  Activity,
  Sliders,
  Sparkles,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DatasetParser, DatasetValidationReport } from '../../utils/datasetParser';

export type DatasetCategory =
  | 'SLEEP_APNEA_TRIAL'
  | 'ICU_BEDSIDE_MONITORING'
  | 'RADAR_DSP_BASEBAND'
  | 'MULTIMODAL_VALIDATION'
  | 'CUSTOM_EXPERIMENTAL';

interface FileUploadIngestionTabProps {
  currentReport: DatasetValidationReport | null;
  onLoadDataset: (report: DatasetValidationReport) => void;
  isDarkMode: boolean;
}

export const FileUploadIngestionTab: React.FC<FileUploadIngestionTabProps> = ({
  currentReport,
  onLoadDataset,
  isDarkMode
}) => {
  const [selectedCategory, setSelectedCategory] = useState<DatasetCategory>('RADAR_DSP_BASEBAND');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  
  // Pending parsed report before user clicks "Confirm Ingestion"
  const [pendingReport, setPendingReport] = useState<DatasetValidationReport | null>(null);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [samplingRateOverride, setSamplingRateOverride] = useState<string>('AUTO');
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const categories: Array<{ id: DatasetCategory; title: string; desc: string; icon: string; badge: string }> = [
    {
      id: 'RADAR_DSP_BASEBAND',
      title: '24 GHz Radar Baseband & Phase',
      desc: 'MR24BSD1 FMCW receiver I/Q, phase displacement, filtered chest wall waveforms',
      icon: '📡',
      badge: 'Radar FMCW'
    },
    {
      id: 'SLEEP_APNEA_TRIAL',
      title: 'Polysomnography & Sleep Apnea Trial',
      desc: 'Overnight apnea/hypopnea sleep study records with respiratory disturbance indices',
      icon: '🌙',
      badge: 'PSG / Apnea'
    },
    {
      id: 'ICU_BEDSIDE_MONITORING',
      title: 'Bedside Continuous Vitals',
      desc: 'Continuous ICU physiological telemetry, patient movement, and respiratory rate',
      icon: '🛏️',
      badge: 'Clinical ICU'
    },
    {
      id: 'MULTIMODAL_VALIDATION',
      title: 'Multimodal Validation Study',
      desc: 'Paired contactless radar signals alongside chest-belt or spirometry reference ground truth',
      icon: '📊',
      badge: 'Cross-Validation'
    },
    {
      id: 'CUSTOM_EXPERIMENTAL',
      title: 'Custom Research Telemetry',
      desc: 'Generic physiological time-series with user-defined columnar structure',
      icon: '🔬',
      badge: 'Experimental'
    }
  ];

  const handleProcessFile = async (file: File, targetSheet?: string) => {
    setIsParsing(true);
    setParseError(null);
    setActiveFile(file);

    try {
      // Check if Excel file to detect multiple sheets
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        setAvailableSheets(workbook.SheetNames);
        const sheetToUse = targetSheet || workbook.SheetNames[0] || '';
        setSelectedSheet(sheetToUse);
      } else {
        setAvailableSheets([]);
        setSelectedSheet('');
      }

      const report = await DatasetParser.parseFile(file);
      
      // Apply sampling rate override if user selected a fixed rate
      if (samplingRateOverride !== 'AUTO' && report.isValid) {
        const fixedHz = parseFloat(samplingRateOverride);
        if (!isNaN(fixedHz) && fixedHz > 0) {
          report.estimatedSamplingRateHz = fixedHz;
        }
      }

      setPendingReport(report);
    } catch (err: any) {
      console.error('File parsing failed:', err);
      setParseError(err.message || 'Failed to parse file. Please verify format.');
      setPendingReport(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleSheetChange = (newSheet: string) => {
    setSelectedSheet(newSheet);
    if (activeFile) {
      handleProcessFile(activeFile, newSheet);
    }
  };

  const handleConfirmIngestion = () => {
    if (pendingReport && pendingReport.isValid) {
      onLoadDataset(pendingReport);
    }
  };

  // Generate real Excel (.xlsx) file with multi-channel biomedical radar respiratory data
  const handleDownloadSampleExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows: Array<Record<string, any>> = [];
    const now = Date.now() - 120000;
    const fs = 20; // 20 Hz
    const durationSec = 60; // 60 seconds
    const totalSamples = fs * durationSec;

    for (let i = 0; i < totalSamples; i++) {
      const t = now + i * 50;
      const sec = i / fs;
      // Normal breathing 16 bpm: 16/60 = 0.2667 Hz
      const baseWave = Math.sin(2 * Math.PI * 0.2667 * sec) * 0.42;
      // Cardiac artifact harmonic: 72 bpm: 1.2 Hz
      const cardiacWave = Math.sin(2 * Math.PI * 1.2 * sec) * 0.04;
      // Modest noise
      const noise = (Math.random() - 0.5) * 0.03;
      
      const filtered = parseFloat((baseWave).toFixed(4));
      const raw = parseFloat((baseWave + cardiacWave + noise).toFixed(4));
      
      // Simulate candidate apnea between second 25 and 42
      const isApneaSec = sec >= 25 && sec <= 42;
      const finalFiltered = isApneaSec ? parseFloat((filtered * 0.15).toFixed(4)) : filtered;
      const finalRaw = isApneaSec ? parseFloat((raw * 0.2).toFixed(4)) : raw;

      rows.push({
        timestamp_ms: t,
        iso_time: new Date(t).toISOString(),
        radar_filtered_signal: finalFiltered,
        radar_raw_baseband: finalRaw,
        target_distance_m: 0.85,
        presence_detected: 1,
        reference_chest_belt: isApneaSec ? parseFloat((filtered * 0.12).toFixed(4)) : filtered,
        clinical_state: isApneaSec ? 'OBSTRUCTIVE_APNEA_CANDIDATE' : 'EUPNEIC_NORMAL'
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'MR24BSD1_Radar_Telemetry');

    // Add secondary study sheet for reference
    const metaRows = [
      { Parameter: 'Device', Value: 'MR24BSD1 24 GHz FMCW Radar' },
      { Parameter: 'Center Frequency', Value: '24.125 GHz' },
      { Parameter: 'Sampling Rate (Hz)', Value: 20 },
      { Parameter: 'Trial Category', Value: 'Contactless Sleep & Apnea Evaluation' },
      { Parameter: 'Apnea Episode Window', Value: '25.0s - 42.0s (17 seconds)' }
    ];
    const metaWs = XLSX.utils.json_to_sheet(metaRows);
    XLSX.utils.book_append_sheet(wb, metaWs, 'Study_Metadata');

    XLSX.writeFile(wb, 'MR24BSD1_Clinical_Radar_Dataset.xlsx');
  };

  const handleDownloadSampleCsv = () => {
    const rows = ['timestamp_ms,iso_time,filtered_signal,raw_signal,target_distance,presence,reference_rr'];
    const now = Date.now() - 60000;
    for (let i = 0; i < 600; i++) {
      const t = now + i * 50;
      const sec = i * 0.05;
      const val = Math.sin(2 * Math.PI * 0.2667 * sec) * 0.45;
      rows.push(`${t},${new Date(t).toISOString()},${val.toFixed(4)},${(val * 1.12).toFixed(4)},0.85,1,16.0`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MR24BSD1_Respiratory_Sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Ingestion Category Specification */}
      <div className={`p-5 rounded-2xl border transition-all ${
        isDarkMode ? 'bg-[#0D1424] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center font-bold">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                DATASET INGESTION &amp; EXCEL IMPORT SUITE
              </h2>
              <p className="text-xs text-slate-400">
                Manual file ingestion supporting Microsoft Excel (.xlsx, .xls), CSV, TSV, JSON, and raw telemetry text
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSampleExcel}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 transition flex items-center gap-1.5 shadow-sm"
              title="Download realistic 24 GHz FMCW radar dataset formatted as Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Sample Excel (.xlsx)</span>
            </button>

            <button
              onClick={handleDownloadSampleCsv}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 transition flex items-center gap-1.5 shadow-sm"
              title="Download sample respiratory CSV dataset"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Sample CSV</span>
            </button>
          </div>
        </div>

        {/* 1. Category Selector */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-sky-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Select Dataset Category / Study Type</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? isDarkMode
                        ? 'bg-sky-950/40 border-sky-500/60 shadow-md shadow-sky-500/10'
                        : 'bg-sky-50 border-sky-300 shadow-sm'
                      : isDarkMode
                      ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{cat.icon}</span>
                      <span className="text-xs font-bold truncate">{cat.title}</span>
                    </div>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                      isSelected
                        ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {cat.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {cat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Drag & Drop Manual File Upload Area */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isDarkMode ? 'bg-[#0D1424] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold uppercase tracking-wider text-sky-500 flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Manual File Upload &amp; Format Ingestion</span>
          </div>

          <span className="text-[11px] font-mono text-slate-400">
            Supports: .xlsx, .xls, .csv, .tsv, .json, .txt (Up to 150 MB)
          </span>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-sky-400 bg-sky-500/10 scale-[1.005]'
              : isDarkMode
              ? 'border-slate-700 bg-slate-900/40 hover:border-sky-500/50 hover:bg-slate-900/80'
              : 'border-slate-300 bg-slate-50 hover:border-sky-400 hover:bg-sky-50/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.tsv,.json,.txt"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleProcessFile(e.target.files[0]);
              }
            }}
          />

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center mx-auto mb-3 shadow-lg">
            {isParsing ? (
              <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
            ) : (
              <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
            )}
          </div>

          <div className="text-sm font-bold text-slate-200 mb-1">
            {isParsing ? 'Parsing & Profiling Dataset Channels...' : 'Drag & Drop your Excel or CSV file here'}
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Click to browse your computer or drop file directly. All columns will be dynamically detected and profiled.
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/30 transition">
            <Upload className="w-4 h-4" />
            <span>Browse Local Files</span>
          </div>
        </div>

        {/* Parsing Error Notice */}
        {parseError && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span><b>File Parsing Failed:</b> {parseError}</span>
          </div>
        )}

        {/* Multi-Sheet & Sampling Rate Configuration Bar */}
        {activeFile && (
          <div className="mt-5 p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Sheet selector */}
              {availableSheets.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Select Excel Worksheet:</span>
                  </span>
                  <select
                    value={selectedSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-sky-300 font-mono font-semibold focus:outline-none focus:border-sky-500"
                  >
                    {availableSheets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sampling Rate Configuration */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>Sampling Frequency:</span>
                </span>
                <select
                  value={samplingRateOverride}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSamplingRateOverride(val);
                    if (activeFile) {
                      handleProcessFile(activeFile, selectedSheet);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-sky-300 font-mono font-semibold focus:outline-none focus:border-sky-500"
                >
                  <option value="AUTO">Auto-detect from timestamps</option>
                  <option value="20">20 Hz (Standard MR24BSD1)</option>
                  <option value="10">10 Hz (Low Power)</option>
                  <option value="50">50 Hz (High Speed)</option>
                  <option value="100">100 Hz (Ultrasonic / Lab)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Pre-Ingestion Inspection & Action Card */}
      {pendingReport && (
        <div className={`p-6 rounded-2xl border transition-all ${
          pendingReport.isValid
            ? isDarkMode ? 'bg-[#0A1628] border-sky-500/40' : 'bg-sky-50/50 border-sky-300'
            : isDarkMode ? 'bg-[#1C1014] border-rose-500/40' : 'bg-rose-50 border-rose-300'
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                {pendingReport.isValid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <h3 className="text-base font-extrabold text-slate-100">
                  {pendingReport.isValid ? 'Dataset Verification Passed — Ready for Analysis' : 'Dataset Ingestion Warnings'}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                {pendingReport.fileName} • {pendingReport.fileType} • {(pendingReport.fileSizeBytes / 1024).toFixed(1)} KB
                {selectedSheet && ` • Sheet: "${selectedSheet}"`}
              </p>
            </div>

            {/* Ingest Action Button */}
            {pendingReport.isValid && (
              <button
                onClick={handleConfirmIngestion}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" />
                <span>Ingest Dataset into Workstation</span>
              </button>
            )}
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Total Rows</div>
              <div className="text-lg font-mono font-bold text-sky-400">
                {pendingReport.rowCount.toLocaleString()}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-500 font-bold uppercase">All Columns Profiled</div>
              <div className="text-lg font-mono font-bold text-emerald-400">
                {pendingReport.columnCount} Channels
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Sampling Frequency</div>
              <div className="text-lg font-mono font-bold text-amber-400">
                {pendingReport.estimatedSamplingRateHz ? `${pendingReport.estimatedSamplingRateHz} Hz` : 'N/A'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Signal Duration</div>
              <div className="text-lg font-mono font-bold text-cyan-400">
                {pendingReport.signalDurationSeconds ? `${pendingReport.signalDurationSeconds.toFixed(1)}s` : 'Unknown'}
              </div>
            </div>
          </div>

          {/* Detected Signal Columns directory */}
          <div className="space-y-1.5 mb-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Detected Signal Channels:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pendingReport.columnProfiles.map((col) => (
                <span
                  key={col.name}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    col.isSuitableForWaveform
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {col.name} ({col.dataType})
                </span>
              ))}
            </div>
          </div>

          {/* Quick Preview Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-2">
            <div className="text-[10px] text-slate-500 font-mono font-bold mb-1 px-1">
              FIRST 3 SAMPLES PREVIEW:
            </div>
            <table className="w-full text-[11px] font-mono text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  {pendingReport.columnNames.slice(0, 8).map((c) => (
                    <th key={c} className="p-1.5">{c}</th>
                  ))}
                  {pendingReport.columnNames.length > 8 && (
                    <th className="p-1.5 text-slate-500">+{pendingReport.columnNames.length - 8} more</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pendingReport.previewRows.slice(0, 3).map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-900/60 text-slate-300">
                    {pendingReport.columnNames.slice(0, 8).map((c) => (
                      <td key={c} className="p-1.5 truncate max-w-[120px]">{String(row[c] ?? '-')}</td>
                    ))}
                    {pendingReport.columnNames.length > 8 && (
                      <td className="p-1.5 text-slate-600">...</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
