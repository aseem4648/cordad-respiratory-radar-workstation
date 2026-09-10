import React, { useRef, useEffect, useState } from 'react';
import { WaveformPoint } from '../types';
import { Activity } from 'lucide-react';
import { DataSourceMode } from './DataSourceBanner';

interface LiveWaveformChartProps {
  waveformBuffer: WaveformPoint[];
  isConnected: boolean;
  isStreamPaused: boolean;
  selectedWindowSec: number;
  onSelectWindowSec: (sec: number) => void;
  dataSource?: DataSourceMode;
  sourceLabel?: string;
  isDarkMode?: boolean;
}

export const LiveWaveformChart: React.FC<LiveWaveformChartProps> = ({
  waveformBuffer,
  isConnected,
  isStreamPaused,
  selectedWindowSec,
  onSelectWindowSec,
  dataSource = 'NONE',
  sourceLabel,
  isDarkMode = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [gain, setGain] = useState<number>(1.0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.parentElement?.clientWidth || 800;
      const height = canvas.parentElement?.clientHeight || 360;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = isDarkMode ? '#070A12' : '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Medical Grid Lines
      ctx.strokeStyle = isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'rgba(226, 232, 240, 0.9)';
      ctx.lineWidth = 1;
      const gridSpacingX = width / 10;
      const gridSpacingY = height / 8;

      ctx.beginPath();
      for (let x = 0; x <= width; x += gridSpacingX) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += gridSpacingY) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Zero baseline line (center)
      const centerY = height / 2;
      ctx.strokeStyle = isDarkMode ? 'rgba(6, 182, 212, 0.25)' : 'rgba(2, 132, 199, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // CRITICAL DATA INTEGRITY CHECK:
      // If NO DATA SOURCE is connected, NEVER draw any synthetic waveform!
      if (dataSource === 'NONE' || waveformBuffer.length === 0) {
        ctx.fillStyle = isDarkMode ? 'rgba(148, 163, 184, 0.8)' : 'rgba(71, 85, 105, 0.9)';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NO DATA SOURCE CONNECTED', width / 2, centerY - 14);
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = isDarkMode ? 'rgba(100, 116, 139, 0.9)' : 'rgba(148, 163, 184, 0.9)';
        ctx.fillText('Waiting for physical MR24BSD1 radar connection or dataset upload...', width / 2, centerY + 12);
        return;
      }

      // If LIVE_HARDWARE but disconnected:
      if (dataSource === 'LIVE_HARDWARE' && !isConnected) {
        ctx.fillStyle = isDarkMode ? 'rgba(244, 63, 94, 0.85)' : 'rgba(225, 29, 72, 0.9)';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('RADAR DISCONNECTED / NO LIVE DATA', width / 2, centerY - 14);
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = isDarkMode ? 'rgba(148, 163, 184, 0.8)' : 'rgba(100, 116, 139, 0.8)';
        ctx.fillText('Physical MR24BSD1 stream lost. Waveform drawing halted.', width / 2, centerY + 12);
        return;
      }

      // If we reach here, we have genuine data (LIVE_HARDWARE or OFFLINE_DATASET or DEV_SIMULATION)
      const now = Date.now();
      const cutoffTime = now - selectedWindowSec * 1000;
      const visibleData = waveformBuffer.filter(p => p.time >= cutoffTime);

      if (visibleData.length < 2) {
        ctx.fillStyle = isDarkMode ? 'rgba(148, 163, 184, 0.7)' : 'rgba(100, 116, 139, 0.8)';
        ctx.font = '13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Awaiting sufficient radar samples...', width / 2, centerY);
        return;
      }

      let maxAbs = 0.05;
      visibleData.forEach(d => {
        const val = Math.abs(d.filteredSignal ?? d.rawSignal ?? 0);
        if (val > maxAbs) maxAbs = val;
      });
      const effectiveScale = ((height / 2) * 0.82) / (maxAbs * (1 / gain));

      // Waveform line stroke
      ctx.shadowColor = isDarkMode ? '#06B6D4' : '#0284C7';
      ctx.shadowBlur = isDarkMode ? 8 : 2;
      ctx.strokeStyle = isDarkMode ? '#22D3EE' : '#0284C7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      const timeRange = selectedWindowSec * 1000;
      let latestX = 0;
      let latestY = centerY;

      visibleData.forEach((point, i) => {
        const x = ((point.time - cutoffTime) / timeRange) * width;
        const val = point.filteredSignal ?? point.rawSignal ?? 0;
        const y = centerY - val * effectiveScale;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        latestX = x;
        latestY = y;
      });

      ctx.stroke();
      ctx.shadowBlur = 0;

      // Leading current pointer dot
      ctx.fillStyle = isDarkMode ? '#38BDF8' : '#0284C7';
      ctx.beginPath();
      ctx.arc(latestX - 4, latestY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Axis labels
      ctx.fillStyle = isDarkMode ? 'rgba(148, 163, 184, 0.8)' : '#64748B';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`+${maxAbs.toFixed(3)} mm`, 10, 18);
      ctx.fillText('0.000', 10, centerY - 4);
      ctx.fillText(`-${maxAbs.toFixed(3)} mm`, 10, height - 10);

      ctx.textAlign = 'right';
      ctx.fillText(`${selectedWindowSec}s Window`, width - 12, height - 10);
    };

    render();
  }, [waveformBuffer, isConnected, isStreamPaused, selectedWindowSec, gain, isDarkMode, dataSource]);

  return (
    <div className={`${isDarkMode ? 'bg-[#0F172A]/90 border-slate-800' : 'bg-white border-slate-200/90 shadow-md'} border rounded-xl p-4 flex flex-col justify-between h-[420px] transition-colors`}>
      
      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-3 mb-2 pb-2 border-b select-none ${
        isDarkMode ? 'border-slate-800' : 'border-slate-200'
      }`}>
        <div className="flex items-center gap-2.5">
          <Activity className="h-4 w-4 text-cyan-600" />
          <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
            isDarkMode ? 'text-slate-100' : 'text-slate-900'
          }`}>
            RESPIRATORY WAVEFORM (CHEST WALL DISPLACEMENT)
          </h2>
          <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border font-bold ${
            dataSource === 'LIVE_HARDWARE'
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
              : dataSource === 'OFFLINE_DATASET'
              ? 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300'
              : dataSource === 'DEV_SIMULATION'
              ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
              : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
          }`}>
            {dataSource === 'LIVE_HARDWARE'
              ? 'LIVE MR24BSD1 24 GHz FMCW'
              : dataSource === 'OFFLINE_DATASET'
              ? `OFFLINE DATASET (${sourceLabel || 'Uploaded'})`
              : dataSource === 'DEV_SIMULATION'
              ? 'SIMULATION'
              : 'NO DATA SOURCE'}
          </span>
        </div>

        {/* Window Selector */}
        <div className={`flex items-center gap-1 p-1 rounded-lg border text-xs ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          {[10, 30, 60, 120].map((sec) => (
            <button
              key={sec}
              onClick={() => onSelectWindowSec(sec)}
              className={`px-2.5 py-1 rounded font-mono font-bold transition ${
                selectedWindowSec === sec
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className={`flex-1 relative w-full h-full rounded-lg border overflow-hidden ${
        isDarkMode ? 'border-slate-900 bg-[#070A12]' : 'border-slate-200 bg-white'
      }`}>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      </div>

      {/* Footer */}
      <div className={`flex items-center justify-between text-[11px] font-mono pt-2.5 mt-1 border-t ${
        isDarkMode ? 'border-slate-800/60 text-slate-400' : 'border-slate-200 text-slate-500'
      }`}>
        <div className="flex items-center gap-4">
          <span>SOURCE: <strong className={isDarkMode ? "text-slate-200" : "text-slate-900"}>{dataSource}</strong></span>
          <span>BANDPASS: <strong className="text-cyan-600">0.10 - 0.70 Hz</strong> (6 - 42 BPM)</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setGain(g => g === 2.0 ? 0.5 : (g === 0.5 ? 1.0 : 2.0))}
            className="hover:text-cyan-600 transition"
          >
            GAIN: <strong className={isDarkMode ? "text-slate-200" : "text-slate-900"}>{gain}x</strong>
          </button>
          <span>SAMPLES: <strong className={isDarkMode ? "text-slate-200" : "text-slate-900"}>{waveformBuffer.length}</strong></span>
        </div>
      </div>

    </div>
  );
};
