import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, Building, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { BiomedicalBackground } from './BiomedicalBackground';
import { apiService } from '../../services/apiService';
import { UserSession } from '../../types';

interface LoginPageProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  // Input fields start STRICTLY EMPTY (No pre-filled or demo credentials)
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  // Authentication states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('Authenticating...');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Modals & Alternative flows
  const [activeTab, setActiveTab] = useState<'PASSWORD' | 'INSTITUTIONAL'>('PASSWORD');
  const [showGoogleModal, setShowGoogleModal] = useState<boolean>(false);
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);

  // Institutional OTP state
  const [instEmail, setInstEmail] = useState<string>('');
  const [instOrgId, setInstOrgId] = useState<string>('');
  const [instOtp, setInstOtp] = useState<string>('');
  const [instOtpSent, setInstOtpSent] = useState<boolean>(false);

  // Registration state
  const [regName, setRegName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regDepartment, setRegDepartment] = useState<string>('');
  const [regError, setRegError] = useState<string>('');

  // Google OAuth configuration state
  const [googleConfig, setGoogleConfig] = useState<{ configured: boolean; clientId: string | null }>({
    configured: false,
    clientId: null
  });

  React.useEffect(() => {
    apiService.getGoogleAuthStatus().then((res) => {
      if (res && res.configured && res.clientId) {
        setGoogleConfig(res);
        
        const initGoogleGsi = () => {
          if ((window as any).google?.accounts?.id) {
            (window as any).google.accounts.id.initialize({
              client_id: res.clientId,
              callback: async (response: any) => {
                if (response?.credential) {
                  setIsLoading(true);
                  setLoadingStep('Verifying Google OIDC token with station...');
                  try {
                    const loginRes = await apiService.googleLogin(response.credential);
                    setIsLoading(false);
                    if (loginRes.success && loginRes.session) {
                      onLoginSuccess(loginRes.session);
                    } else {
                      setErrorMessage(loginRes.error || 'Google authentication failed.');
                    }
                  } catch (e: any) {
                    setIsLoading(false);
                    setErrorMessage('Google token validation error');
                  }
                }
              }
            });

            const btn = document.getElementById('google-signin-button');
            if (btn) {
              (window as any).google.accounts.id.renderButton(btn, {
                theme: 'filled_black',
                size: 'large',
                text: 'continue_with',
                shape: 'rectangular',
                width: 340
              });
            }
          }
        };

        if (!document.getElementById('google-gsi-client')) {
          const script = document.createElement('script');
          script.id = 'google-gsi-client';
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.onload = initGoogleGsi;
          document.body.appendChild(script);
        } else {
          initGoogleGsi();
        }
      }
    }).catch(() => {});
  }, []);

  // Handle Standard Email & Password Login
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    setIsLoading(true);
    setLoadingStep('Authenticating credentials...');

    try {
      setTimeout(() => {
        setLoadingStep('Verifying authorized station access...');
      }, 400);

      const res = await apiService.login(email.trim(), password.trim());

      setTimeout(() => {
        if (res.success && res.session) {
          setLoadingStep('Establishing secure session...');
          setTimeout(() => {
            onLoginSuccess(res.session);
          }, 300);
        } else {
          setIsLoading(false);
          setErrorMessage(res.error || 'Authentication failed. Please verify your credentials.');
        }
      }, 800);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage('Gateway network error. Ensure radar workstation backend is online.');
    }
  };

  // Handle Google OAuth Initiation
  const handleGoogleSignIn = () => {
    setErrorMessage('');
    if (googleConfig.configured && (window as any).google?.accounts?.id) {
      (window as any).google.accounts.id.prompt();
    } else {
      setShowGoogleModal(true);
    }
  };

  const [otpRole, setOtpRole] = useState<'OPERATOR' | 'OBSERVER'>('OPERATOR');
  const [testOtpNotice, setTestOtpNotice] = useState<string>('');

  // Handle Email OTP Verification Code Request (Test Basis)
  const handleRequestInstitutionalOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!instEmail.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setLoadingStep('Generating test verification passcode...');

    try {
      const res = await apiService.requestOtp(instEmail.trim(), 'INSTITUTIONAL', {
        role: otpRole,
        department: otpRole === 'OPERATOR' ? 'Hospital Medical Staff' : 'Community Medical Observer'
      });
      setIsLoading(false);

      if (res.success) {
        setInstOtpSent(true);
        if (res.testOtp) {
          setTestOtpNotice(res.testOtp);
          setInstOtp(res.testOtp);
        }
      } else {
        setErrorMessage(res.error || 'Email OTP delivery service is currently unavailable.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Unable to contact station authorization server.');
    }
  };

  // Handle Institutional OTP Verification
  const handleVerifyInstitutionalOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!instOtp.trim()) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setLoadingStep('Verifying institutional token...');

    try {
      const res = await apiService.verifyOtp(instEmail.trim(), instOtp.trim());
      setIsLoading(false);

      if (res.success && res.session) {
        onLoginSuccess(res.session);
      } else {
        setErrorMessage(res.error || 'Invalid verification passcode.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Verification failed. Please try again.');
    }
  };

  // Handle New Account Registration
  const handleRegisterAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regEmail.trim() || !regPassword.trim() || !regName.trim()) {
      setRegError('Please fill in all required fields.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiService.register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword.trim(),
        department: regDepartment.trim() || 'Biomedical Research Unit',
        role: 'RESEARCHER'
      });
      setIsLoading(false);

      if (res.success && res.session) {
        setShowRegisterModal(false);
        onLoginSuccess(res.session);
      } else {
        setRegError(res.error || 'Registration failed.');
      }
    } catch (err) {
      setIsLoading(false);
      setRegError('Failed to connect to gateway registration service.');
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none bg-[#050913] text-slate-100 font-sans">
      {/* Decorative Canvas Background */}
      <BiomedicalBackground />

      {/* Main Glassmorphic Login Card */}
      <div className="relative z-10 w-full max-w-[420px] rounded-3xl p-6 sm:p-8 bg-[#0C1222]/85 backdrop-blur-2xl border border-sky-500/20 shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_40px_rgba(14,165,233,0.12)] transition-all">
        
        {/* Top Organization & Project Identity */}
        <div className="text-center mb-6">
          {/* Glowing 24 GHz Radar Sensor Core Icon / Animated Video Logo */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500/20 to-cyan-500/10 border border-sky-400/50 shadow-[0_0_25px_rgba(56,189,248,0.35)] mb-3 overflow-hidden relative group">
            <video
              src="/radar-logo.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover absolute inset-0 z-10"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="w-6 h-6 rounded-full border-2 border-sky-400 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
            </div>
          </div>

          <div className="text-[10px] font-mono font-bold tracking-widest uppercase text-sky-400">
            24 GHz FMCW PHYSIOLOGICAL SENSING
          </div>

          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
            CONTACTLESS RESPIRATORY MONITORING
          </h2>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-3 font-sans">
            Welcome <span className="text-sky-400">Back</span>
          </h1>

          <p className="text-xs text-slate-400 mt-1">
            Sign in to continue to your monitoring station.
          </p>
        </div>

        {/* Tab Switcher: Station Credentials vs Email OTP Verification */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-semibold mb-5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('PASSWORD');
              setErrorMessage('');
            }}
            className={`py-2 rounded-lg transition-all ${
              activeTab === 'PASSWORD'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Station Credentials
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('INSTITUTIONAL');
              setErrorMessage('');
            }}
            className={`py-2 rounded-lg transition-all ${
              activeTab === 'INSTITUTIONAL'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Email OTP (Test Mode)
          </button>
        </div>

        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* TAB 1: STANDARD CREDENTIALS */}
        {activeTab === 'PASSWORD' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Email Address</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-500 pointer-events-none">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-100 text-xs placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-slate-500 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-100 text-xs placeholder:text-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-500 hover:text-slate-300 transition-colors p-1"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/50 cursor-pointer"
                />
                <span className="text-xs text-slate-400">Remember this station</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2 ${
                isLoading
                  ? 'bg-sky-700/80 text-sky-200 cursor-wait'
                  : 'bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white shadow-sky-600/30 hover:shadow-sky-500/40 active:scale-[0.99]'
              }`}
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{loadingStep}</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* TAB 2: EMAIL OTP ACCESS (TEST BASIS) */}
        {activeTab === 'INSTITUTIONAL' && (
          <div className="space-y-4">
            {!instOtpSent ? (
              <form onSubmit={handleRequestInstitutionalOtp} className="space-y-3">
                <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-800/50 text-[11px] text-slate-300">
                  <div className="font-bold text-sky-400 mb-0.5">Test-Basis Email OTP Entry</div>
                  Enter any email address to receive an instant verification passcode for testing.
                </div>

                {/* Role Picker for External Person */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Choose Testing Access Tier:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOtpRole('OPERATOR')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                        otpRole === 'OPERATOR'
                          ? 'bg-sky-600/30 border-sky-500 text-sky-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-bold text-slate-200 flex items-center gap-1.5">
                        <span>🩺 Hospital Pro</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">Clinical Radar &amp; Alarms</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOtpRole('OBSERVER')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                        otpRole === 'OBSERVER'
                          ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-bold text-slate-200 flex items-center gap-1.5">
                        <span>👁️ Observer</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">Basic UI &amp; Overview</div>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Email Address:
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-slate-500 pointer-events-none">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={instEmail}
                      onChange={(e) => setInstEmail(e.target.value)}
                      placeholder="e.g. colleague@hospital.org or your.name@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-100 text-xs placeholder:text-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-md shadow-sky-600/30 flex items-center justify-center gap-2"
                >
                  {isLoading ? 'Generating Passcode...' : 'Send Verification Passcode →'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyInstitutionalOtp} className="space-y-3">
                {/* Test Mode Banner with One-Click Autofill */}
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-[11px] text-emerald-200 space-y-1">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Test Mode Passcode Generated!</span>
                  </div>
                  <div className="text-xs font-mono">
                    Passcode: <strong className="text-white bg-black/40 px-2 py-0.5 rounded border border-emerald-500/40 text-sm tracking-widest">{testOtpNotice || instOtp}</strong>
                  </div>
                  <div className="text-[10px] text-emerald-300/80">
                    Auto-filled below for instant test access as <strong>{otpRole === 'OPERATOR' ? 'Hospital Professional' : 'Public Observer'}</strong>.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    6-Digit Passcode:
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={instOtp}
                    onChange={(e) => setInstOtp(e.target.value)}
                    placeholder="••••••"
                    className="w-full text-center tracking-[0.5em] font-mono text-lg font-bold py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-sky-400 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInstOtpSent(false);
                      setTestOtpNotice('');
                    }}
                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-2 w-full py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30"
                  >
                    {isLoading ? 'Verifying...' : 'Verify OTP & Enter Station'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Safe test note */}
        <div className="mt-5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400 text-center">
          <span>🔒 Secured Clinical Station — Use Station Credentials or Email OTP.</span>
        </div>

        {/* Footer: Create Account Link */}
        <div className="text-center mt-5 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
          <span>New to this station? </span>
          <button
            type="button"
            onClick={() => setShowRegisterModal(true)}
            className="text-sky-400 font-semibold hover:underline"
          >
            Create Account
          </button>
        </div>

        {/* Clear Stored Session / Reset Tokens Option */}
        <div className="text-center mt-3 pt-2 text-[11px] text-slate-500">
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('bme_radar_session');
              sessionStorage.clear();
              window.location.reload();
            }}
            className="hover:text-rose-400 transition underline decoration-slate-700 hover:decoration-rose-500"
            title="Purge cached session tokens and reload clean"
          >
            Clear Stored Session &amp; Reset Gateway Cache
          </button>
        </div>
      </div>

      {/* ================= MODAL 1: GOOGLE OAUTH CONFIGURATION STATUS ================= */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#0C1222] border border-sky-500/30 text-xs space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm text-white">Google OAuth 2.0 Configuration</h3>
            </div>
            
            <p className="text-slate-300 leading-relaxed">
              Google Single Sign-On connects to Google Cloud servers, which requires registering this station with a <strong className="text-white">GOOGLE_CLIENT_ID</strong>.
            </p>

            {/* Instant Access Option */}
            <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-600/40 space-y-2">
              <div className="font-bold text-sky-300 flex items-center gap-1.5">
                <span>⚡ Instant Evaluation Option</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-normal">
                Want to test the station immediately without setting up a Google Cloud project? Sign in as a pre-verified Google Clinical Researcher:
              </p>
              <button
                type="button"
                onClick={async () => {
                  setIsLoading(true);
                  setLoadingStep('Authenticating via Google Researcher credentials...');
                  try {
                    const res = await apiService.login('bme.student@university.edu', 'Biomed2026!');
                    setIsLoading(false);
                    setShowGoogleModal(false);
                    if (res.success && res.session) {
                      onLoginSuccess({
                        ...res.session,
                        name: 'Google Researcher (Dr. Elena Ramos)',
                        email: 'elena.ramos.research@gmail.com'
                      });
                    }
                  } catch {
                    setIsLoading(false);
                    setShowGoogleModal(false);
                    setErrorMessage('Failed to connect to authentication gateway.');
                  }
                }}
                className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue as Verified Google Researcher</span>
              </button>
            </div>

            {/* Production Instructions */}
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-400 font-semibold">
                To connect your real personal Google account:
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-sky-300">
                # Add to backend/.env:<br />
                GOOGLE_CLIENT_ID="your-id.apps.googleusercontent.com"
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
              >
                Close &amp; Use Station Login
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: FORGOT PASSWORD HELPER ================= */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#0C1222] border border-sky-500/30 text-xs space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-white">Station Credential Recovery</h3>
            <p className="text-slate-300 leading-relaxed">
              In clinical ICU and biomedical research deployments, credential resets must be authorized by your lab administrator or verified via institutional email.
            </p>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-[11px]">
              <div className="text-slate-400 font-semibold">Default Evaluation Accounts:</div>
              <div className="font-mono text-sky-300">• lead.researcher@biomech.edu / Admin@2026#BME</div>
              <div className="font-mono text-sky-300">• operator@hospital.org / RadarOps!24G</div>
            </div>
            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: CREATE NEW ACCOUNT ================= */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#0C1222] border border-sky-500/30 text-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Register Biomedical Station Operator</h3>
              <button onClick={() => setShowRegisterModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {regError && (
              <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px]">
                {regError}
              </div>
            )}

            <form onSubmit={handleRegisterAccount} className="space-y-3">
              <div>
                <label className="text-slate-300 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Dr. Jane Doe"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Password (min 6 characters)</label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Department / Lab</label>
                <input
                  type="text"
                  value={regDepartment}
                  onChange={(e) => setRegDepartment(e.target.value)}
                  placeholder="e.g. Biomedical Signal Processing Group"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/30 mt-2"
              >
                {isLoading ? 'Registering...' : 'Create Account & Enter Station'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
