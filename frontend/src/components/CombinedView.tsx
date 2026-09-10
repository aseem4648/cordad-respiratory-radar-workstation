import React from 'react';
import { CameraConfig, PanTiltState, WaveformPoint, UserSession } from '../types';
import { CameraSection } from './CameraSection';
import { PanTiltControl } from './PanTiltControl';
import { LiveWaveformChart } from './LiveWaveformChart';

interface CombinedViewProps {
  camera: CameraConfig | null;
  onUpdateCamera: (cam: CameraConfig) => void;
  panTilt: PanTiltState | null;
  onUpdatePanTilt: (pt: PanTiltState) => void;
  waveformBuffer: WaveformPoint[];
  isConnected: boolean;
  isDarkMode: boolean;
  session?: UserSession | null;
}

export const CombinedView: React.FC<CombinedViewProps> = ({
  camera,
  onUpdateCamera,
  panTilt,
  onUpdatePanTilt,
  waveformBuffer,
  isConnected,
  isDarkMode,
  session
}) => {
  return (
    <div className="space-y-4">
      {/* Top split: Camera Stream and Pan-Tilt Steering */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CameraSection
          camera={camera}
          onUpdateCamera={onUpdateCamera}
          isDarkMode={isDarkMode}
          session={session}
        />
        <PanTiltControl
          panTilt={panTilt}
          onUpdate={onUpdatePanTilt}
          isDarkMode={isDarkMode}
        />
      </div>

      {/* Real-time Oscilloscope Synchronized */}
      <LiveWaveformChart
        waveformBuffer={waveformBuffer}
        isConnected={isConnected}
        isStreamPaused={false}
        selectedWindowSec={30}
        onSelectWindowSec={() => {}}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};
