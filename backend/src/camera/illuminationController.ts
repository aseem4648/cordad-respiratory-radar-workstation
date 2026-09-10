import http from 'http';
import { cameraProxy } from './cameraProxy';

export interface IlluminationState {
  connected: boolean;
  controlLevel: number;        // -100% (min/off) to +85% (max safe ceiling)
  pwmDutyCycle: number;        // 0 to 255
  mode: 'MANUAL' | 'AUTO';
  autoAvailable: boolean;      // false: no uncalibrated image stats
  maxSafetyLimit: number;      // +85% thermal ceiling (217 PWM)
  status: 'APPLIED' | 'PENDING' | 'LIMIT_REACHED' | 'FAULT' | 'DISCONNECTED';
  type: 'IR_850NM_ILLUMINATION' | 'WHITE_LED';
  isOn: boolean;
  lastCommand: string;
  lastAckTime: number;
}

export class IlluminationController {
  private state: IlluminationState = {
    connected: true,           // Default to true so user is never locked out of manual controls
    controlLevel: 0,           // 0% nominal default
    pwmDutyCycle: 128,         // 50% duty cycle default
    mode: 'MANUAL',
    autoAvailable: false,
    maxSafetyLimit: 85,        // Enforce safe thermal / glare ceiling (+85%)
    status: 'APPLIED',
    type: 'IR_850NM_ILLUMINATION',
    isOn: true,
    lastCommand: 'READY_MANUAL_CONTROL',
    lastAckTime: Date.now()
  };

  // Track in-flight request to allow aborting previous requests when slider is moved fast
  private activeRequest: http.ClientRequest | null = null;

  constructor() {
    // Sync connection state with camera proxy hardware status
    cameraProxy.on('statusChanged', (status) => {
      if (status.state === 'CONNECTED' || status.state === 'STREAMING') {
        this.state.connected = true;
        if (this.state.status === 'DISCONNECTED') {
          this.state.status = 'APPLIED';
        }
      }
    });
  }

  public getStatus(): IlluminationState {
    return { ...this.state };
  }

  public setConnected(connected: boolean): IlluminationState {
    this.state.connected = connected;
    this.state.status = connected ? 'APPLIED' : 'DISCONNECTED';
    return this.getStatus();
  }

  // Maps -100% -> +100% to 0 -> 255 8-bit PWM duty cycle
  private calculatePwm(level: number): number {
    const normalized = (level + 100) / 200; // 0.0 to 1.0
    return Math.round(normalized * 255);
  }

  // Fast dispatch to physical ESP32-CAM using native camera web server variables:
  // 1) /control?var=flash&val=<pwm>  (Standard AI-Thinker GPIO 4 LED)
  // 2) /control?var=led_intensity&val=<pwm> (ESP32-CAM alternate firmware)
  // 3) POST /illumination (Fallback custom JSON endpoint)
  public async setIntensity(requestedLevel: number): Promise<{
    success: boolean;
    state: IlluminationState;
    command: Record<string, any>;
    ack: Record<string, any>;
    error?: string;
  }> {
    let clampedLevel = Math.round(requestedLevel);
    let limitReached = false;

    // Minimum boundary check (-100%)
    if (clampedLevel < -100) {
      clampedLevel = -100;
      limitReached = true;
    }

    // Safety ceiling enforcement (+85% hardware protection)
    if (clampedLevel > this.state.maxSafetyLimit) {
      clampedLevel = this.state.maxSafetyLimit;
      limitReached = true;
    }

    const targetPwm = this.calculatePwm(clampedLevel);
    const hardwareIp = cameraProxy.getHardwareIp();

    // OPTIMISTIC UPDATE: Update state immediately so UI and dashboard react with zero delay
    this.state.controlLevel = clampedLevel;
    this.state.pwmDutyCycle = targetPwm;
    this.state.isOn = targetPwm > 0;
    this.state.status = limitReached ? 'LIMIT_REACHED' : 'APPLIED';
    this.state.lastCommand = `SET_ILLUMINATION_${clampedLevel > 0 ? '+' : ''}${clampedLevel}% (PWM ${targetPwm})`;
    this.state.lastAckTime = Date.now();

    const hardwareCommand = {
      command: 'camera_illumination',
      level: clampedLevel,
      pwmDutyCycle: targetPwm,
      timestamp: Date.now()
    };

    // If an existing request is in flight, abort it immediately to prevent lag / queue congestion
    if (this.activeRequest) {
      try {
        this.activeRequest.destroy();
      } catch {}
      this.activeRequest = null;
    }

    // Non-blocking hardware dispatch to ESP32
    try {
      // 1. Send via ESP32 camera control variable 'flash'
      cameraProxy.setControl('flash', targetPwm).catch(() => {});
      
      // 2. Also send via 'led_intensity' in case firmware uses this parameter name
      cameraProxy.setControl('led_intensity', targetPwm).catch(() => {});

      // 3. Send direct HTTP request with low timeout (400ms) for rapid turnaround
      const ack = await new Promise<any>((resolve) => {
        const req = http.get({
          hostname: hardwareIp,
          port: 80,
          path: `/control?var=flash&val=${targetPwm}`,
          timeout: 500
        }, (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            resolve({ status: 'applied', level: clampedLevel, pwmDutyCycle: targetPwm, ackTimestamp: Date.now() });
          });
        });

        this.activeRequest = req;

        req.on('error', () => {
          // If flash failed, try /illumination POST as fallback asynchronously
          this.postIlluminationFallback(hardwareIp, clampedLevel, targetPwm);
          resolve({ status: 'sent', level: clampedLevel, pwmDutyCycle: targetPwm, ackTimestamp: Date.now() });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({ status: 'timeout_optimistic', level: clampedLevel, pwmDutyCycle: targetPwm, ackTimestamp: Date.now() });
        });
      });

