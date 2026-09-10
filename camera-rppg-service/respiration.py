"""
CORDAD - Camera-Based Respiratory Motion & Rate Extractor
Measures micro-displacement of thoracic / chin ROI, applies bandpass filter (0.1-0.7 Hz),
and estimates Respiratory Rate (breaths/min) and respiratory activity amplitude.
"""

import numpy as np
from scipy import signal
from typing import Optional, Tuple
from collections import deque
import cv2

class RespirationProcessor:
    def __init__(self, fps: float = 30.0, window_sec: float = 12.0):
        self.fps = fps
        self.buffer_size = int(fps * window_sec)
        
        self.motion_buffer = deque(maxlen=self.buffer_size)
        self.timestamps = deque(maxlen=self.buffer_size)
        self.rr_history = deque(maxlen=8)
        
        self.prev_gray_roi: Optional[np.ndarray] = None
        
        # Filter design: 0.10 Hz - 0.70 Hz (6 - 42 breaths/min)
        self.low_cut = 0.10
        self.high_cut = 0.70
        self.sos = signal.butter(
            N=2, 
            Wn=[self.low_cut, self.high_cut], 
            btype='bandpass', 
            fs=self.fps, 
            output='sos'
        )

        self.last_valid_rr: Optional[float] = None

    def process_thorax_roi(self, thorax_bgr: np.ndarray, timestamp: float) -> Tuple[Optional[float], Optional[float], float, float, float]:
        """
        Extracts breathing motion from thoracic / upper-body ROI.
        Returns:
        - current_rr: Instantaneous RR in breaths/min (or None)
        - rolling_rr: Smoothed RR in breaths/min (or None)
        - normalized_waveform: Normalized respiratory signal (-1.0 to 1.0)
        - respiratory_activity: Peak-to-peak oscillation amplitude (for apnea thresholding)
        - quality_score: Periodicity / SNR score (0 - 100%)
        """
        if thorax_bgr is None or thorax_bgr.size == 0:
            return None, None, 0.0, 0.0, 0.0

        # Downscale for high-speed motion tracking
        small_roi = cv2.resize(thorax_bgr, (80, 60))
        gray = cv2.cvtColor(small_roi, cv2.COLOR_BGR2GRAY)

        motion_val = 0.0
        if self.prev_gray_roi is not None and self.prev_gray_roi.shape == gray.shape:
            # 1. Temporal frame difference
            diff = cv2.absdiff(gray, self.prev_gray_roi)
            # 2. Vertical centroid gradient (breathing motion is dominantly vertical)
            row_means = np.mean(gray, axis=1) # shape: (60,)
            centroid_y = np.sum(np.arange(len(row_means)) * row_means) / (np.sum(row_means) + 1e-6)
            motion_val = float(centroid_y + np.mean(diff) * 0.1)

        self.prev_gray_roi = gray.copy()

        self.motion_buffer.append(motion_val)
        self.timestamps.append(timestamp)

        # Require at least 6 seconds of data before estimation
        min_samples = int(self.fps * 6.0)
        if len(self.motion_buffer) < min_samples:
            return None, None, 0.0, 0.0, 10.0

        raw_motion = np.array(self.motion_buffer)
        
        # Detrend
        detrended = signal.detrend(raw_motion)

        # 2nd-order Butterworth bandpass (0.10 - 0.70 Hz)
        try:
            filtered = signal.sosfiltfilt(self.sos, detrended)
            latest_val = float(filtered[-1])
        except Exception:
            return None, None, 0.0, 0.0, 0.0

        # Measure oscillation activity (std dev of recent 4-second window)
        recent_window = filtered[-int(self.fps * 4.0):]
        respiratory_activity = float(np.std(recent_window))

        # Normalized waveform between -1.0 and 1.0 for dashboard oscilloscope
        norm_factor = np.max(np.abs(filtered[-int(self.fps * 8.0):])) + 1e-6
        normalized_sample = max(-1.0, min(1.0, latest_val / norm_factor))

        # Frequency Domain Spectral Analysis (FFT)
        N = len(filtered)
        freqs = np.fft.rfftfreq(N, d=1.0 / self.fps)
        fft_mag = np.abs(np.fft.rfft(filtered))

        resp_indices = np.where((freqs >= self.low_cut) & (freqs <= self.high_cut))[0]
        if len(resp_indices) == 0:
            return None, None, normalized_sample, respiratory_activity, 0.0

        resp_freqs = freqs[resp_indices]
        resp_mag = fft_mag[resp_indices]

        peak_idx = np.argmax(resp_mag)
        peak_freq = resp_freqs[peak_idx]
        peak_power = resp_mag[peak_idx]

        mean_noise = (np.sum(resp_mag) - peak_power) / max(1, len(resp_mag) - 1)
        snr = peak_power / (mean_noise + 1e-6)
        quality_score = min(100.0, max(0.0, (snr - 1.1) / 2.5 * 100.0))

        estimated_rr = float(peak_freq * 60.0)

        # Validate against adult limits (6 - 45 breaths/min) and quality
        if quality_score >= 35.0 and 6.0 <= estimated_rr <= 45.0 and respiratory_activity >= 0.005:
            current_rr = round(estimated_rr, 1)
            self.rr_history.append(current_rr)
            rolling_rr = round(float(np.mean(self.rr_history)), 1)
            self.last_valid_rr = current_rr
        else:
            current_rr = self.last_valid_rr if (quality_score >= 25.0) else None
            rolling_rr = round(float(np.mean(self.rr_history)), 1) if len(self.rr_history) > 0 else None

        return current_rr, rolling_rr, normalized_sample, respiratory_activity, quality_score

    def reset(self):
        self.motion_buffer.clear()
        self.timestamps.clear()
        self.rr_history.clear()
        self.prev_gray_roi = None
        self.last_valid_rr = None
