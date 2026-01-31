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
  const [toolbarVisible, setToolbarVisible] = useState(false);

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
          stroke: 'red',
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
          fontFamily: 'sans-serif',
          fill: 'red',
          fontSize: 20,
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

    // We need to export full resolution.
    // Fabric's toDataURL exports what's on the canvas.
    // Since we scaled the image to fit the view, we might want to scale it back up for the save?
    // OR, we can just export based on the original image dimensions.

    const canvas = fabricCanvasRef.current;

    // To export full resolution:
    // 1. Calculate the scale factor required to return to original image size
    // The current canvas dimensions are approx (img.naturalWidth * scale).
    // So we need to multiplier = 1 / scale.
    // However, fabric's toDataURL with 'multiplier' handles this.

    // BUT, we set the background image with specific scaleX/scaleY.
    // If we simply use multiplier, everything gets scaled.

    // Let's rely on fabric's multiplier.
    // Our canvas width is (img.naturalWidth * scale).
    // We want output width to be (img.naturalWidth).
    // So multiplier = 1 / scale.

    // The background image object on canvas has .scaleX = scale.
    // If we export with multiplier = 1/scale, the resulting image should be original size.
    // And vector objects (rects) will be scaled up accordingly.

    // We need to find the scale we used.
    // It is stored in the background object, or we can recalc.

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
    // Other keys handled globally or default behavior (typing)
  };

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-white shadow-xl overflow-hidden flex flex-col w-full h-full">
        {/* Toolbar */}
        {toolbarVisible ? (
          <div className="bg-gray-100 px-4 py-2 border-b flex space-x-2 items-center">
            <button
              className={`p-2 rounded border transition-colors ${currentTool === 'none' ? 'bg-gray-300 text-black border-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setCurrentTool('none')}
              title="Select / Move (V)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
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
            <button
              className={`p-2 rounded transition-colors ${currentTool === 'rectangle' ? 'bg-red-700 text-white' : 'bg-red-500 text-white hover:bg-red-600'}`}
              onClick={() => setCurrentTool('rectangle')}
              title="Rectangle (R)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
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
              className={`p-2 rounded transition-colors ${currentTool === 'text' ? 'bg-blue-700 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
              onClick={() => setCurrentTool('text')}
              title="Text (T)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
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
            <button
              className="p-2 bg-gray-500 text-white rounded hover:bg-gray-600 ml-2"
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
                width="16"
                height="16"
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

            <span className="text-xs text-gray-500 ml-auto">
              {imgElement
                ? `${imgElement.naturalWidth}×${imgElement.naturalHeight}px`
                : 'Loading...'}
            </span>
            <span className="text-xs text-gray-400">Press Tab to hide</span>
          </div>
        ) : (
          <div className="bg-gray-100 px-4 py-2 border-b text-center text-xs text-gray-500">
            Press <kbd className="font-mono bg-gray-200 px-1 rounded">Tab</kbd> to show annotation
            toolbar
          </div>
        )}

        {/* Canvas Container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-200 flex justify-center items-center p-4 min-h-[300px]"
          onClick={() => {
            // Ensure canvas focus if needed
          }}
        >
          <canvas ref={canvasElRef} />
        </div>

        {/* Footer / Input */}
        <div className="p-4 bg-white border-t">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input
            ref={inputRef}
            type="text"
            className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Describe what you found... (Enter to save)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <div className="flex justify-end mt-3 space-x-3">
            <div className="text-xs text-gray-400 flex items-center mr-auto">
              Tips: Use 'Delete' key to remove selected annotations.
            </div>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Evidence
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotationModal;
