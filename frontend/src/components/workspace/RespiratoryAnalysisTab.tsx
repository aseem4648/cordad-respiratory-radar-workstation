import React, { useMemo } from 'react';
import { Heart, Activity, AlertCircle, CheckCircle2, TrendingUp, Clock } from 'lucide-react';
import { DatasetValidationReport } from '../../utils/datasetParser';
import { SignalAnalysisEngine } from '../../utils/signalAnalysis';

interface RespiratoryAnalysisTabProps {
  report: DatasetValidationReport;
  selectedSignal: string;
  isDarkMode: boolean;
}

export const RespiratoryAnalysisTab: React.FC<RespiratoryAnalysisTabProps> = ({
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

  const fs = report.estimatedSamplingRateHz;

  // Calculate FFT for dominant peak estimation
  const fft = useMemo(() => {
    return SignalAnalysisEngine.calculateFFT(signalVals, fs);
  }, [signalVals, fs]);

  // Calculate time domain metrics
  const td = useMemo(() => {
    return SignalAnalysisEngine.calculateTimeDomain(signalVals);
  }, [signalVals]);

  // Check validity
  const hasValidSignal = td !== null && td.detectedPeaksCount >= 2;
  const estimatedRR = fft?.dominantRespiratoryBpm ?? (td?.meanPeakIntervalSeconds && td.meanPeakIntervalSeconds > 0 ? Math.round(60 / td.meanPeakIntervalSeconds) : null);

  const isRespiratoryBand = estimatedRR !== null && estimatedRR >= 6 && estimatedRR <= 45;

  return (
    <div className="space-y-6">
      {/* Top Estimated RR Banner */}
      <div className={`p-6 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <Heart className="h-7 w-7 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                PHYSIOLOGICAL ESTIMATION
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30 uppercase">
                OFFLINE DATASET ESTIMATE
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-200 mt-0.5">
              Signal Channel: <span className="font-mono text-sky-400">{selectedSignal}</span>
            </div>
          </div>
        </div>

        {/* RR Metric Box */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase text-slate-400">ESTIMATED RESPIRATORY RATE</div>
            <div className={`text-4xl font-extrabold font-mono mt-0.5 ${isRespiratoryBand ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isRespiratoryBand ? `${estimatedRR} ` : 'Unavailable'}
              {isRespiratoryBand && <span className="text-xs font-sans text-slate-500 font-semibold">breaths/min</span>}
            </div>
          </div>
        </div>
      </div>

      {!isRespiratoryBand && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-400">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Respiratory Rate Unavailable from Current Signal</div>
            <div className="text-slate-400 mt-1 leading-relaxed">
              Reason: The selected channel (<b>{selectedSignal}</b>) does not exhibit periodic respiratory chest displacement in the physiological range (6 to 45 breaths/min), or the sampling frequency could not be verified from timestamps.
            </div>
          </div>
        </div>
      )}

      {/* Physiological Parameters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono uppercase text-slate-500">BREATH INTERVAL (IBI)</div>
          <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
            {td?.meanPeakIntervalSeconds ? `${td.meanPeakIntervalSeconds}s` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Average cycle duration</div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono uppercase text-slate-500">DETECTED BREATH PEAKS</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {td?.detectedPeaksCount || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Cycle peaks detected</div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono uppercase text-slate-500">DOMINANT FREQUENCY</div>
          <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">
            {fft?.dominantFrequencyHz ? `${fft.dominantFrequencyHz} Hz` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Spectral peak center</div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono uppercase text-slate-500">SIGNAL INTEGRITY</div>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            {hasValidSignal ? 'VALID' : 'MARGINAL'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Peak consistency metric</div>
        </div>
      </div>

      {/* Clinical Disclaimer Callout */}
      <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
        isDarkMode ? 'bg-sky-950/20 border-sky-800/40 text-sky-200' : 'bg-sky-50 border-sky-200 text-sky-800'
      }`}>
        <Activity className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <div className="font-bold mb-0.5">Offline Retrospective Analysis Protocol</div>
          This physiological analysis is performed strictly post-hoc on the static uploaded dataset. It is NOT a real-time patient telemetry monitor and must not be used for acute clinical intervention.
        </div>
      </div>
    </div>
  );
};
