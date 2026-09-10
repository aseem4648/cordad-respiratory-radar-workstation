export interface PanTiltPosition {
  pan: number;       // degrees: -90 (Left) to +90 (Right)
  tilt: number;      // degrees: -45 (Down) to +45 (Up)
  stepSize: number;  // degrees per click: 1, 5, 10, 15
  mode: 'MANUAL' | 'AUTO_SCAN';
  status: 'IDLE' | 'MOVING' | 'CONFIRMED' | 'LIMIT_REACHED' | 'ERROR';
  lastCommand: string;
  lastCommandTime: number;
  hardwareConnected: boolean;
}

export class PanTiltController {
  private position: PanTiltPosition = {
    pan: 0,
    tilt: 0,
    stepSize: 5,
    mode: 'MANUAL',
    status: 'IDLE',
    lastCommand: 'INITIALIZED',
    lastCommandTime: Date.now(),
    hardwareConnected: true
  };

  private minPan = -90;
  private maxPan = 90;
  private minTilt = -45;
  private maxTilt = 45;
  private autoScanTimer: NodeJS.Timeout | null = null;
  private autoScanDirection = 1;

  public getStatus(): PanTiltPosition {
    return { ...this.position };
  }

  public setStepSize(step: number): PanTiltPosition {
    if ([1, 2, 5, 10, 15].includes(step)) {
      this.position.stepSize = step;
    }
    return this.getStatus();
  }

  public move(direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', customStep?: number): PanTiltPosition {
    if (this.position.mode === 'AUTO_SCAN') {
      this.setMode('MANUAL');
    }

    const step = customStep || this.position.stepSize;
    let newPan = this.position.pan;
    let newTilt = this.position.tilt;
    let limitReached = false;

    switch (direction) {
      case 'UP':
        newTilt = Math.min(this.maxTilt, this.position.tilt + step);
        if (newTilt === this.maxTilt && this.position.tilt === this.maxTilt) limitReached = true;
        break;
      case 'DOWN':
        newTilt = Math.max(this.minTilt, this.position.tilt - step);
        if (newTilt === this.minTilt && this.position.tilt === this.minTilt) limitReached = true;
        break;
      case 'LEFT':
        newPan = Math.max(this.minPan, this.position.pan - step);
        if (newPan === this.minPan && this.position.pan === this.minPan) limitReached = true;
        break;
      case 'RIGHT':
        newPan = Math.min(this.maxPan, this.position.pan + step);
        if (newPan === this.maxPan && this.position.pan === this.maxPan) limitReached = true;
        break;
    }

    this.position.pan = Math.round(newPan * 10) / 10;
    this.position.tilt = Math.round(newTilt * 10) / 10;
    this.position.status = limitReached ? 'LIMIT_REACHED' : 'CONFIRMED';
    this.position.lastCommand = `MOVE_${direction}_${step}DEG`;
    this.position.lastCommandTime = Date.now();

    return this.getStatus();
  }

  public home(): PanTiltPosition {
    this.position.pan = 0;
    this.position.tilt = 0;
    this.position.status = 'CONFIRMED';
    this.position.lastCommand = 'HOME_RESET';
    this.position.lastCommandTime = Date.now();
    return this.getStatus();
  }

  public stop(): PanTiltPosition {
    if (this.autoScanTimer) {
      clearInterval(this.autoScanTimer);
      this.autoScanTimer = null;
    }
    this.position.mode = 'MANUAL';
    this.position.status = 'IDLE';
    this.position.lastCommand = 'EMERGENCY_STOP';
    this.position.lastCommandTime = Date.now();
    return this.getStatus();
  }

  public setPosition(pan: number, tilt: number): PanTiltPosition {
    this.position.pan = Math.max(this.minPan, Math.min(this.maxPan, pan));
    this.position.tilt = Math.max(this.minTilt, Math.min(this.maxTilt, tilt));
    this.position.status = 'CONFIRMED';
    this.position.lastCommand = `GOTO_P${pan}_T${tilt}`;
    this.position.lastCommandTime = Date.now();
    return this.getStatus();
  }

  public setMode(mode: 'MANUAL' | 'AUTO_SCAN'): PanTiltPosition {
    this.position.mode = mode;
    this.position.lastCommand = `MODE_${mode}`;
    this.position.lastCommandTime = Date.now();

    if (mode === 'AUTO_SCAN') {
      if (!this.autoScanTimer) {
        this.autoScanTimer = setInterval(() => {
          if (this.position.pan >= 40) this.autoScanDirection = -1;
          else if (this.position.pan <= -40) this.autoScanDirection = 1;
          this.position.pan = Math.round((this.position.pan + this.autoScanDirection * 2) * 10) / 10;
          this.position.status = 'MOVING';
          this.position.lastCommandTime = Date.now();
        }, 300);
      }
    } else {
      if (this.autoScanTimer) {
        clearInterval(this.autoScanTimer);
        this.autoScanTimer = null;
      }
      this.position.status = 'IDLE';
    }

    return this.getStatus();
  }
}

export const panTiltController = new PanTiltController();
