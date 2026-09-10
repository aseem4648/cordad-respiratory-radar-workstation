import React, { useState, useMemo } from 'react';
import { Table, Search, ChevronLeft, ChevronRight, Download, Filter, Eye, EyeOff } from 'lucide-react';
import { DatasetValidationReport } from '../../utils/datasetParser';

interface RawDataTableTabProps {
  report: DatasetValidationReport;
  isDarkMode: boolean;
}

export const RawDataTableTab: React.FC<RawDataTableTabProps> = ({ report, isDarkMode }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => new Set(report.columnNames));
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const toggleColumn = (col: string) => {
    const next = new Set(visibleColumns);
    if (next.has(col)) {
      if (next.size > 1) next.delete(col);
    } else {
      next.add(col);
    }
    setVisibleColumns(next);
  };

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortColumn(col);
      setSortDirection('ASC');
    }
  };

  const filteredRows = useMemo(() => {
    let result = report.rawRows;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(row => {
        return Object.values(row).some(v => v !== null && String(v).toLowerCase().includes(q));
      });
    }

    if (sortColumn) {
      result = [...result].sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'ASC' ? valA - valB : valB - valA;
        }
        return sortDirection === 'ASC' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
      });
    }

    return result;
  }, [report.rawRows, searchQuery, sortColumn, sortDirection]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const pageRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);

  const displayedCols = report.columnNames.filter(c => visibleColumns.has(c));

  const handleExportCsv = () => {
    const header = displayedCols.join(',') + '\n';
    const rows = filteredRows.map(r => {
      return displayedCols.map(c => {
        const val = r[c];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && val.includes(',')) return `"${val.replace(/"/g, '""')}"`;
        return String(val);
      }).join(',');
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataset_filtered_${report.fileName}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
      {/* Table Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold tracking-tight uppercase flex items-center gap-2">
            <Table className="h-4 w-4 text-sky-500" />
            RAW DATASET TABLE
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              Showing {filteredRows.length.toLocaleString()} of {report.rowCount.toLocaleString()} Rows
            </span>
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Unfiltered dataset inspectable row-by-row with dynamic sorting, filtering, and column masking.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search in any row or value..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border outline-none ${
                isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200 focus:border-sky-500' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            />
          </div>

          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Columns ({displayedCols.length}/{report.columnCount})</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export View CSV</span>
          </button>
        </div>
      </div>

      {/* Column Visibility Picker (Dropdown Panel) */}
      {showColumnPicker && (
        <div className="p-3 my-3 rounded-lg bg-slate-900 border border-slate-800">
          <div className="text-[10px] font-mono font-bold uppercase text-slate-400 mb-2 flex justify-between">
            <span>Toggle Visible Columns</span>
            <button onClick={() => setVisibleColumns(new Set(report.columnNames))} className="text-sky-400 hover:underline">
              Show All
            </button>
          </div>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
            {report.columnNames.map(col => {
              const active = visibleColumns.has(col);
              return (
                <button
                  key={col}
                  onClick={() => toggleColumn(col)}
                  className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 border transition ${
                    active ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  <span>{col}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Paginated Data Table with Horizontal & Vertical Scrolling */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto mt-3 border rounded-lg border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className={`border-b font-mono font-bold text-[10px] uppercase tracking-wider ${
              isDarkMode ? 'bg-[#0B1120] text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              <th className="py-2.5 px-3">Row #</th>
              {displayedCols.map(col => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="py-2.5 px-3 cursor-pointer hover:text-sky-400 transition select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>{col}</span>
                    {sortColumn === col && (
                      <span className="text-sky-400">{sortDirection === 'ASC' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={displayedCols.length + 1} className="py-8 text-center text-slate-500 font-sans">
                  No matching data rows found.
                </td>
              </tr>
            ) : (
              pageRows.map((row, rIdx) => (
                <tr key={startIndex + rIdx} className="hover:bg-slate-500/5 transition">
                  <td className="py-2 px-3 text-slate-500">{startIndex + rIdx + 1}</td>
                  {displayedCols.map(col => {
                    const val = row[col];
                    return (
                      <td key={col} className="py-2 px-3 whitespace-nowrap text-slate-300">
                        {val !== null && val !== undefined ? String(val) : <span className="text-slate-600 italic">null</span>}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className={`px-2 py-1 rounded border outline-none ${
              isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-slate-500 ml-2">
            Showing {filteredRows.length > 0 ? startIndex + 1 : 0} – {Math.min(startIndex + rowsPerPage, filteredRows.length)} of {filteredRows.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded border border-slate-700 hover:bg-slate-800 disabled:opacity-30 transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded border border-slate-700 hover:bg-slate-800 disabled:opacity-30 transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
