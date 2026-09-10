# 24 GHz FMCW Radar Hardware Integration Guide

This document describes how to connect physical 24 GHz FMCW (Frequency-Modulated Continuous-Wave) radar sensors to the Contactless Respiratory Monitoring System.

---

## 1. Hardware Architecture

```
+--------------------------+        UART (115200 Baud)        +-------------------+
|  24 GHz FMCW Radar       | -------------------------------> |   ESP32 Gateway   |
|  (Thoracic Micro-Doppler)|    TX2 (Pin 16) / RX2 (Pin 17)   |   (WiFi + WS)     |
+--------------------------+                                  +-------------------+
                                                                        |
                                                                        | Wi-Fi (WebSocket)
                                                                        v
                                                              +-------------------+
                                                              |  Node.js Backend  |
                                                              |  & DSP Pipeline   |
                                                              +-------------------+
                                                                        |
                                                                        v
                                                              +-------------------+
                                                              |  Web Dashboard    |
                                                              |  (Oscilloscope UI)|
                                                              +-------------------+
```

---

## 2. Pin Connections

| 24 GHz Radar Pin | ESP32 Pin | Description |
| :--- | :--- | :--- |
| **VCC** | **5V / VIN** | Power supply (check radar module voltage specs) |
| **GND** | **GND** | Ground reference |
| **TX (Out)** | **GPIO 16 (RX2)** | Radar UART Telemetry Output |
| **RX (In)** | **GPIO 17 (TX2)** | Configuration Commands (optional) |

---

## 3. Supported Transmission Data Schemas

The backend hardware adapter (`hardware-interface/radarDataAdapter.ts`) automatically parses any of the following formats sent over WebSocket or HTTP:

### Format A: JSON Payload (Recommended)
```json
{
  "timestamp": 1725550000,
  "respiration_signal": 0.1245,
  "respiratory_rate": null,
  "signal_quality": 92,
  "target_distance": 1.42,
  "presence": true,
  "device_id": "RADAR_24G_01"
}
```

### Format B: ASCII NMEA-style CSV Line
```text
$RADAR,1725550000,0.1245,1.42,1,92
```

### Format C: Pure Raw Displacement Sample
```text
0.1245
```

---

## 4. How to Connect Your Real Radar

1. Flash the ESP32 with `hardware/esp32/esp32_radar_websocket.ino`.
2. Connect your 24 GHz radar to the ESP32.
3. Start the Node.js backend (`npm run dev:backend`).
4. On the web dashboard, toggle the mode from **DEMO MODE** to **LIVE RADAR**.
5. When the ESP32 connects over Wi-Fi, the status indicator will turn solid **GREEN (CONNECTED)**, and the live respiratory waveform will immediately begin plotting real chest displacement.
