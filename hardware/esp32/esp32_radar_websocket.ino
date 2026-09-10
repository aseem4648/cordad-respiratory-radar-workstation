/*
 * Contactless Respiratory Distress and Apnea Detection System
 * ESP32 Gateway Firmware for 24 GHz FMCW Radar & Camera Illumination
 * 
 * Hardware:
 * - ESP32 NodeMCU / ESP32-CAM / WROOM-32 Development Board
 * - 24 GHz FMCW Radar Sensor Module (e.g. MR24BSD1, HLK-LD2410, Infineon BGT24LTR11)
 * - IR 850nm Illumination LED Array / Onboard White LED
 * 
 * Wiring:
 * - Radar VCC -> ESP32 5V (or 3.3V per radar spec)
 * - Radar GND -> ESP32 GND
 * - Radar TX  -> ESP32 GPIO 16 (RX2)
 * - Radar RX  -> ESP32 GPIO 17 (TX2)
 * - Illumination PWM -> ESP32 GPIO 4 (or GPIO 14 / LEDC Channel 0)
 * 
 * Dependencies:
 * - WebSocketsClient by Markus Sattler (v2.4.1+)
 * - ArduinoJson by Benoit Blanchon (v6.21+)
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Backend WebSocket Server Configuration
const char* ws_host = "192.168.1.100"; // Replace with your laptop / server IP address
const int ws_port = 5000;
const char* ws_path = "/ws/radar";

// Status LED Pin
#define LED_PIN 2

// Illumination PWM Configuration (LEDC)
#define ILLUMINATION_PIN 4       // GPIO 4 (Default for ESP32-CAM illumination)
#define PWM_CHANNEL      0
#define PWM_FREQ         5000    // 5 kHz frequency to prevent camera rolling shutter flicker
#define PWM_RESOLUTION   8       // 8-bit resolution (0 - 255)
#define PWM_SAFE_CEILING 217     // Safe thermal ceiling (+85% = 217 PWM)

// Hardware Serial 2 for 24 GHz Radar
#define RXD2 16
#define TXD2 17
#define RADAR_BAUD 115200 // Default for typical 24GHz UART sensors

WebSocketsClient webSocket;
unsigned long lastSampleTime = 0;
int currentIlluminationLevel = 0; // -100% to +100% (nominal 0%)
int currentPwmDuty = 128;         // 50% default

void applyIllumination(int level) {
  // Clamp level to -100% to +85%
  if (level < -100) level = -100;
  if (level > 85) level = 85;
  
  // Map -100% -> +100% to 0 -> 255 PWM
  int pwm = (int)(((float)(level + 100) / 200.0) * 255.0);
  if (pwm > PWM_SAFE_CEILING) pwm = PWM_SAFE_CEILING;
  if (pwm < 0) pwm = 0;

  ledcWrite(PWM_CHANNEL, pwm);
  currentIlluminationLevel = level;
  currentPwmDuty = pwm;

  Serial.printf("[ILLUMINATION] Applied Level: %+d%% | PWM Duty: %d / 255\n", level, pwm);

  // Send hardware acknowledgement back to server
  StaticJsonDocument<256> ack;
  ack["type"] = "CAMERA_ILLUMINATION_ACK";
  ack["command"] = "camera_illumination";
  ack["status"] = "applied";
  ack["level"] = level;
  ack["pwmDutyCycle"] = pwm;
  ack["deviceId"] = "ESP32_24G_BEDSIDE_01";
  ack["timestamp"] = millis();

  String ackStr;
  serializeJson(ack, ackStr);
  webSocket.sendTXT(ackStr);
}

void handleIncomingJson(const char* jsonStr) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, jsonStr);
  if (error) return;

  const char* cmd = doc["command"] | doc["type"] | "";
  
  if (strcmp(cmd, "camera_illumination") == 0 || strcmp(cmd, "SET_ILLUMINATION") == 0) {
    int level = doc["level"] | 0;
    applyIllumination(level);
  } else if (strcmp(cmd, "RESET_ILLUMINATION") == 0) {
    applyIllumination(0);
  }
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected from server");
      digitalWrite(LED_PIN, LOW);
      break;
    case WStype_CONNECTED:
      Serial.printf("[WS] Connected to url: %s\n", payload);
      digitalWrite(LED_PIN, HIGH);
      // Send handshake identifying hardware device
      webSocket.sendTXT("{\"type\":\"RADAR_CLIENT_INIT\",\"deviceId\":\"ESP32_24G_BEDSIDE_01\",\"features\":[\"RADAR_24G\",\"CAMERA_ILLUMINATION_PWM\"]}");
      // Initialize illumination to nominal default (0%)
      applyIllumination(0);
      break;
    case WStype_TEXT:
      Serial.printf("[WS] Received command: %s\n", payload);
      handleIncomingJson((const char*)payload);
      break;
    case WStype_BIN:
      break;
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Initialize LEDC PWM for Camera Illumination
  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(ILLUMINATION_PIN, PWM_CHANNEL);
  ledcWrite(PWM_CHANNEL, 128); // 50% nominal power

  // Initialize Radar UART Port
  Serial2.begin(RADAR_BAUD, SERIAL_8N1, RXD2, TXD2);
  Serial.println("\n=== 24 GHz FMCW RADAR & ILLUMINATION ESP32 GATEWAY ===");
  Serial.printf("Connecting to WiFi: %s...\n", ssid);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  }

  Serial.println("\n[WIFI] Connected! IP address: ");
  Serial.println(WiFi.localIP());

  // Connect WebSocket to Node.js Backend
  webSocket.begin(ws_host, ws_port, ws_path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(2000);
}

void loop() {
  webSocket.loop();

  // Read incoming bytes from 24 GHz radar sensor UART
  if (Serial2.available()) {
    String line = Serial2.readStringUntil('\n');
    line.trim();

    if (line.length() > 0 && webSocket.isConnected()) {
      // 1. Direct JSON Forwarding (if radar outputs JSON directly)
      if (line.startsWith("{") && line.endsWith("}")) {
        webSocket.sendTXT(line);
      }
      // 2. ASCII CSV Forwarding (e.g. $RADAR,timestamp,signal,distance,presence)
      else if (line.startsWith("$RADAR")) {
        webSocket.sendTXT(line);
      }
      // 3. Raw Numeric Float Displacement Forwarding
      else {
        float rawVal = line.toFloat();
        StaticJsonDocument<200> doc;
        doc["timestamp"] = millis();
        doc["respiration_signal"] = rawVal;
        doc["device_id"] = "ESP32_24G_RADAR";
        
        String out;
        serializeJson(doc, out);
        webSocket.sendTXT(out);
      }
    }
  }

  // Periodic Keep-Alive / Heartbeat if radar is idle
  unsigned long now = millis();
  if (now - lastSampleTime >= 2000 && webSocket.isConnected()) {
    lastSampleTime = now;
    webSocket.sendTXT("{\"type\":\"PING\"}");
  }
}
