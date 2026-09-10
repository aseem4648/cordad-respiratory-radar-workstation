import React, { useState } from 'react';
import { Radio, AlertTriangle, ShieldCheck, Settings as SettingsIcon, Volume2, VolumeX, Pause, Play, Moon, Sun, Menu, RotateCcw, User, LogOut, X, Activity, CheckCircle2, Camera, Trash2, ShieldAlert } from 'lucide-react';
import { RadarTelemetry, SystemSettings, UserSession, StandardRadarPacket, CameraConfig } from '../types';
import { formatTimestamp } from '../utils/formatting';

interface HeaderProps {
  telemetry: RadarTelemetry | null;
  lastPacket?: StandardRadarPacket | null;
  wsStatus: string;
  isDemo: boolean;
  isStreamPaused: boolean;
  settings?: SystemSettings;
  soundEnabled: boolean;
  isDarkMode: boolean;
  session?: UserSession | null;
  activeRouteLabel?: string;
  camera?: CameraConfig | null;
  patientDetected?: boolean;
  onTogglePatientDetected?: () => void;
  onToggleSidebar?: () => void;
  onReplayIntro?: () => void;
  onOpenAuth?: () => void;
  onOpenClearanceModal?: () => void;
  onLogout?: () => void;
  onToggleDarkMode: () => void;
  onToggleSound: () => void;
  onTogglePause: () => void;
  onOpenSettings: () => void;
  onSwitchMode: (mode: 'LIVE_RADAR' | 'DEMO_MODE') => void;
  onNavigateRoute?: (route: any) => void;
}

