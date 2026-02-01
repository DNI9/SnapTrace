import { useCallback, useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { STORAGE_KEYS, DEFAULTS } from '../utils/constants';

export type Tool = 'none' | 'rectangle' | 'text' | 'step';

interface FabricEvent {
  scenePoint: { x: number; y: number };
  e: Event;
}

export const useFabricCanvas = (
  canvasElRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  image: string
) => {
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [currentTool, setCurrentTool] = useState<Tool>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ANNOTATION_TOOL);
    return (saved as Tool) || DEFAULTS.ANNOTATION_TOOL;
  });
  const [stepCounter, setStepCounter] = useState(1);
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);

  // Undo/Redo Stacks
  const historyRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const [historyLength, setHistoryLength] = useState(0);
  const [redoLength, setRedoLength] = useState(0);

  // Drawing Refs
  const isDrawingRef = useRef(false);
  const activeObjRef = useRef<fabric.Rect | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  // --- Helper: Apply Background ---
  const applyBackground = useCallback(
    (canvas: fabric.Canvas, img: HTMLImageElement) => {
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
    },
    [containerRef]
  );

  // --- Helper: Save State ---
  const saveState = useCallback(() => {
    if (!fabricCanvasRef.current) return;
    const json = fabricCanvasRef.current.toJSON();
    delete json.backgroundImage;
    delete json.background;

    const jsonString = JSON.stringify(json);
    historyRef.current.push(jsonString);
    redoStackRef.current = [];
    setHistoryLength(historyRef.current.length);
    setRedoLength(0);
  }, []);

  const handleUndo = useCallback(async () => {
    if (historyRef.current.length <= 1 || !fabricCanvasRef.current || !imgElement) return;

    const currentState = historyRef.current.pop();
    if (currentState) {
      redoStackRef.current.push(currentState);
    }

    const previousState = historyRef.current[historyRef.current.length - 1];

    if (previousState) {
      await fabricCanvasRef.current.loadFromJSON(JSON.parse(previousState));
      applyBackground(fabricCanvasRef.current, imgElement);

      // Restore interaction properties based on current tool
      const isNone = currentTool === 'none';
      fabricCanvasRef.current.selection = isNone;
      fabricCanvasRef.current.defaultCursor = isNone ? 'default' : 'crosshair';
      fabricCanvasRef.current.forEachObject(obj => {
        obj.selectable = isNone;
        obj.evented = isNone;
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
      applyBackground(fabricCanvasRef.current, imgElement);

      const isNone = currentTool === 'none';
      fabricCanvasRef.current.selection = isNone;
      fabricCanvasRef.current.defaultCursor = isNone ? 'default' : 'crosshair';
      fabricCanvasRef.current.forEachObject(obj => {
        obj.selectable = isNone;
        obj.evented = isNone;
      });

      fabricCanvasRef.current.requestRenderAll();
    }

    setHistoryLength(historyRef.current.length);
    setRedoLength(redoStackRef.current.length);
  }, [currentTool, imgElement, applyBackground]);

  const clearAll = useCallback(() => {
    if (!fabricCanvasRef.current) return;
    fabricCanvasRef.current.getObjects().forEach(o => {
      if (o !== fabricCanvasRef.current?.backgroundImage) {
        fabricCanvasRef.current?.remove(o);
      }
    });
    fabricCanvasRef.current.requestRenderAll();
    saveState();
  }, [saveState]);

  // Persist tool selection & Update Canvas State
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ANNOTATION_TOOL, currentTool);

    if (fabricCanvasRef.current) {
      const isNone = currentTool === 'none';
      fabricCanvasRef.current.selection = isNone;
      fabricCanvasRef.current.defaultCursor = isNone ? 'default' : 'crosshair';
      fabricCanvasRef.current.forEachObject(obj => {
        obj.selectable = isNone;
        obj.evented = isNone;
      });
      fabricCanvasRef.current.requestRenderAll();
    }
  }, [currentTool]);

  // Initialize Canvas
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      selection: false,
      defaultCursor: 'default',
    });
    fabricCanvasRef.current = canvas;

    const img = new Image();
    img.src = image;
    img.onload = () => {
      setImgElement(img);
      applyBackground(canvas, img);
      canvas.calcOffset();
      saveState();
    };

    const onObjectModified = () => saveState();
    const onTextEditingExited = () => saveState();

    canvas.on('object:modified', onObjectModified);
    canvas.on('text:editing:exited', onTextEditingExited);

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [image, applyBackground, saveState, containerRef, canvasElRef]); // Added containerRef and canvasElRef to dep array, technically they are refs so stable but good practice or acceptable.

  // Drawing Logic
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
          stroke: '#ef4444',
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
          fill: '#ef4444',
          fontSize: 24,
          fontWeight: 'bold',
          selectable: true,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        setCurrentTool('none');
        saveState();
      } else if (currentTool === 'step') {
        const circle = new fabric.Circle({
          radius: 14,
          fill: '#ef4444',
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
          hasControls: false,
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

  // Handle Delete Key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only if not in input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
          return;

        const canvas = fabricCanvasRef.current;
        if (canvas) {
          const active = canvas.getActiveObjects();
          if (active.length) {
            e.preventDefault();
            canvas.remove(...active);
            canvas.discardActiveObject();
            canvas.requestRenderAll();
            saveState();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveState]);

  return {
    fabricCanvasRef,
    currentTool,
    setCurrentTool,
    historyLength,
    redoLength,
    handleUndo,
    handleRedo,
    stepCounter,
    clearAll,
    imgElement,
  };
};
