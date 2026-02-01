import React, { useCallback, useEffect, useRef, useState } from 'react';
import { compressImage } from '../utils/storage';
import { useFabricCanvas } from '../hooks/useFabricCanvas';
import AnnotationToolbar from './AnnotationToolbar';
import * as fabric from 'fabric';

interface AnnotationModalProps {
  image: string;
  onSave: (description: string, finalImage: string) => void;
  onCancel: () => void;
}

const AnnotationModal: React.FC<AnnotationModalProps> = ({ image, onSave, onCancel }) => {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    fabricCanvasRef,
    currentTool,
    setCurrentTool,
    historyLength,
    redoLength,
    handleUndo,
    handleRedo,
    clearAll,
    imgElement,
  } = useFabricCanvas(canvasElRef, containerRef, image);

  const [description, setDescription] = useState('');
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lock body scroll
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle Save
  const handleSave = useCallback(async () => {
    if (!fabricCanvasRef.current || !imgElement || isSaving) return;

    try {
      setIsSaving(true);
      const canvas = fabricCanvasRef.current;
      const bgImg = canvas.backgroundImage as fabric.Image;
      if (!bgImg) return;

      const currentScale = bgImg.scaleX || 1;
      const multiplier = 1 / currentScale;

      const dataUrl = canvas.toDataURL({
        format: 'png',
        multiplier: multiplier,
      });

      // Compress if needed
      const compressedUrl = await compressImage(dataUrl);

      onSave(description, compressedUrl);
    } catch (e) {
      console.error('Error saving/compressing', e);
      setIsSaving(false);
    }
  }, [imgElement, isSaving, onSave, description, fabricCanvasRef]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Stop propagation to prevent key events from reaching the background page
      e.stopPropagation();

      // Global Save Shortcut (Ctrl+Enter or Cmd+Enter)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
        return;
      }

      // Ignore shortcuts if an input is focused (except Tab/Escape which are global nav)
      // Since we are in a shadow DOM, we need to check composed path or shadow root active element.
      // e.composedPath()[0] gives the actual target even across shadow boundaries for most events.
      const target = e.composedPath()[0] as HTMLElement;
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (isInput) {
        if (e.key === 'Tab') {
          e.preventDefault();
          setToolbarVisible(prev => !prev);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
        // Allow all other keys (including Backspace) to work normally in input fields
        return;
      }

      // For all non-input key handling, prevent default to stop page from receiving events
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          return;
        } else if (e.key === 'y') {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        setToolbarVisible(prev => !prev);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setCurrentTool('rectangle');
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setCurrentTool('text');
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setCurrentTool('none');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setCurrentTool('step');
      }
    };

    // Use capture phase (true) to intercept events before they reach the page
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [
    onCancel,
    historyLength,
    redoLength,
    handleUndo,
    handleRedo,
    currentTool,
    handleSave,
    setCurrentTool,
  ]);

  // Handle Save

  return (
    <div className="fixed inset-0 z-[2147483647] flex flex-col bg-slate-50 animate-in fade-in duration-200 font-sans text-slate-800">
      {/* Content Wrapper */}
      <div className="flex flex-1 overflow-hidden relative">
        <AnnotationToolbar
          currentTool={currentTool}
          setCurrentTool={setCurrentTool}
          visible={toolbarVisible}
          historyLength={historyLength}
          redoLength={redoLength}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={clearAll}
        />

        {/* Main Content Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden flex justify-center items-center p-8 active:cursor-move bg-slate-50 relative"
        >
          {/* Canvas Container */}
          <div className="relative shadow-2xl rounded-lg overflow-hidden ring-1 ring-black/5 bg-white">
            <canvas ref={canvasElRef} />
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="bg-white border-t border-slate-200 relative">
        <div className="p-4 md:px-8">
          <div className="max-w-[1400px] mx-auto w-full flex flex-col md:flex-row gap-4 items-center">
            <div className="relative w-full flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg
                  className="w-5 h-5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h7"
                  ></path>
                </svg>
              </div>
              <input
                ref={inputRef}
                type="text"
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all placeholder:text-slate-400 text-slate-700 text-base"
                placeholder="Describe what you found..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSave();
                  }
                }}
                disabled={isSaving}
              />
              <div className="absolute inset-y-0 right-3 flex items-center">
                <span className="text-xs text-slate-400 font-medium">Ctrl+Enter to save</span>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto pl-4 border-l border-slate-100">
              <button
                onClick={onCancel}
                className="px-4 py-2.5 text-slate-500 font-medium hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors text-sm"
                disabled={isSaving}
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`px-8 py-3 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700 shadow-lg shadow-violet-200 active:scale-95 transition-all text-sm flex items-center gap-2 ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
              >
                <span>{isSaving ? 'Saving...' : 'Save Evidence'}</span>
                {!isSaving && (
                  <div className="bg-white/20 rounded-full p-0.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotationModal;
