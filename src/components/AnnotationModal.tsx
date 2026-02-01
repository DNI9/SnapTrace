import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { compressImage } from '../utils/storage';

interface AnnotationModalProps {
  image: string;
  onSave: (description: string, finalImage: string) => void;
  onCancel: () => void;
}

type Tool = 'none' | 'rectangle' | 'text' | 'step';

interface FabricEvent {
  scenePoint: { x: number; y: number };
  e: Event;
}

const TOOL_STORAGE_KEY = 'snaptrace-annotation-tool';

const AnnotationModal: React.FC<AnnotationModalProps> = ({ image, onSave, onCancel }) => {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [description, setDescription] = useState('');
  const [currentTool, setCurrentTool] = useState<Tool>(() => {
    const saved = localStorage.getItem(TOOL_STORAGE_KEY);
    return (saved as Tool) || 'none';
  });
  const [stepCounter, setStepCounter] = useState(1);

  // Undo/Redo Stacks
  // We store JSON strings of the canvas state
  const historyRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  // We need state to trigger re-renders for button disabled states if we want,
  // but for now let's just keep it simple or use forceUpdate if needed.
  // Actually, let's track length in state to update UI.
  const [historyLength, setHistoryLength] = useState(0);
  const [redoLength, setRedoLength] = useState(0);

  // State for rectangle drawing
  const isDrawingRef = useRef(false);
  const activeObjRef = useRef<fabric.Rect | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null); // Keep track for dimensions
  const [toolbarVisible, setToolbarVisible] = useState(true); // Default to visible for better UX
  const [isSaving, setIsSaving] = useState(false);

  // Persist tool selection
  useEffect(() => {
    localStorage.setItem(TOOL_STORAGE_KEY, currentTool);

    // Update canvas selection capability based on tool
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.selection = currentTool === 'none';
      fabricCanvasRef.current.defaultCursor = currentTool === 'none' ? 'default' : 'crosshair';
      fabricCanvasRef.current.forEachObject(obj => {
        obj.selectable = currentTool === 'none';
        obj.evented = currentTool === 'none'; // distinct from selectable in some versions, basically 'interactive'
      });
      fabricCanvasRef.current.requestRenderAll();
    }
  }, [currentTool]);

  // Lock body scroll
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Helper to apply background
  const applyBackground = useCallback((canvas: fabric.Canvas, img: HTMLImageElement) => {
    const containerW = containerRef.current?.clientWidth || 800;
    const containerH = containerRef.current?.clientHeight || 600;

    const scale = Math.min(
      (containerW - 80) / img.naturalWidth,
      (containerH - 80) / img.naturalHeight,
      1
    );

    const finalW = img.naturalWidth * scale;
    const finalH = img.naturalHeight * scale;

    canvas.setDimensions({ width: finalW, height: finalH });

    const fImg = new fabric.Image(img);
    fImg.set({
      originX: 'left',
      originY: 'top',
      scaleX: scale,
      scaleY: scale,
      selectable: false,
      evented: false,
    });

    canvas.backgroundImage = fImg;
    canvas.requestRenderAll();
  }, []);

  // Helper to save state
  const saveState = useCallback(() => {
    if (!fabricCanvasRef.current) return;
    // Exclude background from state
    const json = fabricCanvasRef.current.toJSON();
    delete json.backgroundImage;
    delete json.background; // defensive

    const jsonString = JSON.stringify(json);
    historyRef.current.push(jsonString);
    redoStackRef.current = []; // Clear redo on new action
    setHistoryLength(historyRef.current.length);
    setRedoLength(0);
  }, []);

  const handleUndo = useCallback(async () => {
    // Keep at least one state (the initial base state)
    if (historyRef.current.length <= 1 || !fabricCanvasRef.current || !imgElement) return;

    // Pop the current state (e.g. State N)
    const currentState = historyRef.current.pop();
    if (currentState) {
      redoStackRef.current.push(currentState);
    }

    // Peek at the previous state (State N-1)
    const previousState = historyRef.current[historyRef.current.length - 1];

    if (previousState) {
      await fabricCanvasRef.current.loadFromJSON(JSON.parse(previousState));
      // Re-apply background
      applyBackground(fabricCanvasRef.current, imgElement);
      // Restore interaction properties
      fabricCanvasRef.current.selection = currentTool === 'none';
      fabricCanvasRef.current.defaultCursor = currentTool === 'none' ? 'default' : 'crosshair';
      fabricCanvasRef.current.forEachObject(obj => {
        obj.selectable = currentTool === 'none';
        obj.evented = currentTool === 'none';
      });

      fabricCanvasRef.current.requestRenderAll();
    }

    setHistoryLength(historyRef.current.length);
    setRedoLength(redoStackRef.current.length);
  }, [currentTool, imgElement, applyBackground]);

  const handleRedo = useCallback(async () => {
    if (redoStackRef.current.length === 0 || !fabricCanvasRef.current || !imgElement) return;

    const nextState = redoStackRef.current.pop();

    if (nextState) {
      historyRef.current.push(nextState);
      await fabricCanvasRef.current.loadFromJSON(JSON.parse(nextState));
      // Re-apply background
      applyBackground(fabricCanvasRef.current, imgElement);
      // Restore interaction properties
      fabricCanvasRef.current.selection = currentTool === 'none';
      fabricCanvasRef.current.defaultCursor = currentTool === 'none' ? 'default' : 'crosshair';
      fabricCanvasRef.current.forEachObject(obj => {
        obj.selectable = currentTool === 'none';
        obj.evented = currentTool === 'none';
      });
      fabricCanvasRef.current.requestRenderAll();
    }

    setHistoryLength(historyRef.current.length);
    setRedoLength(redoStackRef.current.length);
  }, [currentTool, imgElement, applyBackground]);

  // Initialize Fabric Canvas and Image
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return;

    // Create fabric canvas
    const canvas = new fabric.Canvas(canvasElRef.current, {
      selection: false, // defaults, effectively overridden by tool effect
      defaultCursor: 'default',
    });
    fabricCanvasRef.current = canvas;

    // Load image
    const img = new Image();
    img.src = image;
    img.onload = () => {
      setImgElement(img);
      applyBackground(canvas, img);

      // Recalculate offset to ensure mouse coordinates are correct relative to the canvas
      // This is crucial because the canvas is in a centered flex container
      canvas.calcOffset();

      // Save initial state (Undo base)
      saveState();
    };

    // Explicit State Saving Listeners
    // 1. Modification (Move, Scale, Rotate)
    const onObjectModified = () => {
      saveState();
    };
    canvas.on('object:modified', onObjectModified);

    // 2. Text Editing Finished
    const onTextEditingExited = () => {
      saveState();
    };
    canvas.on('text:editing:exited', onTextEditingExited);

    // NOTE: object:added is intentionally REMOVED to prevent history loops during loadFromJSON

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [image, applyBackground, saveState]);

  // Event Listeners for Drawing
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (opt: FabricEvent) => {
      if (currentTool === 'none') return;

      const pointer = opt.scenePoint;
      if (!pointer) return;

      if (currentTool === 'rectangle') {
        isDrawingRef.current = true;
        startPosRef.current = { x: pointer.x, y: pointer.y };

        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          originX: 'left',
          originY: 'top',
          width: 0,
          height: 0,
          fill: 'transparent',
          stroke: '#ef4444', // Red-500
          strokeWidth: 3,
          selectable: false,
          evented: false,
        });

        activeObjRef.current = rect;
        canvas.add(rect);
      } else if (currentTool === 'text') {
        const text = new fabric.IText('Text', {
          left: pointer.x,
          top: pointer.y,
          fontFamily: 'Inter, sans-serif',
          fill: '#ef4444', // Red-500
          fontSize: 24,
          fontWeight: 'bold',
          selectable: true,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        setCurrentTool('none');

        // 3. Save state after adding text
        saveState();
      } else if (currentTool === 'step') {
        const circle = new fabric.Circle({
          radius: 14,
          fill: '#ef4444', // Red-500
          originX: 'center',
          originY: 'center',
        });

        const text = new fabric.Text(stepCounter.toString(), {
          fontSize: 16,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'bold',
          fill: 'white',
          originX: 'center',
          originY: 'center',
        });

        const group = new fabric.Group([circle, text], {
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          selectable: true,
          hasControls: false, // allow selection to move, but not resize/rotate ideally
        });

        canvas.add(group);
        setStepCounter(prev => prev + 1);
        saveState();
      }
    };

    const handleMouseMove = (opt: FabricEvent) => {
      if (
        !isDrawingRef.current ||
        !activeObjRef.current ||
        currentTool !== 'rectangle' ||
        !startPosRef.current
      )
        return;

      const pointer = opt.scenePoint;
      if (!pointer) return;

      const startX = startPosRef.current.x;
      const startY = startPosRef.current.y;

      const width = Math.abs(pointer.x - startX);
      const height = Math.abs(pointer.y - startY);

      const left = Math.min(startX, pointer.x);
      const top = Math.min(startY, pointer.y);

      activeObjRef.current.set({ left, top, width, height });
      canvas.requestRenderAll();
    };

    const handleMouseUp = () => {
      if (isDrawingRef.current && currentTool === 'rectangle') {
        isDrawingRef.current = false;
        if (activeObjRef.current) {
          if (activeObjRef.current.width! < 5 || activeObjRef.current.height! < 5) {
            canvas.remove(activeObjRef.current);
          } else {
            activeObjRef.current.setCoords();
            // 4. Save state after drawing rectangle
            saveState();
          }
          activeObjRef.current = null;
        }
      }
    };

    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [currentTool, saveState, stepCounter]);

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
  }, [imgElement, isSaving, onSave, description]);

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
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const canvas = fabricCanvasRef.current;
        if (canvas) {
          const active = canvas.getActiveObjects();
          if (active.length) {
            canvas.remove(...active);
            canvas.discardActiveObject();
            canvas.requestRenderAll();
            saveState();
          }
        }
      }
    };

    // Use capture phase (true) to intercept events before they reach the page
    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [onCancel, historyLength, redoLength, handleUndo, handleRedo, saveState, handleSave]); // Re-bind for closures or use Refs

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[2147483647] flex flex-col bg-slate-50 animate-in fade-in duration-200 font-sans text-slate-800">
      {/* Header (Removed) */}

      {/* Content Wrapper */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar Toolbar */}
        <div
          className={`absolute left-6 top-6 z-50 transition-all duration-300 ease-in-out ${
            toolbarVisible
              ? 'translate-x-0 opacity-100'
              : '-translate-x-10 opacity-0 pointer-events-none'
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

            {/* Timer / Step Placeholder to match design */}
            <button
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 w-12 ${
                currentTool === 'step'
                  ? 'text-violet-600' // If we keep step functional
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              onClick={() => setCurrentTool('step')} // Or generic timer
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
              onClick={handleUndo}
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
              onClick={handleRedo}
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
              onClick={() => {
                fabricCanvasRef.current?.getObjects().forEach(o => {
                  if (o !== fabricCanvasRef.current?.backgroundImage) {
                    fabricCanvasRef.current?.remove(o);
                  }
                });
                fabricCanvasRef.current?.requestRenderAll();
                saveState();
              }}
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
        {/* Floating Badge */}
        {/* Floating Badge (Removed) */}

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
