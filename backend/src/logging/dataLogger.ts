import { StandardRadarPacket, MonitoringEvent } from '../../../hardware-interface/types';

export class DataLogger {
  private maxBufferSize = 50000;
  private buffer: StandardRadarPacket[] = [];
  private eventHistory: MonitoringEvent[] = [];
  private isRecording = false;
  private sessionStartTime: number | null = null;
  private sessionEndTime: number | null = null;
  private recordedBuffer: StandardRadarPacket[] = [];

  public logSample(packet: StandardRadarPacket) {
    this.buffer.push(packet);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    if (this.isRecording) {
      this.recordedBuffer.push(packet);
    }
  }

  public logEvent(event: MonitoringEvent) {
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > 500) {
      this.eventHistory.pop();
    }
  }

  public startRecording() {
    this.isRecording = true;
    this.sessionStartTime = Date.now();
    this.sessionEndTime = null;
    this.recordedBuffer = [];
  }

  public stopRecording() {
    this.isRecording = false;
    this.sessionEndTime = Date.now();
  }

  public clearSession() {
    this.isRecording = false;
    this.sessionStartTime = null;
    this.sessionEndTime = null;
    this.recordedBuffer = [];
  }

  public clearEvents() {
    this.eventHistory = [];
  }

  public getStatus() {
    const now = Date.now();
    let durationSeconds = 0;
    if (this.isRecording && this.sessionStartTime) {
      durationSeconds = Math.floor((now - this.sessionStartTime) / 1000);
    } else if (this.sessionStartTime && this.sessionEndTime) {
      durationSeconds = Math.floor((this.sessionEndTime - this.sessionStartTime) / 1000);
    }

    return {
      isRecording: this.isRecording,
      sessionStartTime: this.sessionStartTime,
      sessionEndTime: this.sessionEndTime,
      durationSeconds,
      recordedSamplesCount: this.recordedBuffer.length,
      totalBufferedSamples: this.buffer.length,
      eventsCount: this.eventHistory.length
    };
  }

  public getRecordedData(): StandardRadarPacket[] {
    return this.recordedBuffer.length > 0 ? this.recordedBuffer : this.buffer;
  }

  public getRecentEvents(limit = 100): MonitoringEvent[] {
    return this.eventHistory.slice(0, limit);
  }
}

export const dataLogger = new DataLogger();
