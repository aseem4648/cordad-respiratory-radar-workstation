import fs from 'fs';
import path from 'path';

// Load .env configuration
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { radarDataAdapter } from '../../hardware-interface/radarDataAdapter';
import { PacketParser } from '../../hardware-interface/packetParser';
import { RawRadarPayload, StandardRadarPacket, MonitoringEvent } from '../../hardware-interface/types';
import { RespiratoryBandpassFilter } from './signalProcessing/filter';
import { RespiratoryRateEstimator } from './signalProcessing/respiratoryEstimator';
import { SignalQualityCalculator } from './signalProcessing/signalQuality';
import { RespiratoryEventDetector } from './signalProcessing/eventDetector';
import { RespiratorySignalGenerator, DemoScenario } from './simulation/respiratorySignalGenerator';
import { dataLogger } from './logging/dataLogger';
import { CsvExporter } from './logging/csvExporter';
import { DEFAULT_SETTINGS, SERVER_CONFIG } from './config';
import { panTiltController } from './pantilt/panTiltController';
import { authManager } from './auth/authManager';
import { illuminationController } from './camera/illuminationController';
import { cameraProxy } from './camera/cameraProxy';
import { userStore } from './database/userStore';
import { supportStore } from './database/supportStore';
import { radarSerialService } from './radar/radarSerial';



const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: SERVER_CONFIG.WS_PATH });

let currentSettings = { ...DEFAULT_SETTINGS };
const dspFilter = new RespiratoryBandpassFilter({
  sampleRateHz: currentSettings.samplingRateHz,
  lowCutHz: currentSettings.filterLowCutHz,
  highCutHz: currentSettings.filterHighCutHz
});
const dspEstimator = new RespiratoryRateEstimator(currentSettings.samplingRateHz, 25);
const dspQuality = new SignalQualityCalculator(currentSettings.samplingRateHz, 10);
const dspEvent = new RespiratoryEventDetector(
  currentSettings.apneaThresholdSeconds,
  currentSettings.tachypneaThresholdBpm,
  currentSettings.bradypneaThresholdBpm,
  currentSettings.signalQualityThreshold,
  currentSettings.samplingRateHz
);
const demoGenerator = new RespiratorySignalGenerator(currentSettings.samplingRateHz);

let activeMode: 'LIVE_RADAR' | 'OFFLINE_DATASET' | 'NO_DATA_SOURCE' | 'DEV_SIMULATION' | 'DEMO_MODE' = 'NO_DATA_SOURCE';
let isStreamPaused = false;
let lastHardwarePacketTime = 0;
let hardwareConnected = false;
let demoTimer: NodeJS.Timeout | null = null;

let cameraConfig = {
  streamUrl: 'http://192.168.4.1/stream',
  enabled: false,
  fps: 15,
  resolution: '640x480 (VGA)',
  status: 'DISCONNECTED' as 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'
};


let packetCount = 0;
let lastSecondPackets = 0;
let packetsPerSecond = 0;
setInterval(() => {
  packetsPerSecond = packetCount - lastSecondPackets;
  lastSecondPackets = packetCount;

  if (activeMode === 'LIVE_RADAR') {
    const isAlive = Date.now() - lastHardwarePacketTime < 2500;
    if (hardwareConnected && !isAlive) {
      hardwareConnected = false;
      activeMode = 'NO_DATA_SOURCE';
      broadcast({
        type: 'HARDWARE_STATUS_CHANGED',
        status: 'RADAR_DISCONNECTED',
        mode: 'NO_DATA_SOURCE',
        message: 'Physical MR24BSD1 radar stream lost. Waveform and measurements halted.'
      });
    } else {
      hardwareConnected = isAlive;
    }
  }
}, 1000);

