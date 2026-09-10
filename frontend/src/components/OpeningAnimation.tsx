import React, { useState, useEffect } from 'react';

interface OpeningAnimationProps {
  onComplete: () => void;
  isDarkMode: boolean;
}

export const OpeningAnimation: React.FC<OpeningAnimationProps> = ({ onComplete, isDarkMode }) => {
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [fadingOut, setFadingOut] = useState<boolean>(false);

  const initSteps = [
    "Establishing link with 24 GHz FMCW Transceiver...",
    "Calibrating Butterworth bandpass filter (0.10 Hz – 0.70 Hz)...",
    "Initializing dual-method respiratory rate estimator...",
    "Arming apnea and respiratory distress state machine...",
    "Contactless Clinical Telemetry Online."
  ];

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < initSteps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(stepInterval);
          setTimeout(() => {
            handleFinish();
          }, 800);
          return prev;
        }
      });
    }, 600);

    return () => clearInterval(stepInterval);
  }, []);

  const handleFinish = () => {
    setFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-500 select-none ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } ${isDarkMode ? 'bg-[#06090F] text-slate-100' : 'bg-[#0B132B] text-white'}`}
    >
      {/* Background ambient radar grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e3a8a_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />

      {/* Radar scanning circular sweep effect */}
      <div className="relative w-48 h-48 sm:w-60 sm:h-60 mb-8 flex items-center justify-center">
        {/* Concentric radar rings */}
        <div className="absolute inset-0 rounded-full border border-sky-500/20" />
        <div className="absolute inset-4 rounded-full border border-sky-500/30" />
        <div className="absolute inset-12 rounded-full border border-sky-500/40" />
        <div className="absolute inset-20 rounded-full border border-sky-400/50" />

        {/* Crosshairs */}
        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-sky-500/30" />
        <div className="absolute inset-y-0 left-1/2 w-[1px] bg-sky-500/30" />

        {/* Rotating sweep cone */}
        <div className="absolute inset-0 rounded-full animate-spin [animation-duration:3s]">
          <div className="w-1/2 h-1/2 bg-gradient-to-br from-sky-400/40 to-transparent rounded-tl-full origin-bottom-right" />
        </div>

        {/* Center RF pulsing node */}
        <div className="relative z-10 w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center shadow-[0_0_20px_#38bdf8]">
          <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
        </div>

        {/* 24 GHz Frequency badge */}
        <div className="absolute -bottom-3 bg-sky-950/90 border border-sky-500/60 text-sky-300 text-[11px] font-mono px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">
          24.125 GHz FMCW
        </div>
      </div>

      {/* Project Title & Identity */}
      <div className="text-center z-10 px-4 max-w-2xl space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-300 text-xs font-semibold tracking-wider uppercase mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Biomedical Sensor Engineering
        </div>

        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm font-sans">
          CONTACTLESS RESPIRATORY DISTRESS &amp; APNEA DETECTION SYSTEM
        </h1>

        <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-lg mx-auto">
          High-Precision 24 GHz FMCW Radar-Based Continuous Physiological Monitoring
        </p>

        {/* Dynamic status readout */}
        <div className="pt-6 h-12 flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 text-xs font-mono text-sky-400 bg-sky-950/40 px-3.5 py-1.5 rounded-md border border-sky-800/40">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
            <span>{initSteps[stepIndex]}</span>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center items-center gap-1.5 pt-2">
          {initSteps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= stepIndex ? 'w-6 bg-sky-400' : 'w-1.5 bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Fast skip button */}
      <button
        onClick={handleFinish}
        className="absolute bottom-6 right-6 z-20 px-3.5 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white tracking-wide transition-all shadow hover:shadow-sky-500/20 flex items-center gap-1.5"
      >
        <span>Skip Intro</span>
        <span>→</span>
      </button>
    </div>
  );
};
