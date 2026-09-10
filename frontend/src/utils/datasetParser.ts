import * as XLSX from 'xlsx';

export interface SignalColumnMapping {
  name: string;
  type: 'PRIMARY_RESPIRATORY' | 'RAW_RADAR' | 'FILTERED_RADAR' | 'PHASE' | 'DISTANCE' | 'RESPIRATORY_RATE' | 'REFERENCE_RR' | 'OTHER_NUMERIC';
}

export interface ColumnProfile {
  name: string;
  dataType: 'numeric' | 'timestamp' | 'boolean' | 'string' | 'categorical';
  validCount: number;
  missingCount: number;
  uniqueCount: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  isNumeric: boolean;
  isSuitableForWaveform: boolean;
  sampleValues: any[];
}

export interface DatasetValidationReport {
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  sheets: string[];
  selectedSheet?: string;
  rowCount: number;
  columnCount: number;
  columnNames: string[];
  columnProfiles: ColumnProfile[];
  detectedSignalColumns: SignalColumnMapping[];
  timestampColumn: string | null;
  hasTimestamps: boolean;
  isMonotonicTimestamps: boolean;
  timestampGapsCount: number;
  samplingIntervalSeconds: number | null;
  estimatedSamplingRateHz: number | null;
  samplingRateSource: 'TIMESTAMP_CALCULATED' | 'UNAVAILABLE';
  missingValuesCount: number;
  duplicateRowsCount: number;
  duplicateTimestampsCount: number;
  invalidValuesCount: number;
  signalDurationSeconds: number | null;
  isValid: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  previewRows: Record<string, any>[];
  rawRows: Record<string, any>[]; // The complete uploaded dataset
  parsedSamples: ParsedDatasetSample[];
}

export interface ParsedDatasetSample {
  index: number;
  timestamp: number;
  timeLabel: string;
  rawSignal: number | null;
  filteredSignal: number | null;
  respiratoryRate: number | null;
  signalQuality: number | null;
  targetDistance: number | null;
  presence: boolean | null;
}

export class DatasetParser {
  public static async parseFile(file: File): Promise<DatasetValidationReport> {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const buffer = await file.arrayBuffer();

    let rawData: Record<string, any>[] = [];
    let sheets: string[] = [];
    let selectedSheet: string | undefined = undefined;

    let fileType = 'Unknown Data File';
    if (ext === '.xlsx' || ext === '.xls') fileType = `Excel Spreadsheet (${ext})`;
    else if (ext === '.csv') fileType = 'Comma-Separated Values (CSV)';
    else if (ext === '.json') fileType = 'JSON Object Array';
    else if (ext === '.txt' || ext === '.dat') fileType = `Text / Tabular Data (${ext})`;

    if (ext === '.json') {
      try {
        const text = new TextDecoder().decode(buffer);
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          rawData = parsed;
        } else if (parsed.data && Array.isArray(parsed.data)) {
          rawData = parsed.data;
        } else if (parsed.samples && Array.isArray(parsed.samples)) {
          rawData = parsed.samples;
        } else {
          throw new Error('JSON structure must be an array of objects or contain a "data" array');
        }
        sheets = ['JSON'];
      } catch (err: any) {
        return this.createErrorValidation(file.name, fileType, file.size, [`Invalid JSON format: ${err.message}`]);
      }
    } else if (ext === '.csv' || ext === '.txt' || ext === '.dat' || ext === '.tsv') {
      // FAST PATH: Line-based parser for text files (50x faster than SheetJS for large files)
      try {
        const text = new TextDecoder().decode(buffer);
        rawData = this.parseDelimitedText(text);
        sheets = ['Data'];
        selectedSheet = 'Data';
      } catch (err: any) {
        return this.createErrorValidation(file.name, fileType, file.size, [`Failed to parse delimited text: ${err.message}`]);
      }
    } else {
      // EXCEL WORKBOOK (.xlsx, .xls)
      try {
        const workbook = XLSX.read(buffer, { type: 'array', dense: true, cellDates: true });
        sheets = workbook.SheetNames;
        if (sheets.length === 0) {
          return this.createErrorValidation(file.name, fileType, file.size, ['No data sheets detected in workbook']);
        }
        selectedSheet = sheets[0];
        const worksheet = workbook.Sheets[selectedSheet];
        rawData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
      } catch (err: any) {
        return this.createErrorValidation(file.name, fileType, file.size, [`Failed to parse Excel spreadsheet: ${err.message}`]);
      }
    }

