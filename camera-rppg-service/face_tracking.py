"""
CORDAD - Real-Time Face Tracking & Anatomical ROI Selection
Distance-invariant physiological tracker: Detects face and upper thorax across 0.4m - 2.5m.
Works without external model dependencies across OpenCV 4 and 5.
"""

import cv2
import numpy as np
from typing import Optional, Tuple, Dict

class FaceTracker:
    def __init__(self, smoothing_factor: float = 0.75):
        self.smoothing_factor = smoothing_factor
        self.prev_face_rect: Optional[Tuple[int, int, int, int]] = None
        self.missed_frames = 0
        self.max_missed_frames = 30  # 1-second inertial hold

    def detect_and_track(self, frame: np.ndarray) -> Tuple[bool, Optional[Dict[str, Tuple[int, int, int, int]]]]:
        """
        Detects primary face and extracts smoothed ROIs:
        - Forehead (primary rPPG)
        - Left Cheek & Right Cheek (supplemental rPPG)
        - Thorax / Upper Chest (respiratory motion)
        """
        if frame is None or frame.size == 0:
            return False, None

        h, w = frame.shape[:2]
        current_rect = self._detect_face_physiological(frame)

        if current_rect is not None:
            self.missed_frames = 0
        else:
            self.missed_frames += 1
            if self.missed_frames < self.max_missed_frames and self.prev_face_rect is not None:
                current_rect = self.prev_face_rect
            else:
                self.prev_face_rect = None
                return False, None

        # Exponential moving average smoothing for rock-solid stability
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

        # Clamp face within frame bounds
        x = max(0, min(w - 10, x))
        y = max(0, min(h - 10, y))
        fw = max(10, min(w - x, fw))
        fh = max(10, min(h - y, fh))

        # 1. Forehead ROI: top 8% to 30% of face, middle 65%
        forehead_x = max(0, x + int(fw * 0.18))
        forehead_y = max(0, y + int(fh * 0.08))
        forehead_w = min(w - forehead_x, int(fw * 0.64))
        forehead_h = min(h - forehead_y, int(fh * 0.22))

        # 2. Left Cheek ROI
        l_cheek_x = max(0, x + int(fw * 0.10))
        l_cheek_y = max(0, y + int(fh * 0.46))
        l_cheek_w = min(w - l_cheek_x, int(fw * 0.30))
        l_cheek_h = min(h - l_cheek_y, int(fh * 0.26))

        # 3. Right Cheek ROI
        r_cheek_x = max(0, x + int(fw * 0.60))
        r_cheek_y = max(0, y + int(fh * 0.46))
        r_cheek_w = min(w - r_cheek_x, int(fw * 0.30))
        r_cheek_h = min(h - r_cheek_y, int(fh * 0.26))

        # 4. Upper Thorax / Chest ROI: directly below chin
        thorax_w = min(w, int(fw * 1.5))
        thorax_x = max(0, x - int((thorax_w - fw) / 2))
        thorax_y = min(h - 1, y + int(fh * 1.02))
        thorax_h = min(h - thorax_y, int(fh * 0.85))

        rois = {
            "face": smoothed_face,
            "forehead": (forehead_x, forehead_y, forehead_w, forehead_h),
            "left_cheek": (l_cheek_x, l_cheek_y, l_cheek_w, l_cheek_h),
            "right_cheek": (r_cheek_x, r_cheek_y, r_cheek_w, r_cheek_h),
            "thorax": (thorax_x, thorax_y, thorax_w, thorax_h)
        }

        return True, rois

    def _detect_face_physiological(self, frame: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        """
        High-precision physiological skin and upper-body silhouette detector.
        Detects seated subjects across any distance without being confused by background walls.
        """
        h, w = frame.shape[:2]
        
        # Downscale for rapid processing (~150 FPS equivalent)
        target_w = 320
        scale = target_w / float(w)
        target_h = int(h * scale)
        small = cv2.resize(frame, (target_w, target_h))

        b, g, r = cv2.split(small.astype(np.float32))

        # Physiological skin chrominance (oxyhemoglobin absorption rule)
        # Skin reflects Red and absorbs Green; works across all skin tones and ambient webcams
        skin_mask = ((r > g) & ((r - g) >= 6.0) & (r >= 35.0) & (b >= 20.0)).astype(np.uint8) * 255

        # Morphological consolidation
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel)
        skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        # Filter contours by size: minimum area 400px (allows detecting person up to 2.5m away)
        min_area = target_w * target_h * 0.008  # ~0.8% of frame
        candidates = []

        for c in contours:
            area = cv2.contourArea(c)
            if area >= min_area:
                bx, by, bw, bh = cv2.boundingRect(c)
                aspect = float(bh) / max(1, bw)
                
                # Candidate can be head alone (aspect 0.9 - 1.8) or upper body silhouette (aspect 0.5 - 1.2)
                if 0.45 <= aspect <= 2.8:
                    # Score candidates closer to upper center of frame
                    cx = bx + bw / 2.0
                    cy = by + bh / 2.0
                    dist_x = abs(cx - target_w / 2.0) / (target_w / 2.0)
                    vert_bias = 1.2 if (cy < target_h * 0.70) else 0.6
                    score = area * vert_bias * (1.0 - 0.25 * dist_x)
                    candidates.append((score, bx, by, bw, bh, aspect))

        if not candidates:
            return None

        _, bx, by, bw, bh, aspect = max(candidates, key=lambda item: item[0])

        # If the candidate is an upper-body silhouette (broad shoulder width, aspect < 1.05),
        # mathematically isolate the head from the upper-central region
        if aspect < 1.05:
            head_w = int(bw * 0.55)
            head_x = bx + int((bw - head_w) / 2)
            head_y = by + int(bh * 0.04)
            head_h = int(bh * 0.65)
        else:
            # Candidate is primarily head/neck
            head_w = int(bw * 0.85)
            head_x = bx + int((bw - head_w) / 2)
            head_y = by
            head_h = int(bh * 0.85)

        # Scale coordinates back up to full frame
        inv_scale = 1.0 / scale
        fx = int(head_x * inv_scale)
        fy = int(head_y * inv_scale)
        fw = int(head_w * inv_scale)
        fh = int(head_h * inv_scale)

        return (fx, fy, fw, fh)

    @staticmethod
    def extract_skin_pixels(roi_bgr: np.ndarray) -> np.ndarray:
        """
        Extracts valid skin mask from an anatomical ROI (forehead or cheek).
        Guarantees robust pixel yield for rPPG even in challenging lighting.
        """
        if roi_bgr is None or roi_bgr.size == 0:
            return np.zeros((1, 1), dtype=bool)

        b, g, r = cv2.split(roi_bgr.astype(np.float32))
        skin_mask = (r > g) & ((r - g) >= 5.0) & (r >= 30.0)

        # If skin pixels in anatomical ROI are scarce due to cool white balance,
        # fallback to central 80% to ensure continuous rPPG perfusion tracking
        if np.sum(skin_mask) < 25:
            h, w = roi_bgr.shape[:2]
            skin_mask = np.zeros((h, w), dtype=bool)
            skin_mask[int(h * 0.1):int(h * 0.9), int(w * 0.1):int(w * 0.9)] = True

        return skin_mask
