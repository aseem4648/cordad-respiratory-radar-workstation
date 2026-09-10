import React, { useState } from 'react';
import { ShieldAlert, Trash2, CheckCircle2, RefreshCw, X, AlertTriangle, KeyRound, Users, ShieldCheck } from 'lucide-react';
import { UserSession } from '../types';

interface AdminClearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: UserSession | null;
  onClearanceComplete?: () => void;
}

export const AdminClearanceModal: React.FC<AdminClearanceModalProps> = ({
  isOpen,
  onClose,
  session,
  onClearanceComplete
}) => {
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    purgedCount?: number;
    invalidatedSessions?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAdmin = session?.role === 'ADMIN' || session?.email === 'aseem323711@sahrdaya.ac.in';

  const handleInstantClearance = async () => {
    setIsPurging(true);
    setError(null);
    setResult(null);

    try {
      const token = session?.token;
      const res = await fetch('/api/admin/users/purge-stale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Purge failed on server');
      }

      setResult({
        success: true,
        message: data.message || 'Instant clearance executed successfully.',
        purgedCount: data.purgedCount ?? 0,
        invalidatedSessions: data.invalidatedSessions ?? 0
      });

      if (onClearanceComplete) {
        onClearanceComplete();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to complete instant user clearance');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Instant User &amp; Session Clearance
              </h2>
              <p className="text-xs text-slate-400">
                Administrator Session &amp; Token Purge Control
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {!isAdmin ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <span className="font-semibold block mb-1">Administrative Privilege Required</span>
                Only the designated system administrator (<code className="bg-rose-900/40 px-1 py-0.5 rounded font-mono">aseem323711@sahrdaya.ac.in</code>) has permission to purge workstation user records and hanging credentials.
              </div>
            </div>
          ) : (
            <>
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 text-xs text-slate-300 space-y-2">
                <p className="font-medium text-slate-200">
                  This administrative operation will immediately:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 ml-1">
                  <li>Purge all stale and non-admin registered user accounts</li>
                  <li>Revoke and invalidate hanging JWT session tokens</li>
                  <li>Prevent workstation and dashboard freezing during multiple logins</li>
                  <li>
                    <strong className="text-emerald-400">Preserve</strong> the primary admin account (<code className="font-mono text-emerald-300">aseem323711@sahrdaya.ac.in</code>) and your current active session
                  </li>
                </ul>
              </div>

              {/* Status Display */}
              {result && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-start gap-3 animate-in fade-in">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">{result.message}</p>
                    <div className="flex items-center gap-4 text-[11px] text-emerald-400/90 font-mono mt-1">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> Purged Accounts: <strong>{result.purgedCount}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <KeyRound className="h-3.5 w-3.5" /> Terminated Sessions: <strong>{result.invalidatedSessions}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-600/50 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
            <span>Target: aseem323711@sahrdaya.ac.in</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              disabled={isPurging}
              className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium transition"
            >
              Close
            </button>

            {isAdmin && (
              <button
                onClick={handleInstantClearance}
                disabled={isPurging}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold text-xs transition shadow-lg shadow-rose-900/30 disabled:opacity-50 cursor-pointer"
              >
                {isPurging ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Purging Stale Sessions...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Instant User Clearance</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
