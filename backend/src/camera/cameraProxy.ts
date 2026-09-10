import http from 'http';
import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import { EventEmitter } from 'events';

export type CameraConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'STREAMING' | 'STREAM ERROR';

export interface CameraHardwareStatus {
  state: CameraConnectionState;
  streamUrl: string;
  hardwareIp: string;
  sensor: string;
  measuredFps: number;
  totalFramesReceived: number;
  lastFrameTime: number;
  isStreaming: boolean;
  errorMessage: string | null;
  lastCheckedTime: number;
  patientDetected: boolean;
  detectionConfidence: number;
}

export class CameraProxyManager extends EventEmitter {
  private state: CameraConnectionState = 'DISCONNECTED';
  private streamUrl: string = 'http://172.20.10.6:81/stream';
  private hardwareIp: string = '172.20.10.6';
  private sensor: string = 'OV3660';
  private measuredFps: number = 0;
  private totalFramesReceived: number = 0;
  private lastFrameTime: number = 0;
  private errorMessage: string | null = null;
  private lastCheckedTime: number = 0;
  private patientDetected: boolean = false;
  private detectionConfidence: number = 0;

  // Active HTTP request to the physical ESP32
  private esp32Request: http.ClientRequest | null = null;
  private esp32Response: http.IncomingMessage | null = null;

  // Set of connected browser responses
  private browserClients: Set<Response> = new Set();

  // Frame counting for genuine FPS calculation
  private framesThisSecond: number = 0;
  private fpsInterval: NodeJS.Timeout | null = null;
  private probeInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();

    // Load saved camera endpoint from disk if available
    try {
      const configPath = path.resolve(__dirname, '../../data/camera_config.json');
      if (fs.existsSync(configPath)) {
        const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (saved.streamUrl) {
          const norm = CameraProxyManager.normalizeUrl(saved.streamUrl);
          this.streamUrl = norm.streamUrl;
          this.hardwareIp = norm.hardwareIp;
        }
      }
    } catch {}

    // Genuine FPS calculation every second based on actual frame boundaries received
    this.fpsInterval = setInterval(() => {
      this.measuredFps = this.framesThisSecond;
      this.framesThisSecond = 0;

      // If in STREAMING state but no frames arrived in 2.5 seconds, mark STREAM ERROR
      if (this.state === 'STREAMING' && Date.now() - this.lastFrameTime > 2500) {
        this.setState('STREAM ERROR', 'Stream timed out — No frames received from physical ESP32-CAM');
        this.closeEsp32Stream();
      }
    }, 1000);

