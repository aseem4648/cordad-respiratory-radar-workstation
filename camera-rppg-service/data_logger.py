"""
CORDAD - Physiological Data & Session CSV Logger
Records real-time vitals and formats exportable clinical CSV logs.
"""

import time
from typing import Optional, List, Dict, Any
from collections import deque
import csv
import io

class DataLogger:
    def __init__(self, max_records: int = 3600):
        # Stores up to 1 hour of 1-second records in ring buffer
        self.records = deque(maxlen=max_records)

    def log_sample(self, hr: Optional[float], rr: Optional[float], 
                   apnea_duration: float, sqi: float, status: str):
        now_str = time.strftime("%H:%M:%S", time.localtime())
        record = {
            "timestamp": now_str,
            "hr": f"{hr:.0f}" if hr is not None else "--",
            "rr": f"{rr:.0f}" if rr is not None else "--",
            "apnea_duration": f"{apnea_duration:.1f}",
            "signal_quality": f"{sqi:.0f}",
            "status": status
        }
        self.records.append(record)

    def get_recent_records(self, limit: int = 50) -> List[Dict[str, Any]]:
        return list(self.records)[-limit:]

    def export_csv(self) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(["timestamp", "hr", "rr", "apnea_duration", "signal_quality", "status"])
        
        for r in self.records:
            writer.writerow([
                r["timestamp"],
                r["hr"],
                r["rr"],
                r["apnea_duration"],
                r["signal_quality"],
                r["status"]
            ])
            
        return output.getvalue()