function processAndBroadcast(raw: RawRadarPayload, isDemo: boolean) {
  if (isStreamPaused) return;

  const now = Date.now();
  packetCount++;

  const stdPacket = radarDataAdapter.adapt(raw, isDemo);

  let filteredSignal: number | null = null;
  if (stdPacket.signal !== null) {
    filteredSignal = dspFilter.process(stdPacket.signal);
    stdPacket.filteredSignal = Math.round(filteredSignal * 10000) / 10000;
  }

  let sqiResult = dspQuality.update(
    filteredSignal !== null ? filteredSignal : 0,
    stdPacket.signal !== null ? stdPacket.signal : 0
  );
  if (stdPacket.signal !== null && filteredSignal !== null) {
    stdPacket.signalQuality = sqiResult.sqi;
  }

  if (stdPacket.rrSource !== 'RADAR_ONBOARD_FIRMWARE') {
    if (filteredSignal !== null && (stdPacket.signalQuality === null || stdPacket.signalQuality >= currentSettings.signalQualityThreshold)) {
      const rrResult = dspEstimator.addSample(filteredSignal, stdPacket.timestamp);
      if (rrResult.isValid && rrResult.respiratoryRateBpm !== null) {
        stdPacket.respiratoryRate = rrResult.respiratoryRateBpm;
        stdPacket.rrSource = 'CALCULATED_RADAR_DSP';
      } else {
        stdPacket.respiratoryRate = null;
        stdPacket.rrSource = 'UNAVAILABLE';
      }
    } else {
      stdPacket.respiratoryRate = null;
      stdPacket.rrSource = 'UNAVAILABLE';
    }
  }

  const eventResult = dspEvent.evaluate({
    timestamp: stdPacket.timestamp,
    filteredSignal: stdPacket.filteredSignal,
    respiratoryRate: stdPacket.respiratoryRate,
    signalQuality: stdPacket.signalQuality,
    presence: stdPacket.presence,
    isRadarConnected: isDemo || hardwareConnected,
    sampleRateHz: currentSettings.samplingRateHz
  });

  stdPacket.event = eventResult.currentState;
  stdPacket.eventDurationSeconds = eventResult.durationSeconds;

  if (eventResult.hasStateChanged) {
    const eventItem: MonitoringEvent = {
      id: `${now}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: now,
      timeString: new Date(now).toLocaleTimeString('en-GB'),
      type: eventResult.currentState,
      label: eventResult.stateLabel,
      severity: eventResult.severity,
      details: eventResult.details
    };
    dataLogger.logEvent(eventItem);

    broadcast({ type: 'EVENT_ALERT', event: eventItem });
  }

  dataLogger.logSample(stdPacket);

  broadcast({
    type: 'RADAR_SAMPLE',
    packet: stdPacket,
    telemetry: {
      connectionStatus: (isDemo || hardwareConnected) ? 'CONNECTED' : 'DISCONNECTED',
      dataStreamStatus: isStreamPaused ? 'PAUSED' : 'LIVE',
      totalPacketsReceived: packetCount,
      packetsPerSecond,
      packetLossCount: radarDataAdapter.getStats().packetLoss,
      lastPacketTimestamp: now,
      samplingRateHz: currentSettings.samplingRateHz,
      mode: activeMode
    }
  });
}

function broadcast(payload: any) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function startDemoStream() {
  if (demoTimer) clearInterval(demoTimer);
  const intervalMs = Math.round(1000 / currentSettings.samplingRateHz);
  demoTimer = setInterval(() => {
    if (activeMode === 'DEMO_MODE') {
      const sample = demoGenerator.getNextSample();
      if (sample) {
        processAndBroadcast(sample, true);
      }
    }
  }, intervalMs);
}

function stopDemoStream() {
  if (demoTimer) {
    clearInterval(demoTimer);
    demoTimer = null;
  }
}

wss.on('connection', (ws) => {
  console.log('[WS] Client connected to radar telemetry stream');

  ws.send(JSON.stringify({
    type: 'SYSTEM_INIT',
    mode: activeMode,
    settings: currentSettings,
    recordingStatus: dataLogger.getStatus(),
    recentEvents: dataLogger.getRecentEvents(20)
  }));

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'SET_MODE') {
        activeMode = data.mode === 'LIVE_RADAR' ? 'LIVE_RADAR' : 'DEMO_MODE';
        if (activeMode === 'DEMO_MODE') startDemoStream();
        else stopDemoStream();
        broadcast({ type: 'MODE_CHANGED', mode: activeMode });
      } else if (data.type === 'SET_DEMO_SCENARIO') {
        demoGenerator.setScenario(data.scenario as DemoScenario);
        broadcast({ type: 'DEMO_SCENARIO_CHANGED', scenario: data.scenario });
      } else if (data.type === 'PAUSE_STREAM') {
        isStreamPaused = data.paused ?? !isStreamPaused;
        broadcast({ type: 'STREAM_PAUSE_CHANGED', paused: isStreamPaused });
      } else if (data.type === 'UPDATE_SETTINGS') {
        currentSettings = { ...currentSettings, ...data.settings };
        dspFilter.updateConfig({
          sampleRateHz: currentSettings.samplingRateHz,
          lowCutHz: currentSettings.filterLowCutHz,
          highCutHz: currentSettings.filterHighCutHz
        });
        dspEvent.updateSettings({
          apneaThresholdSec: currentSettings.apneaThresholdSeconds,
          tachypneaThresholdBpm: currentSettings.tachypneaThresholdBpm,
          bradypneaThresholdBpm: currentSettings.bradypneaThresholdBpm,
          minSignalQuality: currentSettings.signalQualityThreshold
        });
        broadcast({ type: 'SETTINGS_UPDATED', settings: currentSettings });
      } else if (data.type === 'PANTILT_MOVE') {
        const pt = panTiltController.move(data.direction, data.step);
        broadcast({ type: 'PANTILT_UPDATED', panTilt: pt });
      } else if (data.type === 'PANTILT_HOME') {
        const pt = panTiltController.home();
        broadcast({ type: 'PANTILT_UPDATED', panTilt: pt });
      } else if (data.type === 'PANTILT_STOP') {
        const pt = panTiltController.stop();
        broadcast({ type: 'PANTILT_UPDATED', panTilt: pt });
      } else if (data.type === 'PANTILT_SET_STEP') {
        const pt = panTiltController.setStepSize(data.step);
        broadcast({ type: 'PANTILT_UPDATED', panTilt: pt });
      } else if (data.type === 'PANTILT_SET_MODE') {
        const pt = panTiltController.setMode(data.mode);
        broadcast({ type: 'PANTILT_UPDATED', panTilt: pt });
      }
    } catch (err) {
      const rawPayload = PacketParser.parseString(message.toString());
      if (rawPayload) {
        lastHardwarePacketTime = Date.now();
        hardwareConnected = true;
        if (activeMode !== 'LIVE_RADAR') {
          activeMode = 'LIVE_RADAR';
          broadcast({ type: 'MODE_CHANGED', mode: 'LIVE_RADAR', source: 'LIVE_HARDWARE' });
        }
        processAndBroadcast(rawPayload, false);
      }
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'ONLINE',
    mode: activeMode,
    isStreamPaused,
    hardwareConnected,
    telemetry: {
      totalPacketsReceived: packetCount,
      packetsPerSecond,
      lastPacketTime: lastHardwarePacketTime
    },
    recording: dataLogger.getStatus(),
    settings: currentSettings
  });
});

app.post('/api/mode', (req, res) => {
  const { mode } = req.body;
  activeMode = mode === 'LIVE_RADAR' ? 'LIVE_RADAR' : 'DEMO_MODE';
  if (activeMode === 'DEMO_MODE') startDemoStream();
  else stopDemoStream();
  broadcast({ type: 'MODE_CHANGED', mode: activeMode });
  res.json({ success: true, mode: activeMode });
});

app.post('/api/demo/scenario', (req, res) => {
  const { scenario } = req.body;
  if (scenario) {
    demoGenerator.setScenario(scenario as DemoScenario);
    broadcast({ type: 'DEMO_SCENARIO_CHANGED', scenario });
    res.json({ success: true, scenario });
  } else {
    res.status(400).json({ error: 'Scenario required' });
  }
});

app.post('/api/recording/start', (req, res) => {
  dataLogger.startRecording();
  broadcast({ type: 'RECORDING_STATUS_CHANGED', status: dataLogger.getStatus() });
  res.json({ success: true, status: dataLogger.getStatus() });
});

app.post('/api/recording/stop', (req, res) => {
  dataLogger.stopRecording();
  broadcast({ type: 'RECORDING_STATUS_CHANGED', status: dataLogger.getStatus() });
  res.json({ success: true, status: dataLogger.getStatus() });
});

app.post('/api/recording/clear', (req, res) => {
  dataLogger.clearSession();
  broadcast({ type: 'RECORDING_STATUS_CHANGED', status: dataLogger.getStatus() });
  res.json({ success: true, status: dataLogger.getStatus() });
});

app.post('/api/events/clear', (req, res) => {
  dataLogger.clearEvents();
  broadcast({ type: 'EVENTS_CLEARED' });
  res.json({ success: true });
});

app.get('/api/recording/export', (req, res) => {
  const data = dataLogger.getRecordedData();
  const sessionStatus = dataLogger.getStatus();
  const csv = CsvExporter.generateCsv(data, {
    durationSec: sessionStatus.durationSeconds,
    source: (activeMode === 'DEMO_MODE' || activeMode === 'DEV_SIMULATION')
      ? 'SIMULATED_24GHZ_RADAR_DATA'
      : (activeMode === 'OFFLINE_DATASET' ? 'USER_UPLOADED_DATASET' : 'PHYSICAL_24GHZ_FMCW_RADAR')
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="radar_respiration_session_${Date.now()}.csv"`);
  res.send(csv);
});

