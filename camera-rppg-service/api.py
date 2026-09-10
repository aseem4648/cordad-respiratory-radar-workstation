"""
CORDAD - Camera rPPG & Respiration FastAPI Service
Exposes WebSocket real-time telemetry, MJPEG annotated video feed, and REST configuration endpoints.
Runs on port 8001.
"""

import asyncio
import cv2
import time
import json
from typing import Optional, Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from camera import VideoCamera
from face_tracking import FaceTracker
from rppg import RPPGProcessor
from respiration import RespirationProcessor
from signal_quality import SignalQualityCalculator
from alert_engine import AlertEngine
from thresholds import ThresholdConfig, DEFAULT_THRESHOLDS
from data_logger import DataLogger

app = FastAPI(title="CORDAD Camera rPPG & Respiration Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core Pipeline Singletons
camera = VideoCamera(source=0) # Default to device index 0 (or iPhone USB/Continuity)
face_tracker = FaceTracker()
rppg_proc = RPPGProcessor(fps=30.0)
resp_proc = RespirationProcessor(fps=30.0)
sqi_calc = SignalQualityCalculator()
alert_engine = AlertEngine(DEFAULT_THRESHOLDS)
data_logger = DataLogger()

# Active WebSocket subscribers
connected_clients: Set[WebSocket] = set()

# Latest state cache for broadcast
current_telemetry = {
    "type": "RPPG_TELEMETRY",
    "timestamp": time.strftime("%H:%M:%S"),
    "camera_connected": False,
    "face_detected": False,
    "hr": None,
    "hr_rolling": None,
    "hr_status": "NORMAL",
    "rr": None,
    "rr_rolling": None,
    "rr_status": "NORMAL",
    "sqi": 0.0,
    "sqi_status": "INVALID",
    "is_valid": False,
    "apnea_state": "NO_APNEA",
    "apnea_duration": 0.0,
    "apnea_msg": "No patient face in view",
    "apnea_pattern": None,
    "distress_status": "NORMAL",
    "overall_status": "SIGNAL_UNAVAILABLE",
    "pulse_waveform": 0.0,
    "resp_waveform": 0.0,
    "active_alerts": [],
    "recent_alerts": [],
    "camera_source": "0 (Default/USB)"
}

annotated_frame_jpeg: Optional[bytes] = None

class CameraSourceRequest(BaseModel):
    source: str # e.g. "0", "1", or "http://172.20.10.x:8080/video"

class AcknowledgeRequest(BaseModel):
    alert_id: str

@app.on_event("startup")
async def startup_event():
    camera.start()
    asyncio.create_task(processing_loop())
    asyncio.create_task(telemetry_broadcast_loop())

@app.on_event("shutdown")
def shutdown_event():
    camera.stop()

async def processing_loop():
    """Continuous 30 FPS video frame processing loop"""
    global annotated_frame_jpeg, current_telemetry
    
    while True:
        try:
            frame, is_connected = camera.get_frame()
            now = time.time()
            now_str = time.strftime("%H:%M:%S", time.localtime(now))

            if not is_connected or frame is None:
                current_telemetry["camera_connected"] = False
                current_telemetry["face_detected"] = False
                current_telemetry["hr"] = None
                current_telemetry["rr"] = None
                current_telemetry["sqi"] = 0.0
                current_telemetry["sqi_status"] = "INVALID"
                current_telemetry["is_valid"] = False
                current_telemetry["overall_status"] = "SIGNAL_UNAVAILABLE"
                await asyncio.sleep(0.05)
                continue

            current_telemetry["camera_connected"] = True

            # 1. Face & Anatomical ROI Detection
            face_detected, rois = face_tracker.detect_and_track(frame)
            current_telemetry["face_detected"] = face_detected

            hr, hr_rolling, pulse_val, rppg_q = None, None, 0.0, 0.0
            rr, rr_rolling, resp_val, resp_act, resp_q = None, None, 0.0, 0.0, 0.0

            if face_detected and rois:
                # Extract ROIs
                fx, fy, fw, fh = rois["face"]
                fox, foy, fow, foh = rois["forehead"]
                lx, ly, lw, lh = rois["left_cheek"]
                rx, ry, rw, rh = rois["right_cheek"]
                tx, ty, tw, th = rois["thorax"]

                # Extract sub-images
                forehead_img = frame[foy:foy+foh, fox:fox+fow]
                l_cheek_img = frame[ly:ly+lh, lx:lx+lw]
                r_cheek_img = frame[ry:ry+rh, rx:rx+rw]
                thorax_img = frame[ty:ty+th, tx:tx+tw]

                # Skin segmentation
                fh_mask = FaceTracker.extract_skin_pixels(forehead_img)
                lc_mask = FaceTracker.extract_skin_pixels(l_cheek_img)
                rc_mask = FaceTracker.extract_skin_pixels(r_cheek_img)

                # 2. rPPG Pulse & Heart Rate Processing
                hr, hr_rolling, pulse_val, rppg_q = rppg_proc.process_skin_rois(
                    forehead_img, fh_mask, l_cheek_img, lc_mask, r_cheek_img, rc_mask, now
                )

                # 3. Thoracic Motion & Respiratory Rate Processing
                rr, rr_rolling, resp_val, resp_act, resp_q = resp_proc.process_thorax_roi(
                    thorax_img, now
                )

                # Draw Visual Overlays for live video feed
                cv2.rectangle(frame, (fx, fy), (fx+fw, fy+fh), (0, 220, 255), 2) # Face (Yellow-Cyan)
                cv2.rectangle(frame, (fox, foy), (fox+fow, foy+foh), (0, 255, 0), 2) # Forehead (Green)
                cv2.putText(frame, "rPPG (Forehead)", (fox, foy - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)

                cv2.rectangle(frame, (lx, ly), (lx+lw, ly+lh), (255, 0, 255), 1) # Left cheek
                cv2.rectangle(frame, (rx, ry), (rx+rw, ry+rh), (255, 0, 255), 1) # Right cheek

                if th > 10 and tw > 10:
                    cv2.rectangle(frame, (tx, ty), (tx+tw, ty+th), (255, 120, 0), 2) # Thorax (Blue-Cyan)
                    cv2.putText(frame, "Thoracic Motion", (tx, ty - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 120, 0), 1)
            else:
                # Draw "NO FACE DETECTED" banner
                cv2.putText(frame, "SEARCHING FOR PATIENT FACE...", (30, 40), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 140, 255), 2)

            # 4. Compute Signal Quality Index (SQI)
            sqi, sqi_status, is_valid = sqi_calc.compute_sqi(face_detected, rppg_q, resp_q)

            # 5. Alert Engine Processing (Persistence, Hysteresis, Apnea, Distress)
            alert_res = alert_engine.process(hr, rr, resp_act, sqi, is_valid)

            # 6. Update Cache
            current_telemetry.update({
                "timestamp": now_str,
                "hr": hr,
                "hr_rolling": hr_rolling,
                "hr_status": alert_res["hr_status"],
                "rr": rr,
                "rr_rolling": rr_rolling,
                "rr_status": alert_res["rr_status"],
                "sqi": sqi,
                "sqi_status": sqi_status,
                "is_valid": is_valid,
                "apnea_state": alert_res["apnea_state"],
                "apnea_duration": alert_res["apnea_duration"],
                "apnea_msg": alert_res["apnea_msg"],
                "apnea_pattern": alert_res["apnea_pattern"],
                "distress_status": alert_res["distress_status"],
                "overall_status": alert_res["overall_status"],
                "pulse_waveform": round(pulse_val, 4),
                "resp_waveform": round(resp_val, 4),
                "active_alerts": alert_res["active_alerts"],
                "recent_alerts": alert_res["recent_alerts"]
            })

            # 7. Log to CSV Buffer
            data_logger.log_sample(hr, rr, alert_res["apnea_duration"], sqi, alert_res["overall_status"])

            # Encode annotated frame for MJPEG stream
            ret_jpg, jpeg_buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            if ret_jpg:
                annotated_frame_jpeg = jpeg_buf.tobytes()

            await asyncio.sleep(0.02) # ~30-40 FPS
        except Exception as e:
            print(f"[PROCESSOR ERROR] {e}")
            await asyncio.sleep(0.1)

async def telemetry_broadcast_loop():
    """Broadcasts telemetry packet over WebSockets at ~2 Hz"""
    while True:
        if connected_clients:
            msg = json.dumps(current_telemetry)
            disconnected = set()
            for ws in connected_clients:
                try:
                    await ws.send_text(msg)
                except Exception:
                    disconnected.add(ws)
            connected_clients.difference_update(disconnected)
        await asyncio.sleep(0.5)

# ==================== WEBSOCKET & HTTP ROUTES ====================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    # Send initial packet immediately
    await websocket.send_text(json.dumps(current_telemetry))
    try:
        while True:
            # Keep-alive receive
            data = await websocket.receive_text()
            try:
                cmd = json.loads(data)
                if cmd.get("action") == "RESET_PIPELINE":
                    rppg_proc.reset()
                    resp_proc.reset()
            except Exception:
                pass
    except WebSocketDisconnect:
        connected_clients.discard(websocket)

@app.get("/video_feed")
def video_feed():
    """MJPEG stream endpoint for live camera viewport with ROI overlays"""
    def generate():
        while True:
            if annotated_frame_jpeg is not None:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + annotated_frame_jpeg + b'\r\n')
            time.sleep(0.04) # ~25 FPS
    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/status")
