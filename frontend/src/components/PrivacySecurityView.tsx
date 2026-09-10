import React from 'react';
import { UserSession } from '../types';
import { apiService } from '../services/apiService';

interface PrivacySecurityViewProps {
  session: UserSession | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  isDarkMode: boolean;
}

export const PrivacySecurityView: React.FC<PrivacySecurityViewProps> = ({
  session,
  onOpenAuthModal,
  onLogout,
  isDarkMode
}) => {
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Privacy Guarantee Card */}
      <div className={`p-5 rounded-xl border shadow-sm ${isDarkMode ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2.5 mb-2">
          <span className="text-xl">🛡️</span>
          <h3 className="font-bold text-base tracking-tight text-emerald-600 dark:text-emerald-400">
            Privacy-First Architecture Guarantee
          </h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          The Contactless Respiratory Distress and Apnea Detection System operates entirely on a
          <strong className="text-slate-900 dark:text-white"> local edge computing paradigm</strong>.
          No raw RF radar Doppler waveforms, patient respiratory signals, or optical camera frames are
          ever uploaded to external public clouds or third-party servers. All DSP filtering, peak detection,
          and apnea state machine evaluations are executed locally on the bedside gateway device.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs">
            <div className="font-bold text-emerald-800 dark:text-emerald-300 mb-0.5">🔒 Zero Cloud Leakage</div>
            <div className="text-slate-600 dark:text-slate-400 text-[11px]">Telemetry restricted to local private network.</div>
          </div>
          <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-xs">
            <div className="font-bold text-sky-800 dark:text-sky-300 mb-0.5">👤 Anonymized RF Doppler</div>
            <div className="text-slate-600 dark:text-slate-400 text-[11px]">RF microwave radar contains zero photographic PII.</div>
          </div>
          <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs">
            <div className="font-bold text-indigo-800 dark:text-indigo-300 mb-0.5">🏥 HIPAA / GDPR Aligned</div>
            <div className="text-slate-600 dark:text-slate-400 text-[11px]">Role-based access logs with auto-session locking.</div>
          </div>
        </div>
      </div>

      {/* Active Session & Two-Tier Access Details */}
      <div className={`p-5 rounded-xl border shadow-sm ${isDarkMode ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
          <div>
            <h4 className="font-bold text-sm">Active Session Credentials</h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Authenticated access level for telemetry recording &amp; gimbal steering
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAuthModal}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white transition-colors"
            >
              Switch Account / Role
            </button>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 transition-colors"
            >
              Lock Session
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="text-slate-500 dark:text-slate-400 font-semibold">User / Operator:</div>
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{session?.name || 'Local Operator'}</div>
            <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{session?.email}</div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="text-slate-500 dark:text-slate-400 font-semibold">Access Tier &amp; Role:</div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                {session?.tier}
              </span>
              <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                {session?.role}
              </span>
            </div>
            {session?.institutionId && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Org ID: {session.institutionId} ({session.department})
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