app.post('/api/radar/data', (req, res) => {
  const rawPayload = PacketParser.parseString(JSON.stringify(req.body));
  if (rawPayload) {
    lastHardwarePacketTime = Date.now();
    hardwareConnected = true;
    if (activeMode !== 'LIVE_RADAR') {
      activeMode = 'LIVE_RADAR';
      broadcast({ type: 'MODE_CHANGED', mode: 'LIVE_RADAR', source: 'LIVE_HARDWARE' });
    }
    processAndBroadcast(rawPayload, false);
    res.json({ success: true, mode: 'LIVE_RADAR' });
  } else {
    res.status(400).json({ error: 'Invalid radar payload schema' });
  }
});

// SerialPort hardware link event listener
radarSerialService.on('payload', (rawPayload: RawRadarPayload) => {
  lastHardwarePacketTime = Date.now();
  hardwareConnected = true;
  if (activeMode !== 'LIVE_RADAR') {
    activeMode = 'LIVE_RADAR';
    broadcast({ type: 'MODE_CHANGED', mode: 'LIVE_RADAR', source: 'LIVE_HARDWARE' });
  }
  processAndBroadcast(rawPayload, false);
});

app.get('/api/radar/ports', async (req, res) => {
  const ports = await radarSerialService.listPorts();
  res.json({ ports, status: radarSerialService.getStatus() });
});

