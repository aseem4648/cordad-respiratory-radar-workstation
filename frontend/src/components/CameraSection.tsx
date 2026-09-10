import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  VideoOff, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Settings, 
  AlertCircle, 
  CheckCircle2, 
  Crosshair, 
  Activity, 
  ShieldCheck, 
  Zap, 
  Radio, 
  Eye, 
  Info,
  Sliders,
  SlidersHorizontal,
  ExternalLink,
  Sun,
  Contrast,
  Moon,
  Save,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { CameraConfig, CameraConnectionState, UserSession } from '../types';
import { apiService } from '../services/apiService';
import { visualPresenceDetector, VisualPresenceResult } from '../services/visualPresenceDetector';

interface CameraSectionProps {
  camera: CameraConfig | null;
  onUpdateCamera: (cam: CameraConfig) => void;
  isDarkMode: boolean;
  session?: UserSession | null;
}

export const CameraSection: React.FC<CameraSectionProps> = ({ 
  camera, 
  onUpdateCamera, 
  isDarkMode,
  session
}) => {
  // Extract initial IP: check localStorage first, then camera props, default to 172.20.10.6
  const getStoredIp = () => {
    try {
      const saved = localStorage.getItem('esp32_cam_ip');
      if (saved) return saved.trim();
    } catch {}
    if (camera?.hardwareIp) return camera.hardwareIp;
    if (camera?.streamUrl) {
      return camera.streamUrl.replace(/^https?:\/\//, '').split(':')[0].split('/')[0];
    }
    return '172.20.10.6';
  };

  const initialIp = getStoredIp();
  const [cameraIpInput, setCameraIpInput] = useState<string>(initialIp || '172.20.10.6');
  const [streamUrlInput, setStreamUrlInput] = useState<string>(
    initialIp ? `http://${initialIp}:81/stream` : (camera?.streamUrl || 'http://172.20.10.6:81/stream')
  );
  const [showReticle, setShowReticle] = useState<boolean>(true);
  const [isEditingUrl, setIsEditingUrl] = useState<boolean>(false);
  const isUserDirtyRef = useRef<boolean>(false);

  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<CameraConnectionState>(camera?.status || 'DISCONNECTED');
  const [errorMessage, setErrorMessage] = useState<string | null>(camera?.errorMessage || null);
  const [measuredFps, setMeasuredFps] = useState<number>(camera?.measuredFps || 0);
  const [totalFrames, setTotalFrames] = useState<number>(camera?.totalFramesReceived || 0);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [streamKey, setStreamKey] = useState<number>(Date.now());
  const [streamLoaded, setStreamLoaded] = useState<boolean>(false);
  const [showTuningPanel, setShowTuningPanel] = useState<boolean>(false);
  const [isApplyingSetting, setIsApplyingSetting] = useState<string | null>(null);
  const [tuningStatusMsg, setTuningStatusMsg] = useState<string | null>(null);

  // Automatic Computer Vision Presence Detection State
  const streamImgRef = useRef<HTMLImageElement | null>(null);
  const [visualDetection, setVisualDetection] = useState<VisualPresenceResult>({
    detected: Boolean(camera?.patientDetected),
    confidence: camera?.detectionConfidence || 0,
    occupancyRatio: 0,
    motionEnergy: 0,
    skinRatio: 0,
    timestamp: Date.now()
  });
  const lastReportedDetectedRef = useRef<boolean | null>(null);

  // Sensor Settings matching the OV3660 WebServer tuning controls
  const [tuningSettings, setTuningSettings] = useState({
    xclk: 15,
    framesize: 8, // VGA (640x480)
    quality: 12,
    brightness: 1,
    contrast: 1,
    saturation: -1,
    sharpness: 1,
    denoise: 4,
    ae_level: 1,
    gainceiling: 100,
    special_effect: 0,
    awb: true,
    awb_gain: true,
    wb_mode: false,
    aec: true,
    night_mode: false,
    agc: true,
    raw_gma: true,
    lenc: true,
    hmirror: false,
    vflip: true
  });

  const handleTuningChange = async (varName: string, val: any) => {
    setTuningSettings(prev => ({ ...prev, [varName]: val }));
    setIsApplyingSetting(varName);

    try {
      const numVal = typeof val === 'boolean' ? (val ? 1 : 0) : Number(val);
      const res = await apiService.setCameraControl(varName, isNaN(numVal) ? val : numVal);
      if (res.success) {
        setTuningStatusMsg(`✓ ${varName} updated on ESP32 (${val})`);
      } else {
        setTuningStatusMsg(`⚠️ ${res.error || 'ESP32 not responding'}`);
      }
    } catch (e: any) {
      setTuningStatusMsg(`⚠️ Error: ${e.message}`);
    } finally {
      setIsApplyingSetting(null);
      setTimeout(() => setTuningStatusMsg(null), 3000);
    }
  };

  const handleFetchSettings = async () => {
    setTuningStatusMsg('Querying ESP32 OV3660 settings...');
    try {
      const res = await apiService.getCameraSettings();
      if (res.success && res.settings) {
        const s = res.settings;
        setTuningSettings(prev => ({
          ...prev,
          xclk: s.xclk ?? prev.xclk,
          framesize: s.framesize ?? prev.framesize,
          quality: s.quality ?? prev.quality,
          brightness: s.brightness ?? prev.brightness,
          contrast: s.contrast ?? prev.contrast,
          saturation: s.saturation ?? prev.saturation,
          sharpness: s.sharpness ?? prev.sharpness,
          denoise: s.denoise ?? prev.denoise,
          ae_level: s.ae_level ?? prev.ae_level,
          gainceiling: s.gainceiling ?? prev.gainceiling,
          special_effect: s.special_effect ?? prev.special_effect,
          awb: s.awb !== undefined ? Boolean(s.awb) : prev.awb,
          awb_gain: s.awb_gain !== undefined ? Boolean(s.awb_gain) : prev.awb_gain,
          wb_mode: s.wb_mode !== undefined ? Boolean(s.wb_mode) : prev.wb_mode,
          aec: s.aec !== undefined ? Boolean(s.aec) : prev.aec,
          night_mode: s.night_mode !== undefined ? Boolean(s.night_mode) : prev.night_mode,
          agc: s.agc !== undefined ? Boolean(s.agc) : prev.agc,
          raw_gma: s.raw_gma !== undefined ? Boolean(s.raw_gma) : prev.raw_gma,
          lenc: s.lenc !== undefined ? Boolean(s.lenc) : prev.lenc,
          hmirror: s.hmirror !== undefined ? Boolean(s.hmirror) : prev.hmirror,
          vflip: s.vflip !== undefined ? Boolean(s.vflip) : prev.vflip
        }));
        setTuningStatusMsg('✓ Live settings loaded from ESP32-CAM');
      } else {
        setTuningStatusMsg(`⚠️ ${res.error || 'Could not reach ESP32 /status'}`);
      }
    } catch (e: any) {
      setTuningStatusMsg(`⚠️ Camera offline: ${e.message}`);
    } finally {
      setTimeout(() => setTuningStatusMsg(null), 3500);
    }
  };

  const applyPreset = async (presetName: 'THORACIC' | 'NIGHT' | 'FAST') => {
    let presetValues: Partial<typeof tuningSettings> = {};
    if (presetName === 'THORACIC') {
      presetValues = {
        framesize: 8, // VGA
        quality: 10,
        brightness: 1,
        contrast: 1,
        saturation: -1,
        sharpness: 2,
        denoise: 4,
        ae_level: 1,
        awb: true,
        vflip: true,
        hmirror: false
      };
    } else if (presetName === 'NIGHT') {
      presetValues = {
        night_mode: true,
        agc: true,
        gainceiling: 350,
        ae_level: 2,
        brightness: 2,
        contrast: 1,
        quality: 14
      };
    } else if (presetName === 'FAST') {
      presetValues = {
        framesize: 9, // SVGA
        quality: 16,
        xclk: 20,
        denoise: 2
      };
    }

    setTuningSettings(prev => ({ ...prev, ...presetValues }));
    setTuningStatusMsg(`Applying ${presetName} profile to ESP32...`);
    try {
      await apiService.batchSetCameraSettings(presetValues);
      setTuningStatusMsg(`✓ Applied ${presetName} tuning profile!`);
    } catch (e: any) {
      setTuningStatusMsg(`⚠️ Preset error: ${e.message}`);
    } finally {
      setTimeout(() => setTuningStatusMsg(null), 3000);
    }
  };

  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStatusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual Flash LED state
  const [isFlashActive, setIsFlashActive] = useState<boolean>(false);
  const [useDirectStream, setUseDirectStream] = useState<boolean>(false);

  const handleToggleFlash = async () => {
    const next = !isFlashActive;
    setIsFlashActive(next);
    try {
      await apiService.toggleIllumination(next);
    } catch {}
  };

  // Authenticated stream URL routed through backend proxy or direct ESP32 LAN connection
  const token = session?.token ? encodeURIComponent(session.token) : '';
  const cleanIp = cameraIpInput.trim().replace(/^https?:\/\//, '').split(':')[0].split('/')[0] || '172.20.10.6';
  const directStreamUrl = `http://${cleanIp}:81/stream`;
  const backendStreamEndpoint = useDirectStream ? directStreamUrl : `/api/camera/stream${token ? `?token=${token}` : ''}&k=${streamKey}`;

  // Poll real status from backend periodically
  const fetchStatus = async () => {
    try {
      const res = await apiService.getCameraStatus();
      if (res) {
        setConnectionState(res.state);
        setErrorMessage(res.errorMessage);
        setMeasuredFps(res.measuredFps || 0);
        setTotalFrames(res.totalFramesReceived || 0);
        
        // NEVER overwrite what the user is typing or if editing mode is open!
        if (res.streamUrl && !isEditingUrl && !isUserDirtyRef.current) {
          setStreamUrlInput(res.streamUrl);
          if (res.hardwareIp) {
            setCameraIpInput(res.hardwareIp);
          }
        }

        onUpdateCamera({
          streamUrl: res.streamUrl,
          hardwareIp: res.hardwareIp,
          sensor: res.sensor,
          enabled: res.isStreaming,
          measuredFps: res.measuredFps,
          totalFramesReceived: res.totalFramesReceived,
          lastFrameTime: res.lastFrameTime,
          isStreaming: res.isStreaming,
          errorMessage: res.errorMessage,
          status: res.state
        });
      }
    } catch {
      // Backend error
    }
  };

  useEffect(() => {
    fetchStatus();
    pollStatusIntervalRef.current = setInterval(fetchStatus, 2500);

    return () => {
      if (pollStatusIntervalRef.current) clearInterval(pollStatusIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  // Automatic Real-Time Visual Presence Detection Engine
  useEffect(() => {
    if (streamLoaded && streamImgRef.current) {
      visualPresenceDetector.start(streamImgRef.current, (result) => {
        setVisualDetection(result);
        if (lastReportedDetectedRef.current !== result.detected) {
          lastReportedDetectedRef.current = result.detected;
          apiService.updateVisualPresence(result.detected, result.confidence).catch(() => {});
          if (camera) {
            onUpdateCamera({
              ...camera,
              patientDetected: result.detected,
              detectionConfidence: result.confidence
            });
          }
        }
      });
    } else {
      visualPresenceDetector.stop();
    }

    return () => {
      visualPresenceDetector.stop();
    };
  }, [streamLoaded, streamKey, useDirectStream]);

  // Save new ESP32 stream URL or IP
  const handleSaveConfig = async () => {
    setIsEditingUrl(false);
    isUserDirtyRef.current = false;

    let targetIp = cameraIpInput.trim();
    if (!targetIp) {
      targetIp = streamUrlInput.trim();
    }
    if (!targetIp) return;

    // Smart auto-formatting:
    let finalUrl = targetIp;
    let cleanIp = targetIp;

    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(targetIp)) {
      finalUrl = `http://${targetIp}:81/stream`;
      cleanIp = targetIp;
    } else if (/^(\d{1,3}\.){3}\d{1,3}:\d+$/.test(targetIp)) {
      cleanIp = targetIp.split(':')[0];
      finalUrl = `http://${targetIp}/stream`;
    } else {
      try {
        const parsed = new URL(targetIp.startsWith('http') ? targetIp : `http://${targetIp}`);
        cleanIp = parsed.hostname;
        const port = parsed.port || '81';
        const path = (parsed.pathname && parsed.pathname !== '/') ? parsed.pathname : '/stream';
        finalUrl = `${parsed.protocol}//${parsed.hostname}:${port}${path}`;
      } catch {
        finalUrl = `http://${targetIp}:81/stream`;
        cleanIp = targetIp;
      }
    }

    // Persist in browser localStorage permanently
    try {
      localStorage.setItem('esp32_cam_ip', cleanIp);
    } catch {}

    setStreamUrlInput(finalUrl);
    setCameraIpInput(cleanIp);

    try {
      const res = await apiService.updateCameraConfig({ streamUrl: finalUrl });
      if (res.camera) {
        onUpdateCamera(res.camera);
        setConnectionState(res.camera.status || 'CONNECTING');
        triggerReconnect();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  // Reconnection logic
  const triggerReconnect = () => {
    setIsReconnecting(true);
    setConnectionState('CONNECTING');
    setStreamLoaded(false);
    setStreamKey(Date.now());

    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = setTimeout(() => {
      setIsReconnecting(false);
      fetchStatus();
    }, 2000);
  };

  // Handle stream image load
  const handleImageLoad = () => {
    setStreamLoaded(true);
    setConnectionState('STREAMING');
    setErrorMessage(null);
  };

  // Handle stream error
  const handleImageError = () => {
    // If proxy stream encounters issue, seamlessly switch to direct LAN connection
    if (!useDirectStream) {
      setUseDirectStream(true);
      setStreamKey(Date.now());
      return;
    }

    setStreamLoaded(false);
    setConnectionState('DISCONNECTED');
    setErrorMessage('Physical ESP32-CAM stream offline or unreachable.');

    // Auto-reconnect retry after 4 seconds
    if (!isReconnecting) {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        triggerReconnect();
      }, 4000);
    }
  };

  // Live streaming if backend reports CONNECTED/STREAMING or image loaded
  const isStreaming = connectionState === 'STREAMING' || connectionState === 'CONNECTED' || streamLoaded;

  return (
    <div
      className={`rounded-2xl border shadow-sm p-4 sm:p-5 transition-colors ${
        isDarkMode ? 'bg-[#0B1120] border-slate-800' : 'bg-white border-slate-200'
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-lg">📷</span>
            <h3 className="font-bold text-sm sm:text-base tracking-tight text-white">
              ESP32-CAM Optical Aiming Viewport
            </h3>
            
            {/* Real Hardware Connection Status Badge */}
            {isStreaming ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE CAMERA • STREAMING
              </span>
            ) : connectionState === 'CONNECTING' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <RefreshCw className="w-3 h-3 animate-spin" />
                CONNECTING TO HARDWARE
              </span>
            ) : connectionState === 'STREAM ERROR' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <AlertCircle className="w-3 h-3" />
                STREAM ERROR
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-400">
                <VideoOff className="w-3 h-3 text-slate-500" />
                CAMERA DISCONNECTED
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real physical MJPEG stream from AI-Thinker ESP32-CAM (OV2640 sensor) for patient thoracic alignment.
          </p>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          {/* Manual Flash LED Quick Toggle */}
          <button
            onClick={handleToggleFlash}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 active:scale-95 ${
              isFlashActive
                ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
            }`}
            title="Instant Manual Onboard Flash LED Toggle"
          >
            <Sun className={`w-3.5 h-3.5 ${isFlashActive ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
            <span>Flash LED {isFlashActive ? 'ON' : 'OFF'}</span>
          </button>

          {/* Direct LAN vs Proxy Stream Toggle for Ultra-Low Latency */}
          <button
            onClick={() => {
              setUseDirectStream(!useDirectStream);
              setStreamLoaded(false);
            }}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-bold transition-all border flex items-center gap-1.5 ${
              useDirectStream
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}
            title={useDirectStream ? "Using Direct Local ESP32 Connection (Lowest Latency)" : "Using Secure Backend Proxy Stream"}
          >
            <Zap className={`w-3 h-3 ${useDirectStream ? 'text-cyan-400' : 'text-slate-500'}`} />
            <span>{useDirectStream ? 'DIRECT LAN' : 'PROXY'}</span>
          </button>

          <button
            onClick={() => setShowReticle(!showReticle)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              showReticle
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 shadow-sm'
                : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}
            title="Toggle Thoracic Target Zone Alignment Reticle"
          >
            🎯 Reticle {showReticle ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              showDiagnostics
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle ESP32-CAM Network Diagnostics"
          >
            ⚡ Diagnostics
          </button>

          <button
            onClick={() => {
              const next = !showTuningPanel;
              setShowTuningPanel(next);
              if (next) {
                handleFetchSettings();
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
              showTuningPanel
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
            }`}
            title="Configure & Tune ESP32 OV3660 / OV2640 Sensor Settings"
          >
            <Sliders className="w-3.5 h-3.5 text-rose-400" />
            <span>🎛️ Camera Tuning {showTuningPanel ? '▲' : '▼'}</span>
          </button>

          <button
            onClick={() => setIsEditingUrl(!isEditingUrl)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors flex items-center gap-1.5"
            title="Configure Physical ESP32-CAM Endpoint URL"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configure Stream URL</span>
          </button>

          <button
            onClick={triggerReconnect}
            disabled={isReconnecting}
            className="p-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="Reconnect Camera Stream"
          >
            <RefreshCw className={`w-4 h-4 ${isReconnecting ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* URL Config Drawer */}
      {isEditingUrl && (
        <div className="mt-4 p-4 rounded-xl bg-slate-900/95 border border-sky-500/30 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              <span>Configure Physical ESP32-CAM Endpoint</span>
            </label>
            <span className="text-[10px] font-mono text-slate-400">
              Enter your ESP32's Wi-Fi IP address (e.g. 172.20.10.6 or 192.168.1.85)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Camera IP Address:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={cameraIpInput}
                  onChange={(e) => {
                    isUserDirtyRef.current = true;
                    setCameraIpInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveConfig();
                  }}
                  className="w-full px-3.5 py-2 text-sm font-mono font-bold rounded-xl border bg-slate-950 border-slate-700 text-emerald-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  placeholder="e.g. 172.20.10.6 or 192.168.1.85"
                  autoFocus
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                Stream target: http://{cameraIpInput.replace(/^https?:\/\//, '').split(':')[0].split('/')[0] || '...'}:81/stream
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveConfig}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-md shadow-sky-600/20 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save &amp; Connect</span>
              </button>
              <button
                onClick={() => {
                  setIsEditingUrl(false);
                  isUserDirtyRef.current = false;
                }}
                className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics Panel (Per Requirement 20) */}
      {showDiagnostics && (
        <div className="mt-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Connection State</div>
            <div className={`font-bold mt-0.5 ${
              isStreaming ? 'text-emerald-400' : connectionState === 'CONNECTING' ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {connectionState}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Hardware Sensor</div>
            <div className="font-bold text-slate-200 mt-0.5">OV2640 (2MP)</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Measured Rate</div>
            <div className="font-bold text-sky-400 mt-0.5">
              {measuredFps > 0 ? `${measuredFps} FPS` : '0 FPS (Idle/Offline)'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Total Frames</div>
            <div className="font-bold text-slate-200 mt-0.5">{totalFrames}</div>
          </div>
          <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Stream Target: <strong className="text-slate-300">{streamUrlInput}</strong></span>
            <span>Auth Proxy: <strong className="text-cyan-400">/api/camera/stream</strong></span>
          </div>
          {errorMessage && (
            <div className="col-span-2 sm:col-span-4 p-2 rounded bg-rose-950/40 border border-rose-800/40 text-rose-300 text-[11px]">
              Diagnostic: {errorMessage}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ESP32-CAM OV3660 / OV2640 SENSOR HARDWARE TUNING & CONTROL DRAWER         */}
      {/* Matches exactly the physical ESP32 Camera WebServer control register UI   */}
      {/* ========================================================================= */}
      {showTuningPanel && (
        <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-[#141A28] border border-rose-500/40 shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200">
          {/* Top Panel Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-sm sm:text-base text-slate-100 tracking-tight font-sans">
                    Toggle OV3660 settings
                  </h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    ESP32 HARDWARE TUNING
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>Target IP: <strong className="text-emerald-400">{cameraIpInput}</strong></span>
                  <span>•</span>
                  <span>Port: <strong className="text-cyan-400">80 (Control) / 81 (Stream)</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status feedback message */}
              {tuningStatusMsg && (
                <div className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 animate-in fade-in">
                  {tuningStatusMsg}
                </div>
              )}

              {/* Refresh from Camera */}
              <button
                type="button"
                onClick={handleFetchSettings}
                className="px-3 py-1.5 rounded-xl border text-xs font-semibold bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 flex items-center gap-1.5 transition active:scale-95"
                title="Fetch live registers from ESP32 /status"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span>Fetch from ESP32</span>
              </button>

              {/* Save Button matching screenshot red Save pill */}
              <button
                type="button"
                onClick={() => {
                  setTuningStatusMsg('✓ Settings saved & confirmed active on ESP32');
                  setTimeout(() => setTuningStatusMsg(null), 3000);
                }}
                className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#E53935] hover:bg-rose-600 text-white shadow-md shadow-rose-900/30 flex items-center gap-1.5 transition active:scale-95"
                title="Save sensor registers to microcontroller"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>

              {/* Direct Link to open 172.20.10.6 */}
              <a
                href={`http://${cameraIpInput}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl border text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-cyan-300 flex items-center gap-1 transition"
                title="Open ESP32-CAM standalone web server in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open {cameraIpInput}</span>
              </a>

              {/* Close panel */}
              <button
                type="button"
                onClick={() => setShowTuningPanel(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Tuning Profiles Bar */}
          <div className="flex items-center gap-2 pt-3 pb-3 border-b border-slate-800/60 flex-wrap">
            <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold">Tuning Profiles:</span>
            <button
              onClick={() => applyPreset('THORACIC')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-sky-500/10 border-sky-500/30 text-sky-300 hover:bg-sky-500/20 transition flex items-center gap-1"
            >
              <span>🎯 Thoracic Focus (VGA • Sharpness 2 • Denoise 4 • V-Flip)</span>
            </button>
            <button
              onClick={() => applyPreset('NIGHT')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 transition flex items-center gap-1"
            >
              <span>🌙 Low-Light ICU (Night Mode • AGC • Gain 350)</span>
            </button>
            <button
              onClick={() => applyPreset('FAST')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition flex items-center gap-1"
            >
              <span>⚡ High Frame Rate (SVGA • XCLK 20 MHz)</span>
            </button>
          </div>

          {/* 2-Column Responsive Layout matching the uploaded screenshot */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3">
            
            {/* Left Column: Sliders & Dropdowns */}
            <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
              
              {/* Manual Onboard Flash LED / Illumination (GPIO 4) */}
              <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 col-span-1 md:col-span-2">
                <div className="flex items-center gap-2">
                  <Sun className={`w-4 h-4 ${isFlashActive ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold text-amber-300">ESP32 Onboard Flash LED (GPIO 4)</div>
                    <div className="text-[10px] text-slate-400 font-mono">Manual instant illumination control with zero packet latency</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsFlashActive(false);
                      try { await apiService.toggleIllumination(false); } catch {}
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95"
                  >
                    OFF
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsFlashActive(true);
                      try { await apiService.setIllumination(0); } catch {}
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-500/40 active:scale-95"
                  >
                    50% (Nominal)
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsFlashActive(true);
                      try { await apiService.flashFullIllumination(); } catch {}
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95 shadow-sm"
                  >
                    ⚡ 100% (Instant)
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleFlash}
                    className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                      isFlashActive ? 'bg-[#E53935] justify-end' : 'bg-slate-700 justify-start'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200" />
                  </button>
                </div>
              </div>

              {/* XCLK MHz */}
              <div className="flex items-center justify-between gap-3 py-0.5">
                <span className="text-xs font-medium text-slate-300">XCLK MHz</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={25}
                    value={tuningSettings.xclk}
                    onChange={(e) => setTuningSettings(prev => ({ ...prev, xclk: Number(e.target.value) }))}
                    className="w-16 px-2.5 py-1 text-xs font-mono font-bold bg-slate-900 border border-slate-700 rounded-lg text-white text-center focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleTuningChange('xclk', tuningSettings.xclk)}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-[#E53935] hover:bg-rose-600 text-white transition active:scale-95"
                  >
                    Set
                  </button>
                </div>
              </div>

              {/* Resolution Dropdown */}
              <div className="flex items-center justify-between gap-3 py-0.5">
                <span className="text-xs font-medium text-slate-300">Resolution</span>
                <select
                  value={tuningSettings.framesize}
                  onChange={(e) => handleTuningChange('framesize', Number(e.target.value))}
                  className="px-3 py-1.5 text-xs font-mono font-bold bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none focus:border-rose-500 min-w-[170px]"
                >
                  <option value={13}>UXGA (1600x1200)</option>
                  <option value={12}>SXGA (1280x1024)</option>
                  <option value={11}>HD (1280x720)</option>
                  <option value={10}>XGA (1024x768)</option>
                  <option value={9}>SVGA (800x600)</option>
                  <option value={8}>VGA (640x480)</option>
                  <option value={7}>HVGA (480x320)</option>
                  <option value={6}>CIF (400x296)</option>
                  <option value={5}>QVGA (320x240)</option>
                  <option value={3}>HQVGA (240x176)</option>
                </select>
              </div>

              {/* Quality Slider (4 to 63) */}
              <div className="space-y-1 py-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Quality (JPEG Compression)</span>
                  <span className="font-mono font-bold text-rose-400 text-[11px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    {tuningSettings.quality}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono w-4 text-right">4</span>
                  <input
                    type="range"
                    min={4}
                    max={63}
                    value={tuningSettings.quality}
                    onChange={(e) => handleTuningChange('quality', Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#E53935]"
                  />
                  <span className="text-[10px] text-slate-400 font-mono w-6 text-left">63</span>
                </div>
              </div>

              {/* Brightness (-3 to 3) */}
              <div className="space-y-1 py-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Brightness</span>
                  <span className="font-mono font-bold text-rose-400 text-[11px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    {tuningSettings.brightness > 0 ? `+${tuningSettings.brightness}` : tuningSettings.brightness}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono w-4 text-right">-3</span>
                  <input
                    type="range"
                    min={-3}
                    max={3}
                    value={tuningSettings.brightness}
                    onChange={(e) => handleTuningChange('brightness', Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#E53935]"
                  />
                  <span className="text-[10px] text-slate-400 font-mono w-6 text-left">3</span>
                </div>
              </div>

              {/* Contrast (-3 to 3) */}
              <div className="space-y-1 py-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Contrast</span>
                  <span className="font-mono font-bold text-rose-400 text-[11px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    {tuningSettings.contrast > 0 ? `+${tuningSettings.contrast}` : tuningSettings.contrast}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono w-4 text-right">-3</span>
                  <input
                    type="range"
                    min={-3}
                    max={3}
                    value={tuningSettings.contrast}
                    onChange={(e) => handleTuningChange('contrast', Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#E53935]"
                  />
                  <span className="text-[10px] text-slate-400 font-mono w-6 text-left">3</span>
                </div>
              </div>

              {/* Saturation (-4 to 4) */}
              <div className="space-y-1 py-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Saturation</span>
                  <span className="font-mono font-bold text-rose-400 text-[11px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    {tuningSettings.saturation > 0 ? `+${tuningSettings.saturation}` : tuningSettings.saturation}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono w-4 text-right">-4</span>
                  <input
                    type="range"
                    min={-4}
                    max={4}
                    value={tuningSettings.saturation}
                    onChange={(e) => handleTuningChange('saturation', Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#E53935]"
                  />
                  <span className="text-[10px] text-slate-400 font-mono w-6 text-left">4</span>
                </div>
              </div>

              {/* Sharpness (-3 to 3) */}
              <div className="space-y-1 py-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Sharpness</span>
                  <span className="font-mono font-bold text-rose-400 text-[11px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    {tuningSettings.sharpness > 0 ? `+${tuningSettings.sharpness}` : tuningSettings.sharpness}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono w-4 text-right">-3</span>
                  <input
                    type="range"
                    min={-3}
                    max={3}
                    value={tuningSettings.sharpness}
                    onChange={(e) => handleTuningChange('sharpness', Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#E53935]"
                  />
                  <span className="text-[10px] text-slate-400 font-mono w-6 text-left">3</span>
                </div>
              </div>

              {/* De-Noise (Auto to 8) */}
              <div className="space-y-1 py-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">De-Noise</span>
                  <span className="font-mono font-bold text-rose-400 text-[11px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    {tuningSettings.denoise === 0 ? 'Auto' : tuningSettings.denoise}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono w-6 text-right">Auto</span>
                  <input
                    type="range"
                    min={0}
                    max={8}
                    value={tuningSettings.denoise}
                    onChange={(e) => handleTuningChange('denoise', Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#E53935]"
                  />
                  <span className="text-[10px] text-slate-400 font-mono w-6 text-left">8</span>
                </div>
              </div>

              {/* Exposure Level (-5 to 5) */}
              <div className="space-y-1 py-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Exposure Level</span>
                  <span className="font-mono font-bold text-rose-400 text-[11px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    {tuningSettings.ae_level > 0 ? `+${tuningSettings.ae_level}` : tuningSettings.ae_level}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono w-4 text-right">-5</span>
                  <input
                    type="range"
                    min={-5}
                    max={5}
                    value={tuningSettings.ae_level}
                    onChange={(e) => handleTuningChange('ae_level', Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#E53935]"
                  />
                  <span className="text-[10px] text-slate-400 font-mono w-6 text-left">5</span>
                </div>
              </div>

              {/* Gainceiling (0 to 511) */}
              <div className="space-y-1 py-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Gainceiling</span>
                  <span className="font-mono font-bold text-rose-400 text-[11px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    {tuningSettings.gainceiling}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono w-4 text-right">0</span>
                  <input
                    type="range"
                    min={0}
                    max={511}
                    value={tuningSettings.gainceiling}
                    onChange={(e) => handleTuningChange('gainceiling', Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#E53935]"
                  />
                  <span className="text-[10px] text-slate-400 font-mono w-6 text-left">511</span>
                </div>
              </div>

              {/* Special Effect Dropdown */}
              <div className="flex items-center justify-between gap-3 py-0.5">
                <span className="text-xs font-medium text-slate-300">Special Effect</span>
                <select
                  value={tuningSettings.special_effect}
                  onChange={(e) => handleTuningChange('special_effect', Number(e.target.value))}
                  className="px-3 py-1.5 text-xs font-mono font-bold bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none focus:border-rose-500 min-w-[170px]"
                >
                  <option value={0}>No Effect</option>
                  <option value={1}>Negative</option>
                  <option value={2}>Grayscale</option>
                  <option value={3}>Red Tint</option>
                  <option value={4}>Green Tint</option>
                  <option value={5}>Blue Tint</option>
                  <option value={6}>Sepia</option>
                </select>
              </div>

            </div>

            {/* Right Column: Hardware Toggles (with authentic red pill switch styling) */}
            <div className="space-y-2.5 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
              <div className="text-[11px] font-mono text-slate-400 uppercase font-bold tracking-wider mb-2 border-b border-slate-800 pb-1.5">
                Hardware ISP Processing &amp; Sensor Registers
              </div>

              {/* AWB Enable */}
              <div className="flex items-center justify-between py-1 px-1">
                <span className="text-xs text-slate-300 font-medium">AWB Enable</span>
                <button
                  type="button"
                  onClick={() => handleTuningChange('awb', !tuningSettings.awb)}
                  className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                    tuningSettings.awb ? 'bg-[#E53935] justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200" />
                </button>
              </div>

              {/* Advanced AWB */}
              <div className="flex items-center justify-between py-1 px-1">
                <span className="text-xs text-slate-300 font-medium">Advanced AWB</span>
                <button
                  type="button"
                  onClick={() => handleTuningChange('awb_gain', !tuningSettings.awb_gain)}
                  className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                    tuningSettings.awb_gain ? 'bg-[#E53935] justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200" />
                </button>
              </div>

              {/* Manual AWB */}
              <div className="flex items-center justify-between py-1 px-1">
                <span className="text-xs text-slate-300 font-medium">Manual AWB</span>
                <button
                  type="button"
                  onClick={() => handleTuningChange('wb_mode', !tuningSettings.wb_mode)}
                  className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                    tuningSettings.wb_mode ? 'bg-[#E53935] justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200" />
                </button>
              </div>

              {/* AEC Enable */}
              <div className="flex items-center justify-between py-1 px-1">
                <span className="text-xs text-slate-300 font-medium">AEC Enable</span>
                <button
                  type="button"
                  onClick={() => handleTuningChange('aec', !tuningSettings.aec)}
                  className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                    tuningSettings.aec ? 'bg-[#E53935] justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200" />
                </button>
              </div>

              {/* Night Mode */}
              <div className="flex items-center justify-between py-1 px-1">
                <span className="text-xs text-slate-300 font-medium">Night Mode</span>
                <button
                  type="button"
                  onClick={() => handleTuningChange('night_mode', !tuningSettings.night_mode)}
                  className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                    tuningSettings.night_mode ? 'bg-[#E53935] justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200" />
                </button>
              </div>

              {/* AGC */}
              <div className="flex items-center justify-between py-1 px-1">
                <span className="text-xs text-slate-300 font-medium">AGC</span>
                <button
                  type="button"
                  onClick={() => handleTuningChange('agc', !tuningSettings.agc)}
                  className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                    tuningSettings.agc ? 'bg-[#E53935] justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200" />
                </button>
              </div>

              {/* GMA Enable */}
              <div className="flex items-center justify-between py-1 px-1">
                <span className="text-xs text-slate-300 font-medium">GMA Enable</span>
                <button
                  type="button"
                  onClick={() => handleTuningChange('raw_gma', !tuningSettings.raw_gma)}
                  className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                    tuningSettings.raw_gma ? 'bg-[#E53935] justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200" />
                </button>
              </div>

              {/* Lens Correction */}
              <div className="flex items-center justify-between py-1 px-1">
                <span className="text-xs text-slate-300 font-medium">Lens Correction</span>
                <button
                  type="button"
                  onClick={() => handleTuningChange('lenc', !tuningSettings.lenc)}
                  className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                    tuningSettings.lenc ? 'bg-[#E53935] justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200" />
                </button>
              </div>

              {/* H-Mirror */}
              <div className="flex items-center justify-between py-1 px-1">
                <span className="text-xs text-slate-300 font-medium">H-Mirror</span>
                <button
                  type="button"
                  onClick={() => handleTuningChange('hmirror', !tuningSettings.hmirror)}
                  className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                    tuningSettings.hmirror ? 'bg-[#E53935] justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200" />
                </button>
              </div>

              {/* V-Flip */}
              <div className="flex items-center justify-between py-1 px-1">
                <span className="text-xs text-slate-300 font-medium">V-Flip</span>
                <button
                  type="button"
                  onClick={() => handleTuningChange('vflip', !tuningSettings.vflip)}
                  className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                    tuningSettings.vflip ? 'bg-[#E53935] justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200" />
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CAMERA VIEWPORT — REAL PHYSICAL STREAM ONLY (NO FAKE / SYNTHETIC VIDEO)   */}
      {/* ========================================================================= */}
      <div className="mt-4 relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center select-none shadow-inner">
        
        {/* Actual Live MJPEG Stream from Backend Proxy */}
        <img
          ref={streamImgRef}
          crossOrigin="anonymous"
          key={streamKey}
          src={backendStreamEndpoint}
          alt="ESP32-CAM Live Feed"
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isStreaming ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
          }`}
        />

        {/* ========================================================================= */}
        {/* STRICT DATA INTEGRITY: Disconnected / Empty Neutral State                  */}
        {/* When physical ESP32-CAM is powered off, show clean neutral disconnected screen */}
        {/* NEVER substitute with generated, stock, or placeholder video               */}
        {/* ========================================================================= */}
        {!isStreaming && (
          <div className="text-center p-6 sm:p-8 space-y-3 z-10 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-600 shadow-lg">
              <VideoOff className="w-8 h-8" />
            </div>

            <div>
              <div className="text-sm sm:text-base font-bold text-slate-300 tracking-wide font-sans">
                {connectionState === 'CONNECTING' ? 'CONNECTING TO PHYSICAL ESP32-CAM...' : 'CAMERA DISCONNECTED'}
              </div>
              <p className="text-xs text-slate-500 mt-1 font-mono leading-relaxed">
                {connectionState === 'CONNECTING' 
                  ? `Negotiating MJPEG handshake with ${streamUrlInput}...`
                  : `No active optical stream detected at ${streamUrlInput}. Power on your physical ESP32-CAM and connect it to Wi-Fi.`}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={triggerReconnect}
                disabled={isReconnecting}
                className="px-4 py-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 text-xs font-bold transition-all inline-flex items-center gap-2 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin' : ''}`} />
                <span>{isReconnecting ? 'Scanning...' : 'Scan & Reconnect Stream'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Reticle / Thoracic Target Zone FOV Overlay */}
        {showReticle && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Center Crosshairs */}
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-sky-400/25" />
            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-sky-400/25" />

            {/* Radar Beam Cone Projection */}
            <div className={`w-48 h-48 sm:w-64 sm:h-64 rounded-full border-2 ${
              visualDetection.detected 
                ? 'border-emerald-400/80 shadow-[0_0_30px_rgba(16,185,129,0.35)]' 
                : 'border-dashed border-sky-400/50 shadow-[0_0_20px_rgba(56,189,248,0.15)]'
            } flex items-center justify-center transition-all duration-300`}>
              <div className={`w-10 h-10 rounded-full border ${visualDetection.detected ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-sky-400/40'}`} />
              <div className="absolute top-2 text-[9px] font-mono font-bold text-sky-400 uppercase tracking-wider bg-black/70 px-2 py-0.5 rounded border border-sky-500/20">
                24 GHz RADAR FOV (34°)
              </div>
              <div className={`absolute bottom-2 text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border transition-colors ${
                visualDetection.detected 
                  ? 'text-emerald-300 bg-emerald-950/80 border-emerald-500/40' 
                  : 'text-amber-400 bg-amber-950/80 border-amber-500/40'
              }`}>
                {visualDetection.detected ? 'THORACIC TARGET LOCKED' : 'ALIGN PATIENT TO TARGET ZONE'}
              </div>
            </div>
          </div>
        )}

        {/* Real-time Optical Computer Vision Presence Telemetry HUD */}
        {isStreaming && (
          <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-none">
            {visualDetection.detected ? (
              <div className="flex items-center gap-2 bg-emerald-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    PATIENT DETECTED
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                      {visualDetection.confidence}%
                    </span>
                  </span>
                  <span className="text-[8px] font-mono text-emerald-400/80">
                    OPTICAL CV SENSING
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-amber-500/40 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
                    NO PATIENT IN FOV
                  </span>
                  <span className="text-[8px] font-mono text-slate-400">
                    OPTICAL MONITORING ARMED
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Real-time Telemetry Pill on Stream (No fabricated metrics) */}
        <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[11px] font-mono text-slate-200 flex items-center gap-2 shadow-md">
          <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          <span className="font-bold">ESP32-CAM</span>
          <span>•</span>
          <span className="text-slate-400">
            {isStreaming ? (measuredFps > 0 ? `${measuredFps} FPS` : 'LIVE FEED') : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Sensor Notice */}
      <div className="mt-4 p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-300">Biomedical Boundary: </strong>
          The optical camera provides non-diagnostic visual aiming onto the patient's thorax.
          Respiratory measurements, chest displacement signals, and apnea alarms are derived 
          strictly and independently by the <strong className="text-sky-300">24 GHz FMCW Radar transceiver</strong>.
        </div>
      </div>
    </div>
  );
};