def get_status():
    return {
        "status": "ONLINE",
        "camera_connected": camera.is_connected,
        "camera_source": str(camera.source),
        "fps": camera.fps,
        "clients_connected": len(connected_clients)
    }

@app.get("/api/thresholds")
def get_thresholds():
    return alert_engine.config.dict()

@app.post("/api/thresholds")
def update_thresholds(cfg: ThresholdConfig):
    alert_engine.update_thresholds(cfg)
    current_telemetry["thresholds"] = cfg.dict()
    return {"success": True, "thresholds": cfg.dict()}

@app.post("/api/camera/source")
def switch_camera_source(req: CameraSourceRequest):
    source_val = req.source.strip()
    if source_val.isdigit():
        new_src = int(source_val)
    else:
        new_src = source_val

    camera.set_source(new_src)
    rppg_proc.reset()
    resp_proc.reset()
    current_telemetry["camera_source"] = str(new_src)
    return {"success": True, "source": str(new_src)}

@app.post("/api/camera/stop")
def stop_camera():
    camera.stop()
    rppg_proc.reset()
    resp_proc.reset()
    current_telemetry["camera_connected"] = False
    current_telemetry["face_detected"] = False
    current_telemetry["hr"] = None
    current_telemetry["rr"] = None
    current_telemetry["sqi"] = 0.0
    current_telemetry["sqi_status"] = "INVALID"
    current_telemetry["is_valid"] = False
    current_telemetry["overall_status"] = "SIGNAL_UNAVAILABLE"
    return {"success": True, "status": "STOPPED"}

@app.post("/api/camera/start")
def start_camera():
    camera.start()
    return {"success": True, "status": "STARTED"}

@app.post("/api/alerts/acknowledge")
def acknowledge_alert(req: AcknowledgeRequest):
    success = alert_engine.acknowledge_alert(req.alert_id)
    return {"success": success, "alert_id": req.alert_id}

@app.get("/api/export/csv")
def export_csv():
    csv_content = data_logger.export_csv()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="cordad_camera_rppg_session_{int(time.time())}.csv"'}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8001, reload=False)
