import React, { useState, useMemo } from 'react';
import {
  Database,
  Table,
  Activity,
  Layers,
  Heart,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Grid,
  Scale,
  FileText,
  Upload,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { DatasetValidationReport } from '../../utils/datasetParser';

import { DatasetOverviewTab } from './DatasetOverviewTab';
import { RawDataTableTab } from './RawDataTableTab';
import { SignalAnalysisTab } from './SignalAnalysisTab';
import { MultiSignalComparisonTab } from './MultiSignalComparisonTab';
import { RespiratoryAnalysisTab } from './RespiratoryAnalysisTab';
import { FrequencySpectrogramTab } from './FrequencySpectrogramTab';
import { CandidateEventsTab } from './CandidateEventsTab';
import { DataQualityAuditTab } from './DataQualityAuditTab';
import { CorrelationScatterTab } from './CorrelationScatterTab';
import { ReferenceValidationTab } from './ReferenceValidationTab';
import { ResultsSummaryTab } from './ResultsSummaryTab';
import { FileUploadIngestionTab } from './FileUploadIngestionTab';

export type WorkspaceTab =
  | 'FILE_UPLOAD'
  | 'OVERVIEW'
  | 'DATA_TABLE'
  | 'SIGNAL_ANALYSIS'
  | 'MULTI_SIGNAL'
  | 'RESPIRATORY'
  | 'FREQUENCY'
  | 'EVENTS'
  | 'QUALITY_AUDIT'
  | 'CORRELATION'
  | 'REFERENCE'
  | 'RESULTS';

interface OfflineDatasetWorkspaceProps {
  report: DatasetValidationReport | null;
  onLoadDataset?: (report: DatasetValidationReport) => void;
  onOpenUploadModal: () => void;
  onClearDataset: () => void;
  isDarkMode: boolean;
}

export const OfflineDatasetWorkspace: React.FC<OfflineDatasetWorkspaceProps> = ({
  report,
  onLoadDataset,
  onOpenUploadModal,
  onClearDataset,
  isDarkMode
}) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('FILE_UPLOAD');

  // Default selected signal column
  const [selectedSignal, setSelectedSignal] = useState<string>(() => {
    if (!report || !report.columnProfiles) return '';
    const preferred = report.detectedSignalColumns.find(c => c.type === 'FILTERED_RADAR' || c.type === 'PRIMARY_RESPIRATORY')?.name;
    const firstNumeric = report.columnProfiles.find(c => c.isNumeric)?.name;
    return preferred || firstNumeric || report.columnNames[0] || '';
  });

  // Sync selected signal if report changes
  React.useEffect(() => {
    if (report && report.columnProfiles) {
      const preferred = report.detectedSignalColumns.find(c => c.type === 'FILTERED_RADAR' || c.type === 'PRIMARY_RESPIRATORY')?.name;
      const firstNumeric = report.columnProfiles.find(c => c.isNumeric)?.name;
      const initial = preferred || firstNumeric || report.columnNames[0] || '';
      setSelectedSignal(initial);
    }
  }, [report]);

  const tabs: Array<{ id: WorkspaceTab; label: string; icon: any }> = [
    { id: 'FILE_UPLOAD', label: 'Workstation Summary & Ingestion', icon: Database },
    { id: 'OVERVIEW', label: 'Overview & Columns', icon: Database },
    { id: 'DATA_TABLE', label: 'Raw Data Table', icon: Table },
    { id: 'SIGNAL_ANALYSIS', label: 'Signal Waveform', icon: Activity },
    { id: 'MULTI_SIGNAL', label: 'Multi-Signal Overlay', icon: Layers },
    { id: 'RESPIRATORY', label: 'Respiratory Analysis', icon: Heart },
    { id: 'FREQUENCY', label: 'FFT & Spectrogram', icon: Radio },
    { id: 'EVENTS', label: 'Candidate Events', icon: ShieldAlert },
    { id: 'QUALITY_AUDIT', label: 'Quality & Audit', icon: ShieldCheck },
    { id: 'CORRELATION', label: 'Correlation & Scatter', icon: Grid },
    { id: 'REFERENCE', label: 'Reference Validation', icon: Scale },
    { id: 'RESULTS', label: 'Results & Export', icon: FileText }
  ];

  // If no dataset is currently uploaded, show File Upload Category with full manual upload suite
  if (!report || !report.isValid || report.rowCount === 0) {
    return (
      <div className="space-y-4">
        {/* Workspace Header for Unloaded State */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isDarkMode ? 'bg-[#0D1424] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Database className="h-5 w-5" />
                </div>
                <h1 className="text-base font-extrabold tracking-tight">
                  OFFLINE DATASET WORKSTATION
                </h1>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  AWAITING DATASET INGESTION
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/30">
                  SOURCE: USER-UPLOADED FILE
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                  MODE: OFFLINE ANALYSIS
                </span>
              </div>

              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Analysis is based <b>ONLY</b> on the uploaded dataset. Zero live radar or simulated data mixed. No data = no value.
              </p>
            </div>
          </div>
        </div>

        {/* Embedded File Upload & Ingestion Category */}
        <FileUploadIngestionTab
          currentReport={null}
          onLoadDataset={(newReport) => {
            if (onLoadDataset) onLoadDataset(newReport);
          }}
          onClearDataset={onClearDataset}
          onNavigateToTab={(tabKey) => setActiveTab(tabKey as any)}
          isDarkMode={isDarkMode}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workspace Master Header */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isDarkMode ? 'bg-[#0D1424] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Database className="h-5 w-5" />
              </div>
              <h1 className="text-lg font-extrabold tracking-tight">
                OFFLINE DATASET ANALYSIS
              </h1>

              {/* Mandatory Prominent Badges */}
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                OFFLINE DATASET
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/30">
                SOURCE: USER-UPLOADED FILE
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                MODE: OFFLINE ANALYSIS
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Analysis is based <b>ONLY</b> on the uploaded dataset. Never called LIVE DATA. Zero live radar or simulated data mixed.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenUploadModal}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition inline-flex items-center gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload New File</span>
            </button>

            <button
              onClick={onClearDataset}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400 transition inline-flex items-center gap-1.5"
              title="Unload dataset from memory"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Unload Dataset</span>
            </button>
          </div>
        </div>

        {/* File Specs Pill Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
          <div>File: <b className="text-slate-200">{report.fileName}</b></div>
          <div>Rows: <b className="text-sky-400">{report.rowCount.toLocaleString()}</b></div>
          <div>Columns: <b className="text-indigo-400">{report.columnCount}</b></div>
          <div>Duration: <b className="text-emerald-400">{report.signalDurationSeconds !== null ? `${report.signalDurationSeconds}s` : 'N/A'}</b></div>
          <div>Sampling Rate: <b className="text-amber-400">{report.estimatedSamplingRateHz !== null ? `${report.estimatedSamplingRateHz} Hz` : 'N/A'}</b></div>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className={`p-1.5 rounded-xl border flex items-center gap-1 overflow-x-auto ${
        isDarkMode ? 'bg-[#0B1120] border-slate-800' : 'bg-slate-100 border-slate-200'
      }`}>
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                isActive
                  ? isDarkMode
                    ? 'bg-sky-600 text-white shadow-sm font-bold'
                    : 'bg-white text-sky-700 shadow-sm font-bold border border-sky-200'
                  : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Content Area */}
      <div className="transition-opacity">
        {activeTab === 'FILE_UPLOAD' && (
          <FileUploadIngestionTab
            currentReport={report}
            onLoadDataset={(newReport) => {
              if (onLoadDataset) onLoadDataset(newReport);
            }}
            onClearDataset={onClearDataset}
            onNavigateToTab={(tabKey) => setActiveTab(tabKey as any)}
            isDarkMode={isDarkMode}
          />
        )}

        {activeTab === 'OVERVIEW' && (
          <DatasetOverviewTab
            report={report}
            onSelectSignalForAnalysis={col => {
              setSelectedSignal(col);
              setActiveTab('SIGNAL_ANALYSIS');
            }}
            isDarkMode={isDarkMode}
          />
        )}

        {activeTab === 'DATA_TABLE' && (
          <RawDataTableTab report={report} isDarkMode={isDarkMode} />
        )}

        {activeTab === 'SIGNAL_ANALYSIS' && (
          <SignalAnalysisTab
            report={report}
            selectedSignal={selectedSignal}
            onSelectSignal={setSelectedSignal}
            isDarkMode={isDarkMode}
          />
        )}

        {activeTab === 'MULTI_SIGNAL' && (
          <MultiSignalComparisonTab report={report} isDarkMode={isDarkMode} />
        )}

        {activeTab === 'RESPIRATORY' && (
          <RespiratoryAnalysisTab
            report={report}
            selectedSignal={selectedSignal}
            isDarkMode={isDarkMode}
          />
        )}

        {activeTab === 'FREQUENCY' && (
          <FrequencySpectrogramTab
            report={report}
            selectedSignal={selectedSignal}
            isDarkMode={isDarkMode}
          />
        )}

        {activeTab === 'EVENTS' && (
          <CandidateEventsTab
            report={report}
            selectedSignal={selectedSignal}
            isDarkMode={isDarkMode}
          />
        )}

        {activeTab === 'QUALITY_AUDIT' && (
          <DataQualityAuditTab report={report} isDarkMode={isDarkMode} />
        )}

        {activeTab === 'CORRELATION' && (
          <CorrelationScatterTab report={report} isDarkMode={isDarkMode} />
        )}

        {activeTab === 'REFERENCE' && (
          <ReferenceValidationTab
            report={report}
            selectedSignal={selectedSignal}
            isDarkMode={isDarkMode}
          />
        )}

        {activeTab === 'RESULTS' && (
          <ResultsSummaryTab
            report={report}
            selectedSignal={selectedSignal}
            isDarkMode={isDarkMode}
          />
        )}
      </div>
    </div>
  );
};
