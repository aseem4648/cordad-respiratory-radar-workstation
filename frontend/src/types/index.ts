export * from '../../../hardware-interface/types';

export type DemoScenario = 
  | 'NORMAL_BREATHING'
  | 'TACHYPNEA'
  | 'BRADYPNEA'
  | 'POSSIBLE_APNEA'
  | 'MOTION_ARTIFACT'
  | 'SIGNAL_DROP'
  | 'TARGET_ABSENT'
  | 'RADAR_DISCONNECTED';

export interface WaveformPoint {
  time: number;
  timeLabel: string;
  rawSignal: number | null;
  filteredSignal: number | null;
}

export interface TrendPoint {
  time: number;
  timeLabel: string;
  respiratoryRate: number | null;
  signalQuality: number | null;
}

export interface RecordingStatus {
  isRecording: boolean;
  sessionStartTime: number | null;
  sessionEndTime: number | null;
  durationSeconds: number;
  recordedSamplesCount: number;
  totalBufferedSamples: number;
  eventsCount: number;
}

export type NavigationRoute = 
  | 'DASHBOARD'
  | 'LIVE_MONITORING'
  | 'CAMERA_RPPG'
  | 'DATASET_WORKSPACE'
  | 'RESPIRATORY_SIGNAL'
  | 'CAMERA'
  | 'ILLUMINATION'
  | 'PANTILT'
  | 'COMBINED_VIEW'
  | 'EVENT_MONITOR'
  | 'DATA_SESSION'
  | 'SYSTEM_STATUS'
  | 'PRIVACY_SECURITY'
  | 'ADMIN_USERS'
  | 'ADMIN_LOGS'
  | 'HELP_SUPPORT'
  | 'SETTINGS';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketStatus = 'PENDING' | 'IN_REVIEW' | 'RESOLVED';
export type TicketCategory = 
  | 'CAMERA_HARDWARE' 
  | 'RADAR_LINK' 
  | 'TELEMETRY_ACCURACY' 
  | 'SOFTWARE_UI' 
  | 'FEEDBACK_SUGGESTION' 
  | 'GENERAL_QUERY';

export interface SupportTicket {
  id: string;
  userId?: string;
  customerName: string;
  customerEmail: string;
  role: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  status: TicketStatus;
  createdAt: number;
  updatedAt: number;
  adminResolution?: string;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface PanTiltState {
  pan: number;
  tilt: number;
  stepSize: number;
  mode: 'MANUAL' | 'AUTO_SCAN';
  status: 'IDLE' | 'MOVING' | 'CONFIRMED' | 'LIMIT_REACHED' | 'ERROR';
  lastCommand: string;
  lastCommandTime: number;
  hardwareConnected: boolean;
}

export type CameraConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'STREAMING' | 'STREAM ERROR';

export interface CameraConfig {
  streamUrl: string;
  hardwareIp?: string;
  sensor?: string;
  enabled: boolean;
  measuredFps?: number;
  totalFramesReceived?: number;
  lastFrameTime?: number;
  isStreaming?: boolean;
  errorMessage?: string | null;
  status: CameraConnectionState;
  patientDetected?: boolean;
  detectionConfidence?: number;
}

export interface IlluminationState {
  connected: boolean;
  controlLevel: number;        // -100% to +100% (nominal 0%)
  pwmDutyCycle: number;        // 0 to 255
  mode: 'MANUAL' | 'AUTO';
  autoAvailable: boolean;
  maxSafetyLimit: number;      // e.g. 85 (+85%)
  status: 'APPLIED' | 'PENDING' | 'LIMIT_REACHED' | 'FAULT' | 'DISCONNECTED';
  type: 'IR_850NM_ILLUMINATION' | 'WHITE_LED';
  isOn?: boolean;
  lastCommand: string;
  lastAckTime: number;
}

export type UserRole = 'ADMIN' | 'RESEARCHER' | 'OPERATOR' | 'OBSERVER';
export type AccessTier = 'PERSONAL' | 'INSTITUTIONAL';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tier: AccessTier;
  authProvider: 'PASSWORD' | 'GOOGLE' | 'INSTITUTIONAL';
  status: 'ACTIVE' | 'DISABLED';
  institutionId?: string;
  institutionName?: string;
  department?: string;
  createdAt: string;
  lastLogin: string | null;
  loginCount: number;
}

export interface AccessLogRecord {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  role: string;
  timestamp: number;
  timeString: string;
  eventType: string;
  authMethod: string;
  status: 'SUCCESS' | 'FAILED';
  ipAddress: string;
  userAgent: string;
  details: string;
}

export interface UserSession {
  isAuthenticated: boolean;
  tier: AccessTier;
  email: string;
  name: string;
  role: UserRole;
  institutionId?: string;
  institutionName?: string;
  department?: string;
  token: string;
  loginTime: number;
  lastActiveTime: number;
  sessionTimeoutMinutes: number;
}

