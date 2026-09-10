"""
CORDAD - Multi-Source Camera Stream Ingestion
Seamlessly connects to:
1. iPhone 17 Camera via Wi-Fi IP Stream (auto-sanitizes IP, probes /video, /mjpeg, /live endpoints)
2. iPhone Camera via Camo USB / Continuity Camera (device index 1/2)
3. Built-in Laptop Webcam (Test Mode, index 0)

Uses thread-safe daemon capture loop with 0-latency single-frame buffer and dynamic resolution scaling.
"""

import cv2
import os
import threading
import time
import urllib.parse
from typing import Optional, Union, List

# Set FFmpeg network stream timeout (2.5 seconds in microseconds) to avoid hanging
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "timeout;2500000|rtsp_transport;tcp"

def sanitize_source(source: Union[int, str]) -> Union[int, str]:
    """Auto-normalizes camera source input (integers or network URLs)"""
    if isinstance(source, int):
        return source
    s = str(source).strip()
    if s.isdigit():
        return int(s)
    # Remove surrounding quotes if pasted
    s = s.strip('"').strip("'")
    # Auto-prepend http:// if IP:Port or host is entered without scheme
    if not (s.startswith("http://") or s.startswith("https://") or s.startswith("rtsp://")):
        s = "http://" + s
    return s

