import { DemoScenario } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL 
  ? `${(import.meta as any).env.VITE_API_URL.replace(/\/$/, '')}/api` 
  : '/api';

export const apiService = {
  async getStatus() {
    const res = await fetch(`${API_BASE}/status`);
    return res.json();
  },

  async setMode(mode: 'LIVE_RADAR' | 'DEMO_MODE') {
    const res = await fetch(`${API_BASE}/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    return res.json();
  },

  async setScenario(scenario: DemoScenario) {
    const res = await fetch(`${API_BASE}/demo/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario })
    });
    return res.json();
  },

  async startRecording() {
    const res = await fetch(`${API_BASE}/recording/start`, { method: 'POST' });
    return res.json();
  },

  async stopRecording() {
    const res = await fetch(`${API_BASE}/recording/stop`, { method: 'POST' });
    return res.json();
  },

  async clearRecording() {
    const res = await fetch(`${API_BASE}/recording/clear`, { method: 'POST' });
    return res.json();
  },

  async clearEvents() {
    const res = await fetch(`${API_BASE}/events/clear`, { method: 'POST' });
    return res.json();
  },

  getExportCsvUrl() {
    return `${API_BASE}/recording/export`;
  },

  // Pan-Tilt Controls
  async getPanTiltStatus() {
    const res = await fetch(`${API_BASE}/pantilt/status`);
    return res.json();
  },

  async movePanTilt(direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', step?: number) {
    const res = await fetch(`${API_BASE}/pantilt/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction, step })
    });
    return res.json();
  },

  async homePanTilt() {
    const res = await fetch(`${API_BASE}/pantilt/home`, { method: 'POST' });
    return res.json();
  },

  async stopPanTilt() {
    const res = await fetch(`${API_BASE}/pantilt/stop`, { method: 'POST' });
    return res.json();
  },

  async setPanTiltStep(step: number) {
    const res = await fetch(`${API_BASE}/pantilt/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step })
    });
    return res.json();
  },

  async setPanTiltMode(mode: 'MANUAL' | 'AUTO_SCAN') {
    const res = await fetch(`${API_BASE}/pantilt/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    return res.json();
  },

  async setPanTiltAngles(pan: number, tilt: number) {
    const res = await fetch(`${API_BASE}/pantilt/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pan, tilt })
    });
    return res.json();
  },

  // Camera Endpoints
  async getCameraStatus() {
    const res = await fetch(`${API_BASE}/camera/status`);
    return res.json();
  },

  async updateCameraConfig(config: { streamUrl?: string; enabled?: boolean }) {
    const res = await fetch(`${API_BASE}/camera/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return res.json();
  },

  async getCameraSettings() {
    const res = await fetch(`${API_BASE}/camera/settings`);
    return res.json();
  },

  async setCameraControl(variable: string, val: number | string) {
    const res = await fetch(`${API_BASE}/camera/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ var: variable, val })
    });
    return res.json();
  },

  async batchSetCameraSettings(settings: Record<string, any>) {
    const res = await fetch(`${API_BASE}/camera/settings/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    });
    return res.json();
  },

  async updateVisualPresence(detected: boolean, confidence: number = 0) {
    const res = await fetch(`${API_BASE}/camera/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ detected, confidence })
    });
    return res.json();
  },

  async getSession() {
    const res = await fetch(`${API_BASE}/auth/session`);
    return res.json();
  },

  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  },

  async register(data: any) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async googleLogin(idToken?: string) {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    return res.json();
  },

  async requestOtp(email: string, tier: string, data?: any) {
    const res = await fetch(`${API_BASE}/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, tier, data })
    });
    return res.json();
  },

  async verifyOtp(email: string, otp: string) {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    });
    return res.json();
  },

  async logout() {
    const res = await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    return res.json();
  },

  // Illumination Endpoints
  async getIllumination() {
    const res = await fetch(`${API_BASE}/camera/illumination`);
    return res.json();
  },

  async setIllumination(level: number) {
    const res = await fetch(`${API_BASE}/camera/illumination/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level })
    });
    return res.json();
  },

  async resetIllumination() {
    const res = await fetch(`${API_BASE}/camera/illumination/reset`, { method: 'POST' });
    return res.json();
  },

  async toggleIllumination(state?: boolean) {
    const res = await fetch(`${API_BASE}/camera/illumination/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state })
    });
    return res.json();
  },

  async flashFullIllumination() {
    const res = await fetch(`${API_BASE}/camera/illumination/flash-full`, { method: 'POST' });
    return res.json();
  },

  async getGoogleAuthStatus() {
    const res = await fetch(`${API_BASE}/auth/google/status`);
    return res.json();
  },

  // Support & Customer Queries Endpoints
  async getSupportTickets(token?: string, email?: string) {
    const params = new URLSearchParams();
    if (token) params.append('token', token);
    if (email) params.append('email', email);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/support/tickets${qs}`, { headers });
    return res.json();
  },

  async getSupportAnalytics(token?: string) {
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/support/analytics`, { headers });
    return res.json();
  },

  async createSupportTicket(data: any) {
    const res = await fetch(`${API_BASE}/support/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async resolveSupportTicket(id: string, adminResolution: string, resolvedBy?: string, token?: string) {
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/support/tickets/${id}/resolve`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ adminResolution, resolvedBy })
    });
    return res.json();
  },

  async updateTicketStatus(id: string, status: string, token?: string) {
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/support/tickets/${id}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status })
    });
    return res.json();
  },

  async deleteSupportTicket(id: string, token?: string) {
    const headers: any = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/support/tickets/${id}`, {
      method: 'DELETE',
      headers
    });
    return res.json();
  }
};

