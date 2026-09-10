export function formatDuration(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  return [
    hrs.toString().padStart(2, '0'),
    mins.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].join(':');
}

export function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return '--:--:--';
  return new Date(timestamp).toLocaleTimeString('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function formatMetric(val: number | null | undefined, digits = 1, unit = ''): string {
  if (val === null || val === undefined || isNaN(val)) {
    return '--';
  }
  return `${val.toFixed(digits)}${unit ? ' ' + unit : ''}`;
}