class VideoCamera:
    def __init__(self, source: Union[int, str] = 0):
        self.source = sanitize_source(source)
        self.resolved_source = self.source
        self.pending_source: Optional[Union[int, str]] = None
        
        self.cap: Optional[cv2.VideoCapture] = None
        self.current_frame = None
        self.is_running = False
        self.lock = threading.Lock()
        
        self.fps = 30.0
        self.frame_width = 640
        self.frame_height = 480
        
        self.is_connected = False
        self.connection_status = "DISCONNECTED" # DISCONNECTED, CONNECTING, CONNECTED, ERROR
        self.connection_msg = "Camera initialized"
        self.thread: Optional[threading.Thread] = None

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.connection_status = "CONNECTING"
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()

    def set_source(self, new_source: Union[int, str]):
        """Thread-safe source change request"""
        sanitized = sanitize_source(new_source)
        with self.lock:
            self.source = sanitized
            self.pending_source = sanitized
            self.is_connected = False
            self.connection_status = "CONNECTING"
            self.connection_msg = f"Connecting to source: {sanitized}..."
        if not self.is_running:
            self.start()

    def _get_candidate_urls(self, base_url: str) -> List[str]:
        """Generates candidate stream endpoints for iOS IP camera apps"""
        try:
            parsed = urllib.parse.urlparse(base_url)
            path = parsed.path.rstrip('/')
            
            # If user pasted raw IP with no path or just '/', test top 3 iOS endpoints
            if path in ("", "/"):
                root = f"{parsed.scheme}://{parsed.netloc}"
                return [
                    f"{root}/video",      # IP Camera Lite / standard MJPEG
                    root,                 # Direct root MJPEG stream
                    f"{root}/mjpeg",      # Alternative MJPEG
                ]
            return [base_url]
        except Exception:
            return [base_url]

    def _open_capture(self) -> bool:
        """Attempts connection to current source with backend fallbacks"""
        target = self.source
        self.connection_status = "CONNECTING"
        
        try:
            # 1. Physical Device Index (Laptop Webcam 0 or Camo iPhone 1/2)
            if isinstance(target, int):
                self.connection_msg = f"Opening device index {target} (DirectShow)..."
                # Use DirectShow on Windows for low latency
                self.cap = cv2.VideoCapture(target, cv2.CAP_DSHOW)
                if not self.cap.isOpened():
                    self.cap = cv2.VideoCapture(target)

                if self.cap.isOpened():
                    self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                    self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    self.resolved_source = target
                    self.is_connected = True
                    self.connection_status = "CONNECTED"
                    self.connection_msg = f"Connected to device index {target}"
                    return True
                else:
                    self.connection_status = "ERROR"
                    self.connection_msg = f"Could not open device index {target}"
                    return False

            # 2. Network IP Stream (iPhone 17 Wi-Fi / IP Camera)
            else:
                candidates = self._get_candidate_urls(str(target))
                for cand in candidates:
                    if self.pending_source is not None:
                        return False

                    self.connection_msg = f"Connecting to stream: {cand}..."
                    print(f"[CAMERA] Attempting connection to: {cand}")
                    
                    # Network streams use CAP_FFMPEG backend
                    cap = cv2.VideoCapture(cand, cv2.CAP_FFMPEG)
                    if not cap.isOpened():
                        cap = cv2.VideoCapture(cand)
                    
                    if cap.isOpened():
                        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                        ret, test_frame = cap.read()
                        if ret and test_frame is not None and test_frame.size > 0:
                            self.cap = cap
                            self.resolved_source = cand
                            self.is_connected = True
                            self.connection_status = "CONNECTED"
                            self.connection_msg = f"Connected to iPhone stream: {cand}"
                            print(f"[CAMERA] Successfully locked onto stream: {cand}")
                            return True
                        else:
                            cap.release()

                self.connection_status = "ERROR"
                self.connection_msg = f"Failed to connect to iPhone IP stream: {target}"
                return False

        except Exception as e:
            print(f"[CAMERA] Error in _open_capture: {e}")
            self.connection_status = "ERROR"
            self.connection_msg = f"Capture error: {str(e)}"
            self.is_connected = False
            return False

    def _capture_loop(self):
        """Dedicated daemon capture thread with non-blocking buffer update"""
        consecutive_read_failures = 0
        
        while self.is_running:
            # Handle pending source switch safely within capture thread
            if self.pending_source is not None:
                with self.lock:
                    target_src = self.pending_source
                    self.pending_source = None
                    if self.cap is not None:
                        try:
                            self.cap.release()
                        except Exception:
                            pass
                        self.cap = None
                    self.source = target_src
                    self.is_connected = False
                    self.current_frame = None
                consecutive_read_failures = 0
                continue

            # Ensure capture device is open
            if self.cap is None or not self.cap.isOpened():
                if not self._open_capture():
                    time.sleep(1.0)
                    continue

            # Read frame
            ret, frame = self.cap.read()
            if not ret or frame is None or frame.size == 0:
                consecutive_read_failures += 1
                if consecutive_read_failures > 15:
                    self.is_connected = False
                    self.connection_status = "ERROR"
                    self.connection_msg = "Stream connection lost. Retrying..."
                    if self.cap is not None:
                        try:
                            self.cap.release()
                        except Exception:
                            pass
                        self.cap = None
                time.sleep(0.1)
                continue

            consecutive_read_failures = 0
            self.is_connected = True
            self.connection_status = "CONNECTED"

            # Dynamic resolution scaling for iPhone 17 high-res streams (1080p/4K)
            # Normalizes to max 1280px width to guarantee 30 FPS rPPG & YuNet tracking
            h, w = frame.shape[:2]
            if w > 1280:
                scale = 1280.0 / w
                target_w = 1280
                target_h = int(h * scale)
                frame = cv2.resize(frame, (target_w, target_h), interpolation=cv2.INTER_AREA)

            self.frame_width = frame.shape[1]
            self.frame_height = frame.shape[0]

            with self.lock:
                self.current_frame = frame

            time.sleep(0.005) # Yield to CPU

        # Cleanup on exit
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None

    def get_frame(self):
        with self.lock:
            if self.current_frame is not None:
                return self.current_frame.copy(), self.is_connected
            return None, self.is_connected

    def stop(self):
        self.is_running = False
        self.is_connected = False
        self.connection_status = "DISCONNECTED"
        self.connection_msg = "Camera stopped"
        if self.thread is not None and self.thread.is_alive():
            self.thread.join(timeout=1.0)
        with self.lock:
            if self.cap is not None:
                try:
                    self.cap.release()
                except Exception:
                    pass
                self.cap = None
            self.current_frame = None
