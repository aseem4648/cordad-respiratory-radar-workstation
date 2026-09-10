import { StandardRadarPacket, RadarTelemetry, MonitoringEvent, SystemSettings } from '../types';

export type MessageHandler = (data: {
  type: string;
  packet?: StandardRadarPacket;
  telemetry?: RadarTelemetry;
  event?: MonitoringEvent;
  settings?: SystemSettings;
  mode?: 'LIVE_RADAR' | 'DEMO_MODE';
  scenario?: string;
  paused?: boolean;
  recordingStatus?: any;
  recentEvents?: any;
  status?: any;
  [key: string]: any;
}) => void;

function getDefaultWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:5000/ws/radar';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Use Vite proxy path if on port 3000 or same port, else fallback to host:5000
  return `${protocol}//${window.location.host}/ws/radar`;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string = getDefaultWsUrl();
  private listeners: Set<MessageHandler> = new Set();
  private reconnectIntervalMs = 2000;
  private reconnectTimer: any = null;
  private shouldReconnect = true;
  private connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'RECONNECTING' = 'DISCONNECTED';
  private onStatusChangeCallbacks: Set<(status: string) => void> = new Set();

  public connect(url?: string) {
    if (url) this.url = url;
    else if (!this.url) this.url = getDefaultWsUrl();

    if (this.ws) {
      this.shouldReconnect = false;
      this.ws.close();
    }

    this.shouldReconnect = true;
    this.setStatus('CONNECTING');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.listeners.forEach(cb => cb(data));
        } catch (err) {
          console.error('[WS] Failed to parse message', err);
        }
      };

      this.ws.onclose = () => {
        this.setStatus('DISCONNECTED');
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.setStatus('DISCONNECTED');
      };
    } catch (err) {
      console.error('[WS] Error initiating connection', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.setStatus('RECONNECTING');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldReconnect) {
        this.connect();
      }
    }, this.reconnectIntervalMs);
  }

  public subscribe(handler: MessageHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  public onStatusChange(callback: (status: string) => void): () => void {
    this.onStatusChangeCallbacks.add(callback);
    callback(this.connectionStatus);
    return () => {
      this.onStatusChangeCallbacks.delete(callback);
    };
  }

  private setStatus(status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'RECONNECTING') {
    this.connectionStatus = status;
    this.onStatusChangeCallbacks.forEach(cb => cb(status));
  }

  public send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.close();
  }
}

export const wsService = new WebSocketService();
