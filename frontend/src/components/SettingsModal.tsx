import React, { useState } from 'react';
import { X, Save, Sliders } from 'lucide-react';
import { SystemSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  onSaveSettings: (newSettings: SystemSettings) => void;
  isDarkMode?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  isDarkMode = false
}) => {
  if (!isOpen) return null;

  const [form, setForm] = useState<SystemSettings>({ ...settings });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`${isDarkMode ? 'bg-[#0F172A] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-2xl max-w-lg w-full p-6 shadow-2xl`}>
        <div className={`flex items-center justify-between border-b pb-3 mb-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-cyan-600" />
            <h2 className="text-base font-bold uppercase tracking-wider">
              SYSTEM SETTINGS & PARAMETERS
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-slate-700 font-sans font-semibold mb-1">WebSocket URL</label>
            <input
              type="text"
              value={form.webSocketUrl}
              onChange={e => setForm({ ...form, webSocketUrl: e.target.value })}
              className={`w-full rounded-lg px-3 py-2 border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-sans font-semibold mb-1">Apnea Threshold (sec)</label>
              <input
                type="number"
                min="5"
                max="60"
                value={form.apneaThresholdSeconds}
                onChange={e => setForm({ ...form, apneaThresholdSeconds: Number(e.target.value) })}
                className={`w-full rounded-lg px-3 py-2 border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-sans font-semibold mb-1">Min SQI Threshold (%)</label>
              <input
                type="number"
                min="10"
                max="90"
                value={form.signalQualityThreshold}
                onChange={e => setForm({ ...form, signalQualityThreshold: Number(e.target.value) })}
                className={`w-full rounded-lg px-3 py-2 border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-sans font-semibold mb-1">Filter Low Cut (Hz)</label>
              <input
                type="number"
                step="0.05"
                value={form.filterLowCutHz}
                onChange={e => setForm({ ...form, filterLowCutHz: Number(e.target.value) })}
                className={`w-full rounded-lg px-3 py-2 border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
              />
            </div>

            <div>
              <label className="block text-slate-700 font-sans font-semibold mb-1">Filter High Cut (Hz)</label>
              <input
                type="number"
                step="0.05"
                value={form.filterHighCutHz}
                onChange={e => setForm({ ...form, filterHighCutHz: Number(e.target.value) })}
                className={`w-full rounded-lg px-3 py-2 border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
              />
            </div>
          </div>

          <div className={`flex items-center justify-end gap-3 pt-3 border-t mt-5 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg font-semibold ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold"
            >
              <Save className="h-4 w-4" /> Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
