import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SidebarNav } from './components/SidebarNav';
import { SystemStatusBar } from './components/SystemStatusBar';
import { LiveWaveformChart } from './components/LiveWaveformChart';
import { RespiratoryRateCard } from './components/RespiratoryRateCard';
import { BreathingStatusCard } from './components/BreathingStatusCard';
import { SignalQualityCard } from './components/SignalQualityCard';
import { TargetDistanceCard } from './components/TargetDistanceCard';
import { RespiratoryTrendChart } from './components/RespiratoryTrendChart';
import { EventMonitorTimeline } from './components/EventMonitorTimeline';
import { RadarTelemetryPanel } from './components/RadarTelemetryPanel';
import { RawDataConsole } from './components/RawDataConsole';
import { RecordingControls } from './components/RecordingControls';
import { SettingsModal } from './components/SettingsModal';
import { MedicalDisclaimer } from './components/MedicalDisclaimer';

// Advanced interactive views
import { PanTiltControl } from './components/PanTiltControl';
import { CameraSection } from './components/CameraSection';
import { CombinedView } from './components/CombinedView';
import { RespiratorySignalView } from './components/RespiratorySignalView';
import { SystemStatusView } from './components/SystemStatusView';
import { PrivacySecurityView } from './components/PrivacySecurityView';
import { CameraIlluminationControl } from './components/CameraIlluminationControl';
import { AdminUserManagementView } from './components/admin/AdminUserManagementView';
import { AdminAccessLogView } from './components/admin/AdminAccessLogView';
import { OfflineDatasetWorkspace } from './components/workspace/OfflineDatasetWorkspace';
import { HelpSupportView } from './components/support/HelpSupportView';

// Redesigned Authentication & Intro Architecture
import { OpeningIntro } from './components/auth/OpeningIntro';
import { LoginPage } from './components/auth/LoginPage';
import { AuthModal } from './components/AuthModal';
import { AdminClearanceModal } from './components/AdminClearanceModal';

// Strict Data Provenance & Dataset Analysis Components
import { DataSourceBanner, DataSourceMode } from './components/DataSourceBanner';
import { DatasetUploadModal } from './components/DatasetUploadModal';
import { DatasetValidationReport } from './utils/datasetParser';

import { wsService } from './services/websocketService';
import { apiService } from './services/apiService';
import { soundAlerts } from './utils/soundAlerts';
import {
  StandardRadarPacket,
  RadarTelemetry,
  MonitoringEvent,
  SystemSettings,
  WaveformPoint,
  TrendPoint,
  RecordingStatus,
  NavigationRoute,
  PanTiltState,
  CameraConfig,
  UserSession,
  IlluminationState
} from './types';

