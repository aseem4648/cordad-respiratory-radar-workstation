import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  Search, 
  Filter, 
  ShieldAlert, 
  KeyRound, 
  Chrome, 
  User, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Users, 
  Lock, 
  Globe, 
  Shield,
  Trash2,
  UserX,
  FileX
} from 'lucide-react';
import { AccessLogRecord, UserRecord, UserSession } from '../../types';

interface AdminAccessLogViewProps {
  token: string;
  session?: UserSession | null;
  isDarkMode: boolean;
}

export const AdminAccessLogView: React.FC<AdminAccessLogViewProps> = ({
  token,
  session,
  isDarkMode
}) => {
  const [logs, setLogs] = useState<AccessLogRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'LOGINS' | 'USERS'>('LOGINS');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [authMethodFilter, setAuthMethodFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);
  const [showClearLogsModal, setShowClearLogsModal] = useState<boolean>(false);
  const [purging, setPurging] = useState<boolean>(false);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Strict RBAC Access Check (Full access for ADMIN role or Head Admin Email)
  const isHeadAdminEmail = session?.email?.toLowerCase().trim() === 'aseem323711@sahrdaya.ac.in';
  const isAdmin = session?.role === 'ADMIN' || isHeadAdminEmail;

  const fetchData = async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [logsRes, usersRes] = await Promise.all([
        fetch('/api/admin/access-logs?limit=250', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!logsRes.ok) {
        if (logsRes.status === 403) {
          throw new Error('Access Denied: Main Head Control Administrator role required.');
        }
        throw new Error(`Failed to load audit logs (HTTP ${logsRes.status})`);
      }

      const logsData = await logsRes.json();
      setLogs(logsData.logs || []);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with station database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, isAdmin]);

  const handleExportCsv = () => {
    window.open(`/api/admin/access-logs/export?token=${encodeURIComponent(token)}`, '_blank');
  };

  const handlePurgeStaleUsers = async () => {
    setPurging(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users/purge-stale', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to purge users.');
      }
      setFeedbackMessage({ text: data.message, type: 'success' });
      setShowPurgeModal(false);
      await fetchData();
      setTimeout(() => setFeedbackMessage(null), 6000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPurging(false);
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (email.toLowerCase().trim() === 'aseem323711@sahrdaya.ac.in') {
      alert('Cannot delete the Head Administrator account.');
      return;
    }
    if (!window.confirm(`Permanently delete account for "${email}" and revoke their session?`)) {
      return;
    }
    setDeletingEmail(email);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user.');
      }
      setFeedbackMessage({ text: data.message, type: 'success' });
      await fetchData();
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingEmail(null);
    }
  };

  const handleClearLogs = async () => {
    setPurging(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/access-logs/clear', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to clear access logs.');
      }
      setFeedbackMessage({ text: data.message, type: 'success' });
      setShowClearLogsModal(false);
      await fetchData();
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPurging(false);
    }
  };

  // If user is not an administrator, display strict Access Blocked shield
  if (!isAdmin) {
    return (
      <div className={`p-8 sm:p-12 rounded-2xl border text-center max-w-2xl mx-auto my-8 ${
        isDarkMode ? 'bg-[#0B111E] border-rose-900/50 text-slate-100' : 'bg-rose-50/70 border-rose-200 text-slate-900'
      }`}>
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 text-rose-500">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-mono font-bold uppercase tracking-wider mb-2">
          <span>Restricted Area</span>
          <span>•</span>
          <span>Head Control Only</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
          Access Blocked: Administrator Privileges Required
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
          This section contains enrolled user accounts, identity records, and login audit trails. It is strictly restricted to the main head control administrator and cannot be accessed by external agents or regular operators.
        </p>
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-left text-xs font-mono text-slate-300 max-w-sm mx-auto space-y-1">
          <div><span className="text-slate-500">Your Identity:</span> {session?.name || 'External User'}</div>
          <div><span className="text-slate-500">Your Role:</span> {session?.role || 'OBSERVER'}</div>
          <div><span className="text-slate-500">Access Status:</span> <span className="text-rose-400 font-bold">UNAUTHORIZED (HTTP 403)</span></div>
        </div>
      </div>
    );
  }

  // Calculate Statistics
  const totalLogins = logs.filter(l => l.eventType === 'SUCCESSFUL_LOGIN' || l.eventType === 'GOOGLE_AUTH_SUCCESS').length;
  const googleLogins = logs.filter(l => l.authMethod === 'GOOGLE').length;
  const passwordLogins = logs.filter(l => l.authMethod === 'PASSWORD').length;
  const failedAttempts = logs.filter(l => l.status === 'FAILED').length;

  // Filtered Logs
  const filteredLogs = logs.filter((l) => {
    if (filterType !== 'ALL' && l.eventType !== filterType) return false;
    if (authMethodFilter !== 'ALL' && l.authMethod !== authMethodFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.ipAddress.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'GOOGLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border bg-cyan-500/10 border-cyan-500/30 text-cyan-400">
            <Globe className="w-3 h-3 text-cyan-400" />
            <span>Sign in with Google</span>
          </span>
        );
      case 'PASSWORD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border bg-amber-500/10 border-amber-500/30 text-amber-400">
            <KeyRound className="w-3 h-3 text-amber-400" />
            <span>Email &amp; Password</span>
          </span>
        );
      case 'INSTITUTIONAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border bg-purple-500/10 border-purple-500/30 text-purple-400">
            <span>🏥 Institutional OTP</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border bg-slate-800 border-slate-700 text-slate-300">
            {method}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Title */}
      <div className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm shrink-0">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                ENROLLED USERS &amp; ACCESS AUDIT HISTORY
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                HEAD CONTROL • ADMIN ONLY
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Confidential personnel registry &amp; authentication verification log • Tracks user names, Google OAuth, password logins, and IP addresses.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => setShowPurgeModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold bg-rose-600/90 hover:bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-900/30 transition-all active:scale-95"
            title="Instantaneous clearance of all old user accounts and hanging sessions"
          >
            <UserX className="h-3.5 w-3.5" />
            <span>Clear Stale Users &amp; Sessions</span>
          </button>

          <button
            onClick={() => setShowClearLogsModal(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
              isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300' : 'bg-slate-50 border-slate-300 hover:bg-slate-100 text-slate-700'
            }`}
            title="Clear login audit stream history"
          >
            <FileX className="h-3.5 w-3.5 text-slate-400" />
            <span>Clear Logs</span>
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
              isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white border-sky-500 transition-all shadow-md shadow-sky-600/20 active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV Audit</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
          feedbackMessage.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-semibold">{feedbackMessage.text}</span>
          </div>
          <button 
            onClick={() => setFeedbackMessage(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Purge Confirmation Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`max-w-md w-full p-6 rounded-2xl border shadow-2xl ${
            isDarkMode ? 'bg-[#0D1424] border-rose-900/60 text-slate-100' : 'bg-white border-rose-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400">
                  ADMINISTRATIVE CLEARANCE
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  Purge Stale Users &amp; Hanging Sessions?
                </h3>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-400 mb-6">
              <p className="leading-relaxed">
                This action will <strong className="text-rose-400">instantaneously clear all old user accounts</strong>, stored email addresses, and passwords from the station database.
              </p>
              
              <ul className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span><strong>{users.filter(u => u.email.toLowerCase().trim() !== 'aseem323711@sahrdaya.ac.in').length}</strong> registered external user account(s) will be erased.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>All active tokens and hanging login sessions will be immediately invalidated.</span>
                </li>
                <li className="flex items-start gap-2 text-emerald-400">
                  <span>✓</span>
                  <span><strong>Head Administrator (aseem323711@sahrdaya.ac.in)</strong> is protected and will stay active.</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                disabled={purging}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurgeStaleUsers}
                disabled={purging}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 shadow-md shadow-rose-900/30 transition-all active:scale-95"
              >
                {purging ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Clearing Database...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Instant Clear All</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Logs Confirmation Modal */}
      {showClearLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`max-w-md w-full p-6 rounded-2xl border shadow-2xl ${
            isDarkMode ? 'bg-[#0D1424] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <FileX className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                  AUDIT LOG MAINTENANCE
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  Clear Login Audit History Stream?
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              This will remove all {logs.length} historical login audit records from persistent storage. A new log entry noting this reset will be recorded.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearLogsModal(false)}
                disabled={purging}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearLogs}
                disabled={purging}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white border border-amber-500 shadow-md shadow-amber-900/30 transition-all active:scale-95"
              >
                {purging ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Resetting Logs...</span>
                  </>
                ) : (
                  <>
                    <FileX className="w-3.5 h-3.5" />
                    <span>Clear Audit Stream</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold">Enrolled Users</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-sky-400">
            {users.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Registered station operators</div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold">Google Sign-In</span>
            <Globe className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-cyan-400">
            {googleLogins}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Verified OAuth 2.0 sessions</div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold">Email &amp; Password</span>
            <KeyRound className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400">
            {passwordLogins}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Station credential logins</div>
        </div>

        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold">Total Logins</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
            {totalLogins}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Total authenticated sessions</div>
        </div>
      </div>

      {/* Sub-Tabs: Login Stream vs Enrolled Users Directory */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('LOGINS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'LOGINS'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
              : isDarkMode
              ? 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Login History Stream ({logs.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('USERS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'USERS'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
              : isDarkMode
              ? 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Enrolled Users Directory ({users.length})</span>
        </button>
      </div>

      {/* Error Callout */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-start gap-3 text-xs">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <div className="font-bold">Audit Query Notice</div>
            <div className="mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* ================= VIEW 1: REAL-TIME LOGIN HISTORY STREAM ================= */}
      {activeSubTab === 'LOGINS' && (
        <div className={`p-4 sm:p-5 rounded-2xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-4">
            <div className="relative flex-1 w-full">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by full name, email, IP address, or details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs border transition ${
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200 focus:border-sky-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-sky-500'
                } outline-none`}
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={authMethodFilter}
                onChange={(e) => setAuthMethodFilter(e.target.value)}
                className={`text-xs px-3 py-2 rounded-xl border outline-none ${
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <option value="ALL">All Methods</option>
                <option value="GOOGLE">Sign in with Google</option>
                <option value="PASSWORD">Email &amp; Password</option>
                <option value="INSTITUTIONAL">Institutional OTP</option>
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className={`text-xs px-3 py-2 rounded-xl border outline-none ${
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <option value="ALL">All Events ({logs.length})</option>
                <option value="SUCCESSFUL_LOGIN">Successful Logins</option>
                <option value="GOOGLE_AUTH_SUCCESS">Google OAuth Success</option>
                <option value="FAILED_LOGIN">Failed Logins</option>
                <option value="LOGOUT">Session Logouts</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b font-mono font-bold text-[11px] text-slate-400 uppercase tracking-wider ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                }`}>
                  <th className="py-3 px-3">Date &amp; Time</th>
                  <th className="py-3 px-3">User Full Name</th>
                  <th className="py-3 px-3">Email Address</th>
                  <th className="py-3 px-3">Login Method</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Client IP Address</th>
                  <th className="py-3 px-3">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-sans">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500 font-mono text-xs">
                      {loading ? 'Retrieving audit events from station database...' : 'No login records match your filter criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isSuccess = log.status === 'SUCCESS';
                    return (
                      <tr key={log.id} className="hover:bg-slate-500/5 transition">
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          {log.timeString}
                        </td>
                        
                        {/* USER FULL NAME - Prominently Displayed */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-600 to-cyan-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-sm">
                              {log.name ? log.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <span className="font-bold text-slate-100 text-xs tracking-tight">
                              {log.name || 'Unknown Operator'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px] text-slate-300">
                          {log.email}
                        </td>

                        {/* Login Method Badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getMethodBadge(log.authMethod)}
                        </td>

                        {/* Role */}
                        <td className="py-3 px-3 font-mono text-[11px]">
                          <span className={`px-2 py-0.5 rounded border ${
                            log.role === 'ADMIN'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold'
                              : log.role === 'RESEARCHER'
                              ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}>
                            {log.role === 'ADMIN' ? '👑 ADMIN (Head Control)' : log.role}
                          </span>
                        </td>

                        {/* Result Status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                            isSuccess
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          }`}>
                            {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            <span>{isSuccess ? 'SUCCESS' : 'FAILED'}</span>
                          </span>
                        </td>

                        {/* Client IP Address */}
                        <td className="py-3 px-3 font-mono text-[11px] text-cyan-300 whitespace-nowrap">
                          {log.ipAddress}
                        </td>

                        {/* Details */}
                        <td className="py-3 px-3 text-[11px] text-slate-400 max-w-[260px] truncate" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= VIEW 2: ENROLLED USERS DIRECTORY ================= */}
      {activeSubTab === 'USERS' && (
        <div className={`p-4 sm:p-5 rounded-2xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold tracking-tight text-white">
                All Enrolled Biomedical Personnel &amp; External Users
              </h3>
              <p className="text-xs text-slate-400">
                Registered profiles authorized to sign in to the radar monitoring station.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400">
              Total Enrolled: <span className="font-bold text-sky-400">{users.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b font-mono font-bold text-[11px] text-slate-400 uppercase tracking-wider ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                }`}>
                  <th className="py-3 px-3">User Full Name</th>
                  <th className="py-3 px-3">Email Address</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Primary Sign-In Method</th>
                  <th className="py-3 px-3">Department / Unit</th>
                  <th className="py-3 px-3">Total Logins</th>
                  <th className="py-3 px-3">Last Login Date</th>
                  <th className="py-3 px-3">Account Status</th>
                  <th className="py-3 px-3 text-right">Account Clearance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-sans">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-500/5 transition">
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-100 text-xs">
                            {u.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID: {u.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-slate-300">
                      {u.email}
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px]">
                      <span className={`px-2 py-0.5 rounded border ${
                        u.role === 'ADMIN'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold'
                          : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                      }`}>
                        {u.role === 'ADMIN' ? '👑 ADMIN (Head Control)' : u.role}
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {getMethodBadge(u.authProvider)}
                    </td>

                    <td className="py-3 px-3 text-[11px] text-slate-300">
                      {u.department || 'Biomedical Telemetry'}
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-slate-200 font-bold">
                      {u.loginCount || 1}
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleString('en-GB') : 'Never'}
                    </td>

                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}>
                        {u.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {u.email.toLowerCase().trim() === 'aseem323711@sahrdaya.ac.in' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono border bg-amber-500/10 border-amber-500/30 text-amber-400">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Protected Head Admin</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleDeleteUser(u.email)}
                          disabled={deletingEmail === u.email}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 active:scale-95 transition"
                          title={`Permanently delete credentials for ${u.email}`}
                        >
                          <Trash2 className={`w-3 h-3 ${deletingEmail === u.email ? 'animate-spin' : ''}`} />
                          <span>{deletingEmail === u.email ? 'Purging...' : 'Delete User ID'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