app.post('/api/radar/connect', async (req, res) => {
  const { path } = req.body;
  if (!path) return res.status(400).json({ error: 'Port path is required' });
  const success = await radarSerialService.connect(path);
  res.json({ success, status: radarSerialService.getStatus() });
});

app.post('/api/radar/disconnect', async (req, res) => {
  await radarSerialService.disconnect();
  res.json({ success: true, status: radarSerialService.getStatus() });
});


// ==================== PAN-TILT CONTROLLER ENDPOINTS ====================
app.get('/api/pantilt/status', (req, res) => {
  res.json(panTiltController.getStatus());
});

app.post('/api/pantilt/move', (req, res) => {
  const { direction, step } = req.body;
  if (['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(direction)) {
    const pt = panTiltController.move(direction, step);
    broadcast({ type: 'PANTILT_UPDATED', panTilt: pt });
    res.json({ success: true, panTilt: pt });
  } else {
    res.status(400).json({ error: 'Invalid direction. Use UP, DOWN, LEFT, RIGHT.' });
  }
});

app.post('/api/pantilt/home', (req, res) => {
  const pt = panTiltController.home();
  broadcast({ type: 'PANTILT_UPDATED', panTilt: pt });
  res.json({ success: true, panTilt: pt });
});

app.post('/api/pantilt/stop', (req, res) => {
  const pt = panTiltController.stop();
  broadcast({ type: 'PANTILT_UPDATED', panTilt: pt });
  res.json({ success: true, panTilt: pt });
});

app.post('/api/pantilt/step', (req, res) => {
  const { step } = req.body;
  const pt = panTiltController.setStepSize(Number(step));
  broadcast({ type: 'PANTILT_UPDATED', panTilt: pt });
  res.json({ success: true, panTilt: pt });
});

app.post('/api/pantilt/mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'MANUAL' || mode === 'AUTO_SCAN') {
    const pt = panTiltController.setMode(mode);
    broadcast({ type: 'PANTILT_UPDATED', panTilt: pt });
    res.json({ success: true, panTilt: pt });
  } else {
    res.status(400).json({ error: 'Invalid mode. Use MANUAL or AUTO_SCAN.' });
  }
});

