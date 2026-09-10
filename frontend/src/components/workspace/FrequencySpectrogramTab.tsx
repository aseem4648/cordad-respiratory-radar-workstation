import React, { useState, useMemo } from 'react';
import { Radio, Sliders, AlertCircle, BarChart2 } from 'lucide-react';
import { DatasetValidationReport } from '../../utils/datasetParser';
import { SignalAnalysisEngine, FftResult, SpectrogramResult } from '../../utils/signalAnalysis';

interface FrequencySpectrogramTabProps {
  report: DatasetValidationReport;
  selectedSignal: string;
  isDarkMode: boolean;
}

export const FrequencySpectrogramTab: React.FC<FrequencySpectrogramTabProps> = ({
  report,
  selectedSignal,
  isDarkMode
}) => {
  const [windowSize, setWindowSize] = useState<number>(64);
  const [overlapPct, setOverlapPct] = useState<number>(50);

  const signalVals = useMemo(() => {
    return report.rawRows.map(r => {
      const v = Number(r[selectedSignal]);
      return isNaN(v) ? 0 : v;
    });
  }, [report, selectedSignal]);

  const fs = report.estimatedSamplingRateHz;

  // FFT calculation
  const fft: FftResult | null = useMemo(() => {
    return SignalAnalysisEngine.calculateFFT(signalVals, fs);
  }, [signalVals, fs]);

  // Spectrogram calculation
  const spectrogram: SpectrogramResult | null = useMemo(() => {
    return SignalAnalysisEngine.calculateSpectrogram(signalVals, fs, windowSize, overlapPct);
  }, [signalVals, fs, windowSize, overlapPct]);

  // Generate SVG path for FFT spectrum
  const fftPath = useMemo(() => {
    if (!fft || fft.frequencies.length === 0) return '';
    const width = 1000;
    const height = 240;
    const padding = 20;

    const maxFreq = Math.min(2.5, Math.max(...fft.frequencies)); // Focus up to 2.5 Hz
    const maxMag = Math.max(...fft.magnitudes) || 1;

    const points: string[] = [];
    for (let i = 0; i < fft.frequencies.length; i++) {
      const f = fft.frequencies[i];
      if (f > maxFreq) break;
      const m = fft.magnitudes[i];
      const x = padding + (f / maxFreq) * (width - 2 * padding);
      const y = height - padding - (m / maxMag) * (height - 2 * padding);
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    return points.length > 0 ? `M ${points.join(' L ')}` : '';
  }, [fft]);

  if (!fs) {
    return (
      <div className={`p-8 rounded-xl border text-center ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-200">Sampling Frequency Unavailable</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
          Frequency-domain analysis cannot be reliably calculated because the uploaded dataset lacks a verified monotonic timestamp series to determine the sampling frequency (Fs).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Spectral Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono uppercase text-slate-500">DOMINANT FREQUENCY</div>
          <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
            {fft?.dominantFrequencyHz !== null ? `${fft?.dominantFrequencyHz} Hz` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Spectral peak center</div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono uppercase text-slate-500">RESPIRATORY TRANSLATION</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {fft?.dominantRespiratoryBpm !== null ? `${fft?.dominantRespiratoryBpm} bpm` : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">f_peak × 60 conversion</div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono uppercase text-slate-500">PEAK SPECTRAL POWER</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {fft?.peakPower !== null ? fft?.peakPower : 'N/A'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Normalized peak magnitude</div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono uppercase text-slate-500">SAMPLING NYQUIST LIMIT</div>
          <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">
            {(fs / 2).toFixed(1)} Hz
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Fs / 2 limit ({fs} Hz Fs)</div>
        </div>
      </div>

      {/* FFT Power Spectrum */}
      <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex justify-between items-center mb-3">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Radio className="h-4 w-4 text-sky-500" />
            FFT POWER SPECTRUM (0 to 2.5 Hz) • {selectedSignal}
          </div>
          <div className="text-xs font-mono text-slate-400">
            Hann Windowed • Radix-2 FFT
          </div>
        </div>

        <div className="relative w-full h-64 bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:40px_30px]" />

          {/* Shaded Respiratory Band (0.08 to 0.75 Hz) */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/10 border-x border-emerald-500/20 pointer-events-none"
            style={{
              left: `${20 + (0.08 / 2.5) * 960}px`,
              width: `${((0.75 - 0.08) / 2.5) * 960}px`
            }}
          />

          <svg viewBox="0 0 1000 240" className="w-full h-full preserve-3d" preserveAspectRatio="none">
            <path
              d={fftPath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2 px-1">
          <span>0.0 Hz (DC)</span>
          <span className="text-emerald-400 font-bold">Respiratory Band (0.08 – 0.75 Hz / 5 – 45 bpm)</span>
          <span>2.5 Hz</span>
        </div>
      </div>

      {/* STFT Spectrogram */}
      {spectrogram && (
        <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-sky-500" />
              SHORT-TIME FOURIER TRANSFORM (STFT) SPECTROGRAM
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Window:</span>
                <select
                  value={windowSize}
                  onChange={e => setWindowSize(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 text-slate-200 px-2 py-1 rounded outline-none"
                >
                  <option value={32}>32</option>
                  <option value={64}>64</option>
                  <option value={128}>128</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Overlap:</span>
                <select
                  value={overlapPct}
                  onChange={e => setOverlapPct(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 text-slate-200 px-2 py-1 rounded outline-none"
                >
                  <option value={25}>25%</option>
                  <option value={50}>50%</option>
                  <option value={75}>75%</option>
                </select>
              </div>
            </div>
          </div>

          {/* Spectrogram Grid Heatmap */}
          <div className="w-full bg-slate-950 p-2 rounded-xl border border-slate-800 overflow-x-auto">
            <div className="flex gap-0.5 min-w-[600px] h-48">
              {spectrogram.spectrogramMatrix.map((slice, timeIdx) => (
                <div key={timeIdx} className="flex-1 flex flex-col-reverse gap-0.5">
                  {slice.slice(0, 24).map((p, freqIdx) => {
                    const range = spectrogram.maxPower - spectrogram.minPower || 1;
                    const norm = Math.max(0, Math.min(1, (p - spectrogram.minPower) / range));
                    // Color mapping: dark blue -> cyan -> yellow -> red
                    const hue = Math.round((1 - norm) * 240); // 240 (blue) to 0 (red)
                    return (
                      <div
                        key={freqIdx}
                        className="flex-1 rounded-[1px] transition-colors"
                        style={{ backgroundColor: `hsl(${hue}, 85%, ${20 + norm * 50}%)` }}
                        title={`Time: ${spectrogram.times[timeIdx]}s | Freq: ${spectrogram.frequencies[freqIdx]} Hz`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2 px-1">
              <span>Time: 0s</span>
              <span>Y-Axis: Frequency (0 to {(spectrogram.frequencies[23] || 1.5).toFixed(1)} Hz)</span>
              <span>End ({spectrogram.times[spectrogram.times.length - 1] || 0}s)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
