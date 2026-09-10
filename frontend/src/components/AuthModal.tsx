import React, { useState } from 'react';
import { AccessTier, UserRole, UserSession } from '../types';
import { apiService } from '../services/apiService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (session: UserSession) => void;
  isDarkMode: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess, isDarkMode }) => {
  const [tier, setTier] = useState<AccessTier>('INSTITUTIONAL');
  const [email, setEmail] = useState<string>('clinical.lead@biomech.hospital.org');
  const [name, setName] = useState<string>('Dr. A. Sharma');
  const [institutionId, setInstitutionId] = useState<string>('HOSP-BME-ICU-01');
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [otpStep, setOtpStep] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [generatedDemoOtp, setGeneratedDemoOtp] = useState<string>('');

  if (!isOpen) return null;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await apiService.requestOtp(email, tier, { name, institutionId, role });
      if (res.success) {
        setGeneratedDemoOtp(res.demoOtp || '742918');
        setOtpCode(res.demoOtp || '742918'); // Pre-fill for easy one-click testing
        setOtpStep(true);
      } else {
        setErrorMsg('Failed to request OTP code.');
      }
    } catch (err) {
      setErrorMsg('Network error while requesting verification code.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await apiService.verifyOtp(email, otpCode);
      if (res.success && res.session) {
        onLoginSuccess(res.session);
        onClose();
      } else {
        setErrorMsg(res.error || 'Invalid OTP code.');
      }
    } catch (err) {
      setErrorMsg('Error verifying OTP.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isDarkMode ? 'bg-[#0B1120] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Two-Tier Authentication
            </div>
            <h3 className="text-lg font-extrabold tracking-tight">
              Clinical Telemetry Access
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Tier Switcher Tabs */}
        {!otpStep && (
          <div className="grid grid-cols-2 p-1.5 m-5 mb-0 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs font-bold">
            <button
              onClick={() => {
                setTier('INSTITUTIONAL');
                setEmail('clinical.lead@biomech.hospital.org');
              }}
              className={`py-2 rounded-lg transition-all ${
                tier === 'INSTITUTIONAL'
                  ? 'bg-white dark:bg-slate-800 shadow-sm text-sky-600 dark:text-sky-400'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              🏥 Institutional / ICU
            </button>
            <button
              onClick={() => {
                setTier('PERSONAL');
                setEmail('bedside.operator@gmail.com');
              }}
              className={`py-2 rounded-lg transition-all ${
                tier === 'PERSONAL'
                  ? 'bg-white dark:bg-slate-800 shadow-sm text-sky-600 dark:text-sky-400'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              🏠 Personal Bedside
            </button>
          </div>
        )}

        {/* Form Body */}
        <div className="p-5">
          {errorMsg && (
            <div className="mb-4 p-2.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-800">
              ⚠️ {errorMsg}
            </div>
          )}

          {!otpStep ? (
            <form onSubmit={handleRequestOtp} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Full Name / Clinical Title
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  {tier === 'INSTITUTIONAL' ? 'Hospital / Institution Email' : 'Personal Email'}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs font-mono"
                />
              </div>

              {tier === 'INSTITUTIONAL' && (
                <>
                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Organization / Hospital ID
                    </label>
                    <input
                      type="text"
                      required
                      value={institutionId}
                      onChange={(e) => setInstitutionId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Clinical Role
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs font-semibold"
                    >
                      <option value="ADMIN">Administrator (Full Control &amp; Settings)</option>
                      <option value="RESEARCHER">Biomedical Researcher (Data &amp; DSP)</option>
                      <option value="OPERATOR">Clinical Operator (Monitoring &amp; Gimbal)</option>
                      <option value="OBSERVER">View-Only Observer</option>
                    </select>
                  </div>
                </>
              )}

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-600/30 transition-all"
                >
                  Send 6-Digit Verification OTP →
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-slate-700 dark:text-slate-300">
                <div className="font-bold text-sky-800 dark:text-sky-300 mb-0.5">Verification Code Sent</div>
                <div>A 6-digit one-time passcode was generated for <span className="font-mono font-semibold">{email}</span>.</div>
                {generatedDemoOtp && (
                  <div className="mt-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    Demo OTP: {generatedDemoOtp} (Auto-filled)
                  </div>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Enter 6-Digit Passcode:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full text-center tracking-[0.5em] font-mono text-xl font-bold py-2 rounded-lg border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOtpStep(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-semibold"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-2 w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/30"
                >
                  Verify &amp; Enter Station
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