app.post('/api/pantilt/set', (req, res) => {
  const { pan, tilt } = req.body;
  const pt = panTiltController.setPosition(Number(pan), Number(tilt));
  broadcast({ type: 'PANTILT_UPDATED', panTilt: pt });
  res.json({ success: true, panTilt: pt });
});

// ==================== CAMERA CONFIG, STATUS & REAL STREAM PROXY ====================
cameraProxy.on('statusChanged', (status) => {
  broadcast({ type: 'CAMERA_STATUS_CHANGED', camera: status });
});

cameraProxy.on('presenceChanged', (data) => {
  broadcast({ type: 'OPTICAL_PATIENT_DETECTION', ...data });
});

app.get('/api/camera/status', (req, res) => {
  res.json(cameraProxy.getStatus());
});

app.post('/api/camera/presence', (req, res) => {
  const { detected, confidence } = req.body;
  const status = cameraProxy.setVisualPresence(Boolean(detected), typeof confidence === 'number' ? confidence : (detected ? 85 : 0));
  broadcast({
    type: 'OPTICAL_PATIENT_DETECTION',
    patientDetected: status.patientDetected,
    confidence: status.detectionConfidence
  });
  res.json({ success: true, camera: status });
});

app.get('/api/camera/stream', (req, res) => {
  cameraProxy.handleClientStreamRequest(req, res);
});

app.post('/api/camera/config', (req, res) => {
  const { streamUrl } = req.body;
  if (streamUrl !== undefined) {
    cameraProxy.setStreamUrl(streamUrl);
  }
  const status = cameraProxy.getStatus();
  broadcast({ type: 'CAMERA_STATUS_CHANGED', camera: status });
  res.json({ success: true, camera: status });
});

// Fetch current OV3660 / OV2640 sensor settings from ESP32
app.get('/api/camera/settings', async (req, res) => {
  const result = await cameraProxy.getSensorSettings();
  res.json(result);
});

// Send single sensor parameter control to ESP32 (e.g. brightness, contrast, resolution, vflip, etc.)
app.post('/api/camera/control', async (req, res) => {
  const { var: variable, val } = req.body;
  if (!variable || val === undefined) {
    return res.status(400).json({ success: false, error: 'Missing variable name or value' });
  }
  const result = await cameraProxy.setControl(variable, val);
  res.json(result);
});

// Batch apply multiple sensor settings to ESP32
app.post('/api/camera/settings/batch', async (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ success: false, error: 'Settings object required' });
  }
  const results: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(settings)) {
    const resControl = await cameraProxy.setControl(k, v as any);
    results[k] = resControl.success;
  }
  res.json({ success: true, applied: results });
});

