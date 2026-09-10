import React, { useState, useEffect, useRef } from 'react';
import { 
  Sun, 
  Moon,
  AlertTriangle, 
  ShieldAlert, 
  RotateCcw, 
  Minus, 
  Plus, 
  Info, 
  CheckCircle2, 
  Sliders, 
  Zap,
  Power,
  ZapOff,
  Flame,
  Radio
} from 'lucide-react';
import { IlluminationState } from '../types';

interface CameraIlluminationControlProps {
  illumination: IlluminationState | null;
  onSetIntensity: (level: number) => void;
  onResetToDefault: () => void;
  onToggleLed?: (forceState?: boolean) => void;
  onFlashFull?: () => void;
  isDarkMode: boolean;
  cameraConnected?: boolean;
}

export const CameraIlluminationControl: React.FC<CameraIlluminationControlProps> = ({
  illumination,
  onSetIntensity,
  onResetToDefault,
  onToggleLed,
  onFlashFull,
  isDarkMode,
  cameraConnected = true
}) => {
  const currentLevel = illumination?.controlLevel ?? 0;
  const isHardwareConnected = Boolean(illumination?.connected) && illumination?.status !== 'DISCONNECTED';
  const status = illumination?.status ?? 'APPLIED';
  const pwm = illumination?.pwmDutyCycle ?? 128;
  const maxLimit = illumination?.maxSafetyLimit ?? 85;
  const isLedOn = (illumination?.isOn ?? true) && currentLevel > -100 && pwm > 0;

  // Local state for 0ms instantaneous UI feedback
  const [localLevel, setLocalLevel] = useState<number>(currentLevel);
  const [showAutoNotice, setShowAutoNotice] = useState<boolean>(false);
  const [manualOverride, setManualOverride] = useState<boolean>(true); // Enabled by default to never lock user out

  // Throttle timer and pending value ref for zero-lag high-speed slider pulls
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRequestedLevelRef = useRef<number>(currentLevel);
  const isDraggingRef = useRef<boolean>(false);

  // Sync local level when prop updates only when not dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalLevel(currentLevel);
    }
  }, [currentLevel]);

  // Clean up throttle timer on unmount
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, []);

  // Dispatch illumination command with 35ms throttling to prevent queue build-up during rapid dragging
  const dispatchLevel = (val: number, immediate: boolean = false) => {
    latestRequestedLevelRef.current = val;

    if (immediate) {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      onSetIntensity(val);
      return;
    }

    if (!throttleTimerRef.current) {
      // Fire immediately on first movement
      onSetIntensity(val);
      throttleTimerRef.current = setTimeout(() => {
        throttleTimerRef.current = null;
        // If user moved slider to a newer value during throttle period, fire it now
        if (latestRequestedLevelRef.current !== val) {
          onSetIntensity(latestRequestedLevelRef.current);
        }
      }, 40); // 40ms = ~25 updates/sec, optimal for ESP32 serial/HTTP buffer
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    isDraggingRef.current = true;
    setLocalLevel(val);
    dispatchLevel(val, false);
  };

  const handleSliderPointerUp = () => {
    isDraggingRef.current = false;
    // Guaranteed final dispatch on release
    dispatchLevel(localLevel, true);
  };

  const handleStep = (step: number) => {
    const nextVal = Math.max(-100, Math.min(maxLimit, localLevel + step));
    setLocalLevel(nextVal);
    dispatchLevel(nextVal, true);
  };

  // Manual LED ON/OFF toggle
  const handleTogglePower = () => {
    if (onToggleLed) {
      onToggleLed(!isLedOn);
    } else {
      if (isLedOn) {
        setLocalLevel(-100);
        dispatchLevel(-100, true);
      } else {
        const nextVal = localLevel <= -100 ? 0 : localLevel;
        setLocalLevel(nextVal);
        dispatchLevel(nextVal, true);
      }
    }
  };

  // Instant Full Light (+85% Max Safe Ceiling)
  const handleInstantFullLight = () => {
    setLocalLevel(maxLimit);
    if (onFlashFull) {
      onFlashFull();
    } else {
      dispatchLevel(maxLimit, true);
    }
  };

  // Instant LED OFF (0% / -100% offset)
  const handleInstantOff = () => {
    setLocalLevel(-100);
    if (onToggleLed) {
      onToggleLed(false);
    } else {
      dispatchLevel(-100, true);
    }
  };

  const getIntensityColor = () => {
    if (!isLedOn) return 'text-slate-500';
    if (localLevel < -30) return 'text-sky-400';
    if (localLevel > 50) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getSliderTrackGradient = () => {
    return `linear-gradient(to right, #0284c7 0%, #10b981 50%, #f59e0b 85%, #ef4444 100%)`;
  };

  const canControl = isHardwareConnected || manualOverride;

  return (
    <div className={`p-5 rounded-xl border transition-all ${
      isDarkMode 
        ? 'bg-[#0D1424] border-slate-800 text-slate-100 shadow-lg' 
        : 'bg-white border-slate-200 text-slate-800 shadow-sm'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`p-2.5 rounded-xl border transition-all ${
            isLedOn
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-md shadow-amber-500/10 animate-pulse'
              : isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-300'
          }`}>
            <Sun className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight uppercase flex items-center gap-2">
              CAMERA ILLUMINATION &amp; LED CONTROL
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}>
                ESP32 GPIO 4 / NIR 850nm
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Manual high-speed intensity tuning and direct hardware LED power switching with zero-latency response
            </p>
          </div>
        </div>

        {/* Status Indicators & Direct Link */}
        <div className="flex items-center gap-2 flex-wrap">
          {isLedOn ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
              <span>ESP32 LED: ACTIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-700/50 border border-slate-600 text-slate-400 text-xs font-semibold">
              <Moon className="h-3.5 w-3.5" />
              <span>ESP32 LED: OFF</span>
            </div>
          )}

          {status === 'LIMIT_REACHED' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-semibold">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>THERMAL CEILING (+{maxLimit}%)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>DIRECT LINK READY</span>
            </div>
          )}
        </div>
      </div>

      {/* Primary Manual LED ON/OFF Quick Bar */}
      <div className={`my-4 p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
        isDarkMode ? 'bg-[#080d19] border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          {/* Main On/Off Toggle Button */}
          <button
            onClick={handleTogglePower}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 ${
              isLedOn 
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 hover:from-amber-400 hover:to-yellow-400 shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
            title="Toggle ESP32 Onboard LED Power"
          >
            <Power className={`h-4 w-4 ${isLedOn ? 'text-slate-950 font-extrabold' : 'text-slate-400'}`} />
            <span>MANUAL LED {isLedOn ? 'ON (CLICK TO TURN OFF)' : 'OFF (CLICK TO TURN ON)'}</span>
          </button>

          <span className="text-xs text-slate-500 font-mono hidden sm:inline">
            Status: <b className={isLedOn ? 'text-amber-400' : 'text-slate-400'}>{isLedOn ? 'ILLUMINATING' : 'STANDBY'}</b>
          </span>
        </div>

        {/* Rapid Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleInstantFullLight}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition active:scale-95 shadow-sm"
            title="Instantaneous jump to safe maximum brightness (+85%)"
          >
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span>⚡ INSTANT FULL LIGHT</span>
          </button>

          <button
            onClick={onResetToDefault}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition active:scale-95"
            title="Reset to nominal bedside baseline (0% / 128 PWM)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>NOMINAL (0%)</span>
          </button>

          <button
            onClick={handleInstantOff}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition active:scale-95"
            title="Turn LED completely off (0% PWM)"
          >
            <ZapOff className="h-3.5 w-3.5" />
            <span>TURN OFF</span>
          </button>
        </div>
      </div>

      {/* Intensity Numerical Readout & PWM Metric */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4 items-center">
        {/* Large Readout */}
        <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${
          isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <span className="text-[10px] tracking-widest font-mono font-bold uppercase text-slate-400">
            CONTROL LEVEL
          </span>
          <div className={`text-4xl font-extrabold font-mono tracking-tight my-1 ${getIntensityColor()}`}>
            {!isLedOn ? 'OFF' : localLevel > 0 ? `+${localLevel}%` : `${localLevel}%`}
          </div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {!isLedOn ? 'LED Powered Down' : localLevel === 0 ? 'Nominal Bedside Default' : localLevel >= maxLimit ? 'Maximum Safe Output' : localLevel > 0 ? 'Enhanced Illumination' : 'Attenuated Illumination'}
          </span>
        </div>

        {/* Technical Drive Duty Cycle */}
        <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${
          isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <span className="text-[10px] tracking-widest font-mono font-bold uppercase text-slate-400">
            ESP32 PWM DUTY (8-BIT)
          </span>
          <div className="text-3xl font-extrabold font-mono tracking-tight my-1 text-sky-400">
            {!isLedOn ? (
              <span className="text-slate-500 text-2xl font-bold">0 <span className="text-sm font-normal">/ 255</span></span>
            ) : (
              <>{Math.round(((localLevel + 100) / 200) * 255)} <span className="text-sm font-normal text-slate-500">/ 255</span></>
            )}
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {!isLedOn ? 'LED Drive Inactive (0.0% Duty)' : `${((Math.round(((localLevel + 100) / 200) * 255) / 255) * 100).toFixed(1)}% Active Pulse Width (5 kHz)`}
          </span>
        </div>

        {/* Safety Ceiling & Ack */}
        <div className={`p-4 rounded-xl border flex flex-col justify-center text-left text-xs space-y-2 ${
          isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex justify-between items-center border-b pb-1.5 border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 font-medium">Safety Ceiling:</span>
            <span className="font-mono font-bold text-amber-500">+{maxLimit}% Safe Thermal Cap</span>
          </div>
          <div className="flex justify-between items-center border-b pb-1.5 border-slate-200 dark:border-slate-800">
            <span className="text-slate-500 font-medium">Last Command:</span>
            <span className="font-mono text-[11px] text-slate-300 truncate max-w-[140px]">
              {illumination?.lastCommand || 'READY_MANUAL'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Latency Optimization:</span>
            <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
              <Zap className="h-3 w-3 text-emerald-400" /> Instant (Zero-Queue)
            </span>
          </div>
        </div>
      </div>

      {/* Main Horizontal Intensity Slider */}
      <div className={`p-5 rounded-xl border my-4 ${
        isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5 text-sky-500" />
            INTENSITY: LOW (0%) ───────────────●─────────────── HIGH (+{maxLimit}%)
          </span>
          <span className="text-xs font-mono font-bold text-slate-300">
            Direct Drive: {localLevel > 0 ? `+${localLevel}%` : `${localLevel}%`}
          </span>
        </div>

        {/* Continuous Slider with instant touch/mouse reaction */}
        <div className="relative py-3">
          <input
            type="range"
            min="-100"
            max="100"
            step="1"
            value={localLevel}
            onChange={handleSliderChange}
            onPointerUp={handleSliderPointerUp}
            onMouseUp={handleSliderPointerUp}
            onTouchEnd={handleSliderPointerUp}
            className="w-full h-3.5 rounded-lg appearance-none cursor-pointer accent-amber-400 shadow-inner"
            style={{
              background: getSliderTrackGradient()
            }}
          />

          {/* Scale Markings */}
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mt-2 select-none">
            <div className="text-left">
              <div className="font-bold text-sky-400">-100%</div>
              <div className="text-[9px] text-slate-500">MIN / OFF</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-slate-400">-50%</div>
              <div className="text-[9px] text-slate-500">LOW</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-emerald-400">0%</div>
              <div className="text-[9px] text-slate-500">NOMINAL</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-amber-400">+50%</div>
              <div className="text-[9px] text-slate-500">HIGH</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-rose-400">+{maxLimit}%</div>
              <div className="text-[9px] text-slate-500">SAFE MAX</div>
            </div>
          </div>
        </div>

        {/* Stepped Controls and Reset Button */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-4 border-t border-slate-200 dark:border-slate-800 mt-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-500 font-medium mr-1">Fine Steps:</span>
            <button
              onClick={() => handleStep(-10)}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition active:scale-95"
              title="Decrease illumination by 10%"
            >
              -10%
            </button>
            <button
              onClick={() => handleStep(-5)}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition active:scale-95"
              title="Decrease illumination by 5%"
            >
              -5%
            </button>
            <button
              onClick={() => handleStep(-1)}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-0.5 active:scale-95"
              title="Decrease illumination by 1%"
            >
              <Minus className="h-3 w-3" /> 1%
            </button>
            <button
              onClick={() => handleStep(1)}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-0.5 active:scale-95"
              title="Increase illumination by 1%"
            >
              <Plus className="h-3 w-3" /> 1%
            </button>
            <button
              onClick={() => handleStep(5)}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition active:scale-95"
              title="Increase illumination by 5%"
            >
              +5%
            </button>
            <button
              onClick={() => handleStep(10)}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition active:scale-95"
              title="Increase illumination by 10%"
            >
              +10%
            </button>
          </div>

          {/* Reset to Default Button */}
          <button
            onClick={onResetToDefault}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition shadow-sm bg-sky-600 hover:bg-sky-500 text-white border-sky-500 active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>RESET TO DEFAULT (0%)</span>
          </button>
        </div>
      </div>

      {/* Auto-Mode Guard & Data Integrity Callout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-xs">
        {/* Mode Selector Notice */}
        <div className={`p-3 rounded-lg border ${
          isDarkMode ? 'bg-[#090F1D] border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-slate-300">Driver Mode</span>
            <span className="font-mono text-[10px] uppercase font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              MANUAL ZERO-LAG
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Optimized zero-queue hardware driver sends commands via ESP32 flash and GPIO registers directly, preventing network buffer lag when sliders are pulled quickly.
          </p>
          <button
            onClick={() => setShowAutoNotice(!showAutoNotice)}
            className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 mt-1.5 underline"
          >
            {showAutoNotice ? 'Hide Technical Specification' : 'View Optical Safety Details'}
          </button>
          {showAutoNotice && (
            <div className="mt-2 p-2.5 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-300 space-y-1">
              <div>• <b>Wavelength:</b> 850 nm Near-Infrared (NIR) &amp; Optical Warm White LED</div>
              <div>• <b>Eye Safety:</b> Complies with IEC 62471 photobiological safety standard.</div>
              <div>• <b>Thermal Dissipation:</b> Hard limited to +85% PWM duty to avoid camera sensor thermal noise.</div>
              <div>• <b>Hardware Command:</b> Dispatched to <code>/control?var=flash&amp;val=PWM</code> &amp; <code>/control?var=led_intensity</code>.</div>
            </div>
          )}
        </div>

        {/* Disclaimer / Labeling Callout */}
        <div className={`p-3 rounded-lg border flex items-start gap-2.5 ${
          isDarkMode ? 'bg-sky-950/20 border-sky-800/40 text-sky-200' : 'bg-sky-50 border-sky-200 text-sky-800'
        }`}>
          <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <div className="font-semibold mb-0.5">Control Level Metric Specification</div>
            <span>
              This control adjusts the electronic drive duty cycle on a normalized scale (<b>-100% to +85%</b>). Instantaneous feedback ensures immediate illumination change without microcontroller backlog.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

