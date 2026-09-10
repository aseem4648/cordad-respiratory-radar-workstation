import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Send, 
  Trash2, 
  Check, 
  LifeBuoy, 
  Sparkles, 
  RefreshCw,
  Headphones,
  CheckCircle
} from 'lucide-react';
import { SupportTicket, TicketCategory, TicketPriority, TicketStatus, UserSession } from '../../types';
import { apiService } from '../../services/apiService';

interface HelpSupportViewProps {
  session: UserSession | null;
  isDarkMode: boolean;
}

export const HelpSupportView: React.FC<HelpSupportViewProps> = ({ session, isDarkMode }) => {
  const isAdmin = session?.role === 'ADMIN';

  // Ticket Data States
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [analytics, setAnalytics] = useState<{
    total: number;
    pending: number;
    inReview: number;
    resolved: number;
    resolutionRate: number;
  }>({ total: 0, pending: 0, inReview: 0, resolved: 0, resolutionRate: 0 });
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Ticket for Admin Resolution Inspection
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [resolutionText, setResolutionText] = useState<string>('');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState<boolean>(false);

  // New Ticket Form State (Customer / End User)
  const [newCategory, setNewCategory] = useState<TicketCategory>('FEEDBACK_SUGGESTION');
  const [newPriority, setNewPriority] = useState<TicketPriority>('MEDIUM');
  const [newSubject, setNewSubject] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState<boolean>(false);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const res = await apiService.getSupportTickets(session?.token, session?.email);
      if (res && res.tickets) {
        setTickets(res.tickets);
      }
      if (isAdmin) {
        const stats = await apiService.getSupportAnalytics(session?.token);
        if (stats) setAnalytics(stats);
      }
    } catch (e) {
      console.error('Error fetching support tickets:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [session?.token]);

  // Handle Customer Form Submission
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newDescription.trim()) return;

    setIsSubmittingTicket(true);
    try {
      const res = await apiService.createSupportTicket({
        customerName: session?.name || 'Customer / Clinician',
        customerEmail: session?.email || 'clinician@hospital.org',
        role: session?.role || 'OPERATOR',
        category: newCategory,
        priority: newPriority,
        subject: newSubject.trim(),
        description: newDescription.trim()
      });

      if (res && res.success) {
        setSubmitSuccess(true);
        setNewSubject('');
        setNewDescription('');
        fetchTickets();
        setTimeout(() => setSubmitSuccess(false), 4000);
      }
    } catch (err) {
      console.error('Failed to submit ticket:', err);
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  // Handle Admin Resolution
  const handleResolveTicket = async (ticketId: string) => {
    if (!resolutionText.trim()) return;
    setIsSubmittingResolution(true);
    try {
      const res = await apiService.resolveSupportTicket(
        ticketId, 
        resolutionText.trim(), 
        session?.name || 'Administrator', 
        session?.token
      );
      if (res && res.success) {
        setResolutionText('');
        setSelectedTicket(null);
        fetchTickets();
      }
    } catch (err) {
      console.error('Failed to resolve ticket:', err);
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  const handleUpdateStatus = async (ticketId: string, status: TicketStatus) => {
    try {
      await apiService.updateTicketStatus(ticketId, status, session?.token);
      fetchTickets();
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('Are you sure you want to permanently delete this customer inquiry?')) return;
    try {
      await apiService.deleteSupportTicket(ticketId, session?.token);
      if (selectedTicket?.id === ticketId) setSelectedTicket(null);
      fetchTickets();
    } catch (err) {
      console.error('Failed to delete ticket:', err);
    }
  };

  // Filtering Logic
  const filteredTickets = tickets.filter(t => {
    const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;
    const matchesCategory = filterCategory === 'ALL' || t.category === filterCategory;
    const matchesSearch = searchQuery === '' || 
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const getPriorityBadge = (p: TicketPriority) => {
    switch (p) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-sky-500/15 text-sky-400 border border-sky-500/30">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-500/15 text-slate-400 border border-slate-500/30">LOW</span>;
    }
  };

  const getStatusBadge = (s: TicketStatus) => {
    switch (s) {
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            RESOLVED
          </span>
        );
      case 'IN_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3 animate-spin" />
            IN REVIEW
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <AlertCircle className="w-3 h-3" />
            PENDING
          </span>
        );
    }
  };

  const getCategoryLabel = (c: TicketCategory) => {
    switch (c) {
      case 'CAMERA_HARDWARE': return 'ESP32-CAM Hardware';
      case 'RADAR_LINK': return '24 GHz Radar Sensing';
      case 'TELEMETRY_ACCURACY': return 'Telemetry & DSP Accuracy';
      case 'SOFTWARE_UI': return 'Dashboard Interface / UX';
      case 'FEEDBACK_SUGGESTION': return 'Feature Suggestion / Feedback';
      default: return 'General Inquiry';
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* Header Banner */}
      <div className={`p-5 rounded-2xl border transition-all ${
        isDarkMode 
          ? 'bg-gradient-to-r from-[#0F172A] via-[#131D33] to-[#0F172A] border-slate-800' 
          : 'bg-gradient-to-r from-white via-sky-50 to-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl border ${
              isDarkMode 
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' 
                : 'bg-sky-100 text-sky-700 border-sky-200'
            }`}>
              <Headphones className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  Customer Service &amp; Help Desk
                </h1>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                  isAdmin 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                }`}>
                  {isAdmin ? 'ADMIN QUERY ANALYSIS & RESOLUTION' : 'CLIENT FEEDBACK PORTAL'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAdmin 
                  ? 'Analyze incoming customer questions, hardware reports, and clinical suggestions to resolve inquiries with verified solutions.' 
                  : 'Submit questions regarding ESP32-CAM optical aiming, 24 GHz radar link, or feedback directly to hospital administration.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTickets}
              className={`p-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                isDarkMode 
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
              title="Refresh Inquiries List"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= ADMIN QUERY ANALYSIS KPI DASHBOARD ================= */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className={`p-4 rounded-xl border ${
            isDarkMode ? 'bg-[#0E1526] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Total Customer Queries</span>
            <div className="text-2xl font-black font-mono mt-1 text-sky-400">{analytics.total}</div>
            <span className="text-[11px] text-slate-500">Received to date</span>
          </div>

          <div className={`p-4 rounded-xl border ${
            isDarkMode ? 'bg-[#0E1526] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <span className="text-[10px] font-mono uppercase font-bold text-amber-400">Pending Analysis</span>
            <div className="text-2xl font-black font-mono mt-1 text-amber-400">{analytics.pending}</div>
            <span className="text-[11px] text-slate-500">Awaiting review</span>
          </div>

          <div className={`p-4 rounded-xl border ${
            isDarkMode ? 'bg-[#0E1526] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <span className="text-[10px] font-mono uppercase font-bold text-cyan-400">Under Investigation</span>
            <div className="text-2xl font-black font-mono mt-1 text-cyan-400">{analytics.inReview}</div>
            <span className="text-[11px] text-slate-500">Being investigated</span>
          </div>

          <div className={`p-4 rounded-xl border ${
            isDarkMode ? 'bg-[#0E1526] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <span className="text-[10px] font-mono uppercase font-bold text-emerald-400">Resolved Confidently</span>
            <div className="text-2xl font-black font-mono mt-1 text-emerald-400">{analytics.resolved}</div>
            <span className="text-[11px] text-slate-500">Closed with solutions</span>
          </div>

          <div className={`p-4 rounded-xl border col-span-2 sm:col-span-1 ${
            isDarkMode ? 'bg-[#0E1526] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <span className="text-[10px] font-mono uppercase font-bold text-purple-400">Resolution Rate</span>
            <div className="text-2xl font-black font-mono mt-1 text-purple-400">{analytics.resolutionRate}%</div>
            <span className="text-[11px] text-slate-500">Efficiency score</span>
          </div>
        </div>
      )}

      {/* ================= MAIN CONTENT SPLIT ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* LEFT 2 COLS: CUSTOMER TICKETS ANALYSIS & LIST */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Filters Bar */}
          <div className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
            isDarkMode ? 'bg-[#0E1526] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search inquiries, customers, keywords..."
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:border-sky-500 font-sans ${
                  isDarkMode 
                    ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-800 placeholder:text-slate-400'
                }`}
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none ${
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-700'
                }`}
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="RESOLVED">Resolved</option>
              </select>

              {/* Category filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none ${
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-700'
                }`}
              >
                <option value="ALL">All Categories</option>
                <option value="CAMERA_HARDWARE">ESP32-CAM Hardware</option>
                <option value="RADAR_LINK">24 GHz Radar Sensing</option>
                <option value="TELEMETRY_ACCURACY">Telemetry Accuracy</option>
                <option value="SOFTWARE_UI">Dashboard Interface</option>
                <option value="FEEDBACK_SUGGESTION">Feedback / Suggestions</option>
              </select>
            </div>
          </div>

          {/* Tickets List */}
          <div className="space-y-3">
            {filteredTickets.length === 0 ? (
              <div className={`p-10 rounded-2xl border text-center space-y-3 ${
                isDarkMode ? 'bg-[#0E1526] border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500 shadow-sm'
              }`}>
                <HelpCircle className="h-10 w-10 mx-auto text-slate-500 opacity-40" />
                <div className="text-sm font-bold">No customer queries found</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchQuery || filterStatus !== 'ALL' || filterCategory !== 'ALL'
                    ? 'Try adjusting your search criteria or category filter.'
                    : 'No customer support queries have been registered yet.'}
                </p>
              </div>
            ) : (
              filteredTickets.map((t) => (
                <div
                  key={t.id}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    selectedTicket?.id === t.id
                      ? 'border-sky-500 bg-sky-500/5 shadow-md ring-1 ring-sky-500/20'
                      : isDarkMode
                        ? 'bg-[#0E1526] border-slate-800 hover:border-slate-700'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                  onClick={() => {
                    setSelectedTicket(t);
                    setResolutionText(t.adminResolution || '');
                  }}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono font-bold text-xs text-sky-400">{t.id}</span>
                        {getPriorityBadge(t.priority)}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {getCategoryLabel(t.category)}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-100 tracking-tight">
                        {t.subject}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusBadge(t.status)}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {t.description}
                  </p>

                  {/* Customer Meta & Admin Resolution Snippet */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-300">{t.customerName}</span>
                      <span>&bull;</span>
                      <span className="font-mono text-[10px]">{t.customerEmail}</span>
                    </div>

                    <div className="font-mono text-[10px]">
                      {new Date(t.createdAt).toLocaleDateString()} at {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* If Resolved, Show Resolution Box */}
                  {t.adminResolution && (
                    <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-400 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Official Administrator Resolution ({t.resolvedBy || 'Admin'}):</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                        {t.adminResolution}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT 1 COL: ADMIN RESOLUTION CONSOLE OR CUSTOMER SUBMISSION FORM */}
        <div className="space-y-4">
          
          {/* ================= ADMIN RESOLUTION CONSOLE ================= */}
          {isAdmin ? (
            <div className={`p-5 rounded-2xl border sticky top-20 ${
              isDarkMode ? 'bg-[#0E1526] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <h2 className="text-sm font-extrabold uppercase tracking-tight flex items-center gap-2 text-white mb-1">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Admin Resolution Command</span>
              </h2>
              <p className="text-[11px] text-slate-400 mb-4">
                {selectedTicket 
                  ? `Analyzing inquiry #${selectedTicket.id}` 
                  : 'Select an inquiry from the list to analyze and resolve.'}
              </p>

              {selectedTicket ? (
                <div className="space-y-3.5">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                    <div className="font-bold text-slate-200 mb-0.5">{selectedTicket.subject}</div>
                    <div className="text-[11px] text-slate-400 mb-2 font-mono">
                      From: {selectedTicket.customerName} ({selectedTicket.customerEmail})
                    </div>
                    <div className="text-[11px] text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800 leading-relaxed">
                      {selectedTicket.description}
                    </div>
                  </div>

                  {/* Status Action Buttons */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Mark Status:</span>
                    <button
                      onClick={() => handleUpdateStatus(selectedTicket.id, 'PENDING')}
                      className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                        selectedTicket.status === 'PENDING'
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedTicket.id, 'IN_REVIEW')}
                      className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                        selectedTicket.status === 'IN_REVIEW'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      In Review
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedTicket.id, 'RESOLVED')}
                      className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                        selectedTicket.status === 'RESOLVED'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      Resolved
                    </button>
                  </div>

                  {/* Resolution Input Box */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1.5">
                      Official Resolution / Solution Explanation:
                    </label>
                    <textarea
                      rows={4}
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="Type technical diagnosis, resolution steps taken, or calibration advice for the customer..."
                      className="w-full p-2.5 text-xs rounded-xl border bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 font-sans"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleResolveTicket(selectedTicket.id)}
                      disabled={isSubmittingResolution || !resolutionText.trim()}
                      className="flex-1 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSubmittingResolution ? 'Saving...' : 'Resolve & Dispatch Solution'}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteTicket(selectedTicket.id)}
                      className="p-2 rounded-xl text-xs bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition"
                      title="Delete Ticket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500 space-y-2">
                  <MessageSquare className="w-8 h-8 mx-auto opacity-30" />
                  <div>Click on any customer ticket on the left to analyze its telemetry details and submit a verified resolution.</div>
                </div>
              )}
            </div>
          ) : (
            
            /* ================= CUSTOMER FEEDBACK & INQUIRY FORM ================= */
            <div className={`p-5 rounded-2xl border sticky top-20 ${
              isDarkMode ? 'bg-[#0E1526] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <h2 className="text-sm font-extrabold uppercase tracking-tight flex items-center gap-2 text-white mb-1">
                <Send className="w-4 h-4 text-sky-400" />
                <span>Submit Clinical Inquiry</span>
              </h2>
              <p className="text-[11px] text-slate-400 mb-4">
                Directly notify biomedical system administrators regarding any equipment anomalies, software suggestions, or clinical queries.
              </p>

              {submitSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Inquiry submitted successfully! An administrator will review and resolve it promptly.</span>
                </div>
              )}

              <form onSubmit={handleSubmitTicket} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Inquiry Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as TicketCategory)}
                    className="w-full p-2 text-xs rounded-lg border bg-slate-900 border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="FEEDBACK_SUGGESTION">Clinical Feature Suggestion / Feedback</option>
                    <option value="CAMERA_HARDWARE">ESP32-CAM Optical Sensor Issue</option>
                    <option value="RADAR_LINK">24 GHz Radar Telemetry Question</option>
                    <option value="TELEMETRY_ACCURACY">DSP / Respiratory Rate Accuracy</option>
                    <option value="SOFTWARE_UI">Dashboard Display / UX Inquiry</option>
                    <option value="GENERAL_QUERY">General Protocol Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Urgency Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TicketPriority)}
                    className="w-full p-2 text-xs rounded-lg border bg-slate-900 border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="LOW">Low (General Question / Feedback)</option>
                    <option value="MEDIUM">Medium (Standard Clinical Inconvenience)</option>
                    <option value="HIGH">High (Impacts Ward Monitoring)</option>
                    <option value="CRITICAL">Critical (Immediate Sensor / System Block)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Subject</label>
                  <input
                    type="text"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="e.g. Thorax alignment reticle positioning suggestion"
                    required
                    className="w-full p-2 text-xs rounded-lg border bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 font-sans"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Detailed Description</label>
                  <textarea
                    rows={4}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Describe what you observed, your equipment setup, or specific improvement suggestion..."
                    required
                    className="w-full p-2 text-xs rounded-lg border bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 font-sans"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingTicket || !newSubject.trim() || !newDescription.trim()}
                  className="w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white transition-all shadow-md shadow-sky-600/20 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingTicket ? 'Submitting...' : 'Submit Inquiry to Administrators'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Clinical Quick FAQ Card */}
          <div className={`p-4 rounded-xl border text-xs space-y-2 ${
            isDarkMode ? 'bg-[#0A0F1D] border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="font-bold text-slate-300 flex items-center gap-1.5">
              <LifeBuoy className="w-3.5 h-3.5 text-sky-400" />
              <span>Quick Technical Guidance</span>
            </div>
            <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc pl-4">
              <li><b>ESP32-CAM Stream:</b> Default stream runs on Port 81 (<code>http://&lt;IP&gt;:81/stream</code>).</li>
              <li><b>Illumination Safe Cap:</b> Hard limited to +85% PWM duty to avoid camera thermal noise.</li>
              <li><b>Patient Detection Indicator:</b> The top green LED glows when optical tracking confirms subject in ROI.</li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
};
