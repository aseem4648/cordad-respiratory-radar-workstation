import React, { useMemo } from 'react';
import { AlertTriangle, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { DatasetValidationReport } from '../../utils/datasetParser';
import { SignalAnalysisEngine, CandidateRespiratoryEvent } from '../../utils/signalAnalysis';

interface CandidateEventsTabProps {
  report: DatasetValidationReport;
  selectedSignal: string;
  isDarkMode: boolean;
}

export const CandidateEventsTab: React.FC<CandidateEventsTabProps> = ({
  report,
  selectedSignal,
  isDarkMode
}) => {
  const signalVals = useMemo(() => {
    return report.rawRows.map(r => {
      const v = Number(r[selectedSignal]);
      return isNaN(v) ? 0 : v;
    });
  }, [report, selectedSignal]);

  const timestamps = useMemo(() => {
    if (!report.timestampColumn) return undefined;
    return report.rawRows.map(r => Number(r[report.timestampColumn!]));
  }, [report]);

  const events: CandidateRespiratoryEvent[] = useMemo(() => {
    return SignalAnalysisEngine.detectCandidateEvents(signalVals, timestamps, report.estimatedSamplingRateHz);
  }, [signalVals, timestamps, report]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight uppercase">
              CANDIDATE RESPIRATORY EVENT ANALYSIS
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Retrospective detection of sustained respiratory amplitude envelope collapse (&gt;70% drop for &ge;10s).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">
            Signal: <span className="text-sky-400 font-bold">{selectedSignal}</span>
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono uppercase text-slate-500">CANDIDATE EVENTS</div>
          <div className={`text-2xl font-bold font-mono mt-1 ${events.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {events.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Identified episodes</div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono uppercase text-slate-500">ANALYZED DURATION</div>
          <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
            {report.signalDurationSeconds ? `${report.signalDurationSeconds}s` : `${signalVals.length} samples`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Total duration evaluated</div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono uppercase text-slate-500">LONGEST EVENT DURATION</div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
            {events.length > 0 ? `${Math.max(...events.map(e => e.durationSec))}s` : '0s'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Maximum episode length</div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono uppercase text-slate-500">MAX AMPLITUDE DROP</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {events.length > 0 ? `${Math.max(...events.map(e => e.amplitudeReductionPct))}%` : '0%'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Relative to 75th percentile envelope</div>
        </div>
      </div>

      {/* Events Table */}
      <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3">
          DETECTED CANDIDATE EVENT TIMELINE
        </div>

        {events.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs font-mono">
            ✓ No candidate apnea or hypopnea episodes detected under &ge;10s threshold criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Event ID</th>
                  <th className="py-2.5 px-3">Classification</th>
                  <th className="py-2.5 px-3">Start Time</th>
                  <th className="py-2.5 px-3">End Time</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Envelope Reduction</th>
                  <th className="py-2.5 px-3">Baseline Mean</th>
                  <th className="py-2.5 px-3">Event Mean</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-[11px]">
                {events.map(e => (
                  <tr key={e.id} className="hover:bg-slate-500/5 transition">
                    <td className="py-2.5 px-3 text-slate-300 font-bold">{e.id}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${
                        e.type === 'CANDIDATE_APNEA'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{e.startTimeSec}s</td>
                    <td className="py-2.5 px-3 text-slate-300">{e.endTimeSec}s</td>
                    <td className="py-2.5 px-3 text-rose-400 font-bold">{e.durationSec}s</td>
                    <td className="py-2.5 px-3 text-amber-400 font-bold">-{e.amplitudeReductionPct}%</td>
                    <td className="py-2.5 px-3 text-slate-400">{e.preEventMean}</td>
                    <td className="py-2.5 px-3 text-slate-400">{e.duringEventMean}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
