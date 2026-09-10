"""
CORDAD - Remote Photoplethysmography (rPPG) Pulse & Heart Rate Extractor
Extracts facial skin chrominance oscillations (CHROM algorithm) and estimates HR (BPM).
"""

import numpy as np
from scipy import signal
from typing import Optional, Tuple, List
from collections import deque
import time

class RPPGProcessor:
    def __init__(self, fps: float = 30.0, window_sec: float = 8.0):
        self.fps = fps
        self.buffer_size = int(fps * window_sec)
        
        # Ring buffers for normalized RGB signals
        self.r_buffer = deque(maxlen=self.buffer_size)
        self.g_buffer = deque(maxlen=self.buffer_size)
        self.b_buffer = deque(maxlen=self.buffer_size)
        self.timestamps = deque(maxlen=self.buffer_size)
        
        # Filter design: 0.75 Hz - 2.50 Hz (45 - 150 BPM)
        self.low_cut = 0.75
        self.high_cut = 2.50
        self.sos = signal.butter(
            N=2, 
            Wn=[self.low_cut, self.high_cut], 
            btype='bandpass', 
            fs=self.fps, 
            output='sos'
        )

        self.last_valid_hr: Optional[float] = None
        self.hr_history = deque(maxlen=10) # 10-second rolling average

    def process_skin_rois(self, forehead_bgr: np.ndarray, forehead_mask: np.ndarray,
                           l_cheek_bgr: np.ndarray, l_cheek_mask: np.ndarray,
                           r_cheek_bgr: np.ndarray, r_cheek_mask: np.ndarray,
                           timestamp: float) -> Tuple[Optional[float], Optional[float], float, float]:
        """
        Ingests skin pixels across anatomical ROIs.
        Returns:
        - current_hr: Instantaneous HR in BPM (or None if unverified)
        - rolling_hr: 10-second smoothed HR in BPM (or None)
        - raw_pulse: Latest filtered rPPG pulse sample
        - pnr_quality: Peak-to-Noise Ratio (0 - 100%)
        """
        r_vals, g_vals, b_vals = [], [], []

        for roi, mask in [(forehead_bgr, forehead_mask), (l_cheek_bgr, l_cheek_mask), (r_cheek_bgr, r_cheek_mask)]:
            if roi is not None and mask is not None and np.any(mask):
                skin_pixels = roi[mask] # shape: (N, 3) in BGR
                if len(skin_pixels) >= 15:
                    b_vals.append(np.mean(skin_pixels[:, 0]))
                    g_vals.append(np.mean(skin_pixels[:, 1]))
                    r_vals.append(np.mean(skin_pixels[:, 2]))

        if len(r_vals) == 0:
            # Face or skin not sufficiently detected
            return None, None, 0.0, 0.0

        mean_r = float(np.mean(r_vals))
        mean_g = float(np.mean(g_vals))
        mean_b = float(np.mean(b_vals))

        self.r_buffer.append(mean_r)
        self.g_buffer.append(mean_g)
        self.b_buffer.append(mean_b)
        self.timestamps.append(timestamp)

        # Minimum 4 seconds of samples required before estimating HR
        min_samples = int(self.fps * 4.0)
        if len(self.r_buffer) < min_samples:
            return None, None, 0.0, 10.0

        # CHROM (Chrominance-based rPPG) Method:
        R = np.array(self.r_buffer)
        G = np.array(self.g_buffer)
        B = np.array(self.b_buffer)

        # Normalize by mean
        R_norm = (R - np.mean(R)) / (np.std(R) + 1e-6)
        G_norm = (G - np.mean(G)) / (np.std(G) + 1e-6)
        B_norm = (B - np.mean(B)) / (np.std(B) + 1e-6)

        # CHROM projection
        Xs = 3.0 * R_norm - 2.0 * G_norm
        Ys = 1.5 * R_norm + G_norm - 1.5 * B_norm

        std_x = np.std(Xs)
        std_y = np.std(Ys)
        alpha = (std_x / (std_y + 1e-6))
        raw_chrom = Xs - alpha * Ys

        # Butterworth bandpass filtering (0.75 - 2.50 Hz)
        try:
            filtered = signal.sosfiltfilt(self.sos, raw_chrom)
            latest_sample = float(filtered[-1])
        except Exception:
            return None, None, 0.0, 0.0

        # Frequency Domain Spectral Analysis (FFT)
        N = len(filtered)
        freqs = np.fft.rfftfreq(N, d=1.0 / self.fps)
        fft_mag = np.abs(np.fft.rfft(filtered))

        # Filter to physiological cardiac band (45 - 150 BPM = 0.75 - 2.50 Hz)
        cardiac_indices = np.where((freqs >= self.low_cut) & (freqs <= self.high_cut))[0]
        if len(cardiac_indices) == 0:
            return None, None, latest_sample, 0.0

        cardiac_freqs = freqs[cardiac_indices]
        cardiac_mag = fft_mag[cardiac_indices]

        peak_idx = np.argmax(cardiac_mag)
        peak_freq = cardiac_freqs[peak_idx]
        peak_power = cardiac_mag[peak_idx]

        # Calculate Peak-to-Noise Ratio (PNR)
        mean_noise = (np.sum(cardiac_mag) - peak_power) / max(1, len(cardiac_mag) - 1)
        pnr = peak_power / (mean_noise + 1e-6)
        # Scale PNR to 0 - 100 quality percentage
        pnr_quality = min(100.0, max(0.0, (pnr - 1.1) / 2.6 * 100.0))

        estimated_hr = float(peak_freq * 60.0)

        # Accept measurement with robust physiological limits
        if pnr_quality >= 30.0 and 45.0 <= estimated_hr <= 160.0:
            current_hr = round(estimated_hr, 1)
            self.hr_history.append(current_hr)
            rolling_hr = round(float(np.median(self.hr_history)), 1)
            self.last_valid_hr = current_hr
        else:
            current_hr = self.last_valid_hr if (pnr_quality >= 22.0) else None
            rolling_hr = round(float(np.median(self.hr_history)), 1) if len(self.hr_history) > 0 else None

        return current_hr, rolling_hr, latest_sample, pnr_quality

    def reset(self):
        self.r_buffer.clear()
        self.g_buffer.clear()
        self.b_buffer.clear()
        self.timestamps.clear()
        self.hr_history.clear()
        self.last_valid_hr = None
