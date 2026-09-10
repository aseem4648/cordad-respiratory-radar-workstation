import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, Wind, Activity, AlertTriangle, ShieldCheck, CheckCircle2, 
  Sliders, Download, Video, Camera, RefreshCw, X, Play, Pause, 
  Clock, AlertOctagon, Check, Eye, HelpCircle
} from 'lucide-react';

interface RPPGTelemetry {
  type: string;
  timestamp: string;
  camera_connected: boolean;
  face_detected: boolean;
  hr: number | null;
  hr_rolling: number | null;
  hr_status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  rr: number | null;
  rr_rolling: number | null;
  rr_status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  sqi: number;
  sqi_status: 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'INVALID';
  is_valid: boolean;
  apnea_state: 'NO_APNEA' | 'APNEA_PENDING' | 'APNEA_WARNING' | 'PROLONGED_APNEA';
  apnea_duration: number;
  apnea_msg: string;
  apnea_pattern: string | null;
  distress_status: 'NORMAL' | 'DISTRESS_RISK' | 'CRITICAL_DISTRESS_RISK' | 'DEPRESSION_RISK';
  overall_status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'SIGNAL_UNAVAILABLE';
  pulse_waveform: number;
  resp_waveform: number;
  active_alerts: Array<{
    id: string;
    timestamp: string;
    parameter: string;
    value: any;
    threshold_exceeded: string;
    severity: 'CRITICAL' | 'WARNING' | 'NORMAL' | 'SIGNAL_UNAVAILABLE';
    message: string;
    acknowledged: boolean;
    duration_seconds: number;
  }>;
  recent_alerts: any[];
  camera_source?: string;
  thresholds?: any;
}

interface RPPGMonitoringViewProps {
  isDarkMode: boolean;
}

