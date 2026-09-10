import React from 'react';
import { Shield } from 'lucide-react';

interface MedicalDisclaimerProps {
  isDarkMode?: boolean;
}

export const MedicalDisclaimer: React.FC<MedicalDisclaimerProps> = ({ isDarkMode = false }) => {
  return (
    <footer className={`mt-8 border-t px-4 py-4 text-center select-none ${
      isDarkMode ? 'border-slate-800 bg-[#080C14] text-slate-500' : 'border-slate-200 bg-white text-slate-600 shadow-inner'
    }`}>
      <div className="max-w-[1700px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-cyan-700" />
          <span className="font-semibold text-slate-800">Final Year Biomedical Engineering Project Prototype | 24 GHz FMCW Radar</span>
        </div>
        <p className="font-medium text-slate-600">
          Prototype system for research and engineering validation. Not intended for clinical diagnosis.
        </p>
        <div className="font-mono text-[11px] text-slate-400">
          v1.0.0-PROTOTYPE
        </div>
      </div>
    </footer>
  );
};
