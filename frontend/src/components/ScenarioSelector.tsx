import React from 'react';
import { DemoScenario } from '../types';
import { PlayCircle, AlertTriangle, Wind, Activity, UserX, WifiOff } from 'lucide-react';

interface ScenarioSelectorProps {
  activeScenario: DemoScenario;
  onSelectScenario: (scenario: DemoScenario) => void;
  isDemo: boolean;
  isDarkMode?: boolean;
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  activeScenario,
  onSelectScenario,
  isDemo,
  isDarkMode = false
}) => {
  if (!isDemo) return null;

  const scenarios: { id: DemoScenario; label: string; desc: string; icon: any; color: string }[] = [
    {
      id: 'NORMAL_BREATHING',
      label: 'Normal Breathing',
      desc: '~16 BPM steady 24 GHz signal',
      icon: Activity,
      color: 'text-emerald-600'
    },
    {
      id: 'POSSIBLE_APNEA',
      label: 'Possible Apnea Test',
      desc: '14s flatline cessation test',
      icon: AlertTriangle,
      color: 'text-rose-600'
    },
    {
      id: 'TACHYPNEA',
      label: 'Rapid (Tachypnea)',
      desc: '~28 BPM rapid shallow rate',
      icon: Wind,
      color: 'text-amber-600'
    },
    {
      id: 'BRADYPNEA',
      label: 'Slow (Bradypnea)',
      desc: '~8 BPM deep slow rate',
      icon: Wind,
      color: 'text-amber-600'
    },
    {
      id: 'MOTION_ARTIFACT',
      label: 'Body Motion Noise',
      desc: 'High frequency artifact',
      icon: Activity,
      color: 'text-amber-700'
    },
    {
      id: 'TARGET_ABSENT',
      label: 'Target Absent',
      desc: 'Leaves 24 GHz radar cone',
      icon: UserX,
      color: 'text-slate-500'
    },
    {
      id: 'RADAR_DISCONNECTED',
      label: 'Radar Disconnect',
      desc: 'Zero packets streamed',
      icon: WifiOff,
      color: 'text-rose-600'
    }
  ];

  return (
    <div className={`${isDarkMode ? 'bg-[#0F172A]/95 border-amber-500/30' : 'bg-white border-amber-300 shadow-md'} border rounded-xl p-4 select-none transition-colors`}>
      <div className={`flex items-center justify-between border-b pb-2 mb-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <PlayCircle className="h-4 w-4 text-amber-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
            DEMO VALIDATION TEST SCENARIOS (24 GHz FMCW Simulation)
          </h3>
        </div>
        <span className="text-[10px] font-mono text-amber-700 font-bold">
          Click any scenario to test algorithmic detection
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {scenarios.map((sc) => {
          const Icon = sc.icon;
          const isActive = activeScenario === sc.id;

          return (
            <button
              key={sc.id}
              onClick={() => onSelectScenario(sc.id)}
              className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition ${
                isActive 
                  ? 'bg-amber-100 border-amber-500 text-amber-950 font-bold shadow-sm ring-1 ring-amber-400' 
                  : (isDarkMode ? 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100')
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold tracking-tight">{sc.label}</span>
                <Icon className={`h-3.5 w-3.5 ${sc.color}`} />
              </div>
              <span className="text-[10px] text-slate-500 font-sans">{sc.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
