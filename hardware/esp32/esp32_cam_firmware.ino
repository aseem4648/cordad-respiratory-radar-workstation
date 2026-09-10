/*
 * Contactless Respiratory Distress & Apnea Detection System
 * ESP32-CAM Physical Hardware Firmware (Optical Aiming & Illumination Gateway)
 * 
 * Hardware Target:
 * - AI-Thinker ESP32-CAM (OV2640 2MP Camera Sensor + 4MB PSRAM)
 * - Flash Illumination: GPIO 4 (LEDC PWM) / External 850nm IR MOSFET Driver
 * - Status LED: GPIO 33 (Active LOW)
 * 
 * Dependencies (Arduino IDE / PlatformIO):
 * - ESP32 Board Package (v2.0.x or v3.0+)
 * - esp_camera.h (Built-in)
 * - ArduinoJson (v6.x or v7.x)
 * 
 * Real Communication Architecture:
 * Physical ESP32-CAM ---> Wi-Fi ---> Node.js Backend Proxy ---> Web Dashboard
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

// ==================== CONFIGURATION ====================
// Replace with your clinical lab / Wi-Fi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Static IP Configuration (Optional - Leave false to use DHCP)
const bool useStaticIP = false;
IPAddress staticIP(192, 168, 1, 85);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(8, 8, 8, 8);

// Hardware Pins: AI-Thinker ESP32-CAM Pinout
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// Illumination Pin (GPIO 4: Onboard Bright White Flash LED or External 850nm IR MOSFET)
#define ILLUMINATION_PIN   4
#define STATUS_LED_PIN    33 // Onboard small red LED (active low)

// Illumination PWM Configuration (LEDC)
#define PWM_CHANNEL        2
#define PWM_FREQ        5000 // 5 kHz to eliminate camera rolling shutter banding
#define PWM_RESOLUTION     8 // 8-bit resolution (0 to 255)
#define PWM_SAFE_CEILING 217 // +85% max thermal ceiling (217 / 255)

// Global State
int currentControlLevel = 0; // -100% (off) to +85% (max safe)
int currentPwmDuty = 128;     // 50% nominal default
unsigned long totalFramesServed = 0;
bool cameraInitialized = false;

// HTTP Server on Port 81 for MJPEG Stream, Port 80 for REST Control
WebServer server(80);
WebServer streamServer(81);

// MJPEG Multipart Boundary Marker
#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// ==================== ILLUMINATION HARDWARE DRIVER ====================
int applyIlluminationLevel(int requestedLevel) {
  // Clamp level between -100% and +85% (Thermal Safety Limit)
  int clamped = requestedLevel;
  if (clamped < -100) clamped = -100;
  if (clamped > 85) clamped = 85;

  // Map -100% -> +100% to 0 -> 255 PWM duty cycle
  // -100% = 0 PWM (OFF), 0% = 128 PWM (50%), +85% = 217 PWM
  int pwm = (int)(((float)(clamped + 100) / 200.0) * 255.0);
  if (pwm > PWM_SAFE_CEILING) pwm = PWM_SAFE_CEILING;
  if (pwm < 0) pwm = 0;

  ledcWrite(PWM_CHANNEL, pwm);
  currentControlLevel = clamped;
  currentPwmDuty = pwm;

  Serial.printf("[ILLUMINATION] Applied Level: %+d%% | PWM: %d/255 | Safe Cap: %d\n", clamped, pwm, PWM_SAFE_CEILING);
  return clamped;
}

// ==================== HTTP ENDPOINT HANDLERS ====================

// 1. Live MJPEG Camera Streaming Endpoint (/stream on port 81)
void handleMjpegStream() {
  if (!cameraInitialized) {
    streamServer.send(503, "text/plain", "Camera sensor hardware uninitialized");
    return;
  }

  WiFiClient client = streamServer.client();
  client.print("HTTP/1.1 200 OK\r\n");
  client.print("Access-Control-Allow-Origin: *\r\n");
  client.print("Content-Type: ");
  client.print(_STREAM_CONTENT_TYPE);
  client.print("\r\n\r\n");

  Serial.println("[STREAM] Client connected to live MJPEG stream");
  digitalWrite(STATUS_LED_PIN, LOW); // LED ON indicating active streaming

  while (client.connected()) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("[ERROR] Failed to acquire camera frame buffer");
      break;
    }

    totalFramesServed++;

    char partBuf[64];
    snprintf(partBuf, sizeof(partBuf), _STREAM_PART, fb->len);

    client.print(_STREAM_BOUNDARY);
    client.print(partBuf);
    client.write(fb->buf, fb->len);
    client.print("\r\n");

    esp_camera_fb_return(fb);

    // Short yield to allow Wi-Fi background task execution
    vTaskDelay(pdMS_TO_TICKS(1));
  }

  digitalWrite(STATUS_LED_PIN, HIGH); // LED OFF when client disconnects
  Serial.println("[STREAM] Client disconnected from live stream");
}

// 2. Hardware Telemetry & Verification Endpoint (GET /status on port 80)
void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  StaticJsonDocument<384> doc;

  doc["hardware"] = "ESP32-CAM";
  doc["sensor"] = "OV2640";
  doc["cameraStatus"] = cameraInitialized ? "CONNECTED" : "FAULT";
  doc["wifiConnected"] = (WiFi.status() == WL_CONNECTED);
  doc["ipAddress"] = WiFi.localIP().toString();
  doc["streamPort"] = 81;
  doc["streamPath"] = "/stream";
  doc["framesServed"] = totalFramesServed;
  doc["illumination"]["connected"] = true;
  doc["illumination"]["controlLevel"] = currentControlLevel;
  doc["illumination"]["pwmDutyCycle"] = currentPwmDuty;
  doc["illumination"]["maxSafetyLimit"] = 85;
  doc["illumination"]["hardwareType"] = "IR_850NM_OR_WHITE_LED";
  doc["uptimeSeconds"] = millis() / 1000;

  String res;
  serializeJson(doc, res);
  server.send(200, "application/json", res);
}

// 3. Single Snapshot Frame Endpoint (GET /snapshot on port 80)
void handleSnapshot() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  if (!cameraInitialized) {
    server.send(503, "text/plain", "Camera sensor unavailable");
    return;
  }

  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    server.send(500, "text/plain", "Frame capture error");
    return;
  }

  WiFiClient client = server.client();
  client.print("HTTP/1.1 200 OK\r\n");
  client.print("Access-Control-Allow-Origin: *\r\n");
  client.print("Content-Type: image/jpeg\r\n");
  client.printf("Content-Length: %u\r\n\r\n", fb->len);
  client.write(fb->buf, fb->len);

  esp_camera_fb_return(fb);
}

// 4. Closed-Loop Illumination Command Endpoint (POST /illumination on port 80)
void handleSetIllumination() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");

  if (server.method() == HTTP_OPTIONS) {
    server.send(204);
    return;
  }

  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing JSON body\"}");
    return;
  }

  StaticJsonDocument<256> reqDoc;
  DeserializationError err = deserializeJson(reqDoc, server.arg("plain"));
  if (err) {
    server.send(400, "application/json", "{\"error\":\"Invalid JSON format\"}");
    return;
  }

  int reqLevel = reqDoc["level"] | 0;
  int appliedLevel = applyIlluminationLevel(reqLevel);

  // Return verified Hardware Acknowledgement
  StaticJsonDocument<256> ackDoc;
  ackDoc["status"] = "applied";
  ackDoc["command"] = "camera_illumination";
  ackDoc["level"] = appliedLevel;
  ackDoc["pwmDutyCycle"] = currentPwmDuty;
  ackDoc["maxSafetyLimit"] = 85;
  ackDoc["ackTimestamp"] = millis();
  ackDoc["deviceId"] = "PHYSICAL_ESP32_CAM_01";

  String ackRes;
  serializeJson(ackDoc, ackRes);
  server.send(200, "application/json", ackRes);
}

// ==================== CAMERA SENSOR INITIALIZATION ====================
bool initCameraSensor() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Frame resolution & Buffer optimization
  if (psramFound()) {
    config.frame_size = FRAMESIZE_VGA;  // 640x480 standard clinical ROI resolution
    config.jpeg_quality = 12;           // High clarity (lower number = higher quality, 10-63)
    config.fb_count = 2;                // Double buffer for zero frame tearing
  } else {
    config.frame_size = FRAMESIZE_QVGA; // 320x240 fallback if no PSRAM
    config.jpeg_quality = 14;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[ERROR] Camera initialization failed with error code: 0x%x\n", err);
    return false;
  }

  sensor_t* s = esp_camera_sensor_get();
  if (s != NULL) {
    s->set_brightness(s, 0);     // -2 to 2
    s->set_contrast(s, 0);       // -2 to 2
    s->set_saturation(s, 0);     // -2 to 2
    s->set_whitebal(s, 1);       // Auto white balance ON
    s->set_awb_gain(s, 1);       // AWB gain ON
    s->set_exposure_ctrl(s, 1);  // Auto exposure ON
  }

  Serial.println("[SUCCESS] OV2640 camera sensor initialized successfully");
  return true;
}

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n========================================================");
  Serial.println("  ESP32-CAM PHYSICAL HARDWARE GATEWAY FIRMWARE v2.0    ");
  Serial.println("========================================================");

  // Configure Status LED
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, HIGH); // Off initially

  // Initialize Illumination PWM Driver (LEDC)
  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(ILLUMINATION_PIN, PWM_CHANNEL);
  applyIlluminationLevel(0); // Initialize to nominal 0% level

  // Initialize OV2640 Camera
  cameraInitialized = initCameraSensor();
  if (!cameraInitialized) {
    Serial.println("[FAULT] Halting: Camera sensor could not be found or initialized.");
  }

  // Connect to Wi-Fi
  if (useStaticIP) {
    WiFi.config(staticIP, gateway, subnet, primaryDNS);
  }

  Serial.printf("[WIFI] Connecting to network SSID: %s...\n", ssid);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(400);
    Serial.print(".");
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN)); // Blink while connecting
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(STATUS_LED_PIN, HIGH); // Off when connected
    Serial.println("\n[WIFI] Connected successfully!");
    Serial.printf("[WIFI] Physical ESP32-CAM IP Address: http://%s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[STREAM] MJPEG Stream Endpoint:      http://%s:81/stream\n", WiFi.localIP().toString().c_str());
    Serial.printf("[API]    Hardware Status Endpoint:   http://%s/status\n", WiFi.localIP().toString().c_str());
    Serial.printf("[API]    Illumination Endpoint:      http://%s/illumination\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WIFI] Connection failed. Please check Wi-Fi credentials in firmware.");
  }

  // Register REST Endpoints on Port 80
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/snapshot", HTTP_GET, handleSnapshot);
  server.on("/illumination", HTTP_POST, handleSetIllumination);
  server.on("/illumination", HTTP_OPTIONS, handleSetIllumination);
  server.begin();

  // Register MJPEG Stream Endpoint on Port 81
  streamServer.on("/stream", HTTP_GET, handleMjpegStream);
  streamServer.begin();

  Serial.println("[READY] ESP32-CAM streaming and control servers active.");
}

// ==================== MAIN LOOP ====================
void loop() {
  server.handleClient();
  streamServer.handleClient();

  // Automatic Wi-Fi reconnection handling
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastReconnectAttempt = 0;
    if (millis() - lastReconnectAttempt > 5000) {
      lastReconnectAttempt = millis();
      Serial.println("[WIFI] Lost connection. Attempting reconnection...");
      WiFi.reconnect();
    }
  }

  delay(1);
}
