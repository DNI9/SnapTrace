import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';

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

  // State for rectangle drawing
  const isDrawingRef = useRef(false);
  const activeObjRef = useRef<fabric.Rect | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null); // Keep track for dimensions
  const [toolbarVisible, setToolbarVisible] = useState(true); // Default to visible for better UX

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
      const containerW = containerRef.current?.clientWidth || 800;
      const containerH = containerRef.current?.clientHeight || 600;

      const scale = Math.min(
        (containerW - 40) / img.naturalWidth,
        (containerH - 40) / img.naturalHeight,
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
    };

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [image]); // Re-init if image changes (unlikely in modal lifespan but correct)

  // Event Listeners for Drawing
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (opt: FabricEvent) => {
      if (currentTool === 'none') return;

      // Fabric 6+ passes pointer/scenePoint in the options
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
          selectable: false, // Initially false while drawing
          evented: false,
        });

        activeObjRef.current = rect;
        canvas.add(rect);
      } else if (currentTool === 'text') {
        // For text, we just click and add
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
        setCurrentTool('none'); // Switch back to select after adding text
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
          // Determine if it was just a click (too small)
          if (activeObjRef.current.width! < 5 || activeObjRef.current.height! < 5) {
            canvas.remove(activeObjRef.current);
          } else {
            activeObjRef.current.setCoords();
            // Make it selectable now that drawing is done, IF we want to auto-switch or keep drawing?
            // Let's keep drawing mode active for multiple rects, but they become selectable only when tool changes to 'none'.
          }
          activeObjRef.current = null;
        }
      }
    };

    // Remove existing listeners to avoid dupes if re-running effect
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
  }, [currentTool]); // Re-bind when tool changes

  const handleSave = () => {
    if (!fabricCanvasRef.current || !imgElement) return;

    const canvas = fabricCanvasRef.current;
    const bgImg = canvas.backgroundImage as fabric.Image;
    if (!bgImg) return;

    const currentScale = bgImg.scaleX || 1;
    const multiplier = 1 / currentScale;

    const dataUrl = canvas.toDataURL({
      format: 'png',
      multiplier: multiplier,
    });

    onSave(description, dataUrl);
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if an input is focused (except Tab/Escape which are global nav)
      if (document.activeElement === inputRef.current) {
        if (e.key === 'Tab') {
          e.preventDefault();
          setToolbarVisible(prev => !prev);
        } else if (e.key === 'Escape') {
          onCancel();
        }
        return;
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
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [onCancel]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[2147483647] flex flex-col bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-200">
      {/* Floating Toolbar */}
      <div
        className={`absolute top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-in-out ${
          toolbarVisible
            ? 'translate-y-0 opacity-100'
            : '-translate-y-10 opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-full px-2 py-1.5 flex items-center space-x-1">
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

          <div className="w-px h-5 bg-slate-200 mx-1"></div>

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

          <div className="w-px h-5 bg-slate-200 mx-1"></div>

          <button
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
            onClick={() => {
              fabricCanvasRef.current?.getObjects().forEach(o => {
                if (o !== fabricCanvasRef.current?.backgroundImage) {
                  fabricCanvasRef.current?.remove(o);
                }
              });
              fabricCanvasRef.current?.requestRenderAll();
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
        <div className="text-center mt-2">
          <span className="bg-black/50 backdrop-blur text-white/80 text-[10px] px-2 py-0.5 rounded-full font-medium">
            Tab to toggle
          </span>
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
              onKeyDown={handleInputKeyDown}
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={onCancel}
              className="flex-1 md:flex-none px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors text-sm"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              className="flex-1 md:flex-none px-6 py-2.5 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 shadow-md shadow-violet-200 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
            >
              <span>Save Evidence</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotationModal;