export const Header: React.FC<HeaderProps> = ({
  telemetry,
  lastPacket,
  wsStatus,
  isDemo,
  isStreamPaused,
  soundEnabled,
  isDarkMode,
  session,
  activeRouteLabel,
  camera,
  patientDetected = false,
  onTogglePatientDetected,
  onToggleSidebar,
  onReplayIntro,
  onOpenAuth,
  onOpenClearanceModal,
  onLogout,
  onToggleDarkMode,
  onToggleSound,
  onTogglePause,
  onOpenSettings,
  onSwitchMode,
  onNavigateRoute
}) => {
  const [showRadarDiagnostics, setShowRadarDiagnostics] = useState<boolean>(false);
  const isConnected = wsStatus === 'CONNECTED' && (isDemo || telemetry?.connectionStatus === 'CONNECTED');

  // Real ESP32 Camera Connection & Sensing
  const isCameraConnected = Boolean(camera && (camera.status === 'CONNECTED' || camera.status === 'STREAMING' || (camera.enabled && camera.measuredFps > 0) || camera.isStreaming));
  const isCameraPatientDetected = isCameraConnected && Boolean(patientDetected || camera?.patientDetected);
  const cameraConfidence = camera?.detectionConfidence;

  // Real 24 GHz Radar Connection & Sensing
  const isRadarConnected = wsStatus === 'CONNECTED' && (telemetry?.connectionStatus === 'CONNECTED' || isDemo);
  const isRadarPatientDetected = isRadarConnected && Boolean(
    lastPacket?.presence === true || 
    (lastPacket?.respiratoryRate !== null && lastPacket?.respiratoryRate !== undefined && lastPacket.respiratoryRate > 0)
  );

  return (
    <header className={`${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200/90 shadow-sm'} border-b px-3 py-2 sm:px-5 select-none sticky top-0 z-40 transition-colors min-h-[60px] flex items-center`}>
      <div className="w-full max-w-[1700px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        
        {/* Left: Sidebar Toggle + Branding */}
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className={`p-2 rounded-xl border transition-all active:scale-95 shadow-sm flex items-center justify-center cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-800/90 border-slate-700/80 text-slate-200 hover:bg-slate-700 hover:border-sky-500/50 hover:text-sky-300'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700'
              }`}
              title="Toggle / Expand / Collapse Sidebar Navigation (Click to toggle)"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          {/* Interactive Radar RF Transceiver Pulse / Animated Logo Button */}
          <button
            onClick={() => setShowRadarDiagnostics(true)}
            className={`h-9 w-9 rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-all cursor-pointer active:scale-95 group relative overflow-hidden ${
              isConnected
                ? isDarkMode
                  ? 'bg-cyan-950/80 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-900/60 hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                  : 'bg-cyan-50 border border-cyan-300 text-cyan-700 hover:bg-cyan-100 hover:border-cyan-400 hover:shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                : isDarkMode
                  ? 'bg-rose-950/40 border border-rose-500/40 text-rose-400 hover:bg-rose-900/50'
                  : 'bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100'
            }`}
            title="24 GHz FMCW Radar Link & Sensor Diagnostics (Click to inspect)"
          >
            <video
              src="/radar-logo.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <Radio className={`h-4 w-4 relative z-10 drop-shadow ${isConnected ? 'animate-pulse' : ''}`} />
            {/* Pulsing indicator pill */}
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 z-20">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-cyan-400' : 'bg-rose-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-cyan-500' : 'bg-rose-500'}`}></span>
            </span>
          </button>
          <div className="truncate">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className={`text-sm sm:text-base font-bold tracking-tight ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}>
                CONTACTLESS RESPIRATORY DISTRESS & APNEA DETECTION
              </h1>
              <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded border ${
                isDarkMode ? 'bg-cyan-950 text-cyan-400 border-cyan-800/50' : 'bg-cyan-100 text-cyan-800 border-cyan-300'
              }`}>
                24 GHz FMCW
              </span>
              {activeRouteLabel && (
                <span className="hidden xl:inline-block text-[11px] font-mono font-semibold text-slate-400 border-l pl-2 border-slate-300 dark:border-slate-700">
                  {activeRouteLabel}
                </span>
              )}
            </div>
            <p className={`text-[11px] font-medium truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Non-Contact Physiological Radar Monitoring Workstation • ICU &amp; Bedside
            </p>
          </div>
        </div>

        {/* Right: Telemetry & Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap justify-end">
          
          {/* ESP32 Optical Camera Patient Detection Indicator (Automated CV Telemetry) */}
          <div 
            title={
              !isCameraConnected 
                ? "ESP32 Camera offline (connect camera to stream patient visuals)"
                : isCameraPatientDetected 
                ? `ESP32-CAM: Visual patient presence confirmed via CV optical sensing${cameraConfidence ? ` (${cameraConfidence}% confidence)` : ''}` 
                : "ESP32-CAM: Online, no patient detected in frame"
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono select-none transition-all ${
              isCameraPatientDetected
                ? (isDarkMode 
                    ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                    : 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-[0_0_8px_rgba(16,185,129,0.2)]')
                : isCameraConnected
                ? (isDarkMode 
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-300' 
                    : 'bg-amber-50 border-amber-300 text-amber-800')
                : (isDarkMode 
                    ? 'bg-slate-900/60 border-slate-800 text-slate-500' 
                    : 'bg-slate-100 border-slate-200 text-slate-400')
            }`}
          >
            <div className="relative flex items-center justify-center">
              <span className={`h-2 w-2 rounded-full ${
                isCameraPatientDetected 
                  ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' 
                  : isCameraConnected 
                  ? 'bg-amber-400' 
                  : 'bg-slate-600'
              }`} />
              {isCameraPatientDetected && (
                <span className="absolute h-3.5 w-3.5 rounded-full bg-emerald-400 opacity-75 animate-ping" />
              )}
            </div>
            <Camera className={`h-3.5 w-3.5 ${isCameraPatientDetected ? 'text-emerald-400' : isCameraConnected ? 'text-amber-400' : 'text-slate-500'}`} />
            <span className="font-bold uppercase tracking-wider">
              {isCameraPatientDetected 
                ? `CAM: PATIENT DETECTED${cameraConfidence ? ` (${cameraConfidence}%)` : ''}` 
                : isCameraConnected 
                ? 'CAM: NO PATIENT' 
                : 'CAM: OFFLINE'}
            </span>
          </div>

          {/* 24 GHz Radar Sensing & Patient Detection Indicator */}
          <div 
            onClick={() => setShowRadarDiagnostics(true)}
            title={
              !isRadarConnected 
                ? "24 GHz Radar offline (connect MR24BSD1 sensor)"
                : isRadarPatientDetected 
                ? `24 GHz Radar: Patient physiological signal detected${lastPacket?.targetDistance ? ` (${lastPacket.targetDistance.toFixed(2)}m)` : ''}` 
                : "24 GHz Radar: Online, waiting for patient presence"
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono cursor-pointer select-none transition-all hover:scale-[1.02] active:scale-95 ${
              isRadarPatientDetected
                ? (isDarkMode 
                    ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                    : 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-[0_0_8px_rgba(16,185,129,0.2)]')
                : isRadarConnected
                ? (isDarkMode 
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-300' 
                    : 'bg-amber-50 border-amber-300 text-amber-800')
                : (isDarkMode 
                    ? 'bg-slate-900/60 border-slate-800 text-slate-500' 
                    : 'bg-slate-100 border-slate-200 text-slate-400')
            }`}
          >
            <div className="relative flex items-center justify-center">
              <span className={`h-2 w-2 rounded-full ${
                isRadarPatientDetected 
                  ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' 
                  : isRadarConnected 
                  ? 'bg-amber-400' 
                  : 'bg-slate-600'
              }`} />
              {isRadarPatientDetected && (
                <span className="absolute h-3.5 w-3.5 rounded-full bg-emerald-400 opacity-75 animate-ping" />
              )}
            </div>
            <Radio className={`h-3.5 w-3.5 ${isRadarPatientDetected ? 'text-emerald-400' : isRadarConnected ? 'text-amber-400' : 'text-slate-500'}`} />
            <span className="font-bold uppercase tracking-wider">
              {isRadarPatientDetected 
                ? `RADAR: PATIENT DETECTED${lastPacket?.targetDistance ? ` (${lastPacket.targetDistance.toFixed(1)}m)` : ''}`
                : isRadarConnected 
                ? 'RADAR: NO PATIENT' 
                : 'RADAR: OFFLINE'}
            </span>
          </div>

          {/* Last Packet */}
          <div className={`hidden lg:flex flex-col px-3 py-1.5 rounded-lg border text-xs ${
            isDarkMode ? 'bg-slate-900/90 border-slate-700/80' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">LAST PACKET</span>
            <span className={`font-mono font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
              {formatTimestamp(telemetry?.lastPacketTimestamp || null)}
            </span>
          </div>

          {/* Pause / Resume */}
          <button
            onClick={onTogglePause}
            title={isStreamPaused ? "Resume Stream" : "Pause Stream"}
            className={`p-2 rounded-lg border transition ${
              isStreamPaused 
                ? 'bg-amber-100 border-amber-300 text-amber-800' 
                : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')
            }`}
          >
            {isStreamPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>

          {/* Audio Alarm */}
          <button
            onClick={onToggleSound}
            title={soundEnabled ? "Mute Alarms" : "Enable Sound Alarms"}
            className={`p-2 rounded-lg border transition ${
              soundEnabled 
                ? 'bg-cyan-100 border-cyan-300 text-cyan-800' 
                : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200')
            }`}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-cyan-600" /> : <VolumeX className="h-4 w-4" />}
          </button>

          {/* Theme Toggle (White / Dark) */}
          <button
            onClick={onToggleDarkMode}
            title={isDarkMode ? "Switch to Professional White Theme" : "Switch to Dark Clinical Mode"}
            className={`p-2 rounded-lg border transition ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            title="Configure System Settings"
            className={`p-2 rounded-lg border transition ${
              isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <SettingsIcon className="h-4 w-4" />
          </button>

          {/* Replay Intro */}
          {onReplayIntro && (
            <button
              onClick={onReplayIntro}
              title="Replay Clinical Intro Animation"
              className={`p-2 rounded-lg border transition ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}

          {/* User Auth Badge */}
          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              title={session?.isAuthenticated ? `Logged in as ${session.name} (${session.role})` : 'Sign in to workstation'}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                session?.isAuthenticated
                  ? session.role === 'ADMIN'
                    ? isDarkMode ? 'bg-amber-950/50 border-amber-600/60 text-amber-300 hover:bg-amber-900/50' : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                    : isDarkMode ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60' : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  : isDarkMode ? 'bg-rose-950/60 border-rose-700/60 text-rose-300 hover:bg-rose-900/60' : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
              }`}
            >
              <User className="h-3.5 w-3.5 shrink-0" />
              {session?.isAuthenticated ? (
                <div className="flex items-center gap-1.5 text-left">
                  <span className="hidden xl:inline max-w-[110px] truncate text-[11px] font-medium">
                    {session.name}
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase ${
                    session.role === 'ADMIN'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {session.role}
                  </span>
                </div>
              ) : (
                <span className="font-mono text-[11px]">SIGN IN</span>
              )}
            </button>
          )}

          {/* Instant User Clearance Button for Administrator */}
          {session?.isAuthenticated && (session.role === 'ADMIN' || session.email === 'aseem323711@sahrdaya.ac.in') && onOpenClearanceModal && (
            <button
              onClick={onOpenClearanceModal}
              title="Instant User Clearance: Purge hanging tokens, stale user records, and sessions"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition active:scale-95 cursor-pointer ${
                isDarkMode
                  ? 'bg-rose-950/60 border-rose-600/70 text-rose-300 hover:bg-rose-900/70 hover:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                  : 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100 hover:border-rose-400'
              }`}
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              <span className="hidden sm:inline font-mono text-[11px] font-bold">PURGE SESSIONS</span>
            </button>
          )}

          {/* Dedicated Logout Button in Header */}
          {onLogout && session?.isAuthenticated && (
            <button
              onClick={onLogout}
              title="Log Out & Lock Workstation"
              className={`p-2 rounded-lg border transition text-rose-500 hover:text-rose-600 ${
                isDarkMode
                  ? 'bg-rose-950/40 border-rose-800/60 hover:bg-rose-900/60'
                  : 'bg-rose-50 border-rose-200 hover:bg-rose-100'
              }`}
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          24 GHz FMCW Radar Transceiver Diagnostics & Link Inspector Modal
          ========================================================================= */}
      {showRadarDiagnostics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl p-5 space-y-4 transition-all ${
            isDarkMode ? 'bg-[#0C1222] border-sky-500/30 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-md">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold tracking-tight">
                    24 GHz FMCW Radar Transceiver Diagnostics
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Seeed Studio MR24BSD1 Respiratory Sensor Inspector
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowRadarDiagnostics(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Hardware Link Status</div>
                <div className={`font-mono font-bold mt-0.5 flex items-center gap-1.5 ${isConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span>{isConnected ? 'SERIAL HARDWARE DETECTED' : 'DISCONNECTED / STANDBY'}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Operating Frequency</div>
                <div className="font-mono font-bold text-sky-400 mt-0.5">
                  24.000 - 24.250 GHz (ISM Band)
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Modulation / Chirp</div>
                <div className="font-mono font-bold text-slate-200 mt-0.5">
                  FMCW (250 MHz Sweep / 50ms)
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Antenna Beam Angle</div>
                <div className="font-mono font-bold text-slate-200 mt-0.5">
                  Azimuth: 100° • Elevation: 40°
                </div>
              </div>
            </div>

            {/* Live Telemetry Info */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">WebSocket Endpoint:</span>
                <span className="font-mono text-cyan-400">ws://localhost:5000/ws/radar ({wsStatus})</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Target Range / Distance:</span>
                <span className="font-mono text-slate-200">
                  {lastPacket?.targetDistance != null ? `${lastPacket.targetDistance.toFixed(2)} m` : 'Awaiting subject in beam'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Signal Quality Index (SQI):</span>
                <span className="font-mono text-emerald-400">{lastPacket?.signalQuality != null ? `${lastPacket.signalQuality}%` : 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Data Integrity Rule:</span>
                <span className="font-mono text-amber-400 font-semibold">Strict Real Sensor DSP (No Fake Waveforms)</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              {onNavigateRoute && (
                <button
                  onClick={() => {
                    setShowRadarDiagnostics(false);
                    onNavigateRoute('RESPIRATORY_SIGNAL');
                  }}
                  className="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Open DSP Signal Scope</span>
                </button>
              )}

              {onNavigateRoute && (
                <button
                  onClick={() => {
                    setShowRadarDiagnostics(false);
                    onNavigateRoute('SYSTEM_STATUS');
                  }}
                  className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition"
                >
                  <span>Diagnostics</span>
                </button>
              )}

              <button
                onClick={() => setShowRadarDiagnostics(false)}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
