"""
CORDAD - Multi-Source Camera Stream Ingestion
Supports physical iPhone rear camera via USB/Continuity Camera (index) or Wi-Fi IP stream (RTSP/HTTP).
Uses a dedicated daemon thread to eliminate frame buffer latency.
"""

import cv2
import threading
import time
from typing import Optional, Union

class VideoCamera:
    def __init__(self, source: Union[int, str] = 0):
        self.source = source
        self.cap: Optional[cv2.VideoCapture] = None
        self.current_frame = None
        self.is_running = False
        self.lock = threading.Lock()
        self.fps = 30.0
        self.frame_width = 640
        self.frame_height = 480
        self.is_connected = False
        self.thread: Optional[threading.Thread] = None

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()

    def set_source(self, new_source: Union[int, str]):
        with self.lock:
            self.source = new_source
            if self.cap is not None:
                self.cap.release()
                self.cap = None
            self.is_connected = False
            self.current_frame = None

    def _open_capture(self) -> bool:
        try:
            if isinstance(self.source, int):
                # Using DirectShow backend on Windows for fastest device initialization
                self.cap = cv2.VideoCapture(self.source, cv2.CAP_DSHOW)
                if not self.cap.isOpened():
                    self.cap = cv2.VideoCapture(self.source)
            else:
                self.cap = cv2.VideoCapture(self.source)

            if self.cap.isOpened():
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                self.is_connected = True
                return True
        except Exception as e:
            print(f"[CAMERA] Error opening capture source {self.source}: {e}")
        self.is_connected = False
        return False

    def _capture_loop(self):
        while self.is_running:
            if self.cap is None or not self.cap.isOpened():
                if not self._open_capture():
                    time.sleep(1.0)
                    continue

            ret, frame = self.cap.read()
            if not ret or frame is None:
                self.is_connected = False
                time.sleep(0.5)
                continue

            self.is_connected = True
            with self.lock:
                self.current_frame = frame

            time.sleep(0.01) # Yield to prevent CPU hogging

        if self.cap is not None:
            self.cap.release()

    def get_frame(self):
        with self.lock:
            if self.current_frame is not None:
                return self.current_frame.copy(), self.is_connected
            return None, self.is_connected

    def stop(self):
        self.is_running = False
        if self.thread is not None and self.thread.is_alive():
            self.thread.join(timeout=1.0)
        if self.cap is not None:
            self.cap.release()
            self.cap = None
        self.is_connected = False
