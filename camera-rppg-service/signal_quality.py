"""
CORDAD - Signal Quality Index (SQI) Calculator
Computes composite 0-100% score and classifies quality status:
80-100: GOOD | 60-79: ACCEPTABLE | 40-59: POOR | 0-39: INVALID
"""

from typing import Tuple

class SignalQualityCalculator:
    def __init__(self):
        pass

    def compute_sqi(self, face_detected: bool, rppg_pnr: float, resp_snr: float, 
                    motion_stable: bool = True) -> Tuple[float, str, bool]:
        """
        Calculates composite SQI from multiple sub-metrics:
        - face_detected: Boolean (0 or 100)
        - rppg_pnr: 0 - 100
        - resp_snr: 0 - 100
        - motion_stable: Penalty if excessive motion artifact is present

        Returns:
        - sqi: 0.0 - 100.0%
        - status_label: 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'INVALID'
        - is_valid: True if SQI >= 40% and face detected
        """
        if not face_detected:
            return 0.0, "INVALID", False

        # Weighted combination:
        # Face confidence: 20%, rPPG quality: 40%, Respiration quality: 40%
        face_score = 100.0
        motion_factor = 1.0 if motion_stable else 0.5

        raw_sqi = (face_score * 0.20 + rppg_pnr * 0.40 + resp_snr * 0.40) * motion_factor
        sqi = max(0.0, min(100.0, round(raw_sqi, 1)))

        if sqi >= 80.0:
            status_label = "GOOD"
            is_valid = True
        elif sqi >= 60.0:
            status_label = "ACCEPTABLE"
            is_valid = True
        elif sqi >= 40.0:
            status_label = "POOR"
            is_valid = True
        else:
            status_label = "INVALID"
            is_valid = False

        return sqi, status_label, is_valid
