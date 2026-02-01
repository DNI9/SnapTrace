import React from 'react';
import { type Tool } from '../hooks/useFabricCanvas';

interface AnnotationToolbarProps {
  currentTool: Tool;
  setCurrentTool: (tool: Tool) => void;
  visible: boolean;
  historyLength: number;
  redoLength: number;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  currentTool,
  setCurrentTool,
  visible,
  historyLength,
  redoLength,
  onUndo,
  onRedo,
  onClear,
}) => {
  return (
    <div
      className={`absolute left-6 top-6 z-50 transition-all duration-300 ease-in-out ${
        visible ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0 pointer-events-none'
      }`}
    >
      <div className="bg-white/90 backdrop-blur-xl border border-white/50 shadow-xl rounded-full px-2 py-3 flex flex-col items-center space-y-4">
        <button
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 w-12 ${
            currentTool === 'none' ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'
          }`}
          onClick={() => setCurrentTool('none')}
          title="Select / Move (V)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          </svg>
          <span className="text-[10px] font-medium">Select</span>
        </button>

        <button
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200 w-12 ${
            currentTool === 'rectangle'
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          onClick={() => setCurrentTool('rectangle')}
          title="Rectangle (R)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          </svg>
          <span className="text-[10px] font-medium">Rect</span>
        </button>

        <button
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 w-12 ${
            currentTool === 'text' ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'
          }`}
          onClick={() => setCurrentTool('text')}
          title="Text (T)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 7V4h16v3" />
            <path d="M9 20h6" />
            <path d="M12 4v16" />
          </svg>
          <span className="text-[10px] font-medium">Text</span>
        </button>

        <button
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 w-12 ${
            currentTool === 'step' ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'
          }`}
          onClick={() => setCurrentTool('step')}
          title="Step Number (S)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-[10px] font-medium">Timer</span>
        </button>

        <div className="w-8 h-px bg-slate-100 my-1"></div>

        <button
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 w-12 ${
            historyLength <= 1
              ? 'text-slate-300 cursor-not-allowed'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          onClick={onUndo}
          disabled={historyLength <= 1}
          title="Undo (Ctrl+Z)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
          </svg>
          <span className="text-[10px] font-medium">Undo</span>
        </button>

        <button
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 w-12 ${
            redoLength === 0
              ? 'text-slate-300 cursor-not-allowed'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          onClick={onRedo}
          disabled={redoLength === 0}
          title="Redo (Ctrl+Y)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 14l5-5-5-5" />
            <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
          </svg>
          <span className="text-[10px] font-medium">Redo</span>
        </button>

        <button
          className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-rose-500 rounded-lg transition-colors w-12"
          onClick={onClear}
          title="Clear All"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
          <span className="text-[10px] font-medium">Delete</span>
        </button>
      </div>
    </div>
  );
};

export default AnnotationToolbar;
