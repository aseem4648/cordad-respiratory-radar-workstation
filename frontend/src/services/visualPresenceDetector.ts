/**
 * Real-Time Visual Presence Detector
 * Contactless Respiratory Distress & Apnea Radar-Optical Aiming System
 * 
 * Analyzes live ESP32 optical aiming camera frames (160x120 downscaled) to accurately
 * identify physical patient presence in the thoracic target zone without manual toggling.
 */

export interface VisualPresenceResult {
  detected: boolean;
  confidence: number;          // 0 to 100%
  occupancyRatio: number;      // 0 to 1.0 (foreground coverage in thoracic ROI)
  motionEnergy: number;        // Motion delta in thoracic ROI
  skinRatio: number;           // Biological / skin tone candidate pixel ratio
  timestamp: number;
}

export class VisualPresenceDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private width = 160;
  private height = 120;

  // Background and frame history buffers
  private backgroundBuffer: Float32Array | null = null;
  private prevFrameBuffer: Uint8Array | null = null;
  private frameCount = 0;

  // Hysteresis counters
  private consecutivePositive = 0;
  private consecutiveNegative = 0;
  private isCurrentlyDetected = false;
  private smoothedConfidence = 0;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onResultCallback: ((result: VisualPresenceResult) => void) | null = null;

  private lastResult: VisualPresenceResult = {
    detected: false,
    confidence: 0,
    occupancyRatio: 0,
    motionEnergy: 0,
    skinRatio: 0,
    timestamp: Date.now()
  };

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  public start(
    imgElement: HTMLImageElement,
    callback?: (result: VisualPresenceResult) => void
  ) {
    this.stop();
    if (callback) this.onResultCallback = callback;

    // Reset state
    this.backgroundBuffer = null;
    this.prevFrameBuffer = null;
    this.frameCount = 0;
    this.consecutivePositive = 0;
    this.consecutiveNegative = 0;
    this.isCurrentlyDetected = false;
    this.smoothedConfidence = 0;

    // Analyze every 220ms (~4.5 Hz) for optimal balance of responsiveness and low CPU load
    this.intervalId = setInterval(() => {
      this.analyzeFrame(imgElement);
    }, 220);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public getCurrentResult(): VisualPresenceResult {
    return { ...this.lastResult };
  }

  /**
   * Core Computer Vision frame analysis pipeline
   */
  public analyzeFrame(imgElement: HTMLImageElement): VisualPresenceResult {
    const now = Date.now();

    // Check if image is ready and valid
    if (
      !imgElement ||
      !this.ctx ||
      !imgElement.complete ||
      imgElement.naturalWidth === 0 ||
      imgElement.naturalHeight === 0
    ) {
      return this.lastResult;
    }

    try {
      // Draw downscaled frame to 160x120 canvas
      this.ctx.drawImage(imgElement, 0, 0, this.width, this.height);
      const imgData = this.ctx.getImageData(0, 0, this.width, this.height);
      const data = imgData.data; // RGBA array of 160x120x4 = 76,800 bytes

      const totalPixels = this.width * this.height;
      const currentGray = new Uint8Array(totalPixels);

      // Convert to luminance and prepare buffers
      for (let i = 0; i < totalPixels; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        // Standard Rec. 601 luma formula
        currentGray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }

      // Initialize background model on first 3 frames
      if (!this.backgroundBuffer) {
        this.backgroundBuffer = new Float32Array(totalPixels);
        for (let i = 0; i < totalPixels; i++) {
          this.backgroundBuffer[i] = currentGray[i];
        }
        this.prevFrameBuffer = currentGray;
        this.frameCount = 1;
        return this.lastResult;
      }

      this.frameCount++;

      // Thoracic Region of Interest (ROI) definition (center 65% of frame)
      // Patient lies or sits in this central zone
      const roiXMin = Math.floor(this.width * 0.18);
      const roiXMax = Math.floor(this.width * 0.82);
      const roiYMin = Math.floor(this.height * 0.15);
      const roiYMax = Math.floor(this.height * 0.85);

      let roiPixelCount = 0;
      let foregroundCount = 0;
      let totalMotionDiff = 0;
      let skinCandidateCount = 0;
      let upperRoiPixelCount = 0;

      const upperRoiYMax = Math.floor(this.height * 0.55); // Head / neck / upper thorax

      for (let y = roiYMin; y < roiYMax; y++) {
        for (let x = roiXMin; x < roiXMax; x++) {
          const idx = y * this.width + x;
          const pixelVal = currentGray[idx];
          const bgVal = this.backgroundBuffer[idx];
          const prevVal = this.prevFrameBuffer ? this.prevFrameBuffer[idx] : pixelVal;

          roiPixelCount++;

          // 1. Foreground Blob Occupancy: Absolute difference against adaptive background
          const bgDiff = Math.abs(pixelVal - bgVal);
          if (bgDiff > 22) {
            foregroundCount++;
          }

          // 2. Inter-Frame Temporal Motion Energy (Biomechanical micro-motion)
          const motionDiff = Math.abs(pixelVal - prevVal);
          totalMotionDiff += motionDiff;

          // 3. Human Skin / Biological Coloration in Upper ROI
          if (y <= upperRoiYMax) {
            upperRoiPixelCount++;
            const r = data[idx * 4];
            const g = data[idx * 4 + 1];
            const b = data[idx * 4 + 2];

            // Basic human skin tone chromaticity rule in visible / warm IR light
            if (
              r > 55 &&
              g > 35 &&
              b > 25 &&
              r > g &&
              r > b &&
              r - g >= 10 &&
              r - b >= 14
            ) {
              skinCandidateCount++;
            }
          }
        }
      }

      const occupancyRatio = roiPixelCount > 0 ? foregroundCount / roiPixelCount : 0;
      const avgMotion = roiPixelCount > 0 ? totalMotionDiff / roiPixelCount : 0;
      const skinRatio = upperRoiPixelCount > 0 ? skinCandidateCount / upperRoiPixelCount : 0;

      // 4. Adaptive background update:
      // Slowly learn static background (alpha = 0.02 for foreground, 0.07 for background)
      for (let i = 0; i < totalPixels; i++) {
        const diff = Math.abs(currentGray[i] - this.backgroundBuffer[i]);
        const alpha = diff > 22 ? 0.02 : 0.07;
        this.backgroundBuffer[i] = (1 - alpha) * this.backgroundBuffer[i] + alpha * currentGray[i];
      }
      this.prevFrameBuffer = currentGray;

      // 5. Calculate Sub-Scores (0 to 100):
      // - Occupancy score: 14% foreground coverage saturates at 100
      const scoreOccupancy = Math.min(100, Math.max(0, (occupancyRatio / 0.14) * 100));
      // - Motion score: motion between 1.4 (sensor noise) and 6.0 (active respiratory movement)
      const scoreMotion = Math.min(100, Math.max(0, ((avgMotion - 1.4) / 4.6) * 100));
      // - Skin / biological score: 7% skin coverage saturates
      const scoreSkin = Math.min(100, Math.max(0, (skinRatio / 0.07) * 100));

      // Weighted unified presence score
      const rawScore = 0.45 * scoreOccupancy + 0.35 * scoreMotion + 0.20 * scoreSkin;

      // Strong presence override if high occupancy (> 30% of thorax filled)
      const finalScore = occupancyRatio > 0.30 ? Math.max(rawScore, 65) : rawScore;

      // Exponential smoothing for stability
      this.smoothedConfidence = Math.round(0.7 * this.smoothedConfidence + 0.3 * finalScore);

      // 6. Hysteresis Filtering:
      // Trigger detected when confidence >= 28% for >= 2 cycles (~440ms)
      // Trigger cleared when confidence < 18% for >= 6 cycles (~1320ms)
      if (this.smoothedConfidence >= 28) {
        this.consecutivePositive++;
        this.consecutiveNegative = 0;
        if (this.consecutivePositive >= 2) {
          this.isCurrentlyDetected = true;
        }
      } else if (this.smoothedConfidence < 18) {
        this.consecutiveNegative++;
        this.consecutivePositive = 0;
        if (this.consecutiveNegative >= 6) {
          this.isCurrentlyDetected = false;
        }
      }

      this.lastResult = {
        detected: this.isCurrentlyDetected,
        confidence: this.isCurrentlyDetected ? Math.max(35, this.smoothedConfidence) : Math.min(25, this.smoothedConfidence),
        occupancyRatio: Math.round(occupancyRatio * 100) / 100,
        motionEnergy: Math.round(avgMotion * 10) / 10,
        skinRatio: Math.round(skinRatio * 100) / 100,
        timestamp: now
      };

      if (this.onResultCallback) {
        this.onResultCallback(this.lastResult);
      }

      return this.lastResult;
    } catch (e) {
      return this.lastResult;
    }
  }
}

export const visualPresenceDetector = new VisualPresenceDetector();
