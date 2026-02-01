import React from 'react';
import { useSettings } from '../../context/SettingsContext';

const SettingsPanel: React.FC = () => {
  const {
    includeUrl,
    toggleIncludeUrl,
    scaleDownImages,
    toggleScaleDownImages,
    maxArchivedSessions,
    setMaxArchivedSessions,
  } = useSettings();

  const handleMaxArchivedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      setMaxArchivedSessions(val);
    }
  };

  return (
    <div className="px-4 py-3 bg-white border-b border-slate-100 shadow-inner animate-in slide-in-from-top-2 duration-200 space-y-3">
      <label className="flex items-center space-x-3 text-sm text-slate-600 cursor-pointer select-none group">
        <div className="relative flex items-center">
          <input
            type="checkbox"
            checked={includeUrl}
            onChange={toggleIncludeUrl}
            className="peer h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500/30 transition-all cursor-pointer"
          />
        </div>
        <span className="group-hover:text-slate-900 transition-colors">
          Include Source URL in Exports
        </span>
      </label>
      <label className="flex items-center space-x-3 text-sm text-slate-600 cursor-pointer select-none group">
        <div className="relative flex items-center">
          <input
            type="checkbox"
            checked={scaleDownImages}
            onChange={toggleScaleDownImages}
            className="peer h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500/30 transition-all cursor-pointer"
          />
        </div>
        <span className="group-hover:text-slate-900 transition-colors">
          Scale Down Images for Smaller File Size
        </span>
      </label>
      <div className="pt-2 border-t border-slate-100">
        <label className="block text-xs font-medium text-slate-500 mb-1.5">
          Max Archived Sessions
        </label>
        <input
          type="number"
          min="0"
          max="100"
          value={maxArchivedSessions}
          onChange={handleMaxArchivedChange}
          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 focus:bg-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all"
        />
        <p className="text-[10px] text-slate-400 mt-1">
          Oldest archived sessions will be permanently deleted when limit is reached.
        </p>
      </div>
    </div>
  );
};

export default SettingsPanel;