export const RPPGMonitoringView: React.FC<RPPGMonitoringViewProps> = ({ isDarkMode }) => {
  const [telemetry, setTelemetry] = useState<RPPGTelemetry | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [cameraSourceInput, setCameraSourceInput] = useState<string>('0');
  const [isUpdatingSource, setIsUpdatingSource] = useState<boolean>(false);

  // Time-series buffers for real-time graphs (last 60 data points = 60s)
  const [hrHistory, setHrHistory] = useState<Array<{ time: string; hr: number }>>([]);
  const [rrHistory, setRrHistory] = useState<Array<{ time: string; rr: number }>>([]);
  
  // Waveform buffers (oscilloscope)
  const pulseWaveformBuffer = useRef<number[]>([]);
  const respWaveformBuffer = useRef<number[]>([]);
  
  const pulseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const respCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Threshold form state
  const [thresholds, setThresholds] = useState({
    hr_normal_min: 60,
    hr_normal_max: 100,
    hr_warning_low: 50,
    hr_warning_high: 100,
    hr_critical_low: 40,
    hr_critical_high: 120,
    rr_normal_min: 12,
    rr_normal_max: 20,
    rr_warning_low: 10,
    rr_warning_high: 20,
    rr_critical_low: 8,
    rr_critical_high: 30,
    apnea_warning_sec: 10,
    apnea_critical_sec: 20,
    warning_persistence_sec: 10,
    critical_persistence_sec: 5
  });

  // Connect to Python rPPG WebSocket service on port 8001
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connect = () => {
      try {
        ws = new WebSocket('ws://localhost:8001/ws');

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data: RPPGTelemetry = JSON.parse(event.data);
            setTelemetry(data);

            if (data.thresholds) {
              setThresholds(prev => ({ ...prev, ...data.thresholds }));
            }

            // Update time-series trends
            if (data.is_valid && data.hr !== null && data.hr > 0) {
              setHrHistory(prev => [...prev.slice(-59), { time: data.timestamp, hr: data.hr! }]);
            }
            if (data.is_valid && data.rr !== null && data.rr > 0) {
              setRrHistory(prev => [...prev.slice(-59), { time: data.timestamp, rr: data.rr! }]);
            }

            // Push to waveform buffers
            pulseWaveformBuffer.current.push(data.pulse_waveform || 0);
            if (pulseWaveformBuffer.current.length > 200) pulseWaveformBuffer.current.shift();

            respWaveformBuffer.current.push(data.resp_waveform || 0);
            if (respWaveformBuffer.current.length > 200) respWaveformBuffer.current.shift();

          } catch (err) {
            console.error('[RPPG WS ERROR]', err);
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimer = setTimeout(connect, 2000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        reconnectTimer = setTimeout(connect, 2000);
      }
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  // Real-Time Canvas Oscilloscope Rendering Loop (60 FPS)
  useEffect(() => {
    let animId: number;

    const render = () => {
      // 1. Draw rPPG Pulse Oscilloscope
      const pCanvas = pulseCanvasRef.current;
      if (pCanvas) {
        const ctx = pCanvas.getContext('2d');
        if (ctx) {
          const w = pCanvas.width;
          const h = pCanvas.height;
          ctx.clearRect(0, 0, w, h);

          // Grid lines
          ctx.strokeStyle = isDarkMode ? 'rgba(30, 41, 59, 0.6)' : 'rgba(226, 232, 240, 0.8)';
          ctx.lineWidth = 1;
          for (let y = 0; y < h; y += 25) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }

          const pts = pulseWaveformBuffer.current;
          if (pts.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = '#ef4444'; // Red cardiac pulse wave
            ctx.lineWidth = 2.2;
            const step = w / (pts.length - 1);
            for (let i = 0; i < pts.length; i++) {
              const x = i * step;
              // Map -0.5..0.5 to canvas height
              const y = h / 2 - pts[i] * (h * 0.8);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }
      }

      // 2. Draw Respiratory Oscilloscope
      const rCanvas = respCanvasRef.current;
      if (rCanvas) {
        const ctx = rCanvas.getContext('2d');
        if (ctx) {
          const w = rCanvas.width;
          const h = rCanvas.height;
          ctx.clearRect(0, 0, w, h);

          // Grid lines
          ctx.strokeStyle = isDarkMode ? 'rgba(30, 41, 59, 0.6)' : 'rgba(226, 232, 240, 0.8)';
          ctx.lineWidth = 1;
          for (let y = 0; y < h; y += 25) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }

          const pts = respWaveformBuffer.current;
          if (pts.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = '#06b6d4'; // Cyan respiratory wave
            ctx.lineWidth = 2.5;
            const step = w / (pts.length - 1);
            for (let i = 0; i < pts.length; i++) {
              const x = i * step;
              // Map -1.0..1.0 to canvas height
              const y = h / 2 - pts[i] * (h * 0.42);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isDarkMode]);

  // Acknowledge alert handler
  const handleAcknowledgeAlert = async (id: string) => {
    try {
      await fetch('http://localhost:8001/api/alerts/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: id })
      });
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  // Switch camera input (e.g. index 0/1 or iPhone IP stream)
  const handleSaveCameraSource = async () => {
    setIsUpdatingSource(true);
    try {
      await fetch('http://localhost:8001/api/camera/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: cameraSourceInput })
      });
    } catch (err) {
      console.error('Failed to switch camera source:', err);
    } finally {
      setIsUpdatingSource(false);
    }
  };

  // Save updated thresholds
  const handleSaveThresholds = async () => {
    try {
      await fetch('http://localhost:8001/api/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(thresholds)
      });
      setIsSettingsOpen(false);
    } catch (err) {
      console.error('Failed to update thresholds:', err);
    }
  };

  // Export session data
  const handleExportCSV = () => {
    window.open('http://localhost:8001/api/export/csv', '_blank');
  };

  const hrValue = telemetry?.is_valid && telemetry.hr !== null ? `${Math.round(telemetry.hr)}` : '--';
  const hrRolling = telemetry?.is_valid && telemetry.hr_rolling !== null ? `${Math.round(telemetry.hr_rolling)}` : '--';
  const rrValue = telemetry?.is_valid && telemetry.rr !== null ? `${Math.round(telemetry.rr)}` : '--';
  const rrRolling = telemetry?.is_valid && telemetry.rr_rolling !== null ? `${Math.round(telemetry.rr_rolling)}` : '--';

  const sqiVal = telemetry ? Math.round(telemetry.sqi) : 0;
  const sqiStatus = telemetry?.sqi_status || 'INVALID';

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto p-3 sm:p-4">
      {/* Top Banner & Header */}
      <div className={`p-4 rounded-2xl border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm ${
        isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
              OPTICAL PLETHYSMOGRAPHY &amp; THORACIC VISION
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              wsConnected ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
            }`}>
              {wsConnected ? 'LIVE PYTHON RPPG ENGINE' : 'CONNECTING TO ENGINE (PORT 8001)'}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight mt-1 text-slate-900 dark:text-white">
            CORDAD — Contactless Respiratory Distress &amp; Apnea Monitoring
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time remote photoplethysmography (rPPG) and thoracic micro-displacement analysis via iPhone 17 rear camera.
          </p>
        </div>

        {/* Global Controls & Screening Notice */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            <Sliders className="h-3.5 w-3.5 text-sky-400" />
            <span>Thresholds</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Clinical Screening Disclaimer Banner */}
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
        <HelpCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
        <div>
          <strong className="font-semibold">Clinical Screening Protocol:</strong> Prototype monitoring system. Alerts are intended for screening and clinical review and are not a substitute for professional medical assessment. Physiological values are calculated strictly when anatomical ROIs are locked with sufficient optical quality.
        </div>
      </div>

      {/* Main Vital Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Vital 1: Heart Rate (rPPG) */}
        <div className={`p-4 rounded-2xl border shadow-sm transition-all ${
          telemetry?.hr_status === 'CRITICAL'
            ? 'bg-rose-950/40 border-rose-500/60 text-rose-200 shadow-rose-950/30'
            : telemetry?.hr_status === 'WARNING'
            ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
            : isDarkMode ? 'bg-[#0B1120] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                <Heart className={`h-5 w-5 ${telemetry?.is_valid ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">HEART RATE</span>
                <span className="text-[10px] block font-mono text-slate-400">rPPG Chrominance</span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
              telemetry?.hr_status === 'CRITICAL' ? 'bg-rose-500/20 border-rose-500/50 text-rose-300' :
              telemetry?.hr_status === 'WARNING' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' :
              telemetry?.is_valid ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' :
              'bg-slate-700/30 border-slate-700 text-slate-400'
            }`}>
              {telemetry?.is_valid ? telemetry.hr_status : 'UNAVAILABLE'}
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black font-mono tracking-tight">{hrValue}</span>
              <span className="text-sm font-bold text-slate-400">BPM</span>
            </div>
            <div className="text-right font-mono text-xs text-slate-400">
              <span>Avg: </span>
              <strong className="text-slate-200">{hrRolling}</strong>
            </div>
          </div>
        </div>

        {/* Vital 2: Respiratory Rate (Thoracic Vision) */}
        <div className={`p-4 rounded-2xl border shadow-sm transition-all ${
          telemetry?.rr_status === 'CRITICAL'
            ? 'bg-rose-950/40 border-rose-500/60 text-rose-200'
            : telemetry?.rr_status === 'WARNING'
            ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
            : isDarkMode ? 'bg-[#0B1120] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                <Wind className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">RESPIRATORY RATE</span>
                <span className="text-[10px] block font-mono text-slate-400">Thoracic Micro-Motion</span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
              telemetry?.rr_status === 'CRITICAL' ? 'bg-rose-500/20 border-rose-500/50 text-rose-300' :
              telemetry?.rr_status === 'WARNING' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' :
              telemetry?.is_valid ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' :
              'bg-slate-700/30 border-slate-700 text-slate-400'
            }`}>
              {telemetry?.is_valid ? telemetry.rr_status : 'UNAVAILABLE'}
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black font-mono tracking-tight">{rrValue}</span>
              <span className="text-sm font-bold text-slate-400">breaths/min</span>
            </div>
            <div className="text-right font-mono text-xs text-slate-400">
              <span>Avg: </span>
              <strong className="text-slate-200">{rrRolling}</strong>
            </div>
          </div>
        </div>

        {/* Vital 3: Apnea Detector & Stopwatch */}
        <div className={`p-4 rounded-2xl border shadow-sm transition-all ${
          telemetry?.apnea_state === 'PROLONGED_APNEA'
            ? 'bg-rose-950/60 border-rose-500 text-rose-100 animate-pulse'
            : telemetry?.apnea_state === 'APNEA_WARNING'
            ? 'bg-amber-950/50 border-amber-500 text-amber-100'
            : isDarkMode ? 'bg-[#0B1120] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl ${
                telemetry?.apnea_state !== 'NO_APNEA' ? 'bg-rose-500/30 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">APNEA STATUS</span>
                <span className="text-[10px] block font-mono text-slate-400">Cessation Timer</span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
              telemetry?.apnea_state === 'PROLONGED_APNEA' ? 'bg-rose-600 text-white border-rose-400' :
              telemetry?.apnea_state === 'APNEA_WARNING' ? 'bg-amber-500/30 text-amber-300 border-amber-500/50' :
              'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}>
              {telemetry?.apnea_state || 'NO APNEA'}
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-4xl font-black">
                  {telemetry?.apnea_duration ? telemetry.apnea_duration.toFixed(1) : '0.0'}
                </span>
                <span className="text-sm font-bold text-slate-400">s</span>
              </div>
              {telemetry?.apnea_pattern && (
                <span className="text-[10px] text-amber-400 font-mono font-bold block mt-0.5">
                  {telemetry.apnea_pattern}
                </span>
              )}
            </div>
            <div className="text-right text-[11px] max-w-[130px] truncate text-slate-400">
              {telemetry?.apnea_msg || 'Normal breathing'}
            </div>
          </div>
        </div>

        {/* Vital 4: Signal Quality Index (SQI) */}
        <div className={`p-4 rounded-2xl border shadow-sm transition-all ${
          isDarkMode ? 'bg-[#0B1120] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl ${
                sqiStatus === 'GOOD' ? 'bg-emerald-500/20 text-emerald-400' :
                sqiStatus === 'ACCEPTABLE' ? 'bg-sky-500/20 text-sky-400' :
                'bg-rose-500/20 text-rose-400'
              }`}>
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">SIGNAL QUALITY</span>
                <span className="text-[10px] block font-mono text-slate-400">Composite PNR / SNR</span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
              sqiStatus === 'GOOD' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' :
              sqiStatus === 'ACCEPTABLE' ? 'bg-sky-500/20 border-sky-500/40 text-sky-300' :
              'bg-rose-500/20 border-rose-500/40 text-rose-300'
            }`}>
              {sqiStatus}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-4xl font-black">{sqiVal}</span>
              <span className="text-sm font-bold text-slate-400">%</span>
            </div>

            {/* Quality status mini-bar */}
            <div className="w-24 bg-slate-700/40 rounded-full h-2.5 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  sqiVal >= 80 ? 'bg-emerald-500' : sqiVal >= 60 ? 'bg-sky-500' : sqiVal >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${sqiVal}%` }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Combined Respiratory Distress Risk Status Banner */}
      {telemetry?.distress_status && telemetry.distress_status !== 'NORMAL' && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between animate-in fade-in ${
          telemetry.distress_status === 'CRITICAL_DISTRESS_RISK'
            ? 'bg-rose-950/80 border-rose-500 text-rose-200'
            : 'bg-amber-950/70 border-amber-500 text-amber-200'
        }`}>
          <div className="flex items-center gap-3">
            <AlertOctagon className="h-6 w-6 shrink-0 text-rose-400 animate-bounce" />
            <div>
              <span className="font-bold text-sm tracking-wide block">
                {telemetry.distress_status === 'CRITICAL_DISTRESS_RISK' 
                  ? 'CRITICAL RESPIRATORY DISTRESS RISK DETECTED' 
                  : telemetry.distress_status === 'DISTRESS_RISK'
                  ? 'RESPIRATORY DISTRESS RISK DETECTED'
                  : 'RESPIRATORY DEPRESSION RISK DETECTED'}
              </span>
              <span className="text-xs opacity-90">
                Persistent combination of elevated respiratory rate and heart rate over threshold window.
              </span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-lg bg-black/40 font-mono text-xs font-bold uppercase border border-current">
            {telemetry.distress_status}
          </span>
        </div>
      )}

      {/* Main Grid: Left Video & Waveforms | Right Trend Graphs & Alert Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column (5 Cols): Live Video Viewport + Oscilloscope */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Live Camera Viewport */}
          <div className={`p-4 rounded-2xl border shadow-sm ${
            isDarkMode ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-sky-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Optical Viewport (iPhone 17 Rear Camera)
                </h3>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                telemetry?.face_detected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {telemetry?.face_detected ? 'ROI LOCKED' : 'SEARCHING'}
              </span>
            </div>

            {/* Video Canvas / Stream */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              <img
                src="http://localhost:8001/video_feed"
                alt="Live rPPG Viewport"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              {!telemetry?.camera_connected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950/90 text-slate-400 space-y-2">
                  <Video className="h-8 w-8 text-slate-600 animate-pulse" />
                  <p className="text-xs font-semibold">Camera Stream Offline</p>
                  <p className="text-[11px] text-slate-500 max-w-xs">
                    Connect iPhone 17 via USB (Continuity Camera/Camo/DroidCam) or enter Wi-Fi stream URL below.
                  </p>
                </div>
              )}
            </div>

            {/* Camera Source Switching Control */}
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={cameraSourceInput}
                onChange={(e) => setCameraSourceInput(e.target.value)}
                placeholder="Camera Index (0) or IP Stream URL"
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
              />
              <button
                onClick={handleSaveCameraSource}
                disabled={isUpdatingSource}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition"
              >
                {isUpdatingSource ? 'Switching...' : 'Switch Source'}
              </button>
            </div>
          </div>

          {/* Real-Time Oscilloscopes (Waveforms) */}
          <div className={`p-4 rounded-2xl border shadow-sm space-y-4 ${
            isDarkMode ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-200'
          }`}>
            {/* rPPG Cardiac Pulse Waveform */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="flex items-center gap-1.5 text-rose-400">
                  <Heart className="h-3.5 w-3.5" /> rPPG Cardiac Pulse Waveform
                </span>
                <span className="font-mono text-[10px] text-slate-400">0.75 - 2.50 Hz</span>
              </div>
              <div className="h-24 w-full rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                <canvas ref={pulseCanvasRef} width={500} height={100} className="w-full h-full" />
              </div>
            </div>

            {/* Respiratory Oscillation Waveform */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <Wind className="h-3.5 w-3.5" /> Respiratory Oscillation (Thoracic Displacement)
                </span>
                <span className="font-mono text-[10px] text-slate-400">0.10 - 0.70 Hz</span>
              </div>
              <div className="h-24 w-full rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                <canvas ref={respCanvasRef} width={500} height={100} className="w-full h-full" />
              </div>
            </div>
          </div>

        </div>

        {/* Right Column (7 Cols): Trend Graphs & Live Alert Panel */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Trend Graph 1: Heart Rate vs Time with Threshold Reference Lines */}
          <div className={`p-4 rounded-2xl border shadow-sm ${
            isDarkMode ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold tracking-wide uppercase flex items-center gap-1.5 text-rose-400">
                <Heart className="h-4 w-4" /> Heart Rate Trend (BPM vs Time)
              </span>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-emerald-400">Normal: 60–100</span>
                <span className="text-amber-400">Warn: &lt;50 / &gt;100</span>
                <span className="text-rose-400">Crit: &lt;40 / &gt;120</span>
              </div>
            </div>

            {/* SVG Trend Graph */}
            <div className="h-36 w-full rounded-xl bg-slate-950 border border-slate-800 p-2 relative overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 600 120" preserveAspectRatio="none">
                {/* Reference Zone Lines */}
                {/* Critical High (120 BPM) -> y = 10 */}
                <line x1="0" y1="10" x2="600" y2="10" stroke="#f43f5e" strokeDasharray="3 3" strokeWidth="1" />
                {/* Warning High (100 BPM) -> y = 28 */}
                <line x1="0" y1="28" x2="600" y2="28" stroke="#f59e0b" strokeDasharray="3 3" strokeWidth="1" />
                {/* Warning Low (50 BPM) -> y = 75 */}
                <line x1="0" y1="75" x2="600" y2="75" stroke="#f59e0b" strokeDasharray="3 3" strokeWidth="1" />
                {/* Critical Low (40 BPM) -> y = 92 */}
                <line x1="0" y1="92" x2="600" y2="92" stroke="#f43f5e" strokeDasharray="3 3" strokeWidth="1" />

                {/* Plot Polyline */}
                {hrHistory.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2.5"
                    points={hrHistory.map((pt, idx) => {
                      const x = (idx / (hrHistory.length - 1)) * 600;
                      // Range 30 to 140 BPM
                      const y = 120 - ((pt.hr - 30) / (140 - 30)) * 120;
                      return `${x},${Math.max(5, Math.min(115, y))}`;
                    }).join(' ')}
                  />
                )}
              </svg>
            </div>
          </div>

          {/* Trend Graph 2: Respiratory Rate vs Time with Threshold Reference Lines */}
          <div className={`p-4 rounded-2xl border shadow-sm ${
            isDarkMode ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold tracking-wide uppercase flex items-center gap-1.5 text-cyan-400">
                <Wind className="h-4 w-4" /> Respiratory Rate Trend (breaths/min vs Time)
              </span>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-emerald-400">Normal: 12–20</span>
                <span className="text-amber-400">Warn: &lt;10 / &gt;20</span>
                <span className="text-rose-400">Crit: &lt;8 / &gt;30</span>
              </div>
            </div>

            <div className="h-36 w-full rounded-xl bg-slate-950 border border-slate-800 p-2 relative overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 600 120" preserveAspectRatio="none">
                {/* Reference Lines */}
                {/* Crit High (30) -> y = 15 */}
                <line x1="0" y1="15" x2="600" y2="15" stroke="#f43f5e" strokeDasharray="3 3" strokeWidth="1" />
                {/* Warn High (20) -> y = 45 */}
                <line x1="0" y1="45" x2="600" y2="45" stroke="#f59e0b" strokeDasharray="3 3" strokeWidth="1" />
                {/* Warn Low (10) -> y = 75 */}
                <line x1="0" y1="75" x2="600" y2="75" stroke="#f59e0b" strokeDasharray="3 3" strokeWidth="1" />
                {/* Crit Low (8) -> y = 90 */}
                <line x1="0" y1="90" x2="600" y2="90" stroke="#f43f5e" strokeDasharray="3 3" strokeWidth="1" />

                {/* Plot Polyline */}
                {rrHistory.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                    points={rrHistory.map((pt, idx) => {
                      const x = (idx / (rrHistory.length - 1)) * 600;
                      // Range 4 to 36 breaths/min
                      const y = 120 - ((pt.rr - 4) / (36 - 4)) * 120;
                      return `${x},${Math.max(5, Math.min(115, y))}`;
                    }).join(' ')}
                  />
                )}
              </svg>
            </div>
          </div>

          {/* Real-Time ALERTS Panel */}
          <div className={`p-4 rounded-2xl border shadow-sm ${
            isDarkMode ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Clinical Alert Priority Stream
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Active: <strong>{telemetry?.active_alerts.length || 0}</strong>
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {telemetry?.active_alerts && telemetry.active_alerts.length > 0 ? (
                telemetry.active_alerts.map((alt) => (
                  <div
                    key={alt.id}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
                      alt.severity === 'CRITICAL'
                        ? 'bg-rose-950/60 border-rose-600/70 text-rose-200'
                        : alt.severity === 'WARNING'
                        ? 'bg-amber-950/50 border-amber-500/60 text-amber-200'
                        : alt.severity === 'SIGNAL_UNAVAILABLE'
                        ? 'bg-slate-800/60 border-slate-700 text-slate-400'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] opacity-75">{alt.timestamp}</span>
                        <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded uppercase ${
                          alt.severity === 'CRITICAL' ? 'bg-rose-500 text-white' :
                          alt.severity === 'WARNING' ? 'bg-amber-500 text-black' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {alt.severity}
                        </span>
                        <strong className="font-semibold text-white">{alt.parameter}</strong>
                      </div>
                      <p className="text-xs">{alt.message}</p>
                      <span className="text-[10px] opacity-80 font-mono">
                        Value: <strong>{alt.value}</strong> | Threshold: {alt.threshold_exceeded} | Duration: {alt.duration_seconds}s
                      </span>
                    </div>

                    <button
                      onClick={() => handleAcknowledgeAlert(alt.id)}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold transition shrink-0 ml-2"
                    >
                      {alt.acknowledged ? 'Acked' : 'Acknowledge'}
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-1">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500/60 mb-1" />
                  <span>No active clinical alerts. Vital parameters stable.</span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Threshold Configuration Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="h-4 w-4 text-sky-400" />
                Configure Prototype Adult Thresholds
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-96 overflow-y-auto pr-1">
              <div className="font-bold text-sky-400 uppercase tracking-wider">Heart Rate Limits (BPM)</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400">Critical Low (&lt; BPM)</label>
                  <input
                    type="number"
                    value={thresholds.hr_critical_low}
                    onChange={(e) => setThresholds({ ...thresholds, hr_critical_low: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 font-mono mt-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400">Critical High (&gt; BPM)</label>
                  <input
                    type="number"
                    value={thresholds.hr_critical_high}
                    onChange={(e) => setThresholds({ ...thresholds, hr_critical_high: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 font-mono mt-1"
                  />
                </div>
              </div>

              <div className="font-bold text-cyan-400 uppercase tracking-wider pt-2">Respiratory Rate Limits (breaths/min)</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400">Critical Low (&lt; breaths/min)</label>
                  <input
                    type="number"
                    value={thresholds.rr_critical_low}
                    onChange={(e) => setThresholds({ ...thresholds, rr_critical_low: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 font-mono mt-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400">Critical High (&gt; breaths/min)</label>
                  <input
                    type="number"
                    value={thresholds.rr_critical_high}
                    onChange={(e) => setThresholds({ ...thresholds, rr_critical_high: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 font-mono mt-1"
                  />
                </div>
              </div>

              <div className="font-bold text-amber-400 uppercase tracking-wider pt-2">Apnea Duration Thresholds (Seconds)</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400">Apnea Warning (&gt;= s)</label>
                  <input
                    type="number"
                    value={thresholds.apnea_warning_sec}
                    onChange={(e) => setThresholds({ ...thresholds, apnea_warning_sec: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 font-mono mt-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400">Prolonged Apnea Critical (&gt;= s)</label>
                  <input
                    type="number"
                    value={thresholds.apnea_critical_sec}
                    onChange={(e) => setThresholds({ ...thresholds, apnea_critical_sec: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 font-mono mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveThresholds}
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
              >
                Save Thresholds
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
