"""
CORDAD - Prototype Adult Physiological Thresholds & Clinical Alert Rules
Configurable parameters for Heart Rate, Respiratory Rate, Apnea, and Combined Distress.

DISCLAIMER:
These are prototype screening thresholds and not universal clinical diagnostic criteria.
"""

from pydantic import BaseModel, Field
from typing import Optional

class ThresholdConfig(BaseModel):
    # Heart Rate Limits (BPM)
    hr_normal_min: float = Field(default=60.0, description="Minimum normal adult HR (BPM)")
    hr_normal_max: float = Field(default=100.0, description="Maximum normal adult HR (BPM)")
    hr_warning_low: float = Field(default=50.0, description="HR Warning Low threshold (BPM)")
    hr_warning_high: float = Field(default=100.0, description="HR Warning High threshold (BPM)")
    hr_critical_low: float = Field(default=40.0, description="HR Critical Low threshold (BPM)")
    hr_critical_high: float = Field(default=120.0, description="HR Critical High threshold (BPM)")

    # Respiratory Rate Limits (breaths/min)
    rr_normal_min: float = Field(default=12.0, description="Minimum normal adult RR (breaths/min)")
    rr_normal_max: float = Field(default=20.0, description="Maximum normal adult RR (breaths/min)")
    rr_warning_low: float = Field(default=10.0, description="RR Warning Low threshold (breaths/min)")
    rr_warning_high: float = Field(default=20.0, description="RR Warning High threshold (breaths/min)")
    rr_critical_low: float = Field(default=8.0, description="RR Critical Low threshold (breaths/min)")
    rr_critical_high: float = Field(default=30.0, description="RR Critical High threshold (breaths/min)")

    # Apnea Duration Limits (Seconds)
    apnea_warning_sec: float = Field(default=10.0, description="Warning apnea duration (s)")
    apnea_critical_sec: float = Field(default=20.0, description="Prolonged/critical apnea duration (s)")

    # Alert Persistence Windows (Seconds)
    warning_persistence_sec: float = Field(default=10.0, description="Persistence time before warning fires (s)")
    critical_persistence_sec: float = Field(default=5.0, description="Persistence time before critical alert fires (s)")
    recovery_cooldown_sec: float = Field(default=5.0, description="Stable recovery duration before clearing alert (s)")

    # Signal Quality Index (SQI) Thresholds
    sqi_good_min: float = Field(default=80.0, description="SQI Good threshold (%)")
    sqi_acceptable_min: float = Field(default=60.0, description="SQI Acceptable threshold (%)")
    sqi_poor_min: float = Field(default=40.0, description="SQI Poor threshold (%)")

    # Respiratory Activity Amplitude Threshold (for Apnea cessation detection)
    respiratory_activity_threshold: float = Field(default=0.015, description="Minimum oscillation amplitude for valid breathing")

DEFAULT_THRESHOLDS = ThresholdConfig()
