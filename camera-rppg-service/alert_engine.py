"""
CORDAD - Real-Time Clinical Alert & Apnea Engine
Implements persistence windows, hysteresis recovery, combined respiratory distress detection,
apnea duration timers, and priority-ranked clinical alerts.

DISCLAIMER:
Prototype monitoring system. Alerts are intended for screening and clinical review
and are not a substitute for professional medical assessment.
"""

import time
from typing import Optional, List, Dict, Any, Tuple
from thresholds import ThresholdConfig

class AlertEvent:
    def __init__(self, alert_id: str, timestamp: str, parameter: str, value: Any,
                 threshold_exceeded: str, severity: str, message: str):
        self.id = alert_id
        self.timestamp = timestamp
        self.parameter = parameter
        self.value = value
        self.threshold_exceeded = threshold_exceeded
        self.severity = severity # 'CRITICAL', 'WARNING', 'NORMAL', 'SIGNAL_UNAVAILABLE'
        self.message = message
        self.acknowledged = False
        self.duration_seconds = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "parameter": self.parameter,
            "value": self.value,
            "threshold_exceeded": self.threshold_exceeded,
            "severity": self.severity,
            "message": self.message,
            "acknowledged": self.acknowledged,
            "duration_seconds": round(self.duration_seconds, 1)
        }