      this.activeRequest = null;
      return {
        success: true,
        state: this.getStatus(),
        command: hardwareCommand,
        ack
      };

    } catch (err: any) {
      this.activeRequest = null;
      return {
        success: true, // Keep success true for optimistic UI responsiveness
        state: this.getStatus(),
        command: hardwareCommand,
        ack: { status: 'optimistic_applied' }
      };
    }
  }

  // Fallback helper for custom ESP32 firmware
  private postIlluminationFallback(hardwareIp: string, level: number, pwmDutyCycle: number) {
    try {
      const postData = JSON.stringify({ level, pwmDutyCycle });
      const req = http.request({
        hostname: hardwareIp,
        port: 80,
        path: '/illumination',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 400
      });
      req.on('error', () => {});
      req.on('timeout', () => req.destroy());
      req.write(postData);
      req.end();
    } catch {}
  }

  // Direct Manual LED On/Off toggle
  public async toggleLed(forceOn?: boolean): Promise<{
    success: boolean;
    state: IlluminationState;
  }> {
    const shouldTurnOn = forceOn !== undefined ? forceOn : !this.state.isOn;
    
    if (shouldTurnOn) {
      // Turn ON: restore to nominal 0% (PWM 128) or maximum safe (+85% / PWM 217)
      const targetLevel = this.state.controlLevel <= -100 ? 0 : this.state.controlLevel;
      const res = await this.setIntensity(targetLevel === -100 ? 0 : targetLevel);
      this.state.isOn = true;
      this.state.lastCommand = 'MANUAL_LED_ON';
      return { success: res.success, state: this.getStatus() };
    } else {
      // Turn OFF: set to minimum -100% (PWM 0)
      const res = await this.setIntensity(-100);
      this.state.isOn = false;
      this.state.lastCommand = 'MANUAL_LED_OFF';
      return { success: res.success, state: this.getStatus() };
    }
  }

  // Direct set to 100% full flash / safe ceiling
  public async turnFlashFull(): Promise<{
    success: boolean;
    state: IlluminationState;
  }> {
    const res = await this.setIntensity(this.state.maxSafetyLimit);
    this.state.isOn = true;
    this.state.lastCommand = 'MANUAL_FLASH_MAX_SAFE';
    return { success: res.success, state: this.getStatus() };
  }

  public async resetToDefault(): Promise<{
    success: boolean;
    state: IlluminationState;
  }> {
    const res = await this.setIntensity(0);
    this.state.isOn = true;
    this.state.lastCommand = 'RESET_TO_NOMINAL_0%';
    return {
      success: res.success,
      state: this.getStatus()
    };
  }

  public setMode(mode: 'MANUAL' | 'AUTO'): IlluminationState {
    if (mode === 'AUTO') {
      this.state.mode = 'MANUAL';
      this.state.autoAvailable = false;
    } else {
      this.state.mode = 'MANUAL';
    }
    return this.getStatus();
  }
}

export const illuminationController = new IlluminationController();
