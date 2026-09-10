import React, { useState, useEffect } from 'react';
import { PanTiltState } from '../types';
import { apiService } from '../services/apiService';

interface PanTiltControlProps {
  panTilt: PanTiltState | null;
  onUpdate: (next: PanTiltState) => void;
  isDarkMode: boolean;
}

export const PanTiltControl: React.FC<PanTiltControlProps> = ({ panTilt, onUpdate, isDarkMode }) => {
  const [selectedStep, setSelectedStep] = useState<number>(panTilt?.stepSize || 5);
  const [isKeyboardActive, setIsKeyboardActive] = useState<boolean>(true);
  const [lastActionTime, setLastActionTime] = useState<number>(Date.now());
  const [pendingDirection, setPendingDirection] = useState<string | null>(null);

  const stepOptions = [1, 2, 5, 10, 15];

  const handleMove = async (dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    setPendingDirection(dir);
    try {
      const res = await apiService.movePanTilt(dir, selectedStep);
      if (res.panTilt) onUpdate(res.panTilt);
    } catch (err) {
      console.error('Pan-tilt move error', err);
    } finally {
      setTimeout(() => setPendingDirection(null), 250);
    }
  };

  const handleHome = async () => {
    try {
      const res = await apiService.homePanTilt();
      if (res.panTilt) onUpdate(res.panTilt);
    } catch (err) {
      console.error('Home command error', err);
    }
  };

  const handleStop = async () => {
    try {
      const res = await apiService.stopPanTilt();
      if (res.panTilt) onUpdate(res.panTilt);
    } catch (err) {
      console.error('Stop command error', err);
    }
  };

  const handleSelectStep = async (step: number) => {
    setSelectedStep(step);
    await apiService.setPanTiltStep(step);
  };

  const handleToggleMode = async () => {
    const nextMode = panTilt?.mode === 'AUTO_SCAN' ? 'MANUAL' : 'AUTO_SCAN';
    const res = await apiService.setPanTiltMode(nextMode);
    if (res.panTilt) onUpdate(res.panTilt);
  };

  // Keyboard arrow keys listener inspired by the uploaded keyboard cluster
  useEffect(() => {
    if (!isKeyboardActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting inputs if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleMove('UP');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleMove('DOWN');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleMove('LEFT');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleMove('RIGHT');
      } else if (e.key === 'Home' || e.key === 'h' || e.key === 'H') {
        handleHome();
      } else if (e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        handleStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isKeyboardActive, selectedStep, panTilt?.mode]);

  const panAngle = panTilt?.pan ?? 0;
  const tiltAngle = panTilt?.tilt ?? 0;
  const mode = panTilt?.mode ?? 'MANUAL';
  const status = panTilt?.status ?? 'IDLE';

  return (
    <div
      className={`rounded-xl border shadow-sm p-4 sm:p-5 transition-colors ${
        isDarkMode ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-200'
      }`}
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg">🎮</span>
            <h3 className="font-bold text-sm sm:text-base tracking-tight">
              Directional Pan-Tilt Steering
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 font-semibold uppercase">
              2-DOF Gimbal
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Physical sensor orientation to aim 24 GHz radar beam at the patient's thoracic region
          </p>
        </div>

        {/* Auto Scan / Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleMode}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              mode === 'AUTO_SCAN'
                ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                : isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${mode === 'AUTO_SCAN' ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
            <span>{mode === 'AUTO_SCAN' ? 'Auto-Sweep Active' : 'Manual Mode'}</span>
          </button>

          {/* Keyboard capture indicator toggle */}
          <button
            onClick={() => setIsKeyboardActive(!isKeyboardActive)}
            title="Toggle arrow key capture on physical keyboard"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
              isKeyboardActive
                ? 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
            }`}
          >
            ⌨️ Keys {isKeyboardActive ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Main Grid: Controls + Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
        {/* Left Side: Modern Inverted-T Directional Arrow Keypad */}
        <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-slate-800/80">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-1.5">
            <span>Tactile Directional D-Pad</span>
            <span className="text-[9px] text-sky-600 dark:text-sky-400 font-mono">(Arrow-Key Mapped)</span>
          </div>

          {/* Inverted-T Key Cluster Layout (matching uploaded keyboard photo) */}
          <div className="flex flex-col items-center gap-2">
            {/* Top Row: UP Arrow Key centered */}
            <div className="flex justify-center">
              <button
                onClick={() => handleMove('UP')}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl font-extrabold text-xl sm:text-2xl transition-all active:scale-95 flex flex-col items-center justify-center shadow-md ${
                  pendingDirection === 'UP'
                    ? 'bg-sky-600 text-white shadow-sky-500/40 ring-2 ring-sky-400'
                    : isDarkMode
                    ? 'bg-[#151D30] hover:bg-[#1C2640] text-slate-100 border border-slate-700/60 shadow-[0_4px_0_#0F1523]'
                    : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-[0_4px_0_#CBD5E1]'
                }`}
                title="Tilt Up (ArrowUp)"
              >
                <span>↑</span>
                <span className="text-[9px] font-mono tracking-tighter opacity-60">UP</span>
              </button>
            </div>

            {/* Bottom Row: LEFT, DOWN, RIGHT Arrow Keys */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleMove('LEFT')}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl font-extrabold text-xl sm:text-2xl transition-all active:scale-95 flex flex-col items-center justify-center shadow-md ${
                  pendingDirection === 'LEFT'
                    ? 'bg-sky-600 text-white shadow-sky-500/40 ring-2 ring-sky-400'
                    : isDarkMode
                    ? 'bg-[#151D30] hover:bg-[#1C2640] text-slate-100 border border-slate-700/60 shadow-[0_4px_0_#0F1523]'
                    : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-[0_4px_0_#CBD5E1]'
                }`}
                title="Pan Left (ArrowLeft)"
              >
                <span>←</span>
                <span className="text-[9px] font-mono tracking-tighter opacity-60">LEFT</span>
              </button>

              <button
                onClick={() => handleMove('DOWN')}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl font-extrabold text-xl sm:text-2xl transition-all active:scale-95 flex flex-col items-center justify-center shadow-md ${
                  pendingDirection === 'DOWN'
                    ? 'bg-sky-600 text-white shadow-sky-500/40 ring-2 ring-sky-400'
                    : isDarkMode
                    ? 'bg-[#151D30] hover:bg-[#1C2640] text-slate-100 border border-slate-700/60 shadow-[0_4px_0_#0F1523]'
                    : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-[0_4px_0_#CBD5E1]'
                }`}
                title="Tilt Down (ArrowDown)"
              >
                <span>↓</span>
                <span className="text-[9px] font-mono tracking-tighter opacity-60">DOWN</span>
              </button>

              <button
                onClick={() => handleMove('RIGHT')}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl font-extrabold text-xl sm:text-2xl transition-all active:scale-95 flex flex-col items-center justify-center shadow-md ${
                  pendingDirection === 'RIGHT'
                    ? 'bg-sky-600 text-white shadow-sky-500/40 ring-2 ring-sky-400'
                    : isDarkMode
                    ? 'bg-[#151D30] hover:bg-[#1C2640] text-slate-100 border border-slate-700/60 shadow-[0_4px_0_#0F1523]'
                    : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-[0_4px_0_#CBD5E1]'
                }`}
                title="Pan Right (ArrowRight)"
              >
                <span>→</span>
                <span className="text-[9px] font-mono tracking-tighter opacity-60">RIGHT</span>
              </button>
            </div>
          </div>

          {/* Quick Action Center: HOME & STOP */}
          <div className="flex items-center gap-2 mt-5">
            <button
              onClick={handleHome}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span>⌂</span>
              <span>Center / Home (0°, 0°)</span>
            </button>

            <button
              onClick={handleStop}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span>■</span>
              <span>Halt / Stop</span>
            </button>
          </div>
        </div>

        {/* Right Side: Step Size, Angle Readouts & Feedback Telemetry */}
        <div className="space-y-4">
          {/* Step Size Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
              Angular Step Size Per Click
            </label>
            <div className="grid grid-cols-5 gap-2">
              {stepOptions.map((step) => (
                <button
                  key={step}
                  onClick={() => handleSelectStep(step)}
                  className={`py-2 text-xs font-bold font-mono rounded-lg border transition-all ${
                    selectedStep === step
                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                      : isDarkMode
                      ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  ±{step}°
                </button>
              ))}
            </div>
          </div>

          {/* Current Pan & Tilt Coordinate Readouts */}
          <div className="grid grid-cols-2 gap-3">
            {/* Pan Angle Card */}
            <div className="p-3.5 rounded-xl border bg-slate-50 dark:bg-[#070D18] dark:border-slate-800">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Pan (Yaw)</span>
                <span className="font-mono text-[10px]">[-90° ~ +90°]</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-sky-600 dark:text-sky-400 mt-1">
                {panAngle > 0 ? `+${panAngle}` : panAngle}°
              </div>
              {/* Range bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${((panAngle + 90) / 180) * 100}%` }}
                />
              </div>
            </div>

            {/* Tilt Angle Card */}
            <div className="p-3.5 rounded-xl border bg-slate-50 dark:bg-[#070D18] dark:border-slate-800">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Tilt (Pitch)</span>
                <span className="font-mono text-[10px]">[-45° ~ +45°]</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {tiltAngle > 0 ? `+${tiltAngle}` : tiltAngle}°
              </div>
              {/* Range bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${((tiltAngle + 45) / 90) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Real-time Command Feedback Telemetry */}
          <div className="p-3.5 rounded-xl border bg-slate-50 dark:bg-[#070D18] dark:border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Gimbal Controller State:</span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                  status === 'CONFIRMED'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                    : status === 'MOVING'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                    : status === 'LIMIT_REACHED'
                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {status}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>Last Stepper Command:</span>
              <span className="font-mono text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                {panTilt?.lastCommand || 'NONE'}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
              <span>Hardware Link:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ESP32 PWM Servo Bridge Ready
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
