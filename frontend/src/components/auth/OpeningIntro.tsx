import React, { useState, useEffect } from 'react';

interface OpeningIntroProps {
  onFinish: () => void;
}

export const OpeningIntro: React.FC<OpeningIntroProps> = ({ onFinish }) => {
  const [stage, setStage] = useState<number>(0);
  const [isFading, setIsFading] = useState<boolean>(false);

  const [videoError, setVideoError] = useState<boolean>(false);

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 500);   // Radar pulse & video appear
    const t2 = setTimeout(() => setStage(2), 1200);  // Rings expand & waveform contour
    const t3 = setTimeout(() => setStage(3), 2200);  // Title fades in
    const t4 = setTimeout(() => handleComplete(), 5500); // Dissolve into workstation

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  const handleComplete = () => {
    setIsFading(true);
    setTimeout(() => {
      onFinish();
    }, 600);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050913] text-white transition-opacity duration-700 select-none ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Atmospheric depth background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.15)_0%,transparent_70%)]" />

      {/* Center Radar Scanner Core & Video Logo */}
      <div className="relative w-56 h-56 sm:w-64 sm:h-64 mb-6 flex items-center justify-center">
        {/* Concentric radar sensing rings */}
        <div
          className={`absolute inset-0 rounded-full border border-sky-500/30 transition-all duration-1000 ${
            stage >= 1 ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
          }`}
        />
        <div
          className={`absolute inset-6 rounded-full border border-sky-400/40 transition-all duration-1000 delay-150 ${
            stage >= 2 ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
          }`}
        />
        <div
          className={`absolute inset-14 rounded-full border border-cyan-400/50 transition-all duration-1000 delay-300 ${
            stage >= 2 ? 'scale-100 opacity-100' : 'scale-25 opacity-0'
          }`}
        />

        {/* Crosshair reticle */}
        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-sky-500/30" />
        <div className="absolute inset-y-0 left-1/2 w-[1px] bg-sky-500/30" />

        {/* Rotating sweep cone */}
        {stage >= 1 && (
          <div className="absolute inset-0 rounded-full animate-spin [animation-duration:3.5s] pointer-events-none">
            <div className="w-1/2 h-1/2 bg-gradient-to-br from-sky-400/30 to-transparent rounded-tl-full origin-bottom-right" />
          </div>
        )}

        {/* Center Animated Video Logo or Pulsing RF Core */}
        {!videoError ? (
          <div className={`relative z-20 w-32 h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden shadow-[0_0_35px_rgba(14,165,233,0.5)] border-2 border-sky-400/60 bg-black/80 flex items-center justify-center transition-all duration-700 ${
            stage >= 1 ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
          }`}>
            <video
              src="/radar-logo.mp4"
              autoPlay
              loop
              muted
              playsInline
              onError={() => setVideoError(true)}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="relative z-10 w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center shadow-[0_0_25px_#38bdf8]">
            <div className="w-3 h-3 rounded-full bg-white animate-ping" />
          </div>
        )}

        {/* Frequency marker */}
        <div className="absolute -bottom-3 z-30 bg-[#0C1628]/95 border border-sky-500/50 text-sky-300 text-[10px] font-mono px-3 py-0.5 rounded-full uppercase tracking-widest shadow">
          24.125 GHz FMCW
        </div>
      </div>

      {/* Project Identity & Typography */}
      <div
        className={`text-center z-10 px-4 max-w-xl space-y-2 transition-all duration-1000 ${
          stage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-300 text-[11px] font-semibold tracking-wider uppercase mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Biomedical Sensor Engineering
        </div>

        <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white drop-shadow-sm font-sans">
          CONTACTLESS RESPIRATORY DISTRESS<br />AND APNEA DETECTION SYSTEM
        </h1>

        <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-md mx-auto pt-1">
          Non-contact physiological respiratory monitoring using 24 GHz radar
        </p>
      </div>

      {/* Fast Skip Action */}
      <button
        onClick={handleComplete}
        className="absolute bottom-6 right-6 z-20 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white tracking-wide transition-all shadow hover:shadow-sky-500/20 flex items-center gap-1.5"
      >
        <span>Skip Intro</span>
        <span>→</span>
      </button>
    </div>
  );
};