// ==================== AUTH & PRIVACY ENDPOINTS ====================
app.get('/api/auth/session', (req, res) => {
  res.json(authManager.getSession());
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const ua = req.headers['user-agent'] || 'Clinical Station Browser';
  const result = authManager.login(email, password, ip, ua);
  if (result.success && result.session) {
    broadcast({ type: 'AUTH_SESSION_UPDATED', session: result.session });
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});

app.post('/api/auth/register', (req, res) => {
  const result = authManager.register(req.body);
  if (result.success && result.session) {
    broadcast({ type: 'AUTH_SESSION_UPDATED', session: result.session });
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

app.post('/api/auth/google', async (req, res) => {
  const { idToken, credential } = req.body;
  const token = credential || idToken;
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const ua = req.headers['user-agent'] || 'Clinical Station Browser';
  const result = await authManager.handleGoogleAuth(token, ip, ua);
  if (result.success && result.session) {
    broadcast({ type: 'AUTH_SESSION_UPDATED', session: result.session });
    res.json(result);
  } else {
    res.status(result.isConfigured === false ? 400 : 401).json(result);
  }
});

app.post('/api/auth/request-otp', (req, res) => {
  const { email, tier, data } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const result = authManager.requestOtp(email, tier || 'PERSONAL', data || {});
  res.json(result);
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });
  const result = authManager.verifyOtp(email, otp);
  if (result.success && result.session) {
    broadcast({ type: 'AUTH_SESSION_UPDATED', session: result.session });
    res.json(result);
  } else {
    res.status(401).json(result);
  }
});


// ==================== ISOLATED DEVELOPER SIMULATION ENDPOINTS ====================
// Strictly for offline algorithmic debugging; NEVER automatically executed.
app.post('/api/dev/simulation/start', (req, res) => {
  activeMode = 'DEV_SIMULATION';
  startDemoStream();
  broadcast({
    type: 'MODE_CHANGED',
    mode: 'DEV_SIMULATION',
    warning: 'DIGITAL SIMULATION — NOT REAL SENSOR DATA'
  });
  res.json({ success: true, mode: 'DEV_SIMULATION', warning: 'DIGITAL SIMULATION — NOT REAL SENSOR DATA' });
});

app.post('/api/dev/simulation/stop', (req, res) => {
  stopDemoStream();
  activeMode = 'NO_DATA_SOURCE';
  broadcast({ type: 'MODE_CHANGED', mode: 'NO_DATA_SOURCE' });
  res.json({ success: true, mode: 'NO_DATA_SOURCE' });
});

app.post('/api/auth/logout', (req, res) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const ua = req.headers['user-agent'] || 'Clinical Station Browser';
  authManager.logout(ip, ua);
  const session = authManager.getSession();
  broadcast({ type: 'AUTH_SESSION_UPDATED', session });
  res.json({ success: true, session });
});


// ==================== ADMIN RBAC MIDDLEWARE ====================
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);
  
  const active = authManager.getSession();
  let session = token ? authManager.getSessionByToken(token) : null;
  if (!session && active && active.isAuthenticated && active.token === token) {
    session = active;
  }
  // Fallback if active session is already authenticated as ADMIN or Head Admin on the station
  if (!session && active && active.isAuthenticated && (active.role === 'ADMIN' || active.email?.toLowerCase().trim() === 'aseem323711@sahrdaya.ac.in')) {
    session = active;
  }

  const isHeadAdminEmail = session?.email?.toLowerCase().trim() === 'aseem323711@sahrdaya.ac.in';
  if (isHeadAdminEmail && session && session.role !== 'ADMIN') {
    session.role = 'ADMIN';
  }

  if (!session || !session.isAuthenticated || (session.role !== 'ADMIN' && !isHeadAdminEmail)) {
    return res.status(403).json({
      error: 'Access Denied: Main Head Control Administrator privileges required for this endpoint.',
      userRole: session?.role || 'UNAUTHENTICATED'
    });
  }
  next();
};

// ==================== CAMERA ILLUMINATION CONTROLLER ENDPOINTS ====================
app.get('/api/camera/illumination', (req, res) => {
  res.json(illuminationController.getStatus());
});