class AlertEngine:
    def __init__(self, config: Optional[ThresholdConfig] = None):
        self.config = config or ThresholdConfig()
        
        # Persistence timers (tracks when condition started)
        self.hr_warning_start: Optional[float] = None
        self.hr_critical_start: Optional[float] = None
        
        self.rr_warning_start: Optional[float] = None
        self.rr_critical_start: Optional[float] = None

        self.distress_warning_start: Optional[float] = None
        self.distress_critical_start: Optional[float] = None

        # Recovery tracking
        self.last_hr_safe_time: float = time.time()
        self.last_rr_safe_time: float = time.time()

        # Apnea tracking
        self.is_apnea: bool = False
        self.apnea_start_time: Optional[float] = None
        self.apnea_duration: float = 0.0
        self.last_breath_time: float = time.time()
        self.apnea_event_history: List[Dict[str, Any]] = []

        # Active & Historical Alerts
        self.active_alerts: Dict[str, AlertEvent] = {}
        self.alert_history: List[Dict[str, Any]] = []
        self.alert_counter = 0

    def update_thresholds(self, new_config: ThresholdConfig):
        self.config = new_config

    def process(self, hr: Optional[float], rr: Optional[float], 
                resp_activity: float, sqi: float, is_valid: bool) -> Dict[str, Any]:
        now = time.time()
        now_str = time.strftime("%H:%M:%S", time.localtime(now))

        # Rule: If signal quality is low (< 40%) or face lost, suppress physiological alarms
        if not is_valid or sqi < self.config.sqi_poor_min:
            self._handle_signal_unavailable(now, now_str, sqi)
            return self._build_status_packet(hr, rr, sqi, "SIGNAL_UNAVAILABLE")

        # Clear signal unavailable alert if active
        if "SIGNAL_QUALITY" in self.active_alerts:
            del self.active_alerts["SIGNAL_QUALITY"]

        # -------------------------------------------------------------
        # 1. APNEA DETECTION PIPELINE
        # -------------------------------------------------------------
        apnea_state, apnea_msg, apnea_pattern = self._evaluate_apnea(now, resp_activity)

        # -------------------------------------------------------------
        # 2. HEART RATE EVALUATION (Persistence & Hysteresis)
        # -------------------------------------------------------------
        hr_severity, hr_status = self._evaluate_heart_rate(now, hr, now_str)

        # -------------------------------------------------------------
        # 3. RESPIRATORY RATE EVALUATION (Persistence & Hysteresis)
        # -------------------------------------------------------------
        rr_severity, rr_status = self._evaluate_respiratory_rate(now, rr, now_str)

        # -------------------------------------------------------------
        # 4. COMBINED RESPIRATORY DISTRESS DETECTION
        # -------------------------------------------------------------
        distress_status = self._evaluate_distress(now, hr, rr, now_str)

        # Update duration for all active alerts
        for a in self.active_alerts.values():
            a.duration_seconds += 1.0

        return self._build_status_packet(
            hr=hr, 
            rr=rr, 
            sqi=sqi, 
            overall_status=self._get_overall_priority_status(),
            hr_status=hr_status,
            rr_status=rr_status,
            apnea_state=apnea_state,
            apnea_msg=apnea_msg,
            apnea_pattern=apnea_pattern,
            distress_status=distress_status
        )

    def _evaluate_apnea(self, now: float, resp_activity: float) -> Tuple[str, str, Optional[str]]:
        """
        Apnea detection:
        - Activity below threshold triggers timer
        - >= 10s: APNEA WARNING
        - >= 20s: PROLONGED APNEA (CRITICAL)
        - Stops timer when breathing activity returns
        """
        now_str = time.strftime("%H:%M:%S", time.localtime(now))
        
        # Check if breathing amplitude is absent/severely reduced
        if resp_activity < self.config.respiratory_activity_threshold:
            if not self.is_apnea:
                self.is_apnea = True
                self.apnea_start_time = now
            
            self.apnea_duration = now - self.apnea_start_time

            # Classification of pattern (obstructive vs central screening pattern)
            pattern = "Possible Central Apnea Pattern" if resp_activity < 0.003 else "Possible Obstructive Apnea Pattern"

            if self.apnea_duration >= self.config.apnea_critical_sec:
                self._trigger_alert(
                    "APNEA", now_str, "Respiration", f"{self.apnea_duration:.1f}s",
                    f">= {self.config.apnea_critical_sec}s", "CRITICAL",
                    f"PROLONGED APNEA — Respiratory activity absent/reduced for {int(self.apnea_duration)} s ({pattern})"
                )
                return "PROLONGED_APNEA", f"Respiratory activity absent/reduced for {int(self.apnea_duration)} s", pattern
            elif self.apnea_duration >= self.config.apnea_warning_sec:
                self._trigger_alert(
                    "APNEA", now_str, "Respiration", f"{self.apnea_duration:.1f}s",
                    f">= {self.config.apnea_warning_sec}s", "WARNING",
                    f"APNEA WARNING — Respiratory activity absent/reduced for {int(self.apnea_duration)} s ({pattern})"
                )
                return "APNEA_WARNING", f"Respiratory activity absent/reduced for {int(self.apnea_duration)} s", pattern
            else:
                return "APNEA_PENDING", f"Monitoring cessation: {int(self.apnea_duration)}s", None
        else:
            # Respiration present -> reset apnea
            if self.is_apnea:
                # Log completed apnea event
                self.apnea_event_history.append({
                    "start_time": time.strftime("%H:%M:%S", time.localtime(self.apnea_start_time or now)),
                    "end_time": now_str,
                    "duration_seconds": round(self.apnea_duration, 1)
                })
                self.is_apnea = False
                self.apnea_start_time = None
                self.apnea_duration = 0.0
                if "APNEA" in self.active_alerts:
                    del self.active_alerts["APNEA"]

            return "NO_APNEA", "Normal respiratory oscillation observed", None

    def _evaluate_heart_rate(self, now: float, hr: Optional[float], now_str: str) -> Tuple[str, str]:
        if hr is None:
            return "NORMAL", "UNKNOWN"

        cfg = self.config

        # Check Critical conditions
        is_crit = (hr < cfg.hr_critical_low) or (hr > cfg.hr_critical_high)
        if is_crit:
            if self.hr_critical_start is None:
                self.hr_critical_start = now
            if (now - self.hr_critical_start) >= cfg.critical_persistence_sec:
                msg = f"Critical Heart Rate: {hr:.0f} BPM (Threshold: <{cfg.hr_critical_low} or >{cfg.hr_critical_high})"
                self._trigger_alert("HR", now_str, "Heart Rate", f"{hr:.0f} BPM", f"<{cfg.hr_critical_low} or >{cfg.hr_critical_high}", "CRITICAL", msg)
                return "CRITICAL", "CRITICAL"
        else:
            self.hr_critical_start = None

        # Check Warning conditions
        is_warn = (hr < cfg.hr_warning_low) or (hr > cfg.hr_warning_high)
        if is_warn:
            if self.hr_warning_start is None:
                self.hr_warning_start = now
            if (now - self.hr_warning_start) >= cfg.warning_persistence_sec:
                msg = f"Elevated/Low Heart Rate: {hr:.0f} BPM (Threshold: <{cfg.hr_warning_low} or >{cfg.hr_warning_high})"
                self._trigger_alert("HR", now_str, "Heart Rate", f"{hr:.0f} BPM", f"<{cfg.hr_warning_low} or >{cfg.hr_warning_high}", "WARNING", msg)
                return "WARNING", "WARNING"
        else:
            self.hr_warning_start = None

        # Recovery check (Hysteresis)
        if not is_crit and not is_warn:
            if "HR" in self.active_alerts:
                if (now - self.last_hr_safe_time) >= cfg.recovery_cooldown_sec:
                    del self.active_alerts["HR"]
            else:
                self.last_hr_safe_time = now

        return "NORMAL", "NORMAL"

    def _evaluate_respiratory_rate(self, now: float, rr: Optional[float], now_str: str) -> Tuple[str, str]:
        if rr is None:
            return "NORMAL", "UNKNOWN"

        cfg = self.config

        is_crit = (rr < cfg.rr_critical_low) or (rr > cfg.rr_critical_high)
        if is_crit:
            if self.rr_critical_start is None:
                self.rr_critical_start = now
            if (now - self.rr_critical_start) >= cfg.critical_persistence_sec:
                msg = f"Critical Respiratory Rate: {rr:.1f} breaths/min (Threshold: <{cfg.rr_critical_low} or >{cfg.rr_critical_high})"
                self._trigger_alert("RR", now_str, "Respiratory Rate", f"{rr:.1f} breaths/min", f"<{cfg.rr_critical_low} or >{cfg.rr_critical_high}", "CRITICAL", msg)
                return "CRITICAL", "CRITICAL"
        else:
            self.rr_critical_start = None

        is_warn = (rr < cfg.rr_warning_low) or (rr > cfg.rr_warning_high)
        if is_warn:
            if self.rr_warning_start is None:
                self.rr_warning_start = now
            if (now - self.rr_warning_start) >= cfg.warning_persistence_sec:
                msg = f"Abnormal Respiratory Rate: {rr:.1f} breaths/min (Threshold: <{cfg.rr_warning_low} or >{cfg.rr_warning_high})"
                self._trigger_alert("RR", now_str, "Respiratory Rate", f"{rr:.1f} breaths/min", f"<{cfg.rr_warning_low} or >{cfg.rr_warning_high}", "WARNING", msg)
                return "WARNING", "WARNING"
        else:
            self.rr_warning_start = None

        if not is_crit and not is_warn:
            if "RR" in self.active_alerts:
                if (now - self.last_rr_safe_time) >= cfg.recovery_cooldown_sec:
                    del self.active_alerts["RR"]
            else:
                self.last_rr_safe_time = now

        return "NORMAL", "NORMAL"

    def _evaluate_distress(self, now: float, hr: Optional[float], rr: Optional[float], now_str: str) -> str:
        if hr is None or rr is None:
            return "NORMAL"

        cfg = self.config

        # 1. Critical Distress: RR > 30 and HR > 120 for 5s
        if rr > 30.0 and hr > 120.0:
            if self.distress_critical_start is None:
                self.distress_critical_start = now
            if (now - self.distress_critical_start) >= 5.0:
                self._trigger_alert("DISTRESS", now_str, "Combined", f"RR={rr:.0f}, HR={hr:.0f}", "RR>30 & HR>120 (5s)", "CRITICAL", "CRITICAL RESPIRATORY DISTRESS RISK: Marked Tachypnea & Tachycardia")
                return "CRITICAL_DISTRESS_RISK"
        else:
            self.distress_critical_start = None

        # 2. Warning Distress: RR > 20 and HR > 100 for 10s
        if rr > 20.0 and hr > 100.0:
            if self.distress_warning_start is None:
                self.distress_warning_start = now
            if (now - self.distress_warning_start) >= 10.0:
                self._trigger_alert("DISTRESS", now_str, "Combined", f"RR={rr:.0f}, HR={hr:.0f}", "RR>20 & HR>100 (10s)", "WARNING", "RESPIRATORY DISTRESS RISK: Elevated RR & HR")
                return "DISTRESS_RISK"
        else:
            self.distress_warning_start = None

        # 3. Depression Risk: RR < 10 and abnormal HR
        if rr < 10.0 and (hr < 50.0 or hr > 100.0):
            self._trigger_alert("DISTRESS", now_str, "Combined", f"RR={rr:.0f}, HR={hr:.0f}", "RR<10 & HR Abnormal", "WARNING", "RESPIRATORY DEPRESSION RISK: Hypoventilation with abnormal heart rate")
            return "DEPRESSION_RISK"

        if "DISTRESS" in self.active_alerts:
            del self.active_alerts["DISTRESS"]

        return "NORMAL"

    def _handle_signal_unavailable(self, now: float, now_str: str, sqi: float):
        # Reset internal timers
        self.hr_warning_start = None
        self.hr_critical_start = None
        self.rr_warning_start = None
        self.rr_critical_start = None
        self.distress_warning_start = None
        self.distress_critical_start = None
        self.is_apnea = False
        self.apnea_duration = 0.0

        # Clear physiological alerts while signal is invalid
        for k in ["HR", "RR", "APNEA", "DISTRESS"]:
            if k in self.active_alerts:
                del self.active_alerts[k]

        self._trigger_alert(
            "SIGNAL_QUALITY", now_str, "Optical Sensor", f"{sqi:.0f}%", "< 40%", "SIGNAL_UNAVAILABLE",
            f"SIGNAL QUALITY LOW ({sqi:.0f}%) — Physiological monitoring paused until face/lighting stabilizes."
        )

    def _trigger_alert(self, key: str, timestamp: str, parameter: str, value: Any, 
                       threshold: str, severity: str, message: str):
        if key in self.active_alerts:
            existing = self.active_alerts[key]
            existing.value = value
            existing.severity = severity
            existing.message = message
        else:
            self.alert_counter += 1
            alert = AlertEvent(
                alert_id=f"ALT-{self.alert_counter:04d}",
                timestamp=timestamp,
                parameter=parameter,
                value=value,
                threshold_exceeded=threshold,
                severity=severity,
                message=message
            )
            self.active_alerts[key] = alert
            self.alert_history.insert(0, alert.to_dict())
            if len(self.alert_history) > 100:
                self.alert_history.pop()

    def acknowledge_alert(self, alert_id: str) -> bool:
        for a in self.active_alerts.values():
            if a.id == alert_id:
                a.acknowledged = True
                return True
        return False

    def _get_overall_priority_status(self) -> str:
        # Priority: Prolonged apnea (Critical) > Critical RR/HR > Distress > Warning > Normal
        severities = [a.severity for a in self.active_alerts.values()]
        if "CRITICAL" in severities:
            return "CRITICAL"
        if "WARNING" in severities:
            return "WARNING"
        if "SIGNAL_UNAVAILABLE" in severities:
            return "SIGNAL_UNAVAILABLE"
        return "NORMAL"

    def _build_status_packet(self, hr: Optional[float], rr: Optional[float], sqi: float, 
                             overall_status: str, hr_status: str = "NORMAL", rr_status: str = "NORMAL",
                             apnea_state: str = "NO_APNEA", apnea_msg: str = "Normal",
                             apnea_pattern: Optional[str] = None, distress_status: str = "NORMAL") -> Dict[str, Any]:
        return {
            "overall_status": overall_status,
            "hr_status": hr_status,
            "rr_status": rr_status,
            "apnea_state": apnea_state,
            "apnea_msg": apnea_msg,
            "apnea_pattern": apnea_pattern,
            "apnea_duration": round(self.apnea_duration, 1),
            "distress_status": distress_status,
            "active_alerts": [a.to_dict() for a in self.active_alerts.values()],
            "recent_alerts": self.alert_history[:25],
            "disclaimer": "Prototype monitoring system. Alerts are intended for screening and clinical review and are not a substitute for professional medical assessment."
        }
