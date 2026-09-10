import React, { useState } from 'react';
import { Database, Search, Filter, AlertCircle, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react';
import { DatasetValidationReport, ColumnProfile } from '../../utils/datasetParser';

interface DatasetOverviewTabProps {
  report: DatasetValidationReport;
  onSelectSignalForAnalysis: (colName: string) => void;
  isDarkMode: boolean;
}

export const DatasetOverviewTab: React.FC<DatasetOverviewTabProps> = ({
  report,
  onSelectSignalForAnalysis,
  isDarkMode
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const filteredColumns = report.columnProfiles.filter(col => {
    if (typeFilter !== 'ALL' && col.dataType !== typeFilter) return false;
    if (searchQuery && !col.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Top 6 Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono font-bold uppercase text-slate-400">TOTAL ROWS</div>
          <div className="text-2xl font-bold font-mono text-sky-500 my-0.5">{report.rowCount.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500">Data Samples</div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono font-bold uppercase text-slate-400">TOTAL COLUMNS</div>
          <div className="text-2xl font-bold font-mono text-indigo-400 my-0.5">{report.columnCount}</div>
          <div className="text-[11px] text-slate-500">All Detected Channels</div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono font-bold uppercase text-slate-400">TOTAL DURATION</div>
          <div className="text-2xl font-bold font-mono text-emerald-500 my-0.5">
            {report.signalDurationSeconds !== null ? `${report.signalDurationSeconds}s` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500">
            {report.signalDurationSeconds !== null ? `${(report.signalDurationSeconds / 60).toFixed(1)} min` : 'Undetermined'}
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono font-bold uppercase text-slate-400">SAMPLING FREQUENCY</div>
          <div className="text-2xl font-bold font-mono text-amber-500 my-0.5">
            {report.estimatedSamplingRateHz !== null ? `${report.estimatedSamplingRateHz} Hz` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500">
            {report.samplingRateSource === 'TIMESTAMP_CALCULATED' ? 'From Timestamps' : 'Unavailable'}
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono font-bold uppercase text-slate-400">SAMPLING INTERVAL</div>
          <div className="text-2xl font-bold font-mono text-cyan-400 my-0.5">
            {report.samplingIntervalSeconds !== null ? `${(report.samplingIntervalSeconds * 1000).toFixed(1)}ms` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-500">Δt per sample</div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono font-bold uppercase text-slate-400">MISSING VALUES</div>
          <div className={`text-2xl font-bold font-mono my-0.5 ${report.missingValuesCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
            {report.missingValuesCount}
          </div>
          <div className="text-[11px] text-slate-500">{report.missingValuesCount > 0 ? 'Null / NaN cells' : 'Zero Missing'}</div>
        </div>
      </div>

      {/* Dataset Metadata Box */}
      <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Database className="h-4 w-4 text-sky-500" />
          FILE SPECIFICATIONS &amp; PARSING PROVENANCE
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500">File Name:</span>
            <div className="font-mono font-bold text-slate-200 truncate mt-0.5">{report.fileName}</div>
          </div>
          <div>
            <span className="text-slate-500">File Format &amp; Size:</span>
            <div className="font-mono font-bold text-slate-200 mt-0.5">{report.fileType} ({formatBytes(report.fileSizeBytes)})</div>
          </div>
          <div>
            <span className="text-slate-500">Timestamp Header:</span>
            <div className="font-mono font-bold text-sky-400 mt-0.5">{report.timestampColumn || 'None detected'}</div>
          </div>
          <div>
            <span className="text-slate-500">Duplicate Rows / Timestamp Gaps:</span>
            <div className="font-mono font-bold text-slate-200 mt-0.5">{report.duplicateRowsCount} duplicate rows • {report.timestampGapsCount} gaps</div>
          </div>
        </div>
      </div>

      {/* Dynamic Column Profile Table (Supports 6, 15, 30, 100+ Columns) */}
      <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold tracking-tight uppercase flex items-center gap-2">
              ALL DATASET COLUMNS DIRECTORY
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {report.columnProfiles.length} Total Columns
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Dynamically extracted and profiled across all uploaded channels. No columns are hidden or omitted.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search columns..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border outline-none ${
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200 focus:border-sky-500' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>

            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border outline-none ${
                isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <option value="ALL">All Types</option>
              <option value="numeric">Numeric</option>
              <option value="timestamp">Timestamp</option>
              <option value="boolean">Boolean</option>
              <option value="categorical">Categorical</option>
              <option value="string">String</option>
            </select>
          </div>
        </div>

        {/* Scrollable Column Profile Table */}
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto mt-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className={`border-b font-mono font-bold text-[10px] uppercase tracking-wider ${
                isDarkMode ? 'bg-[#0B1120] text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Column Name</th>
                <th className="py-2.5 px-3">Data Type</th>
                <th className="py-2.5 px-3 text-right">Valid</th>
                <th className="py-2.5 px-3 text-right">Missing</th>
                <th className="py-2.5 px-3 text-right">Min</th>
                <th className="py-2.5 px-3 text-right">Max</th>
                <th className="py-2.5 px-3 text-right">Mean</th>
                <th className="py-2.5 px-3 text-right">Median</th>
                <th className="py-2.5 px-3 text-right">Std Dev</th>
                <th className="py-2.5 px-3 text-right">Unique</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]">
              {filteredColumns.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-6 text-center text-slate-500 font-sans">
                    No columns match search criteria.
                  </td>
                </tr>
              ) : (
                filteredColumns.map((col, idx) => (
                  <tr key={col.name} className="hover:bg-slate-500/5 transition">
                    <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold text-slate-200 truncate max-w-[200px]" title={col.name}>
                      {col.name}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                        col.dataType === 'numeric'
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                          : col.dataType === 'timestamp'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : col.dataType === 'boolean'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {col.dataType}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">{col.validCount.toLocaleString()}</td>
                    <td className={`py-2 px-3 text-right ${col.missingCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
                      {col.missingCount}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">{col.min !== null ? col.min : '—'}</td>
                    <td className="py-2 px-3 text-right text-slate-300">{col.max !== null ? col.max : '—'}</td>
                    <td className="py-2 px-3 text-right text-slate-300">{col.mean !== null ? col.mean : '—'}</td>
                    <td className="py-2 px-3 text-right text-slate-300">{col.median !== null ? col.median : '—'}</td>
                    <td className="py-2 px-3 text-right text-slate-300">{col.stdDev !== null ? col.stdDev : '—'}</td>
                    <td className="py-2 px-3 text-right text-slate-400">{col.uniqueCount}</td>
                    <td className="py-2 px-3 text-center">
                      {col.isSuitableForWaveform ? (
                        <button
                          onClick={() => onSelectSignalForAnalysis(col.name)}
                          className="px-2 py-0.5 rounded text-[10px] font-sans font-bold bg-sky-600 hover:bg-sky-500 text-white transition shadow-sm inline-flex items-center gap-1"
                        >
                          Analyze <ArrowUpRight className="h-3 w-3" />
                        </button>
                      ) : (
                        <span className="text-[10px] font-sans text-slate-500">Non-Signal</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
