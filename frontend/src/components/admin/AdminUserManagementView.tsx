import React, { useState, useEffect } from 'react';
import { Users, Shield, UserCheck, UserX, AlertTriangle, RefreshCw, Search, CheckCircle2, Hospital, Trash2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { UserRecord, UserRole, UserSession } from '../../types';

interface AdminUserManagementViewProps {
  token: string;
  session?: UserSession | null;
  isDarkMode: boolean;
}

export const AdminUserManagementView: React.FC<AdminUserManagementViewProps> = ({
  token,
  session,
  isDarkMode
}) => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);
  const [purging, setPurging] = useState<boolean>(false);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);

  const isHeadAdminEmail = session?.email?.toLowerCase().trim() === 'aseem323711@sahrdaya.ac.in';
  const isAdmin = session?.role === 'ADMIN' || isHeadAdminEmail;

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access Denied: Administrator role required to view registered users.');
        }
        throw new Error(`Failed to load users (Status ${res.status})`);
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching users');
    } finally {
      setLoading(false);
    }
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
        throw new Error(data.error || 'Failed to purge users');
      }
      setActionSuccess(data.message);
      setShowPurgeModal(false);
      await fetchUsers();
      setTimeout(() => setActionSuccess(null), 6000);
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
      setActionSuccess(data.message);
      await fetchUsers();
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingEmail(null);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleToggleStatus = async (user: UserRecord) => {
    const newStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      const res = await fetch('/api/admin/users/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: user.email, status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user status');
      }
      setUsers(data.users);
      setActionSuccess(`User ${user.email} marked as ${newStatus}`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChangeRole = async (user: UserRecord, newRole: UserRole) => {
    try {
      const res = await fetch('/api/admin/users/role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: user.email, role: newRole })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user role');
      }
      setUsers(data.users);
      setActionSuccess(`Updated ${user.email} role to ${newRole}`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const adminCount = users.filter(u => u.role === 'ADMIN').length;
  const activeCount = users.filter(u => u.status === 'ACTIVE').length;
  const instCount = users.filter(u => u.tier === 'INSTITUTIONAL').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-600/10 text-sky-500 border border-sky-600/20">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight">
              BIOMEDICAL STATION USER MANAGEMENT
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Station Administrator Access • Role-Based Privileges • Persistent Account Directory
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => setShowPurgeModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-bold bg-rose-600/90 hover:bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-900/30 transition active:scale-95"
            title="Instantaneous clearance of all old user accounts and hanging sessions"
          >
            <UserX className="h-3.5 w-3.5" />
            <span>Clear Stale User IDs &amp; Sessions</span>
          </button>

          <button
            onClick={fetchUsers}
            disabled={loading}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
              isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Directory</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono font-bold uppercase text-slate-400">TOTAL OPERATORS</div>
          <div className="text-2xl font-bold font-mono text-sky-500 my-0.5">{users.length}</div>
          <div className="text-[11px] text-slate-500">Registered Accounts</div>
        </div>
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono font-bold uppercase text-slate-400">ACTIVE STATUS</div>
          <div className="text-2xl font-bold font-mono text-emerald-500 my-0.5">{activeCount}</div>
          <div className="text-[11px] text-slate-500">Authorized Sessions</div>
        </div>
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono font-bold uppercase text-slate-400">ADMINISTRATORS</div>
          <div className="text-2xl font-bold font-mono text-amber-500 my-0.5">{adminCount}</div>
          <div className="text-[11px] text-slate-500">Full Privileges</div>
        </div>
        <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-[10px] font-mono font-bold uppercase text-slate-400">INSTITUTIONAL</div>
          <div className="text-2xl font-bold font-mono text-indigo-400 my-0.5">{instCount}</div>
          <div className="text-[11px] text-slate-500">Hospital / ICU Tier</div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-start gap-3 text-xs">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <div className="font-bold">Access Verification Error</div>
            <div className="mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="h-4 w-4" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter / Search Input */}
      <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-[#0D1424] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search operators by name, email, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 rounded-lg text-xs border transition ${
                isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200 focus:border-sky-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-sky-500'
              } outline-none`}
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`border-b font-mono font-bold text-[11px] text-slate-400 uppercase tracking-wider ${
                isDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <th className="py-2.5 px-3">Operator Name</th>
                <th className="py-2.5 px-3">Email Address</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Tier</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3 text-center">Logins</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    No operators match your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className={`hover:bg-slate-500/5 transition ${u.status === 'DISABLED' ? 'opacity-60' : ''}`}>
                    <td className="py-3 px-3 font-semibold text-slate-200">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div>{u.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            ID: {u.id.substring(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {u.email}
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeRole(u, e.target.value as UserRole)}
                        className={`text-[11px] font-mono font-bold px-2 py-1 rounded border outline-none ${
                          u.role === 'ADMIN'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : u.role === 'RESEARCHER'
                            ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="RESEARCHER">RESEARCHER</option>
                        <option value="OPERATOR">OPERATOR</option>
                        <option value="OBSERVER">OBSERVER</option>
                      </select>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      <span className={`px-2 py-0.5 rounded border ${
                        u.tier === 'INSTITUTIONAL'
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}>
                        {u.tier}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-400 max-w-[180px] truncate">
                      {u.department || 'Clinical Telemetry'}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-slate-300">
                      {u.loginCount}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {u.email.toLowerCase().trim() === 'aseem323711@sahrdaya.ac.in' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold font-mono border bg-amber-500/10 border-amber-500/30 text-amber-400">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Protected Head Admin</span>
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition ${
                              u.status === 'ACTIVE'
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                          >
                            {u.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.email)}
                            disabled={deletingEmail === u.email}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 active:scale-95 transition"
                            title={`Permanently delete credentials for ${u.email}`}
                          >
                            <Trash2 className={`w-3 h-3 ${deletingEmail === u.email ? 'animate-spin' : ''}`} />
                            <span>{deletingEmail === u.email ? 'Purging...' : 'Delete'}</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
    </div>
  );
};
