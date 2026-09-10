import React, { useState, useRef, useEffect } from 'react';
import { LogOut, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { NavigationRoute, UserSession } from '../types';

interface SidebarNavProps {
  activeRoute: NavigationRoute;
  onSelectRoute: (route: NavigationRoute) => void;
  isOpen: boolean;
  onClose: () => void;
  session: UserSession | null;
  onOpenAuth: () => void;
  onLogout?: () => void;
  isDarkMode: boolean;
  width?: number;
  onWidthChange?: (newWidth: number) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeRoute,
  onSelectRoute,
  isOpen,
  onClose,
  session,
  onOpenAuth,
  onLogout,
  isDarkMode,
  width = 260,
  onWidthChange,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartWidthRef = useRef<number>(width);

  const navItems: { route: NavigationRoute; label: string; icon: string; badge?: string }[] = [
    { route: 'DASHBOARD', label: 'Dashboard Overview', icon: '📊' },
    { route: 'LIVE_MONITORING', label: 'Live Monitoring', icon: '📈', badge: 'LIVE' },
    { route: 'CAMERA_RPPG', label: 'Camera rPPG & Vitals', icon: '🫀', badge: 'rPPG' },
    { route: 'DATASET_WORKSPACE', label: 'Offline Dataset Workspace', icon: '📁', badge: 'OFFLINE' },
    { route: 'RESPIRATORY_SIGNAL', label: 'Respiratory DSP Signal', icon: '〰️' },
    { route: 'CAMERA', label: 'ESP32 Camera Feed', icon: '📷' },
    { route: 'ILLUMINATION', label: 'Camera Illumination', icon: '💡' },
    { route: 'PANTILT', label: 'Pan-Tilt Control', icon: '🎮' },
    { route: 'COMBINED_VIEW', label: 'Combined Camera & Pan-Tilt', icon: '🎯' },
    { route: 'EVENT_MONITOR', label: 'Event Log & Alarms', icon: '⚠️' },
    { route: 'DATA_SESSION', label: 'Data & Session CSV', icon: '💾' },
    { route: 'SYSTEM_STATUS', label: 'System Diagnostics', icon: '⚡' },
    { route: 'PRIVACY_SECURITY', label: 'Privacy & Security', icon: '🔒' },
    { route: 'SETTINGS', label: 'System Settings', icon: '⚙️' },
    { route: 'HELP_SUPPORT', label: 'Help & Customer Service', icon: '🎧', badge: 'SUPPORT' }
  ];

  const adminItems: { route: NavigationRoute; label: string; icon: string; badge?: string }[] = [
    { route: 'ADMIN_USERS', label: 'User Directory & Roles', icon: '👥', badge: 'ADMIN' },
    { route: 'ADMIN_LOGS', label: 'Enrolled Users & Logins', icon: '🛡️', badge: 'HEAD CONTROL' }
  ];

  const isHeadAdminEmail = session?.email?.toLowerCase().trim() === 'aseem323711@sahrdaya.ac.in';
  const isAdmin = session?.role === 'ADMIN' || isHeadAdminEmail;
  const isObserver = !isAdmin && session?.role === 'OBSERVER';

  // Filter items for Observer: Common people view basic functionality and UI design
  const displayedNavItems = isObserver
    ? navItems.filter((item) =>
        ['DASHBOARD', 'CAMERA_RPPG', 'DATASET_WORKSPACE', 'CAMERA', 'SYSTEM_STATUS', 'PRIVACY_SECURITY', 'HELP_SUPPORT'].includes(item.route)
      )
    : navItems;

  // Draggable Mouse Events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isCollapsed) return; // Expand before dragging
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - dragStartXRef.current;
      const targetWidth = Math.max(200, Math.min(480, dragStartWidthRef.current + deltaX));
      if (onWidthChange) {
        onWidthChange(targetWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const currentWidth = isCollapsed ? 68 : width;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        style={{
          width: `${currentWidth}px`
        }}
        className={`fixed z-30 transition-[transform,width] duration-150 border-r flex flex-col justify-between select-none ${
          /* On desktop, starts cleanly below the 60px header so it NEVER covers the main heading */
          'top-0 bottom-0 left-0 lg:top-[60px]'
        } ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          isDarkMode
            ? 'bg-[#0B1120] border-slate-800 text-slate-200'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Header Branding / Collapsed Header */}
        <div>
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold shadow-md shadow-sky-600/30 shrink-0">
                24G
              </div>
              {!isCollapsed && (
                <div className="truncate">
                  <div className="text-xs font-bold uppercase tracking-wider text-sky-500 truncate">
                    Radar Telemetry
                  </div>
                  <div className="text-sm font-semibold tracking-tight leading-none truncate">
                    Vitals Monitor
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            >
              ✕
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-220px)]">
            {isObserver && !isCollapsed && (
              <div className="mb-2 p-2 rounded-lg bg-sky-950/40 border border-sky-800/40 text-[10px] text-sky-300 flex items-center justify-between">
                <span>👁️ Observer Preview</span>
                <span className="text-[9px] bg-sky-500/20 text-sky-200 px-1 py-0.5 rounded font-mono">READ-ONLY</span>
              </div>
            )}
            {displayedNavItems.map((item) => {
              const isActive = activeRoute === item.route;
              return (
                <button
                  key={item.route}
                  onClick={() => {
                    onSelectRoute(item.route);
                    onClose();
                  }}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center rounded-lg text-xs font-medium transition-all ${
                    isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                  } ${
                    isActive
                      ? isDarkMode
                        ? 'bg-sky-600 text-white font-semibold shadow-sm'
                        : 'bg-sky-50 text-sky-700 border border-sky-200 font-semibold shadow-sm'
                      : isDarkMode
                      ? 'hover:bg-slate-800/80 text-slate-300'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-base shrink-0">{item.icon}</span>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!isCollapsed && item.badge && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Administrator / Head Control Section */}
            {isAdmin && (
              <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800">
                {!isCollapsed && (
                  <div className="px-3 pb-1.5 text-[10px] font-mono font-bold tracking-wider uppercase text-amber-400 flex items-center justify-between">
                    <span>Head Control</span>
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40">
                      ADMIN ONLY
                    </span>
                  </div>
                )}
                {adminItems.map((item) => {
                  const isActive = activeRoute === item.route;
                  return (
                    <button
                      key={item.route}
                      onClick={() => {
                        onSelectRoute(item.route);
                        onClose();
                      }}
                      title={isCollapsed ? item.label : undefined}
                      className={`w-full flex items-center rounded-lg text-xs font-medium transition-all ${
                        isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                      } ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-semibold shadow-sm'
                          : isDarkMode
                          ? 'hover:bg-slate-800/80 text-slate-300'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-base shrink-0">{item.icon}</span>
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </div>
                      {!isCollapsed && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        {/* User Session & Auth footer */}
        <div className={`p-3 border-t ${isDarkMode ? 'border-slate-800 bg-[#070D18]' : 'border-slate-100 bg-slate-50/70'}`}>
          <div
            onClick={onOpenAuth}
            className={`flex items-center rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800/80 cursor-pointer transition-colors ${
              isCollapsed ? 'justify-center p-1.5' : 'justify-between p-2'
            }`}
            title="Click to view session credentials or lock session"
          >
            <div className="flex items-center gap-2 truncate">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                {session?.tier === 'INSTITUTIONAL' ? 'H' : 'U'}
              </div>
              {!isCollapsed && (
                <div className="truncate text-left">
                  <div className="text-xs font-semibold truncate leading-tight">
                    {session?.name || 'Local Operator'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                    {session?.role || 'OPERATOR'} • {session?.tier === 'INSTITUTIONAL' ? 'Inst.' : 'Personal'}
                  </div>
                </div>
              )}
            </div>

            {!isCollapsed && <span className="text-xs text-slate-400">🔒</span>}
          </div>

          {/* Dedicated Log Out Session Button */}
          {onLogout && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLogout();
              }}
              className={`w-full mt-2 flex items-center justify-center rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/60 transition-all shadow-sm active:scale-[0.98] ${
                isCollapsed ? 'p-2' : 'gap-2 px-3 py-1.5'
              }`}
              title="Log out and return to authentication screen"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsed && <span>Log Out Session</span>}
            </button>
          )}

          {!isCollapsed && (
            <div className="mt-2 text-[9px] text-center text-slate-400 font-mono">
              24 GHz FMCW • Biomedical Lab v2.0
            </div>
          )}
        </div>

        {/* =========================================================================
            DRAGGABLE RESIZER HANDLE & COLLAPSE TOGGLE (Desktop Only)
            ========================================================================= */}
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={() => onWidthChange && onWidthChange(260)}
          className={`hidden lg:flex absolute top-0 bottom-0 -right-1.5 w-3 cursor-col-resize group z-50 items-center justify-center transition-all ${
            isDragging ? 'bg-sky-500/30' : 'hover:bg-sky-500/20'
          }`}
          title="Drag horizontally to resize sidebar width • Double click to reset to 260px"
        >
          {/* Subtle grab bar indicator */}
          <div className={`w-1 rounded-full transition-all flex items-center justify-center ${
            isDragging
              ? 'h-16 bg-sky-500 shadow-[0_0_8px_#0284c7]'
              : 'h-8 bg-slate-400/40 group-hover:h-12 group-hover:bg-sky-400'
          }`}>
            <GripVertical className="h-3 w-3 text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </div>
        </div>

        {/* Quick Collapse / Expand Toggle Button on Handle */}
        {onToggleCollapse && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className={`hidden lg:flex absolute -right-3 top-14 w-6 h-6 rounded-full border shadow-md items-center justify-center z-50 transition-all ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title={isCollapsed ? "Expand Sidebar (Full Width)" : "Collapse Sidebar (Icon Rail)"}
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        )}
      </aside>
    </>
  );
};
