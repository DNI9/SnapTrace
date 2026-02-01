import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { compressImage } from '../utils/storage';

interface AnnotationModalProps {
  image: string;
  onSave: (description: string, finalImage: string) => void;
  onCancel: () => void;
}

type Tool = 'none' | 'rectangle' | 'text';

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
  }, [currentTool, saveState]);

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
          onCancel();
        }
        return;
      }

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
        onCancel();
      } else if (e.key === 'r' || e.key === 'R') {
        setCurrentTool('rectangle');
      } else if (e.key === 't' || e.key === 'T') {
        setCurrentTool('text');
      } else if (e.key === 'v' || e.key === 'V') {
        setCurrentTool('none');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only handle delete if input is not focused
        if (document.activeElement !== inputRef.current) {
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
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [onCancel, historyLength, redoLength, handleUndo, handleRedo, saveState, handleSave]); // Re-bind for closures or use Refs

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[2147483647] flex flex-col bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-200">
      {/* Content Wrapper */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar Toolbar */}
        <div
          className={`ml-4 self-center z-50 transition-all duration-300 ease-in-out ${
            toolbarVisible
              ? 'translate-x-0 opacity-100'
              : '-translate-x-10 opacity-0 pointer-events-none'
          }`}
        >
          <div className="bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-full px-1 py-1.5 flex flex-col items-center space-y-1">
            <button
              className={`p-2 rounded-full transition-all duration-200 ${
                currentTool === 'none'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
              onClick={() => setCurrentTool('none')}
              title="Select / Move (V)"
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
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                <path d="M13 13l6 6" />
              </svg>
            </button>

            <div className="w-5 h-px bg-slate-200 my-1"></div>

            <button
              className={`p-2 rounded-full transition-all duration-200 ${
                currentTool === 'rectangle'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
              onClick={() => setCurrentTool('rectangle')}
              title="Rectangle (R)"
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
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              </svg>
            </button>

            <button
              className={`p-2 rounded-full transition-all duration-200 ${
                currentTool === 'text'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
              onClick={() => setCurrentTool('text')}
              title="Text (T)"
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
                <path d="M4 7V4h16v3" />
                <path d="M9 20h6" />
                <path d="M12 4v16" />
              </svg>
            </button>

            <div className="w-5 h-px bg-slate-200 my-1"></div>

            <button
              className={`p-2 rounded-full transition-all duration-200 ${
                historyLength <= 1
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
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
            </button>

            <button
              className={`p-2 rounded-full transition-all duration-200 ${
                redoLength === 0
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
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
            </button>

            <div className="w-5 h-px bg-slate-200 my-1"></div>

            <button
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
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
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden flex justify-center items-center p-8 active:cursor-move"
        >
          <div className="relative shadow-2xl rounded-sm overflow-hidden ring-1 ring-white/10">
            <canvas ref={canvasElRef} />
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="bg-white border-t border-slate-100 p-4 md:px-8">
        <div className="max-w-4xl mx-auto w-full flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="w-4 h-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                ></path>
              </svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all placeholder:text-slate-400 text-slate-900 text-sm font-medium"
              placeholder="Describe what you found... (Enter to save)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSave();
              }}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={onCancel}
              className="flex-1 md:flex-none px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors text-sm"
              disabled={isSaving}
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex-1 md:flex-none px-6 py-2.5 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 shadow-md shadow-violet-200 active:scale-95 transition-all text-sm flex items-center justify-center gap-2 ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
            >
              <span>{isSaving ? 'Saving...' : 'Save Evidence'}</span>
              {!isSaving && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotationModal;
