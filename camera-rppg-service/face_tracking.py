"""
CORDAD - Real-Time Face Tracking & Anatomical ROI Selection
Detects face and isolates forehead, cheek, and thoracic ROIs with skin-pixel masking.
Engineered to work seamlessly across OpenCV 4.x and OpenCV 5.x.
"""

import cv2
import numpy as np
from typing import Optional, Tuple, Dict, List

class FaceTracker:
    def __init__(self, smoothing_factor: float = 0.7):
        self.smoothing_factor = smoothing_factor
        self.prev_face_rect: Optional[Tuple[int, int, int, int]] = None
        self.missed_frames = 0
        self.max_missed_frames = 15

        # Check if legacy CascadeClassifier is available in this OpenCV build
        self.has_cascade = hasattr(cv2, 'CascadeClassifier')
        self.face_cascade = None
        if self.has_cascade:
            try:
                cascade_path = getattr(cv2.data, 'haarcascades', '') + 'haarcascade_frontalface_default.xml'
                self.face_cascade = cv2.CascadeClassifier(cascade_path)
            except Exception:
                self.face_cascade = None

    def detect_and_track(self, frame: np.ndarray) -> Tuple[bool, Optional[Dict[str, Tuple[int, int, int, int]]]]:
        """
        Detects primary face and extracts smoothed ROIs:
        - Forehead (primary rPPG)
        - Left Cheek & Right Cheek (supplemental rPPG)
        - Thorax / Upper Chest (respiratory motion)
        """
        h, w = frame.shape[:2]
        current_rect: Optional[Tuple[int, int, int, int]] = None

        # Method 1: CascadeClassifier if present
        if self.face_cascade is not None and not self.face_cascade.empty():
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(
                gray, 
                scaleFactor=1.1, 
                minNeighbors=5, 
                minSize=(int(w * 0.15), int(h * 0.15))
            )
            if len(faces) > 0:
                largest = max(faces, key=lambda r: r[2] * r[3])
                current_rect = tuple(map(int, largest))

        # Method 2: High-Performance Skin-Color & Morphological Face Contour Tracker
        if current_rect is None:
            current_rect = self._detect_face_by_skin_morphology(frame)

        if current_rect is not None:
            self.missed_frames = 0
        else:
            self.missed_frames += 1
            if self.missed_frames < self.max_missed_frames and self.prev_face_rect is not None:
                current_rect = self.prev_face_rect
            else:
                self.prev_face_rect = None
                return False, None

        # Exponential moving average smoothing
        if self.prev_face_rect is not None:
            alpha = self.smoothing_factor
            fx = int(alpha * self.prev_face_rect[0] + (1 - alpha) * current_rect[0])
            fy = int(alpha * self.prev_face_rect[1] + (1 - alpha) * current_rect[1])
            fw = int(alpha * self.prev_face_rect[2] + (1 - alpha) * current_rect[2])
            fh = int(alpha * self.prev_face_rect[3] + (1 - alpha) * current_rect[3])
            smoothed_face = (fx, fy, fw, fh)
        else:
            smoothed_face = current_rect

        self.prev_face_rect = smoothed_face
        x, y, fw, fh = smoothed_face

        # 1. Forehead ROI: top 12% to 32% of face, middle 60%
        forehead_x = max(0, x + int(fw * 0.20))
        forehead_y = max(0, y + int(fh * 0.10))
        forehead_w = min(w - forehead_x, int(fw * 0.60))
        forehead_h = min(h - forehead_y, int(fh * 0.22))

        # 2. Left Cheek ROI
        l_cheek_x = max(0, x + int(fw * 0.12))
        l_cheek_y = max(0, y + int(fh * 0.52))
        l_cheek_w = min(w - l_cheek_x, int(fw * 0.28))
        l_cheek_h = min(h - l_cheek_y, int(fh * 0.25))

        # 3. Right Cheek ROI
        r_cheek_x = max(0, x + int(fw * 0.60))
        r_cheek_y = max(0, y + int(fh * 0.52))
        r_cheek_w = min(w - r_cheek_x, int(fw * 0.28))
        r_cheek_h = min(h - r_cheek_y, int(fh * 0.25))

        # 4. Upper Thorax / Chest ROI: below chin
        thorax_w = min(w, int(fw * 1.4))
        thorax_x = max(0, x - int((thorax_w - fw) / 2))
        thorax_y = min(h - 1, y + int(fh * 1.05))
        thorax_h = min(h - thorax_y, int(fh * 0.9))

        rois = {
            "face": smoothed_face,
            "forehead": (forehead_x, forehead_y, forehead_w, forehead_h),
            "left_cheek": (l_cheek_x, l_cheek_y, l_cheek_w, l_cheek_h),
            "right_cheek": (r_cheek_x, r_cheek_y, r_cheek_w, r_cheek_h),
            "thorax": (thorax_x, thorax_y, thorax_w, thorax_h)
        }

        return True, rois

    def _detect_face_by_skin_morphology(self, frame: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        h, w = frame.shape[:2]
        # Downscale for fast segmentation
        small = cv2.resize(frame, (160, 120))
        ycrcb = cv2.cvtColor(small, cv2.COLOR_BGR2YCrCb)
        _, cr, cb = cv2.split(ycrcb)

        # Standard YCrCb skin mask
        skin = ((cb >= 77) & (cb <= 127) & (cr >= 133) & (cr <= 173)).astype(np.uint8) * 255
        
        # Morphological opening/closing to consolidate face blob
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        skin = cv2.morphologyEx(skin, cv2.MORPH_OPEN, kernel)
        skin = cv2.morphologyEx(skin, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(skin, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        # Filter candidate blobs by aspect ratio (0.8 <= H/W <= 2.2) and area
        candidates = []
        for c in contours:
            area = cv2.contourArea(c)
            if area > (160 * 120 * 0.04): # At least 4% of frame
                bx, by, bw, bh = cv2.boundingRect(c)
                aspect = float(bh) / max(1, bw)
                if 0.7 <= aspect <= 2.2:
                    candidates.append((area, bx, by, bw, bh))

        if not candidates:
            return None

        # Select largest skin blob matching facial proportions
        _, bx, by, bw, bh = max(candidates, key=lambda item: item[0])

        # Scale coordinates back up to full frame resolution
        scale_x = w / 160.0
        scale_y = h / 120.0

        fx = int(bx * scale_x)
        fy = int(by * scale_y)
        fw = int(bw * scale_x)
        fh = int(bh * scale_y)

        return (fx, fy, fw, fh)

    @staticmethod
    def extract_skin_pixels(roi_bgr: np.ndarray) -> np.ndarray:
        if roi_bgr is None or roi_bgr.size == 0:
            return np.zeros((1, 1), dtype=bool)

        ycrcb = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2YCrCb)
        _, cr, cb = cv2.split(ycrcb)

        skin_mask = (cb >= 77) & (cb <= 127) & (cr >= 133) & (cr <= 173)
        return skin_mask
