/**
 * 24 GHz FMCW Radar Serial Listener & Auto-Reconnect Service
 * Connects to Seeed MR24BSD1 / USB-UART transceiver at 115200 baud.
 */

import { EventEmitter } from 'events';
import { SerialPort } from 'serialport';
import { RadarParser } from './radarParser';
import { RawRadarPayload } from '../../../hardware-interface/types';

export interface RadarSerialConfig {
  baudRate?: number;
  autoConnect?: boolean;
  reconnectIntervalMs?: number;
}

export class RadarSerialService extends EventEmitter {
  private port: SerialPort | null = null;
  private currentPath: string | null = null;
  private isConnecting: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private parser: RadarParser = new RadarParser();
  private baudRate: number = 115200;
  private reconnectIntervalMs: number = 3000;

  constructor(config?: RadarSerialConfig) {
    super();
    if (config?.baudRate) this.baudRate = config.baudRate;
    if (config?.reconnectIntervalMs) this.reconnectIntervalMs = config.reconnectIntervalMs;
  }

  /**
   * List all system serial COM ports
   */
  public async listPorts(): Promise<any[]> {
    try {
      return await SerialPort.list();
    } catch (err) {
      console.warn('[RADAR SERIAL] Error listing ports:', err);
      return [];
    }
  }

  /**
   * Automatically detect and connect to 24 GHz radar COM port
   */
  public async autoConnect(): Promise<boolean> {
    if (this.isConnecting || (this.port && this.port.isOpen)) return true;
    this.isConnecting = true;

    try {
      const ports = await this.listPorts();
      if (!ports || ports.length === 0) {
        this.scheduleReconnect();
        this.isConnecting = false;
        return false;
      }

      // Prioritize devices matching USB-to-UART chips (CP210x, CH340, FTDI, Seeed)
      const matched = ports.find((p) => {
        const desc = `${p.manufacturer || ''} ${p.friendlyName || ''} ${p.vendorId || ''}`.toLowerCase();
        return desc.includes('cp210') || desc.includes('ch340') || desc.includes('ftdi') || desc.includes('silicon labs') || desc.includes('usb-serial');
      }) || ports[0];

      if (matched && matched.path) {
        return await this.connect(matched.path);
      }
    } catch (err) {
      console.warn('[RADAR SERIAL] Auto-connect scan failed:', err);
    } finally {
      this.isConnecting = false;
    }

    this.scheduleReconnect();
    return false;
  }

  /**
   * Connect to specific COM port
   */
  public async connect(path: string): Promise<boolean> {
    if (this.port && this.port.isOpen) {
      if (this.currentPath === path) return true;
      await this.disconnect();
    }

    this.currentPath = path;

    return new Promise((resolve) => {
      try {
        console.log(`[RADAR SERIAL] Opening serial link to 24 GHz FMCW Radar on ${path} at ${this.baudRate} baud...`);
        this.port = new SerialPort({
          path,
          baudRate: this.baudRate,
          autoOpen: false
        });

        this.port.open((err) => {
          if (err) {
            console.warn(`[RADAR SERIAL] Failed to open ${path}:`, err.message);
            this.port = null;
            this.scheduleReconnect();
            resolve(false);
            return;
          }

          console.log(`[RADAR SERIAL] Successfully connected to 24 GHz FMCW Radar on ${path}`);
          this.emit('connected', { path, baudRate: this.baudRate });

          let stringBuffer = '';

          this.port!.on('data', (chunk: Buffer) => {
            // 1. Try binary MR24 frame parsing
            const binaryPayloads = this.parser.parseBinaryChunk(chunk);
            for (const payload of binaryPayloads) {
              this.emit('payload', payload);
            }

            // 2. Also support line-delimited ASCII / JSON data
            stringBuffer += chunk.toString('utf-8');
            const lines = stringBuffer.split(/\r?\n/);
            stringBuffer = lines.pop() || '';

            for (const line of lines) {
              const parsed = RadarParser.parseString(line);
              if (parsed) {
                this.emit('payload', parsed);
              }
            }
          });

          this.port!.on('error', (portErr) => {
            console.warn(`[RADAR SERIAL] Port error on ${path}:`, portErr.message);
            this.emit('error', portErr);
          });

          this.port!.on('close', () => {
            console.log(`[RADAR SERIAL] Port closed on ${path}`);
            this.emit('disconnected', { path });
            this.port = null;
            this.scheduleReconnect();
          });

          resolve(true);
        });
      } catch (err: any) {
        console.warn(`[RADAR SERIAL] Unexpected error opening ${path}:`, err?.message);
        this.scheduleReconnect();
        resolve(false);
      }
    });
  }

  public async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.port && this.port.isOpen) {
      await new Promise<void>((res) => {
        this.port!.close(() => res());
      });
      this.port = null;
    }
  }

  public getStatus() {
    return {
      connected: Boolean(this.port && this.port.isOpen),
      port: this.currentPath,
      baudRate: this.baudRate
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.autoConnect();
    }, this.reconnectIntervalMs);
  }
}

export const radarSerialService = new RadarSerialService();