export const App: React.FC = () => {
  // Opening Intro Sequence state
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    return !sessionStorage.getItem('bme_radar_intro_seen');
  });

  // =========================================================================
  // CRITICAL AUTHENTICATION SECURITY: Default is strictly unauthenticated
  // A user who opens the dashboard unauthenticated is gated by LoginPage.
  // =========================================================================
  const [session, setSession] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('bme_radar_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.isAuthenticated) return parsed;
      } catch {}
    }
    return null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isClearanceModalOpen, setIsClearanceModalOpen] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [activeRoute, setActiveRoute] = useState<NavigationRoute>('DASHBOARD');

  // Draggable / Resizable Sidebar Width state (Persisted in localStorage)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('bme_sidebar_width');
    return saved ? Math.max(200, Math.min(480, parseInt(saved, 10))) : 260;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('bme_sidebar_collapsed') === 'true';
  });

  // Screen size tracking for desktop layout offsets
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSidebarWidthChange = (newWidth: number) => {
    setSidebarWidth(newWidth);
    localStorage.setItem('bme_sidebar_width', String(newWidth));
  };

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('bme_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleToggleSidebar = () => {
    if (isDesktop) {
      handleToggleSidebarCollapse();
    } else {
      setIsSidebarOpen((prev) => !prev);
    }
  };

  const contentLeftOffset = isDesktop ? (isSidebarCollapsed ? 68 : sidebarWidth) : 0;

  // Strict Data Provenance State (Defaults strictly to NONE)
  const [dataSource, setDataSource] = useState<DataSourceMode>('NONE');
  const [datasetReport, setDatasetReport] = useState<DatasetValidationReport | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);

  // Telemetry & connection
  const [telemetry, setTelemetry] = useState<RadarTelemetry | null>(null);
  const [wsStatus, setWsStatus] = useState<string>('DISCONNECTED');
  const [isStreamPaused, setIsStreamPaused] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Vitals buffers
  const [lastPacket, setLastPacket] = useState<StandardRadarPacket | null>(null);
  const [waveformBuffer, setWaveformBuffer] = useState<WaveformPoint[]>([]);
  const [trendBuffer, setTrendBuffer] = useState<TrendPoint[]>([]);
  const [events, setEvents] = useState<MonitoringEvent[]>([]);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus | null>(null);
  const [selectedWindowSec, setSelectedWindowSec] = useState<number>(30);

  // Offline dataset playback index
  const [datasetPlaybackIdx, setDatasetPlaybackIdx] = useState<number>(0);

  // Pan-Tilt & Camera state
  const [panTilt, setPanTilt] = useState<PanTiltState | null>({
    pan: 0,
    tilt: 0,
    stepSize: 5,
    mode: 'MANUAL',
    status: 'IDLE',
    lastCommand: 'READY',
    lastCommandTime: Date.now(),
    hardwareConnected: true
  });

  const [illumination, setIllumination] = useState<IlluminationState | null>({
    connected: true,
    controlLevel: 0,
    pwmDutyCycle: 128,
    mode: 'MANUAL',
    autoAvailable: false,
    maxSafetyLimit: 85,
    status: 'APPLIED',
    type: 'IR_850NM_ILLUMINATION',
    lastCommand: 'READY',
    lastAckTime: Date.now()
  });

  const [camera, setCamera] = useState<CameraConfig | null>({
    streamUrl: 'http://172.20.10.6:81/stream',
    hardwareIp: '172.20.10.6',
    enabled: false,
    measuredFps: 0,
    status: 'CONNECTED'
  });

  // ESP32-CAM Visual Patient Detection State (defaults to false until camera connects & senses subject)
  const [patientDetected, setPatientDetected] = useState<boolean>(() => {
    const saved = localStorage.getItem('cordad_patient_detected');
    return saved !== null ? saved === 'true' : false;
  });

  const handleTogglePatientDetected = () => {
    setPatientDetected((prev) => {
      const next = !prev;
      localStorage.setItem('cordad_patient_detected', String(next));
      return next;
    });
  };

  const [settings, setSettings] = useState<SystemSettings>({
    webSocketUrl: '',
    samplingRateHz: 20,
    waveformWindowSeconds: 30,
    apneaThresholdSeconds: 10,
    filterLowCutHz: 0.10,
    filterHighCutHz: 0.70,
    signalQualityThreshold: 35,
    reconnectIntervalMs: 2000,
    soundAlertsEnabled: false,
    tachypneaThresholdBpm: 25,
    bradypneaThresholdBpm: 10
  });

  // Connect WebSocket only when session is authenticated
  useEffect(() => {
    if (!session || !session.isAuthenticated) return;

    wsService.connect();

    const unsubStatus = wsService.onStatusChange((status) => {
      setWsStatus(status);
    });

    const unsubMsg = wsService.subscribe((data) => {
      if (data.type === 'SYSTEM_INIT') {
        if (data.settings) setSettings(data.settings);
        if (data.recordingStatus) setRecordingStatus(data.recordingStatus as any);
        if (data.panTilt) setPanTilt(data.panTilt);
        if (data.camera) setCamera(data.camera);

        if (data.mode === 'LIVE_RADAR' && data.hardwareConnected) {
          setDataSource('LIVE_HARDWARE');
        } else {
          setDataSource('NONE');
          setWaveformBuffer([]);
          setLastPacket(null);
        }
      } else if (data.type === 'RADAR_SAMPLE' && data.packet) {
        if (data.telemetry?.mode === 'LIVE_RADAR' || !data.packet.isDemo) {
          setDataSource('LIVE_HARDWARE');
          const pkt = data.packet;
          setLastPacket(pkt);
          if (data.telemetry) setTelemetry(data.telemetry);

          setWaveformBuffer((prev) => {
            const pt: WaveformPoint = {
              time: pkt.timestamp,
              timeLabel: pkt.isoTimestamp,
              rawSignal: pkt.signal,
              filteredSignal: pkt.filteredSignal
            };
            const next = [...prev, pt];
            return next.length > 2400 ? next.slice(next.length - 2400) : next;
          });

          if (pkt.packetIndex % 20 === 0) {
            setTrendBuffer((prev) => {
              const trPt: TrendPoint = {
                time: pkt.timestamp,
                timeLabel: pkt.isoTimestamp,
                respiratoryRate: pkt.respiratoryRate,
                signalQuality: pkt.signalQuality
              };
              const next = [...prev, trPt];
              return next.length > 3600 ? next.slice(next.length - 3600) : next;
            });
          }
        }
      } else if (data.type === 'HARDWARE_STATUS_CHANGED') {
        if (data.status === 'RADAR_DISCONNECTED') {
          setDataSource('NONE');
          setLastPacket(null);
        }
      } else if (data.type === 'EVENT_ALERT' && data.event && dataSource !== 'NONE') {
        setEvents((prev) => [data.event!, ...prev.slice(0, 200)]);
        if (data.event.severity === 'critical') {
          soundAlerts.playApneaAlarm();
        } else if (data.event.severity === 'warning') {
          soundAlerts.playWarningChime();
        }
      } else if (data.type === 'PANTILT_UPDATED' && data.panTilt) {
        setPanTilt(data.panTilt);
      } else if (data.type === 'OPTICAL_PATIENT_DETECTION') {
        const detected = Boolean(data.patientDetected);
        setPatientDetected(detected);
        setCamera((prev) => prev ? {
          ...prev,
          patientDetected: detected,
          detectionConfidence: data.confidence
        } : prev);
      } else if (data.type === 'CAMERA_CONFIG_UPDATED' && data.camera) {
        setCamera(data.camera);
        if (data.camera.patientDetected !== undefined) {
          setPatientDetected(Boolean(data.camera.patientDetected));
        }
      } else if (data.type === 'CAMERA_STATUS_CHANGED' && data.camera) {
        setCamera(data.camera);
        if (data.camera.patientDetected !== undefined) {
          setPatientDetected(Boolean(data.camera.patientDetected));
        }
      } else if (data.type === 'ILLUMINATION_UPDATED' && data.illumination) {
        setIllumination(data.illumination);
      } else if (data.type === 'AUTH_SESSION_UPDATED' && data.session) {
        setSession(data.session);
        if (data.session.isAuthenticated) {
          localStorage.setItem('bme_radar_session', JSON.stringify(data.session));
        } else {
          localStorage.removeItem('bme_radar_session');
        }
      }
    });

    return () => {
      unsubStatus();
      unsubMsg();
      wsService.disconnect();
    };
  }, [session?.isAuthenticated]);

  // Offline Dataset Playback loop
  useEffect(() => {
    if (dataSource !== 'OFFLINE_DATASET' || !datasetReport || datasetReport.parsedSamples.length === 0) {
      return;
    }

    const intervalMs = Math.round(1000 / (datasetReport.estimatedSamplingRateHz || 20));
    const timer = setInterval(() => {
      setDatasetPlaybackIdx((prev) => {
        const nextIdx = (prev + 1) % datasetReport.parsedSamples.length;
        const s = datasetReport.parsedSamples[nextIdx];
        if (s) {
          const now = Date.now();
          const pt: WaveformPoint = {
            time: now,
            timeLabel: new Date(now).toLocaleTimeString('en-GB'),
            rawSignal: s.rawSignal,
            filteredSignal: s.filteredSignal
          };
          setWaveformBuffer((buf) => {
            const nextBuf = [...buf, pt];
            return nextBuf.length > 2400 ? nextBuf.slice(nextBuf.length - 2400) : nextBuf;
          });

          setLastPacket({
            packetIndex: nextIdx,
            timestamp: now,
            isoTimestamp: new Date(now).toISOString(),
            signal: s.rawSignal,
            filteredSignal: s.filteredSignal,
            respiratoryRate: s.respiratoryRate,
            rrSource: s.respiratoryRate ? 'CALCULATED_RADAR_DSP' : 'UNAVAILABLE',
            signalQuality: s.signalQuality,
            event: s.filteredSignal !== null ? 'NORMAL_BREATHING' : 'INSUFFICIENT_SIGNAL',
            eventDurationSeconds: 0,
            targetDistance: s.targetDistance,
            presence: s.presence,
            isDemo: false
          });
        }
        return nextIdx;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [dataSource, datasetReport]);

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    localStorage.setItem('bme_radar_session', JSON.stringify(newSession));
  };

  const handleLogout = async () => {
    await apiService.logout();
    setSession(null);
    localStorage.removeItem('bme_radar_session');
    setDataSource('NONE');
    setWaveformBuffer([]);
    setLastPacket(null);
    wsService.disconnect();
  };

  const handleFinishIntro = () => {
    setShowIntro(false);
    sessionStorage.setItem('bme_radar_intro_seen', 'true');
  };

  const handleReplayIntro = () => {
    setShowIntro(true);
  };

  const handleLoadDataset = (report: DatasetValidationReport) => {
    setDatasetReport(report);
    setDataSource('OFFLINE_DATASET');
    setActiveRoute('DATASET_WORKSPACE');
    setWaveformBuffer([]);
    setDatasetPlaybackIdx(0);

    const now = Date.now();
    const initialPts: WaveformPoint[] = report.parsedSamples.slice(0, 400).map((s, idx) => ({
      time: now - (400 - idx) * 50,
      timeLabel: new Date(now - (400 - idx) * 50).toLocaleTimeString('en-GB'),
      rawSignal: s.rawSignal,
      filteredSignal: s.filteredSignal
    }));
    setWaveformBuffer(initialPts);

    const first = report.parsedSamples[0];
    if (first) {
      setLastPacket({
        packetIndex: 0,
        timestamp: now,
        isoTimestamp: new Date(now).toISOString(),
        signal: first.rawSignal,
        filteredSignal: first.filteredSignal,
        respiratoryRate: first.respiratoryRate,
        rrSource: first.respiratoryRate ? 'CALCULATED_RADAR_DSP' : 'UNAVAILABLE',
        signalQuality: first.signalQuality,
        event: 'NORMAL_BREATHING',
        eventDurationSeconds: 0,
        targetDistance: first.targetDistance,
        presence: first.presence,
        isDemo: false
      });
    }
  };

  const handleClearDataset = () => {
    setDatasetReport(null);
    setDataSource('NONE');
    setWaveformBuffer([]);
    setLastPacket(null);
    setEvents([]);
  };

  const handleTogglePause = () => {
    const next = !isStreamPaused;
    setIsStreamPaused(next);
    wsService.send({ type: 'PAUSE_STREAM', paused: next });
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundAlerts.setEnabled(next);
  };

  const handleStartRecording = async () => {
    const res = await apiService.startRecording();
    if (res.status) setRecordingStatus(res.status);
  };

  const handleStopRecording = async () => {
    const res = await apiService.stopRecording();
    if (res.status) setRecordingStatus(res.status);
  };

  const handleClearRecording = async () => {
    const res = await apiService.clearRecording();
    if (res.status) setRecordingStatus(res.status);
  };

  const handleClearEvents = async () => {
    await apiService.clearEvents();
    setEvents([]);
  };

  const handleSaveSettings = (newSettings: SystemSettings) => {
    setSettings(newSettings);
    wsService.send({ type: 'UPDATE_SETTINGS', settings: newSettings });
  };

  const isConnected = dataSource === 'LIVE_HARDWARE' || dataSource === 'OFFLINE_DATASET';

  const routeTitles: Record<NavigationRoute, string> = {
    DASHBOARD: 'Overview Station',
    LIVE_MONITORING: 'Live Vitals & Scope',
    DATASET_WORKSPACE: 'Offline Dataset Analysis Workspace',
    RESPIRATORY_SIGNAL: 'DSP Analysis & Filter Bank',
    CAMERA: 'ESP32 Alignment Viewport',
    ILLUMINATION: 'Camera Illumination Control',
    PANTILT: 'Tactile Gimbal Steering',
    COMBINED_VIEW: 'Aiming & Waveform HUD',
    EVENT_MONITOR: 'Apnea & Distress Log',
    DATA_SESSION: 'Recording & CSV Telemetry',
    SYSTEM_STATUS: 'System Diagnostics',
    PRIVACY_SECURITY: 'Privacy & Security Guard',
    ADMIN_USERS: 'User Directory & Roles (Head Control)',
    ADMIN_LOGS: 'Enrolled Users & Login History (Head Control)',
    HELP_SUPPORT: 'Help & Customer Service Support Desk',
    SETTINGS: 'Station Parameters'
  };

  useEffect(() => {
    if (session?.isAuthenticated) {
      apiService.getIllumination().then(res => {
        if (res) setIllumination(res);
      }).catch(() => {});

      apiService.getCameraStatus().then(cam => {
        if (cam) {
          setCamera({
            streamUrl: cam.streamUrl || 'http://172.20.10.6:81/stream',
            hardwareIp: cam.hardwareIp || '172.20.10.6',
            sensor: cam.sensor,
            enabled: cam.isStreaming,
            measuredFps: cam.measuredFps,
            totalFramesReceived: cam.totalFramesReceived,
            lastFrameTime: cam.lastFrameTime,
            isStreaming: cam.isStreaming,
            errorMessage: cam.errorMessage,
            status: cam.state
          });
        }
      }).catch(() => {});
    }
  }, [session?.isAuthenticated]);

  const handleSetIllumination = async (level: number) => {
    // Optimistic instant state update for 0ms visual lag
    setIllumination(prev => prev ? {
      ...prev,
      controlLevel: level,
      pwmDutyCycle: Math.round(((level + 100) / 200) * 255),
      isOn: level > -100,
      status: 'APPLIED',
      lastCommand: `SET_ILLUMINATION_${level > 0 ? '+' : ''}${level}%`
    } : null);

    try {
      const res = await apiService.setIllumination(level);
      if (res && res.state) setIllumination(res.state);
    } catch {}
  };

  const handleToggleIllumination = async (forceState?: boolean) => {
    // Optimistic toggle
    setIllumination(prev => {
      if (!prev) return null;
      const willBeOn = forceState !== undefined ? forceState : !prev.isOn;
      const targetLevel = willBeOn ? (prev.controlLevel <= -100 ? 0 : prev.controlLevel) : -100;
      return {
        ...prev,
        isOn: willBeOn,
        controlLevel: targetLevel,
        pwmDutyCycle: Math.round(((targetLevel + 100) / 200) * 255),
        status: 'APPLIED',
        lastCommand: willBeOn ? 'MANUAL_LED_ON' : 'MANUAL_LED_OFF'
      };
    });

    try {
      const res = await apiService.toggleIllumination(forceState);
      if (res && res.state) setIllumination(res.state);
    } catch {}
  };

  const handleFlashFull = async () => {
    // Optimistic full flash
    setIllumination(prev => prev ? {
      ...prev,
      isOn: true,
      controlLevel: prev.maxSafetyLimit,
      pwmDutyCycle: Math.round(((prev.maxSafetyLimit + 100) / 200) * 255),
      status: 'LIMIT_REACHED',
      lastCommand: 'MANUAL_FLASH_MAX_SAFE'
    } : null);

    try {
      const res = await apiService.flashFullIllumination();
      if (res && res.state) setIllumination(res.state);
    } catch {}
  };

  const handleResetIllumination = async () => {
    setIllumination(prev => prev ? {
      ...prev,
      isOn: true,
      controlLevel: 0,
      pwmDutyCycle: 128,
      status: 'APPLIED',
      lastCommand: 'RESET_TO_NOMINAL_0%'
    } : null);

    try {
      const res = await apiService.resetIllumination();
      if (res && res.state) setIllumination(res.state);
    } catch {}
  };

  // =========================================================================
  // AUTHENTICATION GUARD: If opening intro is playing, show OpeningIntro
  // =========================================================================
  if (showIntro) {
    return <OpeningIntro onFinish={handleFinishIntro} />;
  }

  // =========================================================================
  // AUTHENTICATION GUARD: If not authenticated, strictly show LoginPage
  // Dashboard, telemetry, and camera are inaccessible until real login.
  // =========================================================================
  if (!session || !session.isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // =========================================================================
  // AUTHENTICATED WORKSTATION DASHBOARD
  // =========================================================================

  return (
    <div className={`min-h-screen flex flex-col justify-between transition-colors ${isDarkMode ? 'bg-[#080C14] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'}`}>
      
      {/* Main Top Header */}
      <Header
        telemetry={telemetry}
        lastPacket={lastPacket}
        wsStatus={wsStatus}
        isDemo={dataSource === 'OFFLINE_DATASET' || dataSource === 'DEV_SIMULATION'}
        isStreamPaused={isStreamPaused}
        settings={settings}
        soundEnabled={soundEnabled}
        isDarkMode={isDarkMode}
        session={session}
        activeRouteLabel={routeTitles[activeRoute]}
        camera={camera}
        patientDetected={patientDetected}
        onTogglePatientDetected={handleTogglePatientDetected}
        onToggleSidebar={handleToggleSidebar}
        onNavigateRoute={(route) => setActiveRoute(route)}
        onReplayIntro={handleReplayIntro}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenClearanceModal={() => setIsClearanceModalOpen(true)}
        onLogout={handleLogout}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onToggleSound={handleToggleSound}
        onTogglePause={handleTogglePause}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSwitchMode={() => {}}
      />

      {/* Sidebar Navigation — Draggable, Resizable & Collapsible */}
      <SidebarNav
        activeRoute={activeRoute}
        onSelectRoute={(r) => {
          if (r === 'SETTINGS') setIsSettingsOpen(true);
          else setActiveRoute(r);
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        session={session}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        isDarkMode={isDarkMode}
        width={sidebarWidth}
        onWidthChange={handleSidebarWidthChange}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      {/* Compact Real-Time Status Bar: Smooth offset matching draggable sidebar */}
      <div
        style={{ paddingLeft: `${contentLeftOffset}px` }}
        className="transition-[padding] duration-150 w-full"
      >
        <SystemStatusBar
          telemetry={telemetry}
          wsStatus={wsStatus}
          isDemo={dataSource === 'OFFLINE_DATASET'}
          sqi={lastPacket?.signalQuality ?? null}
          isRecording={recordingStatus?.isRecording || false}
          isDarkMode={isDarkMode}
        />
      </div>

      {/* Main Content Area: Responsive with Draggable Sidebar Offset on Desktop */}
      <main
        style={{ paddingLeft: `${contentLeftOffset}px` }}
        className="flex-1 max-w-[1700px] w-full mx-auto p-3 sm:p-5 space-y-4 sm:space-y-5 transition-[padding] duration-150"
      >
        
        {/* ================= ROUTE 1: DASHBOARD (Full Overview) ================= */}
        {activeRoute === 'DASHBOARD' && (
          <>
            <DataSourceBanner
              dataSource={dataSource}
              datasetReport={datasetReport}
              onOpenUpload={() => setIsUploadModalOpen(true)}
              onClearDataset={handleClearDataset}
              onViewReport={() => setIsUploadModalOpen(true)}
              onOpenWorkspace={() => setActiveRoute('DATASET_WORKSPACE')}
              isDarkMode={isDarkMode}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <RespiratoryRateCard
                respiratoryRate={dataSource !== 'NONE' ? (lastPacket?.respiratoryRate ?? null) : null}
                isValid={dataSource !== 'NONE' && lastPacket?.respiratoryRate !== null}
                isDarkMode={isDarkMode}
              />
              <BreathingStatusCard
                eventState={dataSource !== 'NONE' ? (lastPacket?.event ?? 'WAITING_FOR_DATA') : 'WAITING_FOR_DATA'}
                durationSeconds={dataSource !== 'NONE' ? (lastPacket?.eventDurationSeconds ?? 0) : 0}
                isDarkMode={isDarkMode}
              />
              <SignalQualityCard
                signalQuality={dataSource !== 'NONE' ? (lastPacket?.signalQuality ?? null) : null}
                isDarkMode={isDarkMode}
              />
              <TargetDistanceCard
                presence={dataSource !== 'NONE' ? (lastPacket?.presence ?? null) : null}
                targetDistance={dataSource !== 'NONE' ? (lastPacket?.targetDistance ?? null) : null}
                isDarkMode={isDarkMode}
              />
            </div>

            <div className="w-full">
              <LiveWaveformChart
                waveformBuffer={waveformBuffer}
                isConnected={isConnected}
                isStreamPaused={isStreamPaused}
                selectedWindowSec={selectedWindowSec}
                onSelectWindowSec={setSelectedWindowSec}
                dataSource={dataSource}
                sourceLabel={datasetReport?.fileName}
                isDarkMode={isDarkMode}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RespiratoryTrendChart trendBuffer={trendBuffer} isDarkMode={isDarkMode} />
              <EventMonitorTimeline events={events} onClearEvents={handleClearEvents} isDarkMode={isDarkMode} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <RadarTelemetryPanel
                telemetry={telemetry}
                samplingRate={datasetReport?.estimatedSamplingRateHz || settings.samplingRateHz}
                isDarkMode={isDarkMode}
              />
              <RecordingControls
                status={recordingStatus}
                onStart={handleStartRecording}
                onStop={handleStopRecording}
                onClear={handleClearRecording}
                exportCsvUrl={apiService.getExportCsvUrl()}
                isDarkMode={isDarkMode}
              />
              <RawDataConsole lastPacket={lastPacket} isDarkMode={isDarkMode} />
            </div>
          </>
        )}

        {/* ================= ROUTE 2: LIVE MONITORING ================= */}
        {activeRoute === 'LIVE_MONITORING' && (
          <>
            <DataSourceBanner
              dataSource={dataSource}
              datasetReport={datasetReport}
              onOpenUpload={() => setIsUploadModalOpen(true)}
              onClearDataset={handleClearDataset}
              onViewReport={() => setIsUploadModalOpen(true)}
              onOpenWorkspace={() => setActiveRoute('DATASET_WORKSPACE')}
              isDarkMode={isDarkMode}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <RespiratoryRateCard
                respiratoryRate={dataSource !== 'NONE' ? (lastPacket?.respiratoryRate ?? null) : null}
                isValid={dataSource !== 'NONE' && lastPacket?.respiratoryRate !== null}
                isDarkMode={isDarkMode}
              />
              <BreathingStatusCard
                eventState={dataSource !== 'NONE' ? (lastPacket?.event ?? 'WAITING_FOR_DATA') : 'WAITING_FOR_DATA'}
                durationSeconds={dataSource !== 'NONE' ? (lastPacket?.eventDurationSeconds ?? 0) : 0}
                isDarkMode={isDarkMode}
              />
              <SignalQualityCard
                signalQuality={dataSource !== 'NONE' ? (lastPacket?.signalQuality ?? null) : null}
                isDarkMode={isDarkMode}
              />
              <TargetDistanceCard
                presence={dataSource !== 'NONE' ? (lastPacket?.presence ?? null) : null}
                targetDistance={dataSource !== 'NONE' ? (lastPacket?.targetDistance ?? null) : null}
                isDarkMode={isDarkMode}
              />
            </div>

            <div className="w-full">
              <LiveWaveformChart
                waveformBuffer={waveformBuffer}
                isConnected={isConnected}
                isStreamPaused={isStreamPaused}
                selectedWindowSec={selectedWindowSec}
                onSelectWindowSec={setSelectedWindowSec}
                dataSource={dataSource}
                sourceLabel={datasetReport?.fileName}
                isDarkMode={isDarkMode}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RadarTelemetryPanel
                telemetry={telemetry}
                samplingRate={datasetReport?.estimatedSamplingRateHz || settings.samplingRateHz}
                isDarkMode={isDarkMode}
              />
              <RecordingControls
                status={recordingStatus}
                onStart={handleStartRecording}
                onStop={handleStopRecording}
                onClear={handleClearRecording}
                exportCsvUrl={apiService.getExportCsvUrl()}
                isDarkMode={isDarkMode}
              />
            </div>
          </>
        )}

        {/* ================= ROUTE: OFFLINE DATASET WORKSPACE ================= */}
        {activeRoute === 'DATASET_WORKSPACE' && (
          <OfflineDatasetWorkspace
            report={datasetReport}
            onLoadDataset={handleLoadDataset}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
            onClearDataset={handleClearDataset}
            isDarkMode={isDarkMode}
          />
        )}

        {/* ================= ROUTE 3: RESPIRATORY SIGNAL (DSP) ================= */}
        {activeRoute === 'RESPIRATORY_SIGNAL' && (
          <RespiratorySignalView
            waveformBuffer={waveformBuffer}
            lastPacket={lastPacket}
            isDarkMode={isDarkMode}
          />
        )}

        {/* ================= ROUTE: ILLUMINATION ================= */}
        {activeRoute === 'ILLUMINATION' && (
          <div className="space-y-4">
            <CameraIlluminationControl
              illumination={illumination}
              onSetIntensity={handleSetIllumination}
              onResetToDefault={handleResetIllumination}
              onToggleLed={handleToggleIllumination}
              onFlashFull={handleFlashFull}
              isDarkMode={isDarkMode}
              cameraConnected={camera?.status !== 'DISCONNECTED'}
            />
          </div>
        )}


        {/* ================= ROUTE 4: CAMERA ================= */}
        {activeRoute === 'CAMERA' && (
          <div className="space-y-4">
            <CameraSection
              camera={camera}
              onUpdateCamera={setCamera}
              isDarkMode={isDarkMode}
              session={session}
            />
            <CameraIlluminationControl
              illumination={illumination}
              onSetIntensity={handleSetIllumination}
              onResetToDefault={handleResetIllumination}
              onToggleLed={handleToggleIllumination}
              onFlashFull={handleFlashFull}
              isDarkMode={isDarkMode}
              cameraConnected={camera?.status !== 'DISCONNECTED'}
            />
          </div>
        )}

        {/* ================= ROUTE 5: PAN-TILT CONTROL ================= */}
        {activeRoute === 'PANTILT' && (
          <PanTiltControl
            panTilt={panTilt}
            onUpdate={setPanTilt}
            isDarkMode={isDarkMode}
          />
        )}

        {/* ================= ROUTE 6: COMBINED VIEW ================= */}
        {activeRoute === 'COMBINED_VIEW' && (
          <CombinedView
            camera={camera}
            onUpdateCamera={setCamera}
            panTilt={panTilt}
            onUpdatePanTilt={setPanTilt}
            waveformBuffer={waveformBuffer}
            isConnected={isConnected}
            isDarkMode={isDarkMode}
            session={session}
          />
        )}

        {/* ================= ROUTE 7: EVENT MONITOR ================= */}
        {activeRoute === 'EVENT_MONITOR' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <BreathingStatusCard
                eventState={dataSource !== 'NONE' ? (lastPacket?.event ?? 'WAITING_FOR_DATA') : 'WAITING_FOR_DATA'}
                durationSeconds={dataSource !== 'NONE' ? (lastPacket?.eventDurationSeconds ?? 0) : 0}
                isDarkMode={isDarkMode}
              />
              <RespiratoryRateCard
                respiratoryRate={dataSource !== 'NONE' ? (lastPacket?.respiratoryRate ?? null) : null}
                isValid={dataSource !== 'NONE' && lastPacket?.respiratoryRate !== null}
                isDarkMode={isDarkMode}
              />
            </div>
            <EventMonitorTimeline events={events} onClearEvents={handleClearEvents} isDarkMode={isDarkMode} />
          </div>
        )}

        {/* ================= ROUTE 8: DATA & SESSION ================= */}
        {activeRoute === 'DATA_SESSION' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RecordingControls
                status={recordingStatus}
                onStart={handleStartRecording}
                onStop={handleStopRecording}
                onClear={handleClearRecording}
                exportCsvUrl={apiService.getExportCsvUrl()}
                isDarkMode={isDarkMode}
              />
              <RadarTelemetryPanel
                telemetry={telemetry}
                samplingRate={datasetReport?.estimatedSamplingRateHz || settings.samplingRateHz}
                isDarkMode={isDarkMode}
              />
            </div>
            <RawDataConsole lastPacket={lastPacket} isDarkMode={isDarkMode} />
          </div>
        )}

        {/* ================= ROUTE 9: SYSTEM STATUS ================= */}
        {activeRoute === 'SYSTEM_STATUS' && (
          <SystemStatusView
            telemetry={telemetry}
            wsStatus={wsStatus}
            panTilt={panTilt}
            camera={camera}
            session={session}
            isDarkMode={isDarkMode}
          />
        )}

        {/* ================= ROUTE 10: PRIVACY & SECURITY ================= */}
        {activeRoute === 'PRIVACY_SECURITY' && (
          <PrivacySecurityView
            session={session}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onLogout={handleLogout}
            isDarkMode={isDarkMode}
          />
        )}

        {/* ================= ROUTE 11: USER DIRECTORY & ROLES (HEAD CONTROL) ================= */}
        {activeRoute === 'ADMIN_USERS' && (
          <AdminUserManagementView
            token={session?.token || ''}
            session={session}
            isDarkMode={isDarkMode}
          />
        )}

        {/* ================= ROUTE 12: ENROLLED USERS & LOGIN AUDIT (HEAD CONTROL ADMIN ONLY) ================= */}
        {activeRoute === 'ADMIN_LOGS' && (
          <AdminAccessLogView
            token={session?.token || ''}
            session={session}
            isDarkMode={isDarkMode}
          />
        )}

        {/* ================= ROUTE 13: CUSTOMER SERVICE & HELP DESK ================= */}
        {activeRoute === 'HELP_SUPPORT' && (
          <HelpSupportView
            session={session}
            isDarkMode={isDarkMode}
          />
        )}
      </main>

      {/* Dataset Upload Modal */}
      <DatasetUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onLoadDataset={handleLoadDataset}
        isDarkMode={isDarkMode}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        isDarkMode={isDarkMode}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        isDarkMode={isDarkMode}
      />

      {/* Admin Instant Clearance Modal */}
      <AdminClearanceModal
        isOpen={isClearanceModalOpen}
        onClose={() => setIsClearanceModalOpen(false)}
        session={session}
      />

      <MedicalDisclaimer isDarkMode={isDarkMode} />
    </div>
  );
};