app.post('/api/camera/illumination/set', async (req, res) => {
  const { level } = req.body;
  if (typeof level !== 'number') {
    return res.status(400).json({ error: 'Numeric intensity level (-100 to +100) required' });
  }
  const result = await illuminationController.setIntensity(level);
  broadcast({ type: 'ILLUMINATION_UPDATED', illumination: result.state });
  res.json(result);
});

app.post('/api/camera/illumination/toggle', async (req, res) => {
  const { state } = req.body;
  const result = await illuminationController.toggleLed(typeof state === 'boolean' ? state : undefined);
  broadcast({ type: 'ILLUMINATION_UPDATED', illumination: result.state });
  res.json(result);
});

app.post('/api/camera/illumination/flash-full', async (req, res) => {
  const result = await illuminationController.turnFlashFull();
  broadcast({ type: 'ILLUMINATION_UPDATED', illumination: result.state });
  res.json(result);
});

app.post('/api/camera/illumination/reset', async (req, res) => {
  const result = await illuminationController.resetToDefault();
  broadcast({ type: 'ILLUMINATION_UPDATED', illumination: result.state });
  res.json(result);
});

app.post('/api/camera/illumination/mode', (req, res) => {
  const { mode } = req.body;
  const result = illuminationController.setMode(mode);
  broadcast({ type: 'ILLUMINATION_UPDATED', illumination: result });
  res.json({ success: true, state: result });
});

// ==================== ADMINISTRATOR USER MANAGEMENT & AUDIT LOGS ====================
app.get('/api/admin/users', requireAdmin, (req, res) => {
  res.json({ users: userStore.getAllUsers() });
});

app.post('/api/admin/users/status', requireAdmin, (req, res) => {
  const { email, status } = req.body;
  if (!email || !['ACTIVE', 'DISABLED'].includes(status)) {
    return res.status(400).json({ error: 'Valid email and status (ACTIVE/DISABLED) required' });
  }
  const success = userStore.setUserStatus(email, status);
  if (!success) {
    return res.status(400).json({ error: 'Cannot disable the primary station administrator account.' });
  }
  res.json({ success: true, users: userStore.getAllUsers() });
});

app.post('/api/admin/users/role', requireAdmin, (req, res) => {
  const { email, role } = req.body;
  if (!email || !['ADMIN', 'RESEARCHER', 'OPERATOR', 'OBSERVER'].includes(role)) {
    return res.status(400).json({ error: 'Valid email and role required' });
  }
  const success = userStore.setUserRole(email, role);
  res.json({ success, users: userStore.getAllUsers() });
});

// Instant User Clearance & Hanging Session Purge
app.post('/api/admin/users/purge-stale', requireAdmin, (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);
  const session = (token ? authManager.getSessionByToken(token) : null) || authManager.getSession();
  const preservedEmail = session?.email || 'aseem323711@sahrdaya.ac.in';

  const purgeResult = userStore.purgeStaleUsers(preservedEmail);
  const invalidatedSessions = authManager.clearAllSessionsExcept(token, preservedEmail);

  res.json({
    success: true,
    message: `Successfully cleared ${purgeResult.purgedCount} user account(s) and terminated ${invalidatedSessions} hanging session(s).`,
    purgedCount: purgeResult.purgedCount,
    invalidatedSessions,
    users: purgeResult.remainingUsers
  });
});

// Delete specific user account and revoke their active session
app.delete('/api/admin/users/:email', requireAdmin, (req, res) => {
  const emailToDelete = decodeURIComponent(req.params.email);
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);
  const session = (token ? authManager.getSessionByToken(token) : null) || authManager.getSession();
  const adminEmail = session?.email || 'aseem323711@sahrdaya.ac.in';

  const result = userStore.deleteUser(emailToDelete, adminEmail);
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Failed to delete user account.' });
  }

  const revokedSessions = authManager.revokeUserSessions(emailToDelete);
  res.json({
    success: true,
    message: `User account ${emailToDelete} permanently deleted and ${revokedSessions} active session(s) revoked.`,
    users: userStore.getAllUsers()
  });
});

