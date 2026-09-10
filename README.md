# Contactless Respiratory Distress & Apnea Detection System
### 24 GHz FMCW Radar-Based Non-Contact Physiological Monitoring Workstation

A complete, production-grade biomedical engineering system for contactless bedside respiratory monitoring, real-time waveform visualization, signal quality index calculation, respiratory rate estimation, and apnea detection using 24 GHz FMCW radar telemetry.

---

## System Architecture

```
24 GHz FMCW RADAR
        | (Micro-Doppler chest displacement)
        v
ESP32 Gateway (UART to Wi-Fi)
        | (WebSocket Streaming @ 20 Hz)
        v
Node.js Backend & DSP Service
        ├── Hardware Abstraction Layer (RadarDataAdapter)
        ├── DC Baseline Detrending
        ├── 2nd-Order Butterworth Bandpass Filter (0.10 - 0.70 Hz / 6 - 42 BPM)
        ├── Respiratory Rate Periodicity Estimator (Peak-to-Peak & Autocorrelation)
        ├── Signal Quality Index (SQI) Engine (0 - 100%)
        ├── Biomedical State Machine (Normal, Apnea, Tachypnea, Bradypnea)
        └── Session Logger & CSV Exporter (Excel / MATLAB / Python compatible)
        |
        v
Web Dashboard (React + TypeScript + Canvas Oscilloscope)
        ├── 60fps Real-Time Oscilloscope Waveform (10s, 30s, 60s, 120s windows)
        ├── Large Clinical KPI Parameter Cards (Welch Allyn EarlyVue VS30 style)
        ├── Live Respiratory Rate Trend Analysis (1m, 5m, 15m, 30m, 1h)
        ├── Real-Time Event Timeline with Severity Classification
        ├── Hardware Telemetry & Raw Data Stream Inspector
        └── One-Click CSV Session Recording & Export
```

---

## Key Features

1. **Strict Data Integrity Guarantee**:
   - Zero fabricated physiological values in Live Radar mode when disconnected (`--`, `Waiting for 24 GHz radar input`).
   - Clearly distinguishes between **Measured**, **Calculated**, **Detected**, and **System Status**.
   - Clear banner whenever **DEMO / SIMULATED DATA** is active.

2. **Biomedical Digital Signal Processing (DSP)**:
   - **Bandpass Filtering**: 0.10 Hz to 0.70 Hz passband tailored for thoracic displacement.
   - **Respiratory Rate Estimation**: Dual-method consensus using peak detection with dynamic refractory timing and autocorrelation frequency extraction.
   - **Signal Quality Index (SQI)**: Real-time 0-100% calculation factoring amplitude envelope, SNR, periodicity, and motion artifacts.
   - **Apnea Event Detection**: Configurable duration threshold (default: 10.0s) that cleanly separates true chest flatline from sensor disconnection or target absence.

3. **High-Performance Web Oscilloscope**:
   - 60 FPS hardware-accelerated Canvas rendering with medical grid, zero baseline, dynamic auto-gain, and time window selection (10s, 30s, 60s, 120s).

4. **Validation Test Scenarios (Demo Mode)**:
   - **Normal Breathing** (~16 BPM)
   - **Possible Apnea Event** (14s flatline cessation followed by recovery gasp)
   - **Rapid Breathing / Tachypnea** (~28 BPM)
   - **Slow Breathing / Bradypnea** (~8 BPM)
   - **Body Motion Artifact** (Chaotic high-amplitude displacement)
   - **Signal Drop** (Degraded SNR)
   - **Target Absent** (Patient leaves radar detection zone)
   - **Radar Disconnected** (Stream interruption)

---

## Quick Start Guide

### Prerequisites
- **Node.js**: v18+ or v20+ or v24+
- **npm**: v9+

### 1. Start the Backend Service
```bash
cd backend
npm install
npm run dev
```
Backend will start on `http://localhost:5000` with WebSocket server at `ws://localhost:5000/ws/radar`.

### 2. Start the Frontend Dashboard
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open your browser at `http://localhost:3000`.

### 3. Run DSP Unit Tests
```bash
cd backend
npm test
```

---

## Connecting Physical 24 GHz Radar Hardware

1. Flash the ESP32 sketch located at `hardware/esp32/esp32_radar_websocket.ino`.
2. Connect your 24 GHz FMCW radar UART output to ESP32 Pin 16 (RX2).
3. Ensure ESP32 and Backend are on the same Wi-Fi network.
4. On the web dashboard, click **"Switch to Live Radar"**.
5. Telemetry link will turn green, and real radar chest motion will scroll across the screen.

See `hardware/radar/LD2410_BGT24_Protocol_Guide.md` for full wiring diagrams and packet formats.

---

## Exporting & Analyzing CSV Data

Click **"START RECORDING"** on the dashboard to log the session. When finished, click **"STOP RECORDING"** and **"EXPORT CSV"**.

The generated CSV is formatted for immediate import in Python:
```python
import pandas as pd
import matplotlib.pyplot as plt

# Load radar session data
df = pd.read_csv('radar_respiration_session.csv', comment='#')

# Plot filtered respiratory waveform
plt.figure(figsize=(12, 4))
plt.plot(df['timestamp_ms'] / 1000, df['filtered_respiratory_signal'], color='cyan')
plt.title('24 GHz FMCW Radar Respiratory Waveform')
plt.xlabel('Time (s)')
plt.ylabel('Chest Displacement (mm)')
plt.grid(True)
plt.show()
```

Or in MATLAB:
```matlab
data = readtable('radar_respiration_session.csv', 'CommentStyle', '#');
plot(data.timestamp_ms / 1000, data.filtered_respiratory_signal);
xlabel('Time (s)');
ylabel('Displacement (mm)');
title('24 GHz FMCW Radar Respiration Signal');
```

---

## Disclaimer
*This system is a student biomedical engineering prototype designed for research and educational validation. It is not a certified medical device and is not intended for clinical diagnosis.*
