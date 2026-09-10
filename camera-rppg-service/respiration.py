"""
CORDAD - Camera-Based Respiratory Motion & Rate Extractor
Measures directional vertical expansion/contraction of thoracic ROI without unsigned noise.
Dual-domain estimator (prominence peak intervals + high-resolution FFT) with rate stabilization.
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
        
        # Rate tracking buffers
        self.rr_history = deque(maxlen=6)
        self.prev_v_pos: Optional[float] = None
        self.cumulative_displacement: float = 0.0
        
        # Clinical respiratory band: 0.12 Hz - 0.60 Hz (7.2 - 36.0 breaths/min)
        self.low_cut = 0.12
        self.high_cut = 0.60
        self.sos = signal.butter(
            N=2, 
            Wn=[self.low_cut, self.high_cut], 
            btype='bandpass', 
            fs=self.fps, 
            output='sos'
        )

        self.last_valid_rr: Optional[float] = None
        self.smoothed_rr: Optional[float] = None

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

        # Downscale for rapid spatial luminance analysis
        small_roi = cv2.resize(thorax_bgr, (80, 60))
        gray = cv2.cvtColor(small_roi, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # Measure vertical center-of-mass:
        # True breathing causes vertical translation of garment folds and clavicle
        row_means = np.mean(blurred, axis=1) # shape: (60,)
        denom = float(np.sum(row_means)) + 1e-6
        y_indices = np.arange(len(row_means))
        v_pos = float(np.sum(y_indices * row_means) / denom)

        # Compute directional vertical velocity
        if self.prev_v_pos is not None:
            raw_velocity = v_pos - self.prev_v_pos
            # Outlier rejection: Clamp sudden twitches or head turns (> 1.2 px/frame)
            # This prevents impulsive filter ringing that previously caused spikes to 40 BPM
            clamped_velocity = max(-1.2, min(1.2, raw_velocity))
            self.cumulative_displacement += clamped_velocity
        else:
            self.cumulative_displacement = 0.0

        self.prev_v_pos = v_pos
        self.motion_buffer.append(self.cumulative_displacement)
        self.timestamps.append(timestamp)

        # Require at least 5 seconds of data before estimation
        min_samples = int(self.fps * 5.0)
        if len(self.motion_buffer) < min_samples:
            return None, None, 0.0, 0.0, 10.0

        raw_motion = np.array(self.motion_buffer)
        
        # Detrend linear baseline drift
        detrended = signal.detrend(raw_motion)

        # 2nd-order Butterworth zero-phase bandpass (0.12 - 0.60 Hz)
        try:
            filtered = signal.sosfiltfilt(self.sos, detrended)
            latest_val = float(filtered[-1])
        except Exception:
            return None, None, 0.0, 0.0, 0.0

        # Measure oscillation activity (std dev of recent 4-second window)
        recent_window = filtered[-int(self.fps * 4.0):]
        respiratory_activity = float(np.std(recent_window))

        # Normalized waveform between -1.0 and 1.0 for dashboard oscilloscope
        norm_factor = np.percentile(np.abs(filtered), 95) + 1e-5
        normalized_sample = max(-1.0, min(1.0, latest_val / norm_factor))

        # ==========================================
        # Dual-Domain Rate Estimation (Intervals + FFT)
        # ==========================================
        
        # 1. Time-Domain Peak-to-Peak Interval Analysis
        # Minimum distance between breaths: 1.6 seconds (max 37.5 breaths/min)
        min_distance = int(self.fps * 1.6)
        prominence = max(0.005, float(0.20 * np.std(filtered)))
        peaks, _ = signal.find_peaks(filtered, distance=min_distance, prominence=prominence)

        peak_rr = None
        if len(peaks) >= 2:
            time_arr = np.array(self.timestamps)
            peak_times = time_arr[peaks]
            intervals = np.diff(peak_times)
            # Valid breath intervals: 1.6s to 6.5s (9 to 37.5 breaths/min)
            valid_intervals = intervals[(intervals >= 1.6) & (intervals <= 6.5)]
            if len(valid_intervals) >= 1:
                median_interval = float(np.median(valid_intervals))
                peak_rr = 60.0 / median_interval

        # 2. High-Resolution Frequency-Domain Spectral Analysis (FFT)
        N = len(filtered)
        window = np.hanning(N)
        # 4x zero-padding for fine frequency resolution
        n_fft = N * 4
        freqs = np.fft.rfftfreq(n_fft, d=1.0 / self.fps)
        fft_mag = np.abs(np.fft.rfft(filtered * window, n=n_fft))

        resp_indices = np.where((freqs >= self.low_cut) & (freqs <= self.high_cut))[0]
        if len(resp_indices) == 0:
            return None, None, normalized_sample, respiratory_activity, 0.0

        resp_freqs = freqs[resp_indices]
        resp_mag = fft_mag[resp_indices]

        peak_idx = np.argmax(resp_mag)
        fft_peak_freq = resp_freqs[peak_idx]
        peak_power = resp_mag[peak_idx]

        # Calculate Signal-to-Noise Ratio (SNR)
        mean_noise = (np.sum(resp_mag) - peak_power) / max(1, len(resp_mag) - 1)
        snr = peak_power / (mean_noise + 1e-6)
        quality_score = min(100.0, max(0.0, (snr - 1.2) / 2.8 * 100.0))

        fft_rr = float(fft_peak_freq * 60.0)

        # 3. Decision Fusion & Outlier Smoothing
        candidate_rr = None
        if peak_rr is not None and 8.0 <= peak_rr <= 38.0:
            if abs(peak_rr - fft_rr) <= 5.0:
                # Both time and frequency agree -> high confidence
                candidate_rr = 0.65 * peak_rr + 0.35 * fft_rr
                quality_score = max(quality_score, 75.0)
            else:
                candidate_rr = peak_rr if (quality_score < 60.0) else fft_rr
        elif 8.0 <= fft_rr <= 38.0 and quality_score >= 35.0:
            candidate_rr = fft_rr

        # Apply Rate Stabilization (EMA) to eliminate jumpy rate readings
        if candidate_rr is not None and respiratory_activity >= 0.003:
            current_rr = round(candidate_rr, 1)
            if self.smoothed_rr is None:
                self.smoothed_rr = current_rr
            else:
                # Gentle 15% EMA update prevents wild fluctuations
                self.smoothed_rr = round(0.82 * self.smoothed_rr + 0.18 * current_rr, 1)

            self.rr_history.append(self.smoothed_rr)
            rolling_rr = round(float(np.median(self.rr_history)), 1)
            self.last_valid_rr = self.smoothed_rr
        else:
            current_rr = self.last_valid_rr if (quality_score >= 25.0) else None
            rolling_rr = round(float(np.median(self.rr_history)), 1) if len(self.rr_history) > 0 else None

        return current_rr, rolling_rr, normalized_sample, respiratory_activity, quality_score

    def reset(self):
        self.motion_buffer.clear()
        self.timestamps.clear()
        self.rr_history.clear()
        self.prev_v_pos = None
        self.cumulative_displacement = 0.0
        self.last_valid_rr = None
        self.smoothed_rr = None