app.get('/api/admin/access-logs', requireAdmin, (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  res.json({ logs: userStore.getAccessLogs(limit) });
});

// Clear audit logs stream
app.post('/api/admin/access-logs/clear', requireAdmin, (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);
  const session = (token ? authManager.getSessionByToken(token) : null) || authManager.getSession();
  const adminEmail = session?.email || 'aseem323711@sahrdaya.ac.in';

  const result = userStore.clearAccessLogs(adminEmail);
  res.json({
    success: true,
    message: `Access audit logs cleared successfully (${result.clearedCount} records removed).`,
    logs: userStore.getAccessLogs()
  });
});

app.get('/api/admin/access-logs/export', requireAdmin, (req, res) => {
  const csv = userStore.exportLogsCsv();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="biomedical_access_audit_${Date.now()}.csv"`);
  res.send(csv);
});

app.get('/api/auth/google/status', (req, res) => {
  const configured = Boolean(process.env.GOOGLE_CLIENT_ID);
  res.json({
    configured,
    clientId: configured ? process.env.GOOGLE_CLIENT_ID : null
  });
});

// ==================== CUSTOMER SERVICE & SUPPORT TICKETS ====================
app.get('/api/support/tickets', (req, res) => {
  const token = (req.query.token as string) || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null);
  const activeSession = authManager.getSession();
  const session = token ? authManager.getSessionByToken(token) : (activeSession.isAuthenticated ? activeSession : null);

  if (session?.role === 'ADMIN') {
    return res.json({ tickets: supportStore.getAllTickets() });
  }

  // Regular user returns their own tickets
  const userEmail = (req.query.email as string) || session?.email;
  if (userEmail) {
    return res.json({ tickets: supportStore.getTicketsByUser(userEmail) });
  }

  res.json({ tickets: supportStore.getAllTickets() });
});

app.get('/api/support/analytics', requireAdmin, (req, res) => {
  res.json(supportStore.getAnalytics());
});

app.post('/api/support/tickets', (req, res) => {
  const { customerName, customerEmail, role, category, priority, subject, description } = req.body;
  if (!subject || !description) {
    return res.status(400).json({ error: 'Subject and description are required' });
  }

  const ticket = supportStore.createTicket({
    customerName,
    customerEmail,
    role,
    category,
    priority,
    subject,
    description
  });

  res.json({ success: true, ticket });
});

app.patch('/api/support/tickets/:id/resolve', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { adminResolution, resolvedBy } = req.body;
  if (!adminResolution) {
    return res.status(400).json({ error: 'Admin resolution explanation is required' });
  }

  const updated = supportStore.resolveTicket(id, adminResolution, resolvedBy || 'Administrator');
  if (!updated) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  res.json({ success: true, ticket: updated });
});

app.patch('/api/support/tickets/:id/status', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['PENDING', 'IN_REVIEW', 'RESOLVED'].includes(status)) {
    return res.status(400).json({ error: 'Valid status required' });
  }

  const updated = supportStore.updateStatus(id, status);
  if (!updated) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  res.json({ success: true, ticket: updated });
});

app.delete('/api/support/tickets/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const deleted = supportStore.deleteTicket(id);
  res.json({ success: deleted });
});

server.listen(SERVER_CONFIG.PORT, () => {
  console.log(`[RADAR BACKEND] Server running on http://localhost:${SERVER_CONFIG.PORT}`);
  console.log(`[RADAR BACKEND] WebSocket server ready at ws://localhost:${SERVER_CONFIG.PORT}${SERVER_CONFIG.WS_PATH}`);
  console.log('[RADAR BACKEND] DATA INTEGRITY ENFORCED: Simulation is disabled by default.');
  console.log('[RADAR BACKEND] Status: Waiting for physical MR24BSD1 radar packets or dataset upload.');

  // Initialize background auto-scan for physical USB 24 GHz Radar
  radarSerialService.autoConnect().catch((err) => {
    console.log('[RADAR SERIAL] Initial serial scan complete:', err?.message || 'No physical COM port detected');
  });
});