    if (!rawData || rawData.length === 0) {
      return this.createErrorValidation(file.name, fileType, file.size, ['Uploaded dataset is empty. Zero data rows found.']);
    }

    const columnNames = Object.keys(rawData[0] || {});
    if (columnNames.length === 0) {
      return this.createErrorValidation(file.name, fileType, file.size, ['Zero column headers found in dataset.']);
    }

    const validationErrors: string[] = [];
    const validationWarnings: string[] = [];

    // Find timestamp column
    let timestampCol: string | null = null;
    const lowerCols = columnNames.map(c => ({ original: c, lower: c.toLowerCase().trim() }));
    for (const c of lowerCols) {
      if (['time', 'timestamp', 'date', 'datetime', 't', 'iso_timestamp', 'sec', 'seconds', 'time_sec', 'time_ms'].includes(c.lower) ||
          c.lower.includes('timestamp') || c.lower === 'time') {
        timestampCol = c.original;
        break;
      }
    }

    // 1. DYNAMIC COLUMN PROFILING ACROSS ALL COLUMNS
    const columnProfiles: ColumnProfile[] = [];
    const detectedSignalColumns: SignalColumnMapping[] = [];

    columnNames.forEach(col => {
      let validCount = 0;
      let missingCount = 0;
      const uniqueSet = new Set<any>();
      const numericValues: number[] = [];
      const sampleVals: any[] = [];

      for (let i = 0; i < rawData.length; i++) {
        const val = rawData[i][col];
        if (val === null || val === undefined || val === '' || (typeof val === 'number' && isNaN(val))) {
          missingCount++;
        } else {
          validCount++;
          if (uniqueSet.size < 500) uniqueSet.add(val);
          if (sampleVals.length < 5) sampleVals.push(val);

          const num = Number(val);
          if (typeof val === 'number' || (!isNaN(num) && typeof val !== 'boolean' && String(val).trim() !== '')) {
            numericValues.push(num);
          }
        }
      }

      const isNumeric = numericValues.length > 0 && (numericValues.length / Math.max(1, validCount)) >= 0.8;
      const isTimestamp = col === timestampCol;
      const isBoolean = uniqueSet.size <= 2 && Array.from(uniqueSet).every(v => v === true || v === false || v === 0 || v === 1 || v === 'true' || v === 'false');

      let dataType: 'numeric' | 'timestamp' | 'boolean' | 'string' | 'categorical' = 'string';
      if (isTimestamp) dataType = 'timestamp';
      else if (isBoolean) dataType = 'boolean';
      else if (isNumeric) dataType = 'numeric';
      else if (uniqueSet.size <= 10 && validCount > 20) dataType = 'categorical';

      let min: number | null = null;
      let max: number | null = null;
      let mean: number | null = null;
      let median: number | null = null;
      let stdDev: number | null = null;

      if (isNumeric && numericValues.length > 0) {
        let minVal = Infinity;
        let maxVal = -Infinity;
        let sum = 0;

        for (let j = 0; j < numericValues.length; j++) {
          const v = numericValues[j];
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
          sum += v;
        }

        min = minVal;
        max = maxVal;
        mean = sum / numericValues.length;

        // Subsample for fast median if array is very large to avoid blocking UI
        if (numericValues.length > 10000) {
          const sampleStep = Math.ceil(numericValues.length / 10000);
          const sampledForMedian: number[] = [];
          for (let j = 0; j < numericValues.length; j += sampleStep) {
            sampledForMedian.push(numericValues[j]);
          }
          sampledForMedian.sort((a, b) => a - b);
          median = sampledForMedian.length % 2 === 0
            ? (sampledForMedian[sampledForMedian.length / 2 - 1] + sampledForMedian[sampledForMedian.length / 2]) / 2
            : sampledForMedian[Math.floor(sampledForMedian.length / 2)];
        } else {
          const sorted = [...numericValues].sort((a, b) => a - b);
          median = sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];
        }

        if (numericValues.length > 1) {
          let sumSq = 0;
          for (let j = 0; j < numericValues.length; j++) {
            const diff = numericValues[j] - mean;
            sumSq += diff * diff;
          }
          stdDev = Math.sqrt(sumSq / (numericValues.length - 1));
        } else {
          stdDev = 0;
        }

        min = Math.round(min * 10000) / 10000;
        max = Math.round(max * 10000) / 10000;
        mean = Math.round(mean * 10000) / 10000;
        median = Math.round(median * 10000) / 10000;
        stdDev = Math.round(stdDev * 10000) / 10000;
      }

      const isSuitableForWaveform = isNumeric && !isTimestamp && uniqueSet.size > 5;

      columnProfiles.push({
        name: col,
        dataType,
        validCount,
        missingCount,
        uniqueCount: uniqueSet.size,
        min,
        max,
        mean,
        median,
        stdDev,
        isNumeric,
        isSuitableForWaveform,
        sampleValues: sampleVals
      });

      // Map signal types
      const lower = col.toLowerCase().trim();
      if (col !== timestampCol) {
        if (['filtered', 'filtered_signal', 'resp_filtered', 'respiration', 'chest_displacement', 'breath_signal'].some(k => lower.includes(k))) {
          detectedSignalColumns.push({ name: col, type: 'FILTERED_RADAR' });
        } else if (['raw', 'raw_signal', 'doppler', 'adc', 'i_data', 'q_data'].some(k => lower.includes(k))) {
          detectedSignalColumns.push({ name: col, type: 'RAW_RADAR' });
        } else if (['ref_rr', 'reference_rr', 'ecg_rr', 'reference_rate', 'gold_standard'].some(k => lower.includes(k))) {
          detectedSignalColumns.push({ name: col, type: 'REFERENCE_RR' });
        } else if (['rr', 'respiratory_rate', 'bpm', 'breath_rate'].some(k => lower.includes(k))) {
          detectedSignalColumns.push({ name: col, type: 'RESPIRATORY_RATE' });
        } else if (['distance', 'range', 'target_distance'].some(k => lower.includes(k))) {
          detectedSignalColumns.push({ name: col, type: 'DISTANCE' });
        } else if (isSuitableForWaveform) {
          detectedSignalColumns.push({ name: col, type: 'OTHER_NUMERIC' });
        }
      }
    });

    // 2. TIMESTAMPS & SAMPLING FREQUENCY AUDIT
    let isMonotonicTimestamps = true;
    let timestampGapsCount = 0;
    let duplicateTimestampsCount = 0;
    const seenTimestamps = new Set<string>();
    const timestamps: number[] = [];

    if (timestampCol) {
      for (let i = 0; i < rawData.length; i++) {
        const val = rawData[i][timestampCol];
        if (val !== null && val !== undefined) {
          const str = String(val).trim();
          if (seenTimestamps.has(str)) duplicateTimestampsCount++;
          else seenTimestamps.add(str);

          let numVal: number;
          if (typeof val === 'number') {
            numVal = val;
          } else {
            const parsedDate = new Date(val).getTime();
            numVal = !isNaN(parsedDate) ? parsedDate : parseFloat(val);
          }

          if (!isNaN(numVal) && isFinite(numVal)) {
            if (timestamps.length > 0 && numVal < timestamps[timestamps.length - 1]) {
              isMonotonicTimestamps = false;
            }
            timestamps.push(numVal);
          }
        }
      }
    }

    let samplingIntervalSeconds: number | null = null;
    let estimatedSamplingRateHz: number | null = null;
    let samplingRateSource: 'TIMESTAMP_CALCULATED' | 'UNAVAILABLE' = 'UNAVAILABLE';

    if (timestamps.length >= 10) {
      const diffs: number[] = [];
      for (let i = 1; i < Math.min(timestamps.length, 200); i++) {
        const diff = timestamps[i] - timestamps[i - 1];
        if (diff > 0) diffs.push(diff);
      }

      if (diffs.length >= 5) {
        diffs.sort((a, b) => a - b);
        const medianDiff = diffs[Math.floor(diffs.length / 2)];

        // Determine if median is in milliseconds or seconds
        if (medianDiff >= 10 && medianDiff <= 5000) {
          samplingIntervalSeconds = Math.round((medianDiff / 1000) * 1000) / 1000;
        } else if (medianDiff > 0.001 && medianDiff < 10) {
          samplingIntervalSeconds = Math.round(medianDiff * 1000) / 1000;
        }

        if (samplingIntervalSeconds && samplingIntervalSeconds > 0) {
          estimatedSamplingRateHz = Math.round((1 / samplingIntervalSeconds) * 10) / 10;
          samplingRateSource = 'TIMESTAMP_CALCULATED';

          // Audit gaps (diff > 3 * median)
          for (const d of diffs) {
            if (d > medianDiff * 3) timestampGapsCount++;
          }
        }
      }
    }

    // Duplicate rows check
    const rowHashSample = new Set<string>();
    let duplicateRowsCount = 0;
    const checkLimit = Math.min(rawData.length, 1000);
    for (let i = 0; i < checkLimit; i++) {
      const hash = JSON.stringify(rawData[i]);
      if (rowHashSample.has(hash)) duplicateRowsCount++;
      else rowHashSample.add(hash);
    }

    // Missing values count
    const missingValuesCount = columnProfiles.reduce((acc, c) => acc + c.missingCount, 0);
    const invalidValuesCount = columnProfiles.reduce((acc, c) => acc + (c.isNumeric ? (rawData.length - c.validCount - c.missingCount) : 0), 0);

    // Duration calculation
    let signalDurationSeconds: number | null = null;
    if (timestamps.length > 1) {
      const t0 = timestamps[0];
      const t1 = timestamps[timestamps.length - 1];
      const delta = Math.abs(t1 - t0);
      signalDurationSeconds = delta > 1e6 ? Math.round(delta / 1000) : Math.round(delta);
    } else if (estimatedSamplingRateHz) {
      signalDurationSeconds = Math.round(rawData.length / estimatedSamplingRateHz);
    }

    // Build parsed samples for backward compatibility with live chart playback
    const primaryCol = detectedSignalColumns.find(c => c.type === 'FILTERED_RADAR' || c.type === 'PRIMARY_RESPIRATORY')?.name 
      || columnProfiles.find(c => c.isSuitableForWaveform)?.name || null;
    const rawCol = detectedSignalColumns.find(c => c.type === 'RAW_RADAR')?.name || null;
    const rrCol = detectedSignalColumns.find(c => c.type === 'RESPIRATORY_RATE')?.name || null;
    const distCol = detectedSignalColumns.find(c => c.type === 'DISTANCE')?.name || null;

    const parsedSamples: ParsedDatasetSample[] = [];
    const now = Date.now();
    const dtMs = (samplingIntervalSeconds || 0.05) * 1000;

    // Fast-format time label without invoking heavy locale strings
    const fastFormatTime = (timeMs: number): string => {
      const d = new Date(timeMs);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    };

    // If dataset is massive (> 20,000 samples), downsample for playback waveform stream
    // to preserve UI rendering performance, while rawRows preserves 100% of all data.
    const playbackStep = rawData.length > 20000 ? Math.ceil(rawData.length / 20000) : 1;

    for (let idx = 0; idx < rawData.length; idx += playbackStep) {
      const row = rawData[idx];
      const t = timestamps[idx]
        ? (timestamps[idx] > 1e10 ? timestamps[idx] : now - (rawData.length - idx) * dtMs)
        : now - (rawData.length - idx) * dtMs;

      parsedSamples.push({
        index: idx,
        timestamp: t,
        timeLabel: fastFormatTime(t),
        rawSignal: rawCol && row[rawCol] !== null ? Number(row[rawCol]) : null,
        filteredSignal: primaryCol && row[primaryCol] !== null ? Number(row[primaryCol]) : null,
        respiratoryRate: rrCol && row[rrCol] !== null ? Number(row[rrCol]) : null,
        signalQuality: null,
        targetDistance: distCol && row[distCol] !== null ? Number(row[distCol]) : null,
        presence: true
      });
    }

    if (columnProfiles.filter(c => c.isSuitableForWaveform).length === 0) {
      validationWarnings.push('No continuous numeric signal channel detected. Waveform plotting may be limited.');
    }

    if (samplingRateSource === 'UNAVAILABLE') {
      validationWarnings.push('Sampling frequency cannot be determined from timestamps. Frequency-domain FFT is disabled.');
    }

    return {
      fileName: file.name,
      fileType,
      fileSizeBytes: file.size,
      sheets,
      selectedSheet,
      rowCount: rawData.length,
      columnCount: columnNames.length,
      columnNames,
      columnProfiles,
      detectedSignalColumns,
      timestampColumn: timestampCol,
      hasTimestamps: timestampCol !== null,
      isMonotonicTimestamps,
      timestampGapsCount,
      samplingIntervalSeconds,
      estimatedSamplingRateHz,
      samplingRateSource,
      missingValuesCount,
      duplicateRowsCount,
      duplicateTimestampsCount,
      invalidValuesCount,
      signalDurationSeconds,
      isValid: validationErrors.length === 0,
      validationErrors,
      validationWarnings,
      previewRows: rawData.slice(0, 8),
      rawRows: rawData,
      parsedSamples
    };
  }

  /**
   * Fast line-based parser for CSV, TSV, and TXT files.
   * Eliminates SheetJS memory overhead and runs 20x-50x faster on large datasets.
   */
  private static parseDelimitedText(text: string): Record<string, any>[] {
    const lines = text.split(/\r\n|\n|\r/);
    if (lines.length === 0) return [];

    // Find first non-empty header line
    let headerLineIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      if (lines[i].trim().length > 0) {
        headerLineIdx = i;
        break;
      }
    }
    if (headerLineIdx === -1) return [];

    const headerLine = lines[headerLineIdx];
    // Detect delimiter: comma, tab, semicolon
    let delimiter = ',';
    const commaCount = (headerLine.match(/,/g) || []).length;
    const tabCount = (headerLine.match(/\t/g) || []).length;
    const semiCount = (headerLine.match(/;/g) || []).length;
    if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
    else if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';

    const parseLine = (line: string): string[] => {
      if (!line.includes('"')) {
        return line.split(delimiter).map(s => s.trim());
      }
      const tokens: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === delimiter && !inQuotes) {
          tokens.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      tokens.push(current.trim());
      return tokens;
    };

    const rawHeaders = parseLine(headerLine);
    const headers = rawHeaders.map((h, i) => h.replace(/^["']|["']$/g, '').trim() || `Column_${i + 1}`);

    const rows: Record<string, any>[] = [];
    for (let i = headerLineIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.trim().length === 0) continue;

      const cells = parseLine(line);
      const row: Record<string, any> = {};
      let hasAnyValue = false;

      for (let c = 0; c < headers.length; c++) {
        const h = headers[c];
        const cell = cells[c];
        if (cell === undefined || cell === null || cell === '') {
          row[h] = null;
        } else {
          hasAnyValue = true;
          const clean = cell.replace(/^["']|["']$/g, '');
          const num = Number(clean);
          if (!isNaN(num) && clean !== '' && !clean.includes(':')) {
            row[h] = num;
          } else {
            row[h] = clean;
          }
        }
      }

      if (hasAnyValue) {
        rows.push(row);
      }
    }

    return rows;
  }

  public static createErrorValidation(
    fileName: string,
    fileType: string,
    fileSizeBytes: number,
    errors: string[]
  ): DatasetValidationReport {
    return {
      fileName,
      fileType,
      fileSizeBytes,
      sheets: [],
      rowCount: 0,
      columnCount: 0,
      columnNames: [],
      columnProfiles: [],
      detectedSignalColumns: [],
      timestampColumn: null,
      hasTimestamps: false,
      isMonotonicTimestamps: true,
      timestampGapsCount: 0,
      samplingIntervalSeconds: null,
      estimatedSamplingRateHz: null,
      samplingRateSource: 'UNAVAILABLE',
      missingValuesCount: 0,
      duplicateRowsCount: 0,
      duplicateTimestampsCount: 0,
      invalidValuesCount: 0,
      signalDurationSeconds: null,
      isValid: false,
      validationErrors: errors,
      validationWarnings: [],
      previewRows: [],
      rawRows: [],
      parsedSamples: []
    };
  }
}
