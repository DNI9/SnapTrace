import React from 'react';

interface HeaderProps {
  onSettingsClick: () => void;
  showSettings: boolean;
  onNewSessionClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onSettingsClick, showSettings, onNewSessionClick }) => {
  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 p-4 flex justify-between items-center bg-white">
      <div className="flex items-center gap-2">
        <h1 className="font-bold text-xl text-fuchsia-700">SnapTrace</h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onSettingsClick}
          className={`p-2 rounded-full transition-all duration-200 ${
            showSettings
              ? 'bg-violet-100 text-violet-700'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
          }`}
          title="Settings"
          aria-label="Toggle Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
        <button
          onClick={onNewSessionClick}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95"
          aria-label="Create New Session"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span>New Session</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