    // Periodic physical hardware probe every 3 seconds
    this.probeInterval = setInterval(() => {
      this.probeHardware();
    }, 3000);
  }

  public getStatus(): CameraHardwareStatus {
    return {
      state: this.state,
      streamUrl: this.streamUrl,
      hardwareIp: this.hardwareIp,
      sensor: this.sensor,
      measuredFps: this.measuredFps,
      totalFramesReceived: this.totalFramesReceived,
      lastFrameTime: this.lastFrameTime,
      isStreaming: this.state === 'STREAMING',
      errorMessage: this.errorMessage,
      lastCheckedTime: this.lastCheckedTime,
      patientDetected: this.patientDetected,
      detectionConfidence: this.detectionConfidence
    };
  }

  public setVisualPresence(detected: boolean, confidence: number = 0): CameraHardwareStatus {
    const changed = this.patientDetected !== detected || Math.abs(this.detectionConfidence - confidence) > 10;
    this.patientDetected = detected;
    this.detectionConfidence = Math.max(0, Math.min(100, Math.round(confidence)));
    if (changed) {
      this.emit('presenceChanged', { patientDetected: this.patientDetected, confidence: this.detectionConfidence });
      this.emit('statusChanged', this.getStatus());
    }
    return this.getStatus();
  }

  public static normalizeUrl(input: string): { streamUrl: string; hardwareIp: string } {
    let trimmed = (input || '').trim();
    if (!trimmed) {
      return { streamUrl: 'http://192.168.4.1:81/stream', hardwareIp: '192.168.4.1' };
    }
    trimmed = trimmed.replace(/\/+$/, '');

    // Plain IP: e.g. 192.168.1.85 or 155.155.0.204
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) {
      return { streamUrl: `http://${trimmed}:81/stream`, hardwareIp: trimmed };
    }

    // IP:port: e.g. 192.168.1.85:81
    if (/^(\d{1,3}\.){3}\d{1,3}:\d+$/.test(trimmed)) {
      const host = trimmed.split(':')[0];
      return { streamUrl: `http://${trimmed}/stream`, hardwareIp: host };
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = 'http://' + trimmed;
    }

    try {
      const parsed = new URL(trimmed);
      let port = parsed.port;
      let pathname = parsed.pathname;
      if (!port) {
        port = '81';
      }
      if (!pathname || pathname === '/') {
        pathname = '/stream';
      }
      const streamUrl = `${parsed.protocol}//${parsed.hostname}:${port}${pathname}`;
      return { streamUrl, hardwareIp: parsed.hostname };
    } catch {
      const ipMatch = trimmed.match(/(\d{1,3}\.){3}\d{1,3}/);
      const ip = ipMatch ? ipMatch[0] : '192.168.4.1';
      return { streamUrl: `http://${ip}:81/stream`, hardwareIp: ip };
    }
  }

  public setStreamUrl(url: string): CameraHardwareStatus {
    const norm = CameraProxyManager.normalizeUrl(url);
    if (norm.streamUrl && norm.streamUrl !== this.streamUrl) {
      this.streamUrl = norm.streamUrl;
      this.hardwareIp = norm.hardwareIp;

      // Save to disk so server restarts remember the IP
      try {
        const configPath = path.resolve(__dirname, '../../data/camera_config.json');
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify({ streamUrl: this.streamUrl, hardwareIp: this.hardwareIp }, null, 2));
      } catch (e) {
        console.error('[CameraProxy] Failed to save camera config:', e);
      }

      // Reconnect with new URL
      this.closeEsp32Stream();
      this.probeHardware();
    }
    return this.getStatus();
  }

  public getHardwareIp(): string {
    return this.hardwareIp;
  }

  // Send control command to ESP32: GET http://<hardwareIp>/control?var=<var>&val=<val>
  // Or http://<hardwareIp>/xclk?xclk=<val>
  // Send control command to ESP32: GET http://<hardwareIp>/control?var=<var>&val=<val>
  // Or http://<hardwareIp>/xclk?xclk=<val>
  public async setControl(variable: string, val: number | string): Promise<{ success: boolean; error?: string }> {
    const varName = variable.trim();
    let targetUrl: string;

    if (varName === 'xclk') {
      targetUrl = `http://${this.hardwareIp}/xclk?xclk=${encodeURIComponent(val)}`;
    } else {
      targetUrl = `http://${this.hardwareIp}/control?var=${encodeURIComponent(varName)}&val=${encodeURIComponent(val)}`;
    }

    return new Promise((resolve) => {
      const req = http.get(targetUrl, { timeout: 5000 }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: `ESP32 returned HTTP ${res.statusCode}: ${body}` });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: `Failed to reach ESP32 at ${this.hardwareIp}: ${err.message}` });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: `Connection to ESP32 at ${this.hardwareIp} timed out` });
      });
    });
  }

  // Fetch current live settings from ESP32 /status
  public async getSensorSettings(): Promise<{ success: boolean; settings?: any; error?: string }> {
    const statusUrl = `http://${this.hardwareIp}/status`;

    return new Promise((resolve) => {
      const req = http.get(statusUrl, { timeout: 5000 }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(body);
              if (parsed['0x3400'] !== undefined) {
                this.sensor = 'OV3660';
              } else if (parsed.sensor) {
                this.sensor = parsed.sensor;
              }
              resolve({ success: true, settings: parsed });
              return;
            } catch (e: any) {
              resolve({ success: false, error: 'Invalid JSON response from ESP32 camera /status' });
              return;
            }
          }
          resolve({ success: false, error: `ESP32 returned HTTP ${res.statusCode}` });
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: `ESP32 at ${this.hardwareIp} offline: ${err.message}` });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: `ESP32 at ${this.hardwareIp} timed out` });
      });
    });
  }

  private setState(newState: CameraConnectionState, errorMsg: string | null = null) {
    const changed = this.state !== newState || this.errorMessage !== errorMsg;
    this.state = newState;
    this.errorMessage = errorMsg;

    if (changed) {
      this.emit('statusChanged', this.getStatus());
    }
  }

  private consecutiveProbeFailures: number = 0;

  // Probe physical ESP32-CAM via HTTP GET /status
  public async probeHardware(): Promise<boolean> {
    this.lastCheckedTime = Date.now();
    const probeUrl = `http://${this.hardwareIp}/status`;

    return new Promise((resolve) => {
      const req = http.get(probeUrl, { timeout: 5000 }, (res) => {
        let rawData = '';
        res.on('data', chunk => { rawData += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            this.consecutiveProbeFailures = 0;
            try {
              const data = JSON.parse(rawData);
              if (data['0x3400'] !== undefined) {
                this.sensor = 'OV3660';
              } else if (data.sensor) {
                this.sensor = data.sensor;
              } else {
                this.sensor = 'OV2640 / OV3660';
              }
              if (this.state === 'DISCONNECTED' || this.state === 'STREAM ERROR') {
                this.setState('CONNECTED', null);
              }
              resolve(true);
              return;
            } catch {
              // HTTP 200 reached means ESP32 web server is live
              if (this.state === 'DISCONNECTED' || this.state === 'STREAM ERROR') {
                this.setState('CONNECTED', null);
              }
              resolve(true);
              return;
            }
          }
          resolve(false);
        });
      });

      req.on('error', (err) => {
        this.consecutiveProbeFailures++;
        // Only mark DISCONNECTED if 3 consecutive probes fail and we are not streaming
        if (this.state === 'STREAMING') {
          // Keep streaming state
        } else if (this.consecutiveProbeFailures >= 3 && this.state !== 'DISCONNECTED') {
          this.setState('DISCONNECTED', `ESP32-CAM unreachable at ${this.hardwareIp}`);
        }
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  // Connects to physical ESP32-CAM and pipes stream to browser clients
  private connectEsp32Stream() {
    if (this.esp32Request) return; // Already attempting or connected

    this.setState('CONNECTING', null);

    try {
      this.esp32Request = http.get(this.streamUrl, { timeout: 8000 }, (res) => {
        this.esp32Response = res;

        // Disable Nagle's algorithm for lowest possible streaming latency
        if (res.socket) {
          res.socket.setNoDelay(true);
        }

        if (res.statusCode !== 200) {
          this.setState('STREAM ERROR', `ESP32-CAM returned HTTP status ${res.statusCode}`);
          this.closeEsp32Stream();
          return;
        }

        const contentType = res.headers['content-type'] || 'multipart/x-mixed-replace;boundary=123456789000000000000987654321';
        this.setState('STREAMING', null);

        // Notify and configure existing browser clients
        this.browserClients.forEach(client => {
          if (!client.headersSent) {
            if (client.socket) {
              client.socket.setNoDelay(true);
            }
            client.writeHead(200, {
              'Content-Type': contentType,
              'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
              'Connection': 'close',
              'Pragma': 'no-cache',
              'X-Accel-Buffering': 'no'
            });
          }
        });

        // Parse chunks to calculate genuine FPS and forward immediately to browser clients
        res.on('data', (chunk: Buffer) => {
          this.lastFrameTime = Date.now();

          // Detect JPEG frame boundary in multipart stream
          // JPEG SOI marker is 0xFF 0xD8, boundary header contains Content-Type
          if (chunk.indexOf(Buffer.from([0xFF, 0xD8])) !== -1 || chunk.includes('Content-Type: image/jpeg')) {
            this.framesThisSecond++;
            this.totalFramesReceived++;
          }

          // Forward chunk to all connected browsers with low-latency backpressure bypass
          for (const client of Array.from(this.browserClients)) {
            try {
              // If client socket has high backpressure (> 32KB buffer backlog), skip to avoid 2-5s delay
              const socket = client.socket as any;
              if (socket && socket.writableLength && socket.writableLength > 32768) {
                continue; // Drop delayed frame data to keep live stream real-time
              }
              client.write(chunk);
            } catch (err) {
              this.browserClients.delete(client);
            }
          }
        });

        res.on('end', () => {
          this.setState('DISCONNECTED', 'Physical ESP32-CAM closed stream');
          this.closeEsp32Stream();
        });

        res.on('error', (err) => {
          this.setState('STREAM ERROR', `ESP32-CAM stream error: ${err.message}`);
          this.closeEsp32Stream();
        });
      });

      this.esp32Request.on('error', (err) => {
        this.setState('DISCONNECTED', `Cannot connect to physical ESP32-CAM at ${this.streamUrl} (${err.message})`);
        this.closeEsp32Stream();
      });

      this.esp32Request.on('timeout', () => {
        this.setState('STREAM ERROR', 'Connection to physical ESP32-CAM timed out');
        this.closeEsp32Stream();
      });

    } catch (err: any) {
      this.setState('STREAM ERROR', `Failed to open stream socket: ${err.message}`);
      this.closeEsp32Stream();
    }
  }

  private closeEsp32Stream() {
    if (this.esp32Response) {
      try { this.esp32Response.destroy(); } catch {}
      this.esp32Response = null;
    }
    if (this.esp32Request) {
      try { this.esp32Request.destroy(); } catch {}
      this.esp32Request = null;
    }

    // End all client responses cleanly
    this.browserClients.forEach(client => {
      try { client.end(); } catch {}
    });
    this.browserClients.clear();
    this.measuredFps = 0;
  }

  // Express handler for GET /api/camera/stream
  public handleClientStreamRequest(req: any, res: Response) {
    if (res.socket) {
      res.socket.setNoDelay(true);
    }
    // Add client to active broadcast set
    this.browserClients.add(res);

    req.on('close', () => {
      this.browserClients.delete(res);
      // If no browsers are viewing, close ESP32 stream to conserve microcontroller bandwidth & heat
      if (this.browserClients.size === 0) {
        this.closeEsp32Stream();
      }
    });

    // If ESP32 stream is already flowing, send headers to new client
    if (this.state === 'STREAMING' && this.esp32Response) {
      const contentType = this.esp32Response.headers['content-type'] || 'multipart/x-mixed-replace;boundary=123456789000000000000987654321';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Connection': 'close',
        'Pragma': 'no-cache',
        'X-Accel-Buffering': 'no'
      });
    } else {
      // Trigger connection to physical ESP32-CAM
      this.connectEsp32Stream();
    }
  }

  public destroy() {
    if (this.fpsInterval) clearInterval(this.fpsInterval);
    if (this.probeInterval) clearInterval(this.probeInterval);
    this.closeEsp32Stream();
  }
}

export const cameraProxy = new CameraProxyManager();
